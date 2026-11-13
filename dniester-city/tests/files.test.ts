import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'up-'));
const { persistMedia, fileName } = await import('../server/infrastructure/files');
test('фото сохраняется на диск, а не в базу', async () => {
  const url = (await persistMedia('data:image/png;base64,iVBORw0KGgo='))!;
  assert.match(url, /^\/api\/files\//);
  assert.ok(fileName.test(url.split('/').pop()!));
  assert.ok(existsSync(join(process.env.UPLOAD_DIR!, url.split('/').pop()!)));
  assert.equal(await persistMedia(url), url);
});
test('опасные типы файлов отклоняются', async () => {
  await assert.rejects(persistMedia('data:image/svg+xml;base64,PHN2Zz4='), /Допустимы/);
});
