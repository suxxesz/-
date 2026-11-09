import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Building2,
  LayoutDashboard,
  Zap,
  Gauge,
  MessageSquare,
  CalendarDays,
  Contact,
  Settings,
  ShieldCheck,
  Bell,
  MapPin,
  Moon,
  Sun,
  Menu,
  X,
  ArrowUpRight,
  Home,
  Presentation,
  LogOut,
  RefreshCw,
  WifiOff,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useCity } from '@/entities/city/model/store';
import Logo from '@/shared/ui/Logo';
import { applyTheme, currentTheme } from '@/shared/lib/theme';
import { useView, navigate, type View } from '@/shared/lib/navigation';
import { serverMode, resetDemo } from '@/entities/city/api/client';
import ModalHost from '@/widgets/modal-host/ui/ModalHost';
import Dashboard from '@/pages/dashboard';
const Events = lazy(() => import('@/pages/events')),
  Readings = lazy(() => import('@/pages/readings')),
  Complaints = lazy(() => import('@/pages/complaints')),
  Tickets = lazy(() => import('@/pages/tickets')),
  Schedule = lazy(() => import('@/pages/schedule')),
  Organizations = lazy(() => import('@/pages/organizations')),
  SettingsPage = lazy(() => import('@/pages/settings')),
  Dispatcher = lazy(() => import('@/pages/dispatcher')),
  Pitch = lazy(() => import('@/pages/pitch'));
