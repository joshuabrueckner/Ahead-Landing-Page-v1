
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

const prompt = ai.definePrompt({
  name: 'generateProductSummaryPrompt',
  input: {schema: GenerateProductSummaryInputSchema},
  output: {schema: GenerateProductSummaryOutputSchema},
  prompt: `You are an expert copywriter for Ahead. Write a single, short, and highly practical sentence that completes the structure: "[Product Name] helps you..."

The sentence serves as a concise description for a mid-career knowledge worker (like a Marketing Manager or Ops Lead) who is non-technical, feels pressured by AI, and is looking for tools that provide immediate, tangible results.

**Requirements:**
1. **Focus on the Outcome:** Describe the *benefit* or *practical job-to-be-done* the tool solves, not technical features.
2. **Be Jargon-Free:** Use plain, accessible language that is warm and empowering.
3. **Be Direct and Actionable:** Start immediately with "helps you..." (do NOT include the product name).
4. **Keep it concise:** Maximum 20 words.

Product name: {{name}}
Product context: {{description}}

IMPORTANT: You MUST respond with a valid JSON object in this exact format: {"summary": "helps you [rest of sentence]"}
Do not include any other text, markdown, or explanation outside the JSON object.`,
  config: {
    temperature: 0.4,
    maxOutputTokens: 100,
  },
});

const generateProductSummaryFlow = ai.defineFlow(
  {
    name: 'generateProductSummaryFlow',
    inputSchema: GenerateProductSummaryInputSchema,
    outputSchema: GenerateProductSummaryOutputSchema,
  },
  async input => {
    if (!input.description) {
      return { summary: input.name };
    }
    
    // Create a fallback based on the description
    const createFallback = () => {
      const fallback = input.description.toLowerCase().startsWith('a ') || input.description.toLowerCase().startsWith('an ')
        ? input.description.charAt(0).toLowerCase() + input.description.slice(1)
        : input.description;
      return { summary: fallback.length > 100 ? fallback.slice(0, 97) + '...' : fallback };
    };
    
    try {
      const {output} = await prompt(input);
      
      // Handle null/undefined output gracefully
      if (!output || !output.summary) {
        console.warn(`generateProductSummaryFlow: Model returned null for ${input.name}, using fallback`);
        return createFallback();
      }
      
      return output;
    } catch (error: any) {
      // Catch schema validation errors when model returns null or invalid JSON
      console.warn(`generateProductSummaryFlow: Error for ${input.name}: ${error.message}, using fallback`);
      return createFallback();
    }
  }
);
