import { emptyState, type State, type Role } from './model';
import { createDemoState as initialState } from './demo';
import { applyAction, type Action } from './actions';
import { legacyMeterId } from './demo';
declare global {
  interface Window {
    Telegram?: { WebApp: { initData: string; ready: () => void; expand: () => void } };
  }
}
export const serverMode = import.meta.env.VITE_DATA_MODE === 'server';
export const storageKey = 'moy-gorod-v1';
let token = '';
const pendingRequests = new Map<string, string>();
export async function request(path: string, options: RequestInit = {}) {
  let r: Response;
  try {
    r = await fetch(`${import.meta.env.VITE_API_URL || ''}/api${path}`, {
      ...options,
      signal: AbortSignal.timeout(15000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  } catch {
    throw Error('Нет соединения с сервером. Изменения не отправлены; проверьте сеть и повторите.');
  }
  let data: unknown;
  try {
    data = await r.json();
  } catch {
    throw Error('Сервер вернул некорректный ответ. Попробуйте позже.');
  }
  if (!r.ok) throw Error((data as { error?: string }).error || 'Ошибка сервера.');
  return data;
}
export function normalizeState(raw: Partial<State>): State {
  const empty = emptyState();
  for (const field of [
    'addresses',
    'events',
    'tickets',
    'readings',
    'notices',
    'schedules',
  ] as const) {
    if (raw[field] !== undefined && !Array.isArray(raw[field]))
      throw Error('Не удалось прочитать сохранённые данные.');
  }
  const state = {
    ...empty,
    ...raw,
    meters: raw.meters || [],
    organizations: raw.organizations || (!serverMode ? initialState().organizations : []),
  };
  // Preserve existing v0.1 records and reconstruct a personal meter for each legacy service.
  for (const r of state.readings) {
    if (!r.meterId) {
      r.meterId = legacyMeterId(r.address, r.category);
      if (!state.meters.some((m) => m.id === r.meterId))
        state.meters.push({
          id: r.meterId,
          address: r.address,
          category: r.category,
          name: 'Счётчик из истории',
          serial: 'Не указан',
          account: '',
          initialValue: r.previous,
          created: r.created,
        });
    }
  }
  return state;
}
async function loadTelegram() {
  if (window.Telegram) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script'),
      timeout = setTimeout(() => {
        script.remove();
        reject(Error('Не удалось загрузить Telegram. Проверьте соединение.'));
      }, 10000);
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.onload = () => {
      clearTimeout(timeout);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timeout);
      reject(Error('Telegram недоступен. Повторите позже.'));
    };
    document.head.append(script);
  });
}
export async function loadState(): Promise<{ state: State; role: Role }> {
  if (serverMode) {
    await loadTelegram();
    const initData = window.Telegram?.WebApp.initData;
    if (!initData) throw Error('Откройте приложение через Telegram-бота для входа.');
    window.Telegram!.WebApp.ready();
    window.Telegram!.WebApp.expand();
    const session = (await request('/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    })) as { token: string; role: Role };
    token = session.token;
    return { state: normalizeState((await request('/state')) as State), role: session.role };
  }
  const data = localStorage.getItem(storageKey);
  try {
    return { state: data ? normalizeState(JSON.parse(data)) : initialState(), role: 'resident' };
  } catch {
    throw Error('Сохранённые демоданные повреждены. Их можно сбросить в настройках.');
  }
}
export async function dispatchAction(state: State, action: Action, role: Role): Promise<State> {
  if (serverMode) {
    const fingerprint = JSON.stringify(action),
      requestId = action.requestId || pendingRequests.get(fingerprint) || crypto.randomUUID();
    pendingRequests.set(fingerprint, requestId);
    if (pendingRequests.size > 20) pendingRequests.delete(pendingRequests.keys().next().value!);
    const next = normalizeState(
      (await request('/action', {
        method: 'POST',
        body: JSON.stringify({ ...action, requestId }),
      })) as State,
    );
    pendingRequests.delete(fingerprint);
    return next;
  }
  const next = applyAction(state, action, role);
  localStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}
export async function reloadState(): Promise<State> {
  return serverMode
    ? normalizeState((await request('/state')) as State)
    : (await loadState()).state;
}
export function resetDemo() {
  localStorage.removeItem(storageKey);
  location.reload();
}
