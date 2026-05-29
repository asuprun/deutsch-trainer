import 'server-only';
import { GoogleGenerativeAI } from '@google/generative-ai';

let cached: GoogleGenerativeAI | null = null;

export function getGemini(): GoogleGenerativeAI {
  if (!cached) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is missing');
    cached = new GoogleGenerativeAI(key);
  }
  return cached;
}

export const GEMINI_MODEL = 'gemini-2.5-flash-lite';
export const GEMINI_FALLBACK_MODEL = 'gemini-2.0-flash-lite';

/**
 * Каскад моделей по приоритету.
 * При 429 (квота) или 404 (модель удалена) переключаемся на следующую.
 * Каждая даёт ~1500 RPD free → суммарно ~6000 RPD/день.
 *
 * Лимиты free tier:
 *   gemini-2.5-flash-lite — RPM: 10, RPD: ~1500
 *   gemini-2.5-flash      — RPM: 10, RPD: ~1500
 *   gemini-2.0-flash      — RPM: 10, RPD: 1500
 *   gemini-2.0-flash-lite — RPM: 10, RPD: 1500
 */
export const GEMINI_CASCADE = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
] as const;

/** Пропускаем модель при 429 (квота) или 404 (модель устарела/удалена) */
function isSkippable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|Too Many Requests|quota|rate.?limit|404|not found/i.test(msg);
}

/**
 * Вызывает fn(modelName) для каждой модели из GEMINI_CASCADE по порядку.
 * Переключается на следующую модель при 429 или 404.
 * Прочие ошибки пробрасываются немедленно.
 *
 * Возвращает { result, modelUsed } — какая модель ответила.
 */
export async function callWithCascade<T>(
  fn: (modelName: string) => Promise<T>,
): Promise<{ result: T; modelUsed: string }> {
  let lastError: unknown;
  for (const modelName of GEMINI_CASCADE) {
    try {
      const result = await fn(modelName);
      return { result, modelUsed: modelName };
    } catch (e) {
      lastError = e;
      if (!isSkippable(e)) throw e; // Неизвестная ошибка — пробрасываем сразу
      // 429 / 404 → пробуем следующую модель
    }
  }
  throw lastError;
}
