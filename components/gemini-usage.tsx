'use client';

import { useEffect, useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type UsageData = {
  today: {
    requests: number;
    tokens_in: number;
    tokens_out: number;
    by_route: Record<string, number>;
  };
  week: Record<string, { requests: number; tokens_in: number; tokens_out: number }>;
  limits: { rpd: number; tpd_in: number };
};

const ROUTE_LABELS: Record<string, string> = {
  enrich: '✨ Обогащение',
  chat: '💬 Чат',
  grammar: '📚 Грамматика',
  upload: '📷 Загрузка',
  unknown: '?',
};

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function Bar({ value, max, warn = 0.7, danger = 0.9 }: { value: number; max: number; warn?: number; danger?: number }) {
  const pct = Math.min(1, value / max);
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={cn(
          'h-full rounded-full transition-all',
          pct >= danger ? 'bg-red-500' : pct >= warn ? 'bg-amber-500' : 'bg-emerald-500',
        )}
        style={{ width: `${(pct * 100).toFixed(1)}%` }}
      />
    </div>
  );
}

export function GeminiUsage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/usage')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="size-4 animate-spin" />
        Загрузка…
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">Нет данных. Добавь таблицу api_usage_log в Supabase.</p>
    );
  }

  const { today, limits, week } = data;
  const rpdPct = today.requests / limits.rpd;
  const remaining = limits.rpd - today.requests;

  // Last 7 days bar chart data
  const days = Object.entries(week)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7);

  const maxDayReqs = Math.max(...days.map(([, v]) => v.requests), 1);

  return (
    <div className="flex flex-col gap-4">
      {/* Today summary */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Сегодня</span>
          <span className={cn('tabular-nums', rpdPct >= 0.9 ? 'text-red-500' : rpdPct >= 0.7 ? 'text-amber-500' : 'text-muted-foreground')}>
            {today.requests} / {limits.rpd} запросов
          </span>
        </div>
        <Bar value={today.requests} max={limits.rpd} />
        <p className="text-xs text-muted-foreground">
          Осталось: <span className="font-medium text-foreground">{remaining}</span> запросов
          {' · '}токены: {fmt(today.tokens_in)} вх / {fmt(today.tokens_out)} исх
        </p>
      </div>

      {/* Per route */}
      {Object.keys(today.by_route).length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">По функциям сегодня</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(today.by_route)
              .sort(([, a], [, b]) => b - a)
              .map(([route, count]) => (
                <span key={route} className="text-xs text-muted-foreground">
                  {ROUTE_LABELS[route] ?? route}:{' '}
                  <span className="font-medium text-foreground">{count}</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* 7-day mini bar chart */}
      {days.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">7 дней</p>
          <div className="flex items-end gap-1 h-12">
            {days.map(([date, val]) => {
              const h = Math.max(4, Math.round((val.requests / maxDayReqs) * 48));
              const isToday = date === new Date().toISOString().slice(0, 10);
              return (
                <div key={date} className="flex flex-col items-center gap-0.5 flex-1" title={`${date}: ${val.requests} запросов`}>
                  <div
                    className={cn('w-full rounded-sm', isToday ? 'bg-primary' : 'bg-muted-foreground/30')}
                    style={{ height: `${h}px` }}
                  />
                  <span className="text-[9px] text-muted-foreground/60">
                    {new Date(date + 'T12:00:00').toLocaleDateString('ru', { weekday: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        <Zap className="size-3 inline mr-0.5" />
        Gemini 2.5 Flash · Free tier: {limits.rpd} запросов/день
      </p>
    </div>
  );
}
