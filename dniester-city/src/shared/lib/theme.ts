export const themes = [
  ['light', 'Светлая'],
  ['dark', 'Тёмная'],
  ['system', 'Системная'],
] as const;
export const accents = [
  ['blue', 'Синий'],
  ['indigo', 'Индиго'],
  ['sky', 'Небесный'],
] as const;
const read = (k: string, d: string) => {
  try {
    return localStorage.getItem(k) || d;
  } catch {
    return d;
  }
};
export function applyTheme(theme = read('theme', 'light'), accent = read('accent', 'blue')) {
  const dark =
    theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.accent = accent;
  try {
    localStorage.setItem('theme', theme);
    localStorage.setItem('accent', accent);
  } catch {
    /* приватный режим */
  }
}
export const currentTheme = () => [read('theme', 'light'), read('accent', 'blue')] as const;

type WaveOrigin = { clientX: number; clientY: number } | Element | null | undefined;

/**
 * Смена темы волной: новый вид раскрывается кругом из точки нажатия (View Transitions API).
 * Где API нет — кольцо цвета новой темы расходится поверх страницы. «Уменьшить движение» — без анимации.
 */
export function applyThemeWithWave(theme: string, accent = currentTheme()[1], origin?: WaveOrigin) {
  const root = document.documentElement;
  let x = innerWidth / 2,
    y = 0;
  if (origin && 'clientX' in origin && (origin.clientX || origin.clientY)) {
    x = origin.clientX;
    y = origin.clientY;
  } else if (origin instanceof Element) {
    const r = origin.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  }
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.style.setProperty('--wave-x', `${x}px`);
  root.style.setProperty('--wave-y', `${y}px`);
  root.style.setProperty('--wave-r', `${radius}px`);
  const reduce =
    matchMedia('(prefers-reduced-motion: reduce)').matches || root.dataset.motion === 'reduce';
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (reduce) return applyTheme(theme, accent);
  if (doc.startViewTransition) {
    doc.startViewTransition(() => applyTheme(theme, accent));
    return;
  }
  applyTheme(theme, accent);
  const ring = document.createElement('span');
  ring.className = 'theme-wave-fallback';
  Object.assign(ring.style, {
    left: `${x}px`,
    top: `${y}px`,
    width: `${radius * 2}px`,
    height: `${radius * 2}px`,
    background: 'color-mix(in srgb, var(--primary) 22%, transparent)',
  });
  document.body.append(ring);
  ring.addEventListener('animationend', () => ring.remove());
}
