"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type PromptEntry = {
  id: string;
  template: string;
  system?: string;
};

export default function PromptsClient({ prompts }: { prompts: PromptEntry[] }) {
  const { toast } = useToast();

  const copy = useCallback(
    async (label: string, value: string) => {
      const text = value ?? "";
      try {
        await navigator.clipboard.writeText(text);
        toast({ title: "Copied", description: label });
      } catch {
        toast({ variant: "destructive", title: "Copy failed", description: label });
      }
    },
    [toast]
  );

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Prompts</h1>
        <p className="text-sm text-muted-foreground">
          Copy the prompt templates used by the app.
        </p>
      </div>

      <div className="space-y-4">
        {prompts.map((p) => (
          <Card key={p.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{p.id}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {p.system ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">system</div>
                    <Button variant="secondary" onClick={() => copy(`${p.id} system`, p.system!)}>
                      Copy
                    </Button>
                  </div>
                  <Textarea readOnly value={p.system} className="min-h-[120px] font-mono text-xs" />
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">template</div>
                  <Button variant="secondary" onClick={() => copy(`${p.id} template`, p.template)}>
                    Copy
                  </Button>
                </div>
                <Textarea readOnly value={p.template} className="min-h-[260px] font-mono text-xs" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
