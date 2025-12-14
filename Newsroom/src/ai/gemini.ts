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
  const raw = (process.env.GEMINI_MODEL || '').trim();
  if (!raw) return 'gemini-2.0-flash';

  // Accept common prefixes from other integrations.
  let model = raw;
  if (model.startsWith('models/')) model = model.slice('models/'.length);
  if (model.startsWith('googleai/')) model = model.slice('googleai/'.length);

  return model || 'gemini-2.0-flash';
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

  const debug = process.env.NEWSROOM_DEBUG_GEMINI === '1';

  const extractText = (result: any): string => {
    const response = result?.response;
    const direct = response?.text?.();
    if (typeof direct === 'string' && direct.trim()) return direct.trim();

    const candidates = response?.candidates;
    if (Array.isArray(candidates) && candidates.length) {
      const first = candidates[0];
      const parts = first?.content?.parts;
      if (Array.isArray(parts) && parts.length) {
        const joined = parts
          .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
          .join('')
          .trim();
        if (joined) return joined;
      }
    }

    return '';
  };

  const generationConfig: any = {
    ...(typeof options.temperature === 'number' ? { temperature: options.temperature } : {}),
    ...(typeof options.maxOutputTokens === 'number' ? { maxOutputTokens: options.maxOutputTokens } : {}),
  };

  // Attempt 1: systemInstruction (best practice)
  const modelWithSystem = client.getGenerativeModel({
    model: modelName,
    ...(options.system ? { systemInstruction: options.system } : {}),
  } as any);

  const result1 = await modelWithSystem.generateContent(
    {
      contents: [
        {
          role: 'user',
          parts: [{ text: options.prompt }],
        },
      ],
      generationConfig,
    } as any
  );

  let text = extractText(result1);

  // Attempt 2 (fallback): some model variants / SDK versions behave oddly with systemInstruction.
  // If we got empty output, retry by inlining system + prompt in a single user message.
  if (!text && options.system?.trim()) {
    const modelNoSystem = client.getGenerativeModel({ model: modelName } as any);
    const combined = `${options.system.trim()}\n\n${options.prompt}`;
    const result2 = await modelNoSystem.generateContent(
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: combined }],
          },
        ],
        generationConfig,
      } as any
    );
    text = extractText(result2);

    if (!text && debug) {
      const r = (result2 as any)?.response;
      console.warn('[geminiGenerateText] Empty output after fallback', {
        model: modelName,
        hasCandidates: Array.isArray(r?.candidates) ? r.candidates.length : 0,
        promptFeedback: r?.promptFeedback,
        firstCandidateFinishReason: r?.candidates?.[0]?.finishReason,
      });
    }
  }

  if (!text) {
    const r = (result1 as any)?.response;
    const finishReason = r?.candidates?.[0]?.finishReason;
    const promptFeedback = r?.promptFeedback;
    const hint =
      `Gemini returned empty output (model='${modelName}'). ` +
      `This is often caused by an invalid/unavailable model name, missing access to that model, ` +
      `a blocked response (safety), or an API-key/project restriction.`;

    if (debug) {
      console.warn('[geminiGenerateText] Empty output', {
        model: modelName,
        finishReason,
        promptFeedback,
        hasCandidates: Array.isArray(r?.candidates) ? r.candidates.length : 0,
      });
    }

    throw new Error(hint);
  }

  return text;
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
