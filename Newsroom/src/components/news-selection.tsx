
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
import { Label } from "@/components/ui/label";
import { Loader, Newspaper, PlusCircle, Text } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import { extractArticleTextAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "./ui/scroll-area";

const MAX_SELECTIONS = 5;
const CONCURRENT_EXTRACTIONS = 1;
const EXTRACTION_DELAY = 2000; // 2 second delay between requests

type ExtractionResult = {
  text: string;
  isExtracting: boolean;
};

// Global extraction queue manager
class ExtractionQueue {
  private queue: Array<{ url: string; callback: (text: string) => void }> = [];
  private processing = false;
  private activeExtractions = 0;

  async add(url: string, callback: (text: string) => void) {
    this.queue.push({ url, callback });
    this.processQueue();
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, CONCURRENT_EXTRACTIONS);
      
      await Promise.all(
        batch.map(async ({ url, callback }) => {
          try {
            const result = await extractArticleTextAction(url);
            if (result.error) {
              console.error("Auto-extraction failed:", result.error);
              callback("Failed to extract article text.");
            } else {
              callback(result.text || "No text was extracted.");
            }
          } catch (error) {
            console.error("Extraction error:", error);
            callback("Failed to extract article text.");
          }
        })
      );

      // Wait before processing next batch
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
};

const ArticleItem = ({ 
    article, 
    isSelected, 
    isFeatured, 
    onSelect, 
    isSelectionDisabled, 
    selectionIndex 
}: { 
    article: NewsArticle, 
    isSelected: boolean,
    isFeatured: boolean,
    onSelect: (article: NewsArticle) => void,
    isSelectionDisabled: boolean
    selectionIndex: number;
}) => {
    const sourceName = typeof article.source === 'object' && article.source !== null ? (article.source as any).name : article.source;
    const { toast } = useToast();
    const [extractedText, setExtractedText] = useState("");
    const [isExtracting, setIsExtracting] = useState(true);
    const [isTextDialogOpen, setIsTextDialogOpen] = useState(false);
    
    // Auto-extract text on mount using queue
    useEffect(() => {
        extractionQueue.add(article.url, (text) => {
            setExtractedText(text);
            setIsExtracting(false);
        });
    }, [article.url]);
    
    const handleShowText = () => {
        setIsTextDialogOpen(true);
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
                    <div className="text-xs text-muted-foreground/80 flex items-center gap-2 mt-1">
                        <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-primary">{sourceName}</a>
                    </div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <Dialog open={isTextDialogOpen} onOpenChange={setIsTextDialogOpen}>
                        <Button variant="outline" size="sm" onClick={handleShowText} disabled={isExtracting}>
                            {isExtracting ? <Loader className="h-4 w-4 animate-spin" /> : <Text className="h-4 w-4" />}
                        </Button>
                        <DialogContent className="max-w-3xl">
                            <DialogHeader>
                                <DialogTitle>Extracted Article Text</DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="h-[60vh] rounded-md border p-4">
                               <p className="text-sm whitespace-pre-wrap">{extractedText}</p>
                            </ScrollArea>
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


export default function NewsSelection({ articles, selectedArticles, setSelectedArticles, featuredArticle, isLoading }: NewsSelectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  const selectedIds = new Set(selectedArticles.map(a => a.id));
  
  const handleAddArticle = (newArticle: Omit<NewsArticle, 'id' | 'date' | 'summary' | 'text'>) => {
    // This function is not fully implemented in the current flow, as adding articles requires processing.
    // For now, we can just display a toast.
    alert("Adding articles manually is not yet supported in this workflow.");
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
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Article
              </Button>
            </DialogTrigger>
            <AddArticleDialog 
              onAddArticle={handleAddArticle} 
              onClose={() => setIsAddDialogOpen(false)} 
            />
          </Dialog>
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

function AddArticleDialog({ onAddArticle, onClose }: { onAddArticle: (article: Omit<NewsArticle, 'id' | 'date' | 'summary' | 'text'>) => void, onClose: () => void }) {
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");

  const handleAdd = () => {
    if (newTitle && newUrl && newSource) {
      onAddArticle({
        title: newTitle,
        url: newUrl,
        source: newSource,
        imageUrl: newImageUrl,
      });
      setNewTitle("");
      setNewUrl("");
      setNewSource("");
      setNewImageUrl("");
      onClose();
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add a Custom Article</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="url">URL</Label>
          <Input id="url" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://example.com/article" />
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button onClick={handleAdd}>Add & Process Article</Button>
      </DialogFooter>
    </DialogContent>
  );
}
