import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getGemini, GEMINI_MODEL } from '@/lib/gemini/client';

export const runtime = 'nodejs';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const db = getSupabaseAdmin();

  const { data: card, error: fetchErr } = await db
    .from('cards')
    .select('id, front, back, word_type')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) return err('DB_ERROR', fetchErr.message, 500);
  if (!card) return err('NOT_FOUND', 'Карта не найдена', 404);

  const gemini = getGemini();
  const model = gemini.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = `Сгенерируй 2-3 примера предложений для немецкого слова/фразы "${card.front}" (перевод: "${card.back}", тип: "${card.word_type ?? 'не указан'}").
Верни ТОЛЬКО JSON массив в формате: [{"de": "немецкое предложение", "ru": "русский перевод"}]
Никакого другого текста, только JSON.`;

  let examples: { de: string; ru: string }[] = [];
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      examples = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    return err('GEMINI_ERROR', e instanceof Error ? e.message : 'Ошибка генерации', 500);
  }

  const { data: updated, error: updateErr } = await db
    .from('cards')
    .update({ examples })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (updateErr) return err('DB_ERROR', updateErr.message, 500);

  return NextResponse.json({ card: updated });
}
