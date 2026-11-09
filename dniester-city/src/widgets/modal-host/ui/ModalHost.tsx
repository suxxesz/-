import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { X, ArrowRight, MapPin, Plus, ShieldCheck, Bell, ExternalLink, Check } from 'lucide-react';
import { useCity, type ModalSpec } from '@/entities/city/model/store';
import {
  type Category,
  type CityEvent,
  type Ticket,
  services,
  serviceById,
  dateText,
  timeText,
} from '@/entities/city/model/types';
import { type Action, parseAction } from '@/entities/city/model/contracts';
import { currentPeriod, wallTime } from '@/shared/lib/dates';
import { serverMode, resetDemo, request } from '@/entities/city/api/client';
import { Pill, InfoStrip, Empty } from '@/shared/ui/ui';
import { ServiceIcon, StatusPill } from '@/entities/city/ui';
function sourceLink(url?: string) {
  return url?.startsWith('https://') ? (
    <a className="text-link" href={url} target="_blank" rel="noopener noreferrer">
      Открыть первоисточник
      <ExternalLink size={15} />
    </a>
  ) : null;
}
const titles: Record<ModalSpec['type'], string> = {
  reading: 'Передать показания',
  meter: 'Добавить счётчик',
  ticket: 'Сообщить о проблеме',
  address: 'Добавить адрес',
  'event-create': 'Новое коммунальное событие',
  event: 'Информация о событии',
  'event-edit': 'Обновить событие',
  'ticket-detail': 'История обращения',
  'ticket-status': 'Обработка заявки',
  organization: 'Организация и её зона',
  schedule: 'График обслуживания',
  notices: 'Уведомления',
  service: 'Услуга вашего дома',
  reset: 'Сбросить демо?',
};
export default function ModalHost() {
  const { modal, close, busy } = useCity();
  if (!modal) return null;
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <Dialog>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">Мой город {!serverMode && '· Демо'}</span>
            <h2 id="dialog-title">{titles[modal.type]}</h2>
          </div>
          <button className="icon-button" disabled={busy} aria-label="Закрыть окно" onClick={close}>
            <X size={23} />
          </button>
        </div>
        <ModalBody modal={modal} />
      </Dialog>
    </div>
  );
}
function Dialog({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null),
    { close } = useCity();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
      if (e.key !== 'Tab') return;
      const els = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea,[href]',
        ) || [],
      ).filter((element) => element.getClientRects().length > 0);
      if (!els?.length) return;
      const first = els[0],
        last = els[els.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first || document.activeElement === ref.current)
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last || document.activeElement === ref.current)
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keys);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keys);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal"
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      {children}
    </div>
  );
}
function ModalBody({ modal }: { modal: ModalSpec }) {
  const { state, role, open, act, busy, error } = useCity();
  if (
    [
      'reading',
      'meter',
      'ticket',
      'address',
      'event-create',
      'event-edit',
      'ticket-status',
      'organization',
      'schedule',
    ].includes(modal.type)
  )
    return <ActionForm key={modal.type} modal={modal} />;
  if (modal.type === 'reset')
    return (
      <>
        <p>
          Все учебные изменения в этом браузере будут удалены. Исходные демонстрационные данные
          восстановятся.
        </p>
        <button className="primary submit" onClick={resetDemo}>
          Сбросить данные
        </button>
      </>
    );
  if (modal.type === 'notices')
    return (
      <>
        <p className="hint">
          {serverMode
            ? 'Уведомления кабинета и задания на отправку в Telegram.'
            : 'В деморежиме сообщения появляются здесь, без отправки в Telegram.'}
        </p>
        {state.notices.map((n) => (
          <article className={'notice ' + (n.read ? '' : 'unread')} key={n.id}>
            <Bell size={19} />
            <div>
              <p>{n.text}</p>
              <small>
                {dateText(n.created)} · {timeText(n.created)}
              </small>
            </div>
          </article>
        ))}
        {!state.notices.length && <Empty title="Новых уведомлений нет" />}
        <button
          className="outline submit"
          disabled={busy}
          onClick={() => act({ type: 'notices.read', payload: {} }, 'Уведомления прочитаны')}
        >
          Отметить все прочитанными
        </button>
      </>
    );
  if (modal.type === 'service') {
    const s = serviceById(modal.category),
      events = state.events.filter(
        (e) =>
          e.category === s.id &&
          e.addresses.includes(state.activeAddress) &&
          e.status !== 'Черновик',
      ),
      org = state.organizations.find(
        (o) => o.categories.includes(s.id) && o.addresses.includes(state.activeAddress),
      );
    return (
      <>
        <div className="detail-meta">
          <ServiceIcon category={s.id} />
          <div>
            <h3>{s.name}</h3>
            <Pill tone={org?.connected ? 'success' : 'neutral'}>
              {org?.connected ? 'Кабинет организации подключён' : 'Организация не подключена'}
            </Pill>
          </div>
        </div>
        <p>{org?.name || 'Ответственная организация ещё не назначена.'}</p>
        <h3>События по адресу</h3>
        {events.map((e) => (
          <button
            className="address-row"
            key={e.id}
            onClick={() => open({ type: 'event', event: e })}
          >
            {e.title}
            <ArrowRight size={17} />
          </button>
        ))}
        {!events.length && (
          <p className="muted">
            Нет опубликованных данных. Это не подтверждает отсутствие перебоев.
          </p>
        )}
        <div className="modal-actions">
          <button className="primary" onClick={() => open({ type: 'ticket', category: s.id })}>
            Оставить заявку
          </button>
          {s.meter && (
            <button className="outline" onClick={() => open({ type: 'reading', category: s.id })}>
              Подать показания
            </button>
          )}
        </div>
      </>
    );
  }
  if (modal.type === 'event') {
    const e = state.events.find((x) => x.id === modal.event.id) || modal.event;
    return (
      <>
        <div className="detail-meta">
          <ServiceIcon category={e.category} />
          <StatusPill status={e.status} />
        </div>
        <h3 className="detail-title">{e.title}</h3>
        <p>{e.description}</p>
        <dl className="detail-list">
          <dt>Затронутые адреса</dt>
          <dd>{e.addresses.join('; ')}</dd>
          <dt>Начало</dt>
          <dd>
            {dateText(e.start)}, {timeText(e.start)}
          </dd>
          <dt>Ожидаемое окончание</dt>
          <dd>{e.end ? `${dateText(e.end)}, ${timeText(e.end)}` : 'Срок неизвестен'}</dd>
          <dt>Источник</dt>
          <dd>{e.source}</dd>
          <dt>Обновлено</dt>
          <dd>
            {dateText(e.updated)}, {timeText(e.updated)}
          </dd>
        </dl>
        {sourceLink(e.sourceUrl)}
        <h3>История изменений</h3>
        <Timeline entries={e.history} />
        {role !== 'resident' && e.status === 'Черновик' && <PublishDraft event={e} />}
      </>
    );
  }
  if (modal.type === 'ticket-detail') {
    const t = state.tickets.find((x) => x.id === modal.ticket.id) || modal.ticket;
    return (
      <>
        <StatusPill status={t.status} />
        <h3 className="detail-title">{t.title}</h3>
        <p>{t.description}</p>
        <p className="muted">{t.address}</p>
        <div className="ticket-progress">
          {['Новая', 'Принята', 'В работе', 'Выполнена', 'Закрыта'].map((v, i) => (
            <div
              key={v}
              className={
                i <= ['Новая', 'Принята', 'В работе', 'Выполнена', 'Закрыта'].indexOf(t.status)
                  ? 'done'
                  : ''
              }
            >
              <span>
                {i < ['Новая', 'Принята', 'В работе', 'Выполнена', 'Закрыта'].indexOf(t.status) ? (
                  <Check size={12} />
                ) : (
                  i + 1
                )}
              </span>
              <small>{v}</small>
            </div>
          ))}
        </div>
        <h3>История</h3>
        <Timeline entries={t.history} />
        {['Выполнена', 'Закрыта'].includes(t.status) && (
          <button
            className="outline"
            disabled={busy}
            onClick={() =>
              act(
                { type: 'ticket.reopen', payload: { id: t.id, expectedVersion: t.version } },
                'Заявка открыта повторно',
              )
            }
          >
            Проблема осталась
          </button>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </>
    );
  }
  return null;
}
function Timeline({ entries }: { entries: string[] }) {
  return (
    <ol className="timeline">
      {entries.map((h, i) => {
        const match = h.match(/^(\d{4}-\d{2}-\d{2}T[^ ]+) · (.*)$/);
        return (
          <li key={i}>
            {match ? (
              <>
                <time>
                  {dateText(match[1])}, {timeText(match[1])}
                </time>
                <span>{match[2]}</span>
              </>
            ) : (
              h
            )}
          </li>
        );
      })}
    </ol>
  );
}
function PublishDraft({ event }: { event: CityEvent }) {
  const { act, busy, error } = useCity(),
    [checked, setChecked] = useState(false);
  return (
    <div className="publish-draft">
      <InfoStrip>
        Черновик ещё не виден жителям. При публикации будут созданы уведомления для подписчиков
        затронутых адресов и услуги.
      </InfoStrip>
      <label className="checkbox-line">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />Я
        проверил источник, адреса и время
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="primary submit"
        disabled={!checked || busy}
        onClick={() =>
          act(
            { type: 'event.publish', payload: { id: event.id, expectedVersion: event.version } },
            'Событие проверено и опубликовано',
          )
        }
      >
        Опубликовать для жителей
        <ArrowRight size={17} />
      </button>
    </div>
  );
}
function ActionForm({ modal }: { modal: ModalSpec }) {
  const { state, act, busy, error, open } = useCity(),
    address = state.activeAddress;
  const initialCategory =
    'category' in modal
      ? modal.category
      : modal.type === 'schedule'
        ? modal.schedule?.category
        : undefined;
  const [category, setCategory] = useState<Category>(initialCategory || 'water'),
    [meterId, setMeterId] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [formError, setFormError] = useState(''),
    [preview, setPreview] = useState<Extract<Action, { type: 'event.create' }> | null>(null),
    [recipientCount, setRecipientCount] = useState<number | null>(null),
    [previewBusy, setPreviewBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null),
    reviewRef = useRef<HTMLDivElement>(null),
    reviewed = useRef(false);
  useEffect(() => {
    if (preview) {
      reviewed.current = true;
      reviewRef.current?.focus();
    } else if (reviewed.current) {
      formRef.current?.querySelector<HTMLElement>('select,input')?.focus();
    }
  }, [preview]);
  const meters = state.meters.filter((m) => m.address === address && m.category === category),
    meter = meters.find((m) => m.id === meterId) || meters[0];
  const last = state.readings
    .filter((r) => r.meterId === meter?.id)
    .sort((a, b) => b.period.localeCompare(a.period))[0];
  const org = state.organizations.find(
    (o) => o.categories.includes(category) && o.addresses.includes(address),
  );
  const event = modal.type === 'event-edit' ? modal.event : undefined,
    ticket = modal.type === 'ticket-status' ? modal.ticket : undefined,
    schedule = modal.type === 'schedule' ? modal.schedule : undefined,
    organization = modal.type === 'organization' ? modal.organization : undefined;
  const selectCategory = (meterOnly = false) => (
    <label>
      Услуга
      <select
        name="category"
        value={category}
        onChange={(e) => {
          setCategory(e.target.value as Category);
          setMeterId('');
        }}
      >
        {services
          .filter((s) => !meterOnly || s.meter)
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
      </select>
    </label>
  );
  const text = (
    name: string,
    label: string,
    defaultValue = '',
    maxLength = 180,
    placeholder = '',
  ) => (
    <label>
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        maxLength={maxLength}
        placeholder={placeholder}
        required
      />
    </label>
  );
  const area = (name: string, label: string, defaultValue = '', placeholder = '') => (
    <label>
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue}
        maxLength={2000}
        placeholder={placeholder}
        required
      />
    </label>
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');
    const fd = new FormData(e.currentTarget),
      s = (name: string) => String(fd.get(name) || '');
    let action: Action;
    switch (modal.type) {
      case 'address':
        action = {
          type: 'address.add',
          payload: { address: `${s('city')}, ${s('street')}, ${s('house')}` },
        };
        break;
      case 'meter':
        action = {
          type: 'meter.create',
          payload: {
            address,
            category,
            name: s('name'),
            serial: s('serial'),
            account: s('account'),
            initialValue: Number(s('initialValue')),
          },
        };
        break;
      case 'reading':
        action = {
          type: 'reading.create',
          payload: {
            address,
            category,
            meterId: meter?.id,
            value: Number(s('value')),
            period: s('period'),
            confirmed,
          },
        };
        break;
      case 'ticket':
        action = {
          type: 'ticket.create',
          payload: {
            address,
            category,
            title: s('title'),
            description: s('description'),
            priority: s('priority') as 'Обычная' | 'Повышенная',
          },
        };
        break;
      case 'event-create':
        action = {
          type: 'event.create',
          payload: {
            category,
            title: s('title'),
            description: s('description'),
            source: s('source'),
            sourceUrl: s('sourceUrl'),
            addresses: fd.getAll('addresses').map(String),
            start: s('start'),
            end: s('end'),
            draft: (e.nativeEvent as SubmitEvent).submitter?.getAttribute('data-mode') === 'draft',
          },
        };
        break;
      case 'event-edit':
        action = {
          type: 'event.update',
          payload: {
            id: event!.id,
            status: s('status') as CityEvent['status'],
            end: s('end'),
            comment: s('comment'),
            expectedVersion: event!.version,
          },
        };
        break;
      case 'ticket-status':
        action = {
          type: 'ticket.status',
          payload: {
            id: ticket!.id,
            status: s('status') as Ticket['status'],
            comment: s('comment'),
            expectedVersion: ticket!.version,
          },
        };
        break;
      case 'schedule':
        action = {
          type: 'schedule.save',
          payload: {
            id: schedule?.id,
            address,
            category,
            title: s('title'),
            when: s('when'),
            description: s('description'),
            source: s('source'),
          },
        };
        break;
      case 'organization':
        action = {
          type: 'organization.save',
          payload: {
            id: organization?.id,
            name: s('name'),
            categories: fd.getAll('categories') as Category[],
            addresses: fd.getAll('addresses').map(String),
            connected: fd.get('connected') === 'on',
            sourceUrl: s('sourceUrl'),
          },
        };
        break;
      default:
        return;
    }
    try {
      parseAction(action);
      if (action.type === 'event.create' && !action.payload.draft) {
        setPreviewBusy(true);
        if (serverMode) {
          const data = (await request('/publication-preview', {
            method: 'POST',
            body: JSON.stringify(action),
          })) as { recipientCount: number };
          setRecipientCount(data.recipientCount);
        }
        setPreview(action);
        return;
      }
      await act(
        action,
        action.type === 'event.create'
          ? 'Черновик сохранён без рассылки'
          : action.type === 'reading.create'
            ? 'Показания сохранены в сервисе'
            : 'Изменения сохранены',
      );
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setPreviewBusy(false);
    }
  }
  let review: ReactNode = null;
  if (preview) {
    const p = preview.payload;
    review = (
      <>
        <div className="review-heading" ref={reviewRef} tabIndex={-1}>
          <ShieldCheck size={29} />
          <h3>Проверьте перед публикацией</h3>
          <p>После подтверждения событие станет доступно жителям.</p>
        </div>
        <dl className="detail-list">
          <dt>Событие</dt>
          <dd>{p.title}</dd>
          <dt>Услуга</dt>
          <dd>{serviceById(p.category).name}</dd>
          <dt>Адреса</dt>
          <dd>{p.addresses.join('; ')}</dd>
          <dt>Начало</dt>
          <dd>{p.start.replace('T', ' ')}</dd>
          <dt>Окончание</dt>
          <dd>{p.end?.replace('T', ' ') || 'Срок неизвестен'}</dd>
          <dt>Источник</dt>
          <dd>{p.source}</dd>
          <dt>Рассылка</dt>
          <dd>
            {serverMode ? `${recipientCount} подписчиков` : 'Учебный кабинет в этом браузере'}
          </dd>
        </dl>
        <div className="notification-preview">
          <Bell size={19} />
          <div>
            <strong>{p.title}</strong>
            <p>{p.description}</p>
            <small>
              {p.addresses.length} {p.addresses.length === 1 ? 'адрес' : 'адреса'} ·{' '}
              {serviceById(p.category).name}
            </small>
          </div>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="outline" disabled={busy} onClick={() => setPreview(null)}>
            Вернуться к форме
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => act(preview, 'Событие опубликовано')}
          >
            {busy ? 'Публикуем…' : 'Опубликовать событие'}
            <ArrowRight size={17} />
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      {review}
      <form ref={formRef} hidden={Boolean(preview)} onSubmit={submit}>
        {['reading', 'meter', 'ticket', 'schedule'].includes(modal.type) && (
          <p className="form-address">
            <MapPin size={17} />
            {address || 'Сначала добавьте адрес'}
          </p>
        )}
        {['reading', 'meter', 'ticket', 'event-create', 'schedule'].includes(modal.type) &&
          selectCategory(['reading', 'meter'].includes(modal.type))}
        {modal.type === 'reading' && (
          <>
            {error?.includes('лишний ноль') && (
              <label className="check">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />{' '}
                Да, значение верно — отправить как есть
              </label>
            )}
            {meters.length ? (
              <>
                <label>
                  Счётчик
                  <select
                    name="meterId"
                    value={meter?.id || ''}
                    onChange={(e) => setMeterId(e.target.value)}
                  >
                    {meters.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} · № {m.serial}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="previous-reading">
                  <GaugeValue
                    value={last?.value ?? meter.initialValue}
                    unit={serviceById(category).unit}
                  />
                  <span>{last ? 'Последнее показание' : 'Начальное значение'}</span>
                </div>
                <div className="form-grid">
                  <label>
                    Период
                    <input
                      type="month"
                      name="period"
                      defaultValue={serverMode ? currentPeriod() : '2026-10'}
                      required
                    />
                  </label>
                  <label>
                    Новое значение
                    <input
                      name="value"
                      type="number"
                      min="0"
                      max="1000000000000"
                      step="0.001"
                      placeholder="Например, 1280"
                      required
                    />
                  </label>
                </div>
                <p className="hint">
                  Подтверждение сохранит цифры в сервисе. Принятие поставщиком пока не подключено.
                </p>
              </>
            ) : (
              <Empty
                title="Для этой услуги нет счётчика"
                action={
                  <button type="button" className="primary" onClick={() => open({ type: 'meter' })}>
                    <Plus size={17} />
                    Добавить счётчик
                  </button>
                }
              >
                Сначала зарегистрируйте прибор и начальное значение.
              </Empty>
            )}
          </>
        )}
        {modal.type === 'meter' && (
          <>
            {text('name', 'Название счётчика', '', 80, 'Например, холодная вода · ванная')}
            {text('serial', 'Заводской номер', '', 80, 'Номер на корпусе счётчика')}
            <label>
              Лицевой счёт (необязательно)
              <input name="account" maxLength={80} />
            </label>
            <label>
              Начальное показание
              <input
                name="initialValue"
                type="number"
                min="0"
                max="1000000000000"
                step="0.001"
                required
              />
            </label>
            <p className="hint">
              Начальное показание — точка отсчёта расхода. Регистрация в сервисе не заменяет
              постановку прибора на учёт поставщиком.
            </p>
          </>
        )}
        {modal.type === 'ticket' && (
          <>
            {text('title', 'Кратко о проблеме', '', 160, 'Например, не вывезли мусор')}
            {area('description', 'Описание', '', 'Где возникла проблема и что произошло?')}
            <label>
              Приоритет
              <select name="priority">
                <option>Обычная</option>
                <option>Повышенная</option>
              </select>
            </label>
            {state.events.some(
              (e) =>
                e.category === category &&
                e.addresses.includes(address) &&
                !['Черновик', 'Завершено', 'Отменено'].includes(e.status),
            ) && (
              <InfoStrip>
                По этой услуге есть опубликованное событие. Оно может объяснять проблему — проверьте
                раздел «Отключения и работы».
              </InfoStrip>
            )}
            <p className="hint">
              Сохранение обращения не подтверждает официальное принятие организацией. Для опасной
              ситуации используйте проверенный местный аварийный контакт.
            </p>
          </>
        )}
        {modal.type === 'address' && (
          <>
            {text('city', 'Населённый пункт', '', 60, 'Тирасполь')}
            {text('street', 'Улица', '', 80, 'ул. Ленина')}
            {text('house', 'Дом и корпус', '', 20, '18')}
            <p className="hint">
              Адрес — подписка на опубликованные события. Он не подтверждает право собственности.
            </p>
          </>
        )}
        {modal.type === 'event-create' && (
          <>
            {text('title', 'Название', '', 160)}
            {area('description', 'Описание и причина')}
            {text(
              'source',
              'Источник',
              serverMode ? org?.name || '' : 'Учебная диспетчерская',
              180,
            )}
            <label>
              Ссылка на первоисточник (необязательно)
              <input type="url" name="sourceUrl" placeholder="https://…" />
            </label>
            <fieldset>
              <legend>Затронутые дома</legend>
              {state.addresses.map((a) => (
                <label className="checkbox-line" key={a}>
                  <input
                    type="checkbox"
                    name="addresses"
                    value={a}
                    defaultChecked={a === address}
                  />
                  {a}
                </label>
              ))}
            </fieldset>
            <div className="form-grid">
              <label>
                Начало
                <input type="datetime-local" name="start" required />
              </label>
              <label>
                Окончание, если известно
                <input type="datetime-local" name="end" />
              </label>
            </div>
            <p className="hint">
              Время по часовому поясу Europe/Chisinau. Черновик сохраняется без уведомлений;
              публикация требует проверки.
            </p>
          </>
        )}
        {modal.type === 'event-edit' && (
          <>
            <h3 className="detail-title">{event!.title}</h3>
            <label>
              Статус
              <select name="status" defaultValue={event!.status}>
                {['Запланировано', 'Выполняется', 'Завершено', 'Отменено'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Ожидаемое окончание
              <input type="datetime-local" name="end" defaultValue={wallTime(event!.end)} />
            </label>
            {area('comment', 'Причина изменения / результат')}
            <p className="hint">
              Изменение появится в истории и сформирует уведомления подписчикам.
            </p>
          </>
        )}
        {modal.type === 'ticket-status' && (
          <>
            <h3 className="detail-title">{ticket!.title}</h3>
            <label>
              Следующий статус
              <select name="status">
                <option>
                  {
                    (
                      {
                        Новая: 'Принята',
                        Принята: 'В работе',
                        'В работе': 'Выполнена',
                        Выполнена: 'Закрыта',
                      } as Record<string, string>
                    )[ticket!.status]
                  }
                </option>
              </select>
            </label>
            {area('comment', 'Результат / комментарий')}
          </>
        )}
        {modal.type === 'schedule' && (
          <>
            {text('title', 'Название графика', schedule?.title || '', 160)}
            {text(
              'when',
              'Когда проводится',
              schedule?.when || '',
              180,
              'Пн, ср, пт · 07:00–09:00',
            )}
            {area('description', 'Описание', schedule?.description || '')}
            {text(
              'source',
              'Источник',
              schedule?.source || (serverMode ? org?.name || '' : 'Учебная диспетчерская'),
            )}
          </>
        )}
        {modal.type === 'organization' && (
          <>
            {text('name', 'Название организации', organization?.name || '')}
            <label>
              Ссылка на официальный источник
              <input
                name="sourceUrl"
                type="url"
                defaultValue={organization?.sourceUrl || ''}
                placeholder="https://…"
              />
            </label>
            <fieldset>
              <legend>Услуги</legend>
              {services.map((s) => (
                <label className="checkbox-line" key={s.id}>
                  <input
                    name="categories"
                    type="checkbox"
                    value={s.id}
                    defaultChecked={organization?.categories.includes(s.id)}
                  />
                  {s.name}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Адреса обслуживания</legend>
              {state.addresses.map((a) => (
                <label className="checkbox-line" key={a}>
                  <input
                    name="addresses"
                    type="checkbox"
                    value={a}
                    defaultChecked={organization?.addresses.includes(a)}
                  />
                  {a}
                </label>
              ))}
            </fieldset>
            <label className="checkbox-line">
              <input type="checkbox" name="connected" defaultChecked={organization?.connected} />
              Организация работает в кабинете
            </label>
            <p className="hint">
              Подключение кабинета не означает интеграцию с учётной системой и официальное принятие
              показаний. Зоны организаций для одной услуги не должны пересекаться.
            </p>
          </>
        )}
        {(error || formError) && (
          <p className="form-error" role="alert">
            {formError || error}
          </p>
        )}
        {modal.type === 'event-create' ? (
          <div className="modal-actions">
            <button
              className="outline"
              type="submit"
              data-mode="draft"
              disabled={busy || previewBusy}
            >
              Сохранить черновик
            </button>
            <button
              className="primary"
              type="submit"
              data-mode="publish"
              disabled={busy || previewBusy}
            >
              {previewBusy ? 'Проверяем…' : 'Проверить публикацию'}
              <ArrowRight size={17} />
            </button>
          </div>
        ) : (
          <button
            className="primary submit"
            disabled={
              busy ||
              (['reading', 'meter', 'ticket', 'schedule'].includes(modal.type) && !address) ||
              (modal.type === 'reading' && !meter)
            }
          >
            {busy ? 'Сохраняем…' : 'Подтвердить и сохранить'}
            <ArrowRight size={17} />
          </button>
        )}
      </form>
    </>
  );
}
function GaugeValue({ value, unit }: { value: number; unit: string }) {
  return (
    <strong>
      {value.toLocaleString('ru-RU')} <small>{unit}</small>
    </strong>
  );
}
