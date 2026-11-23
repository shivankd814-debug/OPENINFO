# Security and privacy

- Keep `OPENINFO_ADMIN_TOKEN` and `OPENINFO_EXTENSION_TOKEN` secret and different.
- Configure tokens using host environment secrets; never commit `.env`.
- Extension saves only the currently active tab after an explicit click; it does not request browsing-history access.
- Extension save accepts only HTTP and HTTPS URLs and requires its dedicated token.
- Do not expose admin credentials to frontend JavaScript.
- Use TLS in production and configure strict CORS, CSP, rate limiting, authentication, audit logging and backups before public multi-user deployment.
- Treat collected pages, repository descriptions and issue reports as untrusted text. Escape before rendering; the UI does this for discovery text.
- Collect only public information through permitted APIs/feeds. Respect terms, rate limits, robots restrictions and access controls.
- Do not fetch arbitrary user-supplied URLs from the backend. If a future URL preview service is added, implement SSRF protections and a strict domain allowlist.
- JSON-file persistence is not multi-user safe for horizontally scaled production. Migrate before scaling.
