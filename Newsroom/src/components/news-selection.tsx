
"use client";

import { useState, useEffect, useRef } from "react";
import type { NewsArticle } from "@/lib/data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader, Newspaper, PlusCircle, Text, RefreshCw } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import { extractArticleTextAction, generateArticleOneSentenceSummary } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "./ui/scroll-area";

const MAX_SELECTIONS = 5;
const CONCURRENT_EXTRACTIONS = 1;
const EXTRACTION_DELAY = 15000; // 15 second delay to respect Diffbot rate limit of 0.08 calls/sec

type ExtractionResult = {
  text: string;
  isExtracting: boolean;
};

// Global extraction queue manager
class ExtractionQueue {
  private queue: Array<{ url: string; callback: (text: string, summary: string) => void }> = [];
  private processing = false;

  async add(url: string, callback: (text: string, summary: string) => void) {
    this.queue.push({ url, callback });
    this.processQueue();
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;

      try {
        // Extract article text
        const result = await extractArticleTextAction(item.url);
        let text = "";
        let summary = "";

        if (result.error) {
          console.error("Auto-extraction failed:", result.error);
          text = "Failed to extract article text.";
          summary = "";
        } else {
          text = result.text || "No text was extracted.";
          console.log('Extracted text length:', text.length);
          
          // Generate summary from the extracted text
          if (text && text !== "No text was extracted." && text !== "Failed to extract article text.") {
            console.log('Generating summary for:', item.url);
            const summaryResult = await generateArticleOneSentenceSummary(text);
            if (summaryResult.error) {
              console.error("Summary generation failed:", summaryResult.error);
              summary = "";
            } else {
              summary = summaryResult.summary || "";
              console.log('Generated summary:', summary);
            }
          }
        }

        item.callback(text, summary);
      } catch (error) {
        console.error("Extraction error:", error);
        item.callback("Failed to extract article text.", "");
      }

      // Wait before processing next article
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, EXTRACTION_DELAY));
      }
    }

    this.processing = false;
  }
}

const extractionQueue = new ExtractionQueue();

type NewsSelectionProps = {
  articles: NewsArticle[];
  selectedArticles: NewsArticle[];
  setSelectedArticles: (article: NewsArticle) => void;
  featuredArticle: NewsArticle | null;
  isLoading: boolean;
  onReloadArticle: (article: NewsArticle) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  maxDate: string;
  onAddArticle: (article: Omit<NewsArticle, 'id'>) => void;
};

