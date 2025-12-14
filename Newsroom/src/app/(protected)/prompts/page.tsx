import { DEFAULT_PROMPTS } from "@/lib/prompt-defaults";
import { getPromptContent } from "@/lib/prompts";
import PromptsClient from "./prompts-client";

export const maxDuration = 60;

export default async function PromptsPage() {
  const promptIds = Object.keys(DEFAULT_PROMPTS);
  const prompts = await Promise.all(
    promptIds.map(async (id) => {
      const defaults = DEFAULT_PROMPTS[id];
      const content = await getPromptContent(id, defaults);
      return {
        id,
        template: content.template,
        system: content.system,
        provider: content.provider ?? 'gpt',
        defaultTemplate: defaults.template,
        defaultSystem: defaults.system,
        defaultProvider: defaults.provider ?? 'gpt',
      };
    })
  );

  return <PromptsClient prompts={prompts} />;
}
