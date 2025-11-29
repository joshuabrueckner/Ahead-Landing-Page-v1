"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Lightbulb, Sparkles, Loader2 } from "lucide-react";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type AiTipSectionProps = {
  selectedTip: string;
  setSelectedTip: (tip: string) => void;
};

export default function AiTipSection({ selectedTip, setSelectedTip }: AiTipSectionProps) {
  const [tipDraft, setTipDraft] = useState(selectedTip ?? "");
  const [isTransforming, setIsTransforming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTipDraft(selectedTip ?? "");
  }, [selectedTip]);

  const handleManualChange = (value: string) => {
    setTipDraft(value);
    setSelectedTip(value);
    setError(null);
  };

  const handleTransform = async () => {
    if (!tipDraft.trim()) {
      setError("Add some context before transforming the tip.");
      return;
    }

    setIsTransforming(true);
    setError(null);

    try {
      const response = await fetch("/api/transform-tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: tipDraft }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.tip) {
        throw new Error(data?.error || "Failed to transform tip.");
      }

      setTipDraft(data.tip);
      setSelectedTip(data.tip);
    } catch (err: any) {
      setError(err?.message || "Unable to transform tip right now.");
    } finally {
      setIsTransforming(false);
    }
  };

  const charCount = tipDraft.length;
  const exceedsTarget = charCount > 300;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <Lightbulb className="w-8 h-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-headline">Daily AI Tip</CardTitle>
              <CardDescription>
                Paste your raw notes, then use AI to polish them into a confident, sub-300 character tip.
              </CardDescription>
            </div>
          </div>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  className="h-10 rounded-full px-4 flex items-center gap-2"
                  onClick={handleTransform}
                  disabled={isTransforming}
                >
                  {isTransforming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isTransforming ? "Transforming" : "Polish with AI"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Gemini will rewrite this tip within 300 characters.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={tipDraft}
          onChange={(event) => handleManualChange(event.target.value)}
          placeholder="Paste meeting notes, messy drafts, or yesterday's automation win..."
          rows={5}
        />
      </CardContent>
      <CardFooter className="bg-secondary/50 p-4 border-t text-sm text-muted-foreground flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className={exceedsTarget ? "text-destructive font-medium" : undefined}>
          {`Characters: ${charCount}${exceedsTarget ? " (trim closer to 300)" : " / target 300"}`}
        </span>
        {error && <span className="text-destructive">{error}</span>}
        {!error && selectedTip && !exceedsTarget && (
          <span className="text-foreground">Tip ready for the newsletter.</span>
        )}
        {!selectedTip && !error && <span>No tip set yet.</span>}
      </CardFooter>
    </Card>
  );
}
