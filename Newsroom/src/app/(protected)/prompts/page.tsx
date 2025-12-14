import { DEFAULT_PROMPTS } from "@/lib/prompt-defaults";
import { getPromptContent } from "@/lib/prompts";
import PromptsClient from "./prompts-client";

export const maxDuration = 60;

export default async function PromptsPage() {
  const promptIds = Object.keys(DEFAULT_PROMPTS);
  const prompts = await Promise.all(
    promptIds.map(async (id) => {
      const content = await getPromptContent(id, DEFAULT_PROMPTS[id]);
      return { id, ...content };
    })
  );

  return <PromptsClient prompts={prompts} />;
}
