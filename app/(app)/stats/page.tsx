'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Brain, Flame, BookOpen, CheckCircle2, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n/context';

type DayEntry = { date: string; count: number };
type ForecastEntry = { date: string; count: number };

type StatsData = {
  due_today: number;
  reviewed_today: number;
  total_cards: number;
  streak: number;
  reviews_by_day: DayEntry[];
  cards_by_state: { new: number; learning: number; review: number; relearning: number };
  cards_by_kind: { vocab: number; phrase: number; grammar_rule: number; sentence: number };
  retention_30d: number | null;
  total_reviews_30d: number;
  forecast: ForecastEntry[];
};

// 5 уровней интенсивности
function heatColor(count: number): string {
  if (count === 0)  return 'bg-muted/50';
  if (count <= 4)   return 'bg-emerald-900/80';
  if (count <= 9)   return 'bg-emerald-700';
  if (count <= 19)  return 'bg-emerald-500';
  return 'bg-emerald-300';
}

function Heatmap({ data }: { data: DayEntry[] }) {
  const { t, locale } = useI18n();

  // Локале-зависимые подписи дней недели Пн–Вс (индекс 0–6)
  // 1 янв 2024 = понедельник
  const dayLabels = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2024, 0, 1 + i);
      const lbl = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d);
      return [0, 2, 4, 6].includes(i) ? lbl : '';
    }), [locale]);

  // Локале-зависимые короткие названия месяцев (индекс 0–11)
  const monthShortNames = useMemo(() =>
    Array.from({ length: 12 }, (_, i) =>
      new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2024, i, 1))
    ), [locale]);

  if (data.length === 0) return null;

  const firstDate = new Date(data[0].date + 'T00:00:00Z');
  const jsDow = firstDate.getUTCDay();               // 0=Вс
  const mondayOffset = jsDow === 0 ? 6 : jsDow - 1; // отступ до понедельника

  type Cell = { empty: true } | { empty: false; date: string; count: number };
  const cells: Cell[] = [];
  for (let i = 0; i < mondayOffset; i++) cells.push({ empty: true });
  for (const d of data) cells.push({ empty: false, date: d.date, count: d.count });

  const totalCols = Math.ceil(cells.length / 7);

  const monthLabels: { col: number; label: string }[] = [];
  data.forEach((entry, i) => {
    const d = new Date(entry.date + 'T00:00:00Z');
    if (d.getUTCDate() === 1) {
      const col = Math.floor((mondayOffset + i) / 7);
      if (!monthLabels.length || monthLabels[monthLabels.length - 1].col !== col) {
        monthLabels.push({ col, label: monthShortNames[d.getUTCMonth()] });
      }
    }
  });

  const totalReviews = data.reduce((s, d) => s + d.count, 0);
  const activeDays   = data.filter((d) => d.count > 0).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{t('stats_heatmap_title')}</CardTitle>
        <span className="text-xs text-muted-foreground tabular-nums">
          {totalReviews} {t('stats_heatmap_reviews')} · {activeDays} {t('stats_heatmap_days')}
        </span>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-2 min-w-fit">
            {/* Подписи дней недели */}
            <div className="flex flex-col shrink-0" style={{ gap: '3px', paddingTop: '18px' }}>
              {dayLabels.map((label, i) => (
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
                  const tipText = cell.count === 0
                    ? `${cell.date}: ${t('stats_heatmap_no_activity')}`
                    : `${cell.date}: ${cell.count} ${t('stats_heatmap_reviews')}`;
                  return (
                    <div
                      key={cell.date}
                      title={tipText}
                      className={`rounded-sm cursor-default transition-opacity hover:opacity-70 ${heatColor(cell.count)}`}
                      style={{ width: 13, height: 13 }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Легенда */}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{t('stats_heatmap_less')}</span>
          {[0, 2, 6, 12, 22].map((v) => (
            <div key={v} className={`rounded-sm ${heatColor(v)}`} style={{ width: 13, height: 13 }} />
          ))}
          <span>{t('stats_heatmap_more')}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function BarChart({
  data,
  color = 'bg-emerald-500',
  hoverColor = 'hover:bg-emerald-400',
  showWeekday = false,
}: {
  data: DayEntry[] | ForecastEntry[];
  color?: string;
  hoverColor?: string;
  showWeekday?: boolean;
}) {
  const { locale } = useI18n();

  // Локале-зависимые подписи дней недели: индекс 0=Вс…6=Сб (JS getUTCDay())
  // 7 янв 2024 = воскресенье, 8 янв = понедельник, …, 13 янв = суббота
  const weekdayLabels = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2024, 0, 7 + i);
      return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d);
    }), [locale]);

  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-0.5 h-20">
        {data.map((d) => (
          <div
            key={d.date}
            title={`${d.date}: ${d.count}`}
            className={`flex-1 rounded-t-[2px] transition-all ${color} ${hoverColor} min-h-0`}
            style={{ height: `${d.count > 0 ? Math.max((d.count / max) * 100, 4) : 0}%` }}
          />
        ))}
      </div>
      <div className="flex text-[10px] text-muted-foreground">
        {data.map((d, i) => {
          if (showWeekday) {
            const dow = new Date(d.date + 'T00:00:00Z').getUTCDay();
            return (
              <div key={d.date} className="flex-1 text-center">
                {weekdayLabels[dow]}
              </div>
            );
          }
          return (
            <div key={d.date} className="flex-1 text-center">
              {i % 7 === 0 ? d.date.slice(5) : ''}
            </div>
          );
        })}
      </div>
    </div>
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
  const { t } = useI18n();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const streakValue = data?.streak ?? 0;
  const streakDesc =
    streakValue === 1
      ? t('stats_streak_day')
      : streakValue >= 2 && streakValue <= 4
        ? t('stats_streak_days234')
        : t('stats_streak_days5');

  const summaryCards: { title: string; value: number | string; icon: React.ElementType; desc: string }[] = [
    { title: t('stats_due_today_label'),      value: data?.due_today      ?? 0,  icon: Brain,        desc: t('stats_today') },
    { title: t('stats_reviewed_today_label'), value: data?.reviewed_today ?? 0,  icon: CheckCircle2, desc: t('stats_today') },
    { title: t('stats_total_cards_label'),    value: data?.total_cards    ?? 0,  icon: BookOpen,     desc: t('stats_in_base') },
    { title: t('dash_streak'),                value: streakValue,                icon: Flame,        desc: streakDesc },
    {
      title: 'Retention',
      value: data?.retention_30d != null ? `${data.retention_30d}%` : '—',
      icon: TrendingUp,
      desc: t('stats_retention_period'),
    },
  ];

  const totalCards = data?.total_cards ?? 0;

  // FSRS state labels — kept as English technical terms across all locales
  const stateRows = [
    { label: 'New',        count: data?.cards_by_state.new        ?? 0, color: 'bg-slate-400' },
    { label: 'Learning',   count: data?.cards_by_state.learning   ?? 0, color: 'bg-blue-500' },
    { label: 'Review',     count: data?.cards_by_state.review     ?? 0, color: 'bg-emerald-500' },
    { label: 'Relearning', count: data?.cards_by_state.relearning ?? 0, color: 'bg-orange-500' },
  ];

  const kindRows = [
    { label: t('cards_kind_vocab'),   count: data?.cards_by_kind.vocab        ?? 0, color: 'bg-blue-500' },
    { label: t('cards_kind_phrase'),  count: data?.cards_by_kind.phrase       ?? 0, color: 'bg-violet-500' },
    { label: t('cards_kind_grammar'), count: data?.cards_by_kind.grammar_rule ?? 0, color: 'bg-amber-500' },
    { label: t('cards_kind_sentence'),count: data?.cards_by_kind.sentence     ?? 0, color: 'bg-green-500' },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('stats_title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('stats_subtitle')}</p>
      </header>

      {/* Секция 1: Сводка */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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

      {/* Секция 2: Тепловая карта */}
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('stats_cards_state_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {totalCards === 0 ? (
                <p className="text-sm text-muted-foreground">{t('stats_no_cards')}</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {stateRows.map((r) => (
                    <StateBar key={r.label} label={r.label} count={r.count} total={totalCards} color={r.color} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('stats_cards_kind_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {totalCards === 0 ? (
                <p className="text-sm text-muted-foreground">{t('stats_no_cards')}</p>
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

      {/* Секция 4: Ревью за 30 дней */}
      {loading ? (
        <Skeleton className="h-36 rounded-xl" />
      ) : data?.reviews_by_day ? (
        (() => {
          const last30 = data.reviews_by_day.slice(-30);
          const total30 = last30.reduce((s, d) => s + d.count, 0);
          const activeDays30 = last30.filter((d) => d.count > 0).length;
          const avg30 = Math.round(total30 / (activeDays30 || 1));
          return (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{t('stats_reviews30_title')}</CardTitle>
                <span className="text-xs text-muted-foreground tabular-nums">
                  ~{avg30}{t('stats_per_day')} · {activeDays30} {t('stats_active_days')}
                </span>
              </CardHeader>
              <CardContent>
                <BarChart data={last30} color="bg-emerald-500" hoverColor="hover:bg-emerald-400" showWeekday={false} />
              </CardContent>
            </Card>
          );
        })()
      ) : null}

      {/* Секция 5: Прогноз на 7 дней */}
      {loading ? (
        <Skeleton className="h-36 rounded-xl" />
      ) : data?.forecast ? (
        (() => {
          const forecastTotal = data.forecast.reduce((s, d) => s + d.count, 0);
          return (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{t('stats_forecast_title')}</CardTitle>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {forecastTotal} {t('stats_forecast_total')}
                </span>
              </CardHeader>
              <CardContent>
                <BarChart data={data.forecast} color="bg-blue-500" hoverColor="hover:bg-blue-400" showWeekday={true} />
              </CardContent>
            </Card>
          );
        })()
      ) : null}
    </div>
  );
}
