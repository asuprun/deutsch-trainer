import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import type { CardJson } from '@/lib/fsrs/scheduler';
import { firstCloze } from '@/lib/verbs/prep-cloze';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 500;

// «Trudnoe» — wie im allgemeinen Leech-Filter: hohe FSRS-Schwierigkeit ODER ein Fehler.
const HARD_MIN_DIFFICULTY = 7; // FSRS-Skala 1..10
const HARD_MIN_LAPSES = 1;

type Rektion = { prep: string; kasus: string };
type Example = { de: string; ru: string };
type VerbGroup = {
  ids: string[]; front: string; back: string; examples: Example[]; rektionen: Rektion[];
  hard: boolean; hardness: number;
};

/**
 * Verben mit fester Präposition (forms.praeposition gesetzt) für den Rektions-Drill.
 * Karten werden PRO VERB (front) gruppiert: ein Verb kann mehrere Rektionen haben
 * (z.B. erzählen von+Dativ / über+Akkusativ). Der Drill akzeptiert dann jede gültige
 * Rektion, statt eine bestimmte zu erzwingen. `limit` zählt Verben, nicht Karten.
 * `hard=1` — nur Verben, bei denen man sich oft irrt (nach Schwierigkeit sortiert).
 * `mode=cloze` — nur Verben mit brauchbarem Beispielsatz; gefiltert VOR dem Limit,
 * damit «10 Karten» auch wirklich 10 Aufgaben ergibt.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, limitRaw), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const sourceId = url.searchParams.get('source_id');
  const hardOnly = url.searchParams.get('hard') === '1';
  const clozeOnly = url.searchParams.get('mode') === 'cloze';

  const sb = getSupabaseAdmin();

  let query = sb
    .from('cards')
    .select('id, front, back, forms, examples, fsrs_state, reps, lapses')
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
      g = { ids: [], front: c.front, back: c.back, examples: [], rektionen: [], hard: false, hardness: 0 };
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
    // Schwierigkeit: nur bereits geübte Karten (reps>0) zählen als «trudno»
    const difficulty = (c.fsrs_state as CardJson | null)?.difficulty ?? 0;
    const lapses = c.lapses ?? 0;
    if ((c.reps ?? 0) > 0 && (difficulty >= HARD_MIN_DIFFICULTY || lapses >= HARD_MIN_LAPSES)) g.hard = true;
    g.hardness = Math.max(g.hardness, difficulty + lapses * 2);
  }

  const groups = [...map.values()];
  const hasCloze = new Set(groups.filter((g) => firstCloze(g.examples, g.rektionen)));
  const byHardness = (a: VerbGroup, b: VerbGroup) => b.hardness - a.hardness;

  const base = clozeOnly ? groups.filter((g) => hasCloze.has(g)) : groups;
  const pool = hardOnly ? base.filter((g) => g.hard).sort(byHardness) : base;
  const verbs = pool.slice(0, limit);

  return NextResponse.json({
    verbs,
    total: groups.length,
    hardTotal: groups.filter((g) => g.hard).length,
    // Zähler für den Satz-Modus (nur Verben mit Beispielsatz)
    clozeTotal: hasCloze.size,
    clozeHardTotal: groups.filter((g) => g.hard && hasCloze.has(g)).length,
  });
}
