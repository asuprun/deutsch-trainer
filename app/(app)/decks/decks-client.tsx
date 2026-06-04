'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderOpen, GraduationCap } from 'lucide-react';
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
                <CardContent className="pb-2">
                  <p className="text-sm text-muted-foreground">
                    {source.card_count} {cardCountLabel(source.card_count)}
                    {source.grammar_count > 0 && (
                      <>
                        {' · '}
                        {source.grammar_count} {grammarCountLabel(source.grammar_count)}
                      </>
                    )}
                  </p>
                </CardContent>
              </Link>
              {source.card_count > 0 && (
                <div className="px-6 pb-4">
                  <Button asChild size="sm" className="w-full gap-2">
                    <Link href={`/review?source_id=${source.id}`}>
                      <GraduationCap className="size-3.5" />
                      {t('decks_train')}
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
