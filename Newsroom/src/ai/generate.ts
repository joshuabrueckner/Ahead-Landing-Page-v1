import type { ModelProvider } from '@/ai/provider';
import { normalizeProvider } from '@/ai/provider';
import { geminiGenerateJson, geminiGenerateText } from '@/ai/gemini';
import { getOpenAIModel, openaiGenerateJson, openaiGenerateText } from '@/ai/openai';
import { getGeminiModel } from '@/ai/gemini';
import crypto from 'crypto';

type JsonSchemaLike<T> = {
  parse: (value: unknown) => T;
};

type GenerateMeta = {
  promptId?: string;
  requestId?: string;
};

function isAiLogEnabled(): boolean {
  return process.env.NEWSROOM_AI_LOG !== '0';
}

function shortHash(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
  } catch {
    return undefined;
  }
}

function makeRequestId(): string {
  try {
    return crypto.randomBytes(8).toString('hex');
  } catch {
    return String(Date.now());
  }
}

export async function generateText(options: {
  provider?: ModelProvider;
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  meta?: GenerateMeta;
}): Promise<string> {
  const provider = normalizeProvider(options.provider);
  const requestId = options.meta?.requestId || makeRequestId();
  const startedAt = Date.now();

  const resolvedModel =
    options.model || (provider === 'gemini' ? getGeminiModel() : getOpenAIModel());

  const logEnabled = isAiLogEnabled();
  if (logEnabled) {
    console.log('[ai.generateText.start]', {
      requestId,
      provider,
      model: resolvedModel,
      promptId: options.meta?.promptId,
      promptChars: options.prompt?.length ?? 0,
      systemChars: options.system?.length ?? 0,
      promptHash: shortHash(options.prompt),
      systemHash: shortHash(options.system),
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
    });
  }

  if (provider === 'gemini') {
    try {
      const out = await geminiGenerateText({
        prompt: options.prompt,
        system: options.system,
        model: resolvedModel,
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens,
      });
      if (logEnabled) {
        console.log('[ai.generateText.ok]', {
          requestId,
          provider,
          model: resolvedModel,
          promptId: options.meta?.promptId,
          elapsedMs: Date.now() - startedAt,
          outputChars: out?.length ?? 0,
          outputHash: shortHash(out),
        });
      }
      return out;
    } catch (error: any) {
      if (logEnabled) {
        console.error('[ai.generateText.error]', {
          requestId,
          provider,
          model: resolvedModel,
          promptId: options.meta?.promptId,
          elapsedMs: Date.now() - startedAt,
          message: error?.message || String(error),
        });
      }
      throw error;
    }
  }

  try {
    const out = await openaiGenerateText({
      prompt: options.prompt,
      system: options.system,
      model: resolvedModel,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
      timeoutMs: options.timeoutMs,
    });
    if (logEnabled) {
      console.log('[ai.generateText.ok]', {
        requestId,
        provider,
        model: resolvedModel,
        promptId: options.meta?.promptId,
        elapsedMs: Date.now() - startedAt,
        outputChars: out?.length ?? 0,
        outputHash: shortHash(out),
      });
    }
    return out;
  } catch (error: any) {
    if (logEnabled) {
      console.error('[ai.generateText.error]', {
        requestId,
        provider,
        model: resolvedModel,
        promptId: options.meta?.promptId,
        elapsedMs: Date.now() - startedAt,
        message: error?.message || String(error),
      });
    }
    throw error;
  }
}

export async function generateJson<T>(schema: JsonSchemaLike<T>, options: {
  provider?: ModelProvider;
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  meta?: GenerateMeta;
}): Promise<T> {
  const provider = normalizeProvider(options.provider);
  const requestId = options.meta?.requestId || makeRequestId();
  const startedAt = Date.now();

  const resolvedModel =
    options.model || (provider === 'gemini' ? getGeminiModel() : getOpenAIModel());

  const logEnabled = isAiLogEnabled();
  if (logEnabled) {
    console.log('[ai.generateJson.start]', {
      requestId,
      provider,
      model: resolvedModel,
      promptId: options.meta?.promptId,
      promptChars: options.prompt?.length ?? 0,
      systemChars: options.system?.length ?? 0,
      promptHash: shortHash(options.prompt),
      systemHash: shortHash(options.system),
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
    });
  }

  if (provider === 'gemini') {
    try {
      const out = await geminiGenerateJson(schema, {
        prompt: options.prompt,
        system: options.system,
        model: resolvedModel,
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens,
      });
      if (logEnabled) {
        console.log('[ai.generateJson.ok]', {
          requestId,
          provider,
          model: resolvedModel,
          promptId: options.meta?.promptId,
          elapsedMs: Date.now() - startedAt,
        });
      }
      return out;
    } catch (error: any) {
      if (logEnabled) {
        console.error('[ai.generateJson.error]', {
          requestId,
          provider,
          model: resolvedModel,
          promptId: options.meta?.promptId,
          elapsedMs: Date.now() - startedAt,
          message: error?.message || String(error),
        });
      }
      throw error;
    }
  }

  try {
    const out = await openaiGenerateJson(schema, {
      prompt: options.prompt,
      system: options.system,
      model: resolvedModel,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
      timeoutMs: options.timeoutMs,
    });
    if (logEnabled) {
      console.log('[ai.generateJson.ok]', {
        requestId,
        provider,
        model: resolvedModel,
        promptId: options.meta?.promptId,
        elapsedMs: Date.now() - startedAt,
      });
    }
    return out;
  } catch (error: any) {
    if (logEnabled) {
      console.error('[ai.generateJson.error]', {
        requestId,
        provider,
        model: resolvedModel,
        promptId: options.meta?.promptId,
        elapsedMs: Date.now() - startedAt,
        message: error?.message || String(error),
      });
    }
    throw error;
  }
}
