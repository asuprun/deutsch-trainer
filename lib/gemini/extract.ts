import 'server-only';
import { getGemini, GEMINI_MODEL } from './client';
import {
  EXTRACT_SYSTEM_PROMPT,
  extractResponseSchema,
  extractPayloadSchema,
  type ExtractPayload,
} from './prompts';

const MAX_ATTEMPTS = 3;
const RATE_LIMIT_DELAY_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ExtractFromImageResult = {
  payload: ExtractPayload;
  attempts: number;
  latencyMs: number;
};

export async function extractFromImage(
  image: { buffer: Buffer; mimeType: string },
): Promise<ExtractFromImageResult> {
  const base64 = image.buffer.toString('base64');
  const model = getGemini().getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: EXTRACT_SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: extractResponseSchema,
      temperature: 0.3,
      maxOutputTokens: 8192,
    },
  });

  const started = Date.now();
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await model.generateContent([
        { text: 'Извлеки учебный материал со скриншота. Верни строго JSON по схеме.' },
        { inlineData: { mimeType: image.mimeType, data: base64 } },
      ]);
      const text = res.response.text();
      const parsed = JSON.parse(text);
      const validated = extractPayloadSchema.parse(parsed);
      return { payload: validated, attempts: attempt, latencyMs: Date.now() - started };
    } catch (e: unknown) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const isRateLimit = /429|rate.?limit|quota/i.test(msg);
      const isLastAttempt = attempt === MAX_ATTEMPTS;
      if (isRateLimit && !isLastAttempt) {
        await sleep(RATE_LIMIT_DELAY_MS);
        continue;
      }
      if (isLastAttempt) break;
    }
  }

  const detail = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`Gemini extract failed after ${MAX_ATTEMPTS} attempts: ${detail}`);
}
