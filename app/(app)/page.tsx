import Link from 'next/link';
import { BookOpen, Brain, Flame } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSupabaseAdmin } from '@/lib/supabase/server';

async function loadStats() {
  try {
    const db = getSupabaseAdmin();
    const [dueRes, totalRes, logsRes] = await Promise.all([
      db
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .lte('due_at', new Date().toISOString()),
      db.from('cards').select('id', { count: 'exact', head: true }),
      db
        .from('review_logs')
        .select('reviewed_at')
        .gte('reviewed_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
        .order('reviewed_at', { ascending: false }),
    ]);

    return {
      due_today: dueRes.count ?? 0,
      total_cards: totalRes.count ?? 0,
      streak: calcStreak(logsRes.data ?? []),
    };
  } catch {
    return { due_today: 0, total_cards: 0, streak: 0 };
  }
}

function calcStreak(logs: { reviewed_at: string }[]): number {
  if (logs.length === 0) return 0;
  const dates = Array.from(new Set(logs.map((l) => l.reviewed_at.slice(0, 10)))).sort(
    (a, b) => (a > b ? -1 : 1),
  );
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (dates[0] !== today && dates[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const diffMs = new Date(dates[i - 1]).getTime() - new Date(dates[i]).getTime();
    if (Math.round(diffMs / 86_400_000) === 1) streak++;
    else break;
  }
  return streak;
}

export default async function DashboardPage() {
  const stats = await loadStats();

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Главная</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {stats.total_cards === 0
            ? 'Загрузи скрин учебника — приложение создаст первые карточки.'
            : 'Ежедневные показатели тренировки.'}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* К повторению сегодня */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">К повторению сегодня</CardTitle>
            <Brain className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.due_today}</div>
            <CardDescription className="mt-1">
              {stats.due_today === 0 ? 'Всё повторено — отличная работа!' : 'карточек ждут повторения'}
            </CardDescription>
            {stats.due_today > 0 && (
              <Button asChild size="sm" className="mt-3">
                <Link href="/review">Начать тренировку</Link>
              </Button>
        )}
          </CardContent>
        </Card>

        {/* Всего карт */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего карт</CardTitle>
            <BookOpen className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.total_cards}</div>
            <CardDescription className="mt-1">
              {stats.total_cards === 0 ? (
                <>
                  <Link href="/upload" className="underline underline-offset-2 hover:text-foreground">
                    Загрузи скрин
                  </Link>{' '}
                  чтобы создать первые карты
                </>
              ) : (
                'карточек в базе'
              )}
            </CardDescription>
          </CardContent>
        </Card>

        {/* Streak */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Streak</CardTitle>
            <Flame className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              {stats.streak > 0 ? (
                <>
                  {stats.streak}
                  <span className="ml-1 text-base font-normal text-muted-foreground">
                    {stats.streak === 1 ? 'день' : stats.streak < 5 ? 'дня' : 'дней'}
                  </span>
                </>
              ) : (
                '—'
              )}
            </div>
            <CardDescription className="mt-1">
              {stats.streak === 0
                ? 'Начни тренировку, чтобы запустить серию'
                : 'дней подряд без пропусков'}
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
