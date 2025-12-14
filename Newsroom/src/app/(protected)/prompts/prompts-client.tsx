"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { resetPromptAction, savePromptAction } from "./actions";

type PromptEntry = {
  id: string;
  template: string;
  system?: string;
  provider: "gpt" | "gemini";
  defaultTemplate: string;
  defaultSystem?: string;
  defaultProvider: "gpt" | "gemini";
};

export default function PromptsClient({ prompts }: { prompts: PromptEntry[] }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const initialById = useMemo(() => {
    const map = new Map<string, PromptEntry>();
    for (const p of prompts) map.set(p.id, p);
    return map;
  }, [prompts]);

  const [drafts, setDrafts] = useState<Record<string, { template: string; system: string; provider: "gpt" | "gemini" }>>(() => {
    const out: Record<string, { template: string; system: string; provider: "gpt" | "gemini" }> = {};
    for (const p of prompts) {
      out[p.id] = { template: p.template ?? "", system: p.system ?? "", provider: p.provider ?? "gpt" };
    }
    return out;
  });

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

  const onSave = useCallback(
    (id: string) => {
      const draft = drafts[id];
      if (!draft) return;

      startTransition(async () => {
        try {
          await savePromptAction({
            id,
            template: draft.template,
            system: draft.system || undefined,
            provider: draft.provider,
          });
          toast({ title: "Saved", description: id });
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Save failed",
            description: error?.message || String(error),
          });
        }
      });
    },
    [drafts, startTransition, toast]
  );

  const onReset = useCallback(
    (id: string) => {
      startTransition(async () => {
        try {
          await resetPromptAction(id);
          const initial = initialById.get(id);
          setDrafts((prev) => ({
            ...prev,
            [id]: {
              template: initial?.defaultTemplate ?? "",
              system: initial?.defaultSystem ?? "",
              provider: initial?.defaultProvider ?? "gpt",
            },
          }));
          toast({ title: "Reset to default", description: id });
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Reset failed",
            description: error?.message || String(error),
          });
        }
      });
    },
    [initialById, startTransition, toast]
  );

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Prompts</h1>
        <p className="text-sm text-muted-foreground">
          Edit and save prompt templates used by the app.
        </p>
      </div>

      <div className="space-y-4">
        {prompts.map((p) => {
          const d = drafts[p.id] ?? { template: p.template ?? "", system: p.system ?? "", provider: p.provider ?? "gpt" };
          return (
            <Card key={p.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">{p.id}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" disabled={isPending} onClick={() => onReset(p.id)}>
                      Reset
                    </Button>
                    <Button disabled={isPending} onClick={() => onSave(p.id)}>
                      Save
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">provider</div>
                  <div className="max-w-[220px]">
                    <Select
                      value={d.provider}
                      onValueChange={(value) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [p.id]: { ...d, provider: value === "gemini" ? "gemini" : "gpt" },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt">gpt</SelectItem>
                        <SelectItem value="gemini">gemini</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">system</div>
                    <Button variant="secondary" onClick={() => copy(`${p.id} system`, d.system)}>
                      Copy
                    </Button>
                  </div>
                  <Textarea
                    value={d.system}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [p.id]: { ...d, system: e.target.value } }))
                    }
                    className="min-h-[120px] font-mono text-xs"
                    placeholder="(optional)"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">template</div>
                    <Button variant="secondary" onClick={() => copy(`${p.id} template`, d.template)}>
                      Copy
                    </Button>
                  </div>
                  <Textarea
                    value={d.template}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [p.id]: { ...d, template: e.target.value } }))
                    }
                    className="min-h-[260px] font-mono text-xs"
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
