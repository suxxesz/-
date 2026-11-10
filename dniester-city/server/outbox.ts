import { randomUUID } from 'node:crypto';
import type { PrismaClient } from './db';
import { TelegramError } from './telegram';
type Job = { id: bigint; telegram_id: string; text: string; attempts: number; lease_token: string };
export function retryDecision(
  error: unknown,
  attempts: number,
): { status: 'pending' | 'failed'; seconds: number } {
  if (error instanceof TelegramError && [400, 401, 403].includes(error.code))
    return { status: 'failed', seconds: 0 };
  if (attempts >= 8) return { status: 'failed', seconds: 0 };
  return {
    status: 'pending',
    seconds: Math.max(
      error instanceof TelegramError ? error.retryAfter : 0,
      Math.min(15 * 2 ** Math.max(0, attempts - 1), 900),
    ),
  };
}
export async function deliverOne(
  prisma: PrismaClient,
  send: (chatId: string, text: string) => Promise<unknown>,
): Promise<boolean> {
  // Взять одно уведомление под аренду. FOR UPDATE SKIP LOCKED — только сырым SQL: Prisma его не выражает.
  const job = await prisma.$transaction(async (db): Promise<Job | undefined> => {
    const rows = await db.$queryRaw<
      { id: bigint; text: string; attempts: number; telegram_id: bigint }[]
    >`SELECT n.id,n.text,n.attempts,u.telegram_id FROM notification_outbox n JOIN users u ON u.id=n.user_id WHERE n.status IN ('pending','processing') AND n.next_attempt_at<=now() ORDER BY n.id FOR UPDATE OF n SKIP LOCKED LIMIT 1`;
    if (!rows[0]) return undefined;
    const lease = randomUUID();
    await db.$executeRaw`UPDATE notification_outbox SET status='processing',attempts=attempts+1,lease_token=${lease}::uuid,next_attempt_at=now()+interval '60 seconds' WHERE id=${rows[0].id}`;
    return {
      id: rows[0].id,
      text: rows[0].text,
      telegram_id: String(rows[0].telegram_id),
      attempts: Number(rows[0].attempts) + 1,
      lease_token: lease,
    };
  });
  if (!job) return false;
  // Network I/O happens after releasing the transaction. A crashed worker's lease is reclaimable.
  try {
    await send(job.telegram_id, job.text);
    await prisma.notificationOutbox.updateMany({
      where: { id: job.id, lease_token: job.lease_token },
      data: { status: 'sent', lease_token: null },
    });
  } catch (e) {
    const retry = retryDecision(e, job.attempts);
    await prisma.$executeRaw`UPDATE notification_outbox SET status=${retry.status},next_attempt_at=now()+${retry.seconds}::integer*interval '1 second',lease_token=NULL WHERE id=${job.id} AND lease_token=${job.lease_token}::uuid`;
  }
  return true;
}
