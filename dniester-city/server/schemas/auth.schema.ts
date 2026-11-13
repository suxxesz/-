import { z } from 'zod';

export const telegramLoginBody = z.object({ initData: z.string().min(1).max(4096) });
export const sessionResponse = z.object({ token: z.string(), role: z.string() });

/** Пользователь из подписанных initData Mini App. */
export const telegramUser = z.object({
  id: z.number().int().positive().refine(Number.isSafeInteger),
  first_name: z.string().max(256).optional(),
  last_name: z.string().max(256).optional(),
  username: z.string().max(64).optional(),
});
export type TelegramUser = z.infer<typeof telegramUser>;
