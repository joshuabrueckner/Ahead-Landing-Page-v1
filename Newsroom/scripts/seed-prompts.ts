import { getAdminFirestore } from '../src/firebase/admin';

type PromptDoc = {
  template: string;
  system?: string;
};

const DEFAULT_PROMPTS: Record<string, PromptDoc> = {
  generateLinkedInPitches: {
    template: `You are an expert LinkedIn content strategist helping create thoughtful, insightful posts about AI trends and developments.

Given the following AI news articles, identify exactly 6 compelling narrative angles that connect multiple articles together into cohesive, thought-provoking LinkedIn posts.

You MUST base your ideas on the article EXCERPTS (and summaries) provided — do not hallucinate facts.

Each pitch should:
1. Connect 2-3 articles that share a common theme
2. Offer a unique insight beyond summarizing
3. Be relevant to business professionals and AI practitioners
4. Encourage engagement and discussion
5. Feel authentic and thoughtful, not clickbait

Articles to analyze:\n{{articlesText}}

Return JSON only with shape:
{
  "pitches": [
    {
      "id": string,
      "title": string,
      "summary": string,
      "bullets": string[],
      "supportingArticles": [{"id"?: string, "title": string, "source": string, "date": string, "url": string, "text"?: string}]
    }
  ]
}

The top-level key "pitches" is REQUIRED. If you cannot produce pitches, return:
{ "pitches": [] }

Minimal valid example:
{ "pitches": [] }

If an input article includes an "ID", you MUST copy it exactly into the corresponding supportingArticles[].id.

Title rules:
- MUST start with "Discusses" (no colon)
- Sentence case (do NOT put every word in Title Case; keep proper nouns as written)
- Be specific about the actual idea (avoid generic themes like "AI regulation and policy")

Length limits (keep output short):
- title: max 58 characters
- summary: max 140 characters
- each bullet: max 90 characters

Summary rules:
- Must be a newly written summary of the idea grounded in the excerpts
- Do NOT start with "Connects", "Angle connecting", or "Why X matters"

Supporting articles:
- Include ONLY: id (if available), title, source, date, url
- Do NOT include the optional "text" field
- Each pitch MUST include between 2 and 5 supportingArticles
- Prefer 3–5 supportingArticles when you can find clearly related sources
- Sources must be naturally related (shared theme grounded in excerpts)

Bullets rules:
- Exactly 2 bullets
`,
  },

  generateLinkedInPost: {
    template: `SYSTEM ROLE
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

{{bulletsBlock}}{{supportingArticlesBlock}}{{feedbackBlock}}NON-NEGOTIABLE OUTPUT RULES

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

Write the post now:`,
  },

  findRelevantArticles: {
    template: `You are an expert LinkedIn content strategist.
A user has an idea for a LinkedIn post and wants to find stored articles that support, add perspective to, or offer unique angles.

User idea: {{userIdea}}

{{existingUrlsText}}Available articles to search from (use only these IDs):\n{{availableText}}

Pick 2-5 articles that best fit.
Do NOT include any URLs the user already has.

Return JSON only:
{
  "matchedArticleIds": string[],
  "title": string,
  "summary": string,
  "reasoning": string
}

Title rules:
- Must start with "Discusses" (no colon)
- Lowercase after "Discusses"
`,
  },

  regeneratePitchTitle: {
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
  },

  generateNewsletterEmailContent: {
    template: `You are an expert newsletter creator. Use the provided information to create engaging content.
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

News Articles:\n{{newsLines}}

Product Launches:\n{{productLines}}

AI Tip:\n{{aiTip}}

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
}`,
  },

  generateAITip: {
    template: `You are an AI assistant designed to provide helpful and practical tips related to artificial intelligence.

Generate a single, actionable AI tip or best practice that can be easily understood and implemented by readers of a daily newsletter.

{{topicLine}}`,
  },

  generateArticleSummary: {
    template: `Summarize this AI news article in ONE short sentence for non-technical professionals.

RULES:
- ONE sentence only, very concise (about 15-20 words max)
- Include a key company name, person, or statistic
- Start directly with the insight (no "This article..." or "The news...")
- Plain language, no jargon
- Focus on why it matters

ARTICLE:
{{articleText}}

Write ONLY the summary sentence:`,
  },

  generateProductSummary: {
    template: `You are an expert copywriter. Write a single sentence (max 100 characters) that completes: "{{name}} [your sentence]"

The sentence describes this AI product for non-technical professionals. Focus on the practical benefit.

Requirements:
- Start with a verb like "turns", "lets you", "makes it easy to", "automatically", "helps you", "saves time by"
- Do NOT start with the product name
- Maximum 100 characters
- Plain, jargon-free language

Product: {{name}}
Description: {{description}}

Respond with ONLY the sentence, nothing else.`,
  },

  generateSubjectLine: {
    template: `You are an expert copywriter specializing in writing compelling, short email subject lines.

Based on the following headline, generate a subject line that is no more than 20 characters long.

Headline: {{headline}}`,
  },

  generateIntroSentence: {
    template: `You are a newsletter editor writing a lead-in for your daily AI newsletter.

Based on the following featured headline, write a single, engaging, human-like sentence that provides high-level perspective or commentary. This sentence will be the first thing people read after "Good morning!".

Make it feel like it was written by a person, not a machine. It should be insightful but brief.

Headline: {{headline}}`,
  },

  generateArticleOneSentenceSummary: {
    template: `Summarize this AI news article in ONE short sentence for non-technical professionals.

RULES:
- ONE sentence only, very concise (about 15-20 words max)
- Include a key company name, person, or statistic
- Start directly with the insight (no "This article..." or "The news...")
- Plain language, no jargon
- Focus on why it matters

ARTICLE:
{{articleText}}

Write ONLY the summary sentence:`,
  },

  transformAiTip: {
    template: `You are an expert content writer for Ahead, a platform focused on making AI practical for non-technical knowledge workers. Transform the provided information into a single, concise "Daily AI Tip".

Requirements:
1. <= 300 characters (including spaces).
2. Jargon-free, plain language.
3. Highly actionable with a specific instruction someone can try immediately.
4. Focus on helping the reader feel confident and efficient using AI tools.
5. Keep the tone calm, encouraging, and empowering.

Source material:
"""
{{sourceText}}
"""

Respond with only the transformed tip (no preamble, no quotes).`,
  },
};

function parseArgs(argv: string[]) {
  const force = argv.includes('--force');
  const dryRun = argv.includes('--dry-run');
  return { force, dryRun };
}

async function main() {
  const { force, dryRun } = parseArgs(process.argv.slice(2));
  const db = getAdminFirestore();

  const ids = Object.keys(DEFAULT_PROMPTS);
  console.log(`[seed-prompts] ${ids.length} prompts (${force ? 'force' : 'no-overwrite'}${dryRun ? ', dry-run' : ''})`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const id of ids) {
    const docRef = db.collection('Prompts').doc(id);
    const snap = await docRef.get();
    const exists = snap.exists;

    if (exists && !force) {
      skipped++;
      continue;
    }

    const payload = DEFAULT_PROMPTS[id];

    if (dryRun) {
      if (exists) updated++;
      else created++;
      continue;
    }

    await docRef.set(payload, { merge: true });
    if (exists) updated++;
    else created++;
  }

  console.log(`[seed-prompts] created=${created} updated=${updated} skipped=${skipped}`);
}

main().catch((err) => {
  console.error('[seed-prompts] failed', err);
  process.exit(1);
});
