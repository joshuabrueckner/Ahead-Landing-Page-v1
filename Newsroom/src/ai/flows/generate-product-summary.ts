
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
  prompt: `You are an expert copywriter for Ahead. Write a single sentence that completes the structure: "[Product Name] [your sentence]"

The sentence will appear directly after the product name in a newsletter for mid-career knowledge workers who are non-technical and looking for AI tools with immediate, tangible results.

**Requirements:**
1. **State what it is AND the benefit** - Clearly explain what the tool does and why it matters.
2. **Be Jargon-Free:** Use plain, accessible language.
3. **Vary your sentence starters** - Use different openings like "turns...", "lets you...", "makes it easy to...", "automatically...", "saves you time by...", "gives you...", etc. Do NOT always start with "helps you".
4. **NEVER start with the product name** - The product name is already shown separately.
5. **Maximum 100 characters** - Do not exceed this limit. Do not truncate.

Product name: {{name}}
Product context: {{description}}

IMPORTANT: You MUST respond with a valid JSON object in this exact format: {"summary": "your sentence here"}
Do not include any other text, markdown, or explanation outside the JSON object.`,
  config: {
    temperature: 0.5,
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
      return { summary: `is an AI-powered tool designed to boost your productivity.` };
    }
    
    try {
      const {output} = await prompt(input);
      
      // Handle null/undefined output gracefully
      if (!output || !output.summary) {
        console.error(`generateProductSummaryFlow: Model returned null/empty for ${input.name}`);
        throw new Error('Model returned empty response');
      }
      
      // Ensure summary doesn't exceed 100 characters
      let summary = output.summary;
      if (summary.length > 100) {
        // Try to cut at a natural break point
        const truncated = summary.slice(0, 97);
        const lastSpace = truncated.lastIndexOf(' ');
        summary = lastSpace > 50 ? truncated.slice(0, lastSpace) + '...' : truncated + '...';
      }
      
      return { summary };
    } catch (error: any) {
      // Log the actual error for debugging
      console.error(`generateProductSummaryFlow: Error for ${input.name}:`, error.message);
      // Re-throw so the action can handle it and show the error to the user
      throw error;
    }
  }
);
