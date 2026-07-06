import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 500;

/**
 * Существительные с родом для дрилла der/die/das.
 * Не фильтруем по due_at — это практика, а не интервальное повторение,
 * но сортируем по due_at (сначала самые «созревшие»).
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
    .select('id, front, back, gender, plural, tags', { count: 'exact' })
    .eq('word_type', 'noun')
    .in('gender', ['der', 'die', 'das'])
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

  return NextResponse.json({
    cards: data ?? [],
    total: count ?? (data?.length ?? 0),
  });
}
