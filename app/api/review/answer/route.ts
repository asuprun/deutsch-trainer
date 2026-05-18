import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { nextState, type CardJson, type Grade } from '@/lib/fsrs/scheduler';

export const runtime = 'nodejs';

const bodySchema = z.object({
  card_id: z.string().uuid(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err('BAD_REQUEST', 'Invalid JSON', 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', 'Bad request shape', 400);
  }

  const { card_id, rating } = parsed.data;
  const sb = getSupabaseAdmin();

  const { data: card, error: selErr } = await sb
    .from('cards')
    .select('id, fsrs_state, reps, lapses')
    .eq('id', card_id)
    .maybeSingle();

  if (selErr) return err('DB_ERROR', selErr.message, 500);
  if (!card) return err('NOT_FOUND', 'card not found', 404);

  const prevState = card.fsrs_state as CardJson | null;
  if (!prevState) return err('INVALID_STATE', 'card has no fsrs_state', 422);

  const now = new Date();
  let result;
  try {
    result = nextState(prevState, rating as Grade, now);
  } catch (e) {
    return err('FSRS_ERROR', e instanceof Error ? e.message : 'fsrs failed', 500);
  }

  const updates = {
    fsrs_state: result.state,
    due_at: result.state.due,
    reps: result.state.reps,
    lapses: result.state.lapses,
  };

  const { error: updErr } = await sb.from('cards').update(updates).eq('id', card_id);
  if (updErr) return err('DB_ERROR', `update: ${updErr.message}`, 500);

  const { error: logErr } = await sb.from('review_logs').insert({
    card_id,
    rating,
    prev_state: prevState,
    next_state: result.state,
  });
  if (logErr) {
    console.warn(`[review] log insert failed: ${logErr.message}`);
  }

  return NextResponse.json({
    next_due: result.state.due,
    scheduled_days: result.scheduled_days,
    new_state: result.state,
  });
}
