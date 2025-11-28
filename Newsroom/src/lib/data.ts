
export type NewsArticle = {
  id: number;
  title: string;
  summary: string;
  url: string;
  source: string;
  imageUrl?: string;
  text?: string;
  date?: string;
};

export type ProductLaunch = {
  id: string; // From Algolia objectID
  name: string;
  description: string;
  tagline?: string;
  url: string;
  upvotes: number;
  summary?: string;
};

// This is now just initial data for products, news is fetched from AI.
export const productLaunches: ProductLaunch[] = [];
