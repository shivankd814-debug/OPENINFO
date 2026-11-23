# OPENINFO Architecture

```text
Browser (Android / tablet / desktop)
       |
       v
Public frontend (public/)
       |
       v
Node HTTP API (server/index.js)
       |
       +---- Discovery store (server/store.js)
       |
       +---- Scheduled coordinator
                 |
                 +---- Reddit public RSS
                 +---- GitHub public API
                 +---- Hugging Face public API
                 +---- Hacker News public API
                 +---- OpenAlex public API
                 +---- Configured RSS feeds
                         |
                         v
               URL validation + deduplication
                         |
                         v
                Discovery records + source health
```

## Boundaries
- The frontend never receives server secrets.
- Scheduled collection runs on the backend.
- Public scan endpoint is token-protected.
- Public feed is read-only.
- Source-linked provenance is not a claim of independent fact verification.
- JSON persistence is starter storage only; use managed PostgreSQL for durable production history.
