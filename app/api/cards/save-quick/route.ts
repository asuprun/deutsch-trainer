import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createEmptyCard } from 'ts-fsrs';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const cardInput = z.object({
  front: z.string().min(1).max(500),
  back: z.string().min(1).max(2000),
  word_type: z.string().max(40).optional().nullable(),
  gender: z.string().max(10).optional().nullable(),
  plural: z.string().max(200).optional().nullable(),
  forms: z.record(z.string(), z.unknown()).optional().nullable(),
  examples: z.array(z.object({ de: z.string(), ru: z.string() })).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional().nullable(),
});

const bodySchema = z.object({
  title: z.string().min(1).max(500),
  // Общие теги применяются ко всем картам партии (уровень, тема)
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  cards: z.array(cardInput).min(1).max(250),
});

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return err('BAD_REQUEST', 'Invalid JSON', 400); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Bad request', 400);

  const { title, tags: commonTags, cards } = parsed.data;
  const sb = getSupabaseAdmin();

  // Нормализуем общие теги
  const sharedTags = commonTags.map((t) => t.trim()).filter(Boolean);

  // Create source row
  const imagePath = `quick_add_${Date.now()}`;
  const { data: sourceRow, error: srcErr } = await sb
    .from('sources')
    .insert({ title, image_path: imagePath, image_hash: null })
    .select('id')
    .single();

  if (srcErr || !sourceRow) {
    return err('DB_ERROR', srcErr?.message ?? 'source insert failed', 500);
  }

  const source_id = sourceRow.id;
  const now = new Date().toISOString();
  const emptyCard = createEmptyCard();
  const fsrsBase = JSON.parse(JSON.stringify(emptyCard));

  const cardRows = cards.map((c) => ({
    source_id,
    kind: 'vocab' as const,
    front: c.front,
    back: c.back,
    word_type: c.word_type ?? null,
    gender: c.gender ?? null,
    plural: c.plural ?? null,
    forms: c.forms ?? null,
    examples: c.examples ?? null,
    mnemonic: null,
    // Объединяем общие теги партии с тегами карты (без дублей)
    tags: Array.from(new Set([...sharedTags, ...(c.tags ?? [])])),
    fsrs_state: fsrsBase,
    due_at: fsrsBase.due ?? now,
  }));

  const { data: insertedCards, error: cardErr } = await sb
    .from('cards')
    .insert(cardRows)
    .select('id');

  if (cardErr) {
    return err('DB_ERROR', `cards insert: ${cardErr.message}`, 500);
  }

  const card_ids = (insertedCards ?? []).map((r) => r.id);

  return NextResponse.json({ source_id, card_ids, count: card_ids.length }, { status: 201 });
}
