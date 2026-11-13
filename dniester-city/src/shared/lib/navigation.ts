import { useEffect, useState } from 'react';
export const views = [
  'home',
  'events',
  'readings',
  'tickets',
  'complaints',
  'schedule',
  'contacts',
  'transport',
  'settings',
  'profile',
  'admin',
  'pitch',
] as const;
export type View = (typeof views)[number];
const readView = (): View => {
  const value = location.hash.slice(1);
  return views.includes(value as View) ? (value as View) : 'home';
};
export const navigate = (view: View) => {
  location.hash = view;
};
export function useView() {
  const [view, setView] = useState(readView);
  useEffect(() => {
    const change = () => {
      setView(readView());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  return view;
}
