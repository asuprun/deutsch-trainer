import { NextResponse } from 'next/server';
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
