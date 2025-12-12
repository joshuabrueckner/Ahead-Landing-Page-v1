import OpenAI from 'openai';

type JsonSchemaLike<T> = {
  parse: (value: unknown) => T;
};

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set.');
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey });
  }

  return cachedClient;
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

async function createChatCompletion(options: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  responseFormat?: any;
  timeoutMs?: number;
}): Promise<any> {
  const client = getClient();
  const timeoutMs = options.timeoutMs ?? 20000;
  const signal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
    ? (AbortSignal as any).timeout(timeoutMs)
    : undefined;
  const baseRequest: any = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature,
    ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
    ...(signal ? { signal } : {}),
  };

  // OpenAI model families differ on token limit parameter naming.
  // Some newer models (e.g. `gpt-5.2`) reject `max_tokens` and require `max_completion_tokens`.
  // We'll try `max_completion_tokens` first, then fall back to `max_tokens`.
  try {
    return await client.chat.completions.create({
      ...baseRequest,
      ...(options.maxOutputTokens ? { max_completion_tokens: options.maxOutputTokens } : {}),
    });
  } catch (error: any) {
    const msg = String(error?.message || '');
    if (msg.includes('max_completion_tokens') || msg.includes('Unsupported parameter')) {
      return await client.chat.completions.create({
        ...baseRequest,
        ...(options.maxOutputTokens ? { max_tokens: options.maxOutputTokens } : {}),
      });
    }
    throw error;
  }
}

export async function openaiGenerateText(options: {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  const model = options.model || getOpenAIModel();
  const completion = await createChatCompletion({
    model,
    messages: [
      ...(options.system ? [{ role: 'system', content: options.system } as const] : []),
      { role: 'user', content: options.prompt },
    ],
    temperature: options.temperature,
    maxOutputTokens: options.maxOutputTokens,
    timeoutMs: options.timeoutMs,
  });

  return completion.choices?.[0]?.message?.content?.trim() ?? '';
}

function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through
  }

  // Try to extract the first JSON object/array from the response.
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

export async function openaiGenerateJson<T>(schema: JsonSchemaLike<T>, options: {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<T> {
  const model = options.model || getOpenAIModel();
  const system =
    (options.system ? `${options.system}\n\n` : '') +
    'Return ONLY valid JSON. No markdown. No commentary.';

  // First try: ask the API for JSON output (when supported).
  let raw = '';
  try {
    const completion = await createChatCompletion({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: options.prompt },
      ],
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
      timeoutMs: options.timeoutMs,
      responseFormat: { type: 'json_object' },
    });
    raw = completion.choices?.[0]?.message?.content?.trim() ?? '';
  } catch {
    // Fallback: plain text + local parsing.
    raw = await openaiGenerateText({
      ...options,
      system,
      model,
    });
  }

  const parsed = tryParseJson(raw);
  if (parsed !== null) {
    try {
      return schema.parse(parsed);
    } catch (error: any) {
      console.warn('[openaiGenerateJson] Schema validation failed; attempting repair', {
        model,
        rawLength: raw.length,
        rawSnippet: raw.slice(0, 300),
      });
      const validationMessage =
        typeof error?.message === 'string' && error.message.trim() ? error.message : 'Schema validation failed.';

      const repairCompletion = await createChatCompletion({
        model,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content:
              `The JSON below does NOT pass validation. Fix it to match the required shape implied by the original prompt.\n` +
              `Do not omit required top-level keys; if a key is required, include it even if empty.\n` +
              `Return ONLY valid JSON.\n\n` +
              `VALIDATION ERROR:\n${validationMessage}\n\n` +
              `ORIGINAL PROMPT (for shape/rules):\n${options.prompt}\n\n` +
              `JSON TO FIX:\n${JSON.stringify(parsed)}`,
          },
        ],
        temperature: 0,
        maxOutputTokens: options.maxOutputTokens,
        timeoutMs: options.timeoutMs,
        responseFormat: { type: 'json_object' },
      });

      const repaired = repairCompletion.choices?.[0]?.message?.content?.trim() ?? '';

      const repairedParsed = tryParseJson(repaired);
      if (repairedParsed === null) {
        throw new Error('Model did not return valid JSON.');
      }

      return schema.parse(repairedParsed);
    }
  }

  // One-shot repair attempt: ask the model to fix its own output into valid JSON.
  console.warn('[openaiGenerateJson] JSON parse failed; attempting repair', {
    model,
    rawLength: raw.length,
    rawSnippet: raw.slice(0, 300),
  });
  const repairCompletion = await createChatCompletion({
    model,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content:
          `Fix the following into valid JSON that matches the required shape implied by the original prompt.\n` +
          `Do not omit required top-level keys; if a key is required, include it even if empty.\n` +
          `Return ONLY valid JSON.\n\n` +
          `ORIGINAL PROMPT (for shape/rules):\n${options.prompt}\n\n` +
          `BROKEN OUTPUT:\n${raw}`,
      },
    ],
    temperature: 0,
    maxOutputTokens: options.maxOutputTokens,
    timeoutMs: options.timeoutMs,
    responseFormat: { type: 'json_object' },
  });

  const repaired = repairCompletion.choices?.[0]?.message?.content?.trim() ?? '';

  const repairedParsed = tryParseJson(repaired);
  if (repairedParsed === null) {
    throw new Error('Model did not return valid JSON.');
  }

  return schema.parse(repairedParsed);
}
