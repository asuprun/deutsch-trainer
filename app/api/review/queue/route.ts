import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { previewIntervals, type CardJson } from '@/lib/fsrs/scheduler';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 500;

// «Трудное» слово: высокая сложность по FSRS ИЛИ хотя бы один провал.
// (lapses почти всегда 0 — difficulty гораздо информативнее)
const HARD_MIN_DIFFICULTY = 7; // шкала FSRS 1..10
const HARD_MIN_LAPSES = 1;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, limitRaw), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const tag = url.searchParams.get('tag');
  const sourceId = url.searchParams.get('source_id');
  const leeches = url.searchParams.get('leeches') === '1';
  // all=1 — тренировать все карты, игнорируя расписание (для колоды, когда 0 «созрели»)
  const all = url.searchParams.get('all') === '1';

  const sb = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  // Basisabfrage mit gemeinsamen Filtern (Grammatik wird im Bereich «Grammatik» geübt)
  const base = () => {
    let q = sb
      .from('cards')
      .select('id, kind, front, back, word_type, gender, plural, forms, examples, mnemonic, tags, fsrs_state, due_at, reps, lapses', { count: 'exact' })
      .neq('kind', 'grammar_rule');
    if (tag) q = q.contains('tags', [tag]);
    if (sourceId) q = q.eq('source_id', sourceId);
    return q;
  };

  const { data, error, count } = leeches
    // Schwierige: Filter nach difficulty/lapses läuft in JS (jsonb nicht numerisch filterbar),
    // daher ALLE geübten Karten laden — seitenweise, da es über 1000 werden können.
    ? await fetchAll((from, to) => base().gt('reps', 0).order('id').range(from, to))
        .then((r) => ({ ...r, count: r.data.length }))
    : all
      // ganzes Deck: ohne Fälligkeitsfilter (fällige zuerst)
      ? await base().order('due_at', { ascending: true }).limit(limit)
      // normale Warteschlange: nur fällige Karten
      : await base().lte('due_at', nowIso).order('due_at', { ascending: true }).limit(limit);

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  let rows = data ?? [];
  let total = count ?? rows.length;

  if (leeches) {
    const diff = (c: { fsrs_state: unknown }) =>
      (c.fsrs_state as CardJson | null)?.difficulty ?? 0;
    const lap = (c: { lapses: number | null }) => c.lapses ?? 0;
    const hardness = (c: { fsrs_state: unknown; lapses: number | null }) => diff(c) + lap(c) * 2;
    rows = rows
      .filter((c) => diff(c) >= HARD_MIN_DIFFICULTY || lap(c) >= HARD_MIN_LAPSES)
      .sort((a, b) => hardness(b) - hardness(a));
    total = rows.length;         // счётчик = сколько всего трудных
    rows = rows.slice(0, limit); // самые трудные — вперёд
  }

  const now = new Date();
  const queue = rows.map((card) => {
    const state = card.fsrs_state as CardJson | null;
    let intervals = null;
    if (state) {
      try {
        intervals = previewIntervals(state, now);
      } catch {
        intervals = null;
      }
    }
    return { ...card, intervals };
  });

  return NextResponse.json({
    queue,
    due_count_total: total,
  });
}
