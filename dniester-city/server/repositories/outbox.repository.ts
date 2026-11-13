import type { Db } from '../infrastructure/db';
import { json } from '../infrastructure/json';

export const outboxRepository = {
  /** Уведомление ставится в очередь один раз на ключ — повторная правка той же версии не дублирует. */
  enqueue(db: Db, userId: string, dedupeKey: string, text: string) {
    return db.notificationOutbox.createMany({
      data: [{ user_id: userId, dedupe_key: dedupeKey, text }],
      skipDuplicates: true,
    });
  },
  async latestFor(db: Db, userId: string) {
    const rows = await db.notificationOutbox.findMany({
      where: { user_id: userId },
      select: { id: true, text: true, read: true, created_at: true },
      orderBy: { id: 'desc' },
      take: 100,
    });
    return rows.map((n) => ({
      id: String(n.id),
      text: n.text,
      read: n.read,
      created: new Date(n.created_at).toISOString(),
    }));
  },
  markAllRead(db: Db, userId: string) {
    return db.notificationOutbox.updateMany({ where: { user_id: userId }, data: { read: true } });
  },
};

export const auditRepository = {
  write(db: Db, actorId: string, action: string, recordId: string, details?: unknown) {
    return db.auditLog.create({
      data: {
        actor_id: actorId,
        action,
        record_id: recordId,
        ...(details ? { details: json(details) } : {}),
      },
    });
  },
};
