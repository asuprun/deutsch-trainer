'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, X, RotateCw, Home, Check, XCircle, ArrowRight, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n/context';
import { useTTSContext } from '@/lib/tts-context';
import { compareAnswer } from '@/lib/utils/compare';
import { cn } from '@/lib/utils';
import type { Grade } from 'ts-fsrs';

type Rektion = { prep: string; kasus: string };
type Example = { de: string; ru: string };
// Ein Verb kann MEHRERE Rektionen haben (erzählen von+Dativ / über+Akkusativ).
type Verb = { ids: string[]; front: string; back: string; examples: Example[]; rektionen: Rektion[] };
type Status = 'loading' | 'empty' | 'active' | 'done' | 'error';
type Mode = 'recall' | 'cloze';

const KASUS = ['Akkusativ', 'Dativ', 'Genitiv'] as const;

function isOk(input: string, correct: string): boolean {
  if (!input.trim()) return false;
  const r = compareAnswer(input, correct);
  return r === 'exact' || r === 'close';
}

// Sucht die Präposition als ganzes Wort im Beispielsatz und ersetzt sie durch ___
function makeCloze(sentence: string, prep: string): { text: string; answer: string } | null {
  const re = new RegExp(`(^|[^A-Za-zÄÖÜäöüß])(${prep})([^A-Za-zÄÖÜäöüß]|$)`, 'i');
  const m = sentence.match(re);
  if (!m) return null;
  const idx = (m.index ?? 0) + m[1].length;
  const answer = sentence.slice(idx, idx + m[2].length);
  return { text: sentence.slice(0, idx) + '___' + sentence.slice(idx + m[2].length), answer };
}

// Erstes (Beispiel × Rektion)-Paar, das einen Lückentext ergibt
function firstCloze(v: Verb): { text: string; answer: string; ru: string } | null {
  for (const e of v.examples ?? []) {
    for (const r of v.rektionen) {
      const c = makeCloze(e.de, r.prep);
      if (c) return { ...c, ru: e.ru };
    }
  }
  return null;
}

type Props = { count: number; sourceId: string | null; mode: Mode; hardOnly?: boolean; onExit: () => void };

