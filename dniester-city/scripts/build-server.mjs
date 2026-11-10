import { build } from 'esbuild';
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
// Prisma Client из server/generated входит в бандл; схему применяет `prisma migrate deploy`.
