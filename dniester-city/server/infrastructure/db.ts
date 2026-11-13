import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../generated/prisma/client';

export { Prisma, PrismaClient };
/** Клиент или транзакция — всё, через что сервер ходит в базу. */
export type Db = PrismaClient | Prisma.TransactionClient;

/** Prisma поверх node-postgres. Схему меняет только `prisma migrate deploy`, не код сервера. */
export const createPrisma = (connectionString = process.env.DATABASE_URL) =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 10 }) });

/** Нарушение уникальности: P2002 у моделей, 23505 у сырых запросов внутри Prisma. */
export function isUniqueViolation(e: unknown) {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code === 'P2002') return true;
  const meta = e.meta as
    | { code?: string; driverAdapterError?: { cause?: { originalCode?: string; kind?: string } } }
    | undefined;
  return (
    meta?.code === '23505' ||
    meta?.driverAdapterError?.cause?.originalCode === '23505' ||
    meta?.driverAdapterError?.cause?.kind === 'UniqueConstraintViolation'
  );
}
