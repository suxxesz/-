import type { Db } from '../infrastructure/db';
import { persistMedia } from '../infrastructure/files';
import type { State, CityEvent } from '../../src/entities/city/model/types';
import { applyAction } from '../../src/entities/city/model/actions';
import { parseAction, type Action } from '../../src/entities/city/model/contracts';
import { userRepository, type User } from '../repositories/user.repository';
import { organizationRepository } from '../repositories/organization.repository';
import { recordRepository, type RecordKind } from '../repositories/record.repository';
import { auditRepository, outboxRepository } from '../repositories/outbox.repository';
import { canManage, canPublish } from './access.policy';
import { notifyEvent, notifyReportStatus } from './notification.service';
import { stateFor } from './state.service';

/** Действия над существующей записью: перед ними запись блокируется и проверяется доступ. */
const recordActions = [
  'ticket.status',
  'report.status',
  'ticket.reopen',
  'event.update',
  'event.publish',
  'schedule.save',
];
const kindOf = (type: string): RecordKind =>
  type.startsWith('ticket.')
    ? 'ticket'
    : type.startsWith('report.')
      ? 'report'
      : type.startsWith('event.')
        ? 'event'
        : 'schedule';
const fieldKinds = [
  ['events', 'event'],
  ['tickets', 'ticket'],
  ['reports', 'report'],
  ['readings', 'reading'],
  ['meters', 'meter'],
  ['schedules', 'schedule'],
] as const;

/**
 * Одно действие жителя или сотрудника. Вызывается внутри транзакции:
 * правила предметной области — в applyAction (общие с клиентом), здесь — доступ и запись в базу.
 */
export async function mutate(db: Db, provided: User, raw: Action | unknown) {
  const action = parseAction(raw);
  const user = await userRepository.lockById(db, provided.id);
  if (!user) throw Error('Пользователь не найден.');
  if (
    action.requestId &&
    (await db.mutationReceipt.findUnique({
      where: { user_id_request_id: { user_id: user.id, request_id: action.requestId } },
    }))
  )
    return stateFor(db, user);
  if (action.type === 'organization.save') await organizationRepository.lockZones(db);
  const organizations = await organizationRepository.visibleTo(db, user),
    org = organizations.find((o) => o.id === user.organization_id);
  const p = action.payload;
  if ('id' in p && p.id && recordActions.includes(action.type)) {
    const record = await recordRepository.lock(db, p.id);
    if (!record || record.kind !== kindOf(action.type)) throw Error('Запись не найдена.');
    if (action.type === 'ticket.reopen') {
      if (record.owner_id !== user.id) throw Error('Нет доступа к заявке.');
    } else if (record.kind !== 'report' && !canManage(user, org, record))
      throw Error('Нет доступа к организации или адресу.');
  }
  if (action.type === 'event.create' || action.type === 'schedule.save') {
    const values = action.payload,
      addresses = 'addresses' in values ? values.addresses : [values.address];
    if (!canPublish(user, org, values.category, addresses))
      throw Error('Событие вне зоны вашей ответственности.');
    if (org) values.source = org.name;
  }
  if (action.type === 'reading.create' && action.payload.meterId) {
    const meter = await recordRepository.findMeter(db, action.payload.meterId);
    if (!meter || meter.owner_id !== user.id) throw Error('Нет доступа к счётчику.');
  }
  const before = await stateFor(db, user);
  // Сотрудник видит чужие показания, но новое личное показание сверяется только с его историей.
  let domainState = before;
  if (action.type === 'address.add')
    domainState = {
      ...before,
      addresses: user.prefs.addresses,
      activeAddress: user.prefs.activeAddress,
    };
  if (['reading.create', 'meter.create'].includes(action.type)) {
    const rows = await recordRepository.personalMeterData(db, user.id);
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
  for (const [field, kind] of fieldKinds) {
    const old = new Map(
      ((domainState[field] ?? []) as { id: string }[]).map((x) => [x.id, JSON.stringify(x)]),
    );
    for (const item of (after[field] ?? []) as (CityEvent & { address: string })[]) {
      if (old.get(item.id) === JSON.stringify(item)) continue;
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
      await recordRepository.save(db, {
        id: item.id,
        kind,
        ownerId: user.id,
        organizationId: kind === 'event' && org ? org.id : matches[0]?.id || null,
        data: item,
      });
      await auditRepository.write(db, user.id, action.type, item.id, {
        version: 'version' in item ? item.version : undefined,
        requestId: action.requestId,
      });
      if (kind === 'report' && action.type === 'report.status')
        await notifyReportStatus(db, item as unknown as { id: string; title: string; status: string });
      if (kind === 'event' && (item as CityEvent).status !== 'Черновик')
        await notifyEvent(db, item as CityEvent);
    }
  }
  if (action.type === 'organization.save') {
    const old = new Map(before.organizations.map((o) => [o.id, JSON.stringify(o)]));
    for (const o of after.organizations)
      if (old.get(o.id) !== JSON.stringify(o)) {
        await organizationRepository.save(db, o);
        await auditRepository.write(db, user.id, action.type, o.id);
      }
  }
  if (action.type === 'notices.read') await outboxRepository.markAllRead(db, user.id);
  if (['address.add', 'address.select', 'subscriptions'].includes(action.type))
    // Зону обслуживания организации не сохраняем как личные адреса сотрудника.
    await userRepository.savePrefs(db, user.id, {
      addresses:
        action.type === 'address.add'
          ? [...user.prefs.addresses, action.payload.address]
          : user.prefs.addresses,
      activeAddress: after.activeAddress,
      subscriptions: after.subscriptions,
      subscriptionsByAddress: after.subscriptionsByAddress || {},
    });
  if (action.requestId)
    await db.mutationReceipt.create({ data: { user_id: user.id, request_id: action.requestId } });
  return stateFor(db, (await userRepository.findById(db, user.id))!);
}
