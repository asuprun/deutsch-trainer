import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Конфигурация VAPID
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT ?? 'mailto:admin@localhost',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  process.env.VAPID_PRIVATE_KEY ?? '',
);

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Защита: только Vercel Cron или явный секрет
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${secret}`) return true;

  // Vercel Cron добавляет этот заголовок автоматически
  const cronHeader = req.headers.get('x-vercel-cron');
  return cronHeader !== null;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return err('UNAUTHORIZED', 'Forbidden', 401);

  const db = getSupabaseAdmin();

  // Сколько карточек к повторению
  const { count: dueCount } = await db
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .lte('due_at', new Date().toISOString());

  if (!dueCount || dueCount === 0) {
    return NextResponse.json({ sent: 0, message: 'No due cards' });
  }

  // Все подписки
  const { data: subscriptions, error: subErr } = await db
    .from('push_subscriptions')
    .select('endpoint, auth, p256dh');

  if (subErr) return err('DB_ERROR', subErr.message, 500);
  if (!subscriptions?.length) return NextResponse.json({ sent: 0, message: 'No subscriptions' });

  const payload = JSON.stringify({
    title: 'Deutsch Trainer',
    body: `${dueCount} карточк${dueCount === 1 ? 'а' : dueCount < 5 ? 'и' : ''} ждут повторения`,
    url: '/review',
  });

  let sent = 0;
  const expired: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
          payload,
        );
        sent++;
      } catch (e: unknown) {
        // 410 Gone = подписка истекла, удаляем
        if (e instanceof Error && 'statusCode' in e && (e as { statusCode: number }).statusCode === 410) {
          expired.push(sub.endpoint);
        }
      }
    }),
  );

  // Чистим истёкшие подписки
  if (expired.length) {
    await db.from('push_subscriptions').delete().in('endpoint', expired);
  }

  return NextResponse.json({ sent, expired: expired.length });
}
