import type { Db } from '../infrastructure/db';
import type { Category, CityEvent } from '../../src/entities/city/model/types';
import { userRepository, type User } from '../repositories/user.repository';
import { outboxRepository } from '../repositories/outbox.repository';
import { recordRepository } from '../repositories/record.repository';

/** Подписан ли житель на услугу хотя бы по одному из адресов события. */
const subscribed = (prefs: User['prefs'], addresses: string[], category: Category) =>
  prefs.addresses.some(
    (a) =>
      addresses.includes(a) &&
      (prefs.subscriptionsByAddress?.[a] || prefs.subscriptions).includes(category),
  );

export async function recipientsOf(db: Db, addresses: string[], category: Category) {
  const users = await userRepository.withAnyAddress(db, addresses);
  return users.filter((u) => subscribed(u.prefs, addresses, category));
}

export async function notifyEvent(db: Db, event: CityEvent) {
  const text = `DniesterCity: ${event.title}\n${event.status}\n${event.addresses.join('; ')}\nНачало: ${event.start}\nОкончание: ${event.end || 'срок неизвестен'}\n${event.description}\nИсточник: ${event.source}`;
  for (const u of await recipientsOf(db, event.addresses, event.category))
    await outboxRepository.enqueue(db, u.id, `${event.id}:v${event.version || 1}:${u.id}`, text);
}

export async function notifyReportStatus(
  db: Db,
  report: { id: string; title: string; status: string; version?: number },
) {
  const owner = await recordRepository.ownerOf(db, report.id);
  if (owner)
    await outboxRepository.enqueue(
      db,
      owner,
      `${report.id}:v${report.version || 1}:${owner}`,
      `DniesterCity: жалоба «${report.title}» — ${report.status}`,
    );
}
