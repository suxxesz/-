import { createHash } from 'node:crypto';
import type { Update } from 'telegraf/types';
import { loadEnv } from './config/env';
import { createPrisma } from './infrastructure/db';
import { buildApp } from './http/app';
import { botSender, createBot } from './bot/bot';
import { runOutbox } from './bot/outbox.worker';

// Корень композиции API: читает окружение, собирает зависимости и запускает сервер.
const env = loadEnv();
const prisma = createPrisma(env.DATABASE_URL);
let running = true;

// BOT_MODE=webhook — бот живёт внутри API (бесплатный Render без фоновых воркеров).
// По умолчанию бот — отдельный процесс `npm run bot` (long polling).
const publicUrl = (env.PUBLIC_URL || env.RENDER_EXTERNAL_URL).replace(/\/$/, '');
const webhook =
  env.BOT_MODE === 'webhook' &&
  env.BOT_TOKEN &&
  env.MINI_APP_URL.startsWith('https://') &&
  publicUrl.startsWith('https://');
const bot = webhook ? createBot(env.BOT_TOKEN, env.MINI_APP_URL) : undefined;
// Секрет webhook выводится из токена: стабилен между перезапусками и не хранится отдельно.
const secret = createHash('sha256').update(`webhook:${env.BOT_TOKEN}`).digest('hex');

const app = await buildApp({
  prisma,
  sessionSecret: env.SESSION_SECRET,
  botToken: env.BOT_TOKEN,
  adminIds: env.ADMIN_TELEGRAM_IDS,
  staticDirectory: env.STATIC_DIR,
  integrationKey: env.INTEGRATION_API_KEY,
  logger: env.NODE_ENV === 'production',
  telegramWebhook: bot
    ? { secret, onUpdate: (u) => bot.handleUpdate(u as Update) }
    : undefined,
});
await app.listen({ port: env.PORT, host: env.HOST });
console.log(`DniesterCity API: http://${env.HOST}:${env.PORT}`);

if (bot) {
  bot.telegram
    .setWebhook(`${publicUrl}/api/telegram/webhook`, {
      secret_token: secret,
      allowed_updates: ['message'],
    })
    .then(() => console.log('Бот: webhook установлен, очередь уведомлений работает в этом процессе.'))
    .catch(() => console.error('Бот: не удалось установить webhook — проверьте BOT_TOKEN и PUBLIC_URL.'));
  void runOutbox(prisma, botSender(bot), () => running);
}

async function shutdown() {
  running = false;
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
