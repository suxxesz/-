import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoState as initialState, demoAddress } from '../src/demo';
import { applyAction } from '../src/actions';
import { parseAction } from '../src/contracts';
import { eventTime, wallTime } from '../src/lib/dates';
test('meters of one service retain separate baselines and monthly histories', () => {
  let s = initialState();
  s = applyAction(s, {
    type: 'meter.create',
    payload: {
      address: demoAddress,
      category: 'water',
      name: 'Ванная',
      serial: '1234',
      initialValue: 500,
    },
  });
  const meter = s.meters.at(-1)!;
  s = applyAction(s, {
    type: 'reading.create',
    payload: {
      address: demoAddress,
      category: 'water',
      meterId: meter.id,
      value: 505,
      period: '2026-09',
    },
  });
  assert.equal(s.readings[0].previous, 500);
  assert.equal(s.readings[0].value - s.readings[0].previous, 5);
  assert.throws(
    () =>
      applyAction(s, {
        type: 'reading.create',
        payload: {
          address: demoAddress,
          category: 'water',
          meterId: meter.id,
          value: 504,
          period: '2026-10',
        },
      }),
    /меньше/,
  );
  assert.throws(
    () =>
      applyAction(s, {
        type: 'reading.create',
        payload: {
          address: demoAddress,
          category: 'gas',
          meterId: meter.id,
          value: 600,
          period: '2026-10',
        },
      }),
    /Счётчик/,
  );
});
test('draft creation has no notification and publication is guarded by record version', () => {
  const s = initialState(),
    draft = applyAction(
      s,
      {
        type: 'event.create',
        payload: {
          category: 'water',
          addresses: [demoAddress],
          title: 'Работы',
          description: 'Проверенная сводка',
          source: 'Диспетчер',
          start: '2026-10-28T09:00',
          end: '2026-10-28T12:00',
          draft: true,
        },
      },
      'admin',
    );
  assert.equal(draft.notices.length, s.notices.length);
  assert.equal(draft.events[0].status, 'Черновик');
  const published = applyAction(
    draft,
    { type: 'event.publish', payload: { id: draft.events[0].id, expectedVersion: 1 } },
    'admin',
  );
  assert.equal(published.notices.length, s.notices.length + 1);
  assert.equal(published.events[0].version, 2);
  assert.throws(
    () =>
      applyAction(
        published,
        {
          type: 'event.update',
          payload: {
            id: published.events[0].id,
            status: 'Завершено',
            comment: 'Готово',
            end: '2026-10-28T12:00',
            expectedVersion: 1,
          },
        },
        'admin',
      ),
    /уже изменена/,
  );
  assert.throws(
    () =>
      applyAction(
        published,
        { type: 'event.publish', payload: { id: published.events[0].id, expectedVersion: 2 } },
        'admin',
      ),
    /только черновик/,
  );
});
test('runtime contracts reject unknown fields, invalid source URLs and forged actions', () => {
  assert.throws(() =>
    parseAction({ type: 'subscriptions', payload: { categories: ['water'], role: 'admin' } }),
  );
  assert.throws(
    () =>
      parseAction({
        type: 'event.create',
        payload: {
          category: 'water',
          addresses: [demoAddress],
          title: 'x',
          description: 'x',
          source: 'x',
          sourceUrl: 'javascript:alert(1)',
          start: '2026-10-28T09:00',
        },
      }),
    /https/,
  );
  assert.throws(() =>
    parseAction({
      type: 'reading.create',
      payload: { address: demoAddress, category: 'water', value: '190', period: '2026-10' },
    }),
  );
  assert.throws(() => parseAction({ type: 'admin.delete-all', payload: {} }));
});
test('organization and schedule editing respect role and non-overlapping responsibility', () => {
  const s = initialState();
  assert.throws(
    () =>
      applyAction(
        s,
        {
          type: 'organization.save',
          payload: {
            name: 'Новая',
            categories: ['water'],
            addresses: [demoAddress],
            connected: false,
          },
        },
        'admin',
      ),
    /пересекается/,
  );
  assert.throws(
    () =>
      applyAction(
        s,
        {
          type: 'organization.save',
          payload: {
            name: 'Новая',
            categories: ['water'],
            addresses: ['Новый адрес'],
            connected: false,
          },
        },
        'dispatcher',
      ),
    /администратора/,
  );
  const n = applyAction(
    s,
    {
      type: 'schedule.save',
      payload: {
        address: demoAddress,
        category: 'waste',
        title: 'Вывоз',
        when: 'Каждый день',
        description: 'График пилота',
        source: 'Учебный диспетчер',
      },
    },
    'admin',
  );
  assert.equal(n.schedules.length, s.schedules.length + 1);
});
test('wall time is stored as UTC using the Chisinau seasonal offset', () => {
  assert.equal(eventTime('2026-10-28T09:00'), '2026-10-28T07:00:00.000Z');
  assert.equal(eventTime('2026-07-28T09:00'), '2026-07-28T06:00:00.000Z');
  assert.equal(wallTime('2026-10-28T07:00:00Z'), '2026-10-28T09:00');
  assert.throws(() => eventTime('2026-03-29T03:30'), /не существует/);
});
