'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, X, RotateCw, ChevronDown, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';

type PatternForms = { praeteritum?: string; partizip_2?: string; infinitiv?: string };
type PatternVerb = { id: string; front: string; back: string; forms: PatternForms };
type PatternGroup = {
  key: string;
  vowels: [string, string, string] | null;
  label: string;
  count: number;
  verbs: PatternVerb[];
};

type Status = 'loading' | 'ready' | 'empty' | 'error';

type Props = {
  sourceId: string | null;
  onExit: () => void;
  onDrill: (pattern: string) => void;
};

export function VerbPatterns({ sourceId, onExit, onDrill }: Props) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>('loading');
  const [groups, setGroups] = useState<PatternGroup[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const qs = new URLSearchParams();
      if (sourceId) qs.set('source_id', sourceId);
      const res = await fetch(`/api/review/verb-patterns?${qs}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.patterns?.length) { setStatus('empty'); return; }
      setGroups(data.patterns);
      setOpen(data.patterns[0]?.key ?? null);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, [sourceId]);

  useEffect(() => { load(); }, [load]);

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-destructive">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onExit}>{t('gramex_back')}</Button>
          <Button onClick={load}><RotateCw className="size-4 mr-1.5" />{t('gramex_retry')}</Button>
        </div>
      </div>
    );
  }
  if (status === 'empty') {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="text-2xl font-semibold">{t('verbdrill_empty')}</h1>
        <Button variant="outline" onClick={onExit}>{t('gramex_back')}</Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <header className="shrink-0 flex items-center gap-2 border-b px-4 py-3 sm:px-6">
        <Button variant="ghost" size="icon" onClick={onExit} aria-label={t('review_close_label')}>
          <X className="size-5" />
        </Button>
        <div className="flex-1 text-center">
          <p className="text-sm font-medium leading-tight">{t('verb_patterns_title')}</p>
          <p className="text-xs text-muted-foreground">{t('verb_patterns_subtitle')}</p>
        </div>
        <div className="size-9" />
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="mx-auto max-w-xl flex flex-col gap-2.5">
          {groups.map((g) => {
            const isOpen = open === g.key;
            return (
              <div key={g.key} className="rounded-xl border bg-card overflow-hidden">
                {/* Заголовок группы */}
                <div className="flex items-center gap-2 p-3">
                  <button
                    onClick={() => setOpen(isOpen ? null : g.key)}
                    className="flex flex-1 items-center gap-3 min-w-0 text-left"
                  >
                    <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                    <span className="font-serif text-lg font-medium tracking-wide">{g.label}</span>
                    <span className="text-xs text-muted-foreground shrink-0">· {g.count}</span>
                  </button>
                  <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => onDrill(g.key)}>
                    <Dumbbell className="size-3.5" />
                    <span className="hidden sm:inline">{t('decks_train')}</span>
                  </Button>
                </div>

                {/* Список глаголов */}
                {isOpen && (
                  <div className="border-t divide-y">
                    {g.verbs.map((v) => (
                      <div key={v.id} className="flex items-baseline gap-2 px-3 py-2 text-sm">
                        <span className="font-medium min-w-0 [overflow-wrap:anywhere]">{v.forms.infinitiv || v.front}</span>
                        <span className="text-muted-foreground tabular-nums text-[13px] shrink-0">
                          · {v.forms.praeteritum} · {v.forms.partizip_2}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground/70 truncate hidden sm:block">{v.back}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
