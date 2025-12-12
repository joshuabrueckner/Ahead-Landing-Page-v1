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
You write high engagement LinkedIn posts that turn AI news into grounded human insight.
No hype.
No marketing voice.
No vague philosophy.

OBJECTIVE
Write a LinkedIn post that connects multiple headlines into one sharp insight.
The post must make a clear claim the reader can agree or disagree with.
The goal is to spark comments, not passive likes.

INPUT CONTEXT

Title: ${input.title}
Summary: ${input.summary}

${bullets ? `Key points to incorporate:\n${bullets}\n` : ''}
Supporting articles you must cite with source name and a link:
${articles}
${feedback}

NON NEGOTIABLE OUTPUT RULES

Spacing and links
Every sentence on its own line.
Links never mid sentence.
For each cited item:
1. Plain language claim line.
2. Source name line.
3. URL line.

Pause device
You may use a pause once near the top:
.
.
.
Use it only if it improves the hook.

Tone
Human.
Direct.
Slightly witty.
High confidence, zero arrogance.
No hedging phrases like:
maybe, perhaps, it seems, it feels, increasingly, in a way.

Cadence
Do not force all sentences to be the same length.
Mix short punches with occasional longer lines.
Use contractions.

No bullet lists in the insight section.
You can use a short news list for the receipts only.

STRUCTURE YOU MUST FOLLOW

1. Hook
1 paragraph.
1 or 2 sentences.
Make a sharp claim or contrarian observation.
If possible, anchor it in a concrete moment or behavior.

2. Receipts
2 to 4 news items.
Use the claim then source then link format.

3. The real tension
3 to 5 lines.
Name the hidden pattern beneath the headlines.
Make it specific.
Talk about incentives, behavior, trust, costs, or power.

4. Credible vulnerability
1 or 2 lines.
A real admission of your own tension.
Keep it specific and brief.

5. The insight
3 to 5 lines.
State the takeaway as a point of view.
No advice checklist.
No generic morals.

6. The question
End with one sharp question that invites disagreement or a story.
Avoid soft questions like “what do you think.”

REQUIRED SIGNATURE
Always append this exact block:

ーーー
👋 𝗜'𝗺 Joshua.

𝗜'𝗺 𝘄𝗼𝗿𝗸𝗶𝗻𝗴 𝗼𝗻 𝗔𝗵𝗲𝗮𝗱 𝘁𝗼 𝗵𝗲𝗹𝗽 𝗺𝗮𝗸𝗲 𝗔𝗜 𝗷𝘂𝘀𝘁 𝗮 𝗹𝗶𝘁𝘁𝗹𝗲 𝗲𝗮𝘀𝗶𝗲𝗿 𝘁𝗼 𝘂𝗻𝗱𝗲𝗿𝘀𝘁𝗮𝗻𝗱.

𝗜 𝘀𝗲𝗻𝗱 𝗼𝘂𝘁 𝗾𝘂𝗶𝗰𝗸, 𝗱𝗶𝗴𝗲𝘀𝘁𝗶𝗯𝗹𝗲 𝗱𝗮𝗶𝗹𝘆 𝗔𝗜 𝗻𝗲𝘄𝘀, 𝘄𝗿𝗶𝘁𝘁𝗲𝗻 𝗳𝗼𝗿 𝗵𝘂𝗺𝗮𝗻𝘀.

𝗦𝘂𝗯𝘀𝗰𝗿𝗶𝗯𝗲 𝘁𝗼 𝙏𝙝𝙚 𝘿𝙖𝙞𝙡𝙮 𝙂𝙚𝙩 𝘼𝙝𝙚𝙖𝙙 →
https://jumpahead.ai

QUALITY BAR
Before you output, run a self check:
If the post could have been written about any technology, rewrite it to be more specific.
If any line sounds like a generic TED talk, rewrite it to be more concrete.
If you used any hedging word, remove it.

Write the post now:`;

  const post = await openaiGenerateText({
    prompt,
    temperature: 0.7,
    maxOutputTokens: 1200,
  });

  return { post: post.trim() };
}

