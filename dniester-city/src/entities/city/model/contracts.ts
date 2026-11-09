import { z } from 'zod';
import { categories, eventStatuses, ticketStatuses, reportTypes, reportStatuses, PMR_BOUNDS } from './types';
const text = (max = 2000) =>
  z.string().trim().min(1, 'Заполните обязательное поле.').max(max, 'Слишком длинное значение.');
const category = z.enum(categories),
  address = text(180),
  identifier = text(250),
  number = z.number().finite().min(0).max(1e12);
const revision = { expectedVersion: z.number().int().positive().optional() };
const sourceUrl = z
  .union([
    z.literal(''),
    z.url().refine((v) => v.startsWith('https://'), 'Ссылка должна начинаться с https://'),
  ])
  .optional();
const eventFields = {
  category,
  title: text(160),
  description: text(),
  addresses: z.array(address).min(1).max(100),
  start: text(40),
  end: z.string().max(40).optional(),
  source: text(180),
  sourceUrl,
};
const shape = <T extends string, P extends z.ZodRawShape>(type: T, payload: P) =>
  z
    .object({
      type: z.literal(type),
      payload: z.object(payload).strict(),
      requestId: z.uuid().optional(),
    })
    .strict();
export const actionSchema = z.discriminatedUnion('type', [
  shape('address.add', { address }),
  shape('address.select', { address }),
  shape('subscriptions', { categories: z.array(category).max(8) }),
  shape('notices.read', {}),
  shape('meter.create', {
    address,
    category,
    name: text(80),
    serial: text(80),
    account: z.string().trim().max(80).default(''),
    initialValue: number,
  }),
  shape('reading.create', {
    address,
    category,
    meterId: identifier.optional(),
    value: number,
    period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Укажите месяц подачи.'),
    confirmed: z.boolean().optional(),
  }),
  shape('ticket.create', {
    address,
    category,
    title: text(160),
    description: text(),
    priority: z.enum(['Обычная', 'Повышенная']).default('Обычная'),
  }),
  shape('report.create', {
    type: z.enum(reportTypes),
    title: text(120),
    description: text(),
    address: text(180),
    lat: z.number().min(PMR_BOUNDS.south, 'Точка вне ПМР.').max(PMR_BOUNDS.north, 'Точка вне ПМР.'),
    lng: z.number().min(PMR_BOUNDS.west, 'Точка вне ПМР.').max(PMR_BOUNDS.east, 'Точка вне ПМР.'),
    media: z.string().startsWith('data:', 'Прикрепите фото или видео.').max(3_000_000, 'Файл слишком большой.'),
    mediaKind: z.enum(['image', 'video']),
  }),
  shape('report.status', {
    id: identifier,
    status: z.enum(reportStatuses),
    comment: text(),
    reportPhoto: z.string().startsWith('data:').max(3_000_000).optional(),
    ...revision,
  }),
  shape('ticket.reopen', { id: identifier, ...revision }),
  shape('ticket.status', {
    id: identifier,
    status: z.enum(ticketStatuses),
    comment: text(),
    ...revision,
  }),
  shape('event.create', { ...eventFields, draft: z.boolean().default(false) }),
  shape('event.publish', { id: identifier, ...revision }),
  shape('event.update', {
    id: identifier,
    status: z.enum(eventStatuses),
    end: z.string().max(40).optional(),
    comment: text(),
    ...revision,
  }),
  shape('schedule.save', {
    id: identifier.optional(),
    address,
    category,
    title: text(160),
    when: text(180),
    description: text(),
    source: text(180),
  }),
  shape('organization.save', {
    id: identifier.optional(),
    name: text(180),
    categories: z.array(category).min(1).max(8),
    addresses: z.array(address).min(1).max(100),
    connected: z.boolean(),
    sourceUrl,
  }),
]);
export type Action = z.input<typeof actionSchema>;
export type ParsedAction = z.output<typeof actionSchema>;
export function parseAction(input: unknown): ParsedAction {
  const result = actionSchema.safeParse(input);
  if (!result.success)
    throw Error(result.error.issues[0]?.message || 'Проверьте параметры действия.');
  return result.data;
}
