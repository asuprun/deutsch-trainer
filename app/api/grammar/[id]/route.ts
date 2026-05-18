import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const db = getSupabaseAdmin();

  const { data, error } = await db.from('grammar_notes').select('*').eq('id', id).maybeSingle();
  if (error) return err('DB_ERROR', error.message, 500);
  if (!data) return err('NOT_FOUND', 'Заметка не найдена', 404);

  return NextResponse.json({ grammar_note: data });
}

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  explanation: z.string().min(1).max(20000).optional(),
  examples: z.array(z.object({ de: z.string(), ru: z.string() })).nullable().optional(),
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
  const { data, error } = await db
    .from('grammar_notes')
    .update(parsed.data)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) return err('DB_ERROR', error.message, 500);
  if (!data) return err('NOT_FOUND', 'Заметка не найдена', 404);

  return NextResponse.json({ grammar_note: data });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const db = getSupabaseAdmin();

  const { error } = await db.from('grammar_notes').delete().eq('id', id);
  if (error) return err('DB_ERROR', error.message, 500);

  return NextResponse.json({ success: true });
}
