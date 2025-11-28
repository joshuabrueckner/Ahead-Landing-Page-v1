
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
import { getJson } from "serpapi";


const getYesterdayDateString = () => {
    const nowInPT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const yesterdayInPT = new Date(nowInPT);
    yesterdayInPT.setDate(yesterdayInPT.getDate() - 1);
    
    const year = yesterdayInPT.getFullYear();
    const month = String(yesterdayInPT.getMonth() + 1).padStart(2, '0');
    const day = String(yesterdayInPT.getDate()).padStart(2, '0');
    
    return `${month}/${day}/${year}`;
};


const fetchNewsFromSerpApi = async (): Promise<Omit<NewsArticle, 'id' | 'summary' | 'text'>[]> => {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_KEY is not defined.");
  }

  const yesterday = getYesterdayDateString();

  try {
    const response = await getJson({
      engine: "google_news",
      q: "AI",
      api_key: apiKey,
      // Using tbs=qdr:d for "past day" and since we run this early morning PT, it aligns with "yesterday"
      tbs: "qdr:d,sbd:1",
      num: "15"
    });

    const newsResults = response.news_results;

    if (!newsResults || newsResults.length === 0) {
      return [];
    }

    return newsResults.map((article: any) => ({
      title: article.title,
      url: article.link,
      source: article.source,
      date: article.date,
      imageUrl: article.thumbnail,
    })).slice(0, 15);
  } catch (error: any) {
    console.error("Error fetching news from SerpApi:", error.message);
    throw new Error(`SerpApi request failed: ${error.message}`);
  }
};

export async function getArticleHeadlinesAction(): Promise<Omit<NewsArticle, 'id' | 'summary' | 'text'>[] | { error: string }> {
  try {
    const articles = await fetchNewsFromSerpApi();
    return articles;
  } catch (error: any) {
    console.error("Error fetching article headlines:", error);
    return { error: error.message };
  }
}

export async function generateArticleOneSentenceSummary(articleText: string): Promise<{ summary?: string, error?: string }> {
  try {
    const result = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp',
      prompt: `You are a helpful assistant that summarizes AI news articles for people who are not fully up-to-speed on all things AI.

Given the article text below, write ONE clear, accessible sentence that explains what this article is about. The summary should:
- Be written in plain language that anyone can understand
- Avoid jargon or explain technical terms simply
- Focus on the main point or takeaway
- Be conversational and human

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

export async function extractArticleTextAction(articleUrl: string): Promise<{ text?: string, error?: string, imageUrl?: string }> {
  const token = process.env.DIFFBOT_TOKEN;
  if (!token) {
    console.error("Diffbot token is not configured.");
    return { error: "Server configuration error: Diffbot token is missing." };
  }

  const params = new URLSearchParams({
    token: token,
    url: articleUrl,
    paging: "false",
    fields: "text,images"
  });

  const diffbotUrl = `https://api.diffbot.com/v3/article?${params.toString()}`;
  
  try {
    const response = await fetch(diffbotUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Diffbot API error for ${articleUrl}: ${response.status} ${response.statusText}`, errorBody);
      return { error: `Diffbot API error: ${response.status} - ${errorBody}` };
    }

    const data = await response.json();
    const articleObject = data?.objects?.[0];

    if (!articleObject) {
      return { error: `No article object found in Diffbot response for ${articleUrl}` };
    }

    const primaryImage = articleObject.images?.find((img: any) => img.primary);

    return { 
      text: articleObject.text || '', 
      imageUrl: primaryImage?.url 
    };

  } catch (error: any) {
    console.error(`Failed to fetch or parse article from Diffbot for ${articleUrl}:`, error);
    return { error: `Request to Diffbot failed: ${error.message}` };
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

const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

export async function getTopAIProductsAction(): Promise<ProductLaunch[] | { error: string }> {
    const { PRODUCT_HUNT_API_KEY, PRODUCT_HUNT_API_SECRET } = process.env;
    if (!PRODUCT_HUNT_API_KEY || !PRODUCT_HUNT_API_SECRET) {
        console.warn('Product Hunt API credentials are not configured. Skipping product fetch.');
        return [];
    }

    try {
        const token = await getProductHuntToken();
        const yesterday = getYesterdayDateStringForProductHunt();
        
        const query = `
            query GetTopPosts {
                posts(postedAfter: "${yesterday}T00:00:00.000Z", postedBefore: "${yesterday}T23:59:59.999Z", order: VOTES, first: 10, topic: "artificial-intelligence") {
                    edges {
                        node {
                            id
                            name
                            tagline
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
            const description = (edge.node.tagline || '').replace(emojiRegex, '').trim();

            return {
                id: edge.node.id,
                name: name,
                description: description, // We'll generate summaries later if needed
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

  if (subscribers.length === 0) {
    return { success: false, error: "No subscribers found." };
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
    // Using transactional endpoint to send to multiple contacts
    const response = await fetch('https://app.loops.so/api/v1/transactional', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionalId: "clzxbx64w0004z86n4p9o7d1u", // Daily Newsletter Transactional ID
        contacts: subscribers.map(s => ({ email: s.email })),
        dataVariables: eventProperties
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send event to Loops');
    }

    const responseData = await response.json();
    return { success: responseData.success };

  } catch (error: any) {
    console.error('Error sending to Loops:', error);
    return { success: false, error: error.message || 'An unknown error occurred.' };
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
