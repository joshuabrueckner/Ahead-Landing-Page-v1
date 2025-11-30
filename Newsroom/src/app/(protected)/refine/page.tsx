
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AppLogo } from '@/components/icons';
import { generateEmailAction, generateSubjectLineAction, generateIntroSentenceAction } from '@/app/actions';
import { Loader, Pencil } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import type { NewsArticle, ProductLaunch } from "@/lib/data";
import type { GenerateNewsletterEmailContentOutput } from '@/ai/flows/generate-newsletter-email-content';
import { Textarea } from '@/components/ui/textarea';
import { getBasePath, withBasePath } from '@/lib/base-path';

type EditableFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isTextArea?: boolean;
  prefix?: string;
};

function EditableField({ label, value, onChange, isTextArea, prefix }: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);

  const handleSave = () => {
    onChange(currentValue);
    setIsEditing(false);
  };
  
  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  const InputComponent = isTextArea ? Textarea : Input;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="font-semibold text-foreground/90">{label}</Label>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSave}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsEditing(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>
      {isEditing ? (
        <div className="flex items-center gap-2">
          {prefix && <span className="text-muted-foreground">{prefix}</span>}
          <InputComponent
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            className="flex-grow"
            rows={isTextArea ? 3 : undefined}
          />
        </div>
      ) : (
        <div className="text-sm text-muted-foreground p-2 border border-transparent rounded-md min-h-[40px] flex items-center whitespace-pre-wrap">
          {prefix && <span className="mr-2">{prefix}</span>}
          {value || <Loader className="w-4 h-4 animate-spin" />}
        </div>
      )}
    </div>
  );
}


