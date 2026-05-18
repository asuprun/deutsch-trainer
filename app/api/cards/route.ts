import { NextResponse } from 'next/server';
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
