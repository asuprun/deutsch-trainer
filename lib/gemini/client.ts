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

/**
 * Пропускаем модель и пробуем следующую при:
 *  - 429 (квота) / 404 (модель устарела)
 *  - 503/502/500/504 (перегрузка, временная недоступность)
 *  - сетевых сбоях и текстовых маркерах overload/unavailable
 */
function isSkippable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/\b(429|404|500|502|503|504)\b/.test(msg)) return true;
  return /Too Many Requests|quota|rate.?limit|not found|overload|unavailable|high demand|timeout|ECONNRESET|ETIMEDOUT|fetch failed/i.test(
    msg,
  );
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
