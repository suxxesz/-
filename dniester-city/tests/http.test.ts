import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { createApp } from '../server/app';
import { testDb } from './helpers/db';
import { demoAddress } from '../src/entities/city/model/demo';
const bot = 'integration-test-token';
function signedUser(id: number) {
  const p = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id, first_name: 'Тест' }),
    }),
    check = [...p.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
  p.set(
    'hash',
    createHmac('sha256', createHmac('sha256', 'WebAppData').update(bot).digest())
      .update(check)
      .digest('hex'),
  );
  return p.toString();
}
test('HTTP login, role revocation, idempotent mutation, draft isolation and publication preview', async () => {
  const { pg, prisma, close } = await testDb();
  const query = (sql: string, p?: unknown[]) => pg.query<any>(sql, p);
  const app = createApp({ prisma, sessionSecret: 't'.repeat(64), botToken: bot, adminIds: ['1'] }),
    server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const port = (server.address() as { port: number }).port,
    base = `http://127.0.0.1:${port}/api`;
  const call = async (path: string, token = '', body?: unknown) => {
    const r = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: (await r.json()) as any };
  };
  try {
    assert.equal((await call('/state')).status, 401);
    assert.equal((await call('/auth/telegram', '', { initData: 'forged' })).status, 401);
    const admin = (await call('/auth/telegram', '', { initData: signedUser(1) })).data,
      resident = (await call('/auth/telegram', '', { initData: signedUser(2) })).data;
    assert.equal(admin.role, 'admin');
    assert.equal(resident.role, 'resident');
    for (const token of [admin.token, resident.token])
      assert.equal(
        (await call('/action', token, { type: 'address.add', payload: { address: demoAddress } }))
          .status,
        200,
      );
    const organization = await call('/action', admin.token, {
      type: 'organization.save',
      payload: {
        name: 'Пилот воды',
        categories: ['water'],
        addresses: [demoAddress],
        connected: true,
      },
    });
    assert.equal(organization.status, 200);
    const event = {
      type: 'event.create',
      payload: {
        category: 'water',
        title: 'Учебные работы',
        description: 'Замена трубы',
        addresses: [demoAddress],
        source: 'Пилот воды',
        start: '2026-10-28T09:00',
        end: '2026-10-28T12:00',
        draft: true,
      },
    };
    assert.equal((await call('/publication-preview', resident.token, event)).status, 403);
    const draft = await call('/action', admin.token, event);
    assert.equal(draft.status, 200);
    const id = draft.data.events[0].id;
    assert.equal((await call('/state', resident.token)).data.events.length, 0);
    assert.equal((await query('SELECT * FROM notification_outbox')).rows.length, 0);
    const preview = await call('/publication-preview', admin.token, event);
    assert.equal(preview.status, 200);
    assert.equal(preview.data.recipientCount, 2);
    const publish = {
      type: 'event.publish',
      requestId: randomUUID(),
      payload: { id, expectedVersion: 1 },
    };
    assert.equal((await call('/action', admin.token, publish)).status, 200);
    assert.equal((await call('/action', admin.token, publish)).status, 200);
    assert.equal((await query('SELECT * FROM notification_outbox')).rows.length, 2);
    assert.equal((await call('/state', resident.token)).data.events.length, 1);
    assert.equal(
      (
        await call('/action', admin.token, {
          type: 'event.update',
          payload: {
            id,
            status: 'Завершено',
            end: '2026-10-28T12:00',
            comment: 'Готово',
            expectedVersion: 1,
          },
        })
      ).status,
      400,
    );
    const ticket = {
      type: 'ticket.create',
      requestId: randomUUID(),
      payload: {
        address: demoAddress,
        category: 'water',
        title: 'Проблема',
        description: 'Описание',
      },
    };
    await call('/action', resident.token, ticket);
    await call('/action', resident.token, ticket);
    assert.equal((await call('/state', resident.token)).data.tickets.length, 1);
    const meter = await call('/action', resident.token, {
      type: 'meter.create',
      payload: {
        address: demoAddress,
        category: 'water',
        name: 'Ванная',
        serial: '1002',
        initialValue: 100,
      },
    });
    assert.equal(meter.status, 200);
    assert.equal(
      (
        await call('/action', admin.token, {
          type: 'reading.create',
          payload: {
            address: demoAddress,
            category: 'water',
            meterId: meter.data.meters[0].id,
            period: '2026-10',
            value: 101,
          },
        })
      ).status,
      400,
    );
    await query("UPDATE users SET role='resident' WHERE id='tg-1'");
    assert.equal(
      (await call('/action', admin.token, event)).status,
      400,
      'old session cannot retain revoked admin access',
    );
    assert.equal(
      (
        await call('/action', resident.token, {
          type: 'subscriptions',
          payload: { categories: ['water'], admin: true },
        })
      ).status,
      400,
    );
  } finally {
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
    await close();
  }
});
test('Telegram webhook accepts only the configured secret', async () => {
  const { prisma, close } = await testDb();
  const seen: number[] = [];
  const app = createApp({
      prisma,
      sessionSecret: 't'.repeat(64),
      botToken: bot,
      adminIds: [],
      telegramWebhook: {
        secret: 'hook-secret',
        onUpdate: async (u) => void seen.push(u.update_id),
      },
    }),
    server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/telegram/webhook`;
  const post = (secret: string) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
      body: JSON.stringify({ update_id: 7 }),
    });
  try {
    assert.equal((await post('wrong')).status, 401);
    assert.equal((await post('hook-secret')).status, 200);
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(seen, [7]);
  } finally {
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
    await close();
  }
});
