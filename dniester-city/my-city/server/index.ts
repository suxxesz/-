import 'dotenv/config';
import { pool } from './db';
import { createApp } from './app';
if (!process.env.DATABASE_URL) throw Error('Укажите DATABASE_URL.');
const app = createApp({
  pool,
  sessionSecret: process.env.SESSION_SECRET || '',
  botToken: process.env.BOT_TOKEN || '',
  adminIds: (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map((x) => x.trim()),
  staticDirectory: 'dist',
  integrationKey: process.env.INTEGRATION_API_KEY || '',
});
const port = Number(process.env.PORT || 3001),
  host = process.env.HOST || '127.0.0.1',
  server = app.listen(port, host, () => console.log(`DniesterCity API: http://${host}:${port}`));
function shutdown() {
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
