import type { Prisma } from './db';

/** Значение → JSON для колонки jsonb (снимает undefined и классы). */
export const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
