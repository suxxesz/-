import type { Db } from '../infrastructure/db';
import { json } from '../infrastructure/json';
import { type Category, type Role, services } from '../../src/entities/city/model/types';
import { emptyProfile, profileSchema, type Profile } from '../../src/entities/profile/model/schema';

export type User = {
  id: string;
  telegram_id: string;
  name: string;
  role: Role;
  organization_id: string | null;
  prefs: {
    addresses: string[];
    activeAddress: string;
    subscriptions: Category[];
    subscriptionsByAddress?: Record<string, Category[]>;
  };
};
type UserRow = {
  id: string;
  telegram_id: bigint | string | number;
  name: string;
  role: string;
  organization_id: string | null;
  prefs: unknown;
};

export const emptyPrefs = () => ({
  addresses: [],
  activeAddress: '',
  subscriptions: services.map((s) => s.id),
  subscriptionsByAddress: {},
});

/** Строка users из Prisma → User сервера (telegram_id приходит как bigint). */
export const toUser = (r: UserRow): User => ({
  id: r.id,
  telegram_id: String(r.telegram_id),
  name: r.name,
  role: r.role as Role,
  organization_id: r.organization_id,
  prefs: r.prefs as User['prefs'],
});

/** Только доступ к таблице users — без правил предметной области. */
export const userRepository = {
  async findById(db: Db, id: string) {
    const row = await db.user.findUnique({ where: { id } });
    return row ? toUser(row) : null;
  },
  /** Строка пользователя под FOR UPDATE до конца транзакции — Prisma так не умеет, только сырой SQL. */
  async lockById(db: Db, id: string) {
    const row = (await db.$queryRaw<UserRow[]>`SELECT * FROM users WHERE id=${id} FOR UPDATE`)[0];
    return row ? toUser(row) : null;
  },
  upsertFromTelegram(db: Db, tg: { id: number; first_name?: string }, admin: boolean) {
    const name = tg.first_name || 'Житель';
    return db.user.upsert({
      where: { telegram_id: BigInt(tg.id) },
      create: {
        id: `tg-${tg.id}`,
        telegram_id: BigInt(tg.id),
        name,
        role: admin ? 'admin' : 'resident',
        prefs: emptyPrefs(),
        profile: json(emptyProfile(name)),
      },
      // Имя из Telegram не затирает то, что житель сам указал в профиле.
      update: {},
    });
  },
  savePrefs(db: Db, id: string, prefs: User['prefs']) {
    return db.user.update({ where: { id }, data: { prefs: json(prefs) } });
  },
  /** Жители, у которых есть хоть один из адресов (оператор jsonb ?| — только сырой SQL). */
  withAnyAddress(db: Db, addresses: string[]) {
    return db.$queryRaw<
      { id: string; prefs: User['prefs'] }[]
    >`SELECT id,prefs FROM users WHERE prefs->'addresses' ?| ${addresses}::text[]`;
  },
  async readProfile(db: Db, id: string): Promise<Profile> {
    const row = await db.user.findUniqueOrThrow({
      where: { id },
      select: { name: true, profile: true },
    });
    // Старые и пустые профили дополняем значениями по умолчанию, а не падаем.
    const parsed = profileSchema.safeParse({
      ...emptyProfile(row.name),
      ...(row.profile as object),
    });
    return parsed.success ? parsed.data : emptyProfile(row.name);
  },
  saveProfile(db: Db, id: string, profile: Profile) {
    return db.user.update({
      where: { id },
      data: { profile: json(profile), name: profile.displayName },
    });
  },
};
