import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { categories } from '../src/entities/city/model/types';
import { fileName, uploadDir } from './files';
import { resolve } from 'node:path';
import { Prisma, isUniqueViolation, type Db, type PrismaClient } from './db';
import { verifyTelegram, readSession, signSession } from './auth';
import { emptyPrefs, stateFor, mutate, toUser, type User } from './store';
import { parseAction } from '../src/entities/city/model/contracts';
import { applyAction } from '../src/entities/city/model/actions';
export type AppOptions = {
  prisma: PrismaClient;
  sessionSecret: string;
  botToken: string;
  adminIds: string[];
  staticDirectory?: string;
  integrationKey?: string;
};
export function createApp(options: AppOptions) {
  const { prisma, sessionSecret: secret } = options;
  if (secret.length < 32) throw Error('SESSION_SECRET должен содержать минимум 32 символа.');
  const app = express();
  app.disable('x-powered-by');
  app.use('/api/action', express.json({ limit: '6mb' }));
  app.use(express.json({ limit: '32kb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  const buckets = new Map<string, { n: number; at: number }>();
  let requests = 0;
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const key = req.ip || 'unknown',
      now = Date.now();
    if (++requests % 128 === 0)
      for (const [k, v] of buckets) if (now - v.at > 60000) buckets.delete(k);
    let b = buckets.get(key);
    if (!b || now - b.at > 60000) {
      b = { n: 0, at: now };
      buckets.set(key, b);
    }
    if (++b.n > 120) {
      res.status(429).json({ error: 'Слишком много запросов. Повторите через минуту.' });
      return;
    }
    next();
  });
  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });
  app.post('/api/auth/telegram', async (req, res) => {
    try {
      if (typeof req.body?.initData !== 'string') throw Error('Нужны данные Telegram.');
      const tg = verifyTelegram(req.body.initData, options.botToken),
        admin = options.adminIds.includes(String(tg.id));
      const user = await prisma.user.upsert({
        where: { telegram_id: BigInt(tg.id) },
        create: {
          id: `tg-${tg.id}`,
          telegram_id: BigInt(tg.id),
          name: tg.first_name || 'Житель',
          role: admin ? 'admin' : 'resident',
          prefs: emptyPrefs(),
        },
        update: { name: tg.first_name || 'Житель' },
      });
      res.json({ token: signSession(user.id, secret), role: user.role });
    } catch {
      res
        .status(401)
        .json({ error: 'Не удалось подтвердить вход. Откройте приложение заново через Telegram.' });
    }
  });
  app.use('/api', async (req, res, next) => {
    try {
      const id = readSession((req.headers.authorization || '').replace(/^Bearer /, ''), secret),
        row = await prisma.user.findUnique({ where: { id } });
      if (!row) throw Error('Пользователь не найден.');
      res.locals.user = toUser(row);
      next();
    } catch {
      res.status(401).json({ error: 'Требуется вход через Telegram.' });
    }
  });
  const withDb =
    (handler: (db: Db, req: express.Request, res: express.Response) => Promise<void>) =>
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        await handler(prisma, req, res);
      } catch (e) {
        next(e);
      }
    };
  const outages = z
    .object({
      organizationId: z.string().min(1).max(100),
      items: z
        .array(
          z.object({
            externalId: z.string().min(1).max(120),
            category: z.enum(categories),
            title: z.string().min(1).max(160),
            description: z.string().min(1).max(2000),
            addresses: z.array(z.string().min(1).max(180)).min(1).max(100),
            start: z.string().min(1).max(40),
            end: z.string().max(40).optional(),
            sourceUrl: z.url().startsWith('https://').optional(),
          }),
        )
        .min(1)
        .max(200),
    })
    .strict();
  // Поставщики передают отключения через API: записи попадают в черновики и публикуются диспетчером.
  app.post('/api/integrations/outages', async (req, res) => {
    const digest = (v: string) => createHash('sha256').update(v).digest(),
      key = String(req.header('x-api-key') || '');
    if (!options.integrationKey) {
      res.status(503).json({ error: 'Интеграция не настроена.' });
      return;
    }
    if (!timingSafeEqual(digest(key), digest(options.integrationKey))) {
      res.status(401).json({ error: 'Неверный ключ API.' });
      return;
    }
    const parsed = outages.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Проверьте данные.' });
      return;
    }
    const { organizationId, items } = parsed.data,
      org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
    if (!org) {
      res.status(404).json({ error: 'Организация не найдена.' });
      return;
    }
    const now = new Date().toISOString();
    let created = 0;
    for (const i of items) {
      const id = `ext-${organizationId}-${i.externalId}`,
        data = {
          id, category: i.category, title: i.title, description: i.description,
          addresses: i.addresses, start: i.start, end: i.end || '', status: 'Черновик',
          source: org.name, sourceUrl: i.sourceUrl, updated: now, version: 1,
          history: [`${now} · Черновик получен по API организации`],
        },
        r = await prisma.record.createMany({
          data: [{ id, kind: 'event', owner_id: null, organization_id: organizationId, data: JSON.parse(JSON.stringify(data)) }],
          skipDuplicates: true,
        });
      created += r.count;
    }
    res.json({ created, duplicates: items.length - created });
  });
  app.get('/api/files/:name', (req, res) => {
    if (!fileName.test(req.params.name)) {
      res.status(404).end();
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(req.params.name, { root: uploadDir }, (e) => e && !res.headersSent && res.status(404).end());
  });
  app.get(
    '/api/state',
    withDb(async (db, _req, res) => {
      res.json(await stateFor(db, res.locals.user));
    }),
  );
  app.post(
    '/api/action',
    withDb(async (_db, req, res) => {
      try {
        // Вся мутация — одна транзакция: при любой ошибке Prisma откатывает её целиком.
        const result = await prisma.$transaction((tx) => mutate(tx, res.locals.user as User, req.body), {
          timeout: 15_000,
        });
        res.json(result);
      } catch (e) {
        if (isUniqueViolation(e)) {
          res.status(409).json({ error: 'Эта запись уже существует. Обновите данные.' });
          return;
        }
        // Сбои базы — в общий обработчик (503); ошибки бизнес-правил — 400 с текстом.
        if (
          e instanceof Prisma.PrismaClientKnownRequestError ||
          e instanceof Prisma.PrismaClientUnknownRequestError ||
          e instanceof Prisma.PrismaClientInitializationError ||
          e instanceof Prisma.PrismaClientRustPanicError
        )
          throw e;
        res.status(400).json({ error: (e as Error).message });
      }
    }),
  );
  app.post(
    '/api/publication-preview',
    withDb(async (db, req, res) => {
      const user = res.locals.user as User,
        action = parseAction(req.body);
      if (action.type !== 'event.create') {
        res.status(400).json({ error: 'Нужны параметры события.' });
        return;
      }
      if (user.role === 'resident') {
        res.status(403).json({ error: 'Необходимы права диспетчера.' });
        return;
      }
      const state = await stateFor(db, user),
        p = action.payload,
        org = state.organizations.find((o) => o.id === user.organization_id);
      if (
        user.role === 'dispatcher' &&
        (!org ||
          !org.categories.includes(p.category) ||
          p.addresses.some((a) => !org.addresses.includes(a)))
      ) {
        res.status(403).json({ error: 'Адрес вне зоны ответственности.' });
        return;
      }
      try {
        applyAction(state, action, user.role);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
        return;
      }
      const rows = await db.$queryRaw<
        { prefs: User['prefs'] }[]
      >`SELECT prefs FROM users WHERE prefs->'addresses' ?| ${p.addresses}::text[]`;
      const recipientCount = rows.filter((u) =>
        u.prefs.addresses.some(
          (a: string) =>
            p.addresses.includes(a) &&
            (u.prefs.subscriptionsByAddress?.[a] || u.prefs.subscriptions).includes(p.category),
        ),
      ).length;
      res.json({ recipientCount });
    }),
  );
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Метод не найден.' });
  });
  if (options.staticDirectory) {
    app.use(express.static(resolve(options.staticDirectory)));
    app.get('/{*path}', (_req, res) => {
      res.sendFile(resolve(options.staticDirectory!, 'index.html'));
    });
  }
  app.use(
    (
      err: Error & { status?: number; code?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status = err.status === 413 ? 413 : err.status === 400 ? 400 : 503;
      res.status(status).json({
        error:
          status === 413
            ? 'Слишком большой запрос.'
            : status === 400
              ? 'Некорректный JSON.'
              : 'Сервис временно недоступен. Повторите позже.',
      });
    },
  );
  return app;
}
