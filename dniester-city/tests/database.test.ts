import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stateFor, mutate, emptyPrefs, toUser } from '../server/store';
import { testDb } from './helpers/db';
import { demoAddress } from '../src/entities/city/model/demo';
test('PostgreSQL schema, organization isolation, personal readings and addressed outbox', async () => {
  const { pg, prisma, close } = await testDb();
  try {
    // Начальные данные кладём прямым SQL; сам сервер работает через Prisma.
    const db = { query: (sql: string, params?: any[]) => pg.query<any>(sql, params) };
    const prefs = { ...emptyPrefs(), addresses: [demoAddress], activeAddress: demoAddress };
    for (const [id, role, tid] of [
      ['u1', 'resident', 1],
      ['u2', 'resident', 2],
      ['water-staff', 'dispatcher', 3],
      ['power-staff', 'dispatcher', 4],
      ['admin', 'admin', 5],
    ])
      await db.query('INSERT INTO users(id,telegram_id,name,role,prefs) VALUES($1,$2,$1,$3,$4)', [
        id,
        tid,
        role,
        JSON.stringify(prefs),
      ]);
    await db.query('INSERT INTO organizations(id,name,categories,addresses) VALUES($1,$2,$3,$4)', [
      'water',
      'Водоснабжение',
      JSON.stringify(['water']),
      JSON.stringify([demoAddress]),
    ]);
    await db.query('INSERT INTO organizations(id,name,categories,addresses) VALUES($1,$2,$3,$4)', [
      'power',
      'Электроснабжение',
      JSON.stringify(['power']),
      JSON.stringify([demoAddress]),
    ]);
    await db.query("UPDATE users SET organization_id='water' WHERE id='water-staff'");
    await db.query("UPDATE users SET organization_id='power' WHERE id='power-staff'");
    const user = async (id: string) =>
      toUser(await prisma.user.findUniqueOrThrow({ where: { id } }));
    const run = async (id: string, action: any) => {
      const u = await user(id);
      return prisma.$transaction((tx) => mutate(tx, u, action));
    };
    const ticketState = await run('u1', {
      type: 'ticket.create',
      payload: {
        address: demoAddress,
        category: 'water',
        title: 'Нет воды',
        description: 'Проверьте водоснабжение',
      },
    });
    const ticket = ticketState.tickets[0];
    assert.equal(ticketState.tickets.length, 1);
    assert.equal(
      (await stateFor(prisma, await user('u2'))).tickets.length,
      0,
      'another resident cannot read ticket',
    );
    assert.equal(
      (await stateFor(prisma, await user('power-staff'))).tickets.length,
      0,
      'another organization cannot read ticket',
    );
    assert.equal((await stateFor(prisma, await user('water-staff'))).tickets.length, 1);
    await assert.rejects(
      run('power-staff', {
        type: 'ticket.status',
        payload: { id: ticket.id, status: 'Принята', comment: 'ok' },
      }),
      /Нет доступа/,
    );
    await run('water-staff', {
      type: 'ticket.status',
      payload: { id: ticket.id, status: 'Принята', comment: 'Проверяем' },
    });
    assert.equal((await stateFor(prisma, await user('u1'))).tickets[0].status, 'Принята');
    await run('u1', {
      type: 'reading.create',
      payload: { address: demoAddress, category: 'water', value: 180, period: '2026-10' },
    });
    await run('u2', {
      type: 'reading.create',
      payload: { address: demoAddress, category: 'water', value: 280, period: '2026-10' },
    });
    assert.equal((await stateFor(prisma, await user('u1'))).readings[0].value, 180);
    await assert.rejects(
      run('u1', {
        type: 'reading.create',
        payload: { address: demoAddress, category: 'water', value: 181, period: '2026-10' },
      }),
      /уже/,
    );
    await run('u2', { type: 'subscriptions', payload: { categories: ['power'] } });
    await assert.rejects(
      run('water-staff', {
        type: 'event.create',
        payload: {
          category: 'gas',
          addresses: [demoAddress],
          title: 'Работы',
          description: 'Проверка',
          source: 'Диспетчер',
          start: '2026-10-28T09:00',
        },
      }),
      /ответственности/,
    );
    const e = await run('water-staff', {
      type: 'event.create',
      payload: {
        category: 'water',
        addresses: [demoAddress],
        title: 'Плановые работы',
        description: 'Замена трубы',
        source: 'Водоснабжение',
        start: '2026-10-28T09:00',
        end: '2026-10-28T15:00',
      },
    });
    assert.equal(e.events.length, 1);
    const n = await db.query('SELECT * FROM notification_outbox');
    assert.equal(n.rows.length, 4);
    assert.ok(n.rows.some((x) => x.user_id === 'u1'));
    assert.ok(!n.rows.some((x) => x.user_id === 'u2'));
    assert.equal((await stateFor(prisma, await user('u1'))).events.length, 1);
    const audit = await db.query('SELECT * FROM audit_log');
    assert.ok(audit.rows.length >= 5);
  } finally {
    await close();
  }
});
