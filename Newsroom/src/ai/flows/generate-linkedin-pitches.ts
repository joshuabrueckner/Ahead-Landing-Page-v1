'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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
  return generateLinkedInPitchesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateLinkedInPitchesPrompt',
  input: { schema: GenerateLinkedInPitchesInputSchema },
  output: { schema: GenerateLinkedInPitchesOutputSchema },
  prompt: `You are an expert LinkedIn content strategist helping create thoughtful, insightful posts about AI trends and developments.

Given the following recent AI news articles, identify 8-10 compelling narrative angles that connect multiple articles together into cohesive, thought-provoking LinkedIn posts.

Each pitch should:
1. Connect 2-4 articles that share a common theme or tell a bigger story together
2. Offer a unique, insightful observation that goes beyond just summarizing the news
3. Be relevant to business professionals and AI practitioners
4. Encourage engagement and discussion
5. Feel authentic and thoughtful, not clickbait

Articles to analyze:
{{#each articles}}
- Title: {{this.title}}
  Source: {{this.source}}
  Date: {{this.date}}
  URL: {{this.url}}
  {{#if this.summary}}Summary: {{this.summary}}{{/if}}
  {{#if this.text}}Full Article Text: {{this.text}}{{/if}}

{{/each}}

Generate 8-10 pitch ideas. For each pitch:
- Create a SHORT, HUMAN, SPECIFIC title that MUST start with "Discusses" followed by the topic (NOT "Discusses:" with a colon)
- Examples: "Discusses overreliance of AI in writing", "Discusses OpenAI's shifting enterprise strategy", "Discusses the gap between AI demos and production"
- Use lowercase after "Discusses" (not Title Case) - e.g. "Discusses why enterprises struggle with AI adoption" NOT "Discusses Why Enterprises Struggle With AI Adoption"
- Keep titles under 8 words, be specific about the topic, avoid generic phrases
- Write a brief 1-2 sentence summary of the narrative angle
- List 3-5 bullet points that would structure the post
- Include the specific articles that support this pitch

Make each pitch distinct and approach the articles from different angles - consider themes like industry impact, technical breakthroughs, competitive dynamics, societal implications, investment trends, and strategic business considerations.`,
});

const generateLinkedInPitchesFlow = ai.defineFlow(
  {
    name: 'generateLinkedInPitchesFlow',
    inputSchema: GenerateLinkedInPitchesInputSchema,
    outputSchema: GenerateLinkedInPitchesOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);
