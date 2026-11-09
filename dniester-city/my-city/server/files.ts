import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
export const uploadDir = resolve(process.env.UPLOAD_DIR || 'uploads');
const types: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/webm': 'webm',
};
export const fileName = /^[0-9a-f-]{36}\.(jpg|png|webp|gif|mp4|webm)$/;
/** Сохраняет data-URL на диск и возвращает URL; обычные ссылки возвращает как есть. */
export async function persistMedia(value: string | undefined): Promise<string | undefined> {
  if (!value || !value.startsWith('data:')) return value;
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!m || !types[m[1]]) throw Error('Допустимы JPEG, PNG, WebP, GIF, MP4 и WebM.');
  const name = `${randomUUID()}.${types[m[1]]}`;
  await mkdir(uploadDir, { recursive: true });
  await writeFile(resolve(uploadDir, name), Buffer.from(m[2], 'base64'));
  return `/api/files/${name}`;
}
