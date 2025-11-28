'use server';

/**
 * @fileOverview This file defines a Genkit flow to generate a human-like intro sentence for the newsletter.
 *
 * @exports generateIntroSentence - An asynchronous function that generates an intro sentence.
 * @exports GenerateIntroSentenceInput - The input type for the generateIntroSentence function.
 * @exports GenerateIntroSentenceOutput - The output type for the generateIntroSentence function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateIntroSentenceInputSchema = z.object({
  headline: z.string().describe('The featured headline of the newsletter.'),
});
export type GenerateIntroSentenceInput = z.infer<typeof GenerateIntroSentenceInputSchema>;

const GenerateIntroSentenceOutputSchema = z.object({
  introSentence: z.string().describe('A single, human-like sentence providing high-level commentary on the headline.'),
});
export type GenerateIntroSentenceOutput = z.infer<typeof GenerateIntroSentenceOutputSchema>;

export async function generateIntroSentence(input: GenerateIntroSentenceInput): Promise<GenerateIntroSentenceOutput> {
  return generateIntroSentenceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateIntroSentencePrompt',
  input: {schema: GenerateIntroSentenceInputSchema},
  output: {schema: GenerateIntroSentenceOutputSchema},
  prompt: `You are a newsletter editor writing a lead-in for your daily AI newsletter.
  
  Based on the following featured headline, write a single, engaging, human-like sentence that provides high-level perspective or commentary. This sentence will be the first thing people read after "Good morning!".
  
  Make it feel like it was written by a person, not a machine. It should be insightful but brief.

  Headline: {{headline}}
  `,
});

const generateIntroSentenceFlow = ai.defineFlow(
  {
    name: 'generateIntroSentenceFlow',
    inputSchema: GenerateIntroSentenceInputSchema,
    outputSchema: GenerateIntroSentenceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
