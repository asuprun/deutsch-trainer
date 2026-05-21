import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enrichCard } from '@/app/api/cards/[id]/enrich/route';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 минут для обработки большого батча

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});

// gemini-1.5-flash free tier: 15 RPM → пауза 4с между запросами
const INTER_REQUEST_DELAY_MS = 4500;

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

  // Sequential with delay to stay under gemini-1.5-flash RPM (15/min)
  for (let i = 0; i < ids.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, INTER_REQUEST_DELAY_MS));
    const result = await enrichCard(ids[i]);
    if ('error' in result) {
      results.push({ id: ids[i], ok: false, error: result.error.message });
    } else {
      results.push({ id: ids[i], ok: true });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  return NextResponse.json({ results, succeeded, total: ids.length });
}
