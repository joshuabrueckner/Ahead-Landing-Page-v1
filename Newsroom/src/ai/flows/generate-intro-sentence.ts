'use server';

/**
 * @fileOverview This file defines a Genkit flow to generate a human-like intro sentence for the newsletter.
 *
 * @exports generateIntroSentence - An asynchronous function that generates an intro sentence.
 * @exports GenerateIntroSentenceInput - The input type for the generateIntroSentence function.
 * @exports GenerateIntroSentenceOutput - The output type for the generateIntroSentence function.
 */

import {z} from 'genkit';
import { generateJson } from '@/ai/generate';
import { DEFAULT_PROMPTS } from '@/lib/prompt-defaults';
import { getPromptContent, renderPrompt } from '@/lib/prompts';

const GenerateIntroSentenceInputSchema = z.object({
  headline: z.string().describe('The featured headline of the newsletter.'),
});
export type GenerateIntroSentenceInput = z.infer<typeof GenerateIntroSentenceInputSchema>;

const GenerateIntroSentenceOutputSchema = z.object({
  introSentence: z.string().describe('A single, human-like sentence providing high-level commentary on the headline.'),
});
export type GenerateIntroSentenceOutput = z.infer<typeof GenerateIntroSentenceOutputSchema>;

export async function generateIntroSentence(input: GenerateIntroSentenceInput): Promise<GenerateIntroSentenceOutput> {
  const defaults = DEFAULT_PROMPTS.generateIntroSentence;

  const { template, system, provider } = await getPromptContent('generateIntroSentence', defaults);
  const prompt = renderPrompt(template, { headline: input.headline });

  return generateJson(GenerateIntroSentenceOutputSchema, {
    provider,
    prompt,
    system,
    temperature: 0.8,
    maxOutputTokens: 80,
    meta: { promptId: 'generateIntroSentence' },
  });
}

