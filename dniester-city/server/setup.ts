import { spawnSync } from 'node:child_process';
// Схемой управляет Prisma Migrate: применяет только ещё не применённые миграции из prisma/migrations.
// Существующую базу, созданную до перехода на Prisma, один раз отмечают как базовую — см. docs/MIGRATIONS.md.
const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', shell: true });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log('Схема PostgreSQL обновлена, прежняя история счётчиков сохранена.');