const ArticleItem = ({ 
    article, 
    isSelected, 
    isFeatured, 
    onSelect, 
    isSelectionDisabled, 
    selectionIndex,
    shouldExtract
}: { 
    article: NewsArticle, 
    isSelected: boolean,
    isFeatured: boolean,
    onSelect: (article: NewsArticle) => void,
    isSelectionDisabled: boolean
    selectionIndex: number;
    shouldExtract: boolean;
}) => {
    const sourceName = typeof article.source === 'object' && article.source !== null ? (article.source as any).name : article.source;
    const { toast } = useToast();
    const [extractedText, setExtractedText] = useState("");
    const [summary, setSummary] = useState("");
    const [isExtracting, setIsExtracting] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [isTextDialogOpen, setIsTextDialogOpen] = useState(false);
    const [hasBeenQueued, setHasBeenQueued] = useState(false);
    
    // Auto-extract text and generate summary when shouldExtract becomes true
    useEffect(() => {
        if (shouldExtract && !hasBeenQueued) {
            setHasBeenQueued(true);
            setIsExtracting(true);
            extractionQueue.add(article.url, (text, sum) => {
                console.log('Article processed:', article.title, 'Summary:', sum);
                setExtractedText(text);
                setSummary(sum);
                setIsExtracting(false);
            });
        }
    }, [shouldExtract, article.url, hasBeenQueued]);
    
    const handleShowText = () => {
        setIsTextDialogOpen(true);
    };

    const handleRetryExtraction = () => {
        setIsExtracting(true);
        extractionQueue.add(article.url, (text, sum) => {
            console.log('Article re-processed:', article.title, 'Summary:', sum);
            setExtractedText(text);
            setSummary(sum);
            setIsExtracting(false);
        });
    };

    const handleRegenerateSummary = async () => {
        if (!extractedText) return;
        setIsSummarizing(true);
        try {
            const result = await generateArticleOneSentenceSummary(extractedText);
            if (result.error) {
                console.error("Summary generation failed:", result.error);
                toast({
                    title: "Error",
                    description: "Failed to regenerate summary.",
                    variant: "destructive",
                });
            } else {
                setSummary(result.summary || "");
                toast({
                    title: "Success",
                    description: "Summary regenerated successfully.",
                });
                setIsTextDialogOpen(false);
            }
        } catch (error) {
            console.error("Error regenerating summary:", error);
             toast({
                title: "Error",
                description: "An unexpected error occurred.",
                variant: "destructive",
            });
        } finally {
            setIsSummarizing(false);
        }
    };

    return (
        <div className={cn(
          "p-2 transition-colors", 
          isFeatured && "bg-secondary rounded-lg"
        )}>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-4 flex-shrink-0 pt-1">
                    <span className="text-muted-foreground font-bold w-5 text-center">
                        {isSelected ? `${selectionIndex + 1}.` : ''}
                    </span>
                    <Checkbox
                      id={`article-select-${article.id}`}
                      checked={isSelected}
                      onCheckedChange={() => onSelect(article)}
                      disabled={isSelectionDisabled}
                    />
                </div>
                <div className="flex-grow min-w-0">
                    <label htmlFor={`article-select-${article.id}`} className={cn("font-semibold text-foreground hover:text-primary cursor-pointer leading-tight", isSelectionDisabled && 'cursor-not-allowed')}>
                        {article.title}
                    </label>
                    {summary && !isExtracting && (
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{summary}</p>
                    )}
                    <div className="text-xs text-muted-foreground/80 flex items-center gap-2 mt-1">
                        <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-primary">{sourceName}</a>
                    </div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleRetryExtraction} 
                        disabled={isExtracting} 
                        title="Retry Extraction"
                        className="h-8 w-8"
                    >
                        <RefreshCw className={cn("h-4 w-4", isExtracting && "animate-spin")} />
                    </Button>
                    <Dialog open={isTextDialogOpen} onOpenChange={setIsTextDialogOpen}>
                        <Button variant="outline" size="sm" onClick={handleShowText} disabled={isExtracting}>
                            {isExtracting ? <Loader className="h-4 w-4 animate-spin" /> : <Text className="h-4 w-4" />}
                        </Button>
                        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                            <DialogHeader>
                                <DialogTitle>Extracted Article Text</DialogTitle>
                            </DialogHeader>
                            <div className="flex-grow py-4">
                               <Textarea 
                                value={extractedText} 
                                onChange={(e) => setExtractedText(e.target.value)} 
                                className="h-full resize-none font-mono text-sm"
                                placeholder="Article text will appear here..."
                               />
                            </div>
                            <DialogFooter>
                                <Button onClick={handleRegenerateSummary} disabled={isSummarizing || !extractedText}>
                                    {isSummarizing ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {isSummarizing ? "Summarizing..." : "Regenerate Summary"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    {isFeatured && (
                        <Badge variant="outline" className="flex-shrink-0">Featured</Badge>
                    )}
                </div>
            </div>
        </div>
    );
};


export default function NewsSelection({ articles, selectedArticles, setSelectedArticles, featuredArticle, isLoading, selectedDate, onDateChange, maxDate, onAddArticle }: NewsSelectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isExtractionStarted, setIsExtractionStarted] = useState(false);
  const [dateInput, setDateInput] = useState(selectedDate);

  useEffect(() => {
    setDateInput(selectedDate);
  }, [selectedDate]);

  const handleDateInputChange = (value: string) => {
    setDateInput(value);
    if (value) {
      onDateChange(value);
    }
  };
  
  const selectedIds = new Set(selectedArticles.map(a => a.id));
  
  const handleStartExtraction = () => {
    setIsExtractionStarted(true);
  };
  
  const selectionCount = selectedArticles.length;
  
  const renderSkeletons = () => {
    return Array.from({ length: 10 }).map((_, i) => (
      <div key={`skeleton-${i}`} className="p-4 border-b">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 flex-shrink-0">
                <span className="w-5"></span>
                <Skeleton className="h-4 w-4 rounded-sm" />
            </div>
            <div className="flex-grow space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
      </div>
    ));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <Newspaper className="w-8 h-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-headline">Select Top AI News</CardTitle>
              <CardDescription>
                Choose {MAX_SELECTIONS} articles. The first one selected will be the featured story.
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center border rounded-md overflow-hidden">
                <Input 
                    type="date" 
                    value={dateInput} 
                    onChange={(e) => handleDateInputChange(e.target.value)}
                    className="w-auto border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    max={maxDate}
                />
            </div>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleStartExtraction}
              disabled={isExtractionStarted || isLoading}
            >
              {isExtractionStarted ? "Extracting..." : "Extract & Summarize"}
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Article
                </Button>
              </DialogTrigger>
              <AddArticleDialog 
                onAddArticle={onAddArticle} 
                onClose={() => setIsAddDialogOpen(false)} 
              />
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y border-t">
          {isLoading ? renderSkeletons() : articles.map((article) => {
            const isSelected = selectedIds.has(article.id);
            const isFeatured = featuredArticle?.id === article.id;
            const selectionIndex = isSelected ? selectedArticles.findIndex(a => a.id === article.id) : -1;

            return (
              <ArticleItem
                key={article.id}
                article={article}
                isSelected={isSelected}
                isFeatured={isFeatured}
                onSelect={setSelectedArticles}
                isSelectionDisabled={!isSelected && selectionCount >= MAX_SELECTIONS}
                selectionIndex={selectionIndex}
                shouldExtract={isExtractionStarted}
              />
            );
          })}
        </div>
      </CardContent>
      <CardFooter className="bg-secondary/50 p-4 border-t text-sm text-muted-foreground flex flex-col items-center justify-center gap-4">
         <div className="flex flex-col items-center gap-1">
            <span>{selectionCount} of {MAX_SELECTIONS} articles selected.</span>
            {articles.length > 0 && <span className="text-xs">Showing {articles.length} headlines.</span>}
         </div>
      </CardFooter>
    </Card>
  );
}

