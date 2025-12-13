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
  const sanitizeTitle = (title: string) => {
    const trimmed = String(title || '').trim();
    if (!trimmed) return 'Discusses ai news';
    if (!trimmed.toLowerCase().startsWith('discusses')) {
      return `Discusses ${trimmed.toLowerCase().replace(/^discusses\s*/i, '')}`.slice(0, 50);
    }
    const rest = trimmed.slice('Discusses'.length).trimStart();
    const normalized = `Discusses ${rest.toLowerCase()}`;
    return normalized.slice(0, 50);
  };

  const ensureSources = (supporting: any[]) => {
    const unique = new Map<string, any>();
    for (const a of supporting || []) {
      const key = (a?.id as string | undefined) ?? (a?.url as string | undefined);
      if (!key) continue;
      if (!unique.has(key)) unique.set(key, a);
    }

    const result = Array.from(unique.values())
      .map(a => ({
        id: a?.id,
        title: String(a?.title || ''),
        source: String(a?.source || ''),
        date: String(a?.date || ''),
        url: String(a?.url || ''),
      }))
      .filter(a => a.title && a.url);

    // Fill up to at least 2 sources from the input article pool.
    const already = new Set(result.map(a => (a.id ?? a.url)));
    for (const a of input.articles) {
      if (result.length >= 2) break;
      const key = a.id ?? a.url;
      if (already.has(key)) continue;
      result.push({
        id: a.id,
        title: a.title,
        source: a.source,
        date: a.date,
        url: a.url,
      });
      already.add(key);
    }

    return result.slice(0, 5);
  };

  const normalizePitch = (p: any, index: number) => {
    const bullets = Array.isArray(p?.bullets) ? p.bullets.map((b: any) => String(b)).filter(Boolean) : [];
    const normalizedBullets = bullets.slice(0, 2);
    while (normalizedBullets.length < 2) normalizedBullets.push('');

    return {
      id: String(p?.id || `${index + 1}`),
      title: sanitizeTitle(p?.title),
      summary: String(p?.summary || '').slice(0, 180),
      bullets: normalizedBullets.map((b: unknown) => String(b).slice(0, 90)),
      supportingArticles: ensureSources(p?.supportingArticles || []),
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
- Use lowercase after "Discusses"
- Under 8 words

Length limits (keep output short):
- title: max 50 characters
- summary: max 180 characters
- each bullet: max 90 characters

Supporting articles:
- Include ONLY: id (if available), title, source, date, url
- Do NOT include the optional "text" field
- Each pitch MUST include between 2 and 5 supportingArticles

Bullets rules:
- Exactly 2 bullets
`;

  const first = await openaiGenerateJson(GenerateLinkedInPitchesOutputSchema, {
    prompt,
    temperature: 0.6,
    maxOutputTokens: 700,
    timeoutMs: 18000,
  });

  const normalizedFirst = {
    pitches: (first.pitches || []).map((p, i) => normalizePitch(p, i)).slice(0, 6),
  };

  if (normalizedFirst.pitches.length >= 6) {
    return { pitches: normalizedFirst.pitches.slice(0, 6) };
  }

  // If the model returned an empty array (often from over-conservative JSON-mode outputs),
  // retry once with a stronger instruction to produce pitches.

  const remaining = 6 - normalizedFirst.pitches.length;
  const existingTitles = normalizedFirst.pitches.map(p => p.title).join('\n');
  const topUpPrompt = `${prompt}

Already have these pitch titles (do NOT repeat them):
${existingTitles}

Generate exactly ${remaining} additional pitches. Use new ids.`;

  const second = await openaiGenerateJson(GenerateLinkedInPitchesOutputSchema, {
    prompt: topUpPrompt,
    temperature: 0.7,
    maxOutputTokens: 700,
    timeoutMs: 18000,
  });

  const merged: any[] = [...normalizedFirst.pitches];
  for (const p of (second.pitches || [])) {
    if (merged.length >= 6) break;
    const normalized = normalizePitch(p, merged.length);
    if (merged.some(m => m.title === normalized.title)) continue;
    merged.push(normalized);
  }

  // Final fallback: synthesize minimal pitches from articles so the UI always has 6.
  let syntheticIndex = 0;
  while (merged.length < 6 && input.articles.length >= 2) {
    const a1 = input.articles[(syntheticIndex * 2) % input.articles.length];
    const a2 = input.articles[(syntheticIndex * 2 + 1) % input.articles.length];
    const fallbackPitch = {
      id: `fallback-${syntheticIndex + 1}`,
      title: sanitizeTitle(`Discusses ${a1.title}`),
      summary: `Angle connecting ${a1.source} and ${a2.source}.`.slice(0, 180),
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

