'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, RotateCw, Home, Check, XCircle, ArrowRight, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n/context';
import { useTTSContext } from '@/lib/tts-context';
import { cn } from '@/lib/utils';
import { itemsFor, type DrillItem, type DrillTopic } from '@/lib/grammar-drills/data';

type Props = { count: number; topic: DrillTopic | 'all'; onExit: () => void };

// Fehlerzähler pro Aufgabe (nur dieses Gerät): falsch +1, richtig −1 → Fehler kommen öfter wieder
const STORE_KEY = 'grammar-drill-errors-v1';
function loadErrors(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}'); } catch { return {}; }
}
function saveErrors(e: Record<string, number>) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(e)); } catch { /* Speicher blockiert — egal */ }
}

// gewichtete Zufallsauswahl ohne Zurücklegen (Gewicht 1 + 3×Fehler)
function pick(pool: DrillItem[], n: number, errors: Record<string, number>): DrillItem[] {
  const rest = pool.map((it) => ({ it, w: 1 + 3 * (errors[it.id] ?? 0) }));
  const out: DrillItem[] = [];
  while (out.length < n && rest.length) {
    let r = Math.random() * rest.reduce((a, x) => a + x.w, 0);
    const i = rest.findIndex((x) => (r -= x.w) <= 0);
    out.push(rest.splice(i < 0 ? rest.length - 1 : i, 1)[0].it);
  }
  return out;
}

function shuffled(words: string[]): string[] {
  const solution = words.join(' ');
  let w = [...words];
  for (let tries = 0; tries < 10; tries++) {
    w = [...words];
    for (let i = w.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [w[i], w[j]] = [w[j], w[i]];
    }
    if (w.join(' ') !== solution) break;
  }
  return w;
}

