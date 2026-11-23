# OPENINFO — Global Discovery Platform

A free-first, source-linked discovery website and Node.js backend. It includes a responsive editorial UI, 30 departments / 150 subcategories, a real collector pipeline for GitHub, Hugging Face, Hacker News, OpenAlex and selected public RSS feeds, JSON persistence, scheduled scans, a protected scan endpoint, issue reports, and an explicit-save Chrome extension.

## Requirements
- Node.js 20+
- Internet access for live public-source collectors

## Run locally

```bash
cp .env.example .env
# Set long random OPENINFO_ADMIN_TOKEN and OPENINFO_EXTENSION_TOKEN values in .env
node server/index.js
```

The app runs at `http://localhost:3000`. The server uses Node built-ins and does not require `npm install` dependencies. On Windows PowerShell, set environment variables in the current shell or use `setx` and reopen the terminal; `.env` is an example file and is not automatically loaded by Node.

## Live discovery
- `GET /api/health` — health status.
- `GET /api/categories` — 30 departments and 150 subcategories.
- `GET /api/discoveries` — collected items; supports `q`, `category`, and `tab=latest|free|trending`.
- `GET /api/status` — scan/source status.
- `POST /api/scan` — starts a scan. If `OPENINFO_ADMIN_TOKEN` is configured, send `x-openinfo-admin`.
- `POST /api/report` — submit a short correction/report.
- `POST /api/extension/save` — explicit page save; requires `x-openinfo-extension`.
- `GET /api/extension/saved` — list saved pages; requires extension token.

The scheduled worker starts after boot and scans on `SCAN_INTERVAL_MINUTES` (minimum 15). Set `ENABLE_SCHEDULER=false` to disable it. Source APIs have their own quotas and can fail independently; failures are recorded in `/api/status`.

## Chrome extension
1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked** and select the `extension` folder.
4. Open extension Settings and enter your server URL and `OPENINFO_EXTENSION_TOKEN`.
5. On a page you choose, open the extension, add a category/note and click **Save current page**.

It uses `activeTab` only and does not read browsing history or scrape pages in the background.

## Important implementation boundaries

This ZIP is an executable foundation, not a claim that every idea in the master blueprint is already a finished autonomous agent. The current live collectors are GitHub repository search, Hugging Face model metadata, Hacker News new stories, OpenAlex research metadata and selected public RSS feeds (freeCodeCamp News and Hugging Face Blog). The remaining specialist roles are defined in `server/agents.json` with their actual implementation status. Course discovery, global social discovery, company roadmaps, automatic pricing verification, automatic translation, deep multi-source verification, full user accounts, email/push alerts, and a complete admin dashboard still need their dedicated permitted connectors and implementation. The UI does not fabricate sample discovery records.

Public social platforms are only to be integrated through official APIs or accessible public sources under their terms. No private-profile scraping, login bypass or paywall bypass is included. Upcoming products must have evidence and a distinct status; rumours must never be presented as confirmed.

## Data and deployment

Runtime data is stored in `data/store.json`; back it up. This is suitable for a single-process prototype/small deployment, not multi-instance scale. Before public production, migrate to PostgreSQL, add account authentication/roles, persistent queue infrastructure, per-IP/account rate limits, strict CORS, security headers/CSP, audit logging, backups and monitoring. Put secrets in the host's secret manager, never in source control. The scan endpoint is token-protected when configured. The extension endpoint is disabled unless its token is configured.

A free host may sleep or throttle workers. Do not advertise 24/7 discovery unless the hosting plan and scheduler actually keep workers running. Check `/api/status` for last scan and source failures.

## Folder map

- `public/` — responsive website and client app
- `server/` — API, collectors, persistence and agent registry
- `data/categories.json` — 30 departments and 150 subcategories
- `data/store.json` — generated runtime data (created on first write)
- `extension/` — Chrome Manifest V3 explicit-save extension
- `docs/` — architecture, security, source policy and roadmap
- `scripts/` — validation and packaging helpers

## Attribution

Website footer credit: **Created by Shivank Dwivedi**.
