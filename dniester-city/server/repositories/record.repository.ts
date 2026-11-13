import type { Db } from '../infrastructure/db';
import { json } from '../infrastructure/json';
import type { User } from './user.repository';

export type RecordKind = 'event' | 'ticket' | 'report' | 'reading' | 'meter' | 'schedule';
export type RecordRow = {
  id: string;
  kind: string;
  owner_id: string | null;
  organization_id: string | null;
  data: Record<string, unknown>;
};

export const recordRepository = {
  /** Грубый фильтр на стороне базы: личное, публичные события адресов, назначенное персоналу. */
  candidatesFor(db: Db, user: User) {
    return db.$queryRaw<RecordRow[]>`SELECT id,kind,owner_id,organization_id,data FROM records WHERE
  owner_id=${user.id} OR
  (kind IN ('event','schedule') AND COALESCE(data->>'status','')<>'Черновик' AND ((data->'addresses') ?| ${user.prefs.addresses}::text[] OR ${JSON.stringify(user.prefs.addresses)}::jsonb ? (data->>'address'))) OR
  ${user.role === 'admin'}::boolean OR
  (${user.role === 'dispatcher'}::boolean AND organization_id=${user.organization_id})
  ORDER BY updated_at DESC,id`;
  },
  async lock(db: Db, id: string) {
    return (await db.$queryRaw<RecordRow[]>`SELECT * FROM records WHERE id=${id} FOR UPDATE`)[0];
  },
  findMeter(db: Db, id: string) {
    return db.record.findFirst({ where: { id, kind: 'meter' } });
  },
  personalMeterData(db: Db, ownerId: string) {
    return db.record.findMany({ where: { owner_id: ownerId, kind: { in: ['reading', 'meter'] } } });
  },
  async ownerOf(db: Db, id: string) {
    return (await db.record.findUnique({ where: { id }, select: { owner_id: true } }))?.owner_id;
  },
  save(
    db: Db,
    r: { id: string; kind: RecordKind; ownerId: string; organizationId: string | null; data: unknown },
  ) {
    return db.record.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        kind: r.kind,
        owner_id: r.ownerId,
        organization_id: r.organizationId,
        data: json(r.data),
      },
      update: { data: json(r.data), organization_id: r.organizationId, updated_at: new Date() },
    });
  },
  /** Черновик от поставщика; повтор того же id молча пропускается. Возвращает 1 или 0. */
  async insertDraft(db: Db, id: string, organizationId: string, data: unknown) {
    const r = await db.record.createMany({
      data: [
        { id, kind: 'event', owner_id: null, organization_id: organizationId, data: json(data) },
      ],
      skipDuplicates: true,
    });
    return r.count;
  },
};
