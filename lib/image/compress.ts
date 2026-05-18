import 'server-only';
import sharp from 'sharp';

export const MAX_DIM = 1600;
export const WEBP_QUALITY = 85;

export type CompressedImage = {
  buffer: Buffer;
  mimeType: 'image/webp';
  width: number;
  height: number;
  sizeBytes: number;
};

export async function compressToWebp(input: Buffer | Uint8Array): Promise<CompressedImage> {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const pipeline = sharp(buf, { failOn: 'truncated' })
    .rotate()
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY });

  const out = await pipeline.toBuffer({ resolveWithObject: true });
  return {
    buffer: out.data,
    mimeType: 'image/webp',
    width: out.info.width,
    height: out.info.height,
    sizeBytes: out.data.length,
  };
}
