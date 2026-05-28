import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  const db = getSupabaseAdmin();

  const { data, error } = await db.rpc('find_duplicate_cards', { threshold: 0.75 });

  if (error) {
    console.error('[cards/duplicates]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pairs: data ?? [] });
}
