import { lazy, Suspense, useMemo, useState } from 'react';
import { Search, Map as MapIcon, List } from 'lucide-react';
import { services } from '../model';
import { useCity } from '../store/CityProvider';
import { PageHeading, EventCard, Empty, ServiceIcon } from '../components/ui';
const MapView = lazy(() => import('../components/MapView'));
export default function Events() {
  const { state, open } = useCity(),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [status, setStatus] = useState('active'),
    [map, setMap] = useState(false);
  const events = useMemo(
    () =>
      state.events
        .filter(
          (e) =>
            e.status !== 'Черновик' &&
            e.addresses.includes(state.activeAddress) &&
            (filter === 'all' || e.category === filter) &&
            (status === 'all' ||
              (status === 'active'
                ? !['Завершено', 'Отменено'].includes(e.status)
                : ['Завершено', 'Отменено'].includes(e.status))) &&
            (e.title + ' ' + e.description).toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) => a.start.localeCompare(b.start)),
    [state.events, state.activeAddress, filter, status, query],
  );
  return (
    <>
      <PageHeading
        title="Отключения и работы"
        subtitle="Что происходит по вашему адресу и когда ожидается восстановление."
      />
      <div className="chips" role="group" aria-label="Направления">
        <button className={'chip ' + (filter === 'all' ? 'on' : '')} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          Все направления
        </button>
        {services.map((s) => (
          <button key={s.id} className={'chip ' + (filter === s.id ? 'on' : '')} aria-pressed={filter === s.id} onClick={() => setFilter(s.id)}>
            <ServiceIcon category={s.id} size={15} />
            {s.short}
            <small>{state.events.filter((e) => e.category === s.id && e.status !== 'Черновик' && e.addresses.includes(state.activeAddress)).length}</small>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Поиск событий"
            placeholder="Найти событие"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Фильтр по услуге"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Все услуги</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button className="outline" onClick={() => setMap(!map)}>
          {map ? <List size={17} /> : <MapIcon size={17} />} {map ? 'Списком' : 'На карте'}
        </button>
      </div>
      <div className="filter-tabs" aria-label="Статус событий">
        {[
          ['active', 'Текущие и плановые'],
          ['archive', 'Завершённые'],
          ['all', 'Все события'],
        ].map(([v, label]) => (
          <button
            key={v}
            className={status === v ? 'active' : ''}
            aria-pressed={status === v}
            onClick={() => setStatus(v)}
          >
            {label}
          </button>
        ))}
      </div>
      {!events.length ? (
        <Empty title="События не найдены">
          Попробуйте изменить фильтр. Отсутствие публикаций не подтверждает отсутствие перебоев.
        </Empty>
      ) : map ? (
        <Suspense fallback={<div className="loading-panel">Загружаем карту…</div>}>
          <MapView events={events} onSelect={(event) => open({ type: 'event', event })} />
        </Suspense>
      ) : (
        <div className="event-grid full">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </>
  );
}
