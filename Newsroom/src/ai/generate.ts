import type { ModelProvider } from '@/ai/provider';
import { normalizeProvider } from '@/ai/provider';
import { geminiGenerateJson, geminiGenerateText } from '@/ai/gemini';
import { openaiGenerateJson, openaiGenerateText } from '@/ai/openai';

type JsonSchemaLike<T> = {
  parse: (value: unknown) => T;
};

export async function generateText(options: {
  provider?: ModelProvider;
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  const provider = normalizeProvider(options.provider);
  if (provider === 'gemini') {
    return geminiGenerateText({
      prompt: options.prompt,
      system: options.system,
      model: options.model,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
    });
  }

  return openaiGenerateText({
    prompt: options.prompt,
    system: options.system,
    model: options.model,
    temperature: options.temperature,
    maxOutputTokens: options.maxOutputTokens,
    timeoutMs: options.timeoutMs,
  });
}

export async function generateJson<T>(schema: JsonSchemaLike<T>, options: {
  provider?: ModelProvider;
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<T> {
  const provider = normalizeProvider(options.provider);
  if (provider === 'gemini') {
    return geminiGenerateJson(schema, {
      prompt: options.prompt,
      system: options.system,
      model: options.model,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
    });
  }

  return openaiGenerateJson(schema, {
    prompt: options.prompt,
    system: options.system,
    model: options.model,
    temperature: options.temperature,
    maxOutputTokens: options.maxOutputTokens,
    timeoutMs: options.timeoutMs,
  });
}
