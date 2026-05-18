import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const bodySchema = z.object({
  password: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR' } },
      { status: 400 },
    );
  }

  const expected = process.env.APP_PASSWORD;
  const cookieSecret = process.env.AUTH_COOKIE_SECRET;

  if (!expected || !cookieSecret) {
    return NextResponse.json(
      { error: { code: 'SERVER_MISCONFIGURED' } },
      { status: 500 },
    );
  }

  const a = Buffer.from(parsed.data.password);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && timingSafeEqual(a, b);

  if (!ok) {
    return NextResponse.json(
      { error: { code: 'INVALID_PASSWORD' } },
      { status: 401 },
    );
  }

  const store = await cookies();
  store.set('auth', cookieSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ ok: true });
}
