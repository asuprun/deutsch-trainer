'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderOpen, GraduationCap, BookText } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';

type SourceWithCounts = {
  id: string;
  image_path: string;
  image_hash: string | null;
  title: string | null;
  notes: string | null;
  created_at: string;
  card_count: number;
  grammar_count: number;
  fresh: number;
  learning: number;
  mature: number;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function DecksClient({ sources }: { sources: SourceWithCounts[] }) {
  const { t } = useI18n();

  function cardCountLabel(n: number): string {
    if (n === 1) return t('decks_card1');
    if (n >= 2 && n <= 4) return t('decks_card234');
    return t('decks_card5');
  }

  function grammarCountLabel(n: number): string {
    if (n === 1) return t('decks_note1');
    if (n >= 2 && n <= 4) return t('decks_note234');
    return t('decks_note5');
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('decks_title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('decks_subtitle')}</p>
      </header>

      {sources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <FolderOpen className="size-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">{t('decks_empty_title')}</p>
          <p className="text-sm text-muted-foreground">{t('decks_empty_hint')}</p>
          <Link
            href="/upload"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            {t('decks_upload_btn')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((source) => (
            <Card key={source.id} className="h-full transition-shadow hover:shadow-md flex flex-col">
              <Link href={`/cards?source_id=${source.id}`} className="flex-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium leading-tight line-clamp-2">
                    {source.title ?? t('decks_untitled')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {formatDate(source.created_at)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-2 flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">
                    {source.card_count} {cardCountLabel(source.card_count)}
                    {source.grammar_count > 0 && (
                      <>
                        {' · '}
                        {source.grammar_count} {grammarCountLabel(source.grammar_count)}
                      </>
                    )}
                  </p>

                  {/* Прогресс освоения */}
                  {source.card_count > 0 && (() => {
                    const pct = Math.round((source.mature / source.card_count) * 100);
                    return (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <span className="bg-emerald-500" style={{ width: `${(source.mature / source.card_count) * 100}%` }} />
                          <span className="bg-amber-500" style={{ width: `${(source.learning / source.card_count) * 100}%` }} />
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
                          <span className="font-medium text-foreground">{pct}%</span>
                          <span className="text-emerald-600 dark:text-emerald-400">{t('decks_prog_mature')} {source.mature}</span>
                          {source.learning > 0 && <span className="text-amber-600 dark:text-amber-500">{t('decks_prog_learning')} {source.learning}</span>}
                          {source.fresh > 0 && <span>{t('decks_prog_fresh')} {source.fresh}</span>}
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Link>
              {source.card_count > 0 && (
                <div className="px-6 pb-4 flex gap-2">
                  <Button asChild size="sm" className="flex-1 gap-2">
                    <Link href={`/review?source_id=${source.id}`}>
                      <GraduationCap className="size-3.5" />
                      {t('decks_train')}
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" title={t('cloze_title')}>
                    <Link href={`/review?source_id=${source.id}&cloze=1`}>
                      <BookText className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
