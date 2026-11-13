import type { Db } from '../infrastructure/db';
import { organizationRepository } from '../repositories/organization.repository';
import { recordRepository } from '../repositories/record.repository';
import type { OutagesBody } from '../schemas/integration.schema';

export class NotFoundError extends Error {}

/** Отключения от поставщика → черновики; диспетчер проверяет и публикует их сам. */
export async function importOutages(db: Db, { organizationId, items }: OutagesBody) {
  const org = await organizationRepository.findName(db, organizationId);
  if (!org) throw new NotFoundError('Организация не найдена.');
  const now = new Date().toISOString();
  let created = 0;
  for (const i of items) {
    const id = `ext-${organizationId}-${i.externalId}`;
    created += await recordRepository.insertDraft(db, id, organizationId, {
      id,
      category: i.category,
      title: i.title,
      description: i.description,
      addresses: i.addresses,
      start: i.start,
      end: i.end || '',
      status: 'Черновик',
      source: org.name,
      sourceUrl: i.sourceUrl,
      updated: now,
      version: 1,
      history: [`${now} · Черновик получен по API организации`],
    });
  }
  return { created, duplicates: items.length - created };
}
