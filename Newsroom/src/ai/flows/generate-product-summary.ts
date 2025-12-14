
'use server';

/**
 * @fileOverview This file defines a Genkit flow to generate an explanatory summary for a product.
 *
 * @exports generateProductSummary - An asynchronous function that generates a product summary.
 * @exports GenerateProductSummaryInput - The input type for the generateProductSummary function.
 * @exports GenerateProductSummaryOutput - The output type for the generateProductSummary function.
 */

import {z} from 'genkit';
import { generateText } from '@/ai/generate';
import { DEFAULT_PROMPTS } from '@/lib/prompt-defaults';
import { getPromptContent, renderPrompt } from '@/lib/prompts';

const GenerateProductSummaryInputSchema = z.object({
  name: z.string().describe('The name of the product.'),
  description: z.string().describe('The short description or tagline of the product.'),
});
export type GenerateProductSummaryInput = z.infer<typeof GenerateProductSummaryInputSchema>;

const GenerateProductSummaryOutputSchema = z.object({
  summary: z.string().describe('A short, explanatory phrase that completes the sentence which starts with the product name.'),
});
export type GenerateProductSummaryOutput = z.infer<typeof GenerateProductSummaryOutputSchema>;

export async function generateProductSummary(input: GenerateProductSummaryInput): Promise<GenerateProductSummaryOutput> {
  if (!input.description) {
    return { summary: `is an AI-powered tool designed to boost your productivity.` };
  }

  try {
    const defaults = DEFAULT_PROMPTS.generateProductSummary;

    const { template, system, provider } = await getPromptContent('generateProductSummary', defaults);
    const prompt = renderPrompt(template, {
      name: input.name,
      description: input.description,
    });

    const text = await generateText({
      provider,
      prompt,
      system,
      temperature: 0.5,
      maxOutputTokens: 80,
    });

    let summary = text.trim() || '';
    if (!summary) {
      console.error(`generateProductSummary: Empty response for ${input.name}`);
      throw new Error('Empty response from model');
    }

    summary = summary.replace(/^["']|["']$/g, '').trim();

    const lowerSummary = summary.toLowerCase();
    const lowerName = input.name.toLowerCase();
    if (lowerSummary.startsWith(lowerName)) {
      summary = summary.slice(input.name.length).trim();
      summary = summary.replace(/^[:\-–—,.\s]+/, '').trim();
    }

    if (summary.length > 100) {
      const truncated = summary.slice(0, 97);
      const lastSpace = truncated.lastIndexOf(' ');
      summary = lastSpace > 50 ? truncated.slice(0, lastSpace) + '...' : truncated + '...';
    }

    if (summary.length > 0) {
      summary = summary.charAt(0).toLowerCase() + summary.slice(1);
    }

    return { summary };
  } catch (error: any) {
    console.error(`generateProductSummary: Error for ${input.name}:`, error.message);
    throw error;
  }
}

