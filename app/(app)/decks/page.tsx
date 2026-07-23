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
      db.from('cards').select('source_id'),
      db.from('grammar_notes').select('source_id'),
    ]);

    if (sourcesRes.error || cardsRes.error || grammarRes.error) {
      return [];
    }

    const cardCounts: Record<string, number> = {};
    for (const row of cardsRes.data ?? []) {
      if (row.source_id) cardCounts[row.source_id] = (cardCounts[row.source_id] ?? 0) + 1;
    }

    const grammarCounts: Record<string, number> = {};
    for (const row of grammarRes.data ?? []) {
      if (row.source_id) grammarCounts[row.source_id] = (grammarCounts[row.source_id] ?? 0) + 1;
    }

    return (sourcesRes.data ?? []).map((s: Source) => ({
      ...s,
      card_count: cardCounts[s.id] ?? 0,
      grammar_count: grammarCounts[s.id] ?? 0,
    }));
  } catch {
    return [];
  }
}

export default async function DecksPage() {
  const sources = await loadSources();
  return <DecksClient sources={sources} />;
}
