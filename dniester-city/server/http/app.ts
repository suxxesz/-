import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { PrismaClient } from '../infrastructure/db';
import { registerErrorHandler } from './plugins/errors';
import { publicRoutes } from './routes/public.routes';
import { cabinetRoutes } from './routes/cabinet.routes';

export type AppOptions = {
  prisma: PrismaClient;
  sessionSecret: string;
  botToken: string;
  adminIds: string[];
  staticDirectory?: string;
  integrationKey?: string;
  /** Режим webhook бота (бесплатный Render): секрет из setWebhook и обработчик обновления. */
  telegramWebhook?: { secret: string; onUpdate: (update: unknown) => Promise<void> };
  logger?: boolean;
};

/** Сборка HTTP-приложения. Зависимости приходят снаружи — так его и тестируют. */
export async function buildApp(options: AppOptions) {
  if (options.sessionSecret.length < 32)
    throw Error('SESSION_SECRET должен содержать минимум 32 символа.');
  const app = Fastify({
    bodyLimit: 32 * 1024,
    logger: options.logger ? { level: 'info', redact: ['req.headers.authorization'] } : false,
    trustProxy: (_addr: string, hop: number) => hop < 1,
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  // CSP выключен: Mini App грузит скрипт Telegram и тайлы карты; остальные заголовки helmet — включены.
  await app.register(helmet, { contentSecurityPolicy: false, crossOriginEmbedderPolicy: false });

  await app.register(
    async (api) => {
      await api.register(rateLimit, {
        max: 120,
        timeWindow: 60_000,
        errorResponseBuilder: () => ({
          statusCode: 429,
          error: 'Слишком много запросов. Повторите через минуту.',
          message: 'Слишком много запросов. Повторите через минуту.',
        }),
      });
      api.addHook('onSend', async (_req, reply) => {
        if (!reply.hasHeader('Cache-Control')) reply.header('Cache-Control', 'no-store');
      });
      await api.register(publicRoutes(options));
      await api.register(cabinetRoutes(options));
      api.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: 'Метод не найден.' }));
    },
    { prefix: '/api' },
  );

  const root = options.staticDirectory && resolve(options.staticDirectory);
  if (root && existsSync(root)) {
    await app.register(fastifyStatic, { root, wildcard: false });
    // SPA: любой не-API путь отдаёт index.html, маршрутизирует клиент.
    app.setNotFoundHandler((req, reply) =>
      req.method === 'GET' ? reply.sendFile('index.html') : reply.code(404).send(),
    );
  }
  return app;
}
