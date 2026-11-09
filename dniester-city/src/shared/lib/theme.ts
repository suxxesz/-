export const themes = [['light', 'Светлая'], ['dark', 'Тёмная'], ['system', 'Системная']] as const;
export const accents = [['blue', 'Синий'], ['indigo', 'Индиго'], ['sky', 'Небесный']] as const;
const read = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
export function applyTheme(theme = read('theme', 'light'), accent = read('accent', 'blue')) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.accent = accent;
  try { localStorage.setItem('theme', theme); localStorage.setItem('accent', accent); } catch { /* приватный режим */ }
}
export const currentTheme = () => [read('theme', 'light'), read('accent', 'blue')] as const;
