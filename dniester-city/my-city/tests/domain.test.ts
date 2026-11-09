import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { applyAction } from '../src/actions';
import { validateReading } from '../src/model';
import { createDemoState as initialState, demoAddress } from '../src/demo';
import { verifyTelegram, signSession, readSession } from '../server/auth';
import { canManage, type User, type Organization } from '../server/store';
test('meter input rejects duplicates, decreases, non-meter services and old periods', () => {
  const s = initialState();
  assert.match(validateReading(s, demoAddress, 'water', 190, '2026-09')!, /уже/);
  assert.match(validateReading(s, demoAddress, 'water', 183, '2026-10')!, /меньше/);
  assert.match(validateReading(s, demoAddress, 'waste', 100, '2026-10')!, /счётчик/);
  assert.match(validateReading(s, demoAddress, 'water', 200, '2026-05')!, /после/);
  assert.equal(validateReading(s, demoAddress, 'water', 190, '2026-10'), null);
});
test('resident cannot publish events or manage tickets', () => {
  assert.throws(
    () =>
      applyAction(
        initialState(),
        {
          type: 'event.create',
          payload: {
            category: 'water',
            addresses: [demoAddress],
            title: 'Работы',
            description: 'Замена трубы',
            source: 'Диспетчер',
            start: '2026-10-28T09:00',
          },
        },
        'resident',
      ),
    /права/,
  );
  assert.throws(
    () =>
      applyAction(
        initialState(),
        {
          type: 'ticket.status',
          payload: { id: 'REQ-1001', status: 'Выполнена', comment: 'готово' },
        },
        'resident',
      ),
    /права/,
  );
});
test('new tickets preserve honest routing status and do not mutate input', () => {
  const s = initialState(),
    n = applyAction(s, {
      type: 'ticket.create',
      payload: {
        address: demoAddress,
        category: 'waste',
        title: 'Пропущен вывоз',
        description: 'Контейнер заполнен',
      },
    });
  assert.equal(s.tickets.length, 1);
  assert.equal(n.tickets.length, 2);
  assert.match(n.tickets[0].history[0], /не подтверждено/);
});
test('ticket lifecycle requires comment and valid transition', () => {
  assert.throws(
    () =>
      applyAction(
        initialState(),
        { type: 'ticket.status', payload: { id: 'REQ-1001', status: 'Закрыта', comment: 'ok' } },
        'admin',
      ),
    /переход/,
  );
  assert.throws(
    () =>
      applyAction(
        initialState(),
        { type: 'ticket.status', payload: { id: 'REQ-1001', status: 'Выполнена', comment: '' } },
        'admin',
      ),
    /поле/,
  );
  const n = applyAction(
    initialState(),
    {
      type: 'ticket.status',
      payload: { id: 'REQ-1001', status: 'Выполнена', comment: 'Лампа заменена' },
    },
    'admin',
  );
  assert.equal(n.tickets[0].status, 'Выполнена');
});
test('event update notifies subscriber and validates restoration time', () => {
  const n = applyAction(
    initialState(),
    {
      type: 'event.update',
      payload: {
        id: 'evt-1',
        status: 'Завершено',
        end: '2026-10-28T16:00',
        comment: 'Вода восстановлена',
      },
    },
    'admin',
  );
  assert.equal(n.notices.length, 2);
  assert.match(n.notices[0].text, /Завершено/);
  assert.throws(
    () =>
      applyAction(
        initialState(),
        {
          type: 'event.update',
          payload: { id: 'evt-1', status: 'Завершено', end: '2026-10-27T16:00', comment: 'ok' },
        },
        'admin',
      ),
    /позже/,
  );
});
test('dispatcher scope requires organization, address and category match', () => {
  const u = { role: 'dispatcher', organization_id: 'water' } as User,
    o = { id: 'water', categories: ['water'], addresses: [demoAddress] } as Organization;
  assert.equal(
    canManage(u, o, {
      organization_id: 'water',
      data: { category: 'water', addresses: [demoAddress] },
    }),
    true,
  );
  assert.equal(
    canManage(u, o, {
      organization_id: 'power',
      data: { category: 'water', addresses: [demoAddress] },
    }),
    false,
  );
  assert.equal(
    canManage(u, o, {
      organization_id: 'water',
      data: { category: 'gas', addresses: [demoAddress] },
    }),
    false,
  );
  assert.equal(
    canManage(u, o, {
      organization_id: 'water',
      data: { category: 'water', addresses: ['чужой дом'] },
    }),
    false,
  );
});
test('Telegram HMAC rejects tampering and expired credentials', () => {
  const now = Date.now(),
    bot = 'test-token',
    params = new URLSearchParams({
      auth_date: String(Math.floor(now / 1000)),
      user: JSON.stringify({ id: 12345, first_name: 'Житель' }),
    });
  const check = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  params.set(
    'hash',
    createHmac('sha256', createHmac('sha256', 'WebAppData').update(bot).digest())
      .update(check)
      .digest('hex'),
  );
  assert.equal(verifyTelegram(params.toString(), bot, now).id, 12345);
  assert.throws(() => verifyTelegram(params.toString(), bot, now + 7200000), /устарела/);
  params.set('user', '{"id":999}');
  assert.throws(() => verifyTelegram(params.toString(), bot, now), /подпись/);
});
test('sessions expire and signatures cannot be forged', () => {
  const secret = 'a'.repeat(32),
    now = Date.now(),
    session = signSession('tg-123', secret, now);
  assert.equal(readSession(session, secret, now), 'tg-123');
  assert.throws(() => readSession(session, secret, now + 7200000), /истекла/);
  assert.throws(() => readSession(session, 'b'.repeat(32), now), /Недействительная/);
});
test('notification settings remain separate for each saved address', () => {
  let s = initialState();
  s = applyAction(s, { type: 'subscriptions', payload: { categories: ['water'] } });
  s = applyAction(s, {
    type: 'address.select',
    payload: { address: 'Бендеры, ул. Советская, 12' },
  });
  assert.ok(s.subscriptions.includes('power'));
  s = applyAction(s, { type: 'subscriptions', payload: { categories: ['gas'] } });
  s = applyAction(s, { type: 'address.select', payload: { address: demoAddress } });
  assert.deepEqual(s.subscriptions, ['water']);
  s = applyAction(s, {
    type: 'address.select',
    payload: { address: 'Бендеры, ул. Советская, 12' },
  });
  assert.deepEqual(s.subscriptions, ['gas']);
});
