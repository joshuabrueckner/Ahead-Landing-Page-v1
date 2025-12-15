type JsonSchemaLike<T> = {
  parse: (value: unknown) => T;
};

export function getGeminiModel(): string {
  const raw = (process.env.GEMINI_MODEL || '').trim();
  if (!raw) return 'gemini-2.0-flash';

  // Accept common prefixes from other integrations.
  let model = raw;
  if (model.startsWith('models/')) model = model.slice('models/'.length);
  if (model.startsWith('googleai/')) model = model.slice('googleai/'.length);

  return model || 'gemini-2.0-flash';
}

function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');
  return apiKey;
}

function toModelPath(modelName: string): string {
  const trimmed = modelName.trim();
  if (!trimmed) return 'models/gemini-2.0-flash';
  if (trimmed.startsWith('models/')) return trimmed;
  return `models/${trimmed}`;
}

async function geminiGenerateContentViaRest(options: {
  model: string;
  prompt: string;
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<any> {
  const apiKey = getGeminiApiKey();
  const modelPath = toModelPath(options.model);

  const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body: any = {
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
  };

  if (options.system?.trim()) {
    body.systemInstruction = {
      role: 'system',
      parts: [{ text: options.system }],
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const messageFromApi =
      typeof json?.error?.message === 'string'
        ? json.error.message
        : typeof json?.message === 'string'
          ? json.message
          : text?.slice(0, 800) || '';

    throw new Error(
      `Gemini REST error (${res.status} ${res.statusText}) for model='${options.model}': ${messageFromApi}`
    );
  }

  return json;
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
  const modelName = options.model || getGeminiModel();
  const debug = process.env.NEWSROOM_DEBUG_GEMINI === '1';

  const response = await geminiGenerateContentViaRest({
    model: modelName,
    prompt: options.prompt,
    system: options.system,
    temperature: options.temperature,
    maxOutputTokens: options.maxOutputTokens,
  });

  const candidates = response?.candidates;
  const first = Array.isArray(candidates) && candidates.length ? candidates[0] : null;

  const joinedFromParts = (() => {
    const parts = first?.content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) return '';
    const joined = parts
      .map((p: any) => {
        if (typeof p?.text === 'string') return p.text;
        // Some model variants may return nested shapes.
        if (typeof p?.content === 'string') return p.content;
        return '';
      })
      .join('')
      .trim();
    return joined;
  })();

  // Additional best-effort fallbacks for preview/variant responses.
  const joinedFallback = (() => {
    const maybe = [
      first?.text,
      first?.output,
      first?.outputText,
      first?.content?.text,
      response?.text,
      response?.outputText,
    ].find((v) => typeof v === 'string' && v.trim());
    return typeof maybe === 'string' ? maybe.trim() : '';
  })();

  const joined = joinedFromParts || joinedFallback;
  if (joined) return joined;

  const finishReason = first?.finishReason;
  const promptFeedback = response?.promptFeedback;
  const safetyRatings = first?.safetyRatings;

  if (debug) {
    console.warn('[geminiGenerateText] Empty output (REST)', {
      model: modelName,
      finishReason,
      promptFeedback,
      safetyRatings,
      candidates: Array.isArray(candidates) ? candidates.length : 0,
      firstKeys: first && typeof first === 'object' ? Object.keys(first) : null,
      contentKeys: first?.content && typeof first.content === 'object' ? Object.keys(first.content) : null,
      partsKeys:
        Array.isArray(first?.content?.parts) && first.content.parts.length
          ? first.content.parts.slice(0, 3).map((p: any) => (p && typeof p === 'object' ? Object.keys(p) : []))
          : null,
    });
  }

  const base =
    `Gemini returned empty output (model='${modelName}'). ` +
    `finishReason=${finishReason ?? 'unknown'}. ` +
    `promptFeedback=${promptFeedback ? JSON.stringify(promptFeedback) : 'null'}. `;

  if (finishReason === 'MAX_TOKENS') {
    throw new Error(
      base +
        `The model hit the output limit but no text was extractable from the response. ` +
        `Try increasing maxOutputTokens for this prompt, or set NEWSROOM_DEBUG_GEMINI=1 to inspect response shape.`
    );
  }

  throw new Error(
    base +
      `This usually means the model name is unavailable for your key/project, ` +
      `or the response was blocked by safety.`
  );
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
