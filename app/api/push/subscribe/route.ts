import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    auth:   z.string(),
    p256dh: z.string(),
  }),
});

// POST — сохранить подписку
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return err('BAD_REQUEST', 'Invalid JSON', 400); }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Bad subscription shape', 400);

  const { endpoint, keys } = parsed.data;
  const db = getSupabaseAdmin();

  const { error } = await db.from('push_subscriptions').upsert(
    { endpoint, auth: keys.auth, p256dh: keys.p256dh },
    { onConflict: 'endpoint' },
  );

  if (error) return err('DB_ERROR', error.message, 500);
  return NextResponse.json({ ok: true }, { status: 201 });
}

// DELETE — удалить подписку
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint');
  if (!endpoint) return err('BAD_REQUEST', 'endpoint required', 400);

  const db = getSupabaseAdmin();
  const { error } = await db.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) return err('DB_ERROR', error.message, 500);

  return NextResponse.json({ ok: true });
}
