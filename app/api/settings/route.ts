import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const DEFAULT_SETTINGS = {
  level: 'A2-B1',
  daily_goal: 20,
  fsrs_params: null as Record<string, unknown> | null,
  tts_voice: 'de-DE',
  tts_rate: 1.0,
};

const patchSchema = z.object({
  level: z.string().max(10).optional(),
  daily_goal: z.number().int().min(1).max(500).optional(),
  tts_voice: z.string().max(50).optional(),
  tts_rate: z.number().min(0.5).max(2).optional(),
  request_retention: z.number().min(0.7).max(0.99).optional(),
});

export async function GET() {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('settings')
      .select('level, daily_goal, fsrs_params, tts_voice, tts_rate')
      .eq('id', 1)
      .single();

    if (error || !data) {
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('[settings GET]', e);
    return NextResponse.json(
      { error: { code: 'internal', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation', message: parsed.error.message } },
        { status: 400 },
      );
    }

    const { request_retention, ...rest } = parsed.data;
    const db = getSupabaseAdmin();

    // Получаем текущие fsrs_params если есть request_retention
    let fsrs_params: Record<string, unknown> | null = null;
    if (request_retention !== undefined) {
      const { data: existing } = await db
        .from('settings')
        .select('fsrs_params')
        .eq('id', 1)
        .single();
      const old = (existing?.fsrs_params as Record<string, unknown> | null) ?? {};
      fsrs_params = { ...old, request_retention };
    }

    const fields: Record<string, unknown> = { id: 1, ...rest };
    if (fsrs_params !== null) {
      fields.fsrs_params = fsrs_params;
    }

    const { data, error } = await db
      .from('settings')
      .upsert(fields, { onConflict: 'id' })
      .select('level, daily_goal, fsrs_params, tts_voice, tts_rate')
      .single();

    if (error) {
      console.error('[settings PATCH]', error);
      return NextResponse.json(
        { error: { code: 'db', message: error.message } },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('[settings PATCH]', e);
    return NextResponse.json(
      { error: { code: 'internal', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
