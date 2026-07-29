'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, X, RotateCw, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n/context';
import { compareAnswer } from '@/lib/utils/compare';
import { cn } from '@/lib/utils';

type Cloze = { text: string; answers: string[]; hints: string[]; translation: string };
type Status = 'loading' | 'ready' | 'error';

function isOk(input: string, correct: string): boolean {
  if (!input.trim()) return false;
  const r = compareAnswer(input, correct);
  return r === 'exact' || r === 'close';
}

type Props = {
  sourceId: string;
  title?: string;
  onExit: () => void;
};

export function DeckClozeSession({ sourceId, title, onExit }: Props) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>('loading');
  const [cloze, setCloze] = useState<Cloze | null>(null);
  const [values, setValues] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (fresh = false) => {
    setStatus('loading');
    setError('');
    setChecked(false);
    try {
      const res = await fetch('/api/decks/cloze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: sourceId, fresh }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      const parts = String(data.text ?? '').split('___');
      const blanks = Math.max(0, parts.length - 1);
      const answers: string[] = (data.answers ?? []).slice(0, blanks);
      setCloze({ text: data.text, answers, hints: data.hints ?? [], translation: data.translation ?? '' });
      setValues(new Array(blanks).fill(''));
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, [sourceId]);

  useEffect(() => { load(false); }, [load]);

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('cloze_generating')}</p>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-background p-6 text-center max-w-sm mx-auto">
        <p className="text-destructive text-sm">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onExit}>{t('gramex_back')}</Button>
          <Button onClick={() => load(false)}><RotateCw className="size-4 mr-1.5" />{t('gramex_retry')}</Button>
        </div>
      </div>
    );
  }
  if (!cloze) return null;

  const parts = cloze.text.split('___');
  const correctCount = values.filter((v, i) => isOk(v, cloze.answers[i] ?? '')).length;
  const total = cloze.answers.length;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <header className="shrink-0 flex items-center gap-2 border-b px-4 py-3 sm:px-6">
        <Button variant="ghost" size="icon" onClick={onExit} aria-label={t('review_close_label')}>
          <X className="size-5" />
        </Button>
        <span className="flex-1 text-center text-sm font-medium truncate">{title || t('cloze_title')}</span>
        {checked ? (
          <span className="text-sm tabular-nums text-muted-foreground">{correctCount}/{total}</span>
        ) : (
          <div className="size-9" />
        )}
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-4 sm:p-6 flex flex-col gap-6">
          {/* Текст с пропусками */}
          <p className="text-lg leading-loose">
            {parts.map((part, i) => (
              <span key={i}>
                {part}
                {i < parts.length - 1 && (() => {
                  const ok = isOk(values[i] ?? '', cloze.answers[i] ?? '');
                  return (
                    <span className="inline-flex flex-col align-baseline mx-0.5">
                      <input
                        value={values[i] ?? ''}
                        onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                        disabled={checked}
                        placeholder={cloze.hints[i] ?? ''}
                        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                        className={cn(
                          'inline-block w-28 rounded-md border bg-background px-2 py-0.5 text-base align-baseline',
                          'placeholder:text-muted-foreground/50 placeholder:text-xs focus:outline-none focus:ring-2 focus:ring-ring',
                          checked && (ok ? 'border-emerald-500/70 text-emerald-700 dark:text-emerald-400'
                                         : 'border-rose-500/70 text-rose-700 dark:text-rose-400 line-through'),
                        )}
                      />
                      {checked && !ok && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 px-1">{cloze.answers[i]}</span>
                      )}
                    </span>
                  );
                })()}
              </span>
            ))}
          </p>

          {/* Перевод — после проверки */}
          {checked && cloze.translation && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground leading-relaxed">
              {cloze.translation}
            </div>
          )}

          {/* Кнопки */}
          <div className="flex flex-wrap gap-2">
            {!checked ? (
              <Button
                size="lg"
                onClick={() => setChecked(true)}
                disabled={values.every((v) => !v.trim())}
              >
                {t('gramex_check')}
              </Button>
            ) : (
              <>
                <Button size="lg" variant="outline" onClick={() => { setValues(new Array(total).fill('')); setChecked(false); }}>
                  <RotateCw className="size-4 mr-1.5" />
                  {t('cloze_retry_same')}
                </Button>
                <Button size="lg" onClick={() => load(true)}>
                  <Sparkles className="size-4 mr-1.5" />
                  {t('cloze_new_text')}
                </Button>
              </>
            )}
          </div>

          {checked && (
            <div className={cn('flex items-center gap-2 text-sm font-medium',
              correctCount === total ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
              <Check className="size-4" /> {correctCount} / {total}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
