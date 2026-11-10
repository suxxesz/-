import 'dotenv/config';
import { createHash } from 'node:crypto';
import { createPrisma } from './db';
import { createApp } from './app';
import { createTelegramClient } from './telegram';
import { handleUpdate, runOutbox } from './bot-core';
if (!process.env.DATABASE_URL) throw Error('Укажите DATABASE_URL.');
const prisma = createPrisma();
let running = true;

// BOT_MODE=webhook — бот живёт внутри API (бесплатный Render без фоновых воркеров).
// По умолчанию бот — отдельный процесс `npm run bot` (long polling).
const token = process.env.BOT_TOKEN || '',
  miniApp = process.env.MINI_APP_URL || '',
  publicUrl = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, ''),
  webhook =
    process.env.BOT_MODE === 'webhook' &&
    token &&
    miniApp.startsWith('https://') &&
    publicUrl.startsWith('https://');
const telegram = webhook ? createTelegramClient(token) : undefined;
// Секрет webhook выводится из токена: стабилен между перезапусками и не хранится отдельно.
const secret = createHash('sha256').update(`webhook:${token}`).digest('hex');

const app = createApp({
  prisma,
  sessionSecret: process.env.SESSION_SECRET || '',
  botToken: token,
  adminIds: (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map((x) => x.trim()),
  staticDirectory: 'dist',
  integrationKey: process.env.INTEGRATION_API_KEY || '',
  telegramWebhook: telegram
    ? { secret, onUpdate: (u) => handleUpdate(telegram, u, miniApp) }
    : undefined,
});
const port = Number(process.env.PORT || 3001),
  host = process.env.HOST || '127.0.0.1',
  server = app.listen(port, host, () => console.log(`DniesterCity API: http://${host}:${port}`));

if (telegram) {
  telegram('setWebhook', {
    url: `${publicUrl}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: false,
  })
    .then(() =>
      console.log('Бот: webhook установлен, очередь уведомлений работает в этом процессе.'),
    )
    .catch(() =>
      console.error('Бот: не удалось установить webhook — проверьте BOT_TOKEN и PUBLIC_URL.'),
    );
  void runOutbox(prisma, telegram, () => running);
}

function shutdown() {
  running = false;
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
