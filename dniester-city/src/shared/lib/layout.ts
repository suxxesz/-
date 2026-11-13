import { useEffect, useState } from 'react';

/** Настройки макета этого устройства: ширина, плотность, простой режим, крупный текст, анимации. */
export type Layout = {
  width: 'full' | 'comfort';
  density: 'compact' | 'cozy' | 'spacious';
  simple: boolean;
  large: boolean;
  motion: 'auto' | 'reduce';
};
export const layoutOptions = {
  width: [
    ['full', 'Во весь экран'],
    ['comfort', 'По центру'],
  ],
  density: [
    ['compact', 'Плотно'],
    ['cozy', 'Обычно'],
    ['spacious', 'Свободно'],
  ],
  motion: [
    ['auto', 'Включены'],
    ['reduce', 'Минимум'],
  ],
} as const;

const KEY = 'city-layout';
const defaults: Layout = { width: 'full', density: 'cozy', simple: false, large: false, motion: 'auto' };

export function readLayout(): Layout {
  try {
    const legacyLarge = localStorage.getItem('city-large-text') === '1';
    return { ...defaults, large: legacyLarge, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return defaults;
  }
}

export function applyLayout(l: Layout = readLayout()) {
  const d = document.documentElement.dataset;
  d.width = l.width;
  d.density = l.density;
  d.simple = String(l.simple);
  d.large = String(l.large);
  d.motion = l.motion;
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    /* приватный режим */
  }
}

const listeners = new Set<(l: Layout) => void>();

/** Общий для всех компонентов макет: изменение в настройках сразу видно везде. */
export function useLayout() {
  const [layout, setState] = useState(readLayout);
  useEffect(() => {
    listeners.add(setState);
    return () => void listeners.delete(setState);
  }, []);
  const set = (patch: Partial<Layout>) => {
    const next = { ...readLayout(), ...patch };
    applyLayout(next);
    listeners.forEach((l) => l(next));
  };
  return [layout, set] as const;
}