export default function RefinePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [basePath, setBasePath] = useState<string>(() => getBasePath());
  const [selections, setSelections] = useState<{
    selectedArticles: NewsArticle[];
    featuredArticle: NewsArticle | null;
    selectedProducts: ProductLaunch[];
    selectedTip: string;
  } | null>(null);
  const [generatedContent, setGeneratedContent] = useState<GenerateNewsletterEmailContentOutput | null>(null);
  const [generatedSubject, setGeneratedSubject] = useState<string>('');
  const [generatedIntro, setGeneratedIntro] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    const storedSelections = localStorage.getItem('newsletterSelections');
    if (storedSelections) {
      try {
        const parsed = JSON.parse(storedSelections);
        if (!parsed.featuredArticle && parsed.selectedArticles?.length > 0) {
            parsed.featuredArticle = parsed.selectedArticles[0];
        }
        setSelections(parsed);
      } catch (e) {
        router.push(withBasePath('/', getBasePath()));
      }
    } else {
      router.push(withBasePath('/', getBasePath()));
    }
  }, [router]);

  useEffect(() => {
    const resolved = getBasePath();
    if (resolved !== basePath) {
      setBasePath(resolved);
    }
  }, [basePath]);

  const handleGenerateContent = useCallback(async (currentSelections: any) => {
    if (!currentSelections) return;

    setIsGenerating(true);
    
    // Check if we have previous edits
    const storedPreview = localStorage.getItem('newsletterPreview');
    if (storedPreview) {
      try {
        const parsedPreview = JSON.parse(storedPreview);
        setGeneratedContent(parsedPreview.content);
        setGeneratedSubject(parsedPreview.subject);
        setGeneratedIntro(parsedPreview.introSentence);
        setIsGenerating(false);
        return;
      } catch (e) {
        console.error("Could not parse stored preview, regenerating.", e);
        localStorage.removeItem('newsletterPreview'); // Clear bad data
      }
    }

    setGeneratedContent(null);
    setGeneratedSubject('');
    setGeneratedIntro('');

    try {
      const { selectedArticles, selectedProducts, selectedTip, featuredArticle } = currentSelections;

      const sortedArticles = featuredArticle
        ? [featuredArticle, ...selectedArticles.filter(article => article.id !== featuredArticle.id)]
        : [...selectedArticles];

      const emailInput = {
        newsArticles: sortedArticles.map(({ title, summary, url, imageUrl }: NewsArticle) => ({
          title,
          summary: (summary && summary.trim()) ? summary : title,
          url,
          imageUrl: imageUrl || undefined,
        })),
        productLaunches: selectedProducts.map(({ name, description, url }: ProductLaunch) => ({ name, description, url })),
        aiTip: selectedTip,
      };

      const contentResult = await generateEmailAction(emailInput);

      if ('error' in contentResult) {
        throw new Error(contentResult.error);
      }

      const quickHitArticles = sortedArticles.slice(1);
      const overriddenHeadlines = contentResult.headlines.map((headline, index) => {
        const article = quickHitArticles[index];
        const summaryText = article?.summary?.trim();
        if (article && summaryText) {
          return {
            ...headline,
            headline: summaryText,
            link: article.url,
          };
        }
        return headline;
      });

      const overriddenLaunches = contentResult.launches.map((launch, index) => {
        const product = selectedProducts[index];
        const sentenceText = product?.summary?.trim();
        if (product && sentenceText) {
          return {
            ...launch,
            name: product.name,
            link: product.url,
            sentence: sentenceText,
          };
        }
        return launch;
      });

      const refinedContent = {
        ...contentResult,
        headlines: overriddenHeadlines,
        launches: overriddenLaunches,
      };

      setGeneratedContent(refinedContent);
      
      if (refinedContent.featuredHeadline.headline) {
        const subjectPromise = generateSubjectLineAction({ headline: refinedContent.featuredHeadline.headline });
        const introPromise = generateIntroSentenceAction({ headline: refinedContent.featuredHeadline.headline });

        const [subjectResult, introResult] = await Promise.all([subjectPromise, introPromise]);

        if ('error' in subjectResult) {
           console.warn("Could not generate subject line:", subjectResult.error);
           setGeneratedSubject(refinedContent.featuredHeadline.headline.substring(0, 50));
        } else {
          setGeneratedSubject(subjectResult.subject);
        }

        if ('error' in introResult) {
           console.warn("Could not generate intro sentence:", introResult.error);
           setGeneratedIntro("Here's what's happening in the world of AI.");
        } else {
          setGeneratedIntro(introResult.introSentence);
        }
      }
    } catch (error: any) {
      console.error("Error generating newsletter content:", error);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: error.message || "There was an error generating the newsletter content. Please try again.",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if (selections) {
      handleGenerateContent(selections);
    }
  }, [selections, handleGenerateContent]);

  const handlePreview = () => {
    if (isGenerating || !generatedContent) {
      toast({
        variant: "destructive",
        title: "Content Not Ready",
        description: "Please wait for the content to finish generating before previewing.",
      });
      return;
    }
    const previewData = {
      content: generatedContent,
      subject: generatedSubject,
      introSentence: generatedIntro,
    };
    localStorage.setItem("newsletterPreview", JSON.stringify(previewData));
    router.push(withBasePath('/preview', getBasePath()));
  };

  const handleFieldChange = (
    section: 'featuredHeadline' | 'headlines' | 'launches' | 'aheadTip',
    field: string,
    value: string,
    index?: number
  ) => {
    if (!generatedContent) return;
  
    setGeneratedContent(prev => {
      if (!prev) return null;
  
      const newContent = { ...prev };
  
      if (section === 'featuredHeadline') {
        newContent.featuredHeadline = { ...newContent.featuredHeadline, [field]: value } as any;
      } else if (section === 'headlines' && index !== undefined) {
        const newHeadlines = [...newContent.headlines];
        newHeadlines[index] = { ...newHeadlines[index], [field]: value };
        newContent.headlines = newHeadlines;
      } else if (section === 'launches' && index !== undefined) {
        const newLaunches = [...newContent.launches];
        newLaunches[index] = { ...newLaunches[index], [field]: value };
        newContent.launches = newLaunches;
      } else if (section === 'aheadTip') {
        newContent.aheadTip = value;
      }
      
      return newContent;
    });
  };

  const placeholderContent: GenerateNewsletterEmailContentOutput = {
    featuredHeadline: {
      headline: '',
      link: '',
      imageUrl: selections?.featuredArticle?.imageUrl || "https://picsum.photos/seed/placeholder/600/400",
      whatsHappening: '',
      whyYouShouldCare: '',
    },
    headlines: Array(4).fill({ headline: '', link: '' }),
    launches: Array(3).fill({ name: '', link: '', sentence: '' }),
    aheadTip: '',
  };

  const displayContent = generatedContent || placeholderContent;
  const featuredImage = displayContent.featuredHeadline.imageUrl || "https://picsum.photos/seed/placeholder/600/400";


  return (
    <div className="bg-secondary min-h-screen">
       <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AppLogo className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground font-headline">
              Refine Newsletter
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push(withBasePath('/', getBasePath()))}> 
              Back
            </Button>
            <Button disabled={isGenerating || !generatedContent} onClick={handlePreview}>
               {isGenerating && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              Preview
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
           <Card>
            <CardHeader>
              <CardTitle className="text-xl font-headline">Refine Content</CardTitle>
              <CardDescription>
                {isGenerating 
                  ? "AI is generating your content... You can start editing as fields appear."
                  : "Edit the generated content below. Click the pencil icon to make changes."
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4 p-4 border rounded-lg bg-card shadow-sm">
                    <h4 className="font-semibold text-base">Intro</h4>
                     <EditableField 
                        label="Subject Line" 
                        value={generatedSubject}
                        onChange={setGeneratedSubject}
                        prefix="🗣"
                    />
                     <EditableField 
                        label="Intro Sentence" 
                        value={generatedIntro}
                        onChange={setGeneratedIntro}
                        isTextArea
                    />
                </div>
                
                <div className="pt-6">
                  <h3 className="text-lg font-semibold font-headline border-b pb-2">Featured</h3>
                </div>
                <div className="space-y-4 p-4 border rounded-lg bg-card shadow-sm">
                    <h4 className="font-semibold text-base">Headline #1 (Featured)</h4>
                    <div className="space-y-2">
                      <Label className="font-semibold text-foreground/90">Image</Label>
                      <div className="relative aspect-video w-full max-w-sm rounded-md overflow-hidden">
                        <Image 
                          src={featuredImage} 
                          alt={displayContent.featuredHeadline.headline || "Featured Article Image"} 
                          fill 
                          className="object-cover bg-muted"
                          unoptimized
                        />
                      </div>
                      <EditableField 
                        label="Image URL" 
                        value={featuredImage}
                        onChange={(value) => handleFieldChange('featuredHeadline', 'imageUrl', value)}
                      />
                    </div>
                    <EditableField 
                        label="Headline" 
                        value={displayContent.featuredHeadline.headline}
                        onChange={(value) => handleFieldChange('featuredHeadline', 'headline', value)}
                    />
                    <EditableField 
                        label="Link" 
                        value={displayContent.featuredHeadline.link}
                        onChange={(value) => handleFieldChange('featuredHeadline', 'link', value)}
                    />
                    <EditableField 
                        label="What's Happening" 
                        value={displayContent.featuredHeadline.whatsHappening}
                        onChange={(value) => handleFieldChange('featuredHeadline', 'whatsHappening', value)}
                        isTextArea
                    />
                    <EditableField 
                        label="Why You Should Care" 
                        value={displayContent.featuredHeadline.whyYouShouldCare}
                        onChange={(value) => handleFieldChange('featuredHeadline', 'whyYouShouldCare', value)}
                        isTextArea
                    />
                </div>
                
                <div className="pt-6">
                  <h3 className="text-lg font-semibold font-headline border-b pb-2">Quick Hits</h3>
                </div>
                {displayContent.headlines.map((item, index) => (
                    <div key={`headline-${index}`} className="space-y-4 p-4 border rounded-lg bg-card shadow-sm">
                        <h4 className="font-semibold text-base">Headline #{index + 2}</h4>
                        <EditableField 
                            label="Headline" 
                            value={item.headline}
                            onChange={(value) => handleFieldChange('headlines', 'headline', value, index)}
                        />
                        <EditableField 
                            label="Link" 
                            value={item.link}
                            onChange={(value) => handleFieldChange('headlines', 'link', value, index)}
                        />
                    </div>
                ))}
                <div className="pt-6">
                  <h3 className="text-lg font-semibold font-headline border-b pb-2">Trending AI Launches</h3>
                </div>
                {displayContent.launches.map((item, index) => (
                    <div key={`launch-${index}`} className="space-y-4 p-4 border rounded-lg bg-card shadow-sm">
                        <h4 className="font-semibold text-base">Product Launch #{index + 1}</h4>
                        <EditableField 
                            label="Name" 
                            value={item.name}
                            onChange={(value) => handleFieldChange('launches', 'name', value, index)}
                        />
                         <EditableField 
                            label="Link" 
                            value={item.link}
                            onChange={(value) => handleFieldChange('launches', 'link', value, index)}
                        />
                        <EditableField 
                            label="Sentence" 
                            value={item.sentence}
                            onChange={(value) => handleFieldChange('launches', 'sentence', value, index)}
                        />
                    </div>
                ))}
                <div className="pt-6">
                  <h3 className="text-lg font-semibold font-headline border-b pb-2">Get Ahead: Our Daily AI Tip</h3>
                </div>
                <div className="space-y-4 p-4 border rounded-lg bg-card shadow-sm">
                    <h4 className="font-semibold text-base">AI Tip</h4>
                    <EditableField 
                        label="Tip" 
                        value={displayContent.aheadTip}
                        onChange={(value) => {
                            if (!generatedContent) return;
                            setGeneratedContent(prev => prev ? { ...prev, aheadTip: value } : null);
                        }}
                        isTextArea
                    />
                </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
