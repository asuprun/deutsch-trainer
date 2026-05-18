import { createHash } from 'node:crypto';

export function sha256Hex(buf: Uint8Array | Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}
