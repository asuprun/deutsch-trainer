import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enrichCard } from '@/app/api/cards/[id]/enrich/route';

export const runtime = 'nodejs';

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return err('BAD_REQUEST', 'Invalid JSON', 400); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Bad request', 400);

  const { ids } = parsed.data;
  const results: { id: string; ok: boolean; error?: string }[] = [];

  // Process sequentially to avoid Gemini rate limits
  for (const id of ids) {
    const result = await enrichCard(id);
    if ('error' in result) {
      results.push({ id, ok: false, error: result.error.message });
    } else {
      results.push({ id, ok: true });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  return NextResponse.json({ results, succeeded, total: ids.length });
}
