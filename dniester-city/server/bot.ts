import { loadEnv } from './config/env';
import { createPrisma } from './infrastructure/db';
import { botSender, createBot } from './bot/bot';
import { runOutbox } from './bot/outbox.worker';

// Отдельный процесс бота (long polling, Telegraf) — для Docker/VPS. На бесплатном Render используется
// режим BOT_MODE=webhook внутри веб-сервиса, см. docs/DEPLOY-RENDER.md.
const env = loadEnv();
if (!env.BOT_TOKEN || !env.MINI_APP_URL.startsWith('https://'))
  throw Error('Укажите BOT_TOKEN и HTTPS MINI_APP_URL.');
const prisma = createPrisma(env.DATABASE_URL);
const bot = createBot(env.BOT_TOKEN, env.MINI_APP_URL);
let running = true;

function stop(signal: string) {
  running = false;
  bot.stop(signal);
}
process.once('SIGTERM', () => stop('SIGTERM'));
process.once('SIGINT', () => stop('SIGINT'));

// launch() сам снимает webhook, оставшийся от режима Render, и ведёт offset обновлений.
await Promise.all([
  bot.launch({ allowedUpdates: ['message'] }),
  runOutbox(prisma, botSender(bot), () => running),
]);
await prisma.$disconnect();
