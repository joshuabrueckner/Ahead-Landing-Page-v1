
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
import { getArticleHeadlinesAction, getTopAIProductsAction } from "./actions";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const router = useRouter();
  const { toast } = useToast();
  
  const getYesterdayDateStringISO = () => {
    const nowInPT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const yesterdayInPT = new Date(nowInPT);
    yesterdayInPT.setDate(yesterdayInPT.getDate() - 1);
    
    const year = yesterdayInPT.getFullYear();
    const month = String(yesterdayInPT.getMonth() + 1).padStart(2, '0');
    const day = String(yesterdayInPT.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  const [displayedArticles, setDisplayedArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(getYesterdayDateStringISO());

  const [products, setProducts] = useState<ProductLaunch[]>([]);
  
  const [selectedArticles, setSelectedArticles] = useState<NewsArticle[]>([]);
  const [featuredArticle, setFeaturedArticle] = useState<NewsArticle | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<ProductLaunch[]>([]);
  const [selectedTip, setSelectedTip] = useState<string>("");
  
  const areAllRequirementsMet = 
    selectedArticles.length === 5 &&
    featuredArticle !== null &&
    selectedProducts.length === 3 &&
    selectedTip !== "";

  // Effect to fetch initial data for products and quick headlines
  useEffect(() => {
    async function fetchInitialData() {
      setIsLoading(true);
      setDisplayedArticles([]); // Clear articles to show loading state
      
      const headlinesPromise = getArticleHeadlinesAction(selectedDate);
      const productsPromise = getTopAIProductsAction();

      const [headlinesResult, productsResult] = await Promise.all([headlinesPromise, productsPromise]);

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

      if ('error' in productsResult) {
        toast({ variant: "destructive", title: "Failed to fetch products", description: productsResult.error });
      } else {
        setProducts(productsResult);
      }
      setIsLoading(false);
    }
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, selectedDate]);
  
  
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
    // Temporarily disable as processing is removed
    // router.push("/refine");
    toast({
        title: "Feature In Progress",
        description: "Article processing is being rebuilt.",
    });
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
                <Link href="/subscribers">Subscribers</Link>
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
            onDateChange={setSelectedDate}
          />
          <ProductsSelection 
            products={products}
            selectedProducts={selectedProducts}
            setSelectedProducts={setSelectedProducts}
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
