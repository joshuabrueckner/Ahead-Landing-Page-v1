# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Environment

- `NEWSROOM_PASSWORD` — required. Used by `middleware.ts` and `/api/authenticate` to gate the entire newsroom app behind a shared passphrase. Configure it in your local `.env` and in Netlify site settings.
- `NEXT_PUBLIC_NEWSROOM_BASE_PATH` — optional. Set to `/newsroom` if the app is always proxied under that path; otherwise the runtime auto-detects.
