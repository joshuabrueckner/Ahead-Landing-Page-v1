
// src/ai/flows/generate-newsletter-email-content.ts
'use server';

/**
 * @fileOverview Generates the newsletter email content by summarizing fetched news, product launches, and an AI tip.
 *
 * - generateNewsletterEmailContent - A function that generates the email content.
 * - GenerateNewsletterEmailContentInput - The input type for the generateNewsletterEmailContent function.
 * - GenerateNewsletterEmailContentOutput - The return type for the generateNewsletterEmailContent function.
 */

import {z} from 'genkit';
import { generateJson } from '@/ai/generate';
import { DEFAULT_PROMPTS } from '@/lib/prompt-defaults';
import { getPromptContent, renderPrompt } from '@/lib/prompts';

const GenerateNewsletterEmailContentInputSchema = z.object({
  newsArticles: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      url: z.string().url(),
      imageUrl: z.string().url().optional(),
    })
  ).length(5).describe('An array of 5 news articles with title, summary, and URL. The first article is the featured one.'),
  productLaunches: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      url: z.string().url(),
    })
  ).length(3).describe('An array of 3 product launches with name, description, and URL.'),
  aiTip: z.string().describe('A useful AI tip or best practice.'),
});
export type GenerateNewsletterEmailContentInput = z.infer<typeof GenerateNewsletterEmailContentInputSchema>;

const GenerateNewsletterEmailContentOutputSchema = z.object({
  featuredHeadline: z.object({
    headline: z.string().describe("The headline for the featured news article."),
    link: z.string().url().describe("The URL for the featured news article."),
    imageUrl: z.string().url().optional().describe("The URL for the featured news article's image."),
    whatsHappening: z.string().describe("A brief summary of what is happening in the news article."),
    whyYouShouldCare: z.string().describe("A brief explanation of why the reader should care about this news."),
  }).describe("The main featured headline."),
  headlines: z.array(z.object({
    headline: z.string().describe("The headline for the news article."),
    link: z.string().url().describe("The URL for the news article."),
  })).length(4).describe("An array of 4 additional news headlines and their links."),
  launches: z.array(z.object({
    name: z.string().describe("The name of the product launch."),
    link: z.string().url().describe("The URL for the product launch."),
    sentence: z.string().describe("A single sentence describing the product launch.")
  })).length(3).describe("An array of 3 product launches with their name, link, and a descriptive sentence."),
  aheadTip: z.string().describe("The AI tip for the newsletter."),
});
export type GenerateNewsletterEmailContentOutput = z.infer<typeof GenerateNewsletterEmailContentOutputSchema>;

export async function generateNewsletterEmailContent(input: GenerateNewsletterEmailContentInput): Promise<GenerateNewsletterEmailContentOutput> {
  const newsLines = input.newsArticles
    .map((a, idx) => {
      const image = a.imageUrl ? `  Image URL: ${a.imageUrl}` : '';
      return `#${idx + 1}\nTitle: ${a.title}\nSummary: ${a.summary}\nURL: ${a.url}${image ? `\n${image}` : ''}`;
    })
    .join('\n\n');

  const productLines = input.productLaunches
    .map((p, idx) => `#${idx + 1}\nName: ${p.name}\nDescription: ${p.description}\nURL: ${p.url}`)
    .join('\n\n');

  const defaults = DEFAULT_PROMPTS.generateNewsletterEmailContent;

  const { template, system, provider } = await getPromptContent('generateNewsletterEmailContent', defaults);
  const prompt = renderPrompt(template, {
    newsLines,
    productLines,
    aiTip: input.aiTip,
  });

  return generateJson(GenerateNewsletterEmailContentOutputSchema, {
    provider,
    prompt,
    system,
    temperature: 0.6,
    maxOutputTokens: 1400,
  });
}

