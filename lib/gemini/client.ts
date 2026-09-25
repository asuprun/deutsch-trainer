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

export const GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const GEMINI_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

/**
 * Modell-Kaskade nach Priorität; bei 429 (Kontingent), 404 (abgeschaltet),
 * 5xx oder abgeschnittenem JSON wird das nächste Modell versucht.
 * Jedes Modell hat ein eigenes Free-Tier-Tageskontingent.
 *
 * Stand 09/2026:
 *  - gemini-2.0-flash / -lite wurden von Google abgeschaltet (404) → entfernt
 *  - gemini-2.5-* haben nur noch ein sehr kleines Free-Kontingent (~20/Tag) → Reserve
 *  - gemini-3.5-flash (ohne lite) antwortet teils minutenlang nicht → nicht verwenden
 *  - die 3.x-lite-Modelle antworten in ~1 s und liefern sauberes JSON-Schema
 */
export const GEMINI_CASCADE = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
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
  // abgeschnittenes/kaputtes JSON (z.B. Token-Limit erreicht) → nächstes Modell probieren
  if (err instanceof SyntaxError) return true;
  return /Too Many Requests|quota|rate.?limit|not found|overload|unavailable|high demand|timeout|ECONNRESET|ETIMEDOUT|fetch failed|Unterminated string|Unexpected (token|end of JSON)/i.test(
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
