import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('v0.1 histories migrate to separate personal meters and repeated setup is safe', async () => {
  const pg = new PGlite(),
    schema = await readFile(new URL('../server/schema.sql', import.meta.url), 'utf8');
  try {
    await pg.exec(schema);
    await pg.query(
      "INSERT INTO users(id,telegram_id,name,prefs) VALUES('u1',1,'Первый','{}'),('u2',2,'Второй','{}')",
    );
    for (const [id, owner, value, previous] of [
      ['r1', 'u1', 120, 100],
      ['r2', 'u1', 130, 120],
      ['r3', 'u2', 700, 680],
    ]) {
      const period = id === 'r1' ? '2026-08' : '2026-09';
      await pg.query("INSERT INTO records(id,kind,owner_id,data) VALUES($1,'reading',$2,$3)", [
        id,
        owner,
        JSON.stringify({
          id,
          address: 'Один дом',
          category: 'water',
          value,
          previous,
          period,
          created: '2026-09-01T10:00:00Z',
          status: 'Сохранено в сервисе',
        }),
      ]);
    }
    await pg.exec(schema);
    await pg.exec(schema);
    const meters = await pg.query<{ owner_id: string; data: { initialValue: number; id: string } }>(
      "SELECT * FROM records WHERE kind='meter'",
    );
    assert.equal(meters.rows.length, 2);
    assert.equal(meters.rows.find((m) => m.owner_id === 'u1')!.data.initialValue, 100);
    const readings = await pg.query<{ owner_id: string; data: { meterId: string } }>(
      "SELECT * FROM records WHERE kind='reading'",
    );
    const first = readings.rows.filter((r) => r.owner_id === 'u1');
    assert.equal(first[0].data.meterId, first[1].data.meterId);
    assert.notEqual(
      first[0].data.meterId,
      readings.rows.find((r) => r.owner_id === 'u2')!.data.meterId,
    );
  } finally {
    await pg.close();
  }
});
