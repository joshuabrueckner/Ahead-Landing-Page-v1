
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
import {
  generateProductSummary,
  GenerateProductSummaryInput,
} from "@/ai/flows/generate-product-summary";
import type { NewsArticle, ProductLaunch } from "@/lib/data";
import { db } from "@/firebase/index";
import { collection, addDoc, getDocs, serverTimestamp, Timestamp } from "firebase/firestore";
import { ai } from "@/ai/genkit";
import { load } from "cheerio";

const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}]/gu;

// Loops API has a limit on the length of event property values (typically ~1000 chars)
const LOOPS_MAX_PROPERTY_LENGTH = 1000;
const truncateForLoops = (text: string, maxLength: number = LOOPS_MAX_PROPERTY_LENGTH): string => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

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
      model: 'googleai/gemini-2.0-flash',
      prompt: `Summarize this AI news article in ONE short sentence for non-technical professionals.

RULES:
- ONE sentence only, very concise (about 15-20 words max)
- Include a key company name, person, or statistic
- Start directly with the insight (no "This article..." or "The news...")
- Plain language, no jargon
- Focus on why it matters

ARTICLE:
${articleText.slice(0, 5000)}

Write ONLY the summary sentence:`,
      config: {
        temperature: 0.3,
        maxOutputTokens: 50,
      },
    });
    
    let summary = result.text?.trim() || '';
    if (!summary) {
      return { error: "Failed to generate summary" };
    }

    // Clean up the response
    summary = summary.replace(/^["']|["']$/g, '').trim();
    summary = summary.replace(/^(Summary:|Here's|Here is|The summary:)\s*/i, '').trim();
    
    // STRICTLY enforce 150 character max
    if (summary.length > 150) {
      let truncated = summary.slice(0, 147);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > 80) {
        summary = truncated.slice(0, lastSpace) + '...';
      } else {
        summary = truncated + '...';
      }
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
      model: 'googleai/gemini-2.0-flash',
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
  try {
    const result = await generateProductSummary({
      name: input.name,
      description: (input.description?.trim() || "").slice(0, 3000),
    });
    if (!result.summary) {
      return { error: "Failed to generate product summary." };
    }
    return { summary: result.summary.charAt(0).toLowerCase() + result.summary.slice(1) };
  } catch (error: any) {
    console.error(`Failed to generate product summary for ${input.name}:`, error);
    return { error: error.message || "Failed to generate product summary." };
  }
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
    Subject: truncateForLoops(subject),
    Intro: truncateForLoops(introSentence),
    Headline1: truncateForLoops(content.featuredHeadline.headline),
    Headline1Image: content.featuredHeadline.imageUrl || '',
    Headline1Link: content.featuredHeadline.link,
    WhatsHappening: truncateForLoops(content.featuredHeadline.whatsHappening),
    WhyYouShouldCare: truncateForLoops(content.featuredHeadline.whyYouShouldCare),
    Headline2: truncateForLoops(content.headlines[0]?.headline || ''),
    Headline2Link: content.headlines[0]?.link || '',
    Headline3: truncateForLoops(content.headlines[1]?.headline || ''),
    Headline3Link: content.headlines[1]?.link || '',
    Headline4: truncateForLoops(content.headlines[2]?.headline || ''),
    Headline4Link: content.headlines[2]?.link || '',
    Headline5: truncateForLoops(content.headlines[3]?.headline || ''),
    Headline5Link: content.headlines[3]?.link || '',
    LaunchName1: truncateForLoops(content.launches[0]?.name || ''),
    LaunchLink1: content.launches[0]?.link || '',
    LaunchSentence1: truncateForLoops(content.launches[0]?.sentence || ''),
    LaunchName2: truncateForLoops(content.launches[1]?.name || ''),
    LaunchLink2: content.launches[1]?.link || '',
    LaunchSentence2: truncateForLoops(content.launches[1]?.sentence || ''),
    LaunchName3: truncateForLoops(content.launches[2]?.name || ''),
    LaunchLink3: content.launches[2]?.link || '',
    LaunchSentence3: truncateForLoops(content.launches[2]?.sentence || ''),
    AheadTip: truncateForLoops(content.aheadTip),
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
    Subject: truncateForLoops(subject),
    Intro: truncateForLoops(introSentence),
    Headline1: truncateForLoops(content.featuredHeadline.headline),
    Headline1Image: content.featuredHeadline.imageUrl || '',
    Headline1Link: content.featuredHeadline.link,
    WhatsHappening: truncateForLoops(content.featuredHeadline.whatsHappening),
    WhyYouShouldCare: truncateForLoops(content.featuredHeadline.whyYouShouldCare),
    Headline2: truncateForLoops(content.headlines[0]?.headline || ''),
    Headline2Link: content.headlines[0]?.link || '',
    Headline3: truncateForLoops(content.headlines[1]?.headline || ''),
    Headline3Link: content.headlines[1]?.link || '',
    Headline4: truncateForLoops(content.headlines[2]?.headline || ''),
    Headline4Link: content.headlines[2]?.link || '',
    Headline5: truncateForLoops(content.headlines[3]?.headline || ''),
    Headline5Link: content.headlines[3]?.link || '',
    LaunchName1: truncateForLoops(content.launches[0]?.name || ''),
    LaunchLink1: content.launches[0]?.link || '',
    LaunchSentence1: truncateForLoops(content.launches[0]?.sentence || ''),
    LaunchName2: truncateForLoops(content.launches[1]?.name || ''),
    LaunchLink2: content.launches[1]?.link || '',
    LaunchSentence2: truncateForLoops(content.launches[1]?.sentence || ''),
    LaunchName3: truncateForLoops(content.launches[2]?.name || ''),
    LaunchLink3: content.launches[2]?.link || '',
    LaunchSentence3: truncateForLoops(content.launches[2]?.sentence || ''),
    AheadTip: truncateForLoops(content.aheadTip),
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

export type AnalyticsDataPoint = {
  date: string;
  visitors: number;
  pageViews: number;
};

export async function getGoogleAnalyticsDataAction(
  startDate: string,
  endDate: string
): Promise<AnalyticsDataPoint[] | { error: string }> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const clientEmail = process.env.GA4_CLIENT_EMAIL;
  const privateKey = process.env.GA4_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!propertyId || !clientEmail || !privateKey) {
    console.error("Google Analytics credentials are not configured.");
    return { error: "Google Analytics is not configured. Please set GA4_PROPERTY_ID, GA4_CLIENT_EMAIL, and GA4_PRIVATE_KEY environment variables." };
  }

  try {
    // Create JWT for authentication
    const now = Math.floor(Date.now() / 1000);
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };
    const payload = {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };

    // Base64url encode
    const base64urlEncode = (obj: object) => {
      const json = JSON.stringify(obj);
      const base64 = Buffer.from(json).toString('base64');
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };

    const headerEncoded = base64urlEncode(header);
    const payloadEncoded = base64urlEncode(payload);
    const signatureInput = `${headerEncoded}.${payloadEncoded}`;

    // Sign with private key
    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(privateKey, 'base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    const jwt = `${signatureInput}.${signature}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Failed to get access token:", errorData);
      return { error: "Failed to authenticate with Google Analytics." };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch analytics data
    const analyticsResponse = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'date' }],
          metrics: [
            { name: 'totalUsers' },
            { name: 'screenPageViews' },
          ],
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        }),
      }
    );

    if (!analyticsResponse.ok) {
      const errorData = await analyticsResponse.text();
      console.error("Failed to fetch analytics data:", errorData);
      return { error: "Failed to fetch analytics data from Google Analytics." };
    }

    const analyticsData = await analyticsResponse.json();
    
    if (!analyticsData.rows || analyticsData.rows.length === 0) {
      return [];
    }

    const dataPoints: AnalyticsDataPoint[] = analyticsData.rows.map((row: any) => {
      const dateStr = row.dimensionValues[0].value; // Format: YYYYMMDD
      const formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      return {
        date: formattedDate,
        visitors: parseInt(row.metricValues[0].value, 10) || 0,
        pageViews: parseInt(row.metricValues[1].value, 10) || 0,
      };
    });

    return dataPoints;
  } catch (error: any) {
    console.error("Error fetching Google Analytics data:", error);
    return { error: error.message || "Failed to fetch Google Analytics data." };
  }
}

