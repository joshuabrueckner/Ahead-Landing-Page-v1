
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
import { Loader, Newspaper, Sparkles, Plus, RotateCcw, FileText, EyeOff, Eye, Star, GripVertical, Pause, Play } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import { extractArticleTextAction, generateArticleOneSentenceSummary, storeArticleAction, updateArticleByUrlAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "./ui/scroll-area";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const MAX_SELECTIONS = 5;
const EXTRACTION_DELAY = 15000; // 15 seconds between extractions to respect Diffbot rate limits

type ExtractionResult = {
  text: string;
  isExtracting: boolean;
};

// Three-phase callback: when extraction starts, when text is ready, when summary is ready
type ExtractionCallbacks = {
  onExtractionStarted: () => void;
  onTextExtracted: (text: string) => void;
  onSummaryComplete: (summary: string, extractedText: string) => void;
};

// Global extraction queue manager with overlapped processing:
// - Extractions happen ONE at a time (sequential) with delay
// - Summarization happens in parallel with the next extraction
// - UI updates at each phase: queued -> extracting -> summarizing -> done
// - Supports pause/resume functionality
class ExtractionQueue {
  private queue: Array<{ url: string; callbacks: ExtractionCallbacks }> = [];
  private processing = false;
  private paused = false;
  private onAllCompleteCallback: (() => void) | null = null;
  private onPauseStateChangeCallback: ((isPaused: boolean) => void) | null = null;
  private onResumeCallback: (() => void) | null = null;
  private pendingCount = 0;
  private pauseResolve: (() => void) | null = null;
  private activeExtraction = false; // True when currently extracting an article

  setOnAllComplete(callback: () => void) {
    this.onAllCompleteCallback = callback;
  }

  setOnPauseStateChange(callback: (isPaused: boolean) => void) {
    this.onPauseStateChangeCallback = callback;
  }

  setOnResume(callback: () => void) {
    this.onResumeCallback = callback;
  }

  isPaused() {
    return this.paused;
  }

  isProcessing() {
    return this.processing;
  }

  isActivelyExtracting() {
    return this.activeExtraction;
  }

  pause() {
    this.paused = true;
    if (this.onPauseStateChangeCallback) {
      this.onPauseStateChangeCallback(true);
    }
  }

  resume() {
    this.paused = false;
    if (this.onPauseStateChangeCallback) {
      this.onPauseStateChangeCallback(false);
    }
    // Notify listeners that we're resuming (so they can restore queued state)
    if (this.onResumeCallback) {
      this.onResumeCallback();
    }
    // If we were waiting on pause, resolve to continue
    if (this.pauseResolve) {
      this.pauseResolve();
      this.pauseResolve = null;
    }
    // If we have items but not processing, restart
    if (this.queue.length > 0 && !this.processing) {
      this.processQueue();
    }
  }

  private async waitIfPaused(): Promise<boolean> {
    if (!this.paused) return false;
    // Wait until resumed
    await new Promise<void>(resolve => {
      this.pauseResolve = resolve;
    });
    return true;
  }

  async add(url: string, callbacks: ExtractionCallbacks) {
    this.pendingCount++;
    this.queue.push({ url, callbacks });
    this.processQueue();
  }

  // Add and process immediately, bypassing pause state (for individual manual extractions)
  async addImmediate(url: string, callbacks: ExtractionCallbacks): Promise<void> {
    return new Promise((resolve) => {
      this.pendingCount++;
      // Wrap callbacks to resolve when complete
      const wrappedCallbacks: ExtractionCallbacks = {
        onExtractionStarted: () => callbacks.onExtractionStarted(),
        onTextExtracted: (text) => callbacks.onTextExtracted(text),
        onSummaryComplete: (sum, text) => {
          callbacks.onSummaryComplete(sum, text);
          resolve();
        }
      };
      // Add to front of queue
      this.queue.unshift({ url, callbacks: wrappedCallbacks });
      // Temporarily unpause to process this item
      const wasPaused = this.paused;
      if (wasPaused) {
        this.paused = false;
        if (this.pauseResolve) {
          this.pauseResolve();
          this.pauseResolve = null;
        }
      }
      // Start processing if not already
      if (!this.processing) {
        this.processQueue().then(() => {
          // Re-pause after processing if we were paused before
          if (wasPaused && this.queue.length === 0) {
            this.paused = true;
          }
        });
      }
    });
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    // Track pending summarization promises so they can complete in the background
    const pendingSummaries: Promise<void>[] = [];

    while (this.queue.length > 0) {
      // Check if paused before processing next item
      if (this.paused) {
        await this.waitIfPaused();
        // After resuming, check if we should continue
        if (this.queue.length === 0) break;
      }

      const item = this.queue.shift();
      if (!item) continue;

      // Notify that extraction is NOW starting for this article
      item.callbacks.onExtractionStarted();
      this.activeExtraction = true;

      try {
        // Step 1: Extract article text (this is the rate-limited operation)
        const result = await extractArticleTextAction(item.url);
        let text = "";

        if (result.error) {
          console.error("Auto-extraction failed:", result.error);
          text = "Failed to extract article text.";
          item.callbacks.onTextExtracted(text);
          item.callbacks.onSummaryComplete("", text);
          this.decrementPending();
        } else {
          text = result.text || "No text was extracted.";
          
          // IMMEDIATELY notify UI that text is ready (don't wait for summary)
          item.callbacks.onTextExtracted(text);
          
          // Step 2: Start summarization in the background (non-blocking)
          // This runs in parallel with the next article's extraction
          if (text && text !== "No text was extracted." && text !== "Failed to extract article text.") {
            const summaryPromise = (async () => {
              try {
                const summaryResult = await generateArticleOneSentenceSummary(text);
                const summary = summaryResult.error ? "" : (summaryResult.summary || "");
                item.callbacks.onSummaryComplete(summary, text);
              } catch (err) {
                console.error("Summary generation error:", err);
                item.callbacks.onSummaryComplete("", text);
              } finally {
                this.decrementPending();
              }
            })();
            pendingSummaries.push(summaryPromise);
          } else {
            item.callbacks.onSummaryComplete("", text);
            this.decrementPending();
          }
        }
      } catch (error) {
        console.error("Extraction error:", error);
        item.callbacks.onTextExtracted("Failed to extract article text.");
        item.callbacks.onSummaryComplete("", "");
        this.decrementPending();
      } finally {
        this.activeExtraction = false;
      }

      // Delay before the next extraction (but summarization continues in background)
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, EXTRACTION_DELAY));
      }
    }

    // Wait for any remaining summaries to complete before marking processing as done
    await Promise.all(pendingSummaries);
    this.processing = false;
  }

  private decrementPending() {
    this.pendingCount--;
    if (this.pendingCount <= 0) {
      this.pendingCount = 0;
      if (this.onAllCompleteCallback) {
        this.onAllCompleteCallback();
      }
    }
  }
}

