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

  const compactWhitespace = (text: string) => String(text || '').replace(/\s+/g, ' ').trim();

  const excerptFromText = (text?: string) => {
    const t = compactWhitespace(text || '');
    if (!t) return '';
    return truncateAtWordBoundary(t, 520);
  };

  const pickGist = (article: { title: string; summary?: string; text?: string }) => {
    const summary = compactWhitespace(article.summary || '');
    if (summary) return truncateAtWordBoundary(summary, 140);
    const ex = excerptFromText(article.text);
    if (ex) return truncateAtWordBoundary(ex, 140);
    return truncateAtWordBoundary(compactWhitespace(article.title), 140);
  };

  const deriveFromSources = (sources: Array<{ title: string; summary?: string; text?: string; source?: string }>) => {
    const a1 = sources[0];
    const a2 = sources[1];
    const blob = compactWhitespace(
      sources
        .map(a => `${a.title} ${a.summary || ''} ${excerptFromText(a.text)} ${a.source || ''}`)
        .join(' ')
    ).toLowerCase();

    // Hand-tuned patterns for common clusters we’ve seen.
    if (/(trump).*\bexecutive order\b/.test(blob) && /\bstate\b.*\blaw\b/.test(blob)) {
      return {
        title: 'Discusses Trump’s AI order vs state laws',
        summary: 'A federal AI order collides with state rules, raising compliance questions for builders.',
      };
    }
    if (/\bsoftbank\b/.test(blob) && /(data center|datacenter)/.test(blob)) {
      return {
        title: 'Discusses SoftBank’s data-center bet for AI',
        summary: 'Compute demand is driving huge infrastructure bets—and reshaping who controls AI capacity.',
      };
    }
    if (/\bopenai\b/.test(blob) && /\bgoogle\b/.test(blob) && /(gap|closes|moat|lead|catch up)/.test(blob)) {
      return {
        title: 'Discusses OpenAI’s response to Google’s AI push',
        summary: 'As the platform race tightens, labs are repositioning on product, safety, and distribution.',
      };
    }
    if (/\bdisney\b/.test(blob) && /\bopenai\b/.test(blob)) {
      return {
        title: 'Discusses Disney–OpenAI partnerships and IP',
        summary: 'Brand partnerships are coming to generative AI—along with new IP, licensing, and trust risks.',
      };
    }
    if (/\btime\b/.test(blob) && /(person of the year|award)/.test(blob)) {
      return {
        title: 'Discusses AI’s cultural hype vs real progress',
        summary: 'AI is getting cultural validation, but teams still need measurable gains and safer rollouts.',
      };
    }
    if (/(\$\s?\d+\s?billion|over\s?\$\s?\d+\s?billion)/.test(blob) || /\bunder 24 hours\b/.test(blob)) {
      return {
        title: 'Discusses the new AI investment sprint',
        summary: 'A surge of capital is chasing compute and models—speeding rollouts while raising execution risk.',
      };
    }

    // Generic but still grounded fallback: use gists from two sources.
    const gist1 = a1 ? pickGist({ title: a1.title, summary: a1.summary, text: a1.text }) : '';
    const gist2 = a2 ? pickGist({ title: a2.title, summary: a2.summary, text: a2.text }) : '';
    const titleSeed = a1?.title || a2?.title || 'AI developments';
    const title = `Discusses ${toSentenceCase(titleSeed.replace(/[:\-—].*$/, '').trim())}`;
    const summary = gist2
      ? truncateAtWordBoundary(`${gist1} ${gist2}`, 140)
      : truncateAtWordBoundary(gist1 || 'A specific, text-driven angle that ties multiple stories together.', 140);
    return { title, summary };
  };

  const sanitizeTitle = (title: string) => {
    const trimmed = String(title || '').trim();
    const withoutPrefix = trimmed.replace(/^discusses\s*/i, '').trim();
    const rest = withoutPrefix || 'AI news';
    // Do NOT force lowercase/title-case; just ensure readability and avoid mid-word cutoff.
    return truncateAtWordBoundary(`Discusses ${toSentenceCase(rest)}`, 58);
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
    const looksGenericSummary =
      /^angle\s+connecting\b/i.test(rawSummary) ||
      /^connect(?:s|ing)\b/i.test(rawSummary) ||
      /\b(connects?|linking|ties together)\b/i.test(rawSummary) ||
      /\bwhy\b.*\bmatters\b/i.test(rawSummary) ||
      rawSummary.length < 60;

    const looksGenericTitle =
      /^discusses\s+(ai\s+regulation|model\s+competition|ai\s+infrastructure|where\s+ai)/i.test(
        String(p?.title || '').trim()
      );

    const derived = deriveFromSources(supportingArticles);

    return {
      id: String(p?.id || `${index + 1}`),
      title: truncateAtWordBoundary(sanitizeTitle(looksGenericTitle ? derived.title : p?.title), 58),
      summary: truncateAtWordBoundary(looksGenericSummary ? derived.summary : rawSummary, 140),
      bullets: normalizedBullets.map((b: unknown) => String(b).slice(0, 90)),
      supportingArticles,
    };
  };

  const articlesText = input.articles
    .map(a => {
      const id = a.id ? `  ID: ${a.id}` : '';
      const summary = a.summary ? `  Summary: ${a.summary}` : '';
      const excerpt = a.text ? `  Excerpt: ${excerptFromText(a.text)}` : '';
      return `- Title: ${a.title}\n  Source: ${a.source}\n  Date: ${a.date}\n  URL: ${a.url}${id ? `\n${id}` : ''}${summary ? `\n${summary}` : ''}${excerpt ? `\n${excerpt}` : ''}`;
    })
    .join('\n\n');

  const prompt = `You are an expert LinkedIn content strategist helping create thoughtful, insightful posts about AI trends and developments.

Given the following AI news articles, identify exactly 6 compelling narrative angles that connect multiple articles together into cohesive, thought-provoking LinkedIn posts.

You MUST base your ideas on the article EXCERPTS (and summaries) provided — do not hallucinate facts.

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
- Sentence case (do NOT put every word in Title Case; keep proper nouns as written)
- Be specific about the actual idea (avoid generic themes like "AI regulation and policy")

Length limits (keep output short):
- title: max 58 characters
- summary: max 140 characters
- each bullet: max 90 characters

Summary rules:
- Must be a newly written summary of the idea grounded in the excerpts
- Do NOT start with "Connects", "Angle connecting", or "Why X matters"

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
    const theme = classifyTheme([
      { title: a1.title, summary: a1.summary, source: a1.source },
      { title: a2.title, summary: a2.summary, source: a2.source },
    ]);
    const fallbackPitch = {
      id: `fallback-${syntheticIndex + 1}`,
      title: sanitizeTitle(`Discusses ${theme}`),
      summary: truncateAtWordBoundary(
        `Why ${theme} matters: ${a1.title}`,
        120
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

