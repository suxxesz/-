import { z } from 'zod';
import { categories } from '../../src/entities/city/model/types';

/** Поставщик передаёт отключения пачкой; всё попадает в черновики диспетчера. */
export const outagesBody = z
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
export type OutagesBody = z.infer<typeof outagesBody>;
