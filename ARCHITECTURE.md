# OPENINFO Architecture

## Runtime
A single Node.js HTTP process serves static frontend assets and a JSON REST API. Collectors run in-process under a scheduled coordinator. Data is persisted atomically to a local JSON store. This keeps the starter install dependency-free; it is not the intended multi-instance production architecture.

## Components
- Web UI: semantic HTML, CSS, vanilla JavaScript.
- API: Node.js built-in `http` server.
- Collectors: GitHub Search API, Hugging Face Hub API, Hacker News Firebase API.
- Persistence: `data/store.json` with atomic temp-file rename.
- Scheduling: configurable interval timer; no guarantee if host sleeps.
- Extension: Manifest V3, activeTab, explicit user-initiated save.

## Production evolution
Move API to a maintained framework; PostgreSQL for records and user data; Redis/BullMQ or equivalent durable queue; independent worker process; object storage for approved images; full-text search; secure account sessions; monitoring and backups. Keep connector interfaces stable while moving persistence.

## Core entities
Discovery, Category, Source, SourceScan, ResearchJob, Evidence, PricingRecord, SavedPage, UserReport, AgentRun, User, Collection, Notification.

## Data quality
Canonical URL upsert prevents exact-URL duplicates. Each discovery preserves source, source URL, original publish/update timestamp when available, discovery timestamp, pricing claim and verification label. Source-linked means a source URL is present; it does not mean independently fact-checked.
