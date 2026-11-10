import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Для `prisma generate` адрес базы не нужен — пустая строка не роняет сборку без .env.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
