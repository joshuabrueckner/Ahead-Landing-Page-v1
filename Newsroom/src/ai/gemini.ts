import { GoogleGenerativeAI } from '@google/generative-ai';

type JsonSchemaLike<T> = {
  parse: (value: unknown) => T;
};

let cachedClient: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set.');
  }
  if (!cachedClient) cachedClient = new GoogleGenerativeAI(apiKey);
  return cachedClient;
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-2.0-flash';
}

function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through
  }

  const firstBrace = trimmed.indexOf('{');
  const firstBracket = trimmed.indexOf('[');

  let start = -1;
  if (firstBrace === -1) start = firstBracket;
  else if (firstBracket === -1) start = firstBrace;
  else start = Math.min(firstBrace, firstBracket);

  if (start === -1) return null;

  const lastBrace = trimmed.lastIndexOf('}');
  const lastBracket = trimmed.lastIndexOf(']');
  const end = Math.max(lastBrace, lastBracket);
  if (end <= start) return null;

  const candidate = trimmed.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

export async function geminiGenerateText(options: {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  const client = getClient();
  const modelName = options.model || getGeminiModel();

  const model = client.getGenerativeModel({
    model: modelName,
    ...(options.system ? { systemInstruction: options.system } : {}),
  });

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [{ text: options.prompt }],
      },
    ],
    generationConfig: {
      ...(typeof options.temperature === 'number' ? { temperature: options.temperature } : {}),
      ...(typeof options.maxOutputTokens === 'number' ? { maxOutputTokens: options.maxOutputTokens } : {}),
    },
  } as any);

  const text = (result as any)?.response?.text?.() ?? '';
  return String(text).trim();
}

export async function geminiGenerateJson<T>(schema: JsonSchemaLike<T>, options: {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<T> {
  const system = (options.system ? `${options.system}\n\n` : '') + 'Return ONLY valid JSON. No markdown. No commentary.';

  const raw = await geminiGenerateText({
    ...options,
    system,
  });

  const parsed = tryParseJson(raw);
  if (parsed !== null) {
    try {
      return schema.parse(parsed);
    } catch (error: any) {
      const validationMessage =
        typeof error?.message === 'string' && error.message.trim() ? error.message : 'Schema validation failed.';

      const repaired = await geminiGenerateText({
        model: options.model,
        temperature: 0,
        maxOutputTokens: Math.max(options.maxOutputTokens ?? 0, 1200),
        system,
        prompt:
          `The JSON below does NOT pass validation. Fix it to match the required shape implied by the original prompt.\n` +
          `Do not omit required top-level keys; if a key is required, include it even if empty.\n` +
          `Return ONLY valid JSON.\n\n` +
          `VALIDATION ERROR:\n${validationMessage}\n\n` +
          `ORIGINAL PROMPT (for shape/rules):\n${options.prompt}\n\n` +
          `JSON TO FIX:\n${JSON.stringify(parsed)}`,
      });

      const repairedParsed = tryParseJson(repaired);
      if (repairedParsed === null) throw new Error('Model did not return valid JSON.');
      return schema.parse(repairedParsed);
    }
  }

  const repaired = await geminiGenerateText({
    model: options.model,
    temperature: 0,
    maxOutputTokens: Math.max(options.maxOutputTokens ?? 0, 1200),
    system,
    prompt:
      `Fix the following into valid JSON that matches the required shape implied by the original prompt.\n` +
      `Do not omit required top-level keys; if a key is required, include it even if empty.\n` +
      `Return ONLY valid JSON.\n\n` +
      `ORIGINAL PROMPT (for shape/rules):\n${options.prompt}\n\n` +
      `BROKEN OUTPUT:\n${raw}`,
  });

  const repairedParsed = tryParseJson(repaired);
  if (repairedParsed === null) throw new Error('Model did not return valid JSON.');
  return schema.parse(repairedParsed);
}
