# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Environment

- `NEWSROOM_PASSWORD` — required. Used by `middleware.ts` and `/api/authenticate` to gate the entire newsroom app behind a shared passphrase. Configure it in your local `.env` and in Netlify site settings.
- `OPENAI_API_KEY` — required for AI generation.
- `OPENAI_MODEL` — optional. Defaults to `gpt-4o-mini`. Set this to the model you want to use.
- `NEXT_PUBLIC_NEWSROOM_BASE_PATH` — optional. Set to `/newsroom` if the app is always proxied under that path; otherwise the runtime auto-detects.
- `NEWSROOM_PROXY_HOSTS` — optional. Comma-separated hostnames (e.g. `www.jumpahead.ai,jumpahead.ai`) that should always use the proxy base path.
- `NEWSROOM_PROXY_BASE_PATH` — optional. Defaults to `/newsroom`; only used when `NEWSROOM_PROXY_HOSTS` has a match.
