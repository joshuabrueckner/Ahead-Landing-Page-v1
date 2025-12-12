
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
import { openaiGenerateJson } from '@/ai/openai';

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

  const prompt = `You are an expert newsletter creator. Use the provided information to create engaging content.
You must generate 1 featured headline, 4 additional headlines, 3 product launches, and 1 AI tip.

The first news article in the list is the featured article. Use its title as the headline, its URL as the link, and its imageUrl as the imageUrl if available. For this featured story you must produce two sections:

1. "What's Happening" – 3 concise sentences that:
  - Explain the core development clearly and simply.
  - Stay neutral and avoid hype or fear-based language.
  - Use jargon-free, plain language for non-technical mid-career knowledge workers.

2. "Why You Should Care" – 3 concise sentences that:
  - Speak directly to knowledge workers pressured to adopt AI.
  - Are empowering and practical.
  - Sound smart, witty, and slightly philosophical without lecturing.
  - Provide actionable guidance.

For the other 4 news articles (Quick Hits), use their SUMMARY as the headline (not the title) and their URLs as the links.

For product launches, write a concise single sentence for each based on the description.

The AI tip must be the exact tip provided.

News Articles:\n${newsLines}

Product Launches:\n${productLines}

AI Tip:\n${input.aiTip}

Return JSON with this exact shape:
{
  "featuredHeadline": {
    "headline": string,
    "link": string,
    "imageUrl"?: string,
    "whatsHappening": string,
    "whyYouShouldCare": string
  },
  "headlines": [{"headline": string, "link": string}, ...4 items],
  "launches": [{"name": string, "link": string, "sentence": string}, ...3 items],
  "aheadTip": string
}`;

  return openaiGenerateJson(GenerateNewsletterEmailContentOutputSchema, {
    prompt,
    temperature: 0.6,
    maxOutputTokens: 1400,
  });
}

