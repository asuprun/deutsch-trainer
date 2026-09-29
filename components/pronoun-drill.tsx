'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, RotateCw, Home, Check, XCircle, ArrowRight, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n/context';
import { useTTSContext } from '@/lib/tts-context';
import { cn } from '@/lib/utils';
import { FORM_ITEMS, SENTENCE_ITEMS, type PronItem } from '@/lib/pronouns/data';

export type PronMode = 'forms' | 'sentences';
type Props = { count: number; mode: PronMode; onExit: () => void };

// Fehlerzähler pro Aufgabe (nur dieses Gerät): falsch +1, richtig −1 → Fehler kommen öfter,
// verschwinden aber wieder, sobald man sie richtig beantwortet.
const STORE_KEY = 'pronoun-errors-v1';
function loadErrors(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}'); } catch { return {}; }
}
function saveErrors(e: Record<string, number>) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(e)); } catch { /* Speicher blockiert — egal */ }
}

// gewichtete Zufallsauswahl ohne Zurücklegen (Gewicht 1 + 3×Fehler)
function pick(pool: PronItem[], n: number, errors: Record<string, number>): PronItem[] {
  const rest = pool.map((it) => ({ it, w: 1 + 3 * (errors[it.id] ?? 0) }));
  const out: PronItem[] = [];
  while (out.length < n && rest.length) {
    let r = Math.random() * rest.reduce((a, x) => a + x.w, 0);
    const i = rest.findIndex((x) => (r -= x.w) <= 0);
    out.push(rest.splice(i < 0 ? rest.length - 1 : i, 1)[0].it);
  }
  return out;
}

const norm = (s: string) => s.trim().toLowerCase();

