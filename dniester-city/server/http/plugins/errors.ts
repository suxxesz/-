import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { ZodError } from 'zod';
import { Prisma, isUniqueViolation } from '../../infrastructure/db';
import { NotFoundError } from '../../services/integration.service';
import { ForbiddenError } from '../../services/publication.service';

/** Ошибка бизнес-правила: текст можно показать жителю как есть. */
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const dbFailure = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError ||
  e instanceof Prisma.PrismaClientUnknownRequestError ||
  e instanceof Prisma.PrismaClientInitializationError ||
  e instanceof Prisma.PrismaClientRustPanicError;

/** Один обработчик ошибок для всего API: понятный текст жителю, детали — только в лог. */
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler<FastifyError>((err, req, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      const first = err.validation[0];
      return reply.code(400).send({ error: first?.message || 'Проверьте данные.' });
    }
    if (err instanceof ZodError)
      return reply.code(400).send({ error: err.issues[0]?.message || 'Проверьте данные.' });
    if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message });
    if (err instanceof ForbiddenError) return reply.code(403).send({ error: err.message });
    if (err instanceof DomainError) return reply.code(err.status).send({ error: err.message });
    if (isUniqueViolation(err))
      return reply.code(409).send({ error: 'Эта запись уже существует. Обновите данные.' });
    if (err.statusCode === 413) return reply.code(413).send({ error: 'Слишком большой запрос.' });
    if (err.code === 'FST_ERR_CTP_INVALID_JSON_BODY' || err.code === 'FST_ERR_CTP_EMPTY_JSON_BODY')
      return reply.code(400).send({ error: 'Некорректный JSON.' });
    if (err.statusCode === 429) return reply.code(429).send({ error: err.message });
    // Ошибки бизнес-правил из applyAction — обычные Error с русским текстом.
    if (!dbFailure(err) && !err.statusCode && err.constructor === Error)
      return reply.code(400).send({ error: err.message });
    req.log.error(err);
    return reply.code(503).send({ error: 'Сервис временно недоступен. Повторите позже.' });
  });
}
