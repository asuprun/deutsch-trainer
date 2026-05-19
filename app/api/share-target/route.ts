import { NextResponse } from 'next/server';
import { createEmptyCard } from 'ts-fsrs';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { compressToWebp } from '@/lib/image/compress';
import { extractFromImage } from '@/lib/gemini/extract';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.redirect(new URL('/upload', req.url));
  }

  const file = form.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.redirect(new URL('/upload', req.url));
  }

  const inputBuf = Buffer.from(await file.arrayBuffer());

  let compressed;
  try {
    compressed = await compressToWebp(inputBuf);
  } catch {
    return NextResponse.redirect(new URL('/upload?error=compress', req.url));
  }

  let payload;
  try {
    const result = await extractFromImage({ buffer: compressed.buffer, mimeType: compressed.mimeType });
    payload = result.payload;
  } catch {
    return NextResponse.redirect(new URL('/upload?error=extract', req.url));
  }

  const sb = getSupabaseAdmin();

  const { data: sourceRow, error: srcErr } = await sb
    .from('sources')
    .insert({
      image_path: 'shared/' + Date.now(),
      raw_extract: payload,
      title: payload.summary || 'Shared image',
    })
    .select('id')
    .single();

  if (srcErr || !sourceRow) {
    return NextResponse.redirect(new URL('/upload?error=db', req.url));
  }

  const source_id = sourceRow.id;
  const now = new Date().toISOString();
  const emptyCard = createEmptyCard();
  const fsrsBase = JSON.parse(JSON.stringify(emptyCard));

  const cardRows = [
    ...payload.words.map((w) => ({
      source_id,
      kind: 'vocab' as const,
      front: w.de,
      back: w.ru,
      word_type: w.word_type ?? null,
      gender: w.gender || null,
      plural: w.plural || null,
      forms: w.forms ?? null,
      examples: null,
      mnemonic: null,
      tags: [],
      fsrs_state: fsrsBase,
      due_at: fsrsBase.due ?? now,
    })),
    ...payload.phrases.map((p) => ({
      source_id,
      kind: 'phrase' as const,
      front: p.de,
      back: p.ru,
      word_type: null,
      gender: null,
      plural: null,
      forms: null,
      examples: null,
      mnemonic: null,
      tags: [],
      fsrs_state: fsrsBase,
      due_at: fsrsBase.due ?? now,
    })),
    ...payload.sentences.map((s) => ({
      source_id,
      kind: 'sentence' as const,
      front: s.de,
      back: s.ru,
      word_type: null,
      gender: null,
      plural: null,
      forms: null,
      examples: null,
      mnemonic: null,
      tags: [],
      fsrs_state: fsrsBase,
      due_at: fsrsBase.due ?? now,
    })),
  ];

  if (cardRows.length > 0) {
    await sb.from('cards').insert(cardRows);
  }

  if (payload.grammar.length > 0) {
    const grammarRows = payload.grammar.map((g) => ({
      source_id,
      title: g.title,
      explanation: g.explanation_md,
      examples: g.examples ?? null,
      tags: [],
    }));
    await sb.from('grammar_notes').insert(grammarRows);
  }

  return NextResponse.redirect(new URL('/cards?shared=1', req.url));
}
