import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getSupabaseAdmin();

    const [dueRes, totalRes, logsRes] = await Promise.all([
      // Карт к повторению прямо сейчас
      db
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .lte('due_at', new Date().toISOString()),

      // Всего карт
      db.from('cards').select('id', { count: 'exact', head: true }),

      // Даты ревью для расчёта streak (последние 365 дней)
      db
        .from('review_logs')
        .select('reviewed_at')
        .gte('reviewed_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
        .order('reviewed_at', { ascending: false }),
    ]);

    // Streak: количество последовательных дней с хотя бы одним ревью
    const streak = calcStreak(logsRes.data ?? []);

    return NextResponse.json({
      due_today: dueRes.count ?? 0,
      total_cards: totalRes.count ?? 0,
      streak,
    });
  } catch (e) {
    console.error('[stats]', e);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

function calcStreak(logs: { reviewed_at: string }[]): number {
  if (logs.length === 0) return 0;

  // Уникальные даты в UTC, отсортированные по убыванию
  const dates = Array.from(
    new Set(logs.map((l) => l.reviewed_at.slice(0, 10))),
  ).sort((a, b) => (a > b ? -1 : 1));

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  // Streak должен начинаться с сегодня или вчера
  if (dates[0] !== today && dates[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86_400_000);
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
