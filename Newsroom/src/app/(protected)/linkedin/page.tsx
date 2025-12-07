"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { AppLogo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, RefreshCw, Copy, Check, ExternalLink, ArrowLeft, ChevronRight, Search, X, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getBasePath, withBasePath } from "@/lib/base-path";
import { 
  getStoredArticlesAction, 
  generateLinkedInPitchesAction, 
  generateLinkedInPostAction,
  type LinkedInPitch 
} from "../../actions";

type StoredArticle = {
  id: string;
  title: string;
  url: string;
  source: string;
  date: string;
  summary?: string;
};

export default function LinkedInPage() {
  const { toast } = useToast();
  const [basePath, setBasePath] = useState<string>(() => getBasePath());
  
  // State
  const [articles, setArticles] = useState<StoredArticle[]>([]);
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(new Set());
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);
  const [isGeneratingPitches, setIsGeneratingPitches] = useState(false);
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const [pitches, setPitches] = useState<LinkedInPitch[]>([]);
  const [selectedPitch, setSelectedPitch] = useState<LinkedInPitch | null>(null);
  const [generatedPost, setGeneratedPost] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [copied, setCopied] = useState(false);
  
  // View state: 'articles' | 'pitches' | 'post'
  const [view, setView] = useState<'articles' | 'pitches' | 'post'>('articles');

  // Filtered articles based on search and date
  const filteredArticles = useMemo(() => {
    return articles.filter(article => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          article.title.toLowerCase().includes(query) ||
          article.source.toLowerCase().includes(query) ||
          (article.summary && article.summary.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }
      
      // Date filter
      if (startDate && article.date) {
        if (article.date < startDate) return false;
      }
      if (endDate && article.date) {
        if (article.date > endDate) return false;
      }
      
      return true;
    });
  }, [articles, searchQuery, startDate, endDate]);

  useEffect(() => {
    const resolved = getBasePath();
    if (resolved !== basePath) {
      setBasePath(resolved);
    }
  }, [basePath]);

  // Fetch articles on mount
  useEffect(() => {
    async function fetchArticles() {
      setIsLoadingArticles(true);
      const result = await getStoredArticlesAction(50);
      if ('error' in result) {
        toast({
          variant: "destructive",
          title: "Error loading articles",
          description: result.error,
        });
      } else {
        setArticles(result);
        // Auto-select most recent 15 articles
        const recentIds = new Set(result.slice(0, 15).map(a => a.id));
        setSelectedArticleIds(recentIds);
      }
      setIsLoadingArticles(false);
    }
    fetchArticles();
  }, [toast]);

  const handleToggleArticle = (id: string) => {
    setSelectedArticleIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const filteredIds = new Set(filteredArticles.map(a => a.id));
    const allFilteredSelected = filteredArticles.every(a => selectedArticleIds.has(a.id));
    
    if (allFilteredSelected) {
      // Deselect all filtered articles
      setSelectedArticleIds(prev => {
        const newSet = new Set(prev);
        filteredArticles.forEach(a => newSet.delete(a.id));
        return newSet;
      });
    } else {
      // Select all filtered articles
      setSelectedArticleIds(prev => {
        const newSet = new Set(prev);
        filteredArticles.forEach(a => newSet.add(a.id));
        return newSet;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedArticleIds(new Set());
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
  };

  const handleGeneratePitches = async () => {
    const selectedArticles = articles.filter(a => selectedArticleIds.has(a.id));
    
    if (selectedArticles.length < 3) {
      toast({
        variant: "destructive",
        title: "Not enough articles",
        description: "Please select at least 3 articles to generate pitch ideas.",
      });
      return;
    }

    setIsGeneratingPitches(true);
    const result = await generateLinkedInPitchesAction(selectedArticles);
    
    if ('error' in result) {
      toast({
        variant: "destructive",
        title: "Error generating pitches",
        description: result.error,
      });
    } else {
      setPitches(result.pitches);
      setView('pitches');
    }
    setIsGeneratingPitches(false);
  };

  const handleSelectPitch = async (pitch: LinkedInPitch) => {
    setSelectedPitch(pitch);
    setIsGeneratingPost(true);
    setView('post');
    setFeedback("");
    
    const result = await generateLinkedInPostAction({
      title: pitch.title,
      summary: pitch.summary,
      bullets: pitch.bullets,
      supportingArticles: pitch.supportingArticles,
    });
    
    if ('error' in result) {
      toast({
        variant: "destructive",
        title: "Error generating post",
        description: result.error,
      });
    } else {
      setGeneratedPost(result.post);
    }
    setIsGeneratingPost(false);
  };

  const handleRefinePost = async () => {
    if (!selectedPitch || !feedback.trim()) return;
    
    setIsGeneratingPost(true);
    const result = await generateLinkedInPostAction({
      title: selectedPitch.title,
      summary: selectedPitch.summary,
      bullets: selectedPitch.bullets,
      supportingArticles: selectedPitch.supportingArticles,
      feedback: feedback.trim(),
    });
    
    if ('error' in result) {
      toast({
        variant: "destructive",
        title: "Error refining post",
        description: result.error,
      });
    } else {
      setGeneratedPost(result.post);
      setFeedback("");
      toast({
        title: "Post refined",
        description: "Your feedback has been incorporated.",
      });
    }
    setIsGeneratingPost(false);
  };

  const handleCopyPost = async () => {
    await navigator.clipboard.writeText(generatedPost);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Post copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBackToPitches = () => {
    setView('pitches');
    setGeneratedPost("");
    setSelectedPitch(null);
  };

  const handleBackToArticles = () => {
    setView('articles');
    setPitches([]);
  };

  return (
    <div className="bg-secondary min-h-screen">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AppLogo className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground font-headline">
              LinkedIn Content Generator
            </h1>
          </div>
          <Button variant="outline" asChild>
            <Link href={withBasePath("/", basePath)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Newsroom
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Articles Selection View */}
          {view === 'articles' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Select Articles</span>
                  <Badge variant="secondary">
                    {selectedArticleIds.size} selected
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Choose articles to generate LinkedIn post ideas from. Select articles that might connect into interesting narratives.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingArticles ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : articles.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No articles found in your database.</p>
                    <p className="text-sm mt-2">Extract some articles from the newsroom first.</p>
                  </div>
                ) : (
                  <>
                    {/* Search and Filters */}
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search articles by title, source, or summary..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 pr-9"
                        />
                        {searchQuery && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                            onClick={() => setSearchQuery("")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="date"
                            placeholder="Start date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-[150px] h-9"
                          />
                          <span className="text-muted-foreground">to</span>
                          <Input
                            type="date"
                            placeholder="End date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-[150px] h-9"
                          />
                        </div>
                        
                        {(searchQuery || startDate || endDate) && (
                          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                            <X className="h-4 w-4 mr-1" />
                            Clear filters
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Selection controls */}
                    <div className="flex items-center justify-between border-t pt-3">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                          {filteredArticles.length > 0 && filteredArticles.every(a => selectedArticleIds.has(a.id)) 
                            ? 'Deselect All' 
                            : `Select All${filteredArticles.length !== articles.length ? ` (${filteredArticles.length})` : ''}`}
                        </Button>
                        {selectedArticleIds.size > 0 && (
                          <Button variant="ghost" size="sm" onClick={handleClearSelection} className="text-destructive hover:text-destructive">
                            <X className="h-4 w-4 mr-1" />
                            Clear Selection ({selectedArticleIds.size})
                          </Button>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {filteredArticles.length} of {articles.length} articles
                      </span>
                    </div>
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-2">
                        {filteredArticles.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <p>No articles match your filters.</p>
                            <Button variant="link" onClick={handleClearFilters} className="mt-2">
                              Clear filters
                            </Button>
                          </div>
                        ) : (
                          filteredArticles.map((article) => (
                          <div
                            key={article.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedArticleIds.has(article.id)
                                ? 'bg-primary/5 border-primary/30'
                                : 'bg-card hover:bg-muted/50'
                            }`}
                            onClick={() => handleToggleArticle(article.id)}
                          >
                            <Checkbox
                              checked={selectedArticleIds.has(article.id)}
                              onCheckedChange={() => handleToggleArticle(article.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm line-clamp-2">{article.title}</p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <span>{article.source}</span>
                                <span>•</span>
                                <span>{article.date}</span>
                              </div>
                            </div>
                          </div>
                        ))
                        )}
                      </div>
                    </ScrollArea>
                    <Button 
                      onClick={handleGeneratePitches} 
                      disabled={selectedArticleIds.size < 3 || isGeneratingPitches}
                      className="w-full"
                    >
                      {isGeneratingPitches ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating Ideas...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Pitch Ideas
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pitches View */}
          {view === 'pitches' && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleBackToArticles}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <CardTitle>Choose Your Angle</CardTitle>
                    <CardDescription>
                      Select a pitch to generate your full LinkedIn post
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="space-y-2">
                  {pitches.map((pitch, index) => (
                    <AccordionItem key={pitch.id || index} value={pitch.id || `pitch-${index}`} className="border rounded-lg px-4">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex-1 text-left pr-4">
                          <p className="font-semibold">{pitch.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{pitch.summary}</p>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          <div>
                            <h4 className="text-sm font-medium mb-2">Key Points:</h4>
                            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                              {pitch.bullets.map((bullet, i) => (
                                <li key={i}>{bullet}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium mb-2">Supporting Articles:</h4>
                            <div className="space-y-2">
                              {pitch.supportingArticles.map((article, i) => (
                                <a
                                  key={i}
                                  href={article.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  <span className="line-clamp-1">{article.title}</span>
                                  <span className="text-muted-foreground">({article.source})</span>
                                </a>
                              ))}
                            </div>
                          </div>
                          <Button onClick={() => handleSelectPitch(pitch)} className="w-full">
                            Generate Post
                            <ChevronRight className="h-4 w-4 ml-2" />
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
                
                <div className="mt-4 pt-4 border-t">
                  <Button variant="outline" onClick={handleGeneratePitches} disabled={isGeneratingPitches} className="w-full">
                    {isGeneratingPitches ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Generate New Ideas
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Post View */}
          {view === 'post' && selectedPitch && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handleBackToPitches}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <CardTitle>{selectedPitch.title}</CardTitle>
                      <CardDescription>{selectedPitch.summary}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isGeneratingPost ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <span className="ml-3 text-muted-foreground">Generating your post...</span>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Textarea
                          value={generatedPost}
                          onChange={(e) => setGeneratedPost(e.target.value)}
                          className="min-h-[300px] text-sm"
                          placeholder="Your generated post will appear here..."
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={handleCopyPost}
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      
                      <div className="text-xs text-muted-foreground text-right">
                        {generatedPost.length} characters
                      </div>

                      <div className="border-t pt-4 space-y-3">
                        <h4 className="text-sm font-medium">Refine Your Post</h4>
                        <Textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="Add feedback to adjust the post (e.g., 'Make it more conversational', 'Focus more on the business implications', 'Add a personal anecdote hook')..."
                          className="min-h-[80px] text-sm"
                        />
                        <Button 
                          onClick={handleRefinePost} 
                          disabled={!feedback.trim() || isGeneratingPost}
                          variant="outline"
                          className="w-full"
                        >
                          {isGeneratingPost ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Refining...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Apply Feedback
                            </>
                          )}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Supporting Articles Reference */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Supporting Articles</CardTitle>
                  <CardDescription>Add these links in your post comments</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedPitch.supportingArticles.map((article, i) => (
                      <div key={i} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium line-clamp-1">{article.title}</p>
                          <p className="text-xs text-muted-foreground">{article.source} • {article.date}</p>
                        </div>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-primary hover:text-primary/80"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
