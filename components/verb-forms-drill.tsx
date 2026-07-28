'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, X, RotateCw, Home, Check, XCircle, ArrowRight, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n/context';
import { useTTSContext } from '@/lib/tts-context';
import { compareAnswer } from '@/lib/utils/compare';
import { cn } from '@/lib/utils';
import type { Grade } from 'ts-fsrs';

type VerbForms = {
  praesens?: string;
  praeteritum?: string;
  partizip_2?: string;
  hilfsverb?: string;
};

type Verb = {
  id: string;
  front: string;
  back: string;
  forms: VerbForms;
};

type Status = 'loading' | 'empty' | 'active' | 'done' | 'error';

// exact/close считаем верным (одна опечатка/умляут прощается)
function isOk(input: string, correct: string): boolean {
  if (!input.trim()) return false;
  const r = compareAnswer(input, correct);
  return r === 'exact' || r === 'close';
}

type Props = {
  count: number;
  sourceId: string | null;
  pattern?: string | null;
  onExit: () => void;
};

export function VerbFormsDrill({ count, sourceId, pattern = null, onExit }: Props) {
  const { t } = useI18n();
  const { speak } = useTTSContext();
  const [status, setStatus] = useState<Status>('loading');
  const [verbs, setVerbs] = useState<Verb[]>([]);
  const [idx, setIdx] = useState(0);
  const [praes, setPraes] = useState('');
  const [praet, setPraet] = useState('');
  const [part, setPart] = useState('');
  const [hilf, setHilf] = useState<'haben' | 'sein' | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [error, setError] = useState('');
  const firstRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const qs = new URLSearchParams({ limit: String(count) });
      if (sourceId) qs.set('source_id', sourceId);
      if (pattern) qs.set('pattern', pattern);
      const res = await fetch(`/api/review/verbs?${qs}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.cards?.length) { setStatus('empty'); return; }
      setVerbs(data.cards);
      setIdx(0);
      setPraes(''); setPraet(''); setPart(''); setHilf(null);
      setChecked(false);
      setScore(0);
      setStatus('active');
      setTimeout(() => firstRef.current?.focus(), 80);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, [count, sourceId, pattern]);

  useEffect(() => { load(); }, [load]);

  const current = status === 'active' ? verbs[idx] : null;

  // Какие поля активны для этого глагола
  const hasPraes = !!current?.forms.praesens;
  const hasHilf = !!current?.forms.hilfsverb;
  const storedHilf = (current?.forms.hilfsverb ?? '').toLowerCase();

  const praesOk = !hasPraes || (current ? isOk(praes, current.forms.praesens ?? '') : false);
  const praetOk = current ? isOk(praet, current.forms.praeteritum ?? '') : false;
  const partOk = current ? isOk(part, current.forms.partizip_2 ?? '') : false;
  const hilfOk = !hasHilf || (hilf != null && storedHilf.includes(hilf));

  const check = useCallback(async () => {
    if (!current || checked) return;
    // нужно хоть что-то ввести
    if (!praet.trim() && !part.trim() && !praes.trim() && !hilf) return;
    setChecked(true);

    const checks: boolean[] = [praetOk, partOk];
    if (hasPraes) checks.push(praesOk);
    if (hasHilf) checks.push(hilfOk);
    const okCount = checks.filter(Boolean).length;
    const allOk = okCount === checks.length;
    if (allOk) setScore((s) => s + 1);

    speak(
      [hasPraes ? current.forms.praesens : null, current.forms.praeteritum, current.forms.partizip_2]
        .filter(Boolean)
        .join(', '),
    );

    // FSRS: всё верно → «хорошо», часть → «сложно», ничего → «снова»
    const rating = (allOk ? 3 : okCount >= 1 ? 2 : 1) as Grade;
    try {
      await fetch('/api/review/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: current.id, rating }),
      });
    } catch {
      toast.error(t('review_save_error'));
    }
  }, [current, checked, praes, praet, part, hilf, hasPraes, hasHilf, praesOk, praetOk, partOk, hilfOk, speak, t]);

  const next = useCallback(() => {
    setChecked(false);
    setPraes(''); setPraet(''); setPart(''); setHilf(null);
    if (idx + 1 >= verbs.length) {
      setStatus('done');
    } else {
      setIdx((i) => i + 1);
      setTimeout(() => firstRef.current?.focus(), 80);
    }
  }, [idx, verbs.length]);

  // Enter → следующий (после проверки, с задержкой от «протекания» мобильного Enter)
  useEffect(() => {
    if (!checked) return;
    let handler: ((e: KeyboardEvent) => void) | null = null;
    const id = setTimeout(() => {
      handler = (e: KeyboardEvent) => {
        if (e.key === 'Enter') { e.preventDefault(); next(); }
      };
      window.addEventListener('keydown', handler);
    }, 350);
    return () => { clearTimeout(id); if (handler) window.removeEventListener('keydown', handler); };
  }, [checked, next]);

  const allOk = praesOk && praetOk && partOk && hilfOk;

  // ── Loading / error / empty / done ──
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
  if (status === 'done') {
    const pct = Math.round((score / verbs.length) * 100);
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-background p-6 text-center">
        <div className="text-5xl">{pct >= 80 ? '🎉' : pct >= 50 ? '💪' : '📚'}</div>
        <div>
          <p className="text-3xl font-bold tabular-nums">{score} / {verbs.length}</p>
          <p className="text-muted-foreground mt-1">{t('gramex_correct_answers')}</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={load}><RotateCw className="size-4 mr-2" />{t('review_another_session')}</Button>
          <Button variant="outline" onClick={onExit}><Home className="size-4 mr-2" />{t('btn_home')}</Button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const fieldClass = (ok: boolean) =>
    checked ? (ok ? 'border-emerald-500/60' : 'border-rose-500/60') : '';
  const onFieldKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !checked) { e.preventDefault(); check(); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <header className="shrink-0 flex items-center gap-2 border-b px-4 py-3 sm:px-6">
        <Button variant="ghost" size="icon" onClick={onExit} aria-label={t('review_close_label')}>
          <X className="size-5" />
        </Button>
        <span className="flex-1 text-center text-sm tabular-nums text-muted-foreground">
          {idx + 1} / {verbs.length}
        </span>
        <span className="text-sm tabular-nums text-muted-foreground">✓ {score}</span>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        <div className="flex flex-col items-center justify-center min-h-full p-4 gap-6">
          {/* Инфинитив + перевод */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <h2 className="font-serif font-medium leading-tight [font-size:clamp(1.75rem,7vw,3rem)]">
                {current.front}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => speak(current.front)}>
                <Volume2 className="size-4" />
              </Button>
            </div>
            <p className="text-muted-foreground mt-1">{current.back}</p>
          </div>

          {/* Поля ввода */}
          <div className="w-full max-w-sm flex flex-col gap-3">
            {hasPraes && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Präsens</label>
                <Input
                  ref={firstRef}
                  value={praes}
                  onChange={(e) => setPraes(e.target.value)}
                  onKeyDown={onFieldKey}
                  disabled={checked}
                  placeholder="z.B. nimmt"
                  autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                  className={cn('h-11 text-base', fieldClass(praesOk))}
                />
                {checked && !praesOk && (
                  <span className="text-sm text-emerald-600 dark:text-emerald-400">{current.forms.praesens}</span>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Präteritum</label>
              <Input
                ref={hasPraes ? undefined : firstRef}
                value={praet}
                onChange={(e) => setPraet(e.target.value)}
                onKeyDown={onFieldKey}
                disabled={checked}
                placeholder="z.B. nahm"
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                className={cn('h-11 text-base', fieldClass(praetOk))}
              />
              {checked && !praetOk && (
                <span className="text-sm text-emerald-600 dark:text-emerald-400">{current.forms.praeteritum}</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Partizip II</label>
              <Input
                value={part}
                onChange={(e) => setPart(e.target.value)}
                onKeyDown={onFieldKey}
                disabled={checked}
                placeholder="z.B. genommen"
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                className={cn('h-11 text-base', fieldClass(partOk))}
              />
              {checked && !partOk && (
                <span className="text-sm text-emerald-600 dark:text-emerald-400">{current.forms.partizip_2}</span>
              )}
            </div>

            {/* Hilfsverb — выбор haben / sein */}
            {hasHilf && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Hilfsverb (Perfekt)</label>
                <div className="flex gap-2">
                  {(['haben', 'sein'] as const).map((h) => {
                    const isCorrect = checked && storedHilf.includes(h);
                    const isWrongPick = checked && hilf === h && !storedHilf.includes(h);
                    return (
                      <button
                        key={h}
                        onClick={() => !checked && setHilf(h)}
                        disabled={checked}
                        className={cn(
                          'flex-1 rounded-md border py-2 text-sm font-medium transition-colors',
                          !checked && hilf === h && 'bg-primary text-primary-foreground border-primary',
                          !checked && hilf !== h && 'hover:bg-muted',
                          isCorrect && 'border-emerald-500/70 text-emerald-600 dark:text-emerald-400',
                          isWrongPick && 'border-rose-500/70 text-rose-600 dark:text-rose-400 line-through',
                        )}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {checked ? (
              <Button size="lg" onClick={next} className="w-full mt-1">
                {idx + 1 < verbs.length ? t('gramex_next') : t('gramex_finish')}
                <ArrowRight className="ml-2 size-4" />
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={check}
                disabled={!praet.trim() && !part.trim() && !praes.trim() && !hilf}
                className="w-full mt-1"
              >
                {t('gramex_check')}
              </Button>
            )}

            {/* Итог по карточке */}
            {checked && (
              <div className={cn(
                'flex items-center justify-center gap-2 text-sm font-medium',
                allOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
              )}>
                {allOk
                  ? <><Check className="size-4" /> {t('gramex_correct')}</>
                  : <><XCircle className="size-4" /> {t('gramex_wrong')}</>}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
