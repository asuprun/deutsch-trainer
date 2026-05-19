import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SchemaType, type ResponseSchema } from '@google/generative-ai';
import { getGemini, GEMINI_MODEL } from '@/lib/gemini/client';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// ─── Zod ─────────────────────────────────────────────────────────────────────

const bodySchema = z.object({
  grammar_note_id: z.string().uuid(),
  count: z.number().int().min(3).max(10).default(5),
});

// ─── Gemini schema ────────────────────────────────────────────────────────────

const responseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    exercises: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          sentence:    { type: SchemaType.STRING },
          answer:      { type: SchemaType.STRING },
          hint:        { type: SchemaType.STRING },
          explanation: { type: SchemaType.STRING },
        },
        required: ['sentence', 'answer', 'explanation'],
      },
    },
  },
  required: ['exercises'],
};

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return err('BAD_REQUEST', 'Invalid JSON', 400); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Bad request', 400);

  const { grammar_note_id, count } = parsed.data;
  const db = getSupabaseAdmin();

  const { data: note, error: dbErr } = await db
    .from('grammar_notes')
    .select('title, explanation, examples')
    .eq('id', grammar_note_id)
    .maybeSingle();

  if (dbErr) return err('DB_ERROR', dbErr.message, 500);
  if (!note) return err('NOT_FOUND', 'Grammar note not found', 404);

  const examplesStr =
    Array.isArray(note.examples) && note.examples.length
      ? `\nПРИМЕРЫ:\n${(note.examples as { de: string; ru: string }[])
          .map((e) => `${e.de} — ${e.ru}`)
          .join('\n')}`
      : '';

  const prompt = `Создай ${count} упражнений «заполни пропуск» для русскоязычного студента немецкого (A2-B1).

ТЕМА: ${note.title}
ПРАВИЛО: ${note.explanation}${examplesStr}

ТРЕБОВАНИЯ:
- sentence: немецкое предложение ровно с одним пропуском ___ (не больше одного)
- answer: одно слово — точная форма, которая должна стоять в предложении
- hint: краткая подсказка на русском (например: «вспомогательный глагол», «Akkusativ», «Perfekt»)
- explanation: объяснение ответа на русском, 1-2 предложения
- Задания разной сложности по данной теме
- Однозначный правильный ответ в каждом упражнении`.trim();

  try {
    const model = getGemini().getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.75,
        maxOutputTokens: 2048,
      },
    });

    const result = await model.generateContent(prompt);
    const data = JSON.parse(result.response.text());

    return NextResponse.json({ exercises: data.exercises ?? [] });
  } catch (e) {
    console.error('[grammar/exercises]', e);
    return err('GEMINI_ERROR', e instanceof Error ? e.message : 'Gemini error', 500);
  }
}
