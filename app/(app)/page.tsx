import Link from 'next/link';
import { BookOpen, Brain, Flame } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { DashboardClient } from './dashboard-client';

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
  return <DashboardClient stats={stats} />;
}
