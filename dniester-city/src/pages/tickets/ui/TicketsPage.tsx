import { useState } from 'react';
import { Plus, Search, ArrowUpRight } from 'lucide-react';
import { useCity } from '@/entities/city/model/store';
import { PageHeading, InfoStrip, Empty, Pill } from '@/shared/ui/ui';
import { ServiceIcon, StatusPill } from '@/entities/city/ui';
import { dateText } from '@/shared/lib/dates';
import { Select } from '@/shared/ui/Select';
export default function Tickets() {
  const { state, open } = useCity(),
    [filter, setFilter] = useState('all'),
    [query, setQuery] = useState('');
  const tickets = state.tickets.filter(
    (t) =>
      t.address === state.activeAddress &&
      (filter === 'all' ||
        (filter === 'active'
          ? !['Выполнена', 'Закрыта'].includes(t.status)
          : ['Выполнена', 'Закрыта'].includes(t.status))) &&
      (t.title + ' ' + t.description).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="Мои заявки"
        subtitle="От первого сообщения до результата — каждый шаг остаётся в истории."
      >
        <button className="primary" onClick={() => open({ type: 'ticket' })}>
          <Plus size={17} />
          Новая заявка
        </button>
      </PageHeading>
      <InfoStrip>
        Здесь сохраняются обращения и ответы диспетчера. Официальное принятие организацией
        отображается только после её подтверждения; обычная заявка не является вызовом аварийной
        службы.
      </InfoStrip>
      <div className="toolbar">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Поиск заявок"
            placeholder="Найти заявку"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <Select
          aria-label="Статус заявок"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Все заявки</option>
          <option value="active">Открытые</option>
          <option value="done">Выполненные</option>
        </Select>
      </div>
      <div className="ticket-list">
        {tickets.map((t) => (
          <button
            className="panel ticket-row"
            key={t.id}
            onClick={() => open({ type: 'ticket-detail', ticket: t })}
          >
            <ServiceIcon category={t.category} />
            <div>
              <small className="muted">
                {t.id.slice(0, 12)} · {dateText(t.created)}
              </small>
              <h3>{t.title}</h3>
              <p>{t.description}</p>
              {t.priority === 'Повышенная' && <Pill tone="warning">Повышенное внимание</Pill>}
            </div>
            <StatusPill status={t.status} />
            <ArrowUpRight size={18} />
          </button>
        ))}
      </div>
      {!tickets.length && (
        <Empty title="Заявки не найдены">Создайте обращение или измените фильтр.</Empty>
      )}
    </>
  );
}
