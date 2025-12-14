import 'server-only';

import { getAdminFirestore } from '@/firebase/admin';

export type PromptContent = {
  template: string;
  system?: string;
};

type CacheEntry = {
  value: PromptContent;
  expiresAt: number;
};

const PROMPTS_COLLECTION = 'Prompts';
const DEFAULT_TTL_MS = 60_000;

const cache = new Map<string, CacheEntry>();

export async function getPromptContent(
  promptId: string,
  defaults: PromptContent,
  options?: { ttlMs?: number }
): Promise<PromptContent> {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const now = Date.now();

  const cached = cache.get(promptId);
  if (cached && cached.expiresAt > now) return cached.value;

  try {
    const db = getAdminFirestore();
    const snap = await db.collection(PROMPTS_COLLECTION).doc(promptId).get();

    if (!snap.exists) {
      cache.set(promptId, { value: defaults, expiresAt: now + ttlMs });
      return defaults;
    }

    const data = snap.data() as any;
    const template = typeof data?.template === 'string' && data.template.trim() ? data.template : defaults.template;
    const system = typeof data?.system === 'string' && data.system.trim() ? data.system : defaults.system;

    const value: PromptContent = { template, ...(system ? { system } : {}) };
    cache.set(promptId, { value, expiresAt: now + ttlMs });
    return value;
  } catch (error) {
    console.warn(`Prompt lookup failed for ${promptId}; using defaults.`, error);
    cache.set(promptId, { value: defaults, expiresAt: now + ttlMs });
    return defaults;
  }
}

export function renderPrompt(template: string, vars: Record<string, unknown>): string {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, key: string) => {
    const value = (vars as any)?.[key];
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  });
}
