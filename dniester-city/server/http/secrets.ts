import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (v: string) => createHash('sha256').update(v).digest();

/** Сравнение секретов за постоянное время, без утечки длины. */
export const safeEqual = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));