// Kommas ignorieren, Groß-/Kleinschreibung nicht
const normSentence = (s: string) => s.replace(/,/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const fullSentence = (it: DrillItem) => (it.kind === 'choice' ? it.de.replace('___', it.answer ?? '') : it.de);

export function GrammarDrill({ count, topic, onExit }: Props) {
  const { t } = useI18n();
  const { speak } = useTTSContext();
  // erste Runde direkt beim Mounten (Komponente wird nur clientseitig nach dem Start-Klick gerendert)
  const [items, setItems] = useState<DrillItem[]>(() => pick(itemsFor(topic), count, loadErrors()));
  const [idx, setIdx] = useState(0);
  const [available, setAvailable] = useState<string[]>(() => {
    const first = items[0];
    return first && first.kind === 'build' ? shuffled(first.de.split(' ')) : [];
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [choice, setChoice] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [ok, setOk] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const prepare = useCallback((it: DrillItem | undefined) => {
    setSelected([]); setChoice(null); setChecked(false); setOk(false);
    setAvailable(it && it.kind === 'build' ? shuffled(it.de.split(' ')) : []);
  }, []);

  const start = useCallback(() => {
    const list = pick(itemsFor(topic), count, loadErrors());
    setItems(list); setIdx(0); setScore(0); setDone(false);
    prepare(list[0]);
  }, [topic, count, prepare]);

  const current = items[idx];

  const pickWord = (word: string, i: number) => {
    if (checked) return;
    setAvailable((p) => p.filter((_, k) => k !== i));
    setSelected((p) => [...p, word]);
  };
  const removeWord = (word: string, i: number) => {
    if (checked) return;
    setSelected((p) => p.filter((_, k) => k !== i));
    setAvailable((p) => [...p, word]);
  };

  const ready = !!current && (current.kind === 'build' ? available.length === 0 && selected.length > 0 : choice !== null);

  const check = useCallback(() => {
    if (!current || checked || !ready) return;
    let good: boolean;
    if (current.kind === 'build') {
      const given = normSentence(selected.join(' '));
      good = [current.de, ...current.alts].some((s) => normSentence(s) === given);
    } else {
      good = [current.answer ?? '', ...current.alts].includes(choice ?? '');
    }
    setOk(good); setChecked(true);
    if (good) setScore((s) => s + 1);
    const e = loadErrors();
    e[current.id] = Math.max(0, Math.min(5, (e[current.id] ?? 0) + (good ? -1 : 1)));
    if (!e[current.id]) delete e[current.id];
    saveErrors(e);
    speak(fullSentence(current));
  }, [current, checked, ready, selected, choice, speak]);

  const next = useCallback(() => {
    if (idx + 1 >= items.length) { setDone(true); return; }
    setIdx(idx + 1);
    prepare(items[idx + 1]);
  }, [idx, items, prepare]);

  // Enter → prüfen bzw. weiter (mit Verzögerung nach dem Prüfen, damit das Prüf-Enter nicht durchrutscht)
  useEffect(() => {
    if (done) return;
    if (!checked) {
      const h = (e: KeyboardEvent) => { if (e.key === 'Enter' && ready) { e.preventDefault(); check(); } };
      window.addEventListener('keydown', h);
      return () => window.removeEventListener('keydown', h);
    }
    let h: ((e: KeyboardEvent) => void) | null = null;
    const id = setTimeout(() => {
      h = (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); next(); } };
      window.addEventListener('keydown', h);
    }, 350);
    return () => { clearTimeout(id); if (h) window.removeEventListener('keydown', h); };
  }, [checked, ready, check, next, done]);

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

  const parts = current.de.split('___');

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <header className="shrink-0 flex items-center gap-2 border-b px-4 py-3 sm:px-6">
        <Button variant="ghost" size="icon" onClick={onExit} aria-label={t('review_close_label')}><X className="size-5" /></Button>
        <span className="flex-1 text-center text-sm tabular-nums text-muted-foreground">{idx + 1} / {items.length}</span>
        <span className="text-sm tabular-nums text-muted-foreground">✓ {score}</span>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        <div className="flex flex-col items-center justify-center min-h-full p-4 gap-6">
          <div className="w-full max-w-xl flex flex-col gap-4">
            <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">
              {t(`gdrill_topic_${current.topic}`)}
            </p>
            <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-widest text-primary/60 mb-1">
                {t(current.kind === 'build' ? 'grambld_instruction' : 'gdrill_fill_instruction')}
              </p>
              <p className="text-base font-medium leading-snug">{current.ru}</p>
            </div>

            {current.kind === 'build' ? (
              <>
                <div className="min-h-[52px] rounded-xl border bg-card px-4 py-3 flex flex-wrap gap-2">
                  {selected.length === 0 ? (
                    <span className="text-sm text-muted-foreground italic">{t('grambld_tap_hint')}</span>
                  ) : selected.map((w, i) => (
                    <button
                      key={i} onClick={() => removeWord(w, i)} disabled={checked}
                      className={cn(
                        'rounded-full border px-3 py-1 text-sm bg-primary text-primary-foreground transition-colors',
                        checked ? 'opacity-70 cursor-default' : 'cursor-pointer hover:opacity-80',
                      )}
                    >{w}</button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {available.map((w, i) => (
                    <button
                      key={i} onClick={() => pickWord(w, i)} disabled={checked}
                      className={cn('rounded-full border px-3 py-1 text-sm transition-colors', checked ? 'opacity-50 cursor-default' : 'cursor-pointer hover:bg-muted')}
                    >{w}</button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-xl leading-relaxed text-center">
                  {parts[0]}
                  <span className={cn(
                    'inline-block min-w-20 mx-1 rounded-md border-b-2 px-2 text-center',
                    checked ? (ok ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-rose-500 text-rose-600 dark:text-rose-400') : 'border-primary',
                  )}>{choice ?? ' '}</span>
                  {parts[1]}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {(current.options ?? []).map((o) => (
                    <button
                      key={o} onClick={() => !checked && setChoice(o)} disabled={checked}
                      className={cn(
                        'rounded-full border px-4 py-1.5 text-sm transition-colors',
                        choice === o ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted',
                        checked && 'cursor-default',
                      )}
                    >{o}</button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="w-full max-w-sm flex flex-col gap-3">
            {checked ? (
              <Button size="lg" onClick={next} className="w-full">
                {idx + 1 < items.length ? t('gramex_next') : t('gramex_finish')}<ArrowRight className="ml-2 size-4" />
              </Button>
            ) : (
              <Button size="lg" onClick={check} disabled={!ready} className="w-full">{t('gramex_check')}</Button>
            )}

            {checked && (
              <div className="flex flex-col items-center gap-1.5 text-center">
                <div className={cn('flex items-center gap-2 text-sm font-medium', ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                  {ok ? <><Check className="size-4" /> {t('gramex_correct')}</> : <><XCircle className="size-4" /> {t('gramex_wrong')}</>}
                  <button type="button" onClick={() => speak(fullSentence(current))} className="text-muted-foreground hover:text-foreground" aria-label="Vorlesen">
                    <Volume2 className="size-4" />
                  </button>
                </div>
                {!ok && <p className="text-sm font-medium">{fullSentence(current)}</p>}
                {ok && current.kind === 'build' && <p className="text-sm text-muted-foreground">{current.de}</p>}
                <p className="text-sm text-muted-foreground">{current.reason}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
