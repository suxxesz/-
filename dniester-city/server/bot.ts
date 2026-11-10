import 'dotenv/config';
import { createPrisma } from './db';
import { createTelegramClient, type TelegramUpdate } from './telegram';
import { deliverOne } from './outbox';
const token = process.env.BOT_TOKEN,
  url = process.env.MINI_APP_URL;
if (!token || !url?.startsWith('https://')) throw Error('Укажите BOT_TOKEN и HTTPS MINI_APP_URL.');
const telegram = createTelegramClient(token);
const prisma = createPrisma();
let running = true;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function poll() {
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
        const m = update.message;
        if (m?.chat.type === 'private' && !m.from?.is_bot && m.text?.startsWith('/start'))
          await telegram('sendMessage', {
            chat_id: m.chat.id,
            text: 'Мой город — коммунальные услуги вашего дома. Выберите адрес в приложении, чтобы подписаться на события, сохранить показания и обращения.',
            reply_markup: {
              inline_keyboard: [[{ text: 'Открыть «Мой город»', web_app: { url } }]],
            },
          });
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
async function outbox() {
  while (running) {
    try {
      const processed = await deliverOne(prisma, (chatId, text) =>
        telegram('sendMessage', { chat_id: chatId, text }),
      );
      await sleep(processed ? 300 : 1500);
    } catch {
      console.error('Очередь временно недоступна. Повтор через 5 секунд.');
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
await Promise.all([poll(), outbox()]);
await prisma.$disconnect();
