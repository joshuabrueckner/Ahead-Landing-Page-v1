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
        prompt: `You are an expert AI news curator for Ahead, a platform that helps mid-career knowledge workers master AI. Your goal is to make complex AI news simple, relevant, and actionable for non-technical professionals who feel pressured and lost with AI.

Given the article text below, write ONE single, clear, and concise sentence that explains the article's main takeaway for the everyday knowledge worker.

**The summary MUST:**
1.  **Length Constraint:** Be strictly between 100 and 150 characters (including spaces). This is a critical requirement for a quick, punchy read.
2.  **Include a Data Hook:** The sentence must incorporate a key company name, person, or a specific figure/statistic from the article to grab attention and lead with impact.
3.  **Be Direct and Human:** Conversational, engaging, and sound like a person wrote it—start directly with the insight, avoiding phrases like "This article explains," "The news covers," or "This research shows."
4.  **Jargon-Free:** Written in plain language. If a technical term is absolutely necessary, explain it simply.
5.  **Focus on the 'So What':** Center the summary on the impact or immediate relevance to the user's work, future, or understanding of the AI landscape (Action-Oriented/Impact Focused).

**Target Audience Context:** The reader is a non-technical professional (e.g., Marketing Manager, Ops Lead) who is trying to understand how to adopt AI to stay competitive and efficient.

**Good Examples:**
* Researchers found that tricking AI chatbots into ignoring safety rules is possible by phrasing your request as a poem. (123 characters)
* Microsoft and Google's race to dominate AI is starting to slow down, showing the market for new tools is leveling off. (129 characters)
* The FTC is warning parents about new AI-powered toys that lack safety rules and can sometimes have inappropriate conversations. (145 characters)

**Article:**
${input.text.slice(0, 8000)}

Respond with ONLY the summary sentence, nothing else.`,
        config: {
          temperature: 0.3,
          maxOutputTokens: 100,
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
