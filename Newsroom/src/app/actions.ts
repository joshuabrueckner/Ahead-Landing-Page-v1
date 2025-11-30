
"use server";

import {
  generateAITip,
  GenerateAITipInput,
  GenerateAITipOutput,
} from "@/ai/flows/generate-ai-tip";
import {
  generateArticleSummary,
  GenerateArticleSummaryInput,
} from "@/ai/flows/generate-article-summary";
import {
  generateNewsletterEmailContent,
  GenerateNewsletterEmailContentInput,
  GenerateNewsletterEmailContentOutput,
} from "@/ai/flows/generate-newsletter-email-content";
import {
  generateSubjectLine,
  GenerateSubjectLineInput,
  GenerateSubjectLineOutput,
} from "@/ai/flows/generate-subject-line";
import {
  generateIntroSentence,
  GenerateIntroSentenceInput,
  GenerateIntroSentenceOutput,
} from "@/ai/flows/generate-intro-sentence";
import type { NewsArticle, ProductLaunch } from "@/lib/data";
import { db } from "@/firebase/index";
import { collection, addDoc, getDocs, serverTimestamp, Timestamp } from "firebase/firestore";
import { ai } from "@/ai/genkit";
import { load } from "cheerio";


const getYesterdayDateString = () => {
    const nowInPT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const yesterdayInPT = new Date(nowInPT);
    yesterdayInPT.setDate(yesterdayInPT.getDate() - 1);
    
    const year = yesterdayInPT.getFullYear();
    const month = String(yesterdayInPT.getMonth() + 1).padStart(2, '0');
    const day = String(yesterdayInPT.getDate()).padStart(2, '0');
    
    return `${month}/${day}/${year}`;
};

