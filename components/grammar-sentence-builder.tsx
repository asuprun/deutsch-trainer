'use client';

import { useEffect, useState } from 'react';
import { Loader2, ChevronLeft, RotateCw, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';

// ─── Types ────────────────────────────────────────────────────────────────────

type Exercise = {
  words: string[];
  sentence: string;
  translation: string;
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

export function GrammarSentenceBuilder({ noteId, noteTitle, onBack }: Props) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>('loading');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>([]);
  const [checkState, setCheckState] = useState<CheckState>(null);
  const [score, setScore] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // ── Load exercises ──────────────────────────────────────────────────────────

  function initExercise(exList: Exercise[], i: number) {
    setIdx(i);
    setSelected([]);
    setAvailable([...exList[i].words]);
    setCheckState(null);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus('loading');
      try {
        const res = await fetch('/api/grammar/sentence-builder', {
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
          setFromCache(!!data.cached);
          setScore(0);
          initExercise(data.exercises, 0);
          setStatus('active');
        }
      } catch (e) {
        if (!cancelled) {
          setErrorMsg(e instanceof Error ? e.message : String(e));
          setStatus('error');
        }
      }
    }
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // ── Chip actions ────────────────────────────────────────────────────────────

  function pickWord(word: string, avIdx: number) {
    if (checkState !== null) return;
    setAvailable((prev) => prev.filter((_, i) => i !== avIdx));
    setSelected((prev) => [...prev, word]);
  }

  function removeWord(word: string, selIdx: number) {
    if (checkState !== null) return;
    setSelected((prev) => prev.filter((_, i) => i !== selIdx));
    setAvailable((prev) => [...prev, word]);
  }

  // ── Check ───────────────────────────────────────────────────────────────────

  function check() {
    if (selected.length !== exercises[idx].words.length || checkState !== null) return;
    const correct = selected.join(' ') === exercises[idx].sentence;
    setCheckState(correct ? 'correct' : 'wrong');
    if (correct) setScore((s) => s + 1);
  }

  // ── Next ────────────────────────────────────────────────────────────────────

  function next() {
    if (idx + 1 >= exercises.length) {
      setStatus('done');
    } else {
      initExercise(exercises, idx + 1);
    }
  }

  // ── Restart ─────────────────────────────────────────────────────────────────

  function restart() {
    setScore(0);
    initExercise(exercises, 0);
    setStatus('active');
  }

  // ── Render: loading ─────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('grambld_generating')}</p>
      </div>
    );
  }

  // ── Render: error ───────────────────────────────────────────────────────────

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center max-w-sm">
        <p className="text-destructive">{t('grambld_error')}</p>
        {errorMsg && (
          <p className="text-xs text-muted-foreground font-mono bg-muted rounded px-3 py-2 text-left w-full">
            {errorMsg}
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={onBack} variant="outline">
            <ChevronLeft className="size-4 mr-1" />
            {t('grambld_back')}
          </Button>
          <Button onClick={() => { setErrorMsg(''); setStatus('loading'); }}>
            <RotateCw className="size-4 mr-1.5" />
            {t('grambld_retry')}
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
          <p className="text-muted-foreground mt-1">{t('grambld_correct_answers')}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={restart}>
            <RotateCw className="size-4 mr-1.5" />
            {t('grambld_again')}
          </Button>
          <Button onClick={onBack} variant="outline">
            <ChevronLeft className="size-4 mr-1" />
            {t('grambld_back_to_topics')}
          </Button>
        </div>
      </div>
    );
  }

  // ── Render: active ──────────────────────────────────────────────────────────

  const ex = exercises[idx];

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
        {fromCache && (
          <Badge variant="outline" className="text-xs shrink-0">
            {t('gramex_cached')}
          </Badge>
        )}
      </div>

      {/* Topic + task label */}
      <div>
        <p className="text-sm font-medium text-muted-foreground">{noteTitle}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{ex.translation}</p>
      </div>

      {/* Instruction */}
      <p className="text-sm font-medium">{t('grambld_instruction')}</p>

      {/* Selected words area */}
      <div className="min-h-[52px] rounded-xl border bg-card px-4 py-3 flex flex-wrap gap-2">
        {selected.length === 0 ? (
          <span className="text-sm text-muted-foreground italic">
            {t('grambld_tap_hint')}
          </span>
        ) : (
          selected.map((word, i) => (
            <button
              key={i}
              onClick={() => removeWord(word, i)}
              disabled={checkState !== null}
              className={cn(
                'rounded-full border px-3 py-1 text-sm cursor-pointer transition-colors',
                checkState === null
                  ? 'bg-primary text-primary-foreground hover:opacity-80'
                  : 'bg-primary text-primary-foreground opacity-70 cursor-default',
              )}
            >
              {word}
            </button>
          ))
        )}
      </div>

      {/* Available words */}
      <div className="flex flex-wrap gap-2">
        {available.map((word, i) => (
          <button
            key={i}
            onClick={() => pickWord(word, i)}
            disabled={checkState !== null}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              checkState === null
                ? 'cursor-pointer hover:bg-muted'
                : 'cursor-default opacity-50',
            )}
          >
            {word}
          </button>
        ))}
      </div>

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
                <Check className="size-4" /> {t('grambld_correct')}
              </>
            ) : (
              <>
                <X className="size-4" /> {t('grambld_wrong')}
              </>
            )}
          </div>
          {checkState === 'wrong' && (
            <p className="text-foreground/90 mb-1.5 font-medium">
              {t('grambld_correct_answer')} <span className="text-emerald-700 dark:text-emerald-400">{ex.sentence}</span>
            </p>
          )}
          <p className="text-foreground/80 leading-relaxed">{ex.explanation}</p>
        </div>
      )}

      {/* Check or Next button */}
      {checkState === null ? (
        <Button
          onClick={check}
          disabled={selected.length !== ex.words.length}
          className="self-end"
        >
          {t('grambld_check')}
        </Button>
      ) : (
        <Button onClick={next} className="self-end">
          {idx + 1 < exercises.length ? t('grambld_next') : t('grambld_finish')}
        </Button>
      )}
    </div>
  );
}