export function PronounDrill({ count, mode, onExit }: Props) {
  const { t } = useI18n();
  const { speak } = useTTSContext();
  const pool = mode === 'forms' ? FORM_ITEMS : SENTENCE_ITEMS;
  const [items, setItems] = useState<PronItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const start = useCallback(() => {
    setItems(pick(pool, Math.min(count, pool.length), loadErrors()));
    setIdx(0); setInput(''); setChecked(false); setScore(0); setDone(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [pool, count]);

  useEffect(() => { start(); }, [start]);

  const current = items[idx];
  const ok = current ? norm(input) === norm(current.answer) : false;
  const fullSentence = useMemo(() => current?.de?.replace('___', current.answer) ?? '', [current]);

  const check = useCallback(() => {
    if (!current || checked || !input.trim()) return;
    setChecked(true);
    const good = norm(input) === norm(current.answer);
    if (good) setScore((s) => s + 1);
    const e = loadErrors();
    e[current.id] = Math.max(0, Math.min(5, (e[current.id] ?? 0) + (good ? -1 : 1)));
    if (!e[current.id]) delete e[current.id];
    saveErrors(e);
    speak(mode === 'sentences' ? fullSentence : current.answer);
  }, [current, checked, input, mode, fullSentence, speak]);

  const next = useCallback(() => {
    setChecked(false); setInput('');
    if (idx + 1 >= items.length) setDone(true);
    else { setIdx((i) => i + 1); setTimeout(() => inputRef.current?.focus(), 80); }
  }, [idx, items.length]);

  // Enter nach der Prüfung → weiter (mit Verzögerung, damit das Prüf-Enter auf dem Handy nicht durchrutscht)
  useEffect(() => {
    if (!checked) return;
    let h: ((e: KeyboardEvent) => void) | null = null;
    const id = setTimeout(() => {
      h = (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); next(); } };
      window.addEventListener('keydown', h);
    }, 350);
    return () => { clearTimeout(id); if (h) window.removeEventListener('keydown', h); };
  }, [checked, next]);

  if (done) {
    const pct = Math.round((score / Math.max(items.length, 1)) * 100);
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-background p-6 text-center">
        <div className="text-5xl">{pct >= 80 ? '🎉' : pct >= 50 ? '💪' : '📚'}</div>
        <div>
          <p className="text-3xl font-bold tabular-nums">{score} / {items.length}</p>
          <p className="text-muted-foreground mt-1">{t('gramex_correct_answers')}</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={start}><RotateCw className="size-4 mr-2" />{t('review_another_session')}</Button>
          <Button variant="outline" onClick={onExit}><Home className="size-4 mr-2" />{t('btn_home')}</Button>
        </div>
      </div>
    );
  }
  if (!current) return null;

  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !checked) { e.preventDefault(); check(); } };
  const inputCls = cn(checked && (ok ? 'border-emerald-500/70 text-emerald-600 dark:text-emerald-400' : 'border-rose-500/70 text-rose-600 dark:text-rose-400'));
  const parts = (current.de ?? '').split('___');

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <header className="shrink-0 flex items-center gap-2 border-b px-4 py-3 sm:px-6">
        <Button variant="ghost" size="icon" onClick={onExit} aria-label={t('review_close_label')}><X className="size-5" /></Button>
        <span className="flex-1 text-center text-sm tabular-nums text-muted-foreground">{idx + 1} / {items.length}</span>
        <span className="text-sm tabular-nums text-muted-foreground">✓ {score}</span>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        <div className="flex flex-col items-center justify-center min-h-full p-4 gap-6">
          {mode === 'forms' ? (
            <div className="w-full max-w-sm flex flex-col items-center gap-4 text-center">
              {current.reflexive && (
                <span className="rounded-full bg-muted px-3 py-0.5 text-xs text-muted-foreground">{t('pron_reflexive')}</span>
              )}
              <h2 className="font-serif font-medium leading-tight [font-size:clamp(2rem,9vw,3.5rem)]">{current.base}</h2>
              <p className="text-lg text-muted-foreground">→ <span className="font-semibold text-foreground">{current.kasus}</span></p>
              <Input
                ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} disabled={checked}
                placeholder={t('pron_input')} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                className={cn('h-12 text-center text-xl', inputCls)}
              />
            </div>
          ) : (
            <div className="w-full max-w-xl text-center">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
                {current.base}{current.reflexive ? ` · ${t('pron_reflexive')}` : ''}
              </p>
              <p className="text-xl leading-relaxed">
                {parts[0]}
                <input
                  ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} disabled={checked}
                  autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                  className={cn('inline-block w-24 mx-1 rounded-md border bg-background px-2 py-0.5 text-lg text-center align-baseline focus:outline-none focus:ring-2 focus:ring-ring', inputCls)}
                />
                {parts[1]}
              </p>
            </div>
          )}

          <div className="w-full max-w-sm flex flex-col gap-3">
            {checked ? (
              <Button size="lg" onClick={next} className="w-full">
                {idx + 1 < items.length ? t('gramex_next') : t('gramex_finish')}<ArrowRight className="ml-2 size-4" />
              </Button>
            ) : (
              <Button size="lg" onClick={check} disabled={!input.trim()} className="w-full">{t('gramex_check')}</Button>
            )}

            {checked && (
              <div className="flex flex-col items-center gap-1.5 text-center">
                <div className={cn('flex items-center gap-2 text-sm font-medium', ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                  {ok ? <><Check className="size-4" /> {t('gramex_correct')}</> : <><XCircle className="size-4" /> {t('gramex_wrong')}: <b>{current.answer}</b></>}
                  <button type="button" onClick={() => speak(mode === 'sentences' ? fullSentence : current.answer)} className="text-muted-foreground hover:text-foreground" aria-label="Vorlesen">
                    <Volume2 className="size-4" />
                  </button>
                </div>
                {current.reason && <p className="text-sm text-muted-foreground">{current.reason}</p>}
                {current.ruSentence && <p className="text-sm text-muted-foreground">{current.ruSentence}</p>}
                {current.ru && <p className="text-sm text-muted-foreground">= {current.ru}</p>}
                <p className="text-xs text-muted-foreground/70 font-mono">{current.row}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
