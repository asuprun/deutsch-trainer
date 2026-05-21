import { NextResponse } from 'next/server';
import { createEmptyCard } from 'ts-fsrs';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * POST /api/admin/migrate-grammar
 *
 * Одноразовая миграция: создаёт grammar_rule карты для всех grammar_notes,
 * у которых ещё нет соответствующей карты (проверка по front=title + source_id).
 */
export async function POST() {
  const db = getSupabaseAdmin();

  // Загружаем все grammar_notes
  const { data: notes, error: notesErr } = await db
    .from('grammar_notes')
    .select('id, title, explanation, examples, tags, source_id')
    .order('created_at', { ascending: true });

  if (notesErr) {
    return NextResponse.json({ error: notesErr.message }, { status: 500 });
  }
  if (!notes || notes.length === 0) {
    return NextResponse.json({ created: 0, skipped: 0, message: 'Нет grammar_notes' });
  }

  // Загружаем существующие grammar_rule карты (front + source_id) чтобы не дублировать
  const { data: existing, error: existErr } = await db
    .from('cards')
    .select('front, source_id')
    .eq('kind', 'grammar_rule');

  if (existErr) {
    return NextResponse.json({ error: existErr.message }, { status: 500 });
  }

  // Ключ для проверки: "title||source_id" (source_id может быть null)
  const existingKeys = new Set(
    (existing ?? []).map((c) => `${c.front}||${c.source_id ?? ''}`)
  );

  const now = new Date().toISOString();
  const fsrsBase = JSON.parse(JSON.stringify(createEmptyCard()));

  const toCreate = notes
    .filter((n) => !existingKeys.has(`${n.title}||${n.source_id ?? ''}`))
    .map((n) => ({
      source_id: n.source_id ?? null,
      kind: 'grammar_rule' as const,
      front: n.title,
      back: (n.explanation as string).slice(0, 2000),
      examples: n.examples ?? null,
      tags: (n.tags as string[]) ?? [],
      fsrs_state: fsrsBase,
      due_at: fsrsBase.due ?? now,
      word_type: null,
      gender: null,
      plural: null,
      forms: null,
      mnemonic: null,
    }));

  const skipped = notes.length - toCreate.length;

  if (toCreate.length === 0) {
    return NextResponse.json({
      created: 0,
      skipped,
      message: 'Все grammar_notes уже имеют карты',
    });
  }

  const { data: inserted, error: insertErr } = await db
    .from('cards')
    .insert(toCreate)
    .select('id');

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    created: inserted?.length ?? 0,
    skipped,
    message: `Создано ${inserted?.length ?? 0} карт, пропущено ${skipped} (уже существовали)`,
  });
}
