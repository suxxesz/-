import 'dotenv/config';
import { z } from 'zod';

/** Переменные окружения проверяются один раз при старте: опечатка в .env ломает запуск, а не запрос. */
const list = z
  .string()
  .default('')
  .transform((v) => v.split(',').map((x) => x.trim()).filter(Boolean));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'Укажите DATABASE_URL.'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET должен содержать минимум 32 символа.'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3001),
  BOT_TOKEN: z.string().default(''),
  /** polling — отдельный процесс `npm run bot`; webhook — бот внутри API (бесплатный Render). */
  BOT_MODE: z.enum(['polling', 'webhook']).default('polling'),
  MINI_APP_URL: z.string().default(''),
  PUBLIC_URL: z.string().default(''),
  RENDER_EXTERNAL_URL: z.string().default(''),
  ADMIN_TELEGRAM_IDS: list,
  INTEGRATION_API_KEY: z.string().default(''),
  UPLOAD_DIR: z.string().default('uploads'),
  STATIC_DIR: z.string().default('dist'),
});
export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) throw Error(parsed.error.issues.map((i) => i.message).join(' '));
  return parsed.data;
}