const getYesterdayDateStringISO = () => {
    const nowInPT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const yesterdayInPT = new Date(nowInPT);
    yesterdayInPT.setDate(yesterdayInPT.getDate() - 1);
    
    const year = yesterdayInPT.getFullYear();
    const month = String(yesterdayInPT.getMonth() + 1).padStart(2, '0');
    const day = String(yesterdayInPT.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
};

const toISODate = (date: Date) => {
  const pacific = new Date(date.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return pacific.toISOString().slice(0, 10);
};

const SERPAPI_NEWS_SEARCH_URL = "https://serpapi.com/search.json";
const SERPAPI_MAX_RESULTS = 50;
const FUTURE_TOOLS_NEWS_URL = "https://www.futuretools.io/news";

const normalizeArticleDate = (rawDate?: string | null): string | null => {
  if (!rawDate) return null;
  const trimmed = rawDate.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();

  if (lower === "today") {
    return toISODate(new Date());
  }

  if (lower === "yesterday") {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toISODate(d);
  }

  const relativeMatch = lower.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/);
  if (relativeMatch) {
    const value = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    const d = new Date();
    switch (unit) {
      case "minute":
        d.setMinutes(d.getMinutes() - value);
        break;
      case "hour":
        d.setHours(d.getHours() - value);
        break;
      case "day":
        d.setDate(d.getDate() - value);
        break;
      case "week":
        d.setDate(d.getDate() - value * 7);
        break;
      case "month":
        d.setMonth(d.getMonth() - value);
        break;
      case "year":
        d.setFullYear(d.getFullYear() - value);
        break;
    }
    return toISODate(d);
  }

  // Handle formats like "Nov 25, 2025" or "Nov. 25, 2025"
  const sanitized = trimmed.replace(/\./g, "");
  const parsed = Date.parse(sanitized);
  if (!Number.isNaN(parsed)) {
    return toISODate(new Date(parsed));
  }

  return null;
};

const cleanSourceName = (source?: string) => {
  if (!source) return "";
  // Remove leading dash patterns like " - forbes.com"
  return source.replace(/^\s*-\s*/g, "").trim();
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const stripSourceFromTitle = (title: string, source?: string) => {
  let result = title?.trim() || "";
  if (!result) return "";

  if (source) {
    const pattern = new RegExp(`\\s+-\\s+${escapeRegExp(source)}$`, "i");
    if (pattern.test(result)) {
      return result.replace(pattern, "").trim();
    }
  }

  // Fallback: remove trailing " - Publication" when publication isn't known
  const genericSuffix = /\s+-\s+[A-Za-z0-9 .,'&()-]{2,60}$/;
  if (genericSuffix.test(result)) {
    result = result.replace(genericSuffix, "").trim();
  }
  return result;
};

const normalizeFutureToolsDate = (rawDate?: string | null) => {
  if (!rawDate) return null;
  const trimmed = rawDate.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  const dotSeparatedMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
  if (dotSeparatedMatch) {
    const month = dotSeparatedMatch[1].padStart(2, "0");
    const day = dotSeparatedMatch[2].padStart(2, "0");
    const yearSuffix = parseInt(dotSeparatedMatch[3], 10);
    const year = yearSuffix >= 70 ? 1900 + yearSuffix : 2000 + yearSuffix;
    return `${year}-${month}-${day}`;
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return toISODate(new Date(parsed));
  }

  return null;
};


const getSerpApiSourceName = (rawSource: any) => {
  if (!rawSource) return "";
  if (typeof rawSource === "string") return cleanSourceName(rawSource);
  if (typeof rawSource === "object") {
    return cleanSourceName(rawSource.name || rawSource.publisher || rawSource.title || "");
  }
  return "";
};

const normalizeSerpApiDate = (item: any): string | null => {
  const dateUtc = item?.date_utc;
  if (dateUtc) {
    const parsed = Date.parse(dateUtc);
    if (!Number.isNaN(parsed)) {
      return toISODate(new Date(parsed));
    }
  }
  return normalizeArticleDate(item?.date || item?.published_date || item?.time);
};

const fetchNewsFromSerpApi = async (dateStr?: string): Promise<Omit<NewsArticle, 'id' | 'summary' | 'text'>[]> => {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.warn("SERPAPI_KEY is not defined. Skipping SerpApi fetch.");
    return [];
  }

  const query = new URLSearchParams({
    engine: "google_news",
    q: '"artificial intelligence" OR "AI"',
    hl: "en",
    gl: "us",
    num: String(SERPAPI_MAX_RESULTS),
    sbd: "1",
    api_key: apiKey,
  });

  try {
    const response = await fetch(`${SERPAPI_NEWS_SEARCH_URL}?${query.toString()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`SerpApi error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    const rawResults = Array.isArray(data?.news_results) ? data.news_results : [];

    const normalizedResults = rawResults.map((item: any) => {
      const source = getSerpApiSourceName(item?.source) || "Unknown";
      const normalizedDate = normalizeSerpApiDate(item);
      return {
        title: stripSourceFromTitle(item?.title || "Untitled", source),
        url: item?.link || item?.url || "",
        source,
        date: normalizedDate || item?.date || "",
        imageUrl: item?.thumbnail || item?.image,
        normalizedDate,
      };
    }).filter((entry) => !!entry.url);

    const filteredResults = dateStr
      ? normalizedResults.filter((entry) => entry.normalizedDate === dateStr)
      : normalizedResults;

    return filteredResults.slice(0, 15).map(({ normalizedDate, ...article }) => article);
  } catch (error: any) {
    console.error("Error fetching news from SerpApi:", error);
    throw new Error(error?.message || "SerpApi request failed");
  }
};


const fetchNewsFromFutureTools = async (dateStr?: string): Promise<Omit<NewsArticle, 'id' | 'summary' | 'text'>[]> => {
  const targetDate = dateStr || getYesterdayDateStringISO();
  console.log(`Scraping Future Tools for date=${targetDate}`);

  try {
    const response = await fetch(FUTURE_TOOLS_NEWS_URL, {
      cache: "no-store",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; AheadBot/1.0; +https://getahead.ai)",
      },
    });

    if (!response.ok) {
      throw new Error(`Future Tools request failed: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = load(html);
    const articles: Omit<NewsArticle, "id" | "summary" | "text">[] = [];
    const seenUrls = new Set<string>();

    $(".news-listing .news-item").each((_, element) => {
      const container = $(element);
      const dateText = container.find(".text-block-30").first().text().trim();
      const normalizedDate = normalizeFutureToolsDate(dateText);
      if (!normalizedDate || normalizedDate !== targetDate) {
        return;
      }

      const anchor = container.find("a").first();
      const rawUrl = anchor.attr("href")?.trim();
      if (!rawUrl) {
        return;
      }

      let resolvedUrl: string;
      try {
        resolvedUrl = rawUrl.startsWith("http") ? rawUrl : new URL(rawUrl, FUTURE_TOOLS_NEWS_URL).toString();
      } catch (error) {
        console.error("Failed to resolve Future Tools URL", rawUrl, error);
        return;
      }

      if (seenUrls.has(resolvedUrl)) {
        return;
      }
      seenUrls.add(resolvedUrl);

      const title = container.find(".text-block-27").first().text().trim() || "Untitled";
      const sourceRaw = container.find(".text-block-28").first().text().trim();
      const source = cleanSourceName(sourceRaw || "Future Tools") || "Future Tools";

      articles.push({
        title: stripSourceFromTitle(title, source),
        url: resolvedUrl,
        source,
        date: normalizedDate,
        imageUrl: undefined,
      });
    });

    return articles;
  } catch (error) {
    console.error("Error scraping Future Tools articles:", error);
    return [];
  }
};

export async function getArticleHeadlinesAction(dateStr?: string): Promise<Omit<NewsArticle, 'id' | 'summary' | 'text'>[] | { error: string }> {
  try {
    const [serpApiArticles, futureToolsArticles] = await Promise.all([
      fetchNewsFromSerpApi(dateStr).catch(e => {
        console.error("SerpApi fetch failed:", e);
        return [];
      }),
      fetchNewsFromFutureTools(dateStr)
    ]);

    const allArticles = [...serpApiArticles, ...futureToolsArticles];
    
    if (allArticles.length === 0) {
        return { error: "Failed to fetch articles from all sources." };
    }

    return allArticles;
  } catch (error: any) {
    console.error("Error fetching article headlines:", error);
    return { error: error.message };
  }
}

export async function generateArticleOneSentenceSummary(articleText: string): Promise<{ summary?: string, error?: string }> {
  try {
    const result = await ai.generate({
      model: 'googleai/gemini-3-pro-preview',
      prompt: `You are an expert AI news curator for Ahead, a platform that helps mid-career knowledge workers master AI. Your goal is to make complex AI news simple, relevant, and actionable for non-technical professionals who feel pressured and lost with AI.

Given the article text below, write ONE single, clear, and concise sentence that explains the article's main takeaway for the everyday knowledge worker.

The summary **MUST** be:
1.  **Direct and Human:** Conversational, engaging, and sound like a person wrote it—start directly with the insight, avoiding phrases like "This article explains," "The news covers," or "This research shows."
2.  **Jargon-Free:** Written in plain language. If a technical term is absolutely necessary, explain it briefly and simply.
3.  **Action-Oriented/Impact Focused:** Center the summary on the impact or immediate relevance to the user's work, future, or understanding of the AI landscape (i.e., focus on the 'So what?').

**Target Audience Context:** The reader is a non-technical professional (e.g., Marketing Manager, Ops Lead) who is trying to understand how to adopt AI to stay competitive and efficient.

--
**Good Examples:**
* Researchers discovered that you can trick AI chatbots into ignoring their safety rules and answering dangerous questions simply by phrasing your request as a poem.
* New data shows that the rush for businesses to start using AI is beginning to slow down and level off, regardless of how big or small the company is.
* Experts are warning parents to be careful with AI-powered toys this holiday season because they currently lack safety rules and can sometimes have inappropriate or harmful conversations with children.

Article text:
${articleText.slice(0, 3000)}

One-sentence summary:`,
    });

    const summary = result.text?.trim();
    if (!summary) {
      return { error: "Failed to generate summary" };
    }

    return { summary };
  } catch (error: any) {
    console.error("Error generating summary:", error);
    return { error: error.message || "Failed to generate summary" };
  }
}

export async function extractArticleTextAction(
  articleUrl: string
): Promise<{ text?: string; error?: string; imageUrl?: string; title?: string; source?: string; resolvedUrl?: string }> {
  const token = process.env.DIFFBOT_TOKEN;
  if (!token) {
    console.error("Diffbot token is not configured.");
    return { error: "Server configuration error: Diffbot token is missing." };
  }

  const params = new URLSearchParams({
    token,
    url: articleUrl,
    fields: "title,text,siteName,pageUrl,images",
  });

  const diffbotUrl = `https://api.diffbot.com/v3/article?${params.toString()}`;

  try {
    const response = await fetch(diffbotUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Diffbot API error for ${articleUrl}: ${response.status} ${response.statusText}`,
        errorBody
      );
      return { error: `Diffbot API error: ${response.status} - ${errorBody}` };
    }

    const data = await response.json();
    const articleObject = data?.objects?.[0];

    if (!articleObject) {
      return { error: "Diffbot did not return article content." };
    }

    const primaryImage = articleObject.images?.find((img: any) => img.primary);

    return {
      text: articleObject.text || "",
      imageUrl: primaryImage?.url,
      title: articleObject.title || "",
      source: cleanSourceName(articleObject.siteName || articleObject.publisher || ""),
      resolvedUrl: articleObject.pageUrl || articleUrl,
    };
  } catch (error: any) {
    console.error("Error extracting article text via Diffbot:", error);
    return { error: error?.message || "Failed to extract article text." };
  }
}

export async function getAITipAction(
  input: GenerateAITipInput
): Promise<GenerateAITipOutput | { error: string }> {
  try {
    return await generateAITip(input);
  } catch (error: any) {
    console.error("Error generating AI tip:", error);
    return { error: error.message || "Failed to generate AI tip." };
  }
}

export async function transformAiTipAction(rawText: string): Promise<{ tip?: string; error?: string }> {
  const trimmed = rawText?.trim();
  if (!trimmed) {
    return { error: "Please provide some text to transform." };
  }

  const instructions = `You are an expert content writer for Ahead, a platform focused on making AI practical for non-technical knowledge workers. Transform the provided information into a single, concise "Daily AI Tip".

Requirements:
1. <= 300 characters (including spaces).
2. Jargon-free, plain language.
3. Highly actionable with a specific instruction someone can try immediately.
4. Focus on helping the reader feel confident and efficient using AI tools.
5. Keep the tone calm, encouraging, and empowering.

Source material:
"""
${trimmed.slice(0, 4000)}
"""

Respond with only the transformed tip (no preamble, no quotes).`;

  try {
    const result = await ai.generate({
      model: 'googleai/gemini-3-pro-preview',
      prompt: instructions,
    });

    const tip = result.text?.trim();
    if (!tip) {
      return { error: "Gemini returned an empty tip." };
    }

    if (tip.length > 320) {
      return { tip: tip.slice(0, 320).trim() };
    }

    return { tip };
  } catch (error: any) {
    console.error('Error transforming AI tip:', error);
    return { error: error.message || 'Failed to transform AI tip.' };
  }
}

export async function generateEmailAction(
  input: GenerateNewsletterEmailContentInput
): Promise<GenerateNewsletterEmailContentOutput | { error: string }> {
  try {
    return await generateNewsletterEmailContent(input);
  } catch (error: any) {
    console.error("Error generating email content:", error);
    return { error: error.message || "Failed to generate email content." };
  }
}

export async function generateSubjectLineAction(
  input: GenerateSubjectLineInput
): Promise<GenerateSubjectLineOutput | { error: string }> {
  try {
    return await generateSubjectLine(input);
  } catch (error: any)
{
    console.error("Error generating subject line:", error);
    return { error: error.message || "Failed to generate subject line." };
  }
}

export async function generateIntroSentenceAction(
  input: GenerateIntroSentenceInput
): Promise<GenerateIntroSentenceOutput | { error: string }> {
  try {
    return await generateIntroSentence(input);
  } catch (error: any) {
    console.error("Error generating intro sentence:", error);
    return { error: error.message || "Failed to generate intro sentence." };
  }
}


const getProductHuntToken = async () => {
    const { PRODUCT_HUNT_API_KEY, PRODUCT_HUNT_API_SECRET } = process.env;
    if (!PRODUCT_HUNT_API_KEY || !PRODUCT_HUNT_API_SECRET) {
        throw new Error('Product Hunt API credentials are not configured.');
    }
    const response = await fetch('https://api.producthunt.com/v2/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            client_id: PRODUCT_HUNT_API_KEY,
            client_secret: PRODUCT_HUNT_API_SECRET,
            grant_type: 'client_credentials',
        }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error_description || 'Failed to get Product Hunt token.');
    }
    return data.access_token;
}

const getYesterdayDateStringForProductHunt = () => {
    const nowInPT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const yesterdayInPT = new Date(nowInPT);
    yesterdayInPT.setDate(yesterdayInPT.getDate() - 1);
    const year = yesterdayInPT.getFullYear();
    const month = String(yesterdayInPT.getMonth() + 1).padStart(2, '0');
    const day = String(yesterdayInPT.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

type ProductSummaryInput = {
  name: string;
  description?: string;
  url?: string;
};

const generateProductOutcomeSentence = async ({ name, description, url }: ProductSummaryInput): Promise<string | null> => {
  const context = (description?.trim() || "").slice(0, 3000);
  const prompt = `You are an expert copywriter for Ahead. Write one short, highly practical sentence that explains how this product helps a mid-career, non-technical professional. Do NOT mention the product name or brand. Start directly with the outcome or action (e.g., "Helps you...", "Turns..."). Keep it warm, jargon-free, and \<= 25 words.

Product name: ${name}
Product context: ${context || "No description provided."}

Respond with only the sentence.`;

  try {
    const result = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt,
    });

    const summary = result.text?.trim();
    if (!summary) {
      return null;
    }

    return summary.charAt(0).toLowerCase() + summary.slice(1);
  } catch (error) {
    console.error(`Failed to generate product summary for ${name}:`, error);
    return null;
  }
};

const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

export async function getTopAIProductsAction(dateStr?: string): Promise<ProductLaunch[] | { error: string }> {
    const { PRODUCT_HUNT_API_KEY, PRODUCT_HUNT_API_SECRET } = process.env;
    if (!PRODUCT_HUNT_API_KEY || !PRODUCT_HUNT_API_SECRET) {
        console.warn('Product Hunt API credentials are not configured. Skipping product fetch.');
        return [];
    }

    try {
        const token = await getProductHuntToken();
        const targetDate = dateStr || getYesterdayDateStringForProductHunt();
        
        const query = `
            query GetTopPosts {
                posts(postedAfter: "${targetDate}T00:00:00.000Z", postedBefore: "${targetDate}T23:59:59.999Z", order: VOTES, first: 10, topic: "artificial-intelligence") {
                    edges {
                        node {
                            id
                            name
                  tagline
                  description
                            votesCount
                            website
                        }
                    }
                }
            }
        `;

        const response = await fetch('https://api.producthunt.com/v2/api/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                query
            }),
        });

        const data = await response.json();

        if (data.errors) {
            throw new Error(data.errors.map((e: any) => e.message).join(', '));
        }

        if (!data.data || !data.data.posts) {
            console.error("Unexpected Product Hunt API response structure:", data);
            return [];
        }

        const products = data.data.posts.edges.map((edge: any) => {
          const name = (edge.node.name || '').replace(emojiRegex, '').trim();
          const tagline = (edge.node.tagline || '').replace(emojiRegex, '').trim();
          const rawDescription = edge.node.description || '';
          const description = (rawDescription || edge.node.tagline || '').replace(emojiRegex, '').trim();

            return {
                id: edge.node.id,
                name: name,
            description: description,
            tagline: tagline || undefined,
                upvotes: edge.node.votesCount || 0,
                url: (edge.node.website || '').split('?')[0],
            };
        });

        return products;

    } catch (error: any) {
        console.error("Error fetching Product Hunt data:", error);
        return { error: error.message || "Failed to fetch top AI products." };
    }
}

export async function generateProductOutcomeSentenceAction(input: ProductSummaryInput): Promise<{ summary?: string; error?: string }> {
  const summary = await generateProductOutcomeSentence(input);
  if (!summary) {
    return { error: "Failed to generate product summary." };
  }
  return { summary };
}


export async function sendToLoopsAction(
  subject: string,
  introSentence: string,
  content: GenerateNewsletterEmailContentOutput,
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.LOOPS_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Loops API key is not configured.' };
  }

  const subscribers = await getSubscribersAction();
  if ('error' in subscribers) {
     return { success: false, error: subscribers.error };
  }

  const activeSubscribers = subscribers.filter((subscriber) => subscriber.isSubscribed !== false && !!subscriber.email);
  if (activeSubscribers.length === 0) {
    return { success: false, error: "No active subscribers found." };
  }

  const eventProperties = {
    Subject: subject,
    Intro: introSentence,
    Headline1: content.featuredHeadline.headline,
    Headline1Image: content.featuredHeadline.imageUrl || '',
    Headline1Link: content.featuredHeadline.link,
    WhatsHappening: content.featuredHeadline.whatsHappening,
    WhyYouShouldCare: content.featuredHeadline.whyYouShouldCare,
    Headline2: content.headlines[0]?.headline || '',
    Headline2Link: content.headlines[0]?.link || '',
    Headline3: content.headlines[1]?.headline || '',
    Headline3Link: content.headlines[1]?.link || '',
    Headline4: content.headlines[2]?.headline || '',
    Headline4Link: content.headlines[2]?.link || '',
    Headline5: content.headlines[3]?.headline || '',
    Headline5Link: content.headlines[3]?.link || '',
    LaunchName1: content.launches[0]?.name || '',
    LaunchLink1: content.launches[0]?.link || '',
    LaunchSentence1: content.launches[0]?.sentence || '',
    LaunchName2: content.launches[1]?.name || '',
    LaunchLink2: content.launches[1]?.link || '',
    LaunchSentence2: content.launches[1]?.sentence || '',
    LaunchName3: content.launches[2]?.name || '',
    LaunchLink3: content.launches[2]?.link || '',
    LaunchSentence3: content.launches[2]?.sentence || '',
    AheadTip: content.aheadTip,
  };

  console.log("[sendToLoopsAction] Event Properties Payload:", JSON.stringify(eventProperties, null, 2));

  const failedRecipients: { email: string; reason: string }[] = [];

  for (const subscriber of activeSubscribers) {
    try {
      const response = await fetch('https://app.loops.so/api/v1/events/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventName: "sendDailyNewsletter",
          email: subscriber.email,
          firstName: subscriber.name,
          eventProperties: {
            ...eventProperties,
            RecipientName: subscriber.name || '',
          },
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to send event to Loops';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          console.error(`[sendToLoopsAction] Loops API Error for ${subscriber.email}:`, errorData);
        } catch (parseError) {
          // Ignore JSON parsing errors and fall back to default message
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      console.log(`[sendToLoopsAction] Success for ${subscriber.email}:`, responseData);

      if (!responseData?.success) {
        throw new Error('Loops API responded without success flag.');
      }
    } catch (error: any) {
      console.error(`Error sending to Loops for ${subscriber.email}:`, error);
      failedRecipients.push({ email: subscriber.email, reason: error.message || 'Unknown error' });
    }
  }

  if (failedRecipients.length === activeSubscribers.length) {
    const reasons = failedRecipients.slice(0, 3).map((entry) => `${entry.email}: ${entry.reason}`).join('; ');
    return { success: false, error: `Failed to send newsletter to all subscribers. ${reasons}` };
  }

  if (failedRecipients.length > 0) {
    const reasons = failedRecipients.slice(0, 3).map((entry) => `${entry.email}: ${entry.reason}`).join('; ');
    return { success: false, error: `Sent newsletter to ${activeSubscribers.length - failedRecipients.length} subscribers, but ${failedRecipients.length} failed. ${reasons}` };
  }

  return { success: true };
}

export async function sendTestEmailAction(
  subject: string,
  introSentence: string,
  content: GenerateNewsletterEmailContentOutput,
  recipientEmail: string = "joshua@jumpahead.ai"
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.LOOPS_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Loops API key is not configured.' };
  }

  const eventProperties = {
    Subject: subject,
    Intro: introSentence,
    Headline1: content.featuredHeadline.headline,
    Headline1Image: content.featuredHeadline.imageUrl || '',
    Headline1Link: content.featuredHeadline.link,
    WhatsHappening: content.featuredHeadline.whatsHappening,
    WhyYouShouldCare: content.featuredHeadline.whyYouShouldCare,
    Headline2: content.headlines[0]?.headline || '',
    Headline2Link: content.headlines[0]?.link || '',
    Headline3: content.headlines[1]?.headline || '',
    Headline3Link: content.headlines[1]?.link || '',
    Headline4: content.headlines[2]?.headline || '',
    Headline4Link: content.headlines[2]?.link || '',
    Headline5: content.headlines[3]?.headline || '',
    Headline5Link: content.headlines[3]?.link || '',
    LaunchName1: content.launches[0]?.name || '',
    LaunchLink1: content.launches[0]?.link || '',
    LaunchSentence1: content.launches[0]?.sentence || '',
    LaunchName2: content.launches[1]?.name || '',
    LaunchLink2: content.launches[1]?.link || '',
    LaunchSentence2: content.launches[1]?.sentence || '',
    LaunchName3: content.launches[2]?.name || '',
    LaunchLink3: content.launches[2]?.link || '',
    LaunchSentence3: content.launches[2]?.sentence || '',
    AheadTip: content.aheadTip,
  };

  try {
    const response = await fetch('https://app.loops.so/api/v1/events/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventName: "sendDailyNewsletter",
        email: recipientEmail,
        firstName: "Test User",
        eventProperties: {
          ...eventProperties,
          RecipientName: "Test User",
        },
      }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to send test email to Loops';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
        console.error(`[sendTestEmailAction] Loops API Error for ${recipientEmail}:`, errorData);
      } catch (parseError) {
        // Ignore JSON parsing errors
      }
      return { success: false, error: errorMessage };
    }

    const responseData = await response.json();
    if (!responseData?.success) {
      return { success: false, error: 'Loops API responded without success flag.' };
    }

    return { success: true };
  } catch (error: any) {
    console.error(`Error sending test email to ${recipientEmail}:`, error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export async function addSubscriberAction({ email, name }: { email: string, name: string }): Promise<{ success: boolean; error?: string }> {
  try {
    const subscribersCollection = collection(db, 'newsletterSubscribers');
    await addDoc(subscribersCollection, {
      email,
      name,
      isSubscribed: true,
      subscribedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    console.error("Error adding subscriber:", error);
    return { success: false, error: error.message || "Failed to add subscriber." };
  }
}

export async function getSubscribersAction(): Promise<{ email: string; name: string; isSubscribed: boolean; subscribedAt: string | null }[] | { error: string }> {
  try {
    const subscribersCollection = collection(db, 'newsletterSubscribers');
    const snapshot = await getDocs(subscribersCollection);
    const subscribers = snapshot.docs.map(doc => {
      const data = doc.data();
      const subscribedAt = data.subscribedAt;
      return { 
        email: data.email, 
        name: data.name,
        isSubscribed: data.isSubscribed,
        subscribedAt: subscribedAt ? (subscribedAt as Timestamp).toDate().toISOString() : null,
      };
    });
    return subscribers;
  } catch (error: any) {
    console.error("Error fetching subscribers:", error);
    return { error: error.message || "Failed to fetch subscribers." };
  }
}
