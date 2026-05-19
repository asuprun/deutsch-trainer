import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createEmptyCard } from 'ts-fsrs';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind');
  const search = url.searchParams.get('search');
  const tag = url.searchParams.get('tag');
  const page = Math.max(0, Number(url.searchParams.get('page') ?? '0') || 0);
  const limitRaw = Number(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT));
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), MAX_LIMIT) : DEFAULT_LIMIT;

  const db = getSupabaseAdmin();

  // Build data query
  let query = db
    .from('cards')
    .select(
      'id, kind, front, back, word_type, gender, plural, forms, examples, mnemonic, tags, due_at, reps, lapses, created_at, source_id',
    )
    .order('created_at', { ascending: false })
    .range(page * limit, page * limit + limit - 1);

  if (search) query = query.or(`front.ilike.%${search}%,back.ilike.%${search}%`);
  if (kind) query = query.eq('kind', kind);
  if (tag) query = query.contains('tags', [tag]);

  // Build count query
  let countQuery = db.from('cards').select('id', { count: 'exact', head: true });
  if (search) countQuery = countQuery.or(`front.ilike.%${search}%,back.ilike.%${search}%`);
  if (kind) countQuery = countQuery.eq('kind', kind);
  if (tag) countQuery = countQuery.contains('tags', [tag]);

  const [{ data: cards, error }, { count, error: countErr }] = await Promise.all([query, countQuery]);

  if (error) return err('DB_ERROR', error.message, 500);
  if (countErr) return err('DB_ERROR', countErr.message, 500);

  return NextResponse.json({ cards: cards ?? [], total: count ?? 0, page, limit });
}

const createSchema = z.object({
  front: z.string().min(1).max(500),
  back: z.string().min(1).max(2000),
  kind: z.enum(['vocab', 'phrase', 'grammar_rule', 'sentence']).default('vocab'),
  tags: z.array(z.string().max(50)).max(20).default([]),
  word_type: z.string().max(40).nullable().optional(),
  gender: z.string().max(10).nullable().optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return err('BAD_REQUEST', 'Invalid JSON', 400); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Bad request', 400);

  const db = getSupabaseAdmin();
  const emptyCard = createEmptyCard();

  const { data, error } = await db
    .from('cards')
    .insert({
      ...parsed.data,
      fsrs_state: JSON.parse(JSON.stringify(emptyCard)),
      due_at: new Date().toISOString(),
      reps: 0,
      lapses: 0,
    })
    .select('*')
    .maybeSingle();

  if (error) return err('DB_ERROR', error.message, 500);
  return NextResponse.json({ card: data }, { status: 201 });
}
