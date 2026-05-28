import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SchemaType, type ResponseSchema } from '@google/generative-ai';
import { getGemini, callWithCascade } from '@/lib/gemini/client';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Кэш живёт 7 дней
const CACHE_TTL_DAYS = 7;

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
          lemma:       { type: SchemaType.STRING },
          hint:        { type: SchemaType.STRING },
          explanation: { type: SchemaType.STRING },
        },
        required: ['sentence', 'answer', 'lemma', 'explanation'],
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

  // ── Проверяем кэш ─────────────────────────────────────────────────────────

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CACHE_TTL_DAYS);

  const { data: cached } = await db
    .from('grammar_exercises_cache')
    .select('exercises')
    .eq('grammar_note_id', grammar_note_id)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached?.exercises) {
    return NextResponse.json({ exercises: cached.exercises, cached: true });
  }

  // ── Загружаем заметку из БД ───────────────────────────────────────────────

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
- lemma: базовая форма слова (инфинитив для глаголов, Nominativ Singular для существительных/прилагательных), которое нужно поставить в правильной форме. Это подсказка для студента — что искать в памяти. Например: если answer «ist» — lemma «sein»; если answer «einem» — lemma «ein»; если answer «schönen» — lemma «schön».
- hint: краткая грамматическая подсказка на русском (например: «Akkusativ», «Perfekt», «модальный глагол»). Не повторяй lemma.
- explanation: объяснение ответа на русском, 1-2 предложения
- Задания разной сложности по данной теме
- Однозначный правильный ответ в каждом упражнении`.trim();

  try {
    const { result: data } = await callWithCascade(async (modelName) => {
      const model = getGemini().getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.75,
          maxOutputTokens: 2048,
        },
      });
      const res = await model.generateContent(prompt);
      return JSON.parse(res.response.text());
    });

    const exercises = data.exercises ?? [];

    // ── Сохраняем в кэш (fire-and-forget) ────────────────────────────────────
    void db.from('grammar_exercises_cache')
      .insert({ grammar_note_id, exercises })
      .then(({ error }) => {
        if (error) console.error('[grammar/exercises] cache write error', error);
      });

    return NextResponse.json({ exercises, cached: false });
  } catch (e) {
    console.error('[grammar/exercises]', e);
    return err('GEMINI_ERROR', e instanceof Error ? e.message : 'Gemini error', 500);
  }
}
