'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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
  return generateLinkedInPostFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateLinkedInPostPrompt',
  input: { schema: GenerateLinkedInPostInputSchema },
  output: { schema: GenerateLinkedInPostOutputSchema },
  prompt: `The "News-to-Insight" Bridge: From Hype to Human Reality

GOAL: Generate a LinkedIn post that moves beyond the promotional noise of AI to find practical, human reality. The post must tie multiple hard news or op-ed headlines together to identify a broader trend or recurring problem.

Write a LinkedIn post based on the following pitch:

Title: {{title}}
Summary: {{summary}}

{{#if bullets.length}}
Key points to cover:
{{#each bullets}}
- {{this}}
{{/each}}
{{/if}}

Supporting articles (cite these with source names and links where provided):
{{#each supportingArticles}}
- "{{this.title}}" ({{this.source}}, {{this.date}}) {{#if this.url}}URL: {{this.url}}{{/if}}
{{#if this.text}}
  Article Content: {{this.text}}
{{/if}}
{{/each}}

{{#if feedback}}
Additional feedback to incorporate: {{feedback}}
{{/if}}

CLARITY & TONE FILTER (The "Coffee Test")

Write for humans. Every sentence must sound natural, smart, and conversational—like a colleague sharing sharp gossip over coffee. Be Punchy & Direct. Ensure every sentence is on its own line (except for the initial hook). Cut filler words aggressively. Tone: Smart, witty, and slightly philosophical. High confidence, zero arrogance. Credible Vulnerability: In the Pivot section, add a quick, honest, self-referential admission of a struggle or learning moment.

AUDIENCE & USEFULNESS LENS

Audience: Smart, busy, and leading a team or project where AI is becoming unavoidable. The Silent Question: Answer: "So what can I do with this?" (The conclusion must prompt critical reflection). Practical Takeaway: The conclusion must be introspective—either a reflective observation or a set of open-ended questions that push the reader toward wise action or self-assessment.

POST LENGTH & STRUCTURE RULES

Format: Each sentence MUST be on its own line, unless specified. Source Citations: Include actual company names, product launches, or studies, and cite the source/author and include a link (if provided in the source material). You are not limited to just two headlines.

STRUCTURE:

The Hook (1-2 sentences, joined): Start with a provocative or grounding observation that includes a specific, punchy statement or statistic to grab attention instantly. This section must be written as a single paragraph (1-2 sentences joined).

The Context (2–3 lines): Briefly summarize the real news (the "what").

The Tension (2-3 lines): Highlight the human gap, contradiction, or unexpected cost this news creates.

The Pivot (2 lines): Reframe the problem or opportunity. Introduce the deeper meaning. Include the element of credible vulnerability here.

The Conclusion (1-3 lines): Deliver the introspective takeaway (observation or questions). Do not use the phrase "So what can you do?"

Signature: Always end with this exact signature block:

ーーー
👋 𝗜'𝗺 Joshua.

𝗜'𝗺 𝘄𝗼𝗿𝗸𝗶𝗻𝗴 𝗼𝗻 𝗔𝗵𝗲𝗮𝗱 𝘁𝗼 𝗵𝗲𝗹𝗽 𝗺𝗮𝗸𝗲 𝗔𝗜 𝗷𝘂𝘀𝘁 𝗮 𝗹𝗶𝘁𝘁𝗹𝗲 𝗲𝗮𝘀𝗶𝗲𝗿 𝘁𝗼 𝘂𝗻𝗱𝗲𝗿𝘀𝘁𝗮𝗻𝗱.

𝗜 𝘀𝗲𝗻𝗱 𝗼𝘂𝘁 𝗾𝘂𝗶𝗰𝗸, 𝗱𝗶𝗴𝗲𝘀𝘁𝗶𝗯𝗹𝗲 𝗱𝗮𝗶𝗹𝘆 𝗔𝗜 𝗻𝗲𝘄𝘀, 𝘄𝗿𝗶𝘁𝘁𝗲𝗻 𝗳𝗼𝗿 𝗵𝘂𝗺𝗮𝗻𝘀.

𝗦𝘂𝗯𝘀𝗰𝗿𝗶𝗯𝗲 𝘁𝗼 𝙏𝙝𝙚 𝘿𝗮𝙞𝙡𝙮 𝙂𝙚𝙩 𝘼𝙝𝗲𝗮𝗱 → https://jumpahead.ai

Write the post now:`,
});

const generateLinkedInPostFlow = ai.defineFlow(
  {
    name: 'generateLinkedInPostFlow',
    inputSchema: GenerateLinkedInPostInputSchema,
    outputSchema: GenerateLinkedInPostOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);
