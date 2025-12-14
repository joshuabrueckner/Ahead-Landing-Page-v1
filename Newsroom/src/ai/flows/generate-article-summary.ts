'use server';

/**
 * @fileOverview This file defines a Genkit flow to generate a concise summary for a news article using Gemini.
 *
 * @exports generateArticleSummary - An asynchronous function that generates a news article summary.
 * @exports GenerateArticleSummaryInput - The input type for the generateArticleSummary function.
 * @exports GenerateArticleSummaryOutput - The output type for the generateArticlesummary function.
 */

import {z} from 'genkit';
import { openaiGenerateText } from '@/ai/openai';
import { DEFAULT_PROMPTS } from '@/lib/prompt-defaults';
import { getPromptContent, renderPrompt } from '@/lib/prompts';

const GenerateArticleSummaryInputSchema = z.object({
  text: z.string().describe('The full text of the news article to be summarized.'),
});
export type GenerateArticleSummaryInput = z.infer<typeof GenerateArticleSummaryInputSchema>;

const GenerateArticleSummaryOutputSchema = z.object({
  summary: z.string().describe("A single, high-impact sentence that explains what the article is about and why it's relevant to a professional audience new to AI."),
});
export type GenerateArticleSummaryOutput = z.infer<typeof GenerateArticleSummaryOutputSchema>;

export async function generateArticleSummary(input: GenerateArticleSummaryInput): Promise<GenerateArticleSummaryOutput> {
  if (!input.text || input.text.trim().length < 50) {
    return { summary: "Could not generate summary: Article content was too short or unavailable." };
  }

  const articleText = input.text.slice(0, 5000);

  try {
    const defaults = DEFAULT_PROMPTS.generateArticleSummary;

    const { template, system } = await getPromptContent('generateArticleSummary', defaults);
    const prompt = renderPrompt(template, { articleText });

    const text = await openaiGenerateText({
      prompt,
      system,
      temperature: 0.3,
      maxOutputTokens: 60,
    });

    let summary = text.trim() || '';
    if (!summary) {
      return { summary: "Could not generate summary for this article." };
    }

    summary = summary.replace(/^["']|["']$/g, '').trim();
    summary = summary.replace(/^(Summary:|Here's|Here is|The summary:)\s*/i, '').trim();

    if (summary.length > 150) {
      const truncated = summary.slice(0, 147);
      const lastSpace = truncated.lastIndexOf(' ');
      summary = lastSpace > 80 ? truncated.slice(0, lastSpace) + '...' : truncated + '...';
    }

    return { summary };
  } catch (error: any) {
    console.error('generateArticleSummary error:', error.message);
    return { summary: "Could not generate summary for this article." };
  }
}

