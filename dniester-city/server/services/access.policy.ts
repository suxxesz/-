import type { Category, Organization } from '../../src/entities/city/model/types';
import type { User } from '../repositories/user.repository';

/** Может ли сотрудник менять запись: админ — всё, диспетчер — только в своей зоне. */
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

/** Диспетчер публикует только по своим услугам и адресам; житель — никогда. */
export function canPublish(
  user: User,
  organization: Organization | undefined,
  category: Category,
  addresses: string[],
) {
  if (user.role === 'admin') return true;
  return (
    user.role === 'dispatcher' &&
    !!organization &&
    organization.categories.includes(category) &&
    addresses.every((a) => organization.addresses.includes(a))
  );
}
