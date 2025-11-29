
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLogo } from "@/components/icons";
import NewsSelection from "@/components/news-selection";
import ProductsSelection from "@/components/products-selection";
import AiTipSection from "@/components/ai-tip-section";
import { Button } from "@/components/ui/button";
import type { NewsArticle, ProductLaunch } from "@/lib/data";
import { getTopAIProductsAction } from "../actions";
import { useToast } from "@/hooks/use-toast";
import { buildApiPath, getBasePath, withBasePath } from "@/lib/base-path";

export default function Home() {
  const router = useRouter();
  const { toast } = useToast();
  const [basePath, setBasePath] = useState<string>(() => getBasePath());
  
  const getYesterdayDateStringISO = () => {
    const nowInPT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const yesterdayInPT = new Date(nowInPT);
    yesterdayInPT.setDate(yesterdayInPT.getDate() - 1);
    
    const year = yesterdayInPT.getFullYear();
    const month = String(yesterdayInPT.getMonth() + 1).padStart(2, '0');
    const day = String(yesterdayInPT.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  const getTodayDateStringISO = () => {
    const nowInPT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const year = nowInPT.getFullYear();
    const month = String(nowInPT.getMonth() + 1).padStart(2, '0');
    const day = String(nowInPT.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [displayedArticles, setDisplayedArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(getYesterdayDateStringISO());
  const [maxDate] = useState<string>(getTodayDateStringISO());
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const [products, setProducts] = useState<ProductLaunch[]>([]);
  const [selectedProductDate, setSelectedProductDate] = useState<string>(getYesterdayDateStringISO());
  const [productFetchTrigger, setProductFetchTrigger] = useState(0);
  
  const [selectedArticles, setSelectedArticles] = useState<NewsArticle[]>([]);
  const [featuredArticle, setFeaturedArticle] = useState<NewsArticle | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<ProductLaunch[]>([]);
  const [selectedTip, setSelectedTip] = useState<string>("");

  const handleArticleSummaryUpdate = useCallback((articleId: number, summary: string) => {
    const normalized = (summary || "").trim();
    setDisplayedArticles(prev => prev.map(article => article.id === articleId ? { ...article, summary: normalized } : article));
    setSelectedArticles(prev => prev.map(article => article.id === articleId ? { ...article, summary: normalized } : article));
    setFeaturedArticle(prev => {
      if (prev?.id === articleId) {
        return { ...prev, summary: normalized };
      }
      return prev;
    });
  }, [setDisplayedArticles, setSelectedArticles, setFeaturedArticle]);

  const handleProductSummaryUpdate = useCallback((productId: string, summary: string) => {
    const normalized = (summary || "").trim();
    setProducts(prev => prev.map(product => product.id === productId ? { ...product, summary: normalized } : product));
    setSelectedProducts(prev => prev.map(product => product.id === productId ? { ...product, summary: normalized } : product));
  }, [setProducts, setSelectedProducts]);
  
  const areAllRequirementsMet = 
    selectedArticles.length === 5 &&
    featuredArticle !== null &&
    selectedProducts.length === 3 &&
    selectedTip !== "";

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setFetchTrigger(prev => prev + 1);
  };

  const handleProductDateChange = (date: string) => {
    setSelectedProductDate(date);
    setProductFetchTrigger(prev => prev + 1);
  };

  const handleAddArticle = (article: Omit<NewsArticle, 'id'>) => {
    setDisplayedArticles(prev => {
      const nextId = prev.length > 0 ? Math.max(...prev.map(a => a.id)) + 1 : 0;
      const newArticle: NewsArticle = {
        id: nextId,
        ...article,
      };
      return [newArticle, ...prev];
    });
  };

  useEffect(() => {
    const resolved = getBasePath();
    if (resolved !== basePath) {
      setBasePath(resolved);
    }
  }, [basePath]);

  // Effect to fetch initial data for products and quick headlines
  useEffect(() => {
    async function fetchInitialData() {
      setIsLoading(true);
      setDisplayedArticles([]); // Clear articles to show loading state
      const runtimeBasePath = getBasePath();
      const articlesUrl = selectedDate
        ? buildApiPath(`/api/articles?date=${selectedDate}`, runtimeBasePath)
        : buildApiPath("/api/articles", runtimeBasePath);
      const headlinesPromise = fetch(articlesUrl, { cache: "no-store" })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            return { error: data.error || "Failed to fetch headlines" };
          }
          return data;
        })
        .catch((error) => ({ error: error.message }));
      const headlinesResult = await headlinesPromise;

      if ('error' in headlinesResult) {
        toast({ variant: "destructive", title: "Failed to fetch headlines", description: headlinesResult.error });
         setDisplayedArticles([]);
      } else {
        const articlesWithIds = headlinesResult.map((article, index) => ({
            ...article,
            id: index,
            summary: ``, // No summary initially
        }));
        setDisplayedArticles(articlesWithIds);
      }
      setIsLoading(false);
    }
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, selectedDate, fetchTrigger]);

  useEffect(() => {
    async function fetchProductsData() {
      const productsResult = await getTopAIProductsAction(selectedProductDate);
      if ('error' in productsResult) {
        toast({ variant: "destructive", title: "Failed to fetch products", description: productsResult.error });
      } else {
        setProducts(productsResult);
      }
    }

    fetchProductsData();
  }, [toast, selectedProductDate, productFetchTrigger]);
  
  
  const handleSelect = (article: NewsArticle) => {
    const isSelected = selectedArticles.some(a => a.id === article.id);

    let newSelection: NewsArticle[];

    if (isSelected) {
      newSelection = selectedArticles.filter(a => a.id !== article.id);
    } else {
      if (selectedArticles.length < 5) {
        newSelection = [...selectedArticles, article];
      } else {
        return; 
      }
    }
    setSelectedArticles(newSelection);
  };


  useEffect(() => {
    const storedSelections = localStorage.getItem("newsletterSelections");
    if (storedSelections) {
      try {
        const parsed = JSON.parse(storedSelections);
        // Only restore selections if the articles are present
        if (parsed.selectedArticles && displayedArticles.length > 0) {
            const availableArticles = parsed.selectedArticles.filter((sa: NewsArticle) => displayedArticles.some(da => da.id === sa.id));
            if (availableArticles.length > 0) {
              setDisplayedArticles(prev => {
                let changed = false;
                const updated = prev.map(article => {
                  const stored = availableArticles.find((sa: NewsArticle) => sa.id === article.id);
                  if (stored?.summary && stored.summary !== article.summary) {
                    changed = true;
                    return { ...article, summary: stored.summary };
                  }
                  return article;
                });
                return changed ? updated : prev;
              });
            }
            setSelectedArticles(availableArticles);
        }
        if (parsed.selectedProducts) setSelectedProducts(parsed.selectedProducts);
        if (parsed.selectedTip) setSelectedTip(parsed.selectedTip);
        if (parsed.featuredArticle) setFeaturedArticle(parsed.featuredArticle);
      } catch (e) {
        console.error("Failed to parse newsletter selections from localStorage", e);
        localStorage.removeItem("newsletterSelections");
      }
    }
  }, [displayedArticles]);

  useEffect(() => {
    // Filter out articles that might have been removed from displayedArticles
    const availableSelectedArticles = selectedArticles.filter(sa => displayedArticles.some(da => da.id === sa.id));

    const selectionData = {
      selectedArticles: availableSelectedArticles,
      featuredArticle,
      selectedProducts,
      selectedTip,
    };
    if (availableSelectedArticles.length > 0 || selectedProducts.length > 0 || selectedTip) {
        localStorage.setItem("newsletterSelections", JSON.stringify(selectionData));
    } else {
        localStorage.removeItem("newsletterSelections");
    }
  }, [selectedArticles, featuredArticle, selectedProducts, selectedTip, displayedArticles]);
  
  useEffect(() => {
    if (selectedArticles.length > 0 && (!featuredArticle || !selectedArticles.find(a => a.id === featuredArticle.id))) {
      setFeaturedArticle(selectedArticles[0]);
    } else if (selectedArticles.length === 0) {
      setFeaturedArticle(null);
    }
  }, [selectedArticles, featuredArticle]);

  const handleNext = () => {
    if (!areAllRequirementsMet) {
      toast({
        variant: "destructive",
        title: "Selections incomplete",
        description: "Choose 5 news stories, 3 products, and an AI tip to continue.",
      });
      return;
    }
    router.push(withBasePath("/refine", getBasePath()));
  };

  return (
    <div className="bg-secondary min-h-screen">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AppLogo className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground font-headline">
              The Daily Get Ahead Newsroom
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" asChild>
              <Link href={withBasePath("/subscribers", basePath)}>Subscribers</Link>
            </Button>
            <Button disabled={!areAllRequirementsMet} onClick={handleNext}>
                Next
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="space-y-8 max-w-4xl mx-auto">
          <NewsSelection 
            articles={displayedArticles}
            selectedArticles={selectedArticles}
            setSelectedArticles={handleSelect}
            featuredArticle={featuredArticle}
            isLoading={isLoading && displayedArticles.length === 0}
            onReloadArticle={() => {}}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            maxDate={maxDate}
            onAddArticle={handleAddArticle}
            onArticleSummaryUpdate={handleArticleSummaryUpdate}
          />
          <ProductsSelection 
            products={products}
            selectedProducts={selectedProducts}
            setSelectedProducts={setSelectedProducts}
            selectedDate={selectedProductDate}
            onDateChange={handleProductDateChange}
            maxDate={maxDate}
            onProductSummaryUpdate={handleProductSummaryUpdate}
          />
          <AiTipSection 
            selectedTip={selectedTip}
            setSelectedTip={setSelectedTip}
          />
        </div>
      </main>
    </div>
  );
}
