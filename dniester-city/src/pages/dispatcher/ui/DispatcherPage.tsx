import { useState } from 'react';
import {
  Plus,
  Download,
  FileCheck2,
  MessageSquare,
  CalendarDays,
  Building2,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import { useCity } from '@/entities/city/model/store';
import { PageHeading, InfoStrip, SectionHeading, Empty, Pill } from '@/shared/ui/ui';
import { ServiceIcon, StatusPill } from '@/entities/city/ui';
import { dateText } from '@/shared/lib/dates';
import { exportReadings } from '@/features/export-readings';
import { serverMode } from '@/entities/city/api/client';
export default function Dispatcher() {
  const { state, role, open } = useCity(),
    [tab, setTab] = useState('overview'),
    [ticketFilter, setTicketFilter] = useState('all');
  const address = state.activeAddress,
    events = state.events.filter((e) => e.addresses.includes(address)),
    tickets = state.tickets.filter((t) => t.address === address),
    schedules = state.schedules.filter((s) => s.address === address);
  const drafts = events.filter((e) => e.status === 'Черновик'),
    done = tickets.filter((t) => ['Выполнена', 'Закрыта'].includes(t.status));
  if (role === 'resident')
    return (
      <Empty title="Нужен доступ диспетчера">
        Роль и зона обслуживания назначаются администратором.
      </Empty>
    );
  return (
    <>
      <PageHeading
        title="Панель диспетчера"
        subtitle="Точная информация для жителей. Понятная очередь для вашей команды."
        eyebrow="Рабочее пространство"
      >
        <button className="primary" onClick={() => open({ type: 'event-create' })}>
          <Plus size={18} />
          Создать событие
        </button>
      </PageHeading>
      <InfoStrip>
        {serverMode
          ? 'Доступ ограничен назначенной организацией, услугами и адресами. Изменения фиксируются в журнале.'
          : 'Учебная панель: данные сохраняются в вашем браузере. Рассылку в Telegram можно подключить в серверном пилоте.'}
      </InfoStrip>
      <div className="stats-grid">
        {[
          {
            label: 'Активные события',
            value: events.filter((e) => !['Черновик', 'Завершено', 'Отменено'].includes(e.status))
              .length,
            icon: FileCheck2,
          },
          { label: 'Открытые обращения', value: tickets.length - done.length, icon: MessageSquare },
          { label: 'Черновики к проверке', value: drafts.length, icon: CalendarDays },
          { label: 'Выполненные заявки', value: done.length, icon: CheckCircle2 },
        ].map(({ label, value, icon: Icon }) => (
          <div className="panel stat" key={label}>
            <div>
              <span>{label}</span>
              <Icon size={19} />
            </div>
            <strong>{value}</strong>
            <small>По выбранному адресу</small>
          </div>
        ))}
      </div>
      <div className="filter-tabs admin-tabs">
        {[
          ['overview', 'Обзор'],
          ['events', 'События'],
          ['tickets', 'Обращения'],
          ['schedules', 'Графики'],
          ...(role === 'admin' ? [['organizations', 'Организации']] : []),
        ].map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {(tab === 'overview' || tab === 'events') && (
        <>
          <SectionHeading title="События по адресу" count={events.length} />
          <div className="admin-events">
            {events.map((e) => (
              <div className="panel admin-event" key={e.id}>
                <ServiceIcon category={e.category} />
                <div>
                  <h3>{e.title}</h3>
                  <small className="muted">
                    {e.addresses.length} {e.addresses.length === 1 ? 'дом' : 'дома'} · обновлено{' '}
                    {dateText(e.updated)}
                  </small>
                </div>
                <StatusPill status={e.status} />
                <button
                  className="outline"
                  onClick={() =>
                    open(
                      e.status === 'Черновик'
                        ? { type: 'event', event: e }
                        : { type: 'event-edit', event: e },
                    )
                  }
                >
                  {e.status === 'Черновик' ? 'Проверить' : 'Изменить'}
                </button>
              </div>
            ))}
          </div>
          {!events.length && (
            <Empty
              title="Событий пока нет"
              action={
                <button className="primary" onClick={() => open({ type: 'event-create' })}>
                  Создать первое событие
                </button>
              }
            >
              Можно сначала сохранить черновик и проверить информацию без рассылки.
            </Empty>
          )}
        </>
      )}
      {(tab === 'overview' || tab === 'tickets') && (
        <>
          <SectionHeading title="Обращения" count={tickets.length}>
            <button className="text-link" onClick={() => exportReadings(state)}>
              <Download size={16} />
              Выгрузить показания
            </button>
          </SectionHeading>
          {tab === 'tickets' && (
            <div className="ticket-status-tabs">
              {['all', 'Новая', 'Принята', 'В работе', 'Выполнена', 'Закрыта'].map((s) => (
                <button
                  key={s}
                  className={ticketFilter === s ? 'active' : ''}
                  onClick={() => setTicketFilter(s)}
                >
                  {s === 'all' ? 'Все' : s}
                  <span>{tickets.filter((t) => s === 'all' || t.status === s).length}</span>
                </button>
              ))}
            </div>
          )}
          {tickets
            .filter((t) => ticketFilter === 'all' || t.status === ticketFilter)
            .sort(
              (a, b) =>
                Number(b.priority === 'Повышенная') - Number(a.priority === 'Повышенная') ||
                a.created.localeCompare(b.created),
            )
            .map((t) => (
              <div className="panel admin-event" key={t.id}>
                <ServiceIcon category={t.category} />
                <div>
                  <button
                    className="inline-title"
                    onClick={() => open({ type: 'ticket-detail', ticket: t })}
                  >
                    <h3>{t.title}</h3>
                  </button>
                  <small className="muted">
                    {t.id.slice(0, 12)} · {t.status}
                  </small>
                  {t.priority === 'Повышенная' && <Pill tone="warning">Повышенное внимание</Pill>}
                </div>
                <StatusPill status={t.status} />
                {t.status !== 'Закрыта' && (
                  <button
                    className="outline"
                    onClick={() => open({ type: 'ticket-status', ticket: t })}
                  >
                    Обработать
                  </button>
                )}
              </div>
            ))}
          {!tickets.length && (
            <Empty title="Обращений пока нет">Новые заявки появятся в этой очереди.</Empty>
          )}
        </>
      )}
      {tab === 'schedules' && (
        <>
          <SectionHeading title="Графики обслуживания">
            <button className="primary" onClick={() => open({ type: 'schedule' })}>
              <Plus size={17} />
              Добавить график
            </button>
          </SectionHeading>
          {schedules.map((s) => (
            <div className="panel admin-event" key={s.id}>
              <ServiceIcon category={s.category} />
              <div>
                <h3>{s.title}</h3>
                <small>{s.when}</small>
              </div>
              <button className="outline" onClick={() => open({ type: 'schedule', schedule: s })}>
                Изменить
              </button>
            </div>
          ))}
          {!schedules.length && <Empty title="Графиков пока нет" />}
        </>
      )}
      {tab === 'organizations' && role === 'admin' && (
        <>
          <SectionHeading title="Организации и зоны ответственности">
            <button className="primary" onClick={() => open({ type: 'organization' })}>
              <Plus size={17} />
              Добавить организацию
            </button>
          </SectionHeading>
          <div className="contacts-grid">
            {state.organizations.map((o) => (
              <article className="panel contact-card" key={o.id}>
                <div className="card-top">
                  <Building2 size={23} />
                  <Pill tone={o.connected ? 'success' : 'neutral'}>
                    {o.connected ? 'Кабинет подключён' : 'Не подключена'}
                  </Pill>
                </div>
                <h3>{o.name}</h3>
                <p>{o.addresses.length} адреса в зоне обслуживания</p>
                <button
                  className="text-link"
                  onClick={() => open({ type: 'organization', organization: o })}
                >
                  Настроить
                  <ArrowUpRight size={16} />
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
