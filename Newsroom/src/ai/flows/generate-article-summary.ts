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
      // Use ai.generate directly with plain text output for speed and reliability
      const result = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        prompt: `Summarize this AI news article in ONE sentence (max 150 characters) for busy professionals.

The sentence must:
- State the key fact or announcement
- Mention important names (companies, products, people)
- Be clear and jargon-free

Article:
${input.text.slice(0, 8000)}

Respond with ONLY the summary sentence, nothing else.`,
        config: {
          temperature: 0.3,
          maxOutputTokens: 80,
        },
      });
      
      let summary = result.text?.trim() || '';
      
      if (!summary) {
        return { summary: "Could not generate summary for this article." };
      }
      
      // Clean up the response
      summary = summary.replace(/^["']|["']$/g, '').trim();
      summary = summary.replace(/^(Summary:|Here's|Here is|The summary:)\s*/i, '').trim();
      
      // Ensure it doesn't exceed 150 characters
      if (summary.length > 150) {
        const truncated = summary.slice(0, 147);
        const lastSpace = truncated.lastIndexOf(' ');
        summary = lastSpace > 80 ? truncated.slice(0, lastSpace) + '...' : truncated + '...';
      }
      
      return { summary };
    } catch (error: any) {
      console.error('generateArticleSummaryFlow error:', error.message);
      return { summary: "Could not generate summary for this article." };
    }
  }
);
