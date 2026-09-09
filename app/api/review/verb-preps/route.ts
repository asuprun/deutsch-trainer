import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 500;

/**
 * Verben mit fester Präposition (forms.praeposition gesetzt) für den Rektions-Drill.
 * Praxis: nach Fälligkeit sortiert (fällige zuerst), aber nicht danach gefiltert.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, limitRaw), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const sourceId = url.searchParams.get('source_id');

  const sb = getSupabaseAdmin();

  let query = sb
    .from('cards')
    .select('id, front, back, forms, examples', { count: 'exact' })
    .eq('word_type', 'verb')
    .not('forms->>praeposition', 'is', null)
    .neq('forms->>praeposition', '')
    .order('lapses', { ascending: false })
    .order('due_at', { ascending: true })
    .limit(limit);

  if (sourceId) query = query.eq('source_id', sourceId);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ cards: data ?? [], total: count ?? (data?.length ?? 0) });
}
