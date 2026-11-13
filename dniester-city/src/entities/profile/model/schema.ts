import { z } from 'zod';

/** Общая схема профиля жителя: одной и той же zod-схемой проверяют форма и сервер. */
export const pmrCities = [
  'Тирасполь',
  'Бендеры',
  'Рыбница',
  'Дубоссары',
  'Слободзея',
  'Григориополь',
  'Каменка',
  'Днестровск',
  'Другой населённый пункт',
] as const;
export const genders = [
  ['unspecified', 'Не указывать'],
  ['female', 'Женский'],
  ['male', 'Мужской'],
] as const;
export const contactChannels = [
  ['telegram', 'Telegram'],
  ['phone', 'Звонок'],
  ['email', 'Почта'],
] as const;
export const benefitKinds = [
  ['pensioner', 'Пенсионер'],
  ['disability', 'Инвалидность'],
  ['large-family', 'Многодетная семья'],
  ['veteran', 'Ветеран'],
] as const;

const MIN_AGE = 14,
  MAX_AGE = 110;

/** Полных лет на дату `now` (ДР ещё не наступил — минус год). */
export function ageOf(birthDate: string, now = new Date()) {
  const [y, m, d] = birthDate.split('-').map(Number);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age;
}

const optional = <T extends z.ZodType>(s: T) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), s.optional());

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Имя — минимум 2 символа.')
    .max(60, 'Имя — не длиннее 60 символов.'),
  birthDate: optional(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата рождения в формате ГГГГ-ММ-ДД.')
      .refine((v) => !Number.isNaN(Date.parse(v)), 'Такой даты нет.')
      .refine((v) => {
        const a = ageOf(v);
        return a >= MIN_AGE && a <= MAX_AGE;
      }, `Возраст — от ${MIN_AGE} до ${MAX_AGE} лет.`),
  ),
  gender: z.enum(genders.map(([v]) => v) as [string, ...string[]]).default('unspecified'),
  city: optional(z.enum(pmrCities)),
  district: optional(z.string().trim().max(80, 'Район — не длиннее 80 символов.')),
  phone: optional(
    z
      .string()
      .trim()
      .transform((v) => v.replace(/[\s()-]/g, ''))
      .pipe(z.string().regex(/^\+?\d{7,15}$/, 'Телефон: 7–15 цифр, можно с «+».')),
  ),
  email: optional(z.email('Проверьте адрес почты.').max(120)),
  householdSize: optional(z.coerce.number().int().min(1, 'Минимум 1 человек.').max(20, 'Максимум 20 человек.')),
  benefits: z.array(z.enum(benefitKinds.map(([v]) => v) as [string, ...string[]])).max(4).default([]),
  contactChannel: z.enum(contactChannels.map(([v]) => v) as [string, ...string[]]).default('telegram'),
  about: optional(z.string().trim().max(500, 'Не длиннее 500 символов.')),
});
export type Profile = z.infer<typeof profileSchema>;
export type ProfileInput = z.input<typeof profileSchema>;

export const emptyProfile = (displayName = 'Житель'): Profile => ({
  displayName,
  gender: 'unspecified',
  benefits: [],
  contactChannel: 'telegram',
});

/** Доля заполненного профиля, 0–100: подсказка «осталось заполнить». */
export function profileCompletion(p: Profile) {
  const filled = [p.birthDate, p.city, p.district, p.phone || p.email, p.householdSize].filter(
    (v) => v !== undefined && v !== '',
  ).length;
  return Math.round(((1 + filled) / 6) * 100);
}
