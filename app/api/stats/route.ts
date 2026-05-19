import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getSupabaseAdmin();

    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    ).toISOString();
    const days112Ago = new Date(Date.now() - 112 * 24 * 60 * 60 * 1000).toISOString();

    const [dueRes, totalRes, logsRes, logs112Res, cardsStateRes] = await Promise.all([
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

      // Ревью за последние 112 дней для heatmap + reviewed_today
      db
        .from('review_logs')
        .select('reviewed_at')
        .gte('reviewed_at', days112Ago),

      // fsrs_state и kind для всех карт
      db.from('cards').select('fsrs_state, kind'),
    ]);

    // Streak
    const streak = calcStreak(logsRes.data ?? []);

    // reviewed_today
    const reviewed_today = (logs112Res.data ?? []).filter(
      (l) => l.reviewed_at >= todayStart,
    ).length;

    // reviews_by_day: массив 112 элементов
    const countByDate = (logs112Res.data ?? []).reduce<Record<string, number>>((acc, l) => {
      const d = (l.reviewed_at as string).slice(0, 10);
      acc[d] = (acc[d] ?? 0) + 1;
      return acc;
    }, {});

    const reviews_by_day: { date: string; count: number }[] = [];
    for (let i = 111; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      reviews_by_day.push({ date: dateStr, count: countByDate[dateStr] ?? 0 });
    }

    // cards_by_state: 0=New,1=Learning,2=Review,3=Relearning
    const stateMap: Record<string, number> = { new: 0, learning: 0, review: 0, relearning: 0 };
    for (const card of cardsStateRes.data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s: number = (card.fsrs_state as any)?.state ?? 0;
      if (s === 0) stateMap.new++;
      else if (s === 1) stateMap.learning++;
      else if (s === 2) stateMap.review++;
      else if (s === 3) stateMap.relearning++;
    }

    // cards_by_kind
    const kindMap: Record<string, number> = { vocab: 0, phrase: 0, grammar_rule: 0, sentence: 0 };
    for (const card of cardsStateRes.data ?? []) {
      const k = card.kind as string;
      if (k in kindMap) kindMap[k]++;
    }

    return NextResponse.json({
      due_today: dueRes.count ?? 0,
      total_cards: totalRes.count ?? 0,
      streak,
      reviewed_today,
      reviews_by_day,
      cards_by_state: stateMap,
      cards_by_kind: kindMap,
    });
  } catch (e) {
    console.error('[stats]', e);
    return NextResponse.json(
      { error: { code: 'internal', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}

function calcStreak(logs: { reviewed_at: string }[]): number {
  if (logs.length === 0) return 0;

  const dates = Array.from(
    new Set(logs.map((l) => l.reviewed_at.slice(0, 10))),
  ).sort((a, b) => (a > b ? -1 : 1));

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

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
