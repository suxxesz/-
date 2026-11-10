import { readFile } from 'node:fs/promises';
import { createPrisma } from './db';
import { services } from '../src/entities/city/model/types';
// Local operator CLI. It is deliberately not exposed as a public API.
const path = process.argv[2];
if (!path) throw Error('Использование: npm run provision -- configuration.json');
const config = JSON.parse(await readFile(path, 'utf8'));
const prisma = createPrisma();
try {
  await prisma.$transaction(async (db) => {
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
      const fields = {
        name: o.name,
        categories: o.categories,
        addresses: o.addresses,
        connected: Boolean(o.connected),
      };
      await db.organization.upsert({
        where: { id: o.id },
        create: { id: o.id, ...fields },
        update: fields,
      });
    }
    for (const staff of config.dispatchers || []) {
      const result = await db.user.updateMany({
        where: { telegram_id: BigInt(staff.telegramId) },
        data: { role: 'dispatcher', organization_id: staff.organizationId },
      });
      if (!result.count) throw Error('Диспетчер должен сначала войти через Telegram.');
    }
    for (const schedule of config.schedules || []) {
      const org = await db.organization.findUnique({ where: { id: schedule.organizationId } });
      if (
        !org ||
        !(org.addresses as string[]).includes(schedule.address) ||
        !(org.categories as string[]).includes(schedule.category) ||
        !schedule.id ||
        !schedule.title ||
        !schedule.when ||
        !schedule.description
      )
        throw Error('Проверьте график и организацию.');
      const { organizationId, ...data } = schedule;
      await db.record.upsert({
        where: { id: schedule.id },
        create: { id: schedule.id, kind: 'schedule', organization_id: organizationId, data },
        update: { data, organization_id: organizationId, updated_at: new Date() },
      });
    }
  });
  console.log('Организации, диспетчеры и графики настроены.');
} finally {
  await prisma.$disconnect();
}
