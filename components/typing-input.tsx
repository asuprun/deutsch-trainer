'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RatingButtons, type RatingIntervals } from '@/components/rating-buttons';
import { compareAnswer, resultToGrade, type CompareResult } from '@/lib/utils/compare';
import { cn } from '@/lib/utils';
import type { Grade } from 'ts-fsrs';

type Props = {
  correctAnswer: string;
  /** Текст подсказки над полем ввода, например "переведи на русский" */
  hint?: string;
  intervals: RatingIntervals | null;
  onRate: (grade: Grade) => void;
  disabled?: boolean;
};

const RESULT_CONFIG: Record<
  CompareResult,
  { icon: React.ElementType; label: string; color: string; bg: string }
> = {
  exact:  { icon: CheckCircle2, label: 'Точно!',   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  close:  { icon: CheckCircle2, label: 'Верно!',   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  almost: { icon: AlertCircle,  label: 'Почти…',   color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30' },
  wrong:  { icon: XCircle,      label: 'Неверно',  color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/30' },
};

export function TypingInput({ correctAnswer, hint, intervals, onRate, disabled }: Props) {
  const inputRef   = useRef<HTMLInputElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const resultRef  = useRef<HTMLDivElement>(null);
  const [value, setValue]   = useState('');
  const [result, setResult] = useState<CompareResult | null>(null);
  const [checked, setChecked] = useState(false);

  // Автофокус на поле ввода при появлении
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // После проверки — фокус на «Далее» + скролл к результату (мобилка)
  useEffect(() => {
    if (checked) {
      const t1 = setTimeout(() => nextBtnRef.current?.focus(), 60);
      // Даём клавиатуре закрыться (~300ms), затем скроллим к результату
      const t2 = setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 350);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [checked]);

  function handleCheck() {
    if (!value.trim()) return;
    setResult(compareAnswer(value, correctAnswer));
    setChecked(true);
  }

  // Enter в поле ввода → проверить
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!checked) handleCheck();
    }
  }

  // Enter / 1-4 на кнопке «Далее» или где угодно после проверки
  useEffect(() => {
    if (!checked) return;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'Enter' && result != null) {
        e.preventDefault();
        onRate(resultToGrade(result));
      }
      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        onRate(Number(e.key) as Grade);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [checked, result, onRate]);

  const cfg  = result ? RESULT_CONFIG[result] : null;
  const Icon = cfg?.icon;
  const suggestedGrade = result != null ? resultToGrade(result) : undefined;

  return (
    <div className="w-full max-w-xl flex flex-col gap-4">
      {/* Подсказка */}
      {hint && !checked && (
        <p className="text-sm text-muted-foreground text-center">{hint}</p>
      )}

      {/* Поле ввода */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Перевод на русский…"
          disabled={checked || disabled}
          className={cn(
            'text-base h-12 transition-colors',
            checked && (result === 'exact' || result === 'close')  && 'border-emerald-500/60',
            checked && result === 'almost' && 'border-amber-500/60',
            checked && result === 'wrong'  && 'border-rose-500/60',
          )}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          lang="ru"
        />
        {!checked && (
          <Button size="lg" onClick={handleCheck} disabled={!value.trim() || disabled}>
            Проверить
            <kbd className="ml-2 rounded bg-black/20 px-1.5 py-0.5 text-xs font-mono hidden sm:inline">
              Enter
            </kbd>
          </Button>
        )}
      </div>

      {/* Результат */}
      {checked && cfg && Icon && (
        <div ref={resultRef} className={cn('rounded-lg border p-4 flex flex-col gap-2', cfg.bg)}>
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
        </div>
      )}

      {/* Действия после проверки */}
      {checked && (
        <div className="flex flex-col gap-3">
          {/* Главная кнопка «Далее» — авто-оценка */}
          <Button
            ref={nextBtnRef}
            size="lg"
            onClick={() => suggestedGrade && onRate(suggestedGrade)}
            disabled={disabled}
            className="w-full"
          >
            Далее
            <ArrowRight className="ml-2 size-4" />
            <kbd className="ml-2 rounded bg-black/20 px-1.5 py-0.5 text-xs font-mono hidden sm:inline">
              Enter
            </kbd>
          </Button>

          {/* Изменить оценку вручную */}
          <details className="group">
            <summary className="text-xs text-muted-foreground cursor-pointer select-none text-center list-none flex items-center justify-center gap-1 hover:text-foreground transition-colors">
              <span>Изменить оценку</span>
              <span className="group-open:rotate-180 transition-transform inline-block">▾</span>
            </summary>
            <div className="mt-3">
              <RatingButtons
                intervals={intervals}
                onRate={onRate}
                disabled={disabled}
                suggestedGrade={suggestedGrade}
              />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
