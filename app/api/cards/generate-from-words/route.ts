import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SchemaType, type ResponseSchema } from '@google/generative-ai';
import { getGemini, callWithCascade } from '@/lib/gemini/client';

export const runtime = 'nodejs';
export const maxDuration = 60;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const bodySchema = z.object({
  words: z.array(z.string().min(1).max(200)).min(1).max(30),
});

const responseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    cards: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          front:     { type: SchemaType.STRING },
          back:      { type: SchemaType.STRING },
          word_type: { type: SchemaType.STRING },
          gender:    { type: SchemaType.STRING },
          plural:    { type: SchemaType.STRING },
          forms: {
            type: SchemaType.OBJECT,
            properties: {
              infinitiv:    { type: SchemaType.STRING },
              praeteritum:  { type: SchemaType.STRING },
              partizip_2:   { type: SchemaType.STRING },
              hilfsverb:    { type: SchemaType.STRING },
              trennbar:     { type: SchemaType.STRING },
              komparativ:   { type: SchemaType.STRING },
              superlativ:   { type: SchemaType.STRING },
            },
          },
          examples: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                de: { type: SchemaType.STRING },
                ru: { type: SchemaType.STRING },
              },
              required: ['de', 'ru'],
            },
          },
          tags: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
        },
        required: ['front', 'back', 'word_type', 'examples', 'tags'],
      },
    },
  },
  required: ['cards'],
};

const SYSTEM_PROMPT = `Ты — преподаватель немецкого языка. Для каждого переданного слова или фразы создай карточку. Для существительных укажи артикль в front (например: 'der Hund'), gender, plural. Для глаголов укажи forms: {infinitiv, praeteritum, partizip_2, hilfsverb, trennbar}. Для прилагательных — forms: {komparativ, superlativ} если неправильные. Перевод на русский в back. Добавь 1-2 примера. Верни JSON по схеме.`;

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return err('BAD_REQUEST', 'Invalid JSON', 400); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Bad request', 400);

  const { words } = parsed.data;

  const prompt = `${SYSTEM_PROMPT}\n\nСлова для создания карточек:\n${words.map((w, i) => `${i + 1}. ${w}`).join('\n')}`;

  try {
    const { result: data } = await callWithCascade(async (modelName) => {
      const model = getGemini().getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.5,
          maxOutputTokens: 4096,
        },
      });
      const res = await model.generateContent(prompt);
      return JSON.parse(res.response.text());
    });

    const cards = data.cards ?? [];
    return NextResponse.json({ cards });
  } catch (e) {
    console.error('[cards/generate-from-words]', e);
    return err('GEMINI_ERROR', e instanceof Error ? e.message : 'Gemini error', 500);
  }
}
