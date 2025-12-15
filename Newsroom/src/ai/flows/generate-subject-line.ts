'use server';

/**
 * @fileOverview This file defines a Genkit flow to generate a short, compelling email subject line from a headline.
 *
 * @exports generateSubjectLine - An asynchronous function that generates a subject line.
 * @exports GenerateSubjectLineInput - The input type for the generateSubjectLine function.
 * @exports GenerateSubjectLineOutput - The output type for the generateSubjectLine function.
 */

import {z} from 'genkit';
import { generateJson } from '@/ai/generate';
import { DEFAULT_PROMPTS } from '@/lib/prompt-defaults';
import { getPromptContent, renderPrompt } from '@/lib/prompts';

const GenerateSubjectLineInputSchema = z.object({
  headline: z.string().describe('The full headline to be summarized into a subject line.'),
});
export type GenerateSubjectLineInput = z.infer<typeof GenerateSubjectLineInputSchema>;

const GenerateSubjectLineOutputSchema = z.object({
  subject: z.string().max(20).describe('The generated subject line, 20 characters or less.'),
});
export type GenerateSubjectLineOutput = z.infer<typeof GenerateSubjectLineOutputSchema>;

export async function generateSubjectLine(input: GenerateSubjectLineInput): Promise<GenerateSubjectLineOutput> {
  const defaults = DEFAULT_PROMPTS.generateSubjectLine;

  const { template, system, provider } = await getPromptContent('generateSubjectLine', defaults);
  const prompt = renderPrompt(template, { headline: input.headline });

  return generateJson(GenerateSubjectLineOutputSchema, {
    provider,
    prompt,
    system,
    temperature: 0.7,
    maxOutputTokens: 40,
    meta: { promptId: 'generateSubjectLine' },
  });
}

