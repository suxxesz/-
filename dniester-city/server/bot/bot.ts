import { Markup, Telegraf } from 'telegraf';

const WELCOME =
  'Мой город — коммунальные услуги вашего дома.\n\n' +
  '• узнавайте об отключениях воды, света и газа заранее;\n' +
  '• передавайте показания счётчиков;\n' +
  '• оставляйте заявки и следите за их статусом.\n\n' +
  'Откройте приложение и выберите адрес — уведомления будут приходить сюда.';

const HELP =
  'Команды:\n/start — открыть «Мой город»\n/help — эта подсказка\n\n' +
  'Уведомления по вашему адресу бот присылает сам. Настроить услуги можно в приложении → Настройки.';

/** Бот на Telegraf: только приватные чаты, кнопка Mini App и подсказка. */
export function createBot(token: string, miniAppUrl: string) {
  const bot = new Telegraf(token);
  const open = Markup.inlineKeyboard([Markup.button.webApp('Открыть «Мой город»', miniAppUrl)]);
  bot.use(async (ctx, next) => {
    if (ctx.chat?.type === 'private' && !ctx.from?.is_bot) await next();
  });
  bot.start((ctx) => ctx.reply(WELCOME, open));
  bot.help((ctx) => ctx.reply(HELP, open));
  bot.catch((e) => console.error('Бот: ошибка обработки обновления.', (e as Error).message));
  return bot;
}
export type CityBot = ReturnType<typeof createBot>;

/** Отправитель для очереди уведомлений. */
export const botSender = (bot: CityBot) => (chatId: string, text: string) =>
  bot.telegram.sendMessage(chatId, text);
