'use server';

import { z } from 'genkit';
import { generateJson } from '@/ai/generate';
import { DEFAULT_PROMPTS } from '@/lib/prompt-defaults';
import { getPromptContent, renderPrompt } from '@/lib/prompts';

const ArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  source: z.string(),
  date: z.string(),
  summary: z.string().optional(),
});

const FindRelevantArticlesInputSchema = z.object({
  userIdea: z.string().describe('The user\'s idea for a LinkedIn post'),
  existingArticleUrls: z.array(z.string()).optional().describe('URLs of articles the user already has'),
  availableArticles: z.array(ArticleSchema).describe('All available articles to search from'),
});
export type FindRelevantArticlesInput = z.infer<typeof FindRelevantArticlesInputSchema>;

const FindRelevantArticlesOutputSchema = z.object({
  matchedArticleIds: z.array(z.string()).describe('IDs of articles that are relevant to the idea'),
  title: z.string().describe('A title for this pitch idea'),
  summary: z.string().describe('A brief summary of how the articles connect to the idea'),
  reasoning: z.string().describe('Brief explanation of why these articles were selected'),
});
export type FindRelevantArticlesOutput = z.infer<typeof FindRelevantArticlesOutputSchema>;

export async function findRelevantArticles(input: FindRelevantArticlesInput): Promise<FindRelevantArticlesOutput> {
  const existing = new Set((input.existingArticleUrls || []).filter(Boolean));
  const candidates = input.availableArticles.filter(a => !existing.has(a.url));

  const tokens = input.userIdea
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(t => t.length >= 4);

  const tokenSet = new Set(tokens);
  const scored = candidates
    .map(a => {
      const haystack = `${a.title} ${a.summary ?? ''}`.toLowerCase();
      let score = 0;
      for (const t of tokenSet) {
        if (haystack.includes(t)) score += 2;
      }
      // Slight preference for recency if date is present
      if (a.date) score += 0.1;
      return { a, score };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, 180)
    .map(x => x.a);

  const availableText = scored
    .map(a => {
      const summary = a.summary ? `  Summary: ${a.summary}` : '';
      return `- ID: ${a.id}\n  Title: ${a.title}\n  Source: ${a.source}\n  Date: ${a.date}\n  URL: ${a.url}${summary ? `\n${summary}` : ''}`;
    })
    .join('\n\n');

  const existingUrlsText = input.existingArticleUrls?.length
    ? `User already has these URLs:\n${input.existingArticleUrls.map(u => `- ${u}`).join('\n')}\n\n`
    : '';

  const defaults = DEFAULT_PROMPTS.findRelevantArticles;

  const { template, system, provider } = await getPromptContent('findRelevantArticles', defaults);
  const prompt = renderPrompt(template, {
    userIdea: input.userIdea,
    existingUrlsText,
    availableText,
  });

  return generateJson(FindRelevantArticlesOutputSchema, {
    provider,
    prompt,
    system,
    temperature: 0.4,
    maxOutputTokens: 500,
    meta: { promptId: 'findRelevantArticles' },
  });
}

