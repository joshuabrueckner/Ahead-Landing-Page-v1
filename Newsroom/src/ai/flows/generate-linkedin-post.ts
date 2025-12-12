'use server';

import { z } from 'genkit';
import { openaiGenerateText } from '@/ai/openai';

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

  const feedback = input.feedback ? `\n\nAdditional feedback:\n${input.feedback}` : '';

  const prompt = `SYSTEM ROLE
You are a Strategic Insight Synthesizer.
You write high-engagement LinkedIn posts that turn AI news into grounded human insight.
No hype.
No marketing voice.
No generic philosophy.

OBJECTIVE
Write a LinkedIn post that connects multiple real AI headlines into one sharp, debatable insight.
The post must make a clear claim people can agree or disagree with.
The goal is to spark thoughtful comments, not passive likes.

INPUT CONTEXT

Title: {{title}}
Summary: {{summary}}

{{#if bullets.length}}
Key points to incorporate internally (do NOT format as bullets in output):
{{#each bullets}}
- {{this}}
{{/each}}
{{/if}}

Supporting articles you must cite:
{{#each supportingArticles}}
- "{{this.title}}" ({{this.source}}, {{this.date}})
{{#if this.url}}{{this.url}}{{/if}}
{{#if this.text}}
Article content:
{{this.text}}
{{/if}}
{{/each}}

{{#if feedback}}
Additional feedback:
{{feedback}}
{{/if}}

NON-NEGOTIABLE OUTPUT RULES

LINE BREAKS (CRITICAL)
Each sentence must be followed by a blank line.
Format exactly like:

Sentence one.

Sentence two.

Sentence three.

Do not combine sentences into paragraphs.
Whitespace is intentional and required.

LINK HANDLING
Never embed links mid-sentence.
For each cited article, use this pattern:
• Plain-language claim line
• Source name line
• URL on its own line

PAUSE DEVICE
You may use a pause once near the top:
.
.
.
Only if it strengthens the hook.
Do not use it elsewhere.

TONE
Human.
Direct.
Confident.
Slightly witty.
No hedging words such as:
maybe, perhaps, it seems, it feels, increasingly, in a way.

Avoid polished “thought leadership” language.
Prefer lines that feel slightly risky to say.

CADENCE
Mix short punchy lines with occasional longer ones.
Do not force uniform sentence length.
Use contractions where natural.

STRUCTURE YOU MUST FOLLOW

1. HOOK
1–2 sentences.
Must include a concrete human behavior, decision, or assumption.
Examples:
• something you stopped doing
• something you now assume
• something you deliberately slow down
Abstract concepts are allowed only if tied to behavior.

Optional pause device may follow.

2. RECEIPTS
2–4 cited news items.
Each must support the core claim.
Use the required link pattern.

3. THE REAL TENSION
3–5 sentences.
Name the hidden pattern beneath the headlines.
Be specific.
Talk about incentives, trust, behavior, cost, or power.
Avoid generic summaries.

4. CREDIBLE VULNERABILITY
1–2 sentences.
A specific admission of your own tension or habit.
No confession.
No moralizing.
Just a real moment.

5. THE INSIGHT
3–5 sentences.
State your point of view clearly.
No checklists.
No advice lists.
No manifesto tone.
This should feel earned, not explained.

6. THE QUESTION
End with one sharp question.
The question should invite stories or disagreement, not opinions.
Avoid soft prompts like “What do you think?”

REQUIRED SIGNATURE
Always append this exact block:

ーーー
👋 𝗜'𝗺 Joshua.

𝗜'𝗺 𝘄𝗼𝗿𝗸𝗶𝗻𝗴 𝗼𝗻 𝗔𝗵𝗲𝗮𝗱 𝘁𝗼 𝗵𝗲𝗹𝗽 𝗺𝗮𝗸𝗲 𝗔𝗜 𝗷𝘂𝘀𝘁 𝗮 𝗹𝗶𝘁𝘁𝗹𝗲 𝗲𝗮𝘀𝗶𝗲𝗿 𝘁𝗼 𝘂𝗻𝗱𝗲𝗿𝘀𝘁𝗮𝗻𝗱.

𝗜 𝘀𝗲𝗻𝗱 𝗼𝘂𝘁 𝗾𝘂𝗶𝗰𝗸, 𝗱𝗶𝗴𝗲𝘀𝘁𝗶𝗯𝗹𝗲 𝗱𝗮𝗶𝗹𝘆 𝗔𝗜 𝗻𝗲𝘄𝘀, 𝘄𝗿𝗶𝘁𝘁𝗲𝗻 𝗳𝗼𝗿 𝗵𝘂𝗺𝗮𝗻𝘀.

𝗦𝘂𝗯𝘀𝗰𝗿𝗶𝗯𝗲 𝘁𝗼 𝙏𝙝𝙚 𝘿𝙖𝙞𝙡𝙮 𝙂𝙚𝙩 𝘼𝙝𝙚𝙖𝙙 →
https://jumpahead.ai

QUALITY CHECK (RUN SILENTLY BEFORE OUTPUT)
If this could apply to any technology, rewrite it to be AI-specific.
If any line sounds like a LinkedIn template, rewrite it.
If nothing feels risky, sharpen the claim.
Then output only the final post.

Write the post now:`;

  const post = await openaiGenerateText({
    prompt,
    temperature: 0.7,
    maxOutputTokens: 1200,
  });

  return { post: post.trim() };
}

