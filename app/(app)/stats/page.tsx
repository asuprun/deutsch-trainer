'use client';

import { useEffect, useState } from 'react';
import { Brain, Flame, BookOpen, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type DayEntry = { date: string; count: number };

type StatsData = {
  due_today: number;
  reviewed_today: number;
  total_cards: number;
  streak: number;
  reviews_by_day: DayEntry[];
  cards_by_state: { new: number; learning: number; review: number; relearning: number };
  cards_by_kind: { vocab: number; phrase: number; grammar_rule: number; sentence: number };
};

// 5 уровней интенсивности
function heatColor(count: number): string {
  if (count === 0)  return 'bg-muted/50';
  if (count <= 4)   return 'bg-emerald-900/80';
  if (count <= 9)   return 'bg-emerald-700';
  if (count <= 19)  return 'bg-emerald-500';
  return 'bg-emerald-300';
}

const DAY_LABELS  = ['Пн', '', 'Ср', '', 'Пт', '', 'Вс'];
const RU_MONTHS   = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return `${d.getUTCDate()} ${RU_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function Heatmap({ data }: { data: DayEntry[] }) {
  if (data.length === 0) return null;

  // data[0] = самый старый день
  const firstDate = new Date(data[0].date + 'T00:00:00Z');
  const jsDow = firstDate.getUTCDay();               // 0=Sun
  const mondayOffset = jsDow === 0 ? 6 : jsDow - 1; // отступ до понедельника

  type Cell = { empty: true } | { empty: false; date: string; count: number };
  const cells: Cell[] = [];
  for (let i = 0; i < mondayOffset; i++) cells.push({ empty: true });
  for (const d of data) cells.push({ empty: false, date: d.date, count: d.count });

  const totalCols = Math.ceil(cells.length / 7);

  // Метки месяцев: ищем первый день каждого месяца в data
  const monthLabels: { col: number; label: string }[] = [];
  data.forEach((entry, i) => {
    const d = new Date(entry.date + 'T00:00:00Z');
    if (d.getUTCDate() === 1) {
      const col = Math.floor((mondayOffset + i) / 7);
      // не дублировать если предыдущий в той же колонке
      if (!monthLabels.length || monthLabels[monthLabels.length - 1].col !== col) {
        monthLabels.push({ col, label: RU_MONTHS[d.getUTCMonth()] });
      }
    }
  });

  const totalReviews = data.reduce((s, d) => s + d.count, 0);
  const activeDays   = data.filter((d) => d.count > 0).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Активность за 16 недель</CardTitle>
        <span className="text-xs text-muted-foreground tabular-nums">
          {totalReviews} ревью · {activeDays} дн.
        </span>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={100}>
          <div className="overflow-x-auto pb-1">
            <div className="flex gap-2 min-w-fit">
              {/* Подписи дней недели */}
              <div className="flex flex-col shrink-0" style={{ gap: '3px', paddingTop: '18px' }}>
                {DAY_LABELS.map((label, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-end text-[10px] text-muted-foreground"
                    style={{ width: '14px', height: '13px' }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Колонки недель */}
              <div className="flex flex-col gap-0">
                {/* Метки месяцев */}
                <div className="relative h-[18px] mb-0.5">
                  {monthLabels.map(({ col, label }) => (
                    <span
                      key={col}
                      className="absolute text-[10px] text-muted-foreground"
                      style={{ left: `${col * 16}px` }}
                    >
                      {label}
                    </span>
                  ))}
                </div>

                {/* Сетка */}
                <div
                  className="grid"
                  style={{
                    gridTemplateRows: 'repeat(7, 13px)',
                    gridTemplateColumns: `repeat(${totalCols}, 13px)`,
                    gridAutoFlow: 'column',
                    gap: '3px',
                  }}
                >
                  {cells.map((cell, i) => {
                    if (cell.empty) {
                      return <div key={`e-${i}`} style={{ width: 13, height: 13 }} />;
                    }
                    return (
                      <Tooltip key={cell.date}>
                        <TooltipTrigger asChild>
                          <div
                            className={`rounded-sm cursor-default transition-opacity hover:opacity-80 ${heatColor(cell.count)}`}
                            style={{ width: 13, height: 13 }}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p className="font-medium">{formatDate(cell.date)}</p>
                          <p className="text-muted-foreground">
                            {cell.count === 0
                              ? 'Нет занятий'
                              : `${cell.count} ${cell.count === 1 ? 'ревью' : cell.count < 5 ? 'ревью' : 'ревью'}`}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </TooltipProvider>

        {/* Легенда */}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Меньше</span>
          {[0, 2, 6, 12, 22].map((v) => (
            <div key={v} className={`rounded-sm ${heatColor(v)}`} style={{ width: 13, height: 13 }} />
          ))}
          <span>Больше</span>
        </div>
      </CardContent>
    </Card>
  );
}

function StateBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="flex-1 rounded-full bg-muted/40 h-2 overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-sm tabular-nums">{count}</span>
    </div>
  );
}

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const summaryCards = [
    {
      title: 'К повторению',
      value: data?.due_today ?? 0,
      icon: Brain,
      desc: 'сегодня',
    },
    {
      title: 'Повторено',
      value: data?.reviewed_today ?? 0,
      icon: CheckCircle2,
      desc: 'сегодня',
    },
    {
      title: 'Всего карт',
      value: data?.total_cards ?? 0,
      icon: BookOpen,
      desc: 'в базе',
    },
    {
      title: 'Streak',
      value: data?.streak ?? 0,
      icon: Flame,
      desc: data?.streak === 1 ? 'день' : (data?.streak ?? 0) < 5 ? 'дня' : 'дней',
    },
  ];

  const totalCards = data?.total_cards ?? 0;

  const stateRows = [
    { label: 'New', count: data?.cards_by_state.new ?? 0, color: 'bg-slate-400' },
    { label: 'Learning', count: data?.cards_by_state.learning ?? 0, color: 'bg-blue-500' },
    { label: 'Review', count: data?.cards_by_state.review ?? 0, color: 'bg-emerald-500' },
    { label: 'Relearning', count: data?.cards_by_state.relearning ?? 0, color: 'bg-orange-500' },
  ];

  const kindRows = [
    { label: 'Слова', count: data?.cards_by_kind.vocab ?? 0, color: 'bg-blue-500' },
    { label: 'Фразы', count: data?.cards_by_kind.phrase ?? 0, color: 'bg-violet-500' },
    { label: 'Грамматика', count: data?.cards_by_kind.grammar_rule ?? 0, color: 'bg-amber-500' },
    { label: 'Предложения', count: data?.cards_by_kind.sentence ?? 0, color: 'bg-green-500' },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Статистика</h1>
        <p className="mt-1 text-sm text-muted-foreground">Прогресс обучения и активность</p>
      </header>

      {/* Секция 1: Сводка */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map(({ title, value, icon: Icon, desc }) => (
            <Card key={title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">{value}</div>
                <p className="text-xs text-muted-foreground mt-1">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Секция 2: Heatmap */}
      {loading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : data?.reviews_by_day ? (
        <Heatmap data={data.reviews_by_day} />
      ) : null}

      {/* Секция 3: Распределение карт */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Состояние карт */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Состояние карт</CardTitle>
            </CardHeader>
            <CardContent>
              {totalCards === 0 ? (
                <p className="text-sm text-muted-foreground">Нет карт</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {stateRows.map((r) => (
                    <StateBar key={r.label} label={r.label} count={r.count} total={totalCards} color={r.color} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Тип карт */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Типы карт</CardTitle>
            </CardHeader>
            <CardContent>
              {totalCards === 0 ? (
                <p className="text-sm text-muted-foreground">Нет карт</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {kindRows.map((r) => (
                    <StateBar key={r.label} label={r.label} count={r.count} total={totalCards} color={r.color} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
