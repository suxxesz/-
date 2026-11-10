import { type State, type Role, type CityEvent, services, uid, validateReading } from './types';
import { parseAction, type Action } from './contracts';
import { eventTime } from '../../../shared/lib/dates';
export type { Action } from './contracts';
function checkVersion(record: { version?: number }, expected?: number) {
  if (expected !== undefined && expected !== (record.version || 1))
    throw Error('Запись уже изменена другим сотрудником. Обновите данные и повторите действие.');
}
function notify(s: State, event: CityEvent, now: string) {
  if (
    s.addresses.some(
      (a) =>
        event.addresses.includes(a) &&
        (
          s.subscriptionsByAddress?.[a] ||
          (a === s.activeAddress ? s.subscriptions : services.map((x) => x.id))
        ).includes(event.category),
    )
  )
    s.notices.unshift({
      id: uid('nt'),
      text: `${event.title}: ${event.status}. ${event.addresses.join('; ')}`,
      read: false,
      created: now,
    });
}
export function applyAction(input: State, raw: Action | unknown, role: Role = 'resident'): State {
  const action = parseAction(raw),
    s = structuredClone(input),
    now = new Date().toISOString();
  const address = (a: string) => {
    if (!s.addresses.includes(a)) throw Error('Выберите сохранённый адрес.');
    return a;
  };
  if (
    (action.type.startsWith('event.') ||
      ['ticket.status', 'report.status', 'schedule.save'].includes(action.type)) &&
    role === 'resident'
  )
    throw Error('Необходимы права диспетчера.');
  switch (action.type) {
    case 'address.add': {
      const { address: a } = action.payload;
      if (s.addresses.length >= 10) throw Error('Можно сохранить до 10 адресов.');
      if (s.addresses.includes(a)) throw Error('Адрес уже сохранён.');
      s.subscriptionsByAddress = {
        ...s.subscriptionsByAddress,
        [s.activeAddress]: s.subscriptions,
      };
      s.addresses.push(a);
      s.activeAddress = a;
      s.subscriptions = services.map((x) => x.id);
      s.subscriptionsByAddress[a] = s.subscriptions;
      break;
    }
    case 'address.select':
      s.subscriptionsByAddress = {
        ...s.subscriptionsByAddress,
        [s.activeAddress]: s.subscriptions,
      };
      s.activeAddress = address(action.payload.address);
      s.subscriptions = s.subscriptionsByAddress[s.activeAddress] || services.map((x) => x.id);
      break;
    case 'subscriptions':
      s.subscriptions = [...new Set(action.payload.categories)];
      s.subscriptionsByAddress = {
        ...s.subscriptionsByAddress,
        [s.activeAddress]: s.subscriptions,
      };
      break;
    case 'notices.read':
      s.notices.forEach((n) => (n.read = true));
      break;
    case 'meter.create': {
      const p = action.payload;
      address(p.address);
      if (!services.find((x) => x.id === p.category)?.meter)
        throw Error('Для услуги не предусмотрен счётчик.');
      if (
        s.meters.some(
          (m) => m.address === p.address && m.category === p.category && m.serial === p.serial,
        )
      )
        throw Error('Счётчик с таким номером уже добавлен.');
      s.meters.push({ ...p, id: uid('meter'), created: now });
      break;
    }
    case 'reading.create': {
      const p = action.payload;
      address(p.address);
      if (
        p.meterId &&
        !s.meters.some(
          (m) => m.id === p.meterId && m.address === p.address && m.category === p.category,
        )
      )
        throw Error('Счётчик не найден для выбранной услуги и адреса.');
      const err = validateReading(
        s,
        p.address,
        p.category,
        p.value,
        p.period,
        p.meterId,
        p.confirmed,
      );
      if (err) throw Error(err);
      const last = s.readings
        .filter(
          (r) =>
            r.address === p.address &&
            r.category === p.category &&
            (!p.meterId ||
              r.meterId === p.meterId ||
              (!r.meterId && p.meterId.startsWith('legacy:'))),
        )
        .sort((a, b) => b.period.localeCompare(a.period))[0];
      s.readings.unshift({
        ...p,
        id: uid('rd'),
        previous: last?.value ?? s.meters.find((m) => m.id === p.meterId)?.initialValue ?? 0,
        status: 'Сохранено в сервисе',
        created: now,
      });
      delete (s.readings[0] as { confirmed?: boolean }).confirmed;
      break;
    }
    case 'ticket.create': {
      const p = action.payload;
      address(p.address);
      s.tickets.unshift({
        ...p,
        id: uid('REQ'),
        status: 'Новая',
        created: now,
        version: 1,
        history: [
          `${now} · Сохранено в сервисе. Официальное принятие организацией не подтверждено.`,
        ],
      });
      break;
    }
    case 'report.create': {
      const p = action.payload;
      s.reports = s.reports || [];
      s.reports.unshift({
        ...p,
        id: uid('JB'),
        status: 'Принято',
        created: now,
        version: 1,
        history: [`${now} · Принято. Заявка сохранена в сервисе.`],
      });
      break;
    }
    case 'report.status': {
      const p = action.payload,
        r = (s.reports || []).find((x) => x.id === p.id);
      if (!r) throw Error('Жалоба не найдена.');
      checkVersion(r, p.expectedVersion);
      const order = ['Принято', 'В работе', 'Исполнено'];
      if (order.indexOf(p.status) !== order.indexOf(r.status) + 1)
        throw Error('Статусы меняются последовательно: Принято → В работе → Исполнено.');
      if (p.status === 'Исполнено' && !p.reportPhoto)
        throw Error('Для закрытия приложите фотоотчёт о выполненной работе.');
      r.status = p.status;
      if (p.reportPhoto) r.reportPhoto = p.reportPhoto;
      r.version = (r.version || 1) + 1;
      r.history.push(`${now} · ${p.status}. ${p.comment}`);
      s.notices.unshift({
        id: uid('nt'),
        text: `Жалоба «${r.title}»: ${p.status}`,
        read: false,
        created: now,
      });
      break;
    }
    case 'ticket.reopen': {
      const p = action.payload,
        t = s.tickets.find((t) => t.id === p.id);
      if (!t || !['Закрыта', 'Выполнена'].includes(t.status))
        throw Error('Заявку пока нельзя открыть повторно.');
      checkVersion(t, p.expectedVersion);
      t.status = 'Новая';
      t.version = (t.version || 1) + 1;
      t.history.push(`${now} · Житель сообщил, что проблема осталась.`);
      break;
    }
    case 'ticket.status': {
      const p = action.payload,
        t = s.tickets.find((t) => t.id === p.id);
      if (!t) throw Error('Заявка не найдена.');
      checkVersion(t, p.expectedVersion);
      const transitions: Record<string, string> = {
        Новая: 'Принята',
        Принята: 'В работе',
        'В работе': 'Выполнена',
        Выполнена: 'Закрыта',
      };
      if (transitions[t.status] !== p.status) throw Error('Недопустимый переход статуса.');
      t.status = p.status;
      t.version = (t.version || 1) + 1;
      t.history.push(`${now} · ${p.status}: ${p.comment}`);
      break;
    }
    case 'event.create': {
      const p = action.payload;
      p.addresses.forEach(address);
      const start = eventTime(p.start),
        end = p.end ? eventTime(p.end) : '';
      if (end && end <= start) throw Error('Окончание должно быть позже начала.');
      const e: CityEvent = {
        ...p,
        id: uid('evt'),
        addresses: [...new Set(p.addresses)],
        start,
        end,
        status: p.draft ? 'Черновик' : 'Запланировано',
        updated: now,
        version: 1,
        history: [
          `${now} · ${p.draft ? 'Черновик сохранён без рассылки.' : 'Событие опубликовано.'}`,
        ],
      };
      s.events.unshift(e);
      if (!p.draft) notify(s, e, now);
      break;
    }
    case 'event.publish': {
      const p = action.payload,
        e = s.events.find((e) => e.id === p.id);
      if (!e || e.status !== 'Черновик') throw Error('Опубликовать можно только черновик.');
      checkVersion(e, p.expectedVersion);
      e.status = 'Запланировано';
      e.version = (e.version || 1) + 1;
      e.updated = now;
      e.history.push(`${now} · Проверено и опубликовано диспетчером.`);
      notify(s, e, now);
      break;
    }
    case 'event.update': {
      const p = action.payload,
        e = s.events.find((e) => e.id === p.id);
      if (!e) throw Error('Событие не найдено.');
      checkVersion(e, p.expectedVersion);
      if (e.status === 'Черновик' || p.status === 'Черновик')
        throw Error('Используйте проверку и публикацию черновика.');
      const end = p.end ? eventTime(p.end) : '';
      if (end && end <= e.start) throw Error('Окончание должно быть позже начала.');
      e.status = p.status;
      e.end = end;
      e.updated = now;
      e.version = (e.version || 1) + 1;
      e.history.push(`${now} · ${p.status}: ${p.comment}`);
      notify(s, e, now);
      break;
    }
    case 'schedule.save': {
      const p = action.payload;
      address(p.address);
      const existing = s.schedules.find((x) => x.id === p.id);
      if (p.id && !existing) throw Error('График не найден.');
      const record = { ...p, id: p.id || uid('schedule') };
      s.schedules = existing
        ? s.schedules.map((x) => (x.id === p.id ? record : x))
        : [record, ...s.schedules];
      break;
    }
    case 'organization.save': {
      if (role !== 'admin') throw Error('Необходимы права администратора.');
      const p = action.payload;
      const conflict = s.organizations.find(
        (o) =>
          o.id !== p.id &&
          o.categories.some((c) => p.categories.includes(c)) &&
          o.addresses.some((a) => p.addresses.includes(a)),
      );
      if (conflict)
        throw Error(`Зона обслуживания пересекается с организацией «${conflict.name}».`);
      const o = { ...p, id: p.id || uid('org') };
      s.organizations = s.organizations.some((x) => x.id === o.id)
        ? s.organizations.map((x) => (x.id === o.id ? o : x))
        : [o, ...s.organizations];
      break;
    }
  }
  return s;
}
