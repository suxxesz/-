import type { Db } from '../infrastructure/db';
import type { State } from '../../src/entities/city/model/types';
import type { User } from '../repositories/user.repository';
import { organizationRepository } from '../repositories/organization.repository';
import { recordRepository } from '../repositories/record.repository';
import { outboxRepository } from '../repositories/outbox.repository';
import { canManage } from './access.policy';

/** Состояние кабинета, которое видит конкретный пользователь. */
export async function stateFor(db: Db, user: User): Promise<State> {
  const organizations = await organizationRepository.visibleTo(db, user),
    org = organizations.find((o) => o.id === user.organization_id);
  const staff = user.role !== 'resident';
  const records = await recordRepository.candidatesFor(db, user);
  // Точный фильтр поверх выборки базы: чужие заявки и черновики не уходят клиенту.
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
    notices: await outboxRepository.latestFor(db, user.id),
  };
}