const extractionQueue = new ExtractionQueue();

type NewsSelectionProps = {
  articles: NewsArticle[];
  selectedArticles: NewsArticle[];
  setSelectedArticles: (article: NewsArticle) => void;
  onReorderArticles?: (articles: NewsArticle[]) => void;
  featuredArticle: NewsArticle | null;
  isLoading: boolean;
  onReloadArticle: (article: NewsArticle) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  maxDate: string;
  onAddArticle: (article: Omit<NewsArticle, 'id'>) => void;
  onArticleSummaryUpdate: (articleId: number, summary: string) => void;
};

const ArticleItem = ({ 
    article, 
    isSelected, 
    isFeatured, 
    onSelect, 
    isSelectionDisabled, 
    selectionIndex,
  shouldExtract,
  isExtractionPaused,
  isQueueBusy,
  onSummaryUpdate,
  isDeprioritized,
  onToggleDeprioritize,
  isPrioritized,
  onTogglePrioritize,
  isDraggable,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isDragOver,
}: { 
    article: NewsArticle, 
    isSelected: boolean,
    isFeatured: boolean,
    onSelect: (article: NewsArticle) => void,
    isSelectionDisabled: boolean
    selectionIndex: number;
  shouldExtract: boolean;
  isExtractionPaused: boolean;
  isQueueBusy: boolean;
  onSummaryUpdate: (articleId: number, summary: string) => void;
  isDeprioritized: boolean;
  onToggleDeprioritize: () => void;
  isPrioritized: boolean;
  onTogglePrioritize: () => void;
  isDraggable: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: () => void;
  isDragOver: boolean;
}) => {
    const sourceName = typeof article.source === 'object' && article.source !== null ? (article.source as any).name : article.source;
    const { toast } = useToast();
    const [extractedText, setExtractedText] = useState("");
  const [summary, setSummary] = useState(article.summary || "");
    const [isQueued, setIsQueued] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [isTextDialogOpen, setIsTextDialogOpen] = useState(false);
    const [hasBeenQueued, setHasBeenQueued] = useState(false);
    const [wasPausedWhileQueued, setWasPausedWhileQueued] = useState(false);

  useEffect(() => {
    setSummary(article.summary || "");
  }, [article.summary]);

    // Track when paused while in queue state (so we can restore on resume)
    useEffect(() => {
        if (isExtractionPaused && isQueued && !isExtracting && !isSummarizing) {
            setWasPausedWhileQueued(true);
            setIsQueued(false);
        }
    }, [isExtractionPaused, isQueued, isExtracting, isSummarizing]);

    // Restore queued state when resumed
    useEffect(() => {
        if (!isExtractionPaused && wasPausedWhileQueued && !summary && hasBeenQueued) {
            setIsQueued(true);
            setWasPausedWhileQueued(false);
        }
    }, [isExtractionPaused, wasPausedWhileQueued, summary, hasBeenQueued]);
    
    // Auto-extract text and generate summary when shouldExtract becomes true
    // Skip deprioritized articles
    useEffect(() => {
        if (shouldExtract && !hasBeenQueued && !isDeprioritized) {
            setHasBeenQueued(true);
            setIsQueued(true); // Show as queued while process is active
            setIsExtracting(false);
            setIsSummarizing(false);
            
            extractionQueue.add(article.url, {
                onExtractionStarted: () => {
                    // Phase 0: This article is now being extracted
                    console.log('Extraction started:', article.title);
                    setIsQueued(false);
                    setIsExtracting(true);
                },
                onTextExtracted: (text) => {
                    // Phase 1: Text is ready - show it immediately
                    console.log('Text extracted:', article.title);
                    setExtractedText(text);
                    setIsExtracting(false);
                    // Start showing summarizing state
                    if (text && !text.includes("Failed") && text !== "No text was extracted.") {
                        setIsSummarizing(true);
                    }
                },
                onSummaryComplete: async (sum, text) => {
                    // Phase 2: Summary is ready - update UI
                    console.log('Summary complete:', article.title, 'Summary:', sum);
                    const normalized = (sum || "").trim();
                    setSummary(normalized);
                    onSummaryUpdate(article.id, normalized);
                    setIsSummarizing(false);
                    
                    // Store article to Firestore
                    const sourceName = typeof article.source === 'object' && article.source !== null ? (article.source as any).name : article.source;
                    const storeResult = await storeArticleAction({
                        title: article.title,
                        url: article.url,
                        source: sourceName || '',
                        date: article.date || '',
                        summary: normalized || undefined,
                        imageUrl: article.imageUrl || undefined,
                        text: text || undefined,
                    });
                    if (storeResult.success) {
                        console.log('Article stored to Firestore:', article.title);
                    } else if (storeResult.error !== 'Article already exists') {
                        console.error('Failed to store article:', storeResult.error);
                    }
                }
            });
        }
  }, [shouldExtract, article.url, hasBeenQueued, isDeprioritized, article.id, article.title, onSummaryUpdate]);
    
    const handleShowText = () => {
      setIsTextDialogOpen(true);
    };

    const handleRetryExtraction = () => {
        setIsQueued(true);
        setIsExtracting(false);
        setIsSummarizing(false);
        
        // Use addImmediate to bypass pause state for manual extractions
        extractionQueue.addImmediate(article.url, {
            onExtractionStarted: () => {
                setIsQueued(false);
                setIsExtracting(true);
            },
            onTextExtracted: (text) => {
                console.log('Text re-extracted:', article.title);
                setExtractedText(text);
                setIsExtracting(false);
                if (text && !text.includes("Failed") && text !== "No text was extracted.") {
                    setIsSummarizing(true);
                }
            },
            onSummaryComplete: async (sum, text) => {
                console.log('Summary re-generated:', article.title, 'Summary:', sum);
                const normalized = (sum || "").trim();
                setSummary(normalized);
                onSummaryUpdate(article.id, normalized);
                setIsSummarizing(false);
                
                // Store article to Firestore (retry)
                const sourceName = typeof article.source === 'object' && article.source !== null ? (article.source as any).name : article.source;
                const storeResult = await storeArticleAction({
                    title: article.title,
                    url: article.url,
                    source: sourceName || '',
                    date: article.date || '',
                    summary: normalized || undefined,
                    imageUrl: article.imageUrl || undefined,
                    text: text || undefined,
                });
                if (storeResult.success) {
                    console.log('Article stored to Firestore (retry):', article.title);
                } else if (storeResult.error !== 'Article already exists') {
                    console.error('Failed to store article (retry):', storeResult.error);
                }
            }
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
                const regenerated = (result.summary || "").trim();
                setSummary(regenerated);
                onSummaryUpdate(article.id, regenerated);
                
                // Update article in Firebase with new text and summary
                const updateResult = await updateArticleByUrlAction(article.url, {
                    text: extractedText,
                    summary: regenerated,
                });
                if (updateResult.success) {
                    toast({
                        title: "Success",
                        description: "Summary regenerated and saved to database.",
                    });
                } else {
                    console.error("Failed to update article in Firebase:", updateResult.error);
                    toast({
                        title: "Success",
                        description: "Summary regenerated (but failed to save to database).",
                    });
                }
                
              if (isTextDialogOpen) {
                setIsTextDialogOpen(false);
              }
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
        <TooltipProvider delayDuration={200}>
        <div 
          className={cn(
            "px-6 py-4 transition-colors", 
            isFeatured && "bg-secondary rounded-lg",
            isDeprioritized && "opacity-40",
            isPrioritized && "bg-yellow-50 dark:bg-yellow-950/20 border-l-2 border-yellow-400",
            isDragOver && "bg-primary/10 border-t-2 border-primary"
          )}
          draggable={isDraggable}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDrop={onDrop}
        >
          <div className="flex items-start gap-4">
            <div className="flex items-center gap-4 flex-shrink-0 pt-1">
                    {isDraggable && (
                      <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab active:cursor-grabbing flex-shrink-0" />
                    )}
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
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
              <div className="flex-1 min-w-0">
                <label htmlFor={`article-select-${article.id}`} className={cn("font-semibold text-foreground hover:text-primary cursor-pointer leading-tight", isSelectionDisabled && 'cursor-not-allowed', isDeprioritized && "text-muted-foreground/60")}>
                  {article.title}
                </label>
                {isQueued && !isExtracting && !isSummarizing && (
                  <p className="text-sm text-muted-foreground/60 mt-1 leading-relaxed">
                    Queued...
                  </p>
                )}
                {isExtracting && (
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed flex items-center gap-2">
                    <Loader className="h-3 w-3 animate-spin" />
                    Extracting article text...
                  </p>
                )}
                {!isExtracting && isSummarizing && (
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed flex items-center gap-2">
                    <Loader className="h-3 w-3 animate-spin" />
                    Generating summary...
                  </p>
                )}
                {!isQueued && !isExtracting && !isSummarizing && summary && (
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{summary}</p>
                )}
                <div className="text-xs text-muted-foreground/80 flex items-center gap-2 mt-1">
                  <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-primary">{sourceName}</a>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-7 w-7 rounded-full text-muted-foreground hover:text-primary",
                          isDeprioritized && "text-muted-foreground/60"
                        )}
                        aria-label={isDeprioritized ? "Restore priority" : "Deprioritize"}
                        onClick={onToggleDeprioritize}
                      >
                        {isDeprioritized ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isDeprioritized ? "Restore priority" : "Deprioritize"}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-7 w-7 rounded-full text-muted-foreground hover:text-yellow-500",
                          isPrioritized && "text-yellow-500"
                        )}
                        aria-label={isPrioritized ? "Remove flag" : "Flag for review"}
                        onClick={onTogglePrioritize}
                      >
                        <Star className={cn("h-3.5 w-3.5", isPrioritized && "fill-yellow-500")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isPrioritized ? "Remove flag" : "Flag for review"}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-9 w-9 rounded-full border border-border/40 bg-secondary/30 text-muted-foreground hover:text-primary",
                          isQueueBusy && !isExtracting && !isQueued && "opacity-50"
                        )}
                        aria-label="Retry extraction"
                        onClick={handleRetryExtraction}
                        disabled={isExtracting || isQueued || isQueueBusy}
                      >
                        {(isExtracting || isQueued) ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Retry extraction & summarize</TooltipContent>
                  </Tooltip>
                  <Dialog open={isTextDialogOpen} onOpenChange={setIsTextDialogOpen}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-full text-muted-foreground"
                          onClick={handleShowText}
                          disabled={isExtracting}
                          aria-label="View extracted text"
                        >
                          {isExtracting ? <Loader className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View extracted text</TooltipContent>
                    </Tooltip>
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
                </div>
                </TooltipProvider>
    );
};


