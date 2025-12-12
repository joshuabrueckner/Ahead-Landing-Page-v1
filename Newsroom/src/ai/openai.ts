import OpenAI from 'openai';

type JsonSchemaLike<T> = {
  parse: (value: unknown) => T;
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

export async function openaiGenerateText(options: {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  const client = getClient();
  const model = options.model || getOpenAIModel();

  const baseRequest = {
    model,
    messages: [
      ...(options.system ? [{ role: 'system' as const, content: options.system }] : []),
      { role: 'user' as const, content: options.prompt },
    ],
    temperature: options.temperature,
  };

  // OpenAI model families differ on token limit parameter naming.
  // Some newer models (e.g. `gpt-5.2`) reject `max_tokens` and require `max_completion_tokens`.
  // We'll try `max_completion_tokens` first, then fall back to `max_tokens`.
  let completion: Awaited<ReturnType<typeof client.chat.completions.create>>;
  try {
    completion = await client.chat.completions.create({
      ...(baseRequest as any),
      ...(options.maxOutputTokens ? { max_completion_tokens: options.maxOutputTokens } : {}),
    } as any);
  } catch (error: any) {
    const msg = String(error?.message || '');
    if (msg.includes('max_completion_tokens') || msg.includes('Unsupported parameter')) {
      completion = await client.chat.completions.create({
        ...(baseRequest as any),
        ...(options.maxOutputTokens ? { max_tokens: options.maxOutputTokens } : {}),
      } as any);
    } else {
      throw error;
    }
  }

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
}): Promise<T> {
  const raw = await openaiGenerateText({
    ...options,
    system:
      (options.system ? `${options.system}\n\n` : '') +
      'Return ONLY valid JSON. No markdown. No commentary.',
  });

  const parsed = tryParseJson(raw);
  if (parsed === null) {
    throw new Error('Model did not return valid JSON.');
  }

  return schema.parse(parsed);
}
