'use server';

/**
 * @fileOverview This file defines a Genkit flow to generate a practical AI tip or best practice for the daily newsletter.
 *
 * @exports generateAITip - An asynchronous function that generates an AI tip.
 * @exports GenerateAITipInput - The input type for the generateAITip function.
 * @exports GenerateAITipOutput - The output type for the generateAITip function.
 */

import {z} from 'genkit';
import { openaiGenerateJson } from '@/ai/openai';
import { getPromptContent, renderPrompt } from '@/lib/prompts';

const GenerateAITipInputSchema = z.object({
  topic: z.string().optional().describe('Optional topic to guide the AI tip generation.'),
});
export type GenerateAITipInput = z.infer<typeof GenerateAITipInputSchema>;

const GenerateAITipOutputSchema = z.object({
  tip: z.string().describe('A practical AI tip or best practice.'),
});
export type GenerateAITipOutput = z.infer<typeof GenerateAITipOutputSchema>;

export async function generateAITip(input: GenerateAITipInput): Promise<GenerateAITipOutput> {
  const topicLine = input.topic ? `The tip should be related to: ${input.topic}` : '';

  const defaults = {
    template: `You are an AI assistant designed to provide helpful and practical tips related to artificial intelligence.

Generate a single, actionable AI tip or best practice that can be easily understood and implemented by readers of a daily newsletter.

{{topicLine}}`,
  };

  const { template, system } = await getPromptContent('generateAITip', defaults);
  const prompt = renderPrompt(template, { topicLine });

  return openaiGenerateJson(GenerateAITipOutputSchema, {
    prompt,
    system,
    temperature: 0.7,
    maxOutputTokens: 180,
  });
}

