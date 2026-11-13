import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { fileName, uploadDir } from '../../infrastructure/files';
import { telegramLoginBody } from '../../schemas/auth.schema';
import { fileParams } from '../../schemas/common';
import { outagesBody } from '../../schemas/integration.schema';
import { verifyTelegram, signSession } from '../../services/session.service';
import { importOutages } from '../../services/integration.service';
import { userRepository } from '../../repositories/user.repository';
import { safeEqual } from '../secrets';
import type { AppOptions } from '../app';

const mime: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

/** Открытые маршруты: здоровье, вход, webhook бота, интеграции поставщиков, файлы. */
export const publicRoutes =
  (options: AppOptions): FastifyPluginAsyncZod =>
  async (app) => {
    const { prisma } = options;

    app.get('/health', async (_req, reply) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return { ok: true };
      } catch {
        return reply.code(503).send({ ok: false });
      }
    });

    // Telegram шлёт обновления сюда в режиме webhook; запрос заодно будит уснувший сервис Render.
    app.post('/telegram/webhook', async (req, reply) => {
      const hook = options.telegramWebhook;
      if (!hook) return reply.code(404).send({ error: 'Метод не найден.' });
      if (!safeEqual(String(req.headers['x-telegram-bot-api-secret-token'] || ''), hook.secret))
        return reply.code(401).send();
      reply.send({ ok: true }); // отвечаем сразу, чтобы Telegram не повторял доставку
      await hook.onUpdate(req.body).catch(() => req.log.error('Не удалось ответить в Telegram.'));
    });

    app.post('/auth/telegram', { schema: { body: telegramLoginBody } }, async (req, reply) => {
      try {
        const tg = verifyTelegram(req.body.initData, options.botToken);
        const user = await userRepository.upsertFromTelegram(
          prisma,
          tg,
          options.adminIds.includes(String(tg.id)),
        );
        return { token: signSession(user.id, options.sessionSecret), role: user.role };
      } catch {
        return reply
          .code(401)
          .send({ error: 'Не удалось подтвердить вход. Откройте приложение заново через Telegram.' });
      }
    });

    // Поставщики передают отключения через API: записи попадают в черновики и публикуются диспетчером.
    app.post('/integrations/outages', async (req, reply) => {
      if (!options.integrationKey)
        return reply.code(503).send({ error: 'Интеграция не настроена.' });
      if (!safeEqual(String(req.headers['x-api-key'] || ''), options.integrationKey))
        return reply.code(401).send({ error: 'Неверный ключ API.' });
      // Ключ проверяем раньше тела — без ключа формат данных не раскрываем.
      return importOutages(prisma, outagesBody.parse(req.body));
    });

    app.get('/files/:name', { schema: { params: fileParams } }, async (req, reply) => {
      const name = req.params.name;
      if (!fileName.test(name)) return reply.code(404).send();
      const path = resolve(uploadDir, name);
      try {
        await stat(path);
      } catch {
        return reply.code(404).send();
      }
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      reply.type(mime[name.split('.').pop()!]);
      return reply.send(createReadStream(path));
    });
  };
