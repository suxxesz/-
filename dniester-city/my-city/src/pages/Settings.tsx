import { applyTheme, currentTheme, themes, accents } from '../lib/theme';
import { Plus, MapPin, Check, Type } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCity } from '../store/CityProvider';
import { services } from '../model';
import { PageHeading, SectionHeading } from '../components/ui';
import { serverMode } from '../api';
export default function Settings() {
  const { state, act, open, busy } = useCity(),
    [large, setLarge] = useState(localStorage.getItem('city-large-text') === '1');
  useEffect(() => {
    document.documentElement.dataset.large = String(large);
    localStorage.setItem('city-large-text', large ? '1' : '0');
  }, [large]);
  return (
    <>
      <PageHeading title="Настройки" subtitle="Ваши адреса, уведомления и удобный размер текста." />
      <div className="settings-grid">
        <section className="panel">
          <SectionHeading title="Мои адреса">
            <button className="text-link" onClick={() => open({ type: 'address' })}>
              <Plus size={17} />
              Добавить
            </button>
          </SectionHeading>
          {state.addresses.map((a) => (
            <button
              disabled={busy}
              className={'address-row ' + (a === state.activeAddress ? 'active' : '')}
              key={a}
              onClick={() => act({ type: 'address.select', payload: { address: a } })}
            >
              <MapPin size={19} />
              <span>{a}</span>
              {a === state.activeAddress && <Check size={18} />}
            </button>
          ))}
        </section>
        <section className="panel">
          <h2>Оформление</h2>
          <label>
            Тема
            <select aria-label="Тема" defaultValue={currentTheme()[0]} onChange={(e) => applyTheme(e.target.value, currentTheme()[1])}>
              {themes.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </label>
          <label>
            Акцентный цвет
            <select aria-label="Акцентный цвет" defaultValue={currentTheme()[1]} onChange={(e) => applyTheme(currentTheme()[0], e.target.value)}>
              {accents.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </label>
        </section>
        <section className="panel">
          <h2>Уведомления</h2>
          <p className="muted">Настройки для адреса: {state.activeAddress || 'добавьте дом'}.</p>
          {services.map((s) => (
            <label className="toggle-row" key={s.id}>
              <span>{s.name}</span>
              <input
                type="checkbox"
                disabled={busy || !state.activeAddress}
                checked={state.subscriptions.includes(s.id)}
                onChange={(e) =>
                  act({
                    type: 'subscriptions',
                    payload: {
                      categories: e.target.checked
                        ? [...state.subscriptions, s.id]
                        : state.subscriptions.filter((c) => c !== s.id),
                    },
                  })
                }
              />
            </label>
          ))}
        </section>
        <section className="panel">
          <h2>Читаемость</h2>
          <label className="toggle-row">
            <span>
              <Type size={18} />
              Увеличенный текст
            </span>
            <input type="checkbox" checked={large} onChange={(e) => setLarge(e.target.checked)} />
          </label>
          <p className="muted">Сохраняется для этого устройства и действует во всех разделах.</p>
        </section>
        <section className="panel">
          <h2>Ваши данные</h2>
          <p className="muted">
            {serverMode
              ? 'Показания и обращения хранятся на сервере. Доступ зависит от текущей роли и назначенной организации.'
              : 'В демонстрации изменения хранятся только в вашем браузере. Реальные лицевые счета и личные данные для показа не нужны.'}
          </p>
          {!serverMode && (
            <button className="outline danger" onClick={() => open({ type: 'reset' })}>
              Сбросить демо
            </button>
          )}
        </section>
      </div>
    </>
  );
}
