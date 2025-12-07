'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SupportingArticleSchema = z.object({
  title: z.string(),
  source: z.string(),
  date: z.string(),
  url: z.string(),
});

const GenerateLinkedInPostInputSchema = z.object({
  title: z.string().describe('The pitch title'),
  summary: z.string().describe('The pitch summary'),
  bullets: z.array(z.string()).describe('Supporting bullet points'),
  supportingArticles: z.array(SupportingArticleSchema).describe('Articles supporting the pitch'),
  feedback: z.string().optional().describe('Optional feedback to refine the post'),
});
export type GenerateLinkedInPostInput = z.infer<typeof GenerateLinkedInPostInputSchema>;

const GenerateLinkedInPostOutputSchema = z.object({
  post: z.string().describe('The full LinkedIn post content'),
});
export type GenerateLinkedInPostOutput = z.infer<typeof GenerateLinkedInPostOutputSchema>;

export async function generateLinkedInPost(input: GenerateLinkedInPostInput): Promise<GenerateLinkedInPostOutput> {
  return generateLinkedInPostFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateLinkedInPostPrompt',
  input: { schema: GenerateLinkedInPostInputSchema },
  output: { schema: GenerateLinkedInPostOutputSchema },
  prompt: `You are an expert LinkedIn content writer creating thoughtful, engaging posts about AI trends.

Write a LinkedIn post based on the following pitch:

Title: {{title}}
Summary: {{summary}}

Key points to cover:
{{#each bullets}}
- {{this}}
{{/each}}

Supporting articles:
{{#each supportingArticles}}
- "{{this.title}}" ({{this.source}}, {{this.date}})
{{/each}}

{{#if feedback}}
Additional feedback to incorporate: {{feedback}}
{{/if}}

Guidelines for the post:
1. Start with a hook that captures attention (could be a bold statement, question, or insight)
2. Build a coherent narrative that connects the supporting articles
3. Share your unique perspective or observation - what does this mean for the industry?
4. Keep it authentic and conversational, not corporate-speak
5. End with a thought-provoking question or call to discussion
6. Use line breaks for readability (LinkedIn posts perform better with spacing)
7. Keep it under 1500 characters for optimal engagement
8. Don't use hashtags excessively - 2-3 relevant ones at the end max
9. Don't include the article URLs in the post body - they can be added in comments

Write the post now:`,
});

const generateLinkedInPostFlow = ai.defineFlow(
  {
    name: 'generateLinkedInPostFlow',
    inputSchema: GenerateLinkedInPostInputSchema,
    outputSchema: GenerateLinkedInPostOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);
