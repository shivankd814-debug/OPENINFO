import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "data");
const file = path.join(dir, "store.json");
fs.mkdirSync(dir, { recursive: true });

const blank = () => ({
  discoveries: [], sources: [], scans: [], reports: [], savedPages: [],
  settings: { lastScanAt: null, schedulerEnabled: true }
});

export function readStore() {
  try { return { ...blank(), ...JSON.parse(fs.readFileSync(file, "utf8")) }; }
  catch { return blank(); }
}
export function writeStore(data) {
  const temp = file + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, file);
}
export function upsert(items) {
  const db = readStore();
  let added = 0, updated = 0;
  for (const item of items) {
    const key = item.canonicalUrl || item.url;
    const old = db.discoveries.find(x => (x.canonicalUrl || x.url) === key);
    if (old) { Object.assign(old, item, { updatedAt: new Date().toISOString() }); updated++; }
    else { db.discoveries.unshift({ ...item, id: crypto.randomUUID(), discoveredAt: new Date().toISOString() }); added++; }
  }
  db.discoveries = db.discoveries.slice(0, 5000);
  writeStore(db);
  return { added, updated, total: db.discoveries.length };
}
export { root };
