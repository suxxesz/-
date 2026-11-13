import { z } from 'zod';

export const errorResponse = z.object({ error: z.string() });
export const fileParams = z.object({ name: z.string().max(64) });
