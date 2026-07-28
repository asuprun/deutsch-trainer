import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { ablaut, patternLabel } from '@/lib/verbs/ablaut';

export const runtime = 'nodejs';

/**
 * Группировка глаголов по аблаут-паттерну (типу чередования гласной).
 * Возвращает группы, отсортированные по размеру (большие — самые полезные).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sourceId = url.searchParams.get('source_id');

  const sb = getSupabaseAdmin();
  let query = sb
    .from('cards')
    .select('id, front, back, forms')
    .eq('word_type', 'verb')
    .not('forms->>praeteritum', 'is', null)
    .not('forms->>partizip_2', 'is', null);
  if (sourceId) query = query.eq('source_id', sourceId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }

  const groups = new Map<string, { key: string; vowels: [string, string, string] | null; verbs: unknown[] }>();
  for (const card of data ?? []) {
    const forms = (card.forms ?? {}) as { infinitiv?: string; praeteritum?: string; partizip_2?: string; hilfsverb?: string };
    const { key, vowels } = ablaut(forms, card.front);
    const g = groups.get(key) ?? groups.set(key, { key, vowels, verbs: [] }).get(key)!;
    g.verbs.push({ id: card.id, front: card.front, back: card.back, forms });
  }

  const result = [...groups.values()]
    .map((g) => ({ ...g, label: patternLabel(g.key), count: g.verbs.length }))
    // Сначала большие настоящие паттерны; служебные (gemischt/unklar) — в конец
    .sort((a, b) => {
      const svc = (k: string) => (k === 'gemischt' || k === 'unklar' ? 1 : 0);
      return svc(a.key) - svc(b.key) || b.count - a.count;
    });

  return NextResponse.json({ patterns: result, total: (data ?? []).length });
}
