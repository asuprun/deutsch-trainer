'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, X, RotateCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n/context';
import { useTTSContext } from '@/lib/tts-context';
import { cn } from '@/lib/utils';

type Noun = {
  id: string;
  front: string;
  back: string;
  gender: 'der' | 'die' | 'das';
  plural: string | null;
};

type Status = 'loading' | 'empty' | 'active' | 'done' | 'error';

const ARTICLES: Array<{ value: 'der' | 'die' | 'das'; color: string; ring: string }> = [
  { value: 'der', color: 'bg-blue-500 hover:bg-blue-500/90',    ring: 'ring-blue-400' },
  { value: 'die', color: 'bg-pink-500 hover:bg-pink-500/90',    ring: 'ring-pink-400' },
  { value: 'das', color: 'bg-emerald-500 hover:bg-emerald-500/90', ring: 'ring-emerald-400' },
];

type Props = {
  count: number;
  sourceId: string | null;
  onExit: () => void;
};

export function GenderDrill({ count, sourceId, onExit }: Props) {
  const { t } = useI18n();
  const { speak } = useTTSContext();
  const [status, setStatus] = useState<Status>('loading');
  const [nouns, setNouns] = useState<Noun[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<'der' | 'die' | 'das' | null>(null);
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string>('');

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const qs = new URLSearchParams({ limit: String(count) });
      if (sourceId) qs.set('source_id', sourceId);
      const res = await fetch(`/api/review/nouns?${qs}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.cards?.length) {
        setStatus('empty');
        return;
      }
      setNouns(data.cards);
      setIdx(0);
      setPicked(null);
      setScore(0);
      setStatus('active');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, [count, sourceId]);

  useEffect(() => { load(); }, [load]);

  const current = status === 'active' ? nouns[idx] : null;

  const advance = useCallback(() => {
    setPicked(null);
    if (idx + 1 >= nouns.length) {
      setStatus('done');
    } else {
      setIdx((i) => i + 1);
    }
  }, [idx, nouns.length]);

  const pick = useCallback(
    (value: 'der' | 'die' | 'das') => {
      if (picked || !current) return;
      setPicked(value);
      const correct = value === current.gender;
      if (correct) setScore((s) => s + 1);
      // Озвучиваем правильный вариант «der Hund»
      speak(`${current.gender} ${current.front}`);
      // Автопереход: быстрее при верном, дольше при ошибке (успеть прочитать)
      const delay = correct ? 850 : 1900;
      setTimeout(advance, delay);
    },
    [picked, current, speak, advance],
  );

  // Клавиши 1/2/3 → der/die/das
  useEffect(() => {
    if (status !== 'active') return;
    function onKey(e: KeyboardEvent) {
      if (e.key === '1') pick('der');
      else if (e.key === '2') pick('die');
      else if (e.key === '3') pick('das');
      else if (e.key === 'Escape') onExit();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, pick, onExit]);

  // ── Loading ──
  if (status === 'loading') {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Error ──
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

  // ── Empty ──
  if (status === 'empty') {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="text-2xl font-semibold">{t('gender_drill_empty')}</h1>
        <Button variant="outline" onClick={onExit}>{t('gramex_back')}</Button>
      </div>
    );
  }

  // ── Done ──
  if (status === 'done') {
    const pct = Math.round((score / nouns.length) * 100);
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-background p-6 text-center">
        <div className="text-5xl">{pct >= 80 ? '🎉' : pct >= 50 ? '💪' : '📚'}</div>
        <div>
          <p className="text-3xl font-bold tabular-nums">{score} / {nouns.length}</p>
          <p className="text-muted-foreground mt-1">{t('gramex_correct_answers')}</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={load}><RotateCw className="size-4 mr-2" />{t('review_another_session')}</Button>
          <Button variant="outline" onClick={onExit}>
            <Home className="size-4 mr-2" />{t('btn_home')}
          </Button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <header className="shrink-0 flex items-center gap-2 border-b px-4 py-3 sm:px-6">
        <Button variant="ghost" size="icon" onClick={onExit} aria-label={t('review_close_label')}>
          <X className="size-5" />
        </Button>
        <span className="flex-1 text-center text-sm tabular-nums text-muted-foreground">
          {idx + 1} / {nouns.length}
        </span>
        <span className="text-sm tabular-nums text-muted-foreground">✓ {score}</span>
      </header>

      <main className="flex-1 min-h-0 flex flex-col items-center justify-center gap-8 p-4">
        {/* Существительное */}
        <div className="text-center">
          <h2 className="font-serif font-medium leading-tight [overflow-wrap:anywhere] [font-size:clamp(1.75rem,8vw,3.5rem)]">
            {current.front}
          </h2>
          {picked && (
            <p className="mt-3 text-muted-foreground text-lg">{current.back}</p>
          )}
        </div>

        {/* Кнопки артиклей */}
        <div className="flex gap-3 sm:gap-4 w-full max-w-md justify-center">
          {ARTICLES.map(({ value, color, ring }, i) => {
            const isCorrect = picked && value === current.gender;
            const isWrongPick = picked === value && value !== current.gender;
            return (
              <button
                key={value}
                onClick={() => pick(value)}
                disabled={!!picked}
                className={cn(
                  'flex-1 rounded-2xl py-6 text-2xl font-semibold text-white transition-all',
                  color,
                  picked && !isCorrect && !isWrongPick && 'opacity-30',
                  isCorrect && `ring-4 ${ring} scale-105`,
                  isWrongPick && 'ring-4 ring-rose-400 opacity-70 line-through',
                )}
              >
                {value}
                <span className="block text-xs font-normal opacity-70 mt-1">{i + 1}</span>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
