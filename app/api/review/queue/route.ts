import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { previewIntervals, type CardJson } from '@/lib/fsrs/scheduler';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, limitRaw), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const tag = url.searchParams.get('tag');

  const sb = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  let query = sb
    .from('cards')
    .select('id, kind, front, back, word_type, gender, plural, forms, examples, mnemonic, tags, fsrs_state, due_at, reps, lapses', { count: 'exact' })
    .lte('due_at', nowIso)
    .neq('kind', 'grammar_rule')   // грамматика тренируется в разделе «Грамматика»
    .order('due_at', { ascending: true })
    .limit(limit);

  if (tag) query = query.contains('tags', [tag]);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  const now = new Date();
  const queue = (data ?? []).map((card) => {
    const state = card.fsrs_state as CardJson | null;
    let intervals = null;
    if (state) {
      try {
        intervals = previewIntervals(state, now);
      } catch {
        intervals = null;
      }
    }
    return {
      ...card,
      intervals,
    };
  });

  return NextResponse.json({
    queue,
    due_count_total: count ?? queue.length,
  });
}
