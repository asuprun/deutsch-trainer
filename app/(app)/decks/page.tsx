import { getSupabaseAdmin } from '@/lib/supabase/server';
import { DecksClient } from './decks-client';

// Всегда рендерим на запросе — иначе список колод кэшируется на этапе билда
// и новые колоды (из скринов/импорта) не появляются
export const dynamic = 'force-dynamic';

type Source = {
  id: string;
  image_path: string;
  image_hash: string | null;
  title: string | null;
  notes: string | null;
  created_at: string;
};

async function loadSources() {
  try {
    const db = getSupabaseAdmin();

    const [sourcesRes, cardsRes, grammarRes] = await Promise.all([
      db.from('sources').select('*').order('created_at', { ascending: false }),
      // reps + fsrs_state нужны для прогресса освоения; grammar_rule не считаем
      db.from('cards').select('source_id, reps, fsrs_state').neq('kind', 'grammar_rule'),
      db.from('grammar_notes').select('source_id'),
    ]);

    if (sourcesRes.error || cardsRes.error || grammarRes.error) {
      return [];
    }

    // Порог «выучено»: стабильность памяти ≥ 21 дня
    const MATURE_DAYS = 21;
    type Prog = { total: number; fresh: number; learning: number; mature: number };
    const prog: Record<string, Prog> = {};
    for (const row of cardsRes.data ?? []) {
      if (!row.source_id) continue;
      const p = (prog[row.source_id] ??= { total: 0, fresh: 0, learning: 0, mature: 0 });
      p.total++;
      const reps = (row.reps as number) ?? 0;
      const stability = (row.fsrs_state as { stability?: number } | null)?.stability ?? 0;
      if (reps === 0) p.fresh++;
      else if (stability >= MATURE_DAYS) p.mature++;
      else p.learning++;
    }

    const grammarCounts: Record<string, number> = {};
    for (const row of grammarRes.data ?? []) {
      if (row.source_id) grammarCounts[row.source_id] = (grammarCounts[row.source_id] ?? 0) + 1;
    }

    return (sourcesRes.data ?? []).map((s: Source) => {
      const p = prog[s.id] ?? { total: 0, fresh: 0, learning: 0, mature: 0 };
      return {
        ...s,
        card_count: p.total,
        grammar_count: grammarCounts[s.id] ?? 0,
        fresh: p.fresh,
        learning: p.learning,
        mature: p.mature,
      };
    });
  } catch {
    return [];
  }
}

export default async function DecksPage() {
  const sources = await loadSources();
  return <DecksClient sources={sources} />;
}
