import type { Db } from '../infrastructure/db';
import type { Action } from '../../src/entities/city/model/contracts';
import { applyAction } from '../../src/entities/city/model/actions';
import type { User } from '../repositories/user.repository';
import { canPublish } from './access.policy';
import { recipientsOf } from './notification.service';
import { stateFor } from './state.service';

export class ForbiddenError extends Error {}

/** Сколько жителей получат уведомление, если опубликовать событие, — без записи в базу. */
export async function previewPublication(db: Db, user: User, action: Action) {
  if (action.type !== 'event.create') throw Error('Нужны параметры события.');
  if (user.role === 'resident') throw new ForbiddenError('Необходимы права диспетчера.');
  const state = await stateFor(db, user),
    p = action.payload,
    org = state.organizations.find((o) => o.id === user.organization_id);
  if (!canPublish(user, org, p.category, p.addresses))
    throw new ForbiddenError('Адрес вне зоны ответственности.');
  applyAction(state, action, user.role); // бросит понятную ошибку, если событие некорректно
  return { recipientCount: (await recipientsOf(db, p.addresses, p.category)).length };
}
