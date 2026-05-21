import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Gemini 1.5 Flash free tier limits
const FREE_TIER = {
  rpd: 1500,         // requests per day
  tpd_in: 1_000_000, // input tokens per minute
};

export async function GET() {
  const db = getSupabaseAdmin();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  // Today's totals
  const { data: todayRows } = await db
    .from('api_usage_log')
    .select('tokens_in, tokens_out, route')
    .gte('created_at', todayStart.toISOString());

  const today = (todayRows ?? []).reduce(
    (acc, r) => ({
      requests: acc.requests + 1,
      tokens_in: acc.tokens_in + (r.tokens_in ?? 0),
      tokens_out: acc.tokens_out + (r.tokens_out ?? 0),
    }),
    { requests: 0, tokens_in: 0, tokens_out: 0 },
  );

  // Per-route today
  const byRoute: Record<string, number> = {};
  for (const r of todayRows ?? []) {
    byRoute[r.route ?? 'unknown'] = (byRoute[r.route ?? 'unknown'] ?? 0) + 1;
  }

  // Last 7 days — group by date
  const { data: weekRows } = await db
    .from('api_usage_log')
    .select('tokens_in, tokens_out, created_at')
    .gte('created_at', weekStart.toISOString())
    .order('created_at', { ascending: true });

  const byDay: Record<string, { requests: number; tokens_in: number; tokens_out: number }> = {};
  for (const r of weekRows ?? []) {
    const day = r.created_at.slice(0, 10); // YYYY-MM-DD
    if (!byDay[day]) byDay[day] = { requests: 0, tokens_in: 0, tokens_out: 0 };
    byDay[day].requests++;
    byDay[day].tokens_in += r.tokens_in ?? 0;
    byDay[day].tokens_out += r.tokens_out ?? 0;
  }

  return NextResponse.json({
    today: { ...today, by_route: byRoute },
    week: byDay,
    limits: FREE_TIER,
  });
}
