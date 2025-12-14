export type ModelProvider = 'gpt' | 'gemini';

export function normalizeProvider(value: unknown): ModelProvider {
  return value === 'gemini' ? 'gemini' : 'gpt';
}
