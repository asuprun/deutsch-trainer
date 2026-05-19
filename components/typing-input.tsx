'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RatingButtons, type RatingIntervals } from '@/components/rating-buttons';
import { compareAnswer, resultToGrade, type CompareResult } from '@/lib/utils/compare';
import { cn } from '@/lib/utils';
import type { Grade } from 'ts-fsrs';

type Props = {
  correctAnswer: string;
  intervals: RatingIntervals | null;
  onRate: (grade: Grade) => void;
  disabled?: boolean;
};

const RESULT_CONFIG: Record<
  CompareResult,
  { icon: React.ElementType; label: string; color: string; bg: string }
> = {
  exact:  { icon: CheckCircle2, label: 'Точно!',    color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  close:  { icon: CheckCircle2, label: 'Верно!',    color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  almost: { icon: AlertCircle,  label: 'Почти...',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30' },
  wrong:  { icon: XCircle,      label: 'Неверно',   color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/30' },
};

export function TypingInput({ correctAnswer, intervals, onRate, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CompareResult | null>(null);
  const [checked, setChecked] = useState(false);

  // Автофокус при появлении компонента
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  function handleCheck() {
    if (!value.trim()) return;
    const r = compareAnswer(value, correctAnswer);
    setResult(r);
    setChecked(true);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!checked) handleCheck();
      else if (result) onRate(resultToGrade(result));
    }
  }

  const cfg = result ? RESULT_CONFIG[result] : null;
  const Icon = cfg?.icon;

  return (
    <div className="w-full max-w-xl flex flex-col gap-4">
      {/* Поле ввода */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Введи перевод…"
          disabled={checked || disabled}
          className={cn(
            'text-base h-12 transition-colors',
            checked && result === 'exact' && 'border-emerald-500/60',
            checked && result === 'close' && 'border-emerald-500/60',
            checked && result === 'almost' && 'border-amber-500/60',
            checked && result === 'wrong' && 'border-rose-500/60',
          )}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {!checked && (
          <Button size="lg" onClick={handleCheck} disabled={!value.trim() || disabled}>
            Проверить
            <kbd className="ml-2 rounded bg-black/20 px-1.5 py-0.5 text-xs font-mono hidden sm:inline">Enter</kbd>
          </Button>
        )}
      </div>

      {/* Результат */}
      {checked && cfg && Icon && (
        <div className={cn('rounded-lg border p-4 flex flex-col gap-2', cfg.bg)}>
          <div className={cn('flex items-center gap-2 font-semibold', cfg.color)}>
            <Icon className="size-5" />
            {cfg.label}
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Правильный ответ: </span>
            <span className="font-medium">{correctAnswer}</span>
          </div>
          {(result === 'almost' || result === 'wrong') && (
            <div className="text-sm">
              <span className="text-muted-foreground">Твой ответ: </span>
              <span className="line-through opacity-60">{value}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Авто-оценка: <strong>{result != null ? resultToGrade(result) : '—'}</strong> — можешь изменить ↓
            <span className="ml-2 hidden sm:inline opacity-60">(Enter — подтвердить)</span>
          </p>
        </div>
      )}

      {/* Кнопки оценки */}
      {checked && (
        <RatingButtons
          intervals={intervals}
          onRate={onRate}
          disabled={disabled}
          suggestedGrade={result != null ? resultToGrade(result) : undefined}
        />
      )}
    </div>
  );
}
