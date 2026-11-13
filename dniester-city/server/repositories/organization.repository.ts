import type { Db } from '../infrastructure/db';
import { json } from '../infrastructure/json';
import type { Category, Organization } from '../../src/entities/city/model/types';
import type { User } from './user.repository';

const fromRow = (r: Record<string, unknown>): Organization => ({
  id: String(r.id),
  name: String(r.name),
  categories: r.categories as Category[],
  addresses: r.addresses as string[],
  connected: Boolean(r.connected),
  sourceUrl: String(r.source_url || ''),
});

export const organizationRepository = {
  /** Админ видит все организации; остальные — свою и обслуживающие их адреса. */
  async visibleTo(db: Db, user: User): Promise<Organization[]> {
    const rows =
      user.role === 'admin'
        ? await db.organization.findMany({ orderBy: { name: 'asc' } })
        : await db.$queryRaw<
            Record<string, unknown>[]
          >`SELECT * FROM organizations WHERE id=${user.organization_id} OR addresses ?| ${user.prefs.addresses}::text[] ORDER BY name`;
    return rows.map((r) => fromRow(r as Record<string, unknown>));
  },
  findName(db: Db, id: string) {
    return db.organization.findUnique({ where: { id }, select: { name: true } });
  },
  save(db: Db, o: Organization) {
    const fields = {
      name: o.name,
      categories: json(o.categories),
      addresses: json(o.addresses),
      connected: o.connected,
      source_url: o.sourceUrl || '',
    };
    return db.organization.upsert({
      where: { id: o.id },
      create: { id: o.id, ...fields },
      update: fields,
    });
  },
  /** Сериализует правки зон обслуживания, чтобы два админа не создали пересекающиеся зоны. */
  async lockZones(db: Db) {
    await db.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(421902)) AS lock`;
  },
};
