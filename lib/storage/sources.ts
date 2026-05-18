import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const SOURCES_BUCKET = 'sources';

function dateFolderUTC(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function pathFor(hash: string, ext = 'webp'): string {
  return `${dateFolderUTC()}/${hash}.${ext}`;
}

export async function uploadSource(path: string, buffer: Buffer, contentType: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.storage.from(SOURCES_BUCKET).upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.storage.from(SOURCES_BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    throw new Error(`Signed URL failed: ${error?.message ?? 'unknown'}`);
  }
  return data.signedUrl;
}
