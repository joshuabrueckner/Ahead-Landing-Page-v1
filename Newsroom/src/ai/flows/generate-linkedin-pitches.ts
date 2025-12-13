'use server';

import { z } from 'genkit';
import { openaiGenerateJson } from '@/ai/openai';

const ArticleSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  url: z.string(),
  source: z.string(),
  date: z.string(),
  summary: z.string().optional(),
  text: z.string().optional(),
});

const GenerateLinkedInPitchesInputSchema = z.object({
  articles: z.array(ArticleSchema).describe('Array of recent AI news articles'),
});
export type GenerateLinkedInPitchesInput = z.infer<typeof GenerateLinkedInPitchesInputSchema>;

const PitchSchema = z.object({
  id: z.string().describe('Unique identifier for this pitch'),
  title: z.string().describe('Catchy title for the LinkedIn post idea'),
  summary: z.string().describe('Brief 1-2 sentence summary of the narrative angle'),
  bullets: z.array(z.string()).describe('3-5 supporting points that build the narrative'),
  supportingArticles: z.array(z.object({
    id: z.string().optional(),
    title: z.string(),
    source: z.string(),
    date: z.string(),
    url: z.string(),
    text: z.string().optional(),
  })).describe('The articles that support this pitch'),
});

const GenerateLinkedInPitchesOutputSchema = z.object({
  pitches: z.array(PitchSchema).describe('5-10 LinkedIn post pitch ideas'),
});
export type GenerateLinkedInPitchesOutput = z.infer<typeof GenerateLinkedInPitchesOutputSchema>;
export type LinkedInPitch = z.infer<typeof PitchSchema>;

