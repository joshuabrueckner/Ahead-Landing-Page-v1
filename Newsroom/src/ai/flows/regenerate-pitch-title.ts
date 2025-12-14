'use server';

import { z } from 'genkit';
import { openaiGenerateJson } from '@/ai/openai';
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

  const defaults = {
    template: `You are an expert LinkedIn content strategist. Given a pitch idea with supporting articles, generate a NEW and DIFFERENT title and summary.

Current pitch:
Title: {{currentTitle}}
Summary: {{currentSummary}}

Supporting articles:
{{articlesText}}

Rules:
1. Title MUST start with "Discusses" (no colon)
2. Use lowercase after "Discusses" (not Title Case)
3. Title under 8 words, specific, human
4. Summary is 1-2 sentences
5. Must be different from current title/summary

Return JSON only: {"title": string, "summary": string}`,
  };

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

