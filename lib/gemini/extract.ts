import 'server-only';
import { getGemini, GEMINI_CASCADE } from './client';
import {
  EXTRACT_SYSTEM_PROMPT,
  extractResponseSchema,
  extractPayloadSchema,
  type ExtractPayload,
} from './prompts';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Транзиентные ошибки, которые имеет смысл повторить с задержкой:
 *  - 429 Too Many Requests
 *  - 5xx (Service Unavailable, Internal, Gateway Timeout)
 *  - сетевые ошибки fetch
 *  - текстовые маркеры "overloaded", "currently unavailable"
 */
function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/\b(429|500|502|503|504)\b/.test(msg)) return true;
  if (/rate.?limit|quota|overload|unavailable|timeout|ECONNRESET|ETIMEDOUT|fetch failed/i.test(msg)) {
    return true;
  }
  return false;
}

type Attempt = { model: string; preDelayMs: number };

// Каскад всех моделей: при 429 переключаемся на следующую (~6000 RPD суммарно)
const ATTEMPTS: Attempt[] = GEMINI_CASCADE.map((model) => ({ model, preDelayMs: 0 }));

export type ExtractFromImageResult = {
  payload: ExtractPayload;
  modelUsed: string;
  attempts: number;
  latencyMs: number;
};

async function callOnce(modelName: string, image: { buffer: Buffer; mimeType: string }) {
  const model = getGemini().getGenerativeModel({
    model: modelName,
    systemInstruction: EXTRACT_SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: extractResponseSchema,
      temperature: 0.3,
      maxOutputTokens: 16384,
    },
  });
  const res = await model.generateContent([
    { text: 'Извлеки учебный материал со скриншота. Верни строго JSON по схеме.' },
    { inlineData: { mimeType: image.mimeType, data: image.buffer.toString('base64') } },
  ]);
  const raw = res.response.text().trim();

  // Gemini иногда оборачивает JSON в markdown или добавляет лишний текст — вырезаем
  let jsonText = raw;
  if (!jsonText.startsWith('{')) {
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (match) jsonText = match[0];
  }

  const parsed = JSON.parse(jsonText);
  return extractPayloadSchema.parse(parsed);
}

export async function extractFromImage(image: {
  buffer: Buffer;
  mimeType: string;
}): Promise<ExtractFromImageResult> {
  const started = Date.now();
  let lastErr: unknown = null;

  for (let i = 0; i < ATTEMPTS.length; i++) {
    const { model: modelName, preDelayMs } = ATTEMPTS[i];
    if (preDelayMs > 0) await sleep(preDelayMs);

    try {
      const payload = await callOnce(modelName, image);
      return {
        payload,
        modelUsed: modelName,
        attempts: i + 1,
        latencyMs: Date.now() - started,
      };
    } catch (e: unknown) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[gemini] attempt ${i + 1}/${ATTEMPTS.length} (${modelName}) failed: ${msg.slice(0, 200)}`);
      if (!isTransient(e)) break;
    }
  }

  const detail = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`Gemini extract failed after ${ATTEMPTS.length} attempts: ${detail}`);
}
