import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { TelegramError } from './telegram';
type Job = { id: string; telegram_id: string; text: string; attempts: number; lease_token: string };
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
  pool: Pick<Pool, 'query' | 'connect'>,
  send: (chatId: string, text: string) => Promise<unknown>,
): Promise<boolean> {
  const db = await pool.connect();
  let job: Job | undefined;
  try {
    await db.query('BEGIN');
    const { rows } = await db.query(
      "SELECT n.id,n.text,n.attempts,u.telegram_id FROM notification_outbox n JOIN users u ON u.id=n.user_id WHERE n.status IN ('pending','processing') AND n.next_attempt_at<=now() ORDER BY n.id FOR UPDATE OF n SKIP LOCKED LIMIT 1",
    );
    if (rows[0]) {
      const lease = randomUUID();
      job = { ...rows[0], attempts: rows[0].attempts + 1, lease_token: lease };
      await db.query(
        "UPDATE notification_outbox SET status='processing',attempts=attempts+1,lease_token=$2,next_attempt_at=now()+interval '60 seconds' WHERE id=$1",
        [job!.id, lease],
      );
    }
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    db.release();
  }
  if (!job) return false;
  // Network I/O happens after releasing the transaction. A crashed worker's lease is reclaimable.
  try {
    await send(String(job.telegram_id), job.text);
    await pool.query(
      "UPDATE notification_outbox SET status='sent',lease_token=NULL WHERE id=$1 AND lease_token=$2",
      [job.id, job.lease_token],
    );
  } catch (e) {
    const retry = retryDecision(e, job.attempts);
    await pool.query(
      "UPDATE notification_outbox SET status=$3,next_attempt_at=now()+$4::integer*interval '1 second',lease_token=NULL WHERE id=$1 AND lease_token=$2",
      [job.id, job.lease_token, retry.status, retry.seconds],
    );
  }
  return true;
}
