import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { previewIntervals, type CardJson } from '@/lib/fsrs/scheduler';
import { hardCardIds, difficultyOf } from '@/lib/fsrs/hard';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 500;

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
  // new=1 — noch nie geübte Wörter zum Kennenlernen («Neue Wörter»), älteste zuerst
  const fresh = url.searchParams.get('new') === '1';

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
    : fresh
      ? await base().eq('reps', 0).order('created_at', { ascending: true }).order('id').limit(limit)
    : all
      // ganzes Deck: ohne Fälligkeitsfilter (fällige zuerst), inkl. neuer Wörter
      ? await base().order('due_at', { ascending: true }).limit(limit)
      // normale Wiederholung: nur fällige Wörter, die man schon lernt (reps>0) —
      // neue Wörter kommen nur bewusst über «Neue Wörter» dazu
      : await base().gt('reps', 0).lte('due_at', nowIso).order('due_at', { ascending: true }).limit(limit);

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    );
  }

  let rows = data ?? [];
  let total = count ?? rows.length;

  if (leeches) {
    // schwer = geübt + (schwierig ODER Fehler) und noch keine 2 richtigen Antworten in Folge
    const hard = await hardCardIds(sb, rows);
    const hardness = (c: { fsrs_state: unknown; lapses: number | null }) =>
      difficultyOf(c as Parameters<typeof difficultyOf>[0]) + (c.lapses ?? 0) * 2;
    rows = rows
      .filter((c) => hard.has(c.id))
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
