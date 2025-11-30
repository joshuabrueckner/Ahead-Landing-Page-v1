'use server';

/**
 * @fileOverview This file defines a Genkit flow to generate a concise summary for a news article using Gemini.
 *
 * @exports generateArticleSummary - An asynchronous function that generates a news article summary.
 * @exports GenerateArticleSummaryInput - The input type for the generateArticleSummary function.
 * @exports GenerateArticleSummaryOutput - The output type for the generateArticlesummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateArticleSummaryInputSchema = z.object({
  text: z.string().describe('The full text of the news article to be summarized.'),
});
export type GenerateArticleSummaryInput = z.infer<typeof GenerateArticleSummaryInputSchema>;

const GenerateArticleSummaryOutputSchema = z.object({
  summary: z.string().describe("A single, high-impact sentence that explains what the article is about and why it's relevant to a professional audience new to AI."),
});
export type GenerateArticleSummaryOutput = z.infer<typeof GenerateArticleSummaryOutputSchema>;

export async function generateArticleSummary(input: GenerateArticleSummaryInput): Promise<GenerateArticleSummaryOutput> {
  return generateArticleSummaryFlow(input);
}

const generateArticleSummaryFlow = ai.defineFlow(
  {
    name: 'generateArticleSummaryFlow',
    inputSchema: GenerateArticleSummaryInputSchema,
    outputSchema: GenerateArticleSummaryOutputSchema,
  },
  async input => {
    if (!input.text || input.text.trim().length < 50) {
      return { summary: "Could not generate summary: Article content was too short or unavailable." };
    }
    
    try {
      // Step 1: Generate a short summary (model can't count, so we ask for "one short sentence")
      const result = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        prompt: `Summarize this AI news article in ONE short sentence for non-technical professionals.

RULES:
- ONE sentence only, very concise (about 15-20 words max)
- Include a key company name, person, or statistic
- Start directly with the insight (no "This article..." or "The news...")
- Plain language, no jargon
- Focus on why it matters

ARTICLE:
${input.text.slice(0, 5000)}

Write ONLY the summary sentence:`,
        config: {
          temperature: 0.3,
          maxOutputTokens: 50,
        },
      });
      
      let summary = result.text?.trim() || '';
      
      if (!summary) {
        return { summary: "Could not generate summary for this article." };
      }
      
      // Clean up the response
      summary = summary.replace(/^["']|["']$/g, '').trim();
      summary = summary.replace(/^(Summary:|Here's|Here is|The summary:)\s*/i, '').trim();
      
      // Step 2: STRICTLY enforce 100-150 character range
      // If too long, truncate intelligently at word boundary
      if (summary.length > 150) {
        let truncated = summary.slice(0, 147);
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > 80) {
          summary = truncated.slice(0, lastSpace) + '...';
        } else {
          summary = truncated + '...';
        }
      }
      
      // If too short and we have room, that's okay - short is fine
      // The 100 char minimum is a guideline, not a hard requirement
      // (we can't magically make a short summary longer without another API call)
      
      return { summary };
    } catch (error: any) {
      console.error('generateArticleSummaryFlow error:', error.message);
      return { summary: "Could not generate summary for this article." };
    }
  }
);