// =====================
// Article Storage Actions
// =====================

export async function storeArticleAction(article: { 
  title: string; 
  url: string; 
  source: string; 
  date: string; 
  summary?: string; 
  imageUrl?: string; 
  text?: string;
}): Promise<{ success: boolean; docId?: string; error?: string }> {
  console.log("storeArticleAction called with:", { title: article.title, url: article.url, source: article.source, date: article.date });
  try {
    const articlesCollection = collection(db, 'newsArticles');
    console.log("Got articles collection reference");
    
    // Check for duplicate by URL
    const existingQuery = await getDocs(articlesCollection);
    console.log("Checked for duplicates, found", existingQuery.docs.length, "existing docs");
    const isDuplicate = existingQuery.docs.some(doc => doc.data().url === article.url);
    
    if (isDuplicate) {
      console.log("Article already exists, skipping");
      return { success: false, error: 'Article already exists' };
    }

    // Required fields
    const docData: Record<string, any> = {
      title: article.title,
      url: article.url,
      source: article.source,
      date: article.date,
      titleLower: article.title.toLowerCase(),
      extractedAt: serverTimestamp(),
    };

    // Optional fields - only add if they have values
    if (article.summary) docData.summary = article.summary;
    if (article.imageUrl) docData.imageUrl = article.imageUrl;
    if (article.text) docData.text = article.text;

    console.log("About to add doc with data:", { ...docData, text: docData.text ? "[text present]" : undefined });
    const docRef = await addDoc(articlesCollection, docData);
    console.log("Doc added successfully with ID:", docRef.id);
    
    return { success: true, docId: docRef.id };
  } catch (error: any) {
    console.error("Error storing article:", error);
    return { success: false, error: error.message || "Failed to store article." };
  }
}

export async function searchArticlesAction(searchQuery: string): Promise<{ id: string; title: string; url: string; source: string; date: string; summary?: string; imageUrl?: string }[] | { error: string }> {
  try {
    const articlesCollection = collection(db, 'newsArticles');
    const snapshot = await getDocs(articlesCollection);
    
    const searchLower = searchQuery.toLowerCase();
    const articles = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as { id: string; title: string; url: string; source: string; date: string; titleLower?: string; summary?: string; imageUrl?: string }))
      .filter(article => 
        article.titleLower?.includes(searchLower) || 
        article.summary?.toLowerCase().includes(searchLower) ||
        article.source?.toLowerCase().includes(searchLower)
      );
    
    return articles;
  } catch (error: any) {
    console.error("Error searching articles:", error);
    return { error: error.message || "Failed to search articles." };
  }
}
