'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, ChevronLeft, RotateCw, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';

// ─── Types ────────────────────────────────────────────────────────────────────

type Exercise = {
  sentence: string;
  answer: string;
  hint?: string;
  explanation: string;
};

type Status = 'loading' | 'active' | 'done' | 'error';
type CheckState = null | 'correct' | 'wrong';

type Props = {
  noteId: string;
  noteTitle: string;
  onBack: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function GrammarExerciseSession({ noteId, noteTitle, onBack }: Props) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>('loading');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [checkState, setCheckState] = useState<CheckState>(null);
  const [score, setScore] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load exercises ──────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus('loading');
      try {
        const res = await fetch('/api/grammar/exercises', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grammar_note_id: noteId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!data.exercises?.length) throw new Error('No exercises');
        if (!cancelled) {
          setExercises(data.exercises);
          setIdx(0);
          setInput('');
          setCheckState(null);
          setScore(0);
          setStatus('active');
          setTimeout(() => inputRef.current?.focus(), 100);
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    }
    load();
    return () => { cancelled = true; };
  }, [noteId]);

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
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }

  // ── Restart ─────────────────────────────────────────────────────────────────

  function restart() {
    setIdx(0);
    setInput('');
    setCheckState(null);
    setScore(0);
    setStatus('active');
    setTimeout(() => inputRef.current?.focus(), 60);
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
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-destructive">{t('gramex_error')}</p>
        <div className="flex gap-2">
          <Button onClick={onBack} variant="outline">
            <ChevronLeft className="size-4 mr-1" />
            {t('gramex_back')}
          </Button>
          <Button onClick={() => { setStatus('loading'); }}>
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
    <div className="flex flex-col gap-5 max-w-xl">
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
      </div>

      {/* Topic label */}
      <p className="text-sm font-medium text-muted-foreground">{noteTitle}</p>

      {/* Sentence card */}
      <div className="rounded-xl border bg-card px-6 py-5 text-center">
        <p className="text-xl leading-relaxed font-serif">
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

      {/* Hint (only before check) */}
      {ex.hint && checkState === null && (
        <p className="text-sm text-center text-muted-foreground">💡 {ex.hint}</p>
      )}

      {/* Feedback (after check) */}
      {checkState !== null && (
        <div
          className={cn(
            'rounded-lg border p-4 text-sm',
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
