import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../src/entities/city/model/actions';
import { emptyState } from '../src/entities/city/model/types';
const A = 'Тирасполь, ул. Ленина, 18';
test('жалоба: последовательные статусы и обязательный фотоотчёт', () => {
  let s = applyAction(emptyState(), {
    type: 'report.create',
    payload: {
      type: 'Дороги',
      title: 'Яма',
      description: 'Глубокая',
      address: A,
      lat: 46.84,
      lng: 29.63,
      media: 'data:image/png;base64,AA',
      mediaKind: 'image',
    },
  });
  const id = s.reports![0].id;
  assert.throws(
    () =>
      applyAction(
        s,
        {
          type: 'report.status',
          payload: {
            id,
            status: 'Исполнено',
            comment: 'ок',
            reportPhoto: 'data:image/png;base64,AA',
          },
        },
        'dispatcher',
      ),
    /последовательно/,
  );
  s = applyAction(
    s,
    { type: 'report.status', payload: { id, status: 'В работе', comment: 'взяли' } },
    'dispatcher',
  );
  assert.throws(
    () =>
      applyAction(
        s,
        { type: 'report.status', payload: { id, status: 'Исполнено', comment: 'ок' } },
        'dispatcher',
      ),
    /фотоотчёт/,
  );
  s = applyAction(
    s,
    {
      type: 'report.status',
      payload: { id, status: 'Исполнено', comment: 'ок', reportPhoto: 'data:image/png;base64,AA' },
    },
    'dispatcher',
  );
  assert.equal(s.reports![0].status, 'Исполнено');
  assert.throws(
    () =>
      applyAction(s, {
        type: 'report.create',
        payload: {
          type: 'Дороги',
          title: 'x',
          description: 'y',
          address: A,
          lat: 10,
          lng: 10,
          media: 'data:image/png;base64,AA',
          mediaKind: 'image',
        },
      }),
    /вне ПМР/,
  );
});
test('лишний ноль требует подтверждения', () => {
  let s = applyAction(emptyState(), { type: 'address.add', payload: { address: A } });
  s = applyAction(s, {
    type: 'meter.create',
    payload: {
      address: A,
      category: 'water',
      name: 'С',
      serial: '1',
      account: '',
      initialValue: 0,
    },
  });
  const meterId = s.meters[0].id;
  for (const [i, v] of [10, 20, 30].entries())
    s = applyAction(s, {
      type: 'reading.create',
      payload: { address: A, category: 'water', meterId, value: v, period: `2026-0${i + 1}` },
    });
  const big = { address: A, category: 'water' as const, meterId, value: 400, period: '2026-04' };
  assert.throws(() => applyAction(s, { type: 'reading.create', payload: big }), /лишний ноль/);
  s = applyAction(s, { type: 'reading.create', payload: { ...big, confirmed: true } });
  assert.equal(s.readings[0].value, 400);
});
