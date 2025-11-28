'use server';

/**
 * @fileOverview This file defines a Genkit flow to generate a short, compelling email subject line from a headline.
 *
 * @exports generateSubjectLine - An asynchronous function that generates a subject line.
 * @exports GenerateSubjectLineInput - The input type for the generateSubjectLine function.
 * @exports GenerateSubjectLineOutput - The output type for the generateSubjectLine function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSubjectLineInputSchema = z.object({
  headline: z.string().describe('The full headline to be summarized into a subject line.'),
});
export type GenerateSubjectLineInput = z.infer<typeof GenerateSubjectLineInputSchema>;

const GenerateSubjectLineOutputSchema = z.object({
  subject: z.string().max(20).describe('The generated subject line, 20 characters or less.'),
});
export type GenerateSubjectLineOutput = z.infer<typeof GenerateSubjectLineOutputSchema>;

export async function generateSubjectLine(input: GenerateSubjectLineInput): Promise<GenerateSubjectLineOutput> {
  return generateSubjectLineFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSubjectLinePrompt',
  input: {schema: GenerateSubjectLineInputSchema},
  output: {schema: GenerateSubjectLineOutputSchema},
  prompt: `You are an expert copywriter specializing in writing compelling, short email subject lines.
  
  Based on the following headline, generate a subject line that is no more than 20 characters long.

  Headline: {{headline}}
  `,
});

const generateSubjectLineFlow = ai.defineFlow(
  {
    name: 'generateSubjectLineFlow',
    inputSchema: GenerateSubjectLineInputSchema,
    outputSchema: GenerateSubjectLineOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
