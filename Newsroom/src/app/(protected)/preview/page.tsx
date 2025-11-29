
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AppLogo } from '@/components/icons';
import { Loader, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { GenerateNewsletterEmailContentOutput } from '@/ai/flows/generate-newsletter-email-content';
import { sendToLoopsAction } from '../../actions';
import { useToast } from '@/hooks/use-toast';
import { getBasePath, withBasePath } from '@/lib/base-path';

function generateHtml(content: GenerateNewsletterEmailContentOutput, subject: string, introSentence: string) {
  let html = `<div style="font-family: Arial, Helvetica, sans-serif; color: #333; max-width: 600px; margin: 0 auto; background-color: #fdf9f1; padding: 20px;">`;
  
  html += `<h1 style="font-family: Arial, Helvetica, sans-serif; font-size: 28px; font-weight: bold; margin-bottom: 8px; text-align: center;">${subject}</h1>`;
  html += `<p style="font-size: 14px; color: #666; margin-top: 0; margin-bottom: 24px; text-align: center;">by Joshua Brueckner</p>`;
  html += `<img src="https://jumpahead.ai/The-Daily-Get-Ahead-Header.png" alt="The Daily Get Ahead" style="width: 100%; max-width: 600px; margin-bottom: 24px; border-radius: 8px;" />`;
  
  // Greeting and Intro
  html += `<p style="font-size: 16px; line-height: 1.6;">Good morning!</p>`;
  html += `<p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">${introSentence}</p>`;

  // Featured Headline Section
  html += '<h2 style="font-size: 20px; font-weight: bold; margin-top: 32px; margin-bottom: 16px; border-bottom: 1px solid #eee; padding-bottom: 8px;"></h2>';
  html += `<h2><a href="${content.featuredHeadline.link}" style="color: #1a73e8; text-decoration: none;">${content.featuredHeadline.headline}</a></h2>`;
  if (content.featuredHeadline.imageUrl) {
    html += `<p><img src="${content.featuredHeadline.imageUrl}" alt="${content.featuredHeadline.headline}" style="width: 100%; max-width: 600px; height: auto; border-radius: 8px;" /></p>`;
    html += `<p style="font-size: 14px; color: #666; text-align: center;"><a href="${content.featuredHeadline.link}" style="color: #666; text-decoration: none;">Image source</a></p>`;
  }
  html += `<h3 style="font-size: 16px; font-weight: bold; margin-top: 20px; margin-bottom: 8px;">What's Happening</h3><p style="font-size: 16px; line-height: 1.6;">${content.featuredHeadline.whatsHappening}</p>`;
  html += `<h3 style="font-size: 16px; font-weight: bold; margin-top: 20px; margin-bottom: 8px;">Why You Should Care</h3><p style="font-size: 16px; line-height: 1.6;">${content.featuredHeadline.whyYouShouldCare}</p>`;

  // Other Headlines
  html += "<h2 style=\"font-size: 20px; font-weight: bold; margin-top: 32px; margin-bottom: 16px; border-bottom: 1px solid #eee; padding-bottom: 8px;\">Quick Hits</h2><ul>";
  content.headlines.forEach(h => {
    html += `<li style="margin-bottom: 12px;"><a href="${h.link}" style="color: #1a73e8; text-decoration: none; font-size: 16px;">${h.headline}</a></li>`;
  });
  html += '</ul>';

  // Launches
  html += '<h2 style=\"font-size: 20px; font-weight: bold; margin-top: 32px; margin-bottom: 16px; border-bottom: 1px solid #eee; padding-bottom: 8px;\">Trending AI Launches</h2><ul>';
  content.launches.forEach(l => {
    html += `<li style="margin-bottom: 12px; font-size: 16px;"><b><a href="${l.link}" style="color: #1a73e8; text-decoration: none;">${l.name}</a></b>: ${l.sentence}</li>`;
  });
  html += '</ul>';

  // AI Tip
  html += '<h2 style=\"font-size: 20px; font-weight: bold; margin-top: 32px; margin-bottom: 16px; border-bottom: 1px solid #eee; padding-bottom: 8px;\">Get Ahead: Our Daily AI Tip</h2>';
  html += `<p style="font-size: 16px; line-height: 1.6;">${content.aheadTip}</p>`;

  html += '</div>';
  return html;
}


export default function PreviewPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [subject, setSubject] = useState('');
  const [introSentence, setIntroSentence] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [content, setContent] = useState<GenerateNewsletterEmailContentOutput | null>(null);
  const [basePath, setBasePath] = useState<string>(() => getBasePath());

  useEffect(() => {
    const storedPreview = localStorage.getItem('newsletterPreview');
    if (storedPreview) {
      try {
        const { content: parsedContent, subject: parsedSubject, introSentence: parsedIntro } = JSON.parse(storedPreview);
        setContent(parsedContent);
        setSubject(parsedSubject || '');
        setIntroSentence(parsedIntro || '');
      } catch (e) {
        console.error("Failed to parse newsletter preview from localStorage", e);
        router.push(withBasePath('/refine', getBasePath()));
      }
    } else {
      router.push(withBasePath('/refine', getBasePath()));
    }
    setIsLoading(false);
  }, [router]);

  useEffect(() => {
    const resolved = getBasePath();
    if (resolved !== basePath) {
      setBasePath(resolved);
    }
  }, [basePath]);

  useEffect(() => {
    if (content) {
      const subjectForHtml = subject;
      setHtmlContent(generateHtml(content, subjectForHtml, introSentence));

      // Also update localStorage when subject or introSentence changes
      const storedPreview = localStorage.getItem('newsletterPreview');
      if (storedPreview) {
        try {
            const parsed = JSON.parse(storedPreview);
            parsed.subject = subject;
            parsed.introSentence = introSentence;
            localStorage.setItem("newsletterPreview", JSON.stringify(parsed));
        } catch(e) {
            console.error("Could not update preview in localStorage", e);
        }
      }
    }
  }, [content, subject, introSentence]);

  const handleSend = async () => {
    if (!content) {
      toast({ variant: 'destructive', title: 'Error', description: 'Content not loaded.' });
      return;
    }
    setIsSending(true);
    const result = await sendToLoopsAction(subject, introSentence, content);
    setIsSending(false);
    if (result.success) {
      toast({ title: 'Success', description: 'Newsletter sent to Loops successfully!' });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to send to Loops.' });
    }
  };

  if (isLoading || !content) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="w-8 h-8 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="bg-secondary min-h-screen">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AppLogo className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground font-headline">
              Newsletter Preview
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push(withBasePath('/refine', getBasePath()))} disabled={isSending}>
                Back to Edit
            </Button>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? (
                <Loader className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send Newsletter
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
             <CardHeader>
                <CardTitle className="text-xl font-headline">Email Preview</CardTitle>
                <CardDescription>This is how the newsletter will look in your subscribers' inbox.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg shadow-sm overflow-hidden">
                <div className="p-6 space-y-4 bg-card">
                  <div className="space-y-2">
                      <Label htmlFor="subject" className="font-semibold text-muted-foreground">Subject:</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🗣</span>
                        <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="text-lg font-medium"/>
                      </div>
                  </div>
                </div>
                 <div className="border-t">
                    <div 
                        className="email-preview-content p-6"
                        dangerouslySetInnerHTML={{ __html: htmlContent }} 
                    />
                 </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
