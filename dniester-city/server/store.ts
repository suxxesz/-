import type { PoolClient } from 'pg';
import { persistMedia } from './files';
import {
  type State,
  type Category,
  type Organization,
  type Role,
  type CityEvent,
  services,
} from '../src/model';
import { applyAction } from '../src/actions';
import { parseAction, type Action } from '../src/contracts';
export type User = {
  id: string;
  telegram_id: string;
  name: string;
  role: Role;
  organization_id: string | null;
  prefs: {
    addresses: string[];
    activeAddress: string;
    subscriptions: Category[];
    subscriptionsByAddress?: Record<string, Category[]>;
  };
};
export type { Organization } from '../src/model';
type RecordRow = {
  id: string;
  kind: string;
  owner_id: string | null;
  organization_id: string | null;
  data: Record<string, unknown>;
};
export const emptyPrefs = () => ({
  addresses: [],
  activeAddress: '',
  subscriptions: services.map((s) => s.id),
  subscriptionsByAddress: {},
});
const organizationFromRow = (r: Record<string, unknown>): Organization => ({
  id: String(r.id),
  name: String(r.name),
  categories: r.categories as Category[],
  addresses: r.addresses as string[],
  connected: Boolean(r.connected),
  sourceUrl: String(r.source_url || ''),
});
async function organizationsFor(db: PoolClient, user: User): Promise<Organization[]> {
  const sql =
    user.role === 'admin'
      ? 'SELECT * FROM organizations ORDER BY name'
      : 'SELECT * FROM organizations WHERE id=$1 OR addresses ?| $2::text[] ORDER BY name';
  const { rows } = await db.query(
    sql,
    user.role === 'admin' ? [] : [user.organization_id, user.prefs.addresses],
  );
  return rows.map(organizationFromRow);
}
export function canManage(
  user: User,
  organization: Organization | undefined,
  record: { organization_id: string | null; data: Record<string, unknown> },
): boolean {
  if (user.role === 'admin') return true;
  if (user.role !== 'dispatcher' || !organization || record.organization_id !== organization.id)
    return false;
  const addresses = (record.data.addresses || [record.data.address]) as string[];
  return (
    organization.categories.includes(record.data.category as Category) &&
    addresses.every((a) => organization.addresses.includes(a))
  );
}
export async function stateFor(db: PoolClient, user: User): Promise<State> {
  const organizations = await organizationsFor(db, user),
    org = organizations.find((o) => o.id === user.organization_id);
  const staff = user.role !== 'resident';
  // Filter at the database boundary: personal records, public address events, or assigned staff records.
  const { rows: records } = await db.query<RecordRow>(
    `SELECT id,kind,owner_id,organization_id,data FROM records WHERE
  owner_id=$1 OR
  (kind IN ('event','schedule') AND COALESCE(data->>'status','')<>'Черновик' AND ((data->'addresses') ?| $2::text[] OR $6::jsonb ? (data->>'address'))) OR
  $3::boolean OR
  ($4::boolean AND organization_id=$5)
  ORDER BY updated_at DESC,id`,
    [
      user.id,
      user.prefs.addresses,
      user.role === 'admin',
      user.role === 'dispatcher',
      user.organization_id,
      JSON.stringify(user.prefs.addresses),
    ],
  );
  const visible = records.filter((r) => {
    if (staff && canManage(user, org, r)) return true;
    if (r.kind === 'report') return true;
    if (r.kind === 'ticket' || r.kind === 'reading' || r.kind === 'meter')
      return r.owner_id === user.id;
    if (r.data.status === 'Черновик') return false;
    return ((r.data.addresses || [r.data.address]) as string[]).some((a) =>
      user.prefs.addresses.includes(a),
    );
  });
  const data = <T>(kind: string) => visible.filter((r) => r.kind === kind).map((r) => r.data as T);
  const addresses = [...new Set([...(staff && org ? org.addresses : []), ...user.prefs.addresses])];
  const activeAddress = addresses.includes(user.prefs.activeAddress)
    ? user.prefs.activeAddress
    : addresses[0] || '';
  const notices = (
    await db.query(
      'SELECT id,text,read,created_at FROM notification_outbox WHERE user_id=$1 ORDER BY id DESC LIMIT 100',
      [user.id],
    )
  ).rows.map((n) => ({
    id: String(n.id),
    text: n.text,
    read: n.read,
    created: new Date(n.created_at).toISOString(),
  }));
  return {
    ...user.prefs,
    addresses,
    activeAddress,
    subscriptions: user.prefs.subscriptionsByAddress?.[activeAddress] || user.prefs.subscriptions,
    events: data('event'),
    tickets: data('ticket'),
    reports: data('report'),
    meters: data('meter'),
    readings: data('reading'),
    schedules: data('schedule'),
    organizations,
    notices,
  };
}
export async function mutate(db: PoolClient, provided: User, raw: Action | unknown) {
  const action = parseAction(raw);
  const user: User = (await db.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [provided.id]))
    .rows[0];
  if (!user) throw Error('Пользователь не найден.');
  if (
    action.requestId &&
    (
      await db.query('SELECT 1 FROM mutation_receipts WHERE user_id=$1 AND request_id=$2', [
        user.id,
        action.requestId,
      ])
    ).rows.length
  )
    return stateFor(db, user);
  if (action.type === 'organization.save') await db.query('SELECT pg_advisory_xact_lock(421902)');
  const organizations = await organizationsFor(db, user),
    org = organizations.find((o) => o.id === user.organization_id);
  const p = action.payload;
  if (
    'id' in p &&
    p.id &&
    ['ticket.status', 'report.status', 'ticket.reopen', 'event.update', 'event.publish', 'schedule.save'].includes(
      action.type,
    )
  ) {
    const record = (
      await db.query<RecordRow>('SELECT * FROM records WHERE id=$1 FOR UPDATE', [p.id])
    ).rows[0];
    const expectedKind = action.type.startsWith('ticket.')
      ? 'ticket'
      : action.type.startsWith('report.')
        ? 'report'
        : action.type.startsWith('event.')
        ? 'event'
        : 'schedule';
    if (!record || record.kind !== expectedKind) throw Error('Запись не найдена.');
    if (action.type === 'ticket.reopen') {
      if (record.owner_id !== user.id) throw Error('Нет доступа к заявке.');
    } else if (record.kind !== 'report' && !canManage(user, org, record)) throw Error('Нет доступа к организации или адресу.');
  }
  if (action.type === 'event.create' || action.type === 'schedule.save') {
    const values = action.payload,
      addresses = 'addresses' in values ? values.addresses : [values.address];
    if (
      user.role === 'resident' ||
      (user.role === 'dispatcher' &&
        (!org ||
          !org.categories.includes(values.category) ||
          addresses.some((a) => !org.addresses.includes(a))))
    )
      throw Error('Событие вне зоны вашей ответственности.');
    if (org) values.source = org.name;
  }
  if (action.type === 'reading.create' && action.payload.meterId) {
    const meter = (
      await db.query<RecordRow>("SELECT * FROM records WHERE id=$1 AND kind='meter'", [
        action.payload.meterId,
      ])
    ).rows[0];
    if (!meter || meter.owner_id !== user.id) throw Error('Нет доступа к счётчику.');
  }
  const before = await stateFor(db, user);
  // Staff may inspect residents' records but a new personal reading must use only the actor's own history.
  let domainState = before;
  if (action.type === 'address.add') {
    domainState = {
      ...before,
      addresses: user.prefs.addresses,
      activeAddress: user.prefs.activeAddress,
    };
  }
  if (['reading.create', 'meter.create'].includes(action.type)) {
    const { rows } = await db.query<RecordRow>(
      "SELECT * FROM records WHERE owner_id=$1 AND kind IN ('reading','meter')",
      [user.id],
    );
    domainState = {
      ...before,
      readings: rows
        .filter((r) => r.kind === 'reading')
        .map((r) => r.data as unknown as State['readings'][number]),
      meters: rows
        .filter((r) => r.kind === 'meter')
        .map((r) => r.data as unknown as State['meters'][number]),
    };
  }
  const after = applyAction(domainState, action, user.role);
  const fieldKinds = [
    ['events', 'event'],
    ['tickets', 'ticket'],
    ['reports', 'report'],
    ['readings', 'reading'],
    ['meters', 'meter'],
    ['schedules', 'schedule'],
  ] as const;
  for (const [field, kind] of fieldKinds) {
    const old = new Map(((domainState[field] ?? []) as { id: string }[]).map((x) => [x.id, JSON.stringify(x)]));
    for (const item of (after[field] ?? []) as (CityEvent & { address: string })[])
      if (old.get(item.id) !== JSON.stringify(item)) {
        const addresses: string[] = item.addresses ?? [item.address];
        const matches =
          kind === 'report'
            ? []
            : organizations.filter(
                (o) =>
                  o.categories.includes(item.category) &&
                  addresses.every((a) => o.addresses.includes(a)),
              );
        if (matches.length > 1)
          throw Error(
            'Для адреса настроены неоднозначные зоны ответственности. Обратитесь к администратору.',
          );
        if (kind === 'report') {
          const r = item as unknown as { media: string; reportPhoto?: string };
          r.media = (await persistMedia(r.media)) as string;
          r.reportPhoto = await persistMedia(r.reportPhoto);
        }
        const organizationId = kind === 'event' && org ? org.id : matches[0]?.id || null;
        await db.query(
          'INSERT INTO records(id,kind,owner_id,organization_id,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,organization_id=EXCLUDED.organization_id,updated_at=now()',
          [item.id, kind, user.id, organizationId, JSON.stringify(item)],
        );
        await db.query(
          'INSERT INTO audit_log(actor_id,action,record_id,details) VALUES($1,$2,$3,$4)',
          [
            user.id,
            action.type,
            item.id,
            JSON.stringify({
              version: 'version' in item ? item.version : undefined,
              requestId: action.requestId,
            }),
          ],
        );
        if (kind === 'report' && action.type === 'report.status') {
          const rep = item as unknown as { id: string; title: string; status: string; version?: number },
            owner = (await db.query('SELECT owner_id FROM records WHERE id=$1', [rep.id])).rows[0]?.owner_id;
          if (owner)
            await db.query(
              'INSERT INTO notification_outbox(user_id,dedupe_key,text) VALUES($1,$2,$3) ON CONFLICT(dedupe_key) DO NOTHING',
              [owner, `${rep.id}:v${rep.version || 1}:${owner}`, `DniesterCity: жалоба «${rep.title}» — ${rep.status}`],
            );
        }
        if (kind === 'event' && (item as CityEvent).status !== 'Черновик')
          await notifyEvent(db, item as CityEvent);
      }
  }
  if (action.type === 'organization.save') {
    const old = new Map(before.organizations.map((o) => [o.id, JSON.stringify(o)]));
    for (const o of after.organizations)
      if (old.get(o.id) !== JSON.stringify(o)) {
        await db.query(
          'INSERT INTO organizations(id,name,categories,addresses,connected,source_url) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,categories=EXCLUDED.categories,addresses=EXCLUDED.addresses,connected=EXCLUDED.connected,source_url=EXCLUDED.source_url',
          [
            o.id,
            o.name,
            JSON.stringify(o.categories),
            JSON.stringify(o.addresses),
            o.connected,
            o.sourceUrl || '',
          ],
        );
        await db.query('INSERT INTO audit_log(actor_id,action,record_id) VALUES($1,$2,$3)', [
          user.id,
          action.type,
          o.id,
        ]);
      }
  }
  if (action.type === 'notices.read')
    await db.query('UPDATE notification_outbox SET read=true WHERE user_id=$1', [user.id]);
  if (['address.add', 'address.select', 'subscriptions'].includes(action.type)) {
    // Never persist an organization's derived service area as a user's private subscriptions.
    const personalAddresses =
      action.type === 'address.add'
        ? [...user.prefs.addresses, action.payload.address]
        : user.prefs.addresses;
    await db.query('UPDATE users SET prefs=$2 WHERE id=$1', [
      user.id,
      JSON.stringify({
        addresses: personalAddresses,
        activeAddress: after.activeAddress,
        subscriptions: after.subscriptions,
        subscriptionsByAddress: after.subscriptionsByAddress || {},
      }),
    ]);
  }
  if (action.requestId)
    await db.query('INSERT INTO mutation_receipts(user_id,request_id) VALUES($1,$2)', [
      user.id,
      action.requestId,
    ]);
  return stateFor(db, (await db.query('SELECT * FROM users WHERE id=$1', [user.id])).rows[0]);
}
async function notifyEvent(db: PoolClient, event: CityEvent) {
  const users = (
    await db.query("SELECT id,prefs FROM users WHERE prefs->'addresses' ?| $1::text[]", [
      event.addresses,
    ])
  ).rows;
  for (const u of users) {
    if (
      !u.prefs.addresses.some(
        (a: string) =>
          event.addresses.includes(a) &&
          (u.prefs.subscriptionsByAddress?.[a] || u.prefs.subscriptions).includes(event.category),
      )
    )
      continue;
    const text = `DniesterCity: ${event.title}\n${event.status}\n${event.addresses.join('; ')}\nНачало: ${event.start}\nОкончание: ${event.end || 'срок неизвестен'}\n${event.description}\nИсточник: ${event.source}`;
    await db.query(
      'INSERT INTO notification_outbox(user_id,dedupe_key,text) VALUES($1,$2,$3) ON CONFLICT(dedupe_key) DO NOTHING',
      [u.id, `${event.id}:v${event.version || 1}:${u.id}`, text],
    );
  }
}
