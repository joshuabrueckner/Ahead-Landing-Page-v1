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

## Firestore-backed prompts (no redeploy)

All AI prompt templates are loaded from a Firestore collection named `Prompts` (server-only via Firebase Admin). This lets you edit prompts in the Firebase Console and see changes live.

### Access model

This project is configured to read `Prompts` using the Firebase client Firestore SDK.

- Firestore rules must allow `read` on `Prompts/{id}`.
- Prompts are therefore publicly readable (by design in this setup).

If a prompt doc is missing/unreadable, the app falls back to the code-default prompt.

### Collection and document shape

- Collection: `Prompts`
- Doc ID: one of the IDs below
- Fields:
	- `template` (string, required)
	- `system` (string, optional)

Templates can use `{{var}}` placeholders.

### Prompt IDs and variables

- `generateLinkedInPitches`
	- `{{articlesText}}`
- `generateLinkedInPost`
	- `{{title}}`, `{{summary}}`, `{{bulletsBlock}}`, `{{supportingArticlesBlock}}`, `{{feedbackBlock}}`
- `findRelevantArticles`
	- `{{userIdea}}`, `{{existingUrlsText}}`, `{{availableText}}`
- `regeneratePitchTitle`
	- `{{currentTitle}}`, `{{currentSummary}}`, `{{articlesText}}`
- `generateNewsletterEmailContent`
	- `{{newsLines}}`, `{{productLines}}`, `{{aiTip}}`
- `generateAITip`
	- `{{topicLine}}`
- `generateArticleSummary`
	- `{{articleText}}`
- `generateProductSummary`
	- `{{name}}`, `{{description}}`
- `generateSubjectLine`
	- `{{headline}}`
- `generateIntroSentence`
	- `{{headline}}`
- `generateArticleOneSentenceSummary`
	- `{{articleText}}`
- `transformAiTip`
	- `{{sourceText}}`

Note: prompt docs are cached in-memory for ~60 seconds per server instance.
