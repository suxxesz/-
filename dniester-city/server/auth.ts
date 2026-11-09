import { createHmac, timingSafeEqual } from 'node:crypto';
export function verifyTelegram(
  initData: string,
  botToken: string,
  now = Date.now(),
): { id: number; first_name?: string } {
  if (!botToken) throw Error('Telegram-бот не настроен.');
  const params = new URLSearchParams(initData),
    hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) throw Error('Неверная подпись Telegram.');
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) throw Error('Повторяющиеся поля Telegram.');
  params.delete('hash');
  const check = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(check).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex')))
    throw Error('Неверная подпись Telegram.');
  const auth = Number(params.get('auth_date'));
  if (!auth || now / 1000 - auth > 3600 || auth > now / 1000 + 30)
    throw Error('Сессия Telegram устарела. Откройте приложение заново.');
  const user = JSON.parse(params.get('user') || 'null');
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0)
    throw Error('Неизвестный пользователь Telegram.');
  return user;
}
export function signSession(userId: string, secret: string, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Math.floor(now / 1000) + 3600 }),
  ).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
export function readSession(token: string, secret: string, now = Date.now()): string {
  const [payload, sig, ...rest] = token.split('.');
  if (!payload || !sig || rest.length) throw Error('Требуется вход.');
  const expected = createHmac('sha256', secret).update(payload).digest(),
    actual = Buffer.from(sig, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(expected, actual))
    throw Error('Недействительная сессия.');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (
    typeof data.sub !== 'string' ||
    !data.sub ||
    !Number.isSafeInteger(data.exp) ||
    data.exp <= now / 1000
  )
    throw Error('Сессия истекла.');
  return data.sub;
}
