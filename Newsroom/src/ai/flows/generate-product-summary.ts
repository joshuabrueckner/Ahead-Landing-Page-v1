
'use server';

/**
 * @fileOverview This file defines a Genkit flow to generate an explanatory summary for a product.
 *
 * @exports generateProductSummary - An asynchronous function that generates a product summary.
 * @exports GenerateProductSummaryInput - The input type for the generateProductSummary function.
 * @exports GenerateProductSummaryOutput - The output type for the generateProductSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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
  return generateProductSummaryFlow(input);
}

const generateProductSummaryFlow = ai.defineFlow(
  {
    name: 'generateProductSummaryFlow',
    inputSchema: GenerateProductSummaryInputSchema,
    outputSchema: GenerateProductSummaryOutputSchema,
  },
  async input => {
    try {
      const promptText = `You are an expert copywriter for Ahead.
Task: Write one short, highly practical sentence that explains how this product helps a mid-career, non-technical professional.
Constraints:
- Do NOT mention the product name or brand.
- Start directly with the outcome or action.
- Keep it warm, jargon-free, and <= 25 words.
- Output MUST be valid JSON.

Product name: ${input.name}
Product context: ${input.description}

Example Output:
{ "summary": "Helps you automate your daily emails." }`;

      const result = await ai.generate({
        model: 'googleai/gemini-3-pro-preview',
        prompt: promptText,
        config: {
          temperature: 0.2,
          maxOutputTokens: 200,
        },
      });

      const text = result.text;
      console.log(`[generateProductSummaryFlow] Raw output for ${input.name}:`, text);
      console.log(`[generateProductSummaryFlow] Finish reason for ${input.name}:`, result.finishReason);

      if (!text) {
        throw new Error(`Model returned empty text. Finish reason: ${result.finishReason}`);
      }

      // Clean up markdown code blocks if present
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      
      let parsed;
      try {
        parsed = JSON.parse(cleanText);
      } catch (e) {
        console.error(`[generateProductSummaryFlow] JSON parse error for ${input.name}:`, e);
        throw new Error('Failed to parse JSON output');
      }

      if (!parsed.summary) {
         throw new Error('JSON output missing summary property');
      }

      return { summary: parsed.summary };

    } catch (error) {
      console.error('Error in generateProductSummaryFlow:', error);
      // Fallback to a generic summary if generation fails
      return { summary: 'Helps you achieve your goals with AI.' };
    }
  }
);
