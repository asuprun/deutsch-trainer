import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { ablaut } from '@/lib/verbs/ablaut';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 500;

/**
 * Глаголы с заполненными формами (Präteritum + Partizip II) для дрилла форм.
 * Практика: «слабые вперёд» (по lapses), затем по расписанию.
 * ?pattern=e-a-o — только глаголы этого аблаут-паттерна.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, limitRaw), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const sourceId = url.searchParams.get('source_id');
  const pattern = url.searchParams.get('pattern');

  const sb = getSupabaseAdmin();

  let query = sb
    .from('cards')
    .select('id, front, back, forms, lapses', { count: 'exact' })
    .eq('word_type', 'verb')
    .not('forms->>praeteritum', 'is', null)
    .not('forms->>partizip_2', 'is', null)
    // «Слабые вперёд»: сначала чаще проваленные, затем самые созревшие по расписанию
    .order('lapses', { ascending: false })
    .order('due_at', { ascending: true });

  if (sourceId) query = query.eq('source_id', sourceId);
  // При фильтре по паттерну берём весь пул (фильтруем в JS), иначе — сразу лимит
  if (!pattern) query = query.limit(limit);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  let cards = data ?? [];
  let total = count ?? cards.length;
  if (pattern) {
    cards = cards.filter((c) => ablaut((c.forms ?? {}) as Record<string, string>, c.front).key === pattern);
    total = cards.length;
    cards = cards.slice(0, limit);
  }

  return NextResponse.json({ cards, total });
}
