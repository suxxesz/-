import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PrismaPGlite } from 'pglite-prisma-adapter';
import { PrismaClient } from '../../server/generated/prisma/client';

const migrations = new URL('../../prisma/migrations/', import.meta.url);

/** SQL всех миграций по порядку — так же, как их применит `prisma migrate deploy`. */
export async function migrationSql() {
  const dirs = (await readdir(migrations, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => parseInt(a) - parseInt(b));
  return Promise.all(
    dirs.map(async (d) => ({
      name: d,
      sql: await readFile(new URL(`${d}/migration.sql`, migrations), 'utf8'),
    })),
  );
}

/** Postgres в памяти (PGlite) с применёнными миграциями и Prisma Client поверх него. */
export async function testDb() {
  const pg = new PGlite();
  for (const m of await migrationSql()) await pg.exec(m.sql);
  const prisma = new PrismaClient({ adapter: new PrismaPGlite(pg) });
  return {
    pg,
    prisma,
    close: async () => {
      await prisma.$disconnect();
      await pg.close();
    },
  };
}
