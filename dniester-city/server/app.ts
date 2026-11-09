import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { categories } from '../src/entities/city/model/types';
import { fileName, uploadDir } from './files';
import { resolve } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import { verifyTelegram, readSession, signSession } from './auth';
import { emptyPrefs, stateFor, mutate, type User } from './store';
import { parseAction } from '../src/entities/city/model/contracts';
import { applyAction } from '../src/entities/city/model/actions';
export type AppOptions = {
  pool: Pick<Pool, 'query' | 'connect'>;
  sessionSecret: string;
  botToken: string;
  adminIds: string[];
  staticDirectory?: string;
  integrationKey?: string;
};
export function createApp(options: AppOptions) {
  const { pool, sessionSecret: secret } = options;
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
      await pool.query('SELECT 1');
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
      const { rows } = await pool.query(
        'INSERT INTO users(id,telegram_id,name,role,prefs) VALUES($1,$2,$3,$4,$5) ON CONFLICT(telegram_id) DO UPDATE SET name=EXCLUDED.name RETURNING *',
        [
          `tg-${tg.id}`,
          tg.id,
          tg.first_name || 'Житель',
          admin ? 'admin' : 'resident',
          JSON.stringify(emptyPrefs()),
        ],
      );
      res.json({ token: signSession(rows[0].id, secret), role: rows[0].role });
    } catch {
      res
        .status(401)
        .json({ error: 'Не удалось подтвердить вход. Откройте приложение заново через Telegram.' });
    }
  });
  app.use('/api', async (req, res, next) => {
    try {
      const id = readSession((req.headers.authorization || '').replace(/^Bearer /, ''), secret),
        user = (await pool.query('SELECT * FROM users WHERE id=$1', [id])).rows[0];
      if (!user) throw Error('Пользователь не найден.');
      res.locals.user = user;
      next();
    } catch {
      res.status(401).json({ error: 'Требуется вход через Telegram.' });
    }
  });
  const withDb =
    (handler: (db: PoolClient, req: express.Request, res: express.Response) => Promise<void>) =>
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      let db: PoolClient | undefined;
      try {
        db = await pool.connect();
        await handler(db, req, res);
      } catch (e) {
        next(e);
      } finally {
        db?.release();
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
      org = (await pool.query('SELECT name FROM organizations WHERE id=$1', [organizationId])).rows[0];
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
        r = await pool.query(
          "INSERT INTO records(id,kind,owner_id,organization_id,data) VALUES($1,'event',NULL,$2,$3) ON CONFLICT(id) DO NOTHING",
          [id, organizationId, JSON.stringify(data)],
        );
      created += r.rowCount || 0;
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
    withDb(async (db, req, res) => {
      try {
        await db.query('BEGIN');
        const result = await mutate(db, res.locals.user as User, req.body);
        await db.query('COMMIT');
        res.json(result);
      } catch (e) {
        await db.query('ROLLBACK');
        const error = e as Error & { code?: string };
        if (error.code) {
          if (error.code === '23505') {
            res.status(409).json({ error: 'Эта запись уже существует. Обновите данные.' });
            return;
          }
          throw e;
        }
        res.status(400).json({ error: error.message });
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
      const { rows } = await db.query(
        "SELECT prefs FROM users WHERE prefs->'addresses' ?| $1::text[]",
        [p.addresses],
      );
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
