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
        prompt: `Write a 100-150 character summary of this AI news article. COUNT YOUR CHARACTERS - this limit is STRICT.

RULES:
- MUST be 100-150 characters (count spaces too)
- Include one company/person/statistic
- Start with the key insight, no preamble
- Plain language, no jargon
- Focus on why it matters to non-technical professionals

EXAMPLES (note the length):
"Researchers found that tricking AI chatbots into ignoring safety rules is possible by phrasing your request as a poem." (123 chars)
"Microsoft and Google's race to dominate AI is starting to slow down, showing the market for new tools is leveling off." (129 chars)
"The FTC is warning parents about new AI-powered toys that lack safety rules and can sometimes have inappropriate conversations." (145 chars)

ARTICLE:
${input.text.slice(0, 6000)}

Write ONLY the summary (100-150 characters):`,
        config: {
          temperature: 0.2,
          maxOutputTokens: 60,
        },
      });
      
      let summary = result.text?.trim() || '';
      
      if (!summary) {
        return { summary: "Could not generate summary for this article." };
      }
      
      // Clean up the response
      summary = summary.replace(/^["']|["']$/g, '').trim();
      summary = summary.replace(/^(Summary:|Here's|Here is|The summary:)\s*/i, '').trim();
      
      // Strictly enforce 150 character max - truncate at word boundary
      if (summary.length > 150) {
        // Find last complete word within 147 chars (leaving room for ...)
        let truncated = summary.slice(0, 147);
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > 100) {
          summary = truncated.slice(0, lastSpace) + '...';
        } else {
          // If no good word boundary, just cut and add ellipsis
          summary = truncated + '...';
        }
      }
      
      return { summary };
    } catch (error: any) {
      console.error('generateArticleSummaryFlow error:', error.message);
      return { summary: "Could not generate summary for this article." };
    }
  }
);