const nav = [
  ['home', 'Обзор', LayoutDashboard],
  ['events', 'Отключения и работы', Zap],
  ['readings', 'Показания счётчиков', Gauge],
  ['tickets', 'Мои заявки', MessageSquare],
  ['complaints', 'Книга жалоб', MapPin],
  ['schedule', 'Графики обслуживания', CalendarDays],
  ['contacts', 'Организации', Contact],
] as const;
export default function App() {
  const {
      state,
      role,
      setDemoRole,
      ready,
      error,
      busy,
      modal,
      open,
      act,
      refresh,
      toast,
      dismissToast,
      clearError,
      announce,
    } = useCity(),
    view = useView(),
    [mobile, setMobile] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [, setThemeTick] = useState(0);
  useEffect(() => {
    setMobile(false);
    const heading = document.querySelector('main h1') as HTMLElement | null;
    heading?.focus({ preventScroll: true });
  }, [view]);
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    window.addEventListener('online', change);
    window.addEventListener('offline', change);
    document.documentElement.dataset.large = String(
      localStorage.getItem('city-large-text') === '1',
    );
    return () => {
      window.removeEventListener('online', change);
      window.removeEventListener('offline', change);
    };
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobile(false);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [mobile]);
  function dispatcher() {
    setMobile(false);
    if (!serverMode) {
      setDemoRole('admin');
      navigate('admin');
    } else if (role !== 'resident') navigate('admin');
    else announce('Роль диспетчера назначает администратор организации.');
  }
  const unread = state.notices.filter((n) => !n.read).length;
  const pages: Record<View, React.ReactNode> = {
    home: <Dashboard />,
    events: <Events />,
    readings: <Readings />,
    tickets: <Tickets />,
    complaints: <Complaints />,
    schedule: <Schedule />,
    contacts: <Organizations />,
    settings: <SettingsPage />,
    admin: <Dispatcher />,
    pitch: <Pitch />,
  };
  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Перейти к содержимому
      </a>
      <aside className={'sidebar ' + (mobile ? 'mobile-open' : '')} aria-label="Основная навигация">
        <a className="brand" href="#home" onClick={() => setMobile(false)}>
          <span className="brand-mark">
            <Logo size={40} />
          </span>
          <span>
            DniesterCity<small>ГОРОД В ОДНОМ ОКНЕ</small>
          </span>
        </a>
        <button
          className="mobile-sidebar-close icon-button"
          aria-label="Закрыть меню"
          onClick={() => setMobile(false)}
        >
          <X size={22} />
        </button>
        <div className="sidebar-label">Личный кабинет</div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={view === id ? 'selected' : ''}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => {
                setMobile(false);
                navigate(id);
              }}
            >
              <Icon size={20} />
              {label}
              {id === 'tickets' && state.tickets.length > 0 && (
                <span className="nav-count" aria-hidden="true">
                  {state.tickets.filter((t) => !['Выполнена', 'Закрыта'].includes(t.status)).length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-help">
          <Home size={23} />
          <h4>Дом начинается с заботы</h4>
          <p>Сообщите о проблеме и следите за её решением.</p>
          <button
            onClick={() => {
              setMobile(false);
              open({ type: 'ticket' });
            }}
          >
            Оставить обращение
            <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button
            className={view === 'pitch' ? 'selected' : ''}
            onClick={() => {
              setMobile(false);
              navigate('pitch');
            }}
          >
            <Presentation size={19} />
            Режим защиты<span className="nav-new">NEW</span>
          </button>
          <button
            className={view === 'settings' ? 'selected' : ''}
            onClick={() => {
              setMobile(false);
              navigate('settings');
            }}
          >
            <Settings size={19} />
            Настройки
          </button>
          <button className={view === 'admin' ? 'selected' : ''} onClick={dispatcher}>
            <ShieldCheck size={19} />
            Панель диспетчера{!serverMode && <small>ДЕМО</small>}
          </button>
          <button
            className="theme-toggle"
            aria-label="Сменить тему"
            onClick={() => {
              applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', currentTheme()[1]);
              setThemeTick((n) => n + 1);
            }}
          >
            {document.documentElement.dataset.theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <div className="profile">
            <span className="avatar">{role === 'resident' ? 'Ж' : 'Д'}</span>
            <div>
              <strong>{role === 'resident' ? 'Житель города' : 'Диспетчер'}</strong>
              <small>{serverMode ? 'Telegram-аккаунт' : 'Учебный кабинет'}</small>
            </div>
            {role !== 'resident' && (
              <button
                aria-label="Вернуться к жителю"
                onClick={() => {
                  if (!serverMode) setDemoRole('resident');
                  navigate('home');
                }}
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Закрыть навигацию"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Открыть меню"
            aria-expanded={mobile}
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={23} />
          </button>
          <div className="address-switch">
            <MapPin size={21} />
            <div>
              <small>Мой адрес</small>
              {state.addresses.length ? (
                <select
                  disabled={busy}
                  aria-label="Выбрать адрес"
                  value={state.activeAddress}
                  onChange={(e) =>
                    act(
                      { type: 'address.select', payload: { address: e.target.value } },
                      'Адрес переключён',
                    )
                  }
                >
                  {state.addresses.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              ) : (
                <button className="text-link" onClick={() => open({ type: 'address' })}>
                  Добавить адрес
                </button>
              )}
            </div>
          </div>
          <div className="topbar-right">
            <span className="demo-tag">
              <i />
              {serverMode ? 'Пилотный сервис' : 'Демо-режим'}
            </span>
            <button
              className="icon-button refresh-button"
              aria-label="Обновить данные"
              onClick={refresh}
            >
              <RefreshCw size={19} />
            </button>
            <button
              className="notification icon-button"
              aria-label={`Уведомления: ${unread}`}
              onClick={() => open({ type: 'notices' })}
            >
              <Bell size={22} />
              {unread > 0 && <i>{unread > 9 ? '9+' : unread}</i>}
            </button>
            <span className="avatar small">{role === 'resident' ? 'Ж' : 'Д'}</span>
          </div>
        </header>
        {!online && (
          <div className="offline-banner" role="status">
            <WifiOff size={17} />
            {serverMode
              ? 'Нет сети. Для сохранения нужен сервер.'
              : 'Нет сети. Демо работает локально; карта может быть недоступна.'}
          </div>
        )}
        <main id="main-content" tabIndex={-1}>
          {!ready ? (
            <div className="empty loading-panel">
              {error ? (
                <>
                  <AlertCircle size={28} />
                  <h2>Не удалось открыть кабинет</h2>
                  <p>{error}</p>
                  <button className="primary" onClick={() => location.reload()}>
                    Повторить
                  </button>
                  {!serverMode && (
                    <button className="outline" onClick={resetDemo}>
                      Восстановить демо
                    </button>
                  )}
                </>
              ) : (
                <>
                  <Building2 size={32} />
                  <h2>Открываем ваш кабинет…</h2>
                </>
              )}
            </div>
          ) : (
            <Suspense fallback={<div className="loading-panel">Открываем раздел…</div>}>
              {pages[view]}
            </Suspense>
          )}
          <footer>
            <span>
              <Building2 size={17} />
              DniesterCity<span>·</span>Забота о доме в одном месте
            </span>
            <span>
              {serverMode ? 'Пилотный сервис' : 'Все события и организации — учебные'}
              <span>·</span>2026
            </span>
          </footer>
        </main>
        <nav className="bottom-nav" aria-label="Быстрая навигация">
          {[
            ['home', 'Главная', LayoutDashboard],
            ['events', 'События', Zap],
            ['readings', 'Счётчики', Gauge],
            ['tickets', 'Заявки', MessageSquare],
          ].map(([id, label, Icon]) => {
            const I = Icon as typeof Gauge;
            return (
              <button
                key={String(id)}
                className={view === id ? 'active' : ''}
                onClick={() => navigate(id as View)}
              >
                <I size={21} />
                <span>{String(label)}</span>
              </button>
            );
          })}
        </nav>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={20} />
          <span>{toast}</span>
          <button aria-label="Закрыть сообщение" onClick={dismissToast}>
            <X size={17} />
          </button>
        </div>
      )}
      {error && !modal && ready && (
        <div className="toast error" role="alert">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button className="error-refresh" onClick={refresh}>
            Обновить
          </button>
          <button aria-label="Закрыть ошибку" onClick={clearError}>
            <X size={17} />
          </button>
        </div>
      )}
      {modal && <ModalHost />}
    </div>
  );
}
