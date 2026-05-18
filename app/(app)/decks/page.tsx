import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderOpen } from 'lucide-react';

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function DecksPage() {
  const sources = await loadSources();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Колоды</h1>
        <p className="mt-1 text-sm text-muted-foreground">Источники — загруженные скрины учебника</p>
      </header>

      {sources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <FolderOpen className="size-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">Источников нет.</p>
          <p className="text-sm text-muted-foreground">Загрузи первый скрин учебника.</p>
          <Link
            href="/upload"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            Загрузить скрин
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((source) => (
            <Link key={source.id} href={`/cards?source_id=${source.id}`} className="group">
              <Card className="h-full transition-shadow hover:shadow-md group-hover:border-primary/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium leading-tight line-clamp-2">
                    {source.title ?? 'Без названия'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {formatDate(source.created_at)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {source.card_count}{' '}
                    {source.card_count === 1
                      ? 'карта'
                      : source.card_count >= 2 && source.card_count <= 4
                        ? 'карты'
                        : 'карт'}
                    {source.grammar_count > 0 && (
                      <>
                        {' · '}
                        {source.grammar_count}{' '}
                        {source.grammar_count === 1
                          ? 'заметка'
                          : source.grammar_count >= 2 && source.grammar_count <= 4
                            ? 'заметки'
                            : 'заметок'}
                      </>
                    )}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
