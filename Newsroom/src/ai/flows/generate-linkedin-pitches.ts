'use server';

import { z } from 'genkit';
import { openaiGenerateJson } from '@/ai/openai';

const ArticleSchema = z.object({
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
  const articlesText = input.articles
    .map(a => {
      const summary = a.summary ? `  Summary: ${a.summary}` : '';
      const text = a.text ? `  Full Article Text: ${a.text.slice(0, 3000)}` : '';
      return `- Title: ${a.title}\n  Source: ${a.source}\n  Date: ${a.date}\n  URL: ${a.url}${summary ? `\n${summary}` : ''}${text ? `\n${text}` : ''}`;
    })
    .join('\n\n');

  const prompt = `You are an expert LinkedIn content strategist helping create thoughtful, insightful posts about AI trends and developments.

Given the following AI news articles, identify 8-10 compelling narrative angles that connect multiple articles together into cohesive, thought-provoking LinkedIn posts.

Each pitch should:
1. Connect 2-4 articles that share a common theme
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
      "supportingArticles": [{"title": string, "source": string, "date": string, "url": string, "text"?: string}]
    }
  ]
}

Title rules:
- MUST start with "Discusses" (no colon)
- Use lowercase after "Discusses"
- Under 8 words
`;

  return openaiGenerateJson(GenerateLinkedInPitchesOutputSchema, {
    prompt,
    temperature: 0.7,
    maxOutputTokens: 1800,
  });
}