export default function NewsSelection({ articles, selectedArticles, setSelectedArticles, onReorderArticles, featuredArticle, isLoading, selectedDate, onDateChange, maxDate, onAddArticle, onArticleSummaryUpdate }: NewsSelectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isExtractionStarted, setIsExtractionStarted] = useState(false);
  const [isExtractionComplete, setIsExtractionComplete] = useState(false);
  const [isExtractionPaused, setIsExtractionPaused] = useState(false);
  const [isQueueBusy, setIsQueueBusy] = useState(false);
  const [dateInput, setDateInput] = useState(selectedDate);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const [deprioritizedArticles, setDeprioritizedArticles] = useState<Set<number>>(new Set());
  const [prioritizedArticles, setPrioritizedArticles] = useState<Set<number>>(new Set());
  const [draggedArticleId, setDraggedArticleId] = useState<number | null>(null);
  const [dragOverArticleId, setDragOverArticleId] = useState<number | null>(null);

  // Poll the queue to track if it's actively extracting
  useEffect(() => {
    const interval = setInterval(() => {
      setIsQueueBusy(extractionQueue.isActivelyExtracting());
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const handleDragStart = (articleId: number) => {
    setDraggedArticleId(articleId);
  };

  const handleDragOver = (e: React.DragEvent, articleId: number) => {
    e.preventDefault();
    if (draggedArticleId !== null && draggedArticleId !== articleId) {
      setDragOverArticleId(articleId);
    }
  };

  const handleDragEnd = () => {
    setDraggedArticleId(null);
    setDragOverArticleId(null);
  };

  const handleDrop = (targetArticleId: number) => {
    if (draggedArticleId === null || draggedArticleId === targetArticleId) return;
    
    const draggedIndex = articles.findIndex(a => a.id === draggedArticleId);
    const targetIndex = articles.findIndex(a => a.id === targetArticleId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const newArticles = [...articles];
    const [draggedArticle] = newArticles.splice(draggedIndex, 1);
    newArticles.splice(targetIndex, 0, draggedArticle);
    
    if (onReorderArticles) {
      onReorderArticles(newArticles);
    }
    
    setDraggedArticleId(null);
    setDragOverArticleId(null);
  };

  const toggleDeprioritize = (articleId: number) => {
    setDeprioritizedArticles(prev => {
      const next = new Set(prev);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      return next;
    });
    // Remove from prioritized if deprioritizing
    setPrioritizedArticles(prev => {
      const next = new Set(prev);
      next.delete(articleId);
      return next;
    });
  };

  const togglePrioritize = (articleId: number) => {
    setPrioritizedArticles(prev => {
      const next = new Set(prev);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      return next;
    });
    // Remove from deprioritized if prioritizing
    setDeprioritizedArticles(prev => {
      const next = new Set(prev);
      next.delete(articleId);
      return next;
    });
  };

  // Register completion and pause state callbacks when component mounts
  useEffect(() => {
    extractionQueue.setOnAllComplete(() => {
      console.log('All extractions and summaries complete!');
      setIsExtractionComplete(true);
      setIsExtractionPaused(false);
    });
    extractionQueue.setOnPauseStateChange((isPaused) => {
      setIsExtractionPaused(isPaused);
    });
  }, []);

  useEffect(() => {
    setDateInput(selectedDate);
  }, [selectedDate]);

  const handleDateInputChange = (value: string) => {
    setDateInput(value);
    if (value) {
      onDateChange(value);
    }
  };

  const handleDateButtonClick = () => {
    if (dateInputRef.current) {
      const input = dateInputRef.current as HTMLInputElement & { showPicker?: () => void };
      if (typeof input.showPicker === "function") {
        input.showPicker();
      } else {
        input.click();
      }
    }
  };

  const dayLabel = (() => {
    if (!dateInput) return "--";
    const parts = dateInput.split("-");
    const dayPart = parts[2];
    if (!dayPart) return "--";
    return String(parseInt(dayPart, 10));
  })();
  
  const selectedIds = new Set(selectedArticles.map(a => a.id));
  
  const handleToggleExtraction = () => {
    if (!isExtractionStarted) {
      // First time starting
      setIsExtractionStarted(true);
    } else if (isExtractionPaused) {
      // Resume
      extractionQueue.resume();
    } else {
      // Pause
      extractionQueue.pause();
    }
  };
  
  const selectionCount = selectedArticles.length;
  
  const renderSkeletons = () => {
    return Array.from({ length: 10 }).map((_, i) => (
      <div key={`skeleton-${i}`} className="px-6 py-4 border-b">
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
          <TooltipProvider delayDuration={200}>
            <div className="flex gap-2 items-center">
              <div>
                <Input 
                  ref={dateInputRef}
                  type="date" 
                  value={dateInput} 
                  onChange={(e) => handleDateInputChange(e.target.value)}
                  className="sr-only"
                  max={maxDate}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="default"
                      size="icon"
                      onClick={handleDateButtonClick}
                      className="h-10 w-10 rounded-full font-semibold"
                      aria-label="Jump to date"
                    >
                      {dayLabel}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Jump to date</TooltipContent>
                </Tooltip>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="default" 
                    size="icon" 
                    onClick={handleToggleExtraction}
                    disabled={isExtractionComplete || isLoading}
                    className="h-10 w-10 rounded-full"
                    aria-label={!isExtractionStarted ? "Extract & Summarize" : isExtractionPaused ? "Resume" : "Pause"}
                  >
                    {!isExtractionStarted ? (
                      <Sparkles className="h-4 w-4" />
                    ) : isExtractionPaused ? (
                      <Play className="h-4 w-4" />
                    ) : isExtractionComplete ? (
                      <Sparkles className="h-4 w-4" />
                    ) : (
                      <Pause className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {!isExtractionStarted ? "Extract & Summarize" : isExtractionPaused ? "Resume" : isExtractionComplete ? "Complete" : "Pause"}
                </TooltipContent>
              </Tooltip>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button variant="default" size="icon" className="h-10 w-10 rounded-full" aria-label="Add article">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Add article</TooltipContent>
                </Tooltip>
                <AddArticleDialog 
                  onAddArticle={onAddArticle} 
                  onClose={() => setIsAddDialogOpen(false)} 
                />
              </Dialog>
            </div>
          </TooltipProvider>
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
                isExtractionPaused={isExtractionPaused}
                isQueueBusy={isQueueBusy}
                onSummaryUpdate={onArticleSummaryUpdate}
                isDeprioritized={deprioritizedArticles.has(article.id)}
                onToggleDeprioritize={() => toggleDeprioritize(article.id)}
                isPrioritized={prioritizedArticles.has(article.id)}
                onTogglePrioritize={() => togglePrioritize(article.id)}
                isDraggable={!!onReorderArticles}
                onDragStart={() => handleDragStart(article.id)}
                onDragOver={(e) => handleDragOver(e, article.id)}
                onDragEnd={handleDragEnd}
                onDrop={() => handleDrop(article.id)}
                isDragOver={dragOverArticleId === article.id}
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