function AddArticleDialog({ onAddArticle, onClose }: { onAddArticle: (article: Omit<NewsArticle, 'id'>) => void, onClose: () => void }) {
  const [articleUrl, setArticleUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const deriveSourceFromUrl = (value: string) => {
    try {
      const hostname = new URL(value).hostname;
      return hostname.replace(/^www\./, "");
    } catch (error) {
      return "Custom Source";
    }
  };

  const handleAdd = async () => {
    const trimmedUrl = articleUrl.trim();
    if (!trimmedUrl) {
      toast({ title: "Missing URL", description: "Please provide a valid article link.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await extractArticleTextAction(trimmedUrl);
      if (result.error) {
        toast({ title: "Diffbot Error", description: result.error, variant: "destructive" });
        return;
      }

      const resolvedUrl = result.resolvedUrl || trimmedUrl;
      const title = result.title?.trim() || "Untitled Article";
      const source = result.source?.trim() || deriveSourceFromUrl(resolvedUrl);
      const date = new Date().toISOString().slice(0, 10);

      onAddArticle({
        title,
        url: resolvedUrl,
        source,
        imageUrl: result.imageUrl,
        summary: "",
        text: result.text || "",
        date,
      });

      toast({ title: "Article Added", description: "Diffbot pulled the article details successfully." });
      setArticleUrl("");
      onClose();
    } catch (error: any) {
      console.error("Failed to add custom article:", error);
      toast({ title: "Unexpected Error", description: error?.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add a Custom Article</DialogTitle>
        <CardDescription>Provide a URL and we&apos;ll pull the headline, source, and text via Diffbot.</CardDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="custom-article-url">URL</Label>
          <Input
            id="custom-article-url"
            type="url"
            value={articleUrl}
            onChange={(e) => setArticleUrl(e.target.value)}
            placeholder="https://example.com/article"
          />
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" disabled={isSubmitting}>Cancel</Button>
        </DialogClose>
        <Button onClick={handleAdd} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader className="mr-2 h-4 w-4 animate-spin" />
              Pulling Article
            </>
          ) : (
            "Add & Process Article"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