export function VerbPrepDrill({ count, sourceId, mode, hardOnly = false, onExit }: Props) {
  const { t } = useI18n();
  const { speak } = useTTSContext();
  const [status, setStatus] = useState<Status>('loading');
  const [verbs, setVerbs] = useState<Verb[]>([]);
  const [idx, setIdx] = useState(0);
  const [prep, setPrep] = useState('');
  const [kasus, setKasus] = useState<string | null>(null);
  const [clozeInput, setClozeInput] = useState('');
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setStatus('loading'); setError('');
    try {
      const qs = new URLSearchParams({ limit: String(count) });
      if (sourceId) qs.set('source_id', sourceId);
      if (hardOnly) qs.set('hard', '1');
      const res = await fetch(`/api/review/verb-preps?${qs}`);
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error?.message ?? `HTTP ${res.status}`); }
      const data = await res.json();
      let list: Verb[] = data.verbs ?? [];
      // Im Cloze-Modus nur Verben mit brauchbarem Beispielsatz
      if (mode === 'cloze') list = list.filter((v) => firstCloze(v));
      if (!list.length) { setStatus('empty'); return; }
      setVerbs(list);
      setIdx(0); setPrep(''); setKasus(null); setClozeInput(''); setChecked(false); setScore(0);
      setStatus('active');
      setTimeout(() => inputRef.current?.focus(), 80);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, [count, sourceId, mode, hardOnly]);

  useEffect(() => { load(); }, [load]);

  const current = status === 'active' ? verbs[idx] : null;

  const cloze = useMemo(() => (mode === 'cloze' && current ? firstCloze(current) : null), [mode, current]);

  // Recall: passende Rektion (Präposition richtig) bzw. voll richtig (Präp + Kasus)
  const prepMatch = current && mode === 'recall' ? current.rektionen.find((r) => isOk(prep, r.prep)) : undefined;
  const fullMatch = current && mode === 'recall' ? current.rektionen.find((r) => isOk(prep, r.prep) && kasus === r.kasus) : undefined;
  const prepOk = mode === 'cloze' ? isOk(clozeInput, cloze?.answer ?? '') : !!prepMatch;
  const allOk = mode === 'cloze' ? prepOk : !!fullMatch;
  // Welche Kasus sind für die aktuelle Eingabe korrekt (zum Einfärben der Buttons)?
  const correctKasus = current && mode === 'recall'
    ? new Set((prepMatch ? [prepMatch] : current.rektionen).map((r) => r.kasus))
    : new Set<string>();

  const check = useCallback(async () => {
    if (!current || checked) return;
    if (mode === 'recall' && !prep.trim() && !kasus) return;
    if (mode === 'cloze' && !clozeInput.trim()) return;
    setChecked(true);

    const pOk = mode === 'cloze'
      ? isOk(clozeInput, cloze?.answer ?? '')
      : current.rektionen.some((r) => isOk(prep, r.prep));
    const full = mode === 'cloze'
      ? pOk
      : current.rektionen.some((r) => isOk(prep, r.prep) && kasus === r.kasus);
    if (full) setScore((s) => s + 1);

    // Vorlesen: Verb mit (getroffener) Präposition
    const spokenPrep = (mode === 'recall' ? prepMatch?.prep : cloze?.answer) ?? current.rektionen[0]?.prep ?? '';
    speak(`${current.front} ${spokenPrep}`);

    const okCount = (pOk ? 1 : 0) + (mode === 'recall' && full ? 1 : 0);
    const rating = (full ? 3 : okCount >= 1 ? 2 : 1) as Grade;
    try {
      // alle Geschwisterkarten des Verbs gleich bewerten
      await Promise.all(current.ids.map((id) =>
        fetch('/api/review/answer', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ card_id: id, rating }),
        })));
    } catch { toast.error(t('review_save_error')); }
  }, [current, checked, mode, prep, kasus, clozeInput, prepMatch, cloze, speak, t]);

  const next = useCallback(() => {
    setChecked(false); setPrep(''); setKasus(null); setClozeInput('');
    if (idx + 1 >= verbs.length) setStatus('done');
    else { setIdx((i) => i + 1); setTimeout(() => inputRef.current?.focus(), 80); }
  }, [idx, verbs.length]);

  useEffect(() => {
    if (!checked) return;
    let h: ((e: KeyboardEvent) => void) | null = null;
    const id = setTimeout(() => {
      h = (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); next(); } };
      window.addEventListener('keydown', h);
    }, 350);
    return () => { clearTimeout(id); if (h) window.removeEventListener('keydown', h); };
  }, [checked, next]);

  if (status === 'loading')
    return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (status === 'error')
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-destructive">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onExit}>{t('gramex_back')}</Button>
          <Button onClick={load}><RotateCw className="size-4 mr-1.5" />{t('gramex_retry')}</Button>
        </div>
      </div>
    );
  if (status === 'empty')
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="text-2xl font-semibold">{t('verbprep_empty')}</h1>
        <Button variant="outline" onClick={onExit}>{t('gramex_back')}</Button>
      </div>
    );
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
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !checked) { e.preventDefault(); check(); } };
  const rektionenLabel = current.rektionen.map((r) => `${r.prep} + ${r.kasus}`).join(' · ');

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <header className="shrink-0 flex items-center gap-2 border-b px-4 py-3 sm:px-6">
        <Button variant="ghost" size="icon" onClick={onExit} aria-label={t('review_close_label')}><X className="size-5" /></Button>
        <span className="flex-1 text-center text-sm tabular-nums text-muted-foreground">{idx + 1} / {verbs.length}</span>
        <span className="text-sm tabular-nums text-muted-foreground">✓ {score}</span>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        <div className="flex flex-col items-center justify-center min-h-full p-4 gap-6">
          {mode === 'recall' ? (
            <>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <h2 className="font-serif font-medium leading-tight [font-size:clamp(1.75rem,7vw,3rem)]">{current.front}</h2>
                  <Button variant="ghost" size="icon" onClick={() => speak(current.front)}><Volume2 className="size-4" /></Button>
                </div>
                <p className="text-muted-foreground mt-1">{current.back}</p>
                {current.rektionen.length > 1 && !checked && (
                  <p className="text-xs text-muted-foreground/70 mt-1">{t('verbprep_multi_hint')}</p>
                )}
              </div>

              <div className="w-full max-w-sm flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Präposition</label>
                  <Input
                    ref={inputRef} value={prep} onChange={(e) => setPrep(e.target.value)} onKeyDown={onKey}
                    disabled={checked} placeholder="z.B. auf"
                    autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                    className={cn('h-11 text-base', checked && (prepOk ? 'border-emerald-500/60' : 'border-rose-500/60'))}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Kasus</label>
                  <div className="flex gap-2">
                    {KASUS.map((k) => {
                      const isCorrect = checked && correctKasus.has(k);
                      const isWrong = checked && kasus === k && !correctKasus.has(k);
                      return (
                        <button key={k} onClick={() => !checked && setKasus(k)} disabled={checked}
                          className={cn('flex-1 rounded-md border py-2 text-sm font-medium transition-colors',
                            !checked && kasus === k && 'bg-primary text-primary-foreground border-primary',
                            !checked && kasus !== k && 'hover:bg-muted',
                            isCorrect && 'border-emerald-500/70 text-emerald-600 dark:text-emerald-400',
                            isWrong && 'border-rose-500/70 text-rose-600 dark:text-rose-400 line-through')}>
                          {k}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Nach der Prüfung: alle gültigen Rektionen zeigen */}
                {checked && (
                  <p className="text-sm text-center text-emerald-600 dark:text-emerald-400">{rektionenLabel}</p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="w-full max-w-xl text-center">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">{current.front} — {current.back}</p>
                <p className="text-xl leading-relaxed">{cloze?.text.split('___').map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <input
                        ref={i === 0 ? inputRef : undefined}
                        value={clozeInput} onChange={(e) => setClozeInput(e.target.value)} onKeyDown={onKey} disabled={checked}
                        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                        className={cn('inline-block w-24 mx-1 rounded-md border bg-background px-2 py-0.5 text-lg text-center align-baseline focus:outline-none focus:ring-2 focus:ring-ring',
                          checked && (prepOk ? 'border-emerald-500/70 text-emerald-600 dark:text-emerald-400' : 'border-rose-500/70 text-rose-600 dark:text-rose-400'))}
                      />
                    )}
                  </span>
                ))}</p>
                {checked && !prepOk && <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2">{cloze?.answer}</p>}
                {checked && cloze?.ru && <p className="text-sm text-muted-foreground mt-2">{cloze.ru}</p>}
              </div>
            </>
          )}

          <div className="w-full max-w-sm flex flex-col gap-3">
            {checked ? (
              <Button size="lg" onClick={next} className="w-full">
                {idx + 1 < verbs.length ? t('gramex_next') : t('gramex_finish')}<ArrowRight className="ml-2 size-4" />
              </Button>
            ) : (
              <Button size="lg" onClick={check}
                disabled={mode === 'recall' ? (!prep.trim() && !kasus) : !clozeInput.trim()}
                className="w-full">{t('gramex_check')}</Button>
            )}

            {/* Beispielsatz nach der Prüfung (Recall-Modus) */}
            {checked && mode === 'recall' && current.examples?.[0] && (
              <p className="text-sm text-muted-foreground text-center">{current.examples[0].de}</p>
            )}

            {checked && (
              <div className={cn('flex items-center justify-center gap-2 text-sm font-medium',
                allOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
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
