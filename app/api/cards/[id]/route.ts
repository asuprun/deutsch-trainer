import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createEmptyCard } from 'ts-fsrs';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const db = getSupabaseAdmin();

  const { data, error } = await db.from('cards').select('*').eq('id', id).maybeSingle();
  if (error) return err('DB_ERROR', error.message, 500);
  if (!data) return err('NOT_FOUND', 'Карта не найдена', 404);

  return NextResponse.json({ card: data });
}

const patchSchema = z.object({
  front: z.string().min(1).max(500).optional(),
  back: z.string().min(1).max(2000).optional(),
  word_type: z.string().max(40).nullable().optional(),
  gender: z.string().max(10).nullable().optional(),
  plural: z.string().max(200).nullable().optional(),
  forms: z.record(z.string(), z.unknown()).nullable().optional(),
  examples: z.array(z.object({ de: z.string(), ru: z.string() })).nullable().optional(),
  mnemonic: z.string().max(1000).nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err('BAD_REQUEST', 'Invalid JSON', 400);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Bad request', details: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const db = getSupabaseAdmin();

  // Fetch existing card to check if front/back changed
  const { data: existing, error: fetchErr } = await db
    .from('cards')
    .select('id, front, back')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) return err('DB_ERROR', fetchErr.message, 500);
  if (!existing) return err('NOT_FOUND', 'Карта не найдена', 404);

  const updates: Record<string, unknown> = { ...parsed.data };

  // Reset FSRS if front or back changed
  const frontChanged = parsed.data.front !== undefined && parsed.data.front !== existing.front;
  const backChanged = parsed.data.back !== undefined && parsed.data.back !== existing.back;
  if (frontChanged || backChanged) {
    const empty = createEmptyCard();
    updates.fsrs_state = JSON.parse(JSON.stringify(empty));
    updates.due_at = new Date().toISOString();
    updates.reps = 0;
    updates.lapses = 0;
  }

  const { data, error } = await db
    .from('cards')
    .update(updates)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) return err('DB_ERROR', error.message, 500);
  if (!data) return err('NOT_FOUND', 'Карта не найдена', 404);

  return NextResponse.json({ card: data });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const db = getSupabaseAdmin();

  const { error } = await db.from('cards').delete().eq('id', id);
  if (error) return err('DB_ERROR', error.message, 500);

  return NextResponse.json({ success: true });
}
