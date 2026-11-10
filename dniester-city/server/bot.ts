import 'dotenv/config';
import { createPrisma } from './db';
import { createTelegramClient, type TelegramUpdate } from './telegram';
import { handleUpdate, runOutbox } from './bot-core';
// Отдельный процесс бота (long polling) — для Docker/VPS. На бесплатном Render используется
// режим BOT_MODE=webhook внутри веб-сервиса, см. docs/DEPLOY-RENDER.md.
const token = process.env.BOT_TOKEN,
  url = process.env.MINI_APP_URL;
if (!token || !url?.startsWith('https://')) throw Error('Укажите BOT_TOKEN и HTTPS MINI_APP_URL.');
const telegram = createTelegramClient(token);
const prisma = createPrisma();
let running = true;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function poll() {
  // Webhook и getUpdates взаимоисключающие: снимаем webhook, если он остался от режима Render.
  await telegram('deleteWebhook', {}).catch(() => {});
  let offset = Number(
    (await prisma.botState.findUnique({ where: { key: 'telegram_offset' } }))?.value || 0,
  );
  while (running) {
    try {
      const updates = await telegram<TelegramUpdate[]>('getUpdates', {
        offset,
        timeout: 25,
        allowed_updates: ['message'],
      });
      for (const update of updates) {
        await handleUpdate(telegram, update, url!);
        offset = update.update_id + 1;
        await prisma.botState.upsert({
          where: { key: 'telegram_offset' },
          create: { key: 'telegram_offset', value: String(offset) },
          update: { value: String(offset) },
        });
      }
    } catch {
      console.error('Telegram или база недоступны. Повтор через 5 секунд.');
      await sleep(5000);
    }
  }
}
process.on('SIGTERM', () => {
  running = false;
});
process.on('SIGINT', () => {
  running = false;
});
await Promise.all([poll(), runOutbox(prisma, telegram, () => running)]);
await prisma.$disconnect();
