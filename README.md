Pages are served from `app/`. Workers live in `workers/`.

## Smoke check

Run the smoke script against a deployed environment:

```bash
BASE_URL=https://token-scam-inspector.pages.dev bash scripts/smoke.sh
```

Call Workers directly (recommended on `pages.dev` previews):

```bash
API_BASE=https://token-scam-inspector.<your-workers-subdomain>.workers.dev bash scripts/smoke.sh
```

Example for staging/dev:

```bash
BASE_URL=https://<staging-or-dev>.token-scam-inspector.pages.dev bash scripts/smoke.sh
# or
API_BASE=https://<staging-or-dev>.<your-workers-subdomain>.workers.dev bash scripts/smoke.sh
```

If the smoke check fails, try the following:

- Confirm the Workers deployment is healthy (e.g., check `/api/hello` on the Workers URL).
- Verify required environment variables and API keys are set in the Workers deployment.
- Check upstream explorer/provider rate limits and retry after the limit window.
