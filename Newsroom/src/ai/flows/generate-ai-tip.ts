'use server';

/**
 * @fileOverview This file defines a Genkit flow to generate a practical AI tip or best practice for the daily newsletter.
 *
 * @exports generateAITip - An asynchronous function that generates an AI tip.
 * @exports GenerateAITipInput - The input type for the generateAITip function.
 * @exports GenerateAITipOutput - The output type for the generateAITip function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAITipInputSchema = z.object({
  topic: z.string().optional().describe('Optional topic to guide the AI tip generation.'),
});
export type GenerateAITipInput = z.infer<typeof GenerateAITipInputSchema>;

const GenerateAITipOutputSchema = z.object({
  tip: z.string().describe('A practical AI tip or best practice.'),
});
export type GenerateAITipOutput = z.infer<typeof GenerateAITipOutputSchema>;

export async function generateAITip(input: GenerateAITipInput): Promise<GenerateAITipOutput> {
  return generateAITipFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAITipPrompt',
  input: {schema: GenerateAITipInputSchema},
  output: {schema: GenerateAITipOutputSchema},
  prompt: `You are an AI assistant designed to provide helpful and practical tips related to artificial intelligence.

  Generate a single, actionable AI tip or best practice that can be easily understood and implemented by readers of a daily newsletter.

  {{#if topic}}
  The tip should be related to the following topic: {{topic}}
  {{/if}}
  `,
});

const generateAITipFlow = ai.defineFlow(
  {
    name: 'generateAITipFlow',
    inputSchema: GenerateAITipInputSchema,
    outputSchema: GenerateAITipOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
