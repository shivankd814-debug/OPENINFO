# OPENINFO — The World of Useful Discoveries

**Discover. Learn. Build. Launch. Grow.**

OPENINFO is a free-first discovery and learning platform. It combines public-source discovery, a multilingual interface, student learning paths and a practical build-and-launch academy.

## What is included

- Premium responsive interface for desktop, tablet and Android browsers.
- Hindi, English and Hinglish interface selector.
- 12 discovery departments and 72 focus areas.
- Discovery feed with search, department filters, freshness filters and source links.
- Reddit public RSS community radar, GitHub public repository search, Hugging Face model metadata, Hacker News, OpenAlex and RSS feeds.
- Agent registry, source health and scheduled scan orchestration.
- Student Universe, career Skill Roadmaps and Build & Launch Academy.
- Public-facing product only — no Admin Studio or public admin dashboard.
- Optional Chrome extension to save a page you explicitly choose into the server library (requires `OPENINFO_EXTENSION_TOKEN`).
- Creator credit: Created by Shivank Dwivedi.

## Run locally

Requirements: Node.js 20+.

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000`.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
npm install
npm start
```

## Deploy to Render

1. Push the complete ZIP contents into the existing `shivankd814-debug/OPENINFO` GitHub repository (keep `package.json` at the repository root).
2. In Render, connect the existing OPENINFO Web Service to that repository and branch.
3. Build command: `npm install`
4. Start command: `npm start`
5. Health check: `/api/health`
6. Add environment variables from `.env.example` as needed.
7. Keep `ENABLE_SCHEDULER=true` and set an interval of at least 30 minutes.

`render.yaml` is included as a deployment reference. If the service is already connected to GitHub, a push to its watched branch normally triggers a deployment.

## Discovery sources and honesty rules

- Reddit uses public subreddit RSS feeds. It is a community lead, not an official product verification source. Reddit availability and rate limits can change.
- GitHub, Hugging Face, Hacker News and OpenAlex use their public endpoints.
- RSS feeds are public feeds. Extra feeds can be added in `EXTRA_RSS_URLS`.
- Each record links to its source. `SOURCE LINKED` means the record has provenance; it does **not** mean every claim or price has been independently verified.
- Pricing is marked as unverified unless the source itself supplies reliable pricing metadata. Do not treat unknown as free.
- The scheduled engine reports actual connector outcomes. Agent role names do not imply that every connector succeeded.
- No private account scraping, bypassing access controls or collecting private user data.

## Important hosting/storage limitation

The included JSON store is suitable for a starter deployment and local testing. **Render Free web-service filesystems are ephemeral**, so discoveries can be reset after restarts, redeploys or instance replacement. For durable production storage, connect a managed PostgreSQL database and migrate `server/store.js` to it before relying on long-term history. Do not assume this ZIP has durable cloud storage configured.

## Chrome extension

1. Open `chrome://extensions` in Chrome and enable Developer mode.
2. Choose Load unpacked and select the `extension/` folder.
3. Open extension Settings and enter your Render service URL plus the same `OPENINFO_EXTENSION_TOKEN` configured on the server.
4. Use the extension only on pages you intentionally choose to save.

## API

- `GET /api/health`
- `GET /api/categories`
- `GET /api/agents`
- `GET /api/discoveries?q=&category=&tab=`
- `GET /api/status`
- `POST /api/scan` (requires `OPENINFO_SCAN_TOKEN` configured on the server)
- `POST /api/report`

## Project structure

```text
OPENINFO/
  public/             responsive website
  server/             API, collectors, store and scheduler
  data/               12 departments and agent registry
  extension/          optional Chrome save-to-library extension
  scripts/            validation
  render.yaml         Render deployment reference
  .env.example        environment template
  README.md
  ARCHITECTURE.md
  ROADMAP.md
  SECURITY.md
```

## Quality principles

Useful discoveries over volume. No fake launch dates, fake scan counters, copied content dumps, duplicate links or invented prices. Keep planned capabilities clearly labelled until their connectors are implemented and verified.
