import { readFile } from 'node:fs/promises';
import { pool } from './db';
const db = await pool.connect();
try {
  await db.query('BEGIN');
  await db.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  await db.query('COMMIT');
  console.log('Схема PostgreSQL обновлена, прежняя история счётчиков сохранена.');
} catch (e) {
  await db.query('ROLLBACK');
  throw e;
} finally {
  db.release();
  await pool.end();
}
