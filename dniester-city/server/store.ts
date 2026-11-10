import { Prisma, type Db } from './db';
import { persistMedia } from './files';
import {
  type State,
  type Category,
  type Organization,
  type Role,
  type CityEvent,
  services,
} from '../src/entities/city/model/types';
import { applyAction } from '../src/entities/city/model/actions';
import { parseAction, type Action } from '../src/entities/city/model/contracts';
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
export type { Organization } from '../src/entities/city/model/types';
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
/** Строка users из Prisma → User сервера (telegram_id приходит как bigint). */
export const toUser = (r: {
  id: string;
  telegram_id: bigint | string | number;
  name: string;
  role: string;
  organization_id: string | null;
  prefs: unknown;
}): User => ({
  id: r.id,
  telegram_id: String(r.telegram_id),
  name: r.name,
  role: r.role as Role,
  organization_id: r.organization_id,
  prefs: r.prefs as User['prefs'],
});
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
async function organizationsFor(db: Db, user: User): Promise<Organization[]> {
  // Оператор jsonb ?| («есть хоть один из адресов») Prisma не выражает — типобезопасный $queryRaw.
  const rows =
    user.role === 'admin'
      ? await db.organization.findMany({ orderBy: { name: 'asc' } })
      : await db.$queryRaw<Record<string, unknown>[]>`SELECT * FROM organizations WHERE id=${user.organization_id} OR addresses ?| ${user.prefs.addresses}::text[] ORDER BY name`;
  return rows.map((r) => organizationFromRow(r as Record<string, unknown>));
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
export async function stateFor(db: Db, user: User): Promise<State> {
  const organizations = await organizationsFor(db, user),
    org = organizations.find((o) => o.id === user.organization_id);
  const staff = user.role !== 'resident';
  // Filter at the database boundary: personal records, public address events, or assigned staff records.
  const records = await db.$queryRaw<RecordRow[]>`SELECT id,kind,owner_id,organization_id,data FROM records WHERE
  owner_id=${user.id} OR
  (kind IN ('event','schedule') AND COALESCE(data->>'status','')<>'Черновик' AND ((data->'addresses') ?| ${user.prefs.addresses}::text[] OR ${JSON.stringify(user.prefs.addresses)}::jsonb ? (data->>'address'))) OR
  ${user.role === 'admin'}::boolean OR
  (${user.role === 'dispatcher'}::boolean AND organization_id=${user.organization_id})
  ORDER BY updated_at DESC,id`;
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
    await db.notificationOutbox.findMany({
      where: { user_id: user.id },
      select: { id: true, text: true, read: true, created_at: true },
      orderBy: { id: 'desc' },
      take: 100,
    })
  ).map((n) => ({
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
export async function mutate(db: Db, provided: User, raw: Action | unknown) {
  const action = parseAction(raw);
  // Блокировка строки пользователя на время транзакции — FOR UPDATE есть только в сыром SQL.
  const locked = (
    await db.$queryRaw<Parameters<typeof toUser>[0][]>`SELECT * FROM users WHERE id=${provided.id} FOR UPDATE`
  )[0];
  if (!locked) throw Error('Пользователь не найден.');
  const user = toUser(locked);
  if (
    action.requestId &&
    (await db.mutationReceipt.findUnique({
      where: { user_id_request_id: { user_id: user.id, request_id: action.requestId } },
    }))
  )
    return stateFor(db, user);
  if (action.type === 'organization.save')
    await db.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(421902)) AS lock`;
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
    const record = (await db.$queryRaw<RecordRow[]>`SELECT * FROM records WHERE id=${p.id} FOR UPDATE`)[0];
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
    const meter = await db.record.findFirst({ where: { id: action.payload.meterId, kind: 'meter' } });
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
    const rows = await db.record.findMany({
      where: { owner_id: user.id, kind: { in: ['reading', 'meter'] } },
    });
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
        await db.record.upsert({
          where: { id: item.id },
          create: { id: item.id, kind, owner_id: user.id, organization_id: organizationId, data: json(item) },
          update: { data: json(item), organization_id: organizationId, updated_at: new Date() },
        });
        await db.auditLog.create({
          data: {
            actor_id: user.id,
            action: action.type,
            record_id: item.id,
            details: json({
              version: 'version' in item ? item.version : undefined,
              requestId: action.requestId,
            }),
          },
        });
        if (kind === 'report' && action.type === 'report.status') {
          const rep = item as unknown as { id: string; title: string; status: string; version?: number },
            owner = (await db.record.findUnique({ where: { id: rep.id }, select: { owner_id: true } }))
              ?.owner_id;
          if (owner)
            await db.notificationOutbox.createMany({
              data: [
                {
                  user_id: owner,
                  dedupe_key: `${rep.id}:v${rep.version || 1}:${owner}`,
                  text: `DniesterCity: жалоба «${rep.title}» — ${rep.status}`,
                },
              ],
              skipDuplicates: true,
            });
        }
        if (kind === 'event' && (item as CityEvent).status !== 'Черновик')
          await notifyEvent(db, item as CityEvent);
      }
  }
  if (action.type === 'organization.save') {
    const old = new Map(before.organizations.map((o) => [o.id, JSON.stringify(o)]));
    for (const o of after.organizations)
      if (old.get(o.id) !== JSON.stringify(o)) {
        const fields = {
          name: o.name,
          categories: json(o.categories),
          addresses: json(o.addresses),
          connected: o.connected,
          source_url: o.sourceUrl || '',
        };
        await db.organization.upsert({ where: { id: o.id }, create: { id: o.id, ...fields }, update: fields });
        await db.auditLog.create({ data: { actor_id: user.id, action: action.type, record_id: o.id } });
      }
  }
  if (action.type === 'notices.read')
    await db.notificationOutbox.updateMany({ where: { user_id: user.id }, data: { read: true } });
  if (['address.add', 'address.select', 'subscriptions'].includes(action.type)) {
    // Never persist an organization's derived service area as a user's private subscriptions.
    const personalAddresses =
      action.type === 'address.add'
        ? [...user.prefs.addresses, action.payload.address]
        : user.prefs.addresses;
    await db.user.update({
      where: { id: user.id },
      data: {
        prefs: json({
          addresses: personalAddresses,
          activeAddress: after.activeAddress,
          subscriptions: after.subscriptions,
          subscriptionsByAddress: after.subscriptionsByAddress || {},
        }),
      },
    });
  }
  if (action.requestId)
    await db.mutationReceipt.create({ data: { user_id: user.id, request_id: action.requestId } });
  return stateFor(db, toUser(await db.user.findUniqueOrThrow({ where: { id: user.id } })));
}
async function notifyEvent(db: Db, event: CityEvent) {
  const users = await db.$queryRaw<
    { id: string; prefs: User['prefs'] }[]
  >`SELECT id,prefs FROM users WHERE prefs->'addresses' ?| ${event.addresses}::text[]`;
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
    await db.notificationOutbox.createMany({
      data: [{ user_id: u.id, dedupe_key: `${event.id}:v${event.version || 1}:${u.id}`, text }],
      skipDuplicates: true,
    });
  }
}
