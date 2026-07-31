import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SchemaType, type ResponseSchema } from '@google/generative-ai';
import { getGemini, callWithCascade } from '@/lib/gemini/client';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { trackGeminiUsage } from '@/lib/gemini/track-usage';

export const runtime = 'nodejs';
export const maxDuration = 60;

const CACHE_TTL_DAYS = 7;
const MIN_WORDS = 5;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const bodySchema = z.object({ source_id: z.string().uuid(), fresh: z.boolean().optional() });

const responseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    text: { type: SchemaType.STRING, description: 'Полный связный немецкий текст (A2-B1) БЕЗ пропусков — со всеми словами на месте' },
    blanks: {
      type: SchemaType.ARRAY,
      description: 'Слова из колоды, которые встречаются в тексте и которые надо спрятать',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          surface: { type: SchemaType.STRING, description: 'Слово ТОЧНО в той форме, как оно стоит в тексте (напр. "benötigen", "Steuern")' },
          hint: { type: SchemaType.STRING, description: 'Русский перевод этого слова (подсказка)' },
        },
        required: ['surface', 'hint'],
      },
    },
    translation: { type: SchemaType.STRING, description: 'Перевод всего текста на русский' },
  },
  required: ['text', 'blanks', 'translation'],
};

/** Ставит пропуски ___ на месте слов server-side (не доверяем Gemini расстановку) */
function makeBlanks(text: string, blanks: { surface: string; hint: string }[]) {
  const items = blanks
    .map((b) => ({ ...b, surface: (b.surface ?? '').trim() }))
    .filter((b) => b.surface)
    .map((b) => ({ ...b, pos: text.indexOf(b.surface) }))
    .filter((b) => b.pos >= 0)
    .sort((a, b) => a.pos - b.pos);

  let out = '';
  let cursor = 0;
  const answers: string[] = [];
  const hints: string[] = [];
  for (const it of items) {
    if (it.pos < cursor) continue; // перекрытие — пропускаем
    out += text.slice(cursor, it.pos) + '___';
    answers.push(it.surface);
    hints.push(it.hint ?? '');
    cursor = it.pos + it.surface.length;
  }
  out += text.slice(cursor);
  return { text: out, answers, hints };
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return err('BAD_REQUEST', 'Invalid JSON', 400); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Bad request', 400);
  const { source_id, fresh } = parsed.data;

  const db = getSupabaseAdmin();

  // ── Кэш (мягкий: если таблицы нет — просто пропускаем) ──────────────────────
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CACHE_TTL_DAYS);
  if (!fresh) try {
    const { data: cached } = await db
      .from('deck_cloze_cache')
      .select('cloze')
      .eq('source_id', source_id)
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached?.cloze && Array.isArray(cached.cloze.answers) && cached.cloze.answers.length > 0) {
      return NextResponse.json({ ...cached.cloze, cached: true });
    }
  } catch { /* таблицы может не быть — генерируем заново */ }

  // ── Данные колоды ───────────────────────────────────────────────────────────
  const { data: source } = await db.from('sources').select('title').eq('id', source_id).maybeSingle();
  const { data: cards, error: cErr } = await db
    .from('cards')
    .select('front, back, word_type')
    .eq('source_id', source_id)
    .in('kind', ['vocab', 'phrase'])
    .limit(40);
  if (cErr) return err('DB_ERROR', cErr.message, 500);
  if (!cards || cards.length < MIN_WORDS) {
    return err('TOO_FEW', `В колоде нужно минимум ${MIN_WORDS} слов для текста`, 400);
  }

  const wordList = cards.map((c) => `${c.front} — ${c.back}`).join('\n');
  const theme = source?.title || 'разные темы';

  const prompt = `Ты — преподаватель немецкого для русскоязычного студента (A2-B1).
Напиши связный, естественный немецкий текст (5-8 предложений) по теме этой колоды, используя как можно больше слов из списка (8-14 слов).

ТЕМА: ${theme}

СЛОВА КОЛОДЫ (немецкий — русский):
${wordList}

ТРЕБОВАНИЯ:
- text: ПОЛНЫЙ связный текст на немецком со всеми словами на месте (НЕ ставь никаких пропусков и «___» — пиши обычный текст).
- blanks: для 8-14 слов из списка, которые реально встречаются в тексте, укажи surface (слово ТОЧНО в той форме, как оно стоит в тексте — с той же заглавной буквой и окончанием) и hint (русский перевод).
- Спрятать нужно именно СЛОВА КОЛОДЫ, а не служебные слова.
- translation: перевод всего текста на русский.
- Текст должен читаться как цельный рассказ (5-8 предложений), а не набор фраз.`;

  try {
    const { result: data } = await callWithCascade(async (modelName) => {
      const model = getGemini().getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      });
      const res = await model.generateContent(prompt);
      const parsedRes = JSON.parse(res.response.text());
      void trackGeminiUsage(res.response.usageMetadata, 'deck-cloze', modelName);
      return parsedRes;
    });

    const rawText = String(data.text ?? '');
    const rawBlanks = (data.blanks ?? []).map((b: { surface?: string; hint?: string }) => ({
      surface: String(b?.surface ?? ''),
      hint: String(b?.hint ?? ''),
    }));
    const blanked = makeBlanks(rawText, rawBlanks);

    const cloze = {
      text: blanked.text,
      answers: blanked.answers,
      hints: blanked.hints,
      translation: String(data.translation ?? ''),
    };

    if (cloze.answers.length === 0) {
      return err('NO_BLANKS', 'Не удалось составить пропуски. Попробуй ещё раз.', 502);
    }

    // Кэшируем (fire-and-forget, мягко)
    void db.from('deck_cloze_cache').insert({ source_id, cloze }).then(({ error }) => {
      if (error) console.error('[deck-cloze] cache write:', error.message);
    });

    return NextResponse.json({ ...cloze, cached: false });
  } catch (e) {
    const raw = e instanceof Error ? e.message : 'Gemini error';
    console.error('[deck-cloze]', raw);
    let msg = raw;
    if (/503|overload|unavailable|high demand/i.test(raw)) msg = 'Gemini перегружен. Попробуй через минуту.';
    else if (/429|quota|rate.?limit/i.test(raw)) msg = 'Лимит Gemini. Попробуй позже.';
    return err('GEMINI_ERROR', msg, 503);
  }
}
