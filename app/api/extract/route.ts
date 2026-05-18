import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { sha256Hex } from '@/lib/hash';
import { compressToWebp } from '@/lib/image/compress';
import { pathFor, uploadSource } from '@/lib/storage/sources';
import { extractFromImage } from '@/lib/gemini/extract';
import { extractPayloadSchema, type ExtractPayload } from '@/lib/gemini/prompts';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err('BAD_REQUEST', 'Ожидался multipart/form-data', 400);
  }
  const file = form.get('image');
  if (!file || !(file instanceof File)) {
    return err('BAD_REQUEST', 'Поле "image" обязательно', 400);
  }
  if (file.size > MAX_INPUT_BYTES) {
    return err('TOO_LARGE', `Файл больше ${MAX_INPUT_BYTES / 1024 / 1024} MB`, 413);
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return err('UNSUPPORTED_TYPE', `MIME "${file.type}" не поддерживается`, 415);
  }

  const inputBuf = Buffer.from(await file.arrayBuffer());
  const inputHash = sha256Hex(inputBuf);

  const sb = getSupabaseAdmin();

  const { data: existing, error: selErr } = await sb
    .from('sources')
    .select('id, image_path, raw_extract')
    .eq('image_hash', inputHash)
    .maybeSingle();
  if (selErr) {
    return err('DB_ERROR', selErr.message, 500);
  }
  if (existing && existing.raw_extract) {
    const cached = extractPayloadSchema.safeParse(existing.raw_extract);
    if (cached.success) {
      return NextResponse.json({
        source_id: existing.id,
        image_path: existing.image_path,
        image_hash: inputHash,
        preview: cached.data,
        cached: true,
      });
    }
  }

  let compressed;
  try {
    compressed = await compressToWebp(inputBuf);
  } catch (e) {
    return err('IMAGE_ERROR', `Не удалось обработать изображение: ${e instanceof Error ? e.message : 'unknown'}`, 422);
  }

  const imagePath = pathFor(inputHash);
  try {
    await uploadSource(imagePath, compressed.buffer, compressed.mimeType);
  } catch (e) {
    return err('STORAGE_ERROR', e instanceof Error ? e.message : 'upload failed', 500);
  }

  let payload: ExtractPayload;
  try {
    const result = await extractFromImage({ buffer: compressed.buffer, mimeType: compressed.mimeType });
    payload = result.payload;
  } catch (e) {
    return err('EXTRACT_ERROR', e instanceof Error ? e.message : 'gemini failed', 422);
  }

  const upsert = await sb
    .from('sources')
    .upsert(
      {
        ...(existing ? { id: existing.id } : {}),
        image_path: imagePath,
        image_hash: inputHash,
        raw_extract: payload,
      },
      { onConflict: 'image_hash' },
    )
    .select('id')
    .single();

  if (upsert.error || !upsert.data) {
    return err('DB_ERROR', upsert.error?.message ?? 'upsert failed', 500);
  }

  return NextResponse.json({
    source_id: upsert.data.id,
    image_path: imagePath,
    image_hash: inputHash,
    preview: payload,
    cached: false,
  });
}
