import { NextResponse } from 'next/server';
import { SchemaType, type ResponseSchema } from '@google/generative-ai';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getGemini, callWithCascade } from '@/lib/gemini/client';
import { trackGeminiUsage } from '@/lib/gemini/track-usage';

export const runtime = 'nodejs';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

type RouteContext = { params: Promise<{ id: string }> };

const responseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    explanation_md: {
      type: SchemaType.STRING,
      description:
        'Понятное объяснение правила на русском в markdown: короткие абзацы, **жирным** ключевые термины, при необходимости списки. Для русскоязычного студента A2-B1.',
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
      description: '4-6 примеров-предложений с переводом на русский, иллюстрирующих правило',
    },
    tags: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Уровень CEFR (A1/A2/B1/B2) и 1-2 темы на русском (напр. «времена», «падежи»)',
    },
  },
  required: ['explanation_md', 'examples', 'tags'],
};

export async function POST(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const db = getSupabaseAdmin();

  const { data: note, error: fetchErr } = await db
    .from('grammar_notes')
    .select('id, title, explanation, examples, tags')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) return err('DB_ERROR', fetchErr.message, 500);
  if (!note) return err('NOT_FOUND', 'Правило не найдено', 404);

  const prompt = `Ты — преподаватель немецкого языка для русскоязычного студента (A2-B1).
Обогати грамматическое правило: сделай объяснение ясным и структурированным, добавь показательные примеры.

ТЕМА: ${note.title}
ТЕКУЩЕЕ ОБЪЯСНЕНИЕ: ${note.explanation || '(пусто — напиши объяснение с нуля по теме)'}

Задачи:
1. explanation_md — понятное объяснение на русском (markdown, короткие абзацы, **жирным** ключевые термины). Сохрани верные факты из текущего объяснения, дополни и структурируй.
2. examples — 4-6 предложений на немецком с переводом, наглядно показывающих правило.
3. tags — уровень CEFR и 1-2 темы на русском.`;

  type Enriched = {
    explanation_md: string;
    examples: { de: string; ru: string }[];
    tags: string[];
  };

  let enriched: Enriched | null = null;
  try {
    const { result } = await callWithCascade(async (modelName) => {
      const model = getGemini().getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      });
      const res = await model.generateContent(prompt);
      const data = JSON.parse(res.response.text()) as Enriched;
      void trackGeminiUsage(res.response.usageMetadata, 'grammar-enrich', modelName);
      return data;
    });
    enriched = result;
  } catch (e) {
    const raw = e instanceof Error ? e.message : 'Ошибка генерации';
    let userMsg = raw;
    if (/429|quota|rate.?limit/i.test(raw)) {
      userMsg = 'Все модели Gemini достигли лимита. Попробуй позже.';
    } else if (/503|overload|unavailable/i.test(raw)) {
      userMsg = 'Gemini временно перегружен. Попробуй через минуту.';
    }
    return err('GEMINI_ERROR', userMsg, 503);
  }

  if (!enriched?.explanation_md) return err('GEMINI_ERROR', 'Пустой ответ модели', 502);

  const { data: updated, error: updateErr } = await db
    .from('grammar_notes')
    .update({
      explanation: enriched.explanation_md,
      examples: enriched.examples ?? note.examples ?? null,
      // объединяем старые и новые теги без дублей
      tags: Array.from(new Set([...(note.tags ?? []), ...(enriched.tags ?? [])])),
    })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (updateErr) return err('DB_ERROR', updateErr.message, 500);

  return NextResponse.json({ grammar_note: updated });
}
