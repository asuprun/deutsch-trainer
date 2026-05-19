'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatInterval } from '@/lib/format/intervals';
import type { Grade } from 'ts-fsrs';

export type RatingIntervals = {
  [K in 1 | 2 | 3 | 4]?: { due: string };
};

type Props = {
  intervals: RatingIntervals | null;
  onRate: (rating: Grade) => void;
  disabled?: boolean;
  /** Кнопка с этой оценкой подсвечивается как авто-предложение */
  suggestedGrade?: Grade;
};

const RATINGS: Array<{
  grade: Grade;
  label: string;
  shortcut: string;
  className: string;
}> = [
  { grade: 1, label: 'Снова',  shortcut: '1', className: 'bg-rose-600 hover:bg-rose-700 text-white' },
  { grade: 2, label: 'Сложно', shortcut: '2', className: 'bg-amber-600 hover:bg-amber-700 text-white' },
  { grade: 3, label: 'Хорошо', shortcut: '3', className: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  { grade: 4, label: 'Легко',  shortcut: '4', className: 'bg-sky-600 hover:bg-sky-700 text-white' },
];

export function RatingButtons({ intervals, onRate, disabled, suggestedGrade }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {RATINGS.map(({ grade, label, shortcut, className }) => {
        const interval = intervals?.[grade];
        const intervalText = interval ? formatInterval(interval.due) : '—';
        const suggested = suggestedGrade === grade;
        return (
          <Button
            key={grade}
            onClick={() => onRate(grade)}
            disabled={disabled}
            className={cn(
              'h-auto flex-col gap-1 py-3 border-0 transition-all',
              className,
              suggested && 'ring-2 ring-white/70 ring-offset-2 ring-offset-background scale-105',
            )}
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{label}</span>
              <span className="rounded bg-black/20 px-1.5 py-0.5 text-xs font-mono">{shortcut}</span>
            </div>
            <span className="text-xs opacity-90">{intervalText}</span>
            {suggested && (
              <span className="text-[10px] opacity-75">авто</span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
