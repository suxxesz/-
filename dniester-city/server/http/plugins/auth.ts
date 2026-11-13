import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient } from '../../infrastructure/db';
import { userRepository, type User } from '../../repositories/user.repository';
import { readSession } from '../../services/session.service';

declare module 'fastify' {
  interface FastifyRequest {
    user: User;
  }
}

/**
 * Хук проверки сессии для закрытой части API. Роль читается из базы на каждый запрос,
 * поэтому снятие прав диспетчера действует сразу, без ожидания истечения токена.
 */
export function requireUser(app: FastifyInstance, prisma: PrismaClient, secret: string) {
  app.decorateRequest('user', null as unknown as User);
  app.addHook('onRequest', async (req: FastifyRequest, reply) => {
    try {
      const id = readSession((req.headers.authorization || '').replace(/^Bearer /, ''), secret);
      const user = await userRepository.findById(prisma, id);
      if (!user) throw Error('Пользователь не найден.');
      req.user = user;
    } catch {
      return reply.code(401).send({ error: 'Требуется вход через Telegram.' });
    }
  });
}
