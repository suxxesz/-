import type { Db } from '../infrastructure/db';
import { userRepository } from '../repositories/user.repository';
import { auditRepository } from '../repositories/outbox.repository';
import { profileSchema, type ProfileInput } from '../../src/entities/profile/model/schema';

export const profileService = {
  get: (db: Db, userId: string) => userRepository.readProfile(db, userId),
  /** Полная замена профиля: тело уже проверено той же zod-схемой, что и форма. */
  async update(db: Db, userId: string, input: ProfileInput) {
    const profile = profileSchema.parse(input);
    await userRepository.saveProfile(db, userId, profile);
    await auditRepository.write(db, userId, 'profile.update', userId);
    return profile;
  },
};
