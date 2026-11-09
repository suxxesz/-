import {
  Plus,
  ArrowUpRight,
  Gauge,
  MessageSquare,
  CalendarDays,
  ShieldCheck,
  ArrowRight,
  Building2,
  Clock,
} from 'lucide-react';
import { services } from '@/entities/city/model/types';
import { useCity } from '@/entities/city/model/store';
import { navigate } from '@/shared/lib/navigation';
import { PageHeading, SectionHeading, ArrowLink, Empty } from '@/shared/ui/ui';
import { ServiceIcon, EventCard, StatusPill } from '@/entities/city/ui';
import { dateText } from '@/shared/lib/dates';
export default function Dashboard() {
  const { state, open } = useCity(),
    address = state.activeAddress;
  const events = state.events.filter(
    (e) =>
      e.addresses.includes(address) && !['Черновик', 'Завершено', 'Отменено'].includes(e.status),
  );
  const tickets = state.tickets.filter((t) => t.address === address),
    openTickets = tickets.filter((t) => !['Выполнена', 'Закрыта'].includes(t.status));
  return (
    <>
      <PageHeading
        title="Ваш дом. Всё под контролем."
        subtitle="Коммунальные вопросы решаются здесь — спокойно и по порядку."
      >
        <button className="outline" onClick={() => open({ type: 'address' })}>
          <Plus size={18} />
          Добавить адрес
        </button>
      </PageHeading>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-label">
            <span />
            Единое окно коммунальных услуг
          </span>
          <h2>
            Меньше забот.
            <br />
            Больше домашнего тепла.
          </h2>
          <p>
            Знайте о работах заранее, передавайте показания
            <br className="desktop-only" /> и следите за решением вопросов вашего дома.
          </p>
          <button className="primary" onClick={() => open({ type: 'ticket' })}>
            Сообщить о проблеме
            <ArrowUpRight size={18} />
          </button>
        </div>
        <div className="city-art" aria-hidden="true">
          <div className="sun" />
          <div className="cloud cloud-one" />
          <div className="cloud cloud-two" />
          <div className="back-building building-a" />
          <div className="back-building building-b" />
          <div className="building tall">
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <div className="building short">
            {Array.from({ length: 6 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <div className="building house">
            <div className="roof" />
            <i />
            <i />
            <i />
            <i />
            <div className="door" />
          </div>
          <div className="tree tree-one" />
          <div className="tree tree-two" />
          <div className="ground" />
          <div className="hero-float">
            <ShieldCheck size={22} />
            <div>
              Ваш дом — в центре внимания<small>8 коммунальных направлений</small>
            </div>
          </div>
        </div>
      </section>
      <div className="quick-actions">
        <button onClick={() => open({ type: 'reading' })}>
          <span className="quick-icon sage">
            <Gauge />
          </span>
          <div>
            <strong>Передать показания</strong>
            <small>Вода, свет и газ</small>
          </div>
          <ArrowUpRight size={19} />
        </button>
        <button onClick={() => open({ type: 'ticket' })}>
          <span className="quick-icon peach">
            <MessageSquare />
          </span>
          <div>
            <strong>Оставить заявку</strong>
            <small>С историей и статусом</small>
          </div>
          <ArrowUpRight size={19} />
        </button>
        <button onClick={() => navigate('schedule')}>
          <span className="quick-icon lavender">
            <CalendarDays />
          </span>
          <div>
            <strong>Узнать график</strong>
            <small>Обслуживание вашего дома</small>
          </div>
          <ArrowUpRight size={19} />
        </button>
      </div>
      {!address && (
        <div className="onboarding-banner">
          <Building2 size={26} />
          <div>
            <h3>Начнём с вашего дома</h3>
            <p>Добавьте адрес, чтобы видеть события и сохранять показания.</p>
          </div>
          <button className="primary" onClick={() => open({ type: 'address' })}>
            Выбрать адрес
            <ArrowRight size={17} />
          </button>
        </div>
      )}
      <div className="overview-strip">
        <div>
          <span className="metric-dot amber" />
          <strong>{events.length}</strong>
          <span>предстоящих и текущих событий</span>
        </div>
        <div>
          <MessageSquare size={16} />
          <strong>{openTickets.length}</strong>
          <span>заявок в работе</span>
        </div>
        <button onClick={() => navigate('settings')}>
          <ShieldCheck size={16} />
          Уведомления по адресу
          <ArrowRight size={15} />
        </button>
      </div>
      <SectionHeading title="Услуги вашего дома" count={services.length}>
        <span className="muted">По выбранному адресу</span>
      </SectionHeading>
      <div className="services-grid">
        {services.map((s) => {
          const count = events.filter((e) => e.category === s.id).length;
          return (
            <button
              key={s.id}
              className="service-card"
              onClick={() => open({ type: 'service', category: s.id })}
            >
              <div>
                <ServiceIcon category={s.id} />
                <ArrowUpRight size={17} className="muted" />
              </div>
              <h3>{s.name}</h3>
              <span className={'service-status ' + (count ? 'warning' : '')}>
                {count ? (
                  <>
                    <i />
                    {count} {count === 1 ? 'событие' : 'события'}
                  </>
                ) : (
                  'Нет опубликованных данных'
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="lower-grid">
        <section>
          <SectionHeading title="Важно знать" count={events.length}>
            <ArrowLink onClick={() => navigate('events')}>Все события</ArrowLink>
          </SectionHeading>
          <div className="event-grid">
            {events.slice(0, 2).map((e) => (
              <EventCard event={e} key={e.id} />
            ))}
            {!events.length && (
              <Empty title="Активных событий нет">
                По выбранному адресу пока нет новых публикаций.
              </Empty>
            )}
          </div>
        </section>
        <section>
          <SectionHeading title="Мои заявки">
            <ArrowLink onClick={() => navigate('tickets')}>Все</ArrowLink>
          </SectionHeading>
          {tickets.slice(0, 2).map((t) => (
            <button
              key={t.id}
              className="ticket-preview"
              onClick={() => open({ type: 'ticket-detail', ticket: t })}
            >
              <div>
                <small>{t.id.slice(0, 12)}</small>
                <StatusPill status={t.status} />
              </div>
              <h3>{t.title}</h3>
              <span>
                <Clock size={13} />
                {dateText(t.created)}
                <ArrowUpRight size={16} />
              </span>
            </button>
          ))}
          {!tickets.length && <Empty title="Заявок пока нет">Ваши обращения появятся здесь.</Empty>}
          <button className="add-ticket" onClick={() => open({ type: 'ticket' })}>
            <Plus size={17} />
            Новая заявка
          </button>
        </section>
      </div>
    </>
  );
}