export async function generateLinkedInPitches(input: GenerateLinkedInPitchesInput): Promise<GenerateLinkedInPitchesOutput> {
  const truncateAtWordBoundary = (text: string, maxLen: number) => {
    const t = String(text || '').trim();
    if (t.length <= maxLen) return t;
    const cut = t.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(' ');
    if (lastSpace >= Math.floor(maxLen * 0.6)) return cut.slice(0, lastSpace).trim();
    return cut.trim();
  };

  const toSentenceCase = (text: string) => {
    const t = String(text || '').trim();
    if (!t) return '';
    return t[0].toUpperCase() + t.slice(1);
  };

  const sanitizeTitle = (title: string) => {
    const trimmed = String(title || '').trim();
    const withoutPrefix = trimmed.replace(/^discusses\s*/i, '').trim();
    const rest = toSentenceCase(withoutPrefix || 'ai news');
    return truncateAtWordBoundary(`Discusses ${rest}`, 70);
  };

  const ensureSources = (supporting: any[]) => {
    const unique = new Map<string, any>();
    for (const a of supporting || []) {
      const key = (a?.id as string | undefined) ?? (a?.url as string | undefined);
      if (!key) continue;
      if (!unique.has(key)) unique.set(key, a);
    }

    const result = Array.from(unique.values())
      .map(a => {
        const entry: { id?: string; title: string; source: string; date: string; url: string } = {
          title: String(a?.title || ''),
          source: String(a?.source || ''),
          date: String(a?.date || ''),
          url: String(a?.url || ''),
        };
        if (typeof a?.id === 'string' && a.id.trim()) entry.id = a.id;
        return entry;
      })
      .filter(a => a.title && a.url);

    // Fill up to at least 2 sources from the input article pool.
    const already = new Set(result.map(a => (a.id ?? a.url)));
    for (const a of input.articles) {
      if (result.length >= 2) break;
      const key = a.id ?? a.url;
      if (already.has(key)) continue;
      const entry: { id?: string; title: string; source: string; date: string; url: string } = {
        title: a.title,
        source: a.source,
        date: a.date,
        url: a.url,
      };
      if (typeof a.id === 'string' && a.id.trim()) entry.id = a.id;
      result.push(entry);
      already.add(key);
    }

    return result.slice(0, 5);
  };

  const normalizePitch = (p: any, index: number) => {
    const bullets = Array.isArray(p?.bullets) ? p.bullets.map((b: any) => String(b)).filter(Boolean) : [];
    const normalizedBullets = bullets.slice(0, 2);
    while (normalizedBullets.length < 2) normalizedBullets.push('');

    const supportingArticles = ensureSources(p?.supportingArticles || []);
    const rawSummary = String(p?.summary || '').trim();
    const looksGeneric =
      /^angle\s+connecting\b/i.test(rawSummary) ||
      /^connect(?:s|ing)\b/i.test(rawSummary) ||
      rawSummary.length < 40;

    const derivedSummary = () => {
      const t1 = supportingArticles[0]?.title;
      const t2 = supportingArticles[1]?.title;
      if (t1 && t2) {
        return truncateAtWordBoundary(`Connects ${t1} and ${t2} to explain the bigger trend.`, 180);
      }
      return truncateAtWordBoundary('A practical angle connecting multiple stories into one clear takeaway.', 180);
    };

    return {
      id: String(p?.id || `${index + 1}`),
      title: sanitizeTitle(p?.title),
      summary: truncateAtWordBoundary(looksGeneric ? derivedSummary() : rawSummary, 180),
      bullets: normalizedBullets.map((b: unknown) => String(b).slice(0, 90)),
      supportingArticles,
    };
  };

  const articlesText = input.articles
    .map(a => {
      const id = a.id ? `  ID: ${a.id}` : '';
      const summary = a.summary ? `  Summary: ${a.summary}` : '';
      return `- Title: ${a.title}\n  Source: ${a.source}\n  Date: ${a.date}\n  URL: ${a.url}${id ? `\n${id}` : ''}${summary ? `\n${summary}` : ''}`;
    })
    .join('\n\n');

  const prompt = `You are an expert LinkedIn content strategist helping create thoughtful, insightful posts about AI trends and developments.

Given the following AI news articles, identify exactly 6 compelling narrative angles that connect multiple articles together into cohesive, thought-provoking LinkedIn posts.

Each pitch should:
1. Connect 2-3 articles that share a common theme
2. Offer a unique insight beyond summarizing
3. Be relevant to business professionals and AI practitioners
4. Encourage engagement and discussion
5. Feel authentic and thoughtful, not clickbait

Articles to analyze:\n${articlesText}

Return JSON only with shape:
{
  "pitches": [
    {
      "id": string,
      "title": string,
      "summary": string,
      "bullets": string[],
      "supportingArticles": [{"id"?: string, "title": string, "source": string, "date": string, "url": string, "text"?: string}]
    }
  ]
}

The top-level key "pitches" is REQUIRED. If you cannot produce pitches, return:
{ "pitches": [] }

Minimal valid example:
{ "pitches": [] }

If an input article includes an "ID", you MUST copy it exactly into the corresponding supportingArticles[].id.

Title rules:
- MUST start with "Discusses" (no colon)
- Use sentence case after "Discusses" (first letter uppercase)
- Keep it short and readable (no mid-word cutoffs)

Length limits (keep output short):
- title: max 70 characters
- summary: max 180 characters
- each bullet: max 90 characters

Supporting articles:
- Include ONLY: id (if available), title, source, date, url
- Do NOT include the optional "text" field
- Each pitch MUST include between 2 and 5 supportingArticles

Bullets rules:
- Exactly 2 bullets
`;

  let first: GenerateLinkedInPitchesOutput = { pitches: [] };
  try {
    first = await openaiGenerateJson(GenerateLinkedInPitchesOutputSchema, {
      prompt,
      temperature: 0.6,
      maxOutputTokens: 900,
      timeoutMs: 18000,
    });
  } catch (error: any) {
    console.warn('[generateLinkedInPitches] Model call failed; using local fallback pitches', {
      message: error?.message || String(error),
    });
  }

  const normalizedFirst = {
    pitches: (first.pitches || []).map((p, i) => normalizePitch(p, i)).slice(0, 6),
  };

  if (normalizedFirst.pitches.length >= 6) {
    return { pitches: normalizedFirst.pitches.slice(0, 6) };
  }

  // Avoid a second model call (serverless latency + occasional transport issues).
  // If we didn't get 6, fill deterministically from the input articles.
  const merged: any[] = [...normalizedFirst.pitches];

  // Final fallback: synthesize pitches from articles so the UI always has 6.
  let syntheticIndex = 0;
  while (merged.length < 6 && input.articles.length >= 2) {
    const a1 = input.articles[(syntheticIndex * 2) % input.articles.length];
    const a2 = input.articles[(syntheticIndex * 2 + 1) % input.articles.length];
    const fallbackPitch = {
      id: `fallback-${syntheticIndex + 1}`,
      title: sanitizeTitle(`Discusses ${a1.title}`),
      summary: truncateAtWordBoundary(
        `Connects ${a1.title} and ${a2.title} into one clear takeaway for teams.`,
        180
      ),
      bullets: ['Key takeaway for teams.', 'What to watch next.'],
      supportingArticles: ensureSources([
        { id: a1.id, title: a1.title, source: a1.source, date: a1.date, url: a1.url },
        { id: a2.id, title: a2.title, source: a2.source, date: a2.date, url: a2.url },
      ]),
    };
    if (!merged.some(m => m.title === fallbackPitch.title)) merged.push(fallbackPitch);
    syntheticIndex++;
    if (syntheticIndex > 20) break;
  }

  if (merged.length < 6) {
    console.warn('[generateLinkedInPitches] Returned fewer than 6 pitches after top-up+fallback', {
      got: merged.length,
      articleCount: input.articles.length,
      sampleUrls: input.articles.slice(0, 3).map(a => a.url),
    });
  }

  return { pitches: merged.slice(0, 6) };
}

