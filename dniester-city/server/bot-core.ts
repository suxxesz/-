import type { PrismaClient } from './db';
import { deliverOne } from './outbox';
import type { TelegramUpdate, createTelegramClient } from './telegram';

type Telegram = ReturnType<typeof createTelegramClient>;

/** Ответ на /start — общий для long polling (server/bot.ts) и webhook (server/index.ts). */
export async function handleUpdate(telegram: Telegram, update: TelegramUpdate, miniAppUrl: string) {
  const m = update.message;
  if (m?.chat.type === 'private' && !m.from?.is_bot && m.text?.startsWith('/start'))
    await telegram('sendMessage', {
      chat_id: m.chat.id,
      text: 'Мой город — коммунальные услуги вашего дома. Выберите адрес в приложении, чтобы подписаться на события, сохранить показания и обращения.',
      reply_markup: {
        inline_keyboard: [[{ text: 'Открыть «Мой город»', web_app: { url: miniAppUrl } }]],
      },
    });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Бесконечная доставка очереди уведомлений, пока `running()` возвращает true. */
export async function runOutbox(prisma: PrismaClient, telegram: Telegram, running: () => boolean) {
  while (running()) {
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
