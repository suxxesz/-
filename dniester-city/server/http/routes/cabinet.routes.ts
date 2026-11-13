import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { parseAction } from '../../../src/entities/city/model/contracts';
import { profileSchema } from '../../../src/entities/profile/model/schema';
import { stateFor } from '../../services/state.service';
import { mutate } from '../../services/mutation.service';
import { previewPublication } from '../../services/publication.service';
import { profileService } from '../../services/profile.service';
import { requireUser } from '../plugins/auth';
import type { AppOptions } from '../app';

/** Закрытая часть API: всё ниже требует действующей сессии. */
export const cabinetRoutes =
  ({ prisma, sessionSecret }: AppOptions): FastifyPluginAsyncZod =>
  async (app) => {
    requireUser(app, prisma, sessionSecret);

    app.get('/state', async (req) => stateFor(prisma, req.user));

    // Фото жалоб приходят data-URL внутри действия — отсюда больший лимит тела.
    app.post('/action', { bodyLimit: 6 * 1024 * 1024 }, async (req) =>
      // Вся мутация — одна транзакция: при любой ошибке Prisma откатывает её целиком.
      prisma.$transaction((tx) => mutate(tx, req.user, req.body), { timeout: 15_000 }),
    );

    app.post('/publication-preview', async (req) =>
      previewPublication(prisma, req.user, parseAction(req.body)),
    );

    app.get('/profile', async (req) => profileService.get(prisma, req.user.id));
    app.put('/profile', { schema: { body: profileSchema } }, async (req) =>
      profileService.update(prisma, req.user.id, req.body),
    );
  };
