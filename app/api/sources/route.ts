import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { fetchAll } from '@/lib/supabase/fetch-all';

export const runtime = 'nodejs';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET() {
  const db = getSupabaseAdmin();

  const [sourcesRes, cardsRes, grammarRes] = await Promise.all([
    db.from('sources').select('*').order('created_at', { ascending: false }),
    fetchAll((from, to) => db.from('cards').select('source_id').order('id').range(from, to)),
    db.from('grammar_notes').select('source_id'),
  ]);

  if (sourcesRes.error) return err('DB_ERROR', sourcesRes.error.message, 500);
  if (cardsRes.error) return err('DB_ERROR', cardsRes.error.message, 500);
  if (grammarRes.error) return err('DB_ERROR', grammarRes.error.message, 500);

  // Count cards per source
  const cardCounts: Record<string, number> = {};
  for (const row of cardsRes.data ?? []) {
    if (row.source_id) {
      cardCounts[row.source_id] = (cardCounts[row.source_id] ?? 0) + 1;
    }
  }

  // Count grammar_notes per source
  const grammarCounts: Record<string, number> = {};
  for (const row of grammarRes.data ?? []) {
    if (row.source_id) {
      grammarCounts[row.source_id] = (grammarCounts[row.source_id] ?? 0) + 1;
    }
  }

  const sources = (sourcesRes.data ?? []).map((s) => ({
    ...s,
    card_count: cardCounts[s.id] ?? 0,
    grammar_count: grammarCounts[s.id] ?? 0,
  }));

  return NextResponse.json({ sources });
}
