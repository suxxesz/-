import { readFile } from 'node:fs/promises';
import { pool } from './db';
import { services } from '../src/entities/city/model/types';
// Local operator CLI. It is deliberately not exposed as a public API.
const path = process.argv[2];
if (!path) throw Error('Использование: npm run provision -- configuration.json');
const config = JSON.parse(await readFile(path, 'utf8'));
const db = await pool.connect();
try {
  await db.query('BEGIN');
  for (const o of config.organizations || []) {
    if (
      typeof o.id !== 'string' ||
      typeof o.name !== 'string' ||
      !Array.isArray(o.addresses) ||
      !o.addresses.length ||
      !Array.isArray(o.categories) ||
      !o.categories.length ||
      o.categories.some((c: string) => !services.some((s) => s.id === c))
    )
      throw Error('Проверьте организацию и её зону обслуживания.');
    await db.query(
      'INSERT INTO organizations(id,name,categories,addresses,connected) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,categories=EXCLUDED.categories,addresses=EXCLUDED.addresses,connected=EXCLUDED.connected',
      [
        o.id,
        o.name,
        JSON.stringify(o.categories),
        JSON.stringify(o.addresses),
        Boolean(o.connected),
      ],
    );
  }
  for (const staff of config.dispatchers || []) {
    const result = await db.query(
      "UPDATE users SET role='dispatcher',organization_id=$2 WHERE telegram_id=$1 RETURNING id",
      [staff.telegramId, staff.organizationId],
    );
    if (!result.rows.length) throw Error('Диспетчер должен сначала войти через Telegram.');
  }
  for (const schedule of config.schedules || []) {
    const org = (
      await db.query('SELECT * FROM organizations WHERE id=$1', [schedule.organizationId])
    ).rows[0];
    if (
      !org ||
      !org.addresses.includes(schedule.address) ||
      !org.categories.includes(schedule.category) ||
      !schedule.id ||
      !schedule.title ||
      !schedule.when ||
      !schedule.description
    )
      throw Error('Проверьте график и организацию.');
    const { organizationId, ...data } = schedule;
    await db.query(
      "INSERT INTO records(id,kind,organization_id,data) VALUES($1,'schedule',$2,$3) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,organization_id=EXCLUDED.organization_id,updated_at=now()",
      [schedule.id, organizationId, JSON.stringify(data)],
    );
  }
  await db.query('COMMIT');
  console.log('Организации, диспетчеры и графики настроены.');
} catch (e) {
  await db.query('ROLLBACK');
  throw e;
} finally {
  db.release();
  await pool.end();
}
