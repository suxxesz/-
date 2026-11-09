import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  emptyState,
  type State,
  type Role,
  type CityEvent,
  type Ticket,
  type Organization,
  type Schedule,
  type Category,
} from '../model';
import { dispatchAction, loadState, reloadState, storageKey, serverMode } from '../api';
import type { Action } from '../contracts';
export type ModalSpec =
  | { type: 'reading'; category?: Category }
  | { type: 'meter' }
  | { type: 'ticket'; category?: Category }
  | { type: 'address' }
  | { type: 'event-create' }
  | { type: 'event'; event: CityEvent }
  | { type: 'event-edit'; event: CityEvent }
  | { type: 'ticket-detail'; ticket: Ticket }
  | { type: 'ticket-status'; ticket: Ticket }
  | { type: 'organization'; organization?: Organization }
  | { type: 'schedule'; schedule?: Schedule }
  | { type: 'notices' }
  | { type: 'service'; category: Category }
  | { type: 'reset' };
type Store = {
  state: State;
  role: Role;
  setDemoRole: (role: Role) => void;
  ready: boolean;
  error: string;
  busy: boolean;
  modal: ModalSpec | null;
  open: (m: ModalSpec) => void;
  close: () => void;
  act: (a: Action, message?: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  toast: string;
  dismissToast: () => void;
  announce: (text: string) => void;
  clearError: () => void;
};
const Context = createContext<Store | null>(null);
export function CityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(emptyState),
    [role, setRole] = useState<Role>('resident'),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState<ModalSpec | null>(null),
    [toast, setToast] = useState('');
  const current = useRef(state),
    locked = useRef(false),
    generation = useRef(0);
  current.current = state;
  useEffect(() => {
    loadState()
      .then((x) => {
        setState(x.state);
        setRole(x.role);
        setReady(true);
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!serverMode || !ready) return;
    const update = () => {
      const version = generation.current;
      if (document.visibilityState === 'visible' && !locked.current)
        reloadState()
          .then((s) => {
            if (!locked.current && generation.current === version) setState(s);
          })
          .catch(() => {});
    };
    const timer = setInterval(update, 20000);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [ready]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!serverMode && e.key === storageKey)
        reloadState()
          .then((s) => {
            setState(s);
            setToast('Данные обновлены в другой вкладке.');
          })
          .catch((e) => setError(e.message));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  async function act(a: Action, message = 'Сохранено') {
    if (locked.current) return false;
    generation.current++;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const next = await dispatchAction(current.current, a, role);
      current.current = next;
      setState(next);
      setModal(null);
      setToast(message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function refresh() {
    if (locked.current) return;
    const version = ++generation.current;
    try {
      const next = await reloadState();
      if (generation.current !== version || locked.current) return;
      setState(next);
      setError('');
      setToast('Данные обновлены');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Context.Provider
      value={{
        state,
        role,
        setDemoRole: (r) => {
          if (!serverMode) setRole(r);
        },
        ready,
        error,
        busy,
        modal,
        open: (m) => {
          setError('');
          setModal(m);
        },
        close: () => {
          if (!locked.current) {
            setModal(null);
            setError('');
          }
        },
        act,
        refresh,
        toast,
        dismissToast: () => setToast(''),
        announce: setToast,
        clearError: () => setError(''),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCity() {
  const ctx = useContext(Context);
  if (!ctx) throw Error('CityProvider missing');
  return ctx;
}
