import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { GEMINI_MODEL } from '@/lib/gemini/client';

interface UsageMeta {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
}

export async function trackGeminiUsage(
  meta: UsageMeta | undefined,
  route: string,
  model = GEMINI_MODEL,
): Promise<void> {
  try {
    const db = getSupabaseAdmin();
    await db.from('api_usage_log').insert({
      provider: 'gemini',
      model,
      route,
      tokens_in: meta?.promptTokenCount ?? 0,
      tokens_out: meta?.candidatesTokenCount ?? 0,
    });
  } catch {
    // Non-critical — never fail the main request
  }
}
