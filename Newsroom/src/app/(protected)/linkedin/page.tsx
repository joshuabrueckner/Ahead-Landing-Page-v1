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
import { Loader2, Sparkles, RefreshCw, Copy, Check, ExternalLink, ArrowLeft, ChevronRight, Search, X, Calendar, ChevronDown, ChevronUp, Pencil, Trash2, Lightbulb, Plus, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getBasePath, withBasePath } from "@/lib/base-path";
import { 
  getStoredArticlesAction, 
  generateLinkedInPitchesAction, 
  generateLinkedInPostAction,
  regeneratePitchTitleAction,
  findRelevantArticlesAction,
  extractArticleTextAction,
  storeArticleAction,
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

// Quick Idea Card Component
function QuickIdeaCard({
  idea,
  index,
  onSelect,
  onUpdate,
  onRemoveSource,
  onDelete,
  allArticles,
}: {
  idea: LinkedInPitch;
  index: number;
  onSelect: () => void;
  onUpdate: (updates: Partial<LinkedInPitch>) => void;
  onRemoveSource: (sourceIndex: number) => void;
  onDelete: () => void;
  allArticles: StoredArticle[];
}) {
  const [showSources, setShowSources] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(idea.title);
  const [editSummary, setEditSummary] = useState(idea.summary);
  const [showAddSource, setShowAddSource] = useState(false);
  const [sourceSearchQuery, setSourceSearchQuery] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // Track local sources for when user modifies them before regenerating
  const [localSources, setLocalSources] = useState(idea.supportingArticles);
  
  // Sync local sources when idea prop changes from parent
  useEffect(() => {
    setLocalSources(idea.supportingArticles);
  }, [idea.supportingArticles]);

  const handleSaveEdit = () => {
    onUpdate({ title: editTitle, summary: editSummary });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(idea.title);
    setEditSummary(idea.summary);
    setIsEditing(false);
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const result = await regeneratePitchTitleAction({
        currentTitle: idea.title,
        currentSummary: idea.summary,
        supportingArticles: localSources,
      });
      if ('error' in result) {
        console.error(result.error);
      } else {
        onUpdate({ title: result.title, summary: result.summary });
        setEditTitle(result.title);
        setEditSummary(result.summary);
      }
    } catch (error) {
      console.error("Failed to regenerate:", error);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleAddSource = (article: StoredArticle) => {
    const newSource = {
      title: article.title,
      source: article.source,
      date: article.date,
      url: article.url,
    };
    const newSources = [...localSources, newSource];
    setLocalSources(newSources);
    onUpdate({ supportingArticles: newSources });
    setShowAddSource(false);
    setSourceSearchQuery("");
  };
  
  const handleLocalRemoveSource = (sourceIndex: number) => {
    const newSources = localSources.filter((_, i) => i !== sourceIndex);
    setLocalSources(newSources);
    onRemoveSource(sourceIndex);
  };

  // Filter out already selected articles and apply search
  const availableArticles = allArticles.filter(a => {
    // Exclude already selected
    if (localSources.some(s => s.url === a.url)) return false;
    // Apply search filter
    if (sourceSearchQuery) {
      const query = sourceSearchQuery.toLowerCase();
      return a.title.toLowerCase().includes(query) || 
             a.source.toLowerCase().includes(query);
    }
    return true;
  });

  return (
    <div className="p-4 rounded-lg border bg-card transition-colors">
      {isEditing ? (
        <div className="space-y-3">
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Title"
            className="font-medium text-sm"
          />
          <Textarea
            value={editSummary}
            onChange={(e) => setEditSummary(e.target.value)}
            placeholder="Summary"
            className="text-xs min-h-[60px]"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveEdit}>Save</Button>
            <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm line-clamp-2">{idea.title}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{idea.summary}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={isRegenerating}
                onClick={(e) => { e.stopPropagation(); handleRegenerate(); }}
                title="Regenerate title and summary"
              >
                {isRegenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => { e.stopPropagation(); setShowSources(!showSources); }}
            >
              {showSources ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              {localSources.length} sources
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs ml-auto"
              onClick={onSelect}
            >
              Generate
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>

          {showSources && (
            <div className="mt-3 space-y-2 pt-3 border-t">
              {localSources.map((source, sourceIndex) => (
                <div key={sourceIndex} className="flex items-start gap-2 text-xs p-2 bg-muted/50 rounded">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium line-clamp-1">{source.title}</p>
                    <p className="text-muted-foreground">{source.source} • {source.date}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleLocalRemoveSource(sourceIndex); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {showAddSource ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="Search headlines..."
                      value={sourceSearchQuery}
                      onChange={(e) => setSourceSearchQuery(e.target.value)}
                      className="h-7 text-xs pl-7"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <ScrollArea className="h-[150px] border rounded p-2">
                    {availableArticles.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        {sourceSearchQuery ? "No matching articles found" : "No more articles available"}
                      </p>
                    ) : (
                      availableArticles.slice(0, 20).map((article) => (
                        <div
                          key={article.id}
                          className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer text-xs"
                          onClick={(e) => { e.stopPropagation(); handleAddSource(article); }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium line-clamp-1">{article.title}</p>
                            <p className="text-muted-foreground">{article.source} • {article.date}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </ScrollArea>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={(e) => { e.stopPropagation(); setShowAddSource(false); setSourceSearchQuery(""); }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={(e) => { e.stopPropagation(); setShowAddSource(true); }}
                >
                  + Add Source
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function LinkedInPage() {
  const { toast } = useToast();
  const [basePath, setBasePath] = useState<string>(() => getBasePath());
  
  // State
  const [articles, setArticles] = useState<StoredArticle[]>([]);
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(new Set());
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);
  const [isGeneratingPitches, setIsGeneratingPitches] = useState(false);
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  
  // Quick ideas state
  const [quickIdeas, setQuickIdeas] = useState<LinkedInPitch[]>([]);
  const [isGeneratingQuickIdeas, setIsGeneratingQuickIdeas] = useState(false);
  
  // Custom idea state
  const [customIdeaText, setCustomIdeaText] = useState("");
  const [customIdeaSelectedArticles, setCustomIdeaSelectedArticles] = useState<StoredArticle[]>([]);
  const [isFindingArticles, setIsFindingArticles] = useState(false);
  const [showArticleSelector, setShowArticleSelector] = useState(false);
  const [articleSelectorSearch, setArticleSelectorSearch] = useState("");
  const [externalUrlInput, setExternalUrlInput] = useState("");
  const [isLoadingExternalUrl, setIsLoadingExternalUrl] = useState(false);
  
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
        // Don't auto-select any articles
        
        // Auto-generate quick ideas from most recent articles
        if (result.length >= 5) {
          generateQuickIdeas(result.slice(0, 20));
        }
      }
      setIsLoadingArticles(false);
    }
    fetchArticles();
  }, [toast]);

  const generateQuickIdeas = async (articlesToUse: StoredArticle[]) => {
    setIsGeneratingQuickIdeas(true);
    const result = await generateLinkedInPitchesAction(articlesToUse);
    if (!('error' in result)) {
      setQuickIdeas(result.pitches.slice(0, 10));
    }
    setIsGeneratingQuickIdeas(false);
  };

  const handleRefreshQuickIdeas = () => {
    if (articles.length >= 5) {
      generateQuickIdeas(articles.slice(0, 20));
    }
  };

  const handleCreateCustomIdea = async () => {
    if (!customIdeaText.trim()) {
      toast({
        variant: "destructive",
        title: "Please enter your idea",
        description: "Describe your LinkedIn post idea to find relevant articles.",
      });
      return;
    }

    setIsFindingArticles(true);
    try {
      const result = await findRelevantArticlesAction({
        userIdea: customIdeaText,
        existingArticleUrls: customIdeaSelectedArticles.map(a => a.url),
        availableArticles: articles.map(a => ({
          id: a.id,
          title: a.title,
          url: a.url,
          source: a.source,
          date: a.date,
          summary: a.summary,
        })),
      });

      if ('error' in result) {
        toast({
          variant: "destructive",
          title: "Error finding articles",
          description: result.error,
        });
      } else {
        // Create a new quick idea with the matched articles + user's pre-selected articles
        const matchedArticles = articles.filter(a => result.matchedArticleIds.includes(a.id));
        // Combine user-selected articles with AI-found articles (avoid duplicates)
        const allSupportingArticles = [...customIdeaSelectedArticles];
        for (const article of matchedArticles) {
          if (!allSupportingArticles.some(a => a.url === article.url)) {
            allSupportingArticles.push(article);
          }
        }
        
        const newIdea: LinkedInPitch = {
          id: `custom-${Date.now()}`,
          title: result.title,
          summary: result.summary,
          bullets: [],
          supportingArticles: allSupportingArticles.map(a => ({
            title: a.title,
            source: a.source,
            date: a.date,
            url: a.url,
          })),
        };
        
        // Add to the beginning of quick ideas
        setQuickIdeas(prev => [newIdea, ...prev]);
        
        // Reset form
        setCustomIdeaText("");
        setCustomIdeaSelectedArticles([]);
        
        toast({
          title: "Idea created!",
          description: `Found ${allSupportingArticles.length} relevant articles for your idea.`,
        });
      }
    } catch (error) {
      console.error("Error creating custom idea:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to find relevant articles.",
      });
    } finally {
      setIsFindingArticles(false);
    }
  };

  const handleAddExternalUrl = async () => {
    const url = externalUrlInput.trim();
    if (!url) return;
    
    // Check if already added
    if (customIdeaSelectedArticles.some(a => a.url === url)) {
      toast({
        variant: "destructive",
        title: "Already added",
        description: "This article is already in your list.",
      });
      return;
    }
    
    // Check if it exists in the database
    const existingArticle = articles.find(a => a.url === url);
    if (existingArticle) {
      setCustomIdeaSelectedArticles(prev => [...prev, existingArticle]);
      setExternalUrlInput("");
      toast({
        title: "Article added",
        description: "Found this article in your database.",
      });
      return;
    }
    
    // Extract via Diffbot
    setIsLoadingExternalUrl(true);
    try {
      const extractResult = await extractArticleTextAction(url);
      
      if (extractResult.error) {
        toast({
          variant: "destructive",
          title: "Error extracting article",
          description: extractResult.error,
        });
        return;
      }
      
      // Store to database
      const today = new Date().toISOString().split('T')[0];
      const storeResult = await storeArticleAction({
        title: extractResult.title || "Untitled",
        url: extractResult.resolvedUrl || url,
        source: extractResult.source || "Unknown",
        date: today,
        text: extractResult.text,
        imageUrl: extractResult.imageUrl,
      });
      
      // Create article object and add to selection
      const newArticle: StoredArticle = {
        id: storeResult.docId || `temp-${Date.now()}`,
        title: extractResult.title || "Untitled",
        url: extractResult.resolvedUrl || url,
        source: extractResult.source || "Unknown",
        date: today,
      };
      
      setCustomIdeaSelectedArticles(prev => [...prev, newArticle]);
      // Also add to main articles list
      setArticles(prev => [newArticle, ...prev]);
      setExternalUrlInput("");
      
      toast({
        title: "Article added",
        description: storeResult.success 
          ? "Article extracted and saved to database." 
          : "Article extracted (already exists in database).",
      });
    } catch (error) {
      console.error("Error adding external URL:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to extract article.",
      });
    } finally {
      setIsLoadingExternalUrl(false);
    }
  };

  const handleRemoveCustomIdeaArticle = (index: number) => {
    setCustomIdeaSelectedArticles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateQuickIdea = (index: number, updates: Partial<LinkedInPitch>) => {
    setQuickIdeas(prev => {
      const newIdeas = [...prev];
      newIdeas[index] = { ...newIdeas[index], ...updates };
      return newIdeas;
    });
  };

  const handleRemoveSourceFromIdea = (ideaIndex: number, sourceIndex: number) => {
    setQuickIdeas(prev => {
      const newIdeas = [...prev];
      const idea = newIdeas[ideaIndex];
      newIdeas[ideaIndex] = {
        ...idea,
        supportingArticles: idea.supportingArticles.filter((_, i) => i !== sourceIndex),
      };
      return newIdeas;
    });
  };

  const handleDeleteQuickIdea = (index: number) => {
    setQuickIdeas(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectQuickIdea = (pitch: LinkedInPitch) => {
    // Select the articles from this pitch
    const pitchArticleUrls = new Set(pitch.supportingArticles.map(a => a.url));
    const matchingArticleIds = articles
      .filter(a => pitchArticleUrls.has(a.url))
      .map(a => a.id);
    
    // Set these as selected and go straight to generating the post
    setSelectedArticleIds(new Set(matchingArticleIds));
    setSelectedPitch(pitch);
    handleSelectPitchDirect(pitch);
  };

  const handleSelectPitchDirect = async (pitch: LinkedInPitch) => {
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
            <>
            {/* Create Your Idea Section */}
            <Card>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">
                  What do you want to post about?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="e.g., I want to write about how AI is changing software development workflows, specifically around code review and testing..."
                  value={customIdeaText}
                  onChange={(e) => setCustomIdeaText(e.target.value)}
                  className="min-h-[100px]"
                />
                
                {/* Selected Articles */}
                {customIdeaSelectedArticles.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Selected articles ({customIdeaSelectedArticles.length})</label>
                    <div className="space-y-2">
                      {customIdeaSelectedArticles.map((article, index) => (
                        <div key={article.id || index} className="flex items-start gap-2 text-xs p-2 bg-muted/50 rounded">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium line-clamp-1">{article.title}</p>
                            <p className="text-muted-foreground">{article.source} • {article.date}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <a
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveCustomIdeaArticle(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Add Articles Section */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Add articles (optional)</label>
                  
                  {showArticleSelector ? (
                    <div className="space-y-2 border rounded-lg p-3">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search headlines..."
                          value={articleSelectorSearch}
                          onChange={(e) => setArticleSelectorSearch(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                      <ScrollArea className="h-[200px] border rounded p-2">
                        {articles.filter(a => {
                          // Exclude already selected
                          if (customIdeaSelectedArticles.some(s => s.url === a.url)) return false;
                          // Apply search filter
                          if (articleSelectorSearch) {
                            const query = articleSelectorSearch.toLowerCase();
                            return a.title.toLowerCase().includes(query) || 
                                   a.source.toLowerCase().includes(query);
                          }
                          return true;
                        }).length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            {articleSelectorSearch ? "No matching articles found" : "No more articles available"}
                          </p>
                        ) : (
                          articles.filter(a => {
                            if (customIdeaSelectedArticles.some(s => s.url === a.url)) return false;
                            if (articleSelectorSearch) {
                              const query = articleSelectorSearch.toLowerCase();
                              return a.title.toLowerCase().includes(query) || 
                                     a.source.toLowerCase().includes(query);
                            }
                            return true;
                          }).slice(0, 30).map((article) => (
                            <div
                              key={article.id}
                              className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer text-sm"
                              onClick={() => {
                                setCustomIdeaSelectedArticles(prev => [...prev, article]);
                              }}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium line-clamp-1">{article.title}</p>
                                <p className="text-xs text-muted-foreground">{article.source} • {article.date}</p>
                              </div>
                              <Plus className="h-4 w-4 text-muted-foreground" />
                            </div>
                          ))
                        )}
                      </ScrollArea>
                      
                      {/* Add External URL */}
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Or add an article by URL:</p>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <LinkIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="https://example.com/article"
                              value={externalUrlInput}
                              onChange={(e) => setExternalUrlInput(e.target.value)}
                              className="pl-8 text-sm"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddExternalUrl();
                                }
                              }}
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={handleAddExternalUrl}
                            disabled={isLoadingExternalUrl || !externalUrlInput.trim()}
                          >
                            {isLoadingExternalUrl ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => { setShowArticleSelector(false); setArticleSelectorSearch(""); }}
                      >
                        Done
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowArticleSelector(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Articles
                    </Button>
                  )}
                </div>
                
                <div className="flex justify-center pt-2">
                  <Button
                    size="lg"
                    onClick={handleCreateCustomIdea}
                    disabled={isFindingArticles || !customIdeaText.trim()}
                  >
                    {isFindingArticles ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Finding articles...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Find Articles & Create Idea
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Ideas Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <span>Quick Ideas</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleRefreshQuickIdeas}
                    disabled={isGeneratingQuickIdeas || articles.length < 5}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${isGeneratingQuickIdeas ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </CardTitle>
                <CardDescription>
                  AI-generated post ideas based on your recent articles. Click one to generate a post instantly.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isGeneratingQuickIdeas ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Generating ideas...</span>
                  </div>
                ) : quickIdeas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Loading ideas from your recent articles...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {quickIdeas.map((idea, index) => (
                      <QuickIdeaCard
                        key={idea.id || index}
                        idea={idea}
                        index={index}
                        onSelect={() => handleSelectQuickIdea(idea)}
                        onUpdate={(updates) => handleUpdateQuickIdea(index, updates)}
                        onRemoveSource={(sourceIndex) => handleRemoveSourceFromIdea(index, sourceIndex)}
                        onDelete={() => handleDeleteQuickIdea(index)}
                        allArticles={articles}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Select Articles Card */}
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
            </>
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
