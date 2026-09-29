import 'server-only';
import type { getSupabaseAdmin } from '@/lib/supabase/server';
import { fetchAll } from '@/lib/supabase/fetch-all';
import type { CardJson } from '@/lib/fsrs/scheduler';

/**
 * «Schwierige» / «Meine Fehler»: welche Karten gelten als schwer?
 *
 * Eintritt: bereits geübt UND (hohe FSRS-Schwierigkeit ODER mind. ein Fehler).
 * Austritt: HARD_EXIT_STREAK richtige Antworten (Gut/Leicht) in Folge — sonst
 * bliebe eine Karte nach einem einzigen Fehler für immer drin, weil `lapses`
 * nie kleiner wird. Neuer Fehler → Serie bricht ab → Karte ist wieder schwer.
 */
export const HARD_MIN_DIFFICULTY = 7; // FSRS-Skala 1..10
export const HARD_MIN_LAPSES = 1;
export const HARD_EXIT_STREAK = 2;

type Db = ReturnType<typeof getSupabaseAdmin>;
export type HardCandidate = { id: string; fsrs_state: unknown; lapses: number | null; reps: number | null };

export const difficultyOf = (c: HardCandidate) => (c.fsrs_state as CardJson | null)?.difficulty ?? 0;

function isCandidate(c: HardCandidate): boolean {
  return (c.reps ?? 0) > 0 && (difficultyOf(c) >= HARD_MIN_DIFFICULTY || (c.lapses ?? 0) >= HARD_MIN_LAPSES);
}

/** Richtige Antworten in Folge seit der letzten falschen/mühsamen (neueste zuerst). */
async function successStreaks(db: Db, ids: string[]): Promise<Map<string, number>> {
  const streak = new Map<string, number>();
  const broken = new Set<string>();
  // in Blöcken, damit die URL der .in()-Abfrage nicht zu lang wird
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data } = await fetchAll((from, to) => db
      .from('review_logs')
      .select('card_id, rating')
      .in('card_id', chunk)
      .order('reviewed_at', { ascending: false })
      .order('id')
      .range(from, to));
    for (const l of data) {
      if (broken.has(l.card_id)) continue;
      if (l.rating >= 3) streak.set(l.card_id, (streak.get(l.card_id) ?? 0) + 1);
      else broken.add(l.card_id);
    }
  }
  return streak;
}

/** IDs der Karten, die aktuell als schwer gelten. */
export async function hardCardIds(db: Db, cards: HardCandidate[]): Promise<Set<string>> {
  const cand = cards.filter(isCandidate);
  if (!cand.length) return new Set();
  const streaks = await successStreaks(db, cand.map((c) => c.id));
  return new Set(cand.filter((c) => (streaks.get(c.id) ?? 0) < HARD_EXIT_STREAK).map((c) => c.id));
}
