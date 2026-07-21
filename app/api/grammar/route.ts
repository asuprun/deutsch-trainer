import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const search = url.searchParams.get('search');
  const tag = url.searchParams.get('tag');
  const source_id = url.searchParams.get('source_id');

  const db = getSupabaseAdmin();

  let query = db
    .from('grammar_notes')
    .select('*, source_id')
    .order('created_at', { ascending: false });

  if (search) query = query.or(`title.ilike.%${search}%,explanation.ilike.%${search}%`);
  if (tag) query = query.contains('tags', [tag]);
  if (source_id) query = query.eq('source_id', source_id);

  const { data, error } = await query;
  if (error) return err('DB_ERROR', error.message, 500);

  return NextResponse.json({ grammar_notes: data ?? [] });
}

// ─── Ручное создание правила ───────────────────────────────────────────────────

const createSchema = z.object({
  title: z.string().min(1).max(200),
  explanation: z.string().min(1).max(20000),
  examples: z.array(z.object({ de: z.string(), ru: z.string() })).nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err('BAD_REQUEST', 'Invalid JSON', 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Bad request', details: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('grammar_notes')
    .insert({
      title: parsed.data.title,
      explanation: parsed.data.explanation,
      examples: parsed.data.examples ?? null,
      tags: parsed.data.tags ?? [],
      source_id: null,
    })
    .select('*')
    .single();

  if (error) return err('DB_ERROR', error.message, 500);

  return NextResponse.json({ grammar_note: data }, { status: 201 });
}
