
// src/ai/flows/generate-newsletter-email-content.ts
'use server';

/**
 * @fileOverview Generates the newsletter email content by summarizing fetched news, product launches, and an AI tip.
 *
 * - generateNewsletterEmailContent - A function that generates the email content.
 * - GenerateNewsletterEmailContentInput - The input type for the generateNewsletterEmailContent function.
 * - GenerateNewsletterEmailContentOutput - The return type for the generateNewsletterEmailContent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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
  return generateNewsletterEmailContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateNewsletterEmailContentPrompt',
  input: {schema: GenerateNewsletterEmailContentInputSchema},
  output: {schema: GenerateNewsletterEmailContentOutputSchema},
  prompt: `You are an expert newsletter creator. Use the provided information to create engaging content.
You must generate 1 featured headline, 4 additional headlines, 3 product launches, and 1 AI tip.

The first news article in the list is the featured article. Use its title as the headline, its URL as the link, and its imageUrl as the imageUrl if available. For this featured story you must produce two sections with the following requirements:

1. "What's Happening" (aka The News/Insight) – 3 concise sentences that:
  - Explain the core development, trend, or story clearly and simply (think deep, speak simply).
  - Stay neutral and avoid hype or fear-based language.
  - Use jargon-free, plain language for non-technical mid-career knowledge workers.
  - Feel conversational and web-friendly, suitable for a daily email newsletter.

2. "Why You Should Care" (aka The Practical Takeaway) – 3 concise sentences that:
  - Speak directly to mid-career knowledge workers who feel pressured to adopt AI, fear layoffs, or need to be more efficient.
  - Are empowering, practical, and gently encouraging, highlighting the real-world implication of the news.
  - Sound smart, witty, and slightly philosophical without lecturing.
  - Provide actionable guidance the reader can use to feel confident or gain an edge.

For the other 4 news articles (Quick Hits), use their SUMMARY as the headline (not the title) and their URLs as the links. The summary contains the key insight - use it directly as the headline text.

For the product launches, use their names and URLs. For the sentence, create a concise, single-sentence summary of the product's description.

The AI tip should be the exact tip provided.

News Articles:
{{#each newsArticles}}
- Title: {{this.title}}
  Summary: {{this.summary}}
  URL: {{this.url}}
  {{#if this.imageUrl}}
  Image URL: {{this.imageUrl}}
  {{/if}}
{{/each}}

Product Launches:
{{#each productLaunches}}
- Name: {{this.name}}
  Description: {{this.description}}
  URL: {{this.url}}
{{/each}}

AI Tip:
{{aiTip}}
`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
    ],
  },
});

const generateNewsletterEmailContentFlow = ai.defineFlow(
  {
    name: 'generateNewsletterEmailContentFlow',
    inputSchema: GenerateNewsletterEmailContentInputSchema,
    outputSchema: GenerateNewsletterEmailContentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
