'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, ChevronLeft, RotateCw, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';

// ─── Types ────────────────────────────────────────────────────────────────────

type Exercise = {
  sentence: string;
  answer: string;
  lemma?: string;
  hint?: string;
  explanation: string;
};

type Status = 'lobby' | 'loading' | 'active' | 'done' | 'error';
type CheckState = null | 'correct' | 'wrong';

const COUNT_OPTIONS = [5, 10, 15];

type Props = {
  noteId: string;
  noteTitle: string;
  onBack: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function GrammarExerciseSession({ noteId, noteTitle, onBack }: Props) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>('lobby');
  const [count, setCount] = useState(5);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [checkState, setCheckState] = useState<CheckState>(null);
  const [score, setScore] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Фокус + scroll into view ────────────────────────────────────────────────

  function focusInput(delay = 100) {
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, delay);
  }

  // ── Load exercises ──────────────────────────────────────────────────────────

  async function load(selectedCount: number) {
    setCount(selectedCount);
    setStatus('loading');
    try {
      const res = await fetch('/api/grammar/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grammar_note_id: noteId, count: selectedCount }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.exercises?.length) throw new Error('No exercises');
      setExercises(data.exercises);
      setFromCache(!!data.cached);
      setIdx(0);
      setInput('');
      setCheckState(null);
      setScore(0);
      setStatus('active');
      focusInput(100);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  // ── Check ───────────────────────────────────────────────────────────────────

  function check() {
    if (!input.trim() || checkState !== null) return;
    const ex = exercises[idx];
    const correct = input.trim().toLowerCase() === ex.answer.toLowerCase();
    setCheckState(correct ? 'correct' : 'wrong');
    if (correct) setScore((s) => s + 1);
  }

  // ── Next ────────────────────────────────────────────────────────────────────

  function next() {
    if (idx + 1 >= exercises.length) {
      setStatus('done');
    } else {
      setIdx((i) => i + 1);
      setInput('');
      setCheckState(null);
      focusInput(60);
    }
  }

  // ── Enter → Next после проверки ────────────────────────────────────────────

  useEffect(() => {
    if (checkState === null) return;
    // Задержка 350 мс — чтобы Enter с мобильной клавиатуры не попал сразу в «Weiter»
    let handler: ((e: KeyboardEvent) => void) | null = null;
    const id = setTimeout(() => {
      handler = (e: KeyboardEvent) => {
        if (e.key === 'Enter') { e.preventDefault(); next(); }
      };
      window.addEventListener('keydown', handler);
    }, 350);
    return () => {
      clearTimeout(id);
      if (handler) window.removeEventListener('keydown', handler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkState, idx]);

  // ── Restart ─────────────────────────────────────────────────────────────────

  function restart() {
    setIdx(0);
    setInput('');
    setCheckState(null);
    setScore(0);
    setStatus('active');
    focusInput(60);
  }

  // ── Render: lobby (выбор количества) ─────────────────────────────────────────

  if (status === 'lobby') {
    return (
      <div className="flex flex-col gap-6 max-w-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={onBack}>
            <ChevronLeft className="size-4" />
          </Button>
          <p className="text-sm font-medium text-muted-foreground">{noteTitle}</p>
        </div>
        <p className="text-lg font-semibold">{t('gramex_how_many')}</p>
        <div className="flex flex-wrap gap-2">
          {COUNT_OPTIONS.map((n) => (
            <Button
              key={n}
              variant={count === n ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCount(n)}
              className="min-w-[3.5rem]"
            >
              {n}
            </Button>
          ))}
        </div>
        <Button size="lg" onClick={() => load(count)} className="self-start min-w-[140px]">
          {t('gramex_start')} →
        </Button>
      </div>
    );
  }

  // ── Render: loading ─────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('gramex_generating')}</p>
      </div>
    );
  }

  // ── Render: error ───────────────────────────────────────────────────────────

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center max-w-sm">
        <p className="text-destructive">{t('gramex_error')}</p>
        {errorMsg && (
          <p className="text-xs text-muted-foreground font-mono bg-muted rounded px-3 py-2 text-left w-full">
            {errorMsg}
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={onBack} variant="outline">
            <ChevronLeft className="size-4 mr-1" />
            {t('gramex_back')}
          </Button>
          <Button onClick={() => { setErrorMsg(''); load(count); }}>
            <RotateCw className="size-4 mr-1.5" />
            {t('gramex_retry')}
          </Button>
        </div>
      </div>
    );
  }

  // ── Render: done ────────────────────────────────────────────────────────────

  if (status === 'done') {
    const pct = Math.round((score / exercises.length) * 100);
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center max-w-sm mx-auto">
        <div className="text-5xl">{pct >= 80 ? '🎉' : pct >= 50 ? '💪' : '📚'}</div>
        <div>
          <p className="text-3xl font-bold tabular-nums">
            {score} / {exercises.length}
          </p>
          <p className="text-muted-foreground mt-1">{t('gramex_correct_answers')}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={restart}>
            <RotateCw className="size-4 mr-1.5" />
            {t('gramex_again')}
          </Button>
          <Button onClick={onBack} variant="outline">
            <ChevronLeft className="size-4 mr-1" />
            {t('gramex_back_to_topics')}
          </Button>
        </div>
      </div>
    );
  }

  // ── Render: active ──────────────────────────────────────────────────────────

  const ex = exercises[idx];
  const parts = ex.sentence.split('___');

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      {/* Progress row */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={onBack}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <Progress value={(idx / exercises.length) * 100} className="h-1.5" />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground shrink-0">
          {idx + 1} / {exercises.length}
        </span>
        {fromCache && (
          <Badge variant="outline" className="text-xs shrink-0">
            {t('gramex_cached')}
          </Badge>
        )}
      </div>

      {/* Topic label */}
      <p className="text-sm font-medium text-muted-foreground">{noteTitle}</p>

      {/* Sentence card */}
      <div className="rounded-xl border bg-card px-5 py-4 text-center">
        <p className="text-xl leading-relaxed font-serif [overflow-wrap:anywhere]">
          {parts[0]}
          {checkState === null && (
            <span className="inline-block w-16 mx-1 border-b-2 border-dashed border-primary/50 align-bottom" />
          )}
          {checkState === 'correct' && (
            <span className="mx-1 font-semibold text-emerald-600 dark:text-emerald-400">
              {input}
            </span>
          )}
          {checkState === 'wrong' && (
            <>
              <span className="mx-1 text-rose-500 line-through opacity-80">{input}</span>
              <span className="mx-1 font-semibold text-emerald-600 dark:text-emerald-400">
                {ex.answer}
              </span>
            </>
          )}
          {parts[1]}
        </p>
      </div>

      {/* Lemma + hint (only before check) */}
      {checkState === null && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {ex.lemma && (
            <div className="flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1">
              <span className="text-xs text-muted-foreground">{t('gramex_lemma')}:</span>
              <span className="text-sm font-semibold font-serif">{ex.lemma}</span>
            </div>
          )}
          {ex.hint && (
            <p className="text-sm text-muted-foreground">💡 {ex.hint}</p>
          )}
        </div>
      )}

      {/* Feedback (after check) */}
      {checkState !== null && (
        <div
          className={cn(
            'rounded-lg border p-3 text-sm',
            checkState === 'correct'
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-rose-500/10 border-rose-500/30',
          )}
        >
          <div
            className={cn(
              'flex items-center gap-2 font-semibold mb-1.5',
              checkState === 'correct'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-700 dark:text-rose-400',
            )}
          >
            {checkState === 'correct' ? (
              <>
                <Check className="size-4" /> {t('gramex_correct')}
              </>
            ) : (
              <>
                <X className="size-4" /> {t('gramex_wrong')}
              </>
            )}
          </div>
          <p className="text-foreground/80 leading-relaxed">{ex.explanation}</p>
        </div>
      )}

      {/* Input or Next */}
      {checkState === null ? (
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') check();
            }}
            onFocus={() => {
              inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }}
            placeholder={t('gramex_placeholder')}
            className="text-base"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <Button onClick={check} disabled={!input.trim()}>
            {t('gramex_check')}
          </Button>
        </div>
      ) : (
        <Button onClick={next} className="self-end">
          {idx + 1 < exercises.length ? t('gramex_next') : t('gramex_finish')}
        </Button>
      )}
    </div>
  );
}
