'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SupportingArticleSchema = z.object({
  title: z.string(),
  source: z.string(),
  date: z.string(),
  url: z.string(),
});

const RegeneratePitchTitleInputSchema = z.object({
  currentTitle: z.string().describe('The current title of the pitch'),
  currentSummary: z.string().describe('The current summary of the pitch'),
  supportingArticles: z.array(SupportingArticleSchema).describe('The articles supporting this pitch'),
});
export type RegeneratePitchTitleInput = z.infer<typeof RegeneratePitchTitleInputSchema>;

const RegeneratePitchTitleOutputSchema = z.object({
  title: z.string().describe('New title for the pitch'),
  summary: z.string().describe('New summary for the pitch'),
});
export type RegeneratePitchTitleOutput = z.infer<typeof RegeneratePitchTitleOutputSchema>;

export async function regeneratePitchTitle(input: RegeneratePitchTitleInput): Promise<RegeneratePitchTitleOutput> {
  return regeneratePitchTitleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'regeneratePitchTitlePrompt',
  input: { schema: RegeneratePitchTitleInputSchema },
  output: { schema: RegeneratePitchTitleOutputSchema },
  prompt: `You are an expert LinkedIn content strategist. Given a pitch idea with supporting articles, generate a NEW and DIFFERENT title and summary.

Current pitch:
Title: {{currentTitle}}
Summary: {{currentSummary}}

Supporting articles:
{{#each supportingArticles}}
- {{this.title}} ({{this.source}}, {{this.date}})
{{/each}}

Generate a NEW title and summary that:
1. The title MUST start with "Discusses" - for example: "Discusses overreliance of AI in writing", "Discusses OpenAI's shifting enterprise strategy"
2. Keep the title SHORT (under 8 words), HUMAN, and SPECIFIC
3. Avoid generic phrases, be specific about the topic
4. The summary should be 1-2 sentences explaining the narrative angle
5. Make sure it's DIFFERENT from the current title and summary while still being relevant to the supporting articles

Generate a fresh perspective on the same articles.`,
});

const regeneratePitchTitleFlow = ai.defineFlow(
  {
    name: 'regeneratePitchTitleFlow',
    inputSchema: RegeneratePitchTitleInputSchema,
    outputSchema: RegeneratePitchTitleOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);
