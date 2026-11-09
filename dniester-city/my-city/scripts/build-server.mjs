import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
await build({
  entryPoints: ['server/index.ts', 'server/bot.ts', 'server/setup.ts', 'server/provision.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'external',
  outdir: 'build/server',
  outExtension: { '.js': '.mjs' },
  sourcemap: true,
  logLevel: 'info',
});
await mkdir('build/server', { recursive: true });
await copyFile('server/schema.sql', 'build/server/schema.sql');
