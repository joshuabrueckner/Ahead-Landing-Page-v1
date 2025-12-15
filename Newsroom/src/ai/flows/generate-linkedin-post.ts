'use server';

import { z } from 'genkit';
import { generateText } from '@/ai/generate';
import { getPromptContent, renderPrompt } from '@/lib/prompts';
import { DEFAULT_PROMPTS } from '@/lib/prompt-defaults';

const SupportingArticleSchema = z.object({
  title: z.string(),
  source: z.string(),
  date: z.string(),
  url: z.string(),
  text: z.string().optional(),
});

const GenerateLinkedInPostInputSchema = z.object({
  title: z.string().describe('The pitch title'),
  summary: z.string().describe('The pitch summary'),
  bullets: z.array(z.string()).describe('Supporting bullet points'),
  supportingArticles: z.array(SupportingArticleSchema).describe('Articles supporting the pitch'),
  feedback: z.string().optional().describe('Optional feedback to refine the post'),
});
export type GenerateLinkedInPostInput = z.infer<typeof GenerateLinkedInPostInputSchema>;

const GenerateLinkedInPostOutputSchema = z.object({
  post: z.string().describe('The full LinkedIn post content'),
});
export type GenerateLinkedInPostOutput = z.infer<typeof GenerateLinkedInPostOutputSchema>;

export async function generateLinkedInPost(input: GenerateLinkedInPostInput): Promise<GenerateLinkedInPostOutput> {
  const bullets = input.bullets?.length ? input.bullets.map(b => `- ${b}`).join('\n') : '';
  const articles = input.supportingArticles
    .map(a => {
      const urlLine = a.url ? `URL: ${a.url}` : '';
      const text = a.text ? `Article content:\n${a.text.slice(0, 5000)}` : '';
      return `- "${a.title}" (${a.source}, ${a.date})\n${urlLine}${text ? `\n${text}` : ''}`.trim();
    })
    .join('\n\n');

  const bulletsBlock = bullets
    ? `Key points to incorporate internally (do NOT format as bullets in output):\n${bullets}\n\n`
    : '';

  const supportingArticlesBlock = articles ? `Supporting articles you must cite:\n${articles}\n\n` : '';
  const feedbackBlock = input.feedback ? `Additional feedback:\n${input.feedback}\n\n` : '';

  const defaults = DEFAULT_PROMPTS.generateLinkedInPost;

  const { template, system, provider } = await getPromptContent('generateLinkedInPost', defaults);
  const prompt = renderPrompt(template, {
    title: input.title,
    summary: input.summary,
    bulletsBlock,
    supportingArticlesBlock,
    feedbackBlock,
  });

  const post = await generateText({
    provider,
    prompt,
    system,
    temperature: 0.7,
    maxOutputTokens: 1200,
    meta: { promptId: 'generateLinkedInPost' },
  });

  return { post: post.trim() };
}

