'use server';

/**
 * @fileOverview This file defines a Genkit flow to generate a short, compelling email subject line from a headline.
 *
 * @exports generateSubjectLine - An asynchronous function that generates a subject line.
 * @exports GenerateSubjectLineInput - The input type for the generateSubjectLine function.
 * @exports GenerateSubjectLineOutput - The output type for the generateSubjectLine function.
 */

import {z} from 'genkit';
import { openaiGenerateJson } from '@/ai/openai';

const GenerateSubjectLineInputSchema = z.object({
  headline: z.string().describe('The full headline to be summarized into a subject line.'),
});
export type GenerateSubjectLineInput = z.infer<typeof GenerateSubjectLineInputSchema>;

const GenerateSubjectLineOutputSchema = z.object({
  subject: z.string().max(20).describe('The generated subject line, 20 characters or less.'),
});
export type GenerateSubjectLineOutput = z.infer<typeof GenerateSubjectLineOutputSchema>;

export async function generateSubjectLine(input: GenerateSubjectLineInput): Promise<GenerateSubjectLineOutput> {
  const prompt = `You are an expert copywriter specializing in writing compelling, short email subject lines.

Based on the following headline, generate a subject line that is no more than 20 characters long.

Headline: ${input.headline}`;

  return openaiGenerateJson(GenerateSubjectLineOutputSchema, {
    prompt,
    temperature: 0.7,
    maxOutputTokens: 40,
  });
}

