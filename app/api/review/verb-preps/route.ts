import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 500;

type Rektion = { prep: string; kasus: string };
type Example = { de: string; ru: string };
type VerbGroup = { ids: string[]; front: string; back: string; examples: Example[]; rektionen: Rektion[] };

/**
 * Verben mit fester Präposition (forms.praeposition gesetzt) für den Rektions-Drill.
 * Karten werden PRO VERB (front) gruppiert: ein Verb kann mehrere Rektionen haben
 * (z.B. erzählen von+Dativ / über+Akkusativ). Der Drill akzeptiert dann jede gültige
 * Rektion, statt eine bestimmte zu erzwingen. `limit` zählt Verben, nicht Karten.
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
    .select('id, front, back, forms, examples')
    .eq('word_type', 'verb')
    .not('forms->>praeposition', 'is', null)
    .neq('forms->>praeposition', '')
    .order('lapses', { ascending: false })
    .order('due_at', { ascending: true });

  if (sourceId) query = query.eq('source_id', sourceId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  // nach Verb gruppieren, Rektionen + Beispiele zusammenführen (Reihenfolge bleibt erhalten)
  const map = new Map<string, VerbGroup>();
  for (const c of data ?? []) {
    const key = (c.front ?? '').trim().toLowerCase();
    if (!key) continue;
    const forms = (c.forms ?? {}) as { praeposition?: string; kasus?: string };
    let g = map.get(key);
    if (!g) {
      g = { ids: [], front: c.front, back: c.back, examples: [], rektionen: [] };
      map.set(key, g);
    }
    g.ids.push(c.id);
    if (forms.praeposition) {
      const prep = forms.praeposition;
      if (!g.rektionen.some((r) => r.prep === prep && r.kasus === (forms.kasus ?? ''))) {
        g.rektionen.push({ prep, kasus: forms.kasus ?? '' });
      }
    }
    // Beispiele aller Geschwisterkarten sammeln (dedupe nach de)
    for (const e of (c.examples ?? []) as Example[]) {
      if (e?.de && !g.examples.some((x) => x.de === e.de)) g.examples.push(e);
    }
  }

  const verbs = [...map.values()].slice(0, limit);
  return NextResponse.json({ verbs, total: map.size });
}
