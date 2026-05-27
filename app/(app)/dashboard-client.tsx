'use client';

import Link from 'next/link';
import { BookOpen, Brain, Flame } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n/context';

type Stats = {
  due_today: number;
  total_cards: number;
  streak: number;
};

export function DashboardClient({ stats }: { stats: Stats }) {
  const { t } = useI18n();

  const streakDayLabel =
    stats.streak === 1
      ? t('home_streak_day1')
      : stats.streak < 5
        ? t('home_streak_day234')
        : t('home_streak_day5');

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t('dash_title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {stats.total_cards === 0 ? t('home_subtitle_empty') : t('home_subtitle_has_cards')}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Due today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dash_due_today')}</CardTitle>
            <Brain className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.due_today}</div>
            <CardDescription className="mt-1">
              {stats.due_today === 0 ? t('home_due_done') : t('home_due_pending')}
            </CardDescription>
            {stats.due_today > 0 && (
              <Button asChild size="sm" className="mt-3">
                <Link href="/review">{t('dash_start_review')}</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Total cards */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dash_total_cards')}</CardTitle>
            <BookOpen className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.total_cards}</div>
            <CardDescription className="mt-1">
              {stats.total_cards === 0 ? (
                <>
                  <Link href="/upload" className="underline underline-offset-2 hover:text-foreground">
                    {t('home_cards_total_empty_link')}
                  </Link>{' '}
                  {t('home_cards_total_empty_suffix')}
                </>
              ) : (
                t('home_cards_total_in_base')
              )}
            </CardDescription>
          </CardContent>
        </Card>

        {/* Streak */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dash_streak')}</CardTitle>
            <Flame className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              {stats.streak > 0 ? (
                <>
                  {stats.streak}
                  <span className="ml-1 text-base font-normal text-muted-foreground">
                    {streakDayLabel}
                  </span>
                </>
              ) : (
                '—'
              )}
            </div>
            <CardDescription className="mt-1">
              {stats.streak === 0 ? t('home_streak_zero') : t('home_streak_active')}
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
