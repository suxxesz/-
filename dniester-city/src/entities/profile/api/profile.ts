import { request, serverMode } from '@/entities/city/api/client';
import { emptyProfile, profileSchema, type Profile, type ProfileInput } from '../model/schema';

const KEY = 'moy-gorod-profile';

/** Профиль: на сервере в пилоте, в браузере в демо. Схема одна и та же. */
export async function loadProfile(): Promise<Profile> {
  if (serverMode) return profileSchema.parse(await request('/profile'));
  try {
    return profileSchema.parse({ ...emptyProfile(), ...JSON.parse(localStorage.getItem(KEY) || '{}') });
  } catch {
    return emptyProfile();
  }
}

export async function saveProfile(input: ProfileInput): Promise<Profile> {
  const profile = profileSchema.parse(input); // те же сообщения об ошибках, что вернул бы сервер
  if (serverMode)
    return profileSchema.parse(
      await request('/profile', { method: 'PUT', body: JSON.stringify(profile) }),
    );
  localStorage.setItem(KEY, JSON.stringify(profile));
  return profile;
}
