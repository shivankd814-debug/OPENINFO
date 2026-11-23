
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { collectAll } from "./collectors.js";
import { readStore, writeStore, upsert, root } from "./store.js";

// Load environment variables from .env if present
const envPath = path.join(root, ".env");

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);

    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

const publicDir = path.join(root, "public");

const categories = JSON.parse(
  fs.readFileSync(path.join(root, "data/categories.json"), "utf8")
);

const agents = JSON.parse(
  fs.readFileSync(path.join(root, "data/agents.json"), "utf8")
);

const port = Number(process.env.PORT || 3000);

let scanning = false;
let lastScanError = null;
let lastScanStarted = null;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp"
};

function send(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "access-control-allow-origin": "*"
  });

  res.end(JSON.stringify(data));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", chunk => {
      raw += chunk;

      if (raw.length > 1e6) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

async function scan() {
  if (scanning) return { busy: true };

  scanning = true;
  lastScanStarted = new Date().toISOString();
  lastScanError = null;

  try {
    const result = await collectAll();
    const saved = upsert(result.items || []);

    const db = readStore();

    db.sources = result.sources || [];

    db.scans.unshift({
      at: new Date().toISOString(),
      ...saved,
      sources: db.sources
    });

    db.scans = db.scans.slice(0, 100);
    db.settings.lastScanAt = new Date().toISOString();

    writeStore(db);

    return {
      ...saved,
      sources: db.sources
    };
  } catch (error) {
    lastScanError = error.message;
    throw error;
  } finally {
    scanning = false;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://localhost");

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers":
          "content-type,x-openinfo-scan-token,x-openinfo-extension"
      });

      return res.end();
    }

    if (u.pathname.startsWith("/api/")) {

      if (req.method === "GET" && u.pathname === "/api/health") {
        return send(res, 200, {
          ok: true,
          service: "OPENINFO",
          version: "2.0.0",
          scanning,
          lastScanStarted,
          lastScanError,
          lastScanAt: readStore().settings.lastScanAt
        });
      }

      if (req.method === "GET" && u.pathname === "/api/categories") {
        return send(res, 200, categories);
      }

      if (req.method === "GET" && u.pathname === "/api/agents") {
        return send(
          res,
          200,
          agents.map(agent => ({
            ...agent,
            status:
              agent.id === "coordinator"
                ? scanning
                  ? "working"
                  : "scheduled"
                : "connector"
          }))
        );
      }

      if (req.method === "GET" && u.pathname === "/api/discoveries") {
        const db = readStore();

        let items = db.discoveries || [];

        const q = (u.searchParams.get("q") || "")
          .toLowerCase()
          .trim();

        const category = u.searchParams.get("category");
        const tab = u.searchParams.get("tab");

        if (q) {
          items = items.filter(item =>
            [
              item.title,
              item.description,
              ...(item.tags || []),
              item.source
            ]
              .map(value => String(value || ""))
              .join(" ")
              .toLowerCase()
              .includes(q)
          );
        }

        if (category) {
          items = items.filter(item => item.category === category);
        }

        if (tab === "free") {
          items = items.filter(item =>
            /free|open source/i.test(item.pricing || "")
          );
        }

        if (tab === "latest") {
          items = [...items].sort(
            (a, b) =>
              new Date(b.discoveredAt) - new Date(a.discoveredAt)
          );
        }

        if (tab === "trending") {
          items = [...items].sort(
            (a, b) => (b.score || 0) - (a.score || 0)
          );
        }

        return send(res, 200, {
          items: items.slice(0, 120),
          total: items.length,
          lastScanAt: db.settings.lastScanAt
        });
      }

      if (req.method === "GET" && u.pathname === "/api/status") {
        const db = readStore();

        return send(res, 200, {
          sources: db.sources,
          scans: db.scans.slice(0, 12),
          settings: db.settings,
          discoveryCount: db.discoveries.length,
          scanning,
          lastScanError
        });
      }

      if (req.method === "POST" && u.pathname === "/api/scan") {
        const secret = process.env.OPENINFO_SCAN_TOKEN;

        if (
          !secret ||
          req.headers["x-openinfo-scan-token"] !== secret
        ) {
          return send(res, 401, {
            error:
              "Manual scan is protected. The scheduled discovery engine will run automatically."
          });
        }

        return send(res, 200, await scan());
      }

      if (req.method === "POST" && u.pathname === "/api/extension/save") {
        const expected = process.env.OPENINFO_EXTENSION_TOKEN;

        if (
          !expected ||
          req.headers["x-openinfo-extension"] !== expected
        ) {
          return send(res, 401, {
            error: "Extension token is missing or invalid"
          });
        }

        const b = await body(req);

        let parsed;

        try {
          parsed = new URL(b.url);
        } catch {
          return send(res, 400, {
            error: "A valid page URL is required"
          });
        }

        if (!["http:", "https:"].includes(parsed.protocol)) {
          return send(res, 400, {
            error: "Only HTTP(S) pages can be saved"
          });
        }

        const db = readStore();

        const item = {
          id: crypto.randomUUID(),
          title: String(b.title || parsed.hostname).slice(0, 240),
          url: parsed.href,
          category: String(b.category || "General").slice(0, 80),
          note: String(b.note || "").slice(0, 1000),
          savedAt: new Date().toISOString()
        };

        db.savedPages.unshift(item);
        db.savedPages = db.savedPages.slice(0, 2000);

        writeStore(db);

        return send(res, 201, {
          ok: true,
          id: item.id
        });
      }

      if (req.method === "GET" && u.pathname === "/api/extension/saved") {
        const expected = process.env.OPENINFO_EXTENSION_TOKEN;

        if (
          !expected ||
          req.headers["x-openinfo-extension"] !== expected
        ) {
          return send(res, 401, {
            error: "Extension token is missing or invalid"
          });
        }

        return send(res, 200, {
          items: readStore().savedPages || []
        });
      }

      if (req.method === "POST" && u.pathname === "/api/report") {
        const b = await body(req);
        const message = String(b.message || "").slice(0, 1000);

        if (!message.trim()) {
          return send(res, 400, {
            error: "A short report message is required."
          });
        }

        const db = readStore();

        db.reports.unshift({
          message,
          createdAt: new Date().toISOString()
        });

        db.reports = db.reports.slice(0, 300);

        writeStore(db);

        return send(res, 201, { ok: true });
      }

      return send(res, 404, {
        error: "API route not found"
      });
    }

    // Serve frontend files
    let rel;

    try {
      rel =
        u.pathname === "/"
          ? "index.html"
          : decodeURIComponent(u.pathname).replace(/^\/+/, "");
    } catch {
      res.writeHead(400);
      return res.end("Invalid URL");
    }

    const safe = path.resolve(publicDir, rel);

    if (
      !safe.startsWith(publicDir + path.sep) &&
      safe !== path.join(publicDir, "index.html")
    ) {
      res.writeHead(403);
      return res.end("Forbidden");
    }

    fs.readFile(safe, (error, data) => {
      if (error) {
        res.writeHead(404);
        return res.end("Not found");
      }

      res.writeHead(200, {
        "content-type":
          mime[path.extname(safe)] || "application/octet-stream",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin"
      });

      res.end(data);
    });

  } catch (error) {
    if (!res.headersSent) {
      send(res, 500, {
        error: error.message || "Internal server error"
      });
    }
  }
});

server.listen(port, () => {
  console.log(`OPENINFO 2.0 listening on ${port}`);
});

// Automatic discovery scheduler
if (process.env.ENABLE_SCHEDULER !== "false") {
  const minutes = Math.max(
    30,
    Number(process.env.SCAN_INTERVAL_MINUTES || 90)
  );

  setTimeout(() => {
    scan().catch(error =>
      console.error("Initial scan:", error.message)
    );
  }, 8000);

  setInterval(() => {
    scan().catch(error =>
      console.error("Scheduled scan:", error.message)
    );
  }, minutes * 60000);
}
