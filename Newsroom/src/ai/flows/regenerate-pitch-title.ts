'use server';

import { z } from 'genkit';
import { openaiGenerateJson } from '@/ai/openai';
import { DEFAULT_PROMPTS } from '@/lib/prompt-defaults';
import { getPromptContent, renderPrompt } from '@/lib/prompts';

const SupportingArticleSchema = z.object({
  title: z.string(),
  source: z.string(),
  date: z.string(),
  url: z.string(),
  text: z.string().optional(),
});

const RegeneratePitchTitleInputSchema = z.object({
  currentTitle: z.string().describe('The current title of the pitch'),
  currentSummary: z.string().describe('The current summary of the pitch'),
  supportingArticles: z.array(SupportingArticleSchema).describe('The articles supporting this pitch'),
});
export type RegeneratePitchTitleInput = z.infer<typeof RegeneratePitchTitleInputSchema>;

const RegeneratePitchTitleOutputSchema = z.object({
  title: z.string().describe('New title for the pitch'),
  summary: z.string().describe('New summary for the pitch'),
});
export type RegeneratePitchTitleOutput = z.infer<typeof RegeneratePitchTitleOutputSchema>;

export async function regeneratePitchTitle(input: RegeneratePitchTitleInput): Promise<RegeneratePitchTitleOutput> {
  const articlesText = input.supportingArticles
    .map(a => {
      const content = a.text ? `  Article Content: ${a.text.slice(0, 2000)}` : '';
      return `- ${a.title} (${a.source}, ${a.date})${content ? `\n${content}` : ''}`;
    })
    .join('\n');

  const defaults = DEFAULT_PROMPTS.regeneratePitchTitle;

  const { template, system } = await getPromptContent('regeneratePitchTitle', defaults);
  const prompt = renderPrompt(template, {
    currentTitle: input.currentTitle,
    currentSummary: input.currentSummary,
    articlesText,
  });

  return openaiGenerateJson(RegeneratePitchTitleOutputSchema, {
    prompt,
    system,
    temperature: 0.8,
    maxOutputTokens: 220,
  });
}

