# Security Policy

- Never commit `.env`, API tokens or credentials.
- Keep `OPENINFO_SCAN_TOKEN` private and configure it only on the server.
- The public website does not expose an Admin Studio.
- Only public RSS/API endpoints are used by default.
- The service validates URLs and limits request body size.
- Do not add scraping that bypasses authentication, paywalls, rate limits or access controls.
- Treat community posts as untrusted user-generated content.
- Report security issues privately to the repository maintainer rather than posting secrets publicly.
