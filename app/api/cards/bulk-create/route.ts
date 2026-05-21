import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createEmptyCard } from 'ts-fsrs';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const cardInput = z.object({
  kind: z.enum(['vocab', 'phrase', 'grammar_rule', 'sentence']),
  front: z.string().min(1).max(500),
  back: z.string().min(1).max(2000),
  word_type: z.string().max(40).optional().nullable(),
  gender: z.string().max(10).optional().nullable(),
  plural: z.string().max(200).optional().nullable(),
  forms: z.record(z.string(), z.unknown()).optional().nullable(),
  examples: z.array(z.object({ de: z.string(), ru: z.string() })).optional().nullable(),
  mnemonic: z.string().max(1000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional().nullable(),
});

const grammarInput = z.object({
  title: z.string().min(1).max(200),
  explanation: z.string().min(1).max(20000),
  examples: z.array(z.object({ de: z.string(), ru: z.string() })).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional().nullable(),
});

const bodySchema = z.object({
  source_id: z.string().uuid(),
  cards: z.array(cardInput).max(200).default([]),
  grammar_notes: z.array(grammarInput).max(50).default([]),
});

function err(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err('BAD_REQUEST', 'Invalid JSON', 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', 'Bad request shape', 400, parsed.error.flatten());
  }
  const { source_id, cards, grammar_notes } = parsed.data;

  if (cards.length === 0 && grammar_notes.length === 0) {
    return err('EMPTY', 'Нужна хотя бы одна карта или грамматическая заметка', 400);
  }

  const sb = getSupabaseAdmin();

  const { data: sourceRow, error: srcErr } = await sb
    .from('sources')
    .select('id')
    .eq('id', source_id)
    .maybeSingle();
  if (srcErr) return err('DB_ERROR', srcErr.message, 500);
  if (!sourceRow) return err('NOT_FOUND', 'source_id не найден', 404);

  const now = new Date().toISOString();
  const emptyCard = createEmptyCard();
  const fsrsBase = JSON.parse(JSON.stringify(emptyCard));

  const cardRows = cards.map((c) => ({
    source_id,
    kind: c.kind,
    front: c.front,
    back: c.back,
    word_type: c.word_type ?? null,
    gender: c.gender ?? null,
    plural: c.plural ?? null,
    forms: c.forms ?? null,
    examples: c.examples ?? null,
    mnemonic: c.mnemonic ?? null,
    tags: c.tags ?? [],
    fsrs_state: fsrsBase,
    due_at: fsrsBase.due ?? now,
  }));

  const grammarRows = grammar_notes.map((g) => ({
    source_id,
    title: g.title,
    explanation: g.explanation,
    examples: g.examples ?? null,
    tags: g.tags ?? [],
  }));

  const card_ids: string[] = [];
  const grammar_ids: string[] = [];

  if (cardRows.length > 0) {
    const { data, error } = await sb.from('cards').insert(cardRows).select('id');
    if (error) return err('DB_ERROR', `cards insert: ${error.message}`, 500);
    card_ids.push(...(data?.map((r) => r.id) ?? []));
  }

  if (grammarRows.length > 0) {
    const { data, error } = await sb.from('grammar_notes').insert(grammarRows).select('id');
    if (error) return err('DB_ERROR', `grammar insert: ${error.message}`, 500);
    grammar_ids.push(...(data?.map((r) => r.id) ?? []));

    // Дублируем грамматику как карты grammar_rule для повторения по FSRS
    const grammarCardRows = grammarRows.map((g) => ({
      source_id,
      kind: 'grammar_rule' as const,
      front: g.title,
      back: g.explanation.slice(0, 2000),
      examples: g.examples ?? null,
      tags: g.tags ?? [],
      fsrs_state: fsrsBase,
      due_at: fsrsBase.due ?? now,
      word_type: null,
      gender: null,
      plural: null,
      forms: null,
      mnemonic: null,
    }));
    const { data: gcData, error: gcErr } = await sb.from('cards').insert(grammarCardRows).select('id');
    if (gcErr) return err('DB_ERROR', `grammar cards insert: ${gcErr.message}`, 500);
    card_ids.push(...(gcData?.map((r) => r.id) ?? []));
  }

  return NextResponse.json(
    {
      source_id,
      card_ids,
      grammar_ids,
      counts: { cards: card_ids.length, grammar: grammar_ids.length },
    },
    { status: 201 },
  );
}
