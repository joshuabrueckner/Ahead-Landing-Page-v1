'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  source: z.string(),
  date: z.string(),
  summary: z.string().optional(),
});

const FindRelevantArticlesInputSchema = z.object({
  userIdea: z.string().describe('The user\'s idea for a LinkedIn post'),
  existingArticleUrls: z.array(z.string()).optional().describe('URLs of articles the user already has'),
  availableArticles: z.array(ArticleSchema).describe('All available articles to search from'),
});
export type FindRelevantArticlesInput = z.infer<typeof FindRelevantArticlesInputSchema>;

const FindRelevantArticlesOutputSchema = z.object({
  matchedArticleIds: z.array(z.string()).describe('IDs of articles that are relevant to the idea'),
  title: z.string().describe('A title for this pitch idea'),
  summary: z.string().describe('A brief summary of how the articles connect to the idea'),
  reasoning: z.string().describe('Brief explanation of why these articles were selected'),
});
export type FindRelevantArticlesOutput = z.infer<typeof FindRelevantArticlesOutputSchema>;

export async function findRelevantArticles(input: FindRelevantArticlesInput): Promise<FindRelevantArticlesOutput> {
  return findRelevantArticlesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'findRelevantArticlesPrompt',
  input: { schema: FindRelevantArticlesInputSchema },
  output: { schema: FindRelevantArticlesOutputSchema },
  prompt: `You are an expert LinkedIn content strategist. A user has an idea for a LinkedIn post and wants to find articles that support, add perspective to, or offer unique angles on their idea.

User's idea: {{userIdea}}

{{#if existingArticleUrls}}
The user already has these articles (by URL):
{{#each existingArticleUrls}}
- {{this}}
{{/each}}
{{/if}}

Available articles to search from:
{{#each availableArticles}}
- ID: {{this.id}}
  Title: {{this.title}}
  Source: {{this.source}}
  Date: {{this.date}}
  URL: {{this.url}}
  {{#if this.summary}}Summary: {{this.summary}}{{/if}}

{{/each}}

Find 2-5 articles that would work well with the user's idea. Look for articles that:
1. Directly support or relate to the user's topic
2. Offer a contrasting or complementary perspective
3. Provide data, examples, or case studies relevant to the idea
4. Add depth or unique angles to the discussion

Do NOT include articles the user already has (check the existingArticleUrls).

Return:
- matchedArticleIds: The IDs of the relevant articles (use the exact ID values from the list above)
- title: A title for this pitch that starts with "Discusses" followed by the topic in lowercase (not Title Case). Example: "Discusses why AI adoption fails in enterprises"
- summary: A 1-2 sentence summary of how the user's idea connects with the selected articles
- reasoning: Brief explanation of why each article was selected`,
});

const findRelevantArticlesFlow = ai.defineFlow(
  {
    name: 'findRelevantArticlesFlow',
    inputSchema: FindRelevantArticlesInputSchema,
    outputSchema: FindRelevantArticlesOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);
