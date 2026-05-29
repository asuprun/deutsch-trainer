import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SchemaType, type ResponseSchema } from '@google/generative-ai';
import { getGemini, callWithCascade } from '@/lib/gemini/client';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const CACHE_TTL_DAYS = 7;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// ─── Zod ─────────────────────────────────────────────────────────────────────

const bodySchema = z.object({
  grammar_note_id: z.string().uuid(),
  count: z.number().int().min(3).max(8).default(5),
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
          words:       { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          sentence:    { type: SchemaType.STRING },
          translation: { type: SchemaType.STRING },
          explanation: { type: SchemaType.STRING },
        },
        required: ['words', 'sentence', 'translation', 'explanation'],
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

  // ── Проверяем кэш ─────────────────────────────────────────────────────────

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CACHE_TTL_DAYS);

  const { data: cached } = await db
    .from('grammar_exercises_cache')
    .select('exercises')
    .eq('grammar_note_id', grammar_note_id)
    .eq('exercise_type', 'builder')
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached?.exercises) {
    // Перетасовываем слова заново при каждой отдаче из кэша
    type CachedEx = { sentence: string; words: string[]; translation: string; explanation: string };
    const exercises = (cached.exercises as CachedEx[]).map((ex) => {
      const words = [...ex.words];
      for (let i = words.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [words[i], words[j]] = [words[j], words[i]];
      }
      return { ...ex, words };
    });
    return NextResponse.json({ exercises, cached: true });
  }

  const examplesStr =
    Array.isArray(note.examples) && note.examples.length
      ? `\nПРИМЕРЫ:\n${(note.examples as { de: string; ru: string }[])
          .map((e) => `${e.de} — ${e.ru}`)
          .join('\n')}`
      : '';

  const prompt = `Создай ${count} упражнений «составь предложение» для русскоязычного студента немецкого (A2-B1).

ТЕМА: ${note.title}
ПРАВИЛО: ${note.explanation}${examplesStr}

ТРЕБОВАНИЯ:
- sentence: правильное немецкое предложение по данной теме. БЕЗ знаков препинания в конце (не добавляй точку, восклицательный или вопросительный знак).
- words: массив НЕ ИСПОЛЬЗУЕТСЯ — его значение будет вычислено автоматически. Передай просто пустой массив [].
- translation: перевод sentence на русский
- explanation: объяснение порядка слов / грамматики, 1-2 предложения на русском
- Предложения разной сложности, все связаны с темой`.trim();

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

    // Принудительно выводим words из sentence — не доверяем Gemini
    // Это исключает дистракторы и несовпадение знаков препинания
    const exercises = (data.exercises ?? []).map(
      (ex: { sentence: string; translation: string; explanation: string }) => {
        const sentence = ex.sentence.replace(/[.!?]+$/, '').trim();
        const words = sentence.split(' ');
        // Тасуем Fisher–Yates
        for (let i = words.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [words[i], words[j]] = [words[j], words[i]];
        }
        return { sentence, words, translation: ex.translation, explanation: ex.explanation };
      },
    );

    // ── Сохраняем в кэш (fire-and-forget) ──────────────────────────────────
    void db.from('grammar_exercises_cache')
      .insert({ grammar_note_id, exercise_type: 'builder', exercises })
      .then(({ error }) => {
        if (error) console.error('[grammar/sentence-builder] cache write error', error);
      });

    return NextResponse.json({ exercises, cached: false });
  } catch (e) {
    console.error('[grammar/sentence-builder]', e);
    return err('GEMINI_ERROR', e instanceof Error ? e.message : 'Gemini error', 500);
  }
}
