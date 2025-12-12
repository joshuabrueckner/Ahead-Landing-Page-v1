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

function getCompletionText(completion: any): string {
  const message = completion?.choices?.[0]?.message;
  const content = message?.content;

  if (typeof content === 'string') return content;

  // Some SDK/model variants may represent content as parts.
  if (Array.isArray(content)) {
    const joined = content
      .map((part: any) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.content === 'string') return part.content;
        return '';
      })
      .join('');
    if (joined) return joined;
  }

  if (typeof completion?.output_text === 'string') return completion.output_text;

  return '';
}

function getCompletionMeta(completion: any) {
  const choice = completion?.choices?.[0];
  const message = choice?.message;
  return {
    finish_reason: choice?.finish_reason,
    refusal: message?.refusal,
  };
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

  // RequestOptions (2nd arg) is where `timeout`/`signal` belong in the OpenAI SDK.
  // Do NOT put `signal` into the JSON body (the API will reject it).
  const requestOptions: any = { timeout: timeoutMs };
  const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let abortTimer: any = null;
  if (abortController) {
    requestOptions.signal = abortController.signal;
    abortTimer = setTimeout(() => abortController.abort(), timeoutMs);
  }

  const baseRequest: any = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature,
    ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
  };

  // OpenAI model families differ on token limit parameter naming.
  // Some newer models (e.g. `gpt-5.2`) reject `max_tokens` and require `max_completion_tokens`.
  // We'll try `max_completion_tokens` first, then fall back to `max_tokens`.
  try {
    const request: any = {
      ...baseRequest,
      ...(options.maxOutputTokens ? { max_completion_tokens: options.maxOutputTokens } : {}),
    };
    const result = await (client.chat.completions.create as any)(request, requestOptions);
    return result;
  } catch (error: any) {
    const msg = String(error?.message || '');
    if (msg.includes('max_completion_tokens') || msg.includes('Unsupported parameter')) {
      const request: any = {
        ...baseRequest,
        ...(options.maxOutputTokens ? { max_tokens: options.maxOutputTokens } : {}),
      };
      const result = await (client.chat.completions.create as any)(request, requestOptions);
      return result;
    }
    throw error;
  } finally {
    if (abortTimer) clearTimeout(abortTimer);
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

  return getCompletionText(completion).trim();
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
  const requestedModel = options.model || getOpenAIModel();
  const fallbackModel = process.env.OPENAI_JSON_FALLBACK_MODEL || 'gpt-4o-mini';
  let model = requestedModel;
  const system =
    (options.system ? `${options.system}\n\n` : '') +
    'Return ONLY valid JSON. No markdown. No commentary.';

  const attemptOnce = async (attemptModel: string) => {
    // First try: ask the API for JSON output (when supported).
    let raw = '';
    try {
      const completion = await createChatCompletion({
        model: attemptModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: options.prompt },
        ],
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens,
        timeoutMs: options.timeoutMs,
        responseFormat: { type: 'json_object' },
      });
      raw = getCompletionText(completion).trim();
      if (!raw) {
        const meta = getCompletionMeta(completion);
        console.warn('[openaiGenerateJson] Empty JSON-mode completion; falling back', { model: attemptModel, ...meta });
        throw new Error('Empty completion content');
      }
    } catch {
      // Fallback: plain text + local parsing.
      raw = await openaiGenerateText({
        ...options,
        system,
        model: attemptModel,
      });
    }
    return raw;
  };

  let raw = await attemptOnce(model);
  if (!raw && model !== fallbackModel) {
    console.warn('[openaiGenerateJson] Empty output; switching to fallback model', { from: model, to: fallbackModel });
    model = fallbackModel;
    raw = await attemptOnce(model);
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

      let repaired = '';
      try {
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
        repaired = getCompletionText(repairCompletion).trim();
      } catch {
        repaired = await openaiGenerateText({
          model,
          system,
          prompt:
            `The JSON below does NOT pass validation. Fix it to match the required shape implied by the original prompt.\n` +
            `Do not omit required top-level keys; if a key is required, include it even if empty.\n` +
            `Return ONLY valid JSON.\n\n` +
            `VALIDATION ERROR:\n${validationMessage}\n\n` +
            `ORIGINAL PROMPT (for shape/rules):\n${options.prompt}\n\n` +
            `JSON TO FIX:\n${JSON.stringify(parsed)}`,
          temperature: 0,
          maxOutputTokens: options.maxOutputTokens,
          timeoutMs: options.timeoutMs,
        });
      }

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
  let repaired = '';
  try {
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
    repaired = getCompletionText(repairCompletion).trim();
  } catch {
    repaired = await openaiGenerateText({
      model,
      system,
      prompt:
        `Fix the following into valid JSON that matches the required shape implied by the original prompt.\n` +
        `Do not omit required top-level keys; if a key is required, include it even if empty.\n` +
        `Return ONLY valid JSON.\n\n` +
        `ORIGINAL PROMPT (for shape/rules):\n${options.prompt}\n\n` +
        `BROKEN OUTPUT:\n${raw}`,
      temperature: 0,
      maxOutputTokens: options.maxOutputTokens,
      timeoutMs: options.timeoutMs,
    });
  }

  const repairedParsed = tryParseJson(repaired);
  if (repairedParsed === null) {
    throw new Error('Model did not return valid JSON.');
  }

  return schema.parse(repairedParsed);
}
