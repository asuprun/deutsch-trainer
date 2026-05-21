import { NextResponse } from 'next/server';
import { SchemaType, type ResponseSchema } from '@google/generative-ai';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getGemini, GEMINI_MODEL } from '@/lib/gemini/client';
import { trackGeminiUsage } from '@/lib/gemini/track-usage';

export const runtime = 'nodejs';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

type RouteContext = { params: Promise<{ id: string }> };

// ─── Gemini response schema ───────────────────────────────────────────────────

const responseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    word_type: {
      type: SchemaType.STRING,
      description: 'One of: noun, verb, adjective, adverb, preposition, conjunction, numeral, phrase, other',
    },
    gender: {
      type: SchemaType.STRING,
      description: 'For nouns only: der | die | das. Empty string otherwise.',
      nullable: true,
    },
    plural: {
      type: SchemaType.STRING,
      description: 'Plural form for nouns (e.g. "die Häuser"). Empty string if not a noun or unknown.',
      nullable: true,
    },
    back_corrected: {
      type: SchemaType.STRING,
      description: 'Corrected/improved Russian translation. Keep original if it is already accurate.',
    },
    tags: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Array of tags: CEFR level (A1/A2/B1/B2), and 1-2 topic categories in Russian (еда, путешествия, работа, семья, тело, природа, etc.)',
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
      description: '2-3 example sentences with Russian translations',
    },
  },
  required: ['word_type', 'back_corrected', 'tags', 'examples'],
};

// ─── Core enrichment logic ────────────────────────────────────────────────────

export async function enrichCard(cardId: string): Promise<{ card: Record<string, unknown> } | { error: { code: string; message: string } }> {
  const db = getSupabaseAdmin();

  const { data: card, error: fetchErr } = await db
    .from('cards')
    .select('id, front, back, kind, word_type')
    .eq('id', cardId)
    .maybeSingle();

  if (fetchErr) return { error: { code: 'DB_ERROR', message: fetchErr.message } };
  if (!card) return { error: { code: 'NOT_FOUND', message: 'Карта не найдена' } };

  const model = getGemini().getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.3,
      maxOutputTokens: 1024,
    },
  });

  const prompt = `Обогати немецкую карточку для обучения:

Слово/фраза (немецкий): "${card.front}"
Текущий перевод (русский): "${card.back}"
Тип карточки: ${card.kind}
Текущий тип слова: ${card.word_type ?? 'не определён'}

Задачи:
1. Определи точный word_type: noun/verb/adjective/adverb/preposition/conjunction/numeral/phrase/other
2. Если существительное — укажи gender (der/die/das) и plural (форму мн.ч.)
3. Проверь перевод и исправь в back_corrected если нужно (иначе верни как есть)
4. Добавь теги: уровень CEFR (A1/A2/B1/B2) и 1-2 тематики на русском
5. Составь 2-3 примера предложений с переводом на A2-B1 уровне`;

  type EnrichedData = {
    word_type: string;
    gender?: string | null;
    plural?: string | null;
    back_corrected: string;
    tags: string[];
    examples: { de: string; ru: string }[];
  };

  // Retry up to 3 attempts — Gemini 2.5 Flash sometimes fails on first try
  const MAX_ATTEMPTS = 3;
  let enriched: EnrichedData | null = null;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      enriched = JSON.parse(result.response.text()) as EnrichedData;
      void trackGeminiUsage(result.response.usageMetadata, 'enrich');
      lastError = null;
      break;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
  }

  if (!enriched || lastError) {
    const raw = lastError?.message ?? 'Ошибка генерации';
    let userMsg = raw;
    if (/429|Too Many Requests|quota|rate.?limit/i.test(raw)) {
      userMsg = 'Превышен лимит Gemini API. Попробуй позже (дневной лимит free-tier: 1500 запросов).';
    }
    return { error: { code: 'GEMINI_ERROR', message: userMsg } };
  }

  const updates: Record<string, unknown> = {
    word_type: enriched.word_type || card.word_type,
    back: enriched.back_corrected || card.back,
    tags: enriched.tags ?? [],
    examples: enriched.examples ?? [],
  };

  // Only update gender/plural for nouns
  if (enriched.word_type === 'noun') {
    updates.gender = enriched.gender || null;
    updates.plural = enriched.plural || null;
  }

  const { data: updated, error: updateErr } = await db
    .from('cards')
    .update(updates)
    .eq('id', cardId)
    .select('*')
    .maybeSingle();

  if (updateErr) return { error: { code: 'DB_ERROR', message: updateErr.message } };
  return { card: updated as Record<string, unknown> };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const result = await enrichCard(id);

  if ('error' in result) {
    const status = result.error.code === 'NOT_FOUND' ? 404 :
                   result.error.code === 'GEMINI_ERROR' ? 500 : 500;
    return err(result.error.code, result.error.message, status);
  }

  return NextResponse.json(result);
}
