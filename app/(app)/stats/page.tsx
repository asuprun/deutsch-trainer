'use client';

import { useEffect, useState } from 'react';
import { Brain, Flame, BookOpen, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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

function heatColor(count: number): string {
  if (count === 0) return 'bg-muted/40';
  if (count <= 3) return 'bg-emerald-900';
  if (count <= 9) return 'bg-emerald-700';
  if (count <= 19) return 'bg-emerald-500';
  return 'bg-emerald-400';
}

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function Heatmap({ data }: { data: DayEntry[] }) {
  // data[0] = самый старый день (112 дней назад)
  // JS getDay(): 0=Sun, 1=Mon ... 6=Sat
  // Нам нужно: 0=Mon, 1=Tue ... 6=Sun
  const firstDate = data.length > 0 ? new Date(data[0].date + 'T00:00:00Z') : new Date();
  const jsDow = firstDate.getUTCDay(); // 0=Sun
  const mondayOffset = jsDow === 0 ? 6 : jsDow - 1; // сколько пустых ячеек добавить

  // Строим плоский массив ячеек: пустые + реальные данные
  type Cell = { empty: true } | { empty: false; date: string; count: number };
  const cells: Cell[] = [];
  for (let i = 0; i < mondayOffset; i++) cells.push({ empty: true });
  for (const d of data) cells.push({ empty: false, date: d.date, count: d.count });

  // Количество колонок = Math.ceil(cells.length / 7)
  const totalCols = Math.ceil(cells.length / 7);

  // Раскладываем: col-major order (сверху вниз = Mon..Sun, слева направо = недели)
  // cells уже идут в row-major? Нет: нам нужно col-major.
  // cells[0] = первая ячейка первой колонки (Пн первой недели)
  // cells[6] = последняя ячейка первой колонки (Вс первой недели)
  // Поэтому просто рисуем grid с 7 строками и заполняем последовательно —
  // CSS grid с grid-flow: column уложит правильно

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Активность за 16 недель</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {/* Подписи дней недели */}
          <div className="flex flex-col gap-0.5 pt-0.5">
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className="size-3 flex items-center justify-end text-[9px] text-muted-foreground leading-none"
                style={{ height: '0.75rem' }}
              >
                {label}
              </div>
            ))}
          </div>
          {/* Heatmap grid */}
          <div
            className="grid gap-0.5"
            style={{
              gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
              gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))`,
              gridAutoFlow: 'column',
            }}
          >
            {cells.map((cell, i) => {
              if (cell.empty) {
                return <div key={`empty-${i}`} className="size-3 rounded-sm bg-transparent" />;
              }
              return (
                <div
                  key={cell.date}
                  className={`size-3 rounded-sm ${heatColor(cell.count)}`}
                  title={`${cell.date}: ${cell.count} ревью`}
                />
              );
            })}
          </div>
        </div>
        {/* Легенда */}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Меньше</span>
          {[0, 1, 4, 10, 20].map((v) => (
            <div key={v} className={`size-3 rounded-sm ${heatColor(v)}`} />
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
