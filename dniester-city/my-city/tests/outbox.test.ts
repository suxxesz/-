import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { deliverOne, retryDecision } from '../server/outbox';
import { createTelegramClient, TelegramError } from '../server/telegram';
import { type AppOptions } from '../server/app';
test('outbox uses a committed lease, retries rate limits and terminates blocked recipients', async () => {
  const pg = new PGlite();
  await pg.exec(await readFile(new URL('../server/schema.sql', import.meta.url), 'utf8'));
  const query = (sql: string, p?: unknown[]) => pg.query<Record<string, unknown>>(sql, p);
  const pool = {
    query,
    connect: async () => ({ query, release() {} }),
  } as unknown as AppOptions['pool'];
  try {
    await query("INSERT INTO users(id,telegram_id,name,prefs) VALUES('u',1,'Тест','{}')");
    await query(
      "INSERT INTO notification_outbox(user_id,dedupe_key,text) VALUES('u','key-1','Сообщение')",
    );
    let sent = 0;
    assert.equal(
      await deliverOne(pool, async () => {
        const { rows } = await query('SELECT status,lease_token FROM notification_outbox');
        assert.equal(rows[0].status, 'processing');
        assert.ok(rows[0].lease_token);
        sent++;
      }),
      true,
    );
    assert.equal(sent, 1);
    assert.equal((await query('SELECT status FROM notification_outbox')).rows[0].status, 'sent');
    assert.equal(
      await deliverOne(pool, async () => {
        sent++;
      }),
      false,
    );
    await query(
      "INSERT INTO notification_outbox(user_id,dedupe_key,text) VALUES('u','key-2','Сообщение')",
    );
    await deliverOne(pool, async () => {
      throw new TelegramError(429, 60);
    });
    const retried = (await query("SELECT * FROM notification_outbox WHERE dedupe_key='key-2'"))
      .rows[0];
    assert.equal(retried.status, 'pending');
    assert.equal(retried.attempts, 1);
    assert.ok(new Date(retried.next_attempt_at as string).getTime() > Date.now() + 50000);
    await query("UPDATE notification_outbox SET next_attempt_at=now() WHERE dedupe_key='key-2'");
    await deliverOne(pool, async () => {
      throw new TelegramError(403);
    });
    assert.equal(
      (await query("SELECT status FROM notification_outbox WHERE dedupe_key='key-2'")).rows[0]
        .status,
      'failed',
    );
    assert.equal(retryDecision(Error('network'), 8).status, 'failed');
  } finally {
    await pg.close();
  }
});
test('Telegram client reads retry_after without exposing API credentials in errors', async () => {
  const fakeFetch = (async () =>
    new Response(JSON.stringify({ ok: false, error_code: 429, parameters: { retry_after: 42 } }), {
      status: 429,
    })) as typeof fetch;
  try {
    await createTelegramClient('private-test-token', fakeFetch)('sendMessage', {
      chat_id: 1,
      text: 'test',
    });
    assert.fail('Expected rate limit');
  } catch (e) {
    assert.ok(e instanceof TelegramError);
    assert.equal(e.retryAfter, 42);
    assert.ok(!e.message.includes('private-test-token'));
  }
});
