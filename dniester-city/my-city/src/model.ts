export const categories = [
  'power',
  'gas',
  'water',
  'hotwater',
  'heat',
  'sewer',
  'waste',
  'house',
] as const;
export type Category = (typeof categories)[number];
export type Role = 'resident' | 'dispatcher' | 'admin';
export const services: {
  id: Category;
  name: string;
  short: string;
  color: string;
  meter: boolean;
  unit: string;
  org: string;
}[] = [
  {
    id: 'power',
    name: 'Электричество',
    short: 'Электричество',
    color: '#aa7a1e',
    meter: true,
    unit: 'кВт·ч',
    org: 'Электроснабжение',
  },
  {
    id: 'water',
    name: 'Холодная вода',
    short: 'Водоснабжение',
    color: '#357d9e',
    meter: true,
    unit: 'м³',
    org: 'Водоснабжение',
  },
  {
    id: 'hotwater',
    name: 'Горячая вода',
    short: 'Горячая вода',
    color: '#b56547',
    meter: true,
    unit: 'м³',
    org: 'Теплоснабжение',
  },
  {
    id: 'gas',
    name: 'Газоснабжение',
    short: 'Газоснабжение',
    color: '#7d65a5',
    meter: true,
    unit: 'м³',
    org: 'Газоснабжение',
  },
  {
    id: 'heat',
    name: 'Отопление',
    short: 'Отопление',
    color: '#b26443',
    meter: false,
    unit: '',
    org: 'Теплоснабжение',
  },
  {
    id: 'sewer',
    name: 'Водоотведение',
    short: 'Канализация',
    color: '#3f8987',
    meter: false,
    unit: '',
    org: 'Водоснабжение',
  },
  {
    id: 'waste',
    name: 'Вывоз отходов',
    short: 'Вывоз отходов',
    color: '#607e46',
    meter: false,
    unit: '',
    org: 'Вывоз отходов',
  },
  {
    id: 'house',
    name: 'Обслуживание дома',
    short: 'Мой дом',
    color: '#667c8e',
    meter: false,
    unit: '',
    org: 'Обслуживание дома',
  },
];
export const serviceById = (id: Category) => services.find((s) => s.id === id)!;
export const eventStatuses = [
  'Черновик',
  'Запланировано',
  'Выполняется',
  'Завершено',
  'Отменено',
] as const;
export const ticketStatuses = ['Новая', 'Принята', 'В работе', 'Выполнена', 'Закрыта'] as const;
export const reportTypes = ['ЖКХ', 'Дороги', 'Благоустройство'] as const;
export const reportStatuses = ['Принято', 'В работе', 'Исполнено'] as const;
export const PMR_BOUNDS = { south: 46.6, north: 48.15, west: 28.6, east: 30.0 };
export type Report = {
  id: string;
  type: (typeof reportTypes)[number];
  title: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  media: string;
  mediaKind: 'image' | 'video';
  status: (typeof reportStatuses)[number];
  created: string;
  history: string[];
  reportPhoto?: string;
  version?: number;
};
export type CityEvent = {
  id: string;
  category: Category;
  title: string;
  description: string;
  addresses: string[];
  start: string;
  end: string;
  status: (typeof eventStatuses)[number];
  source: string;
  sourceUrl?: string;
  updated: string;
  history: string[];
  version?: number;
};
export type Ticket = {
  id: string;
  address: string;
  category: Category;
  title: string;
  description: string;
  status: (typeof ticketStatuses)[number];
  priority?: 'Обычная' | 'Повышенная';
  created: string;
  history: string[];
  version?: number;
};
export type Meter = {
  id: string;
  address: string;
  category: Category;
  name: string;
  serial: string;
  account: string;
  initialValue: number;
  created: string;
};
export type Reading = {
  id: string;
  meterId?: string;
  address: string;
  category: Category;
  value: number;
  previous: number;
  period: string;
  status: string;
  created: string;
};
export type Notice = { id: string; text: string; read: boolean; created: string };
export type Schedule = {
  id: string;
  address: string;
  category: Category;
  title: string;
  when: string;
  description: string;
  source?: string;
};
export type Organization = {
  id: string;
  name: string;
  categories: Category[];
  addresses: string[];
  connected: boolean;
  sourceUrl?: string;
};
export type State = {
  addresses: string[];
  activeAddress: string;
  subscriptions: Category[];
  subscriptionsByAddress?: Record<string, Category[]>;
  events: CityEvent[];
  tickets: Ticket[];
  reports?: Report[];
  meters: Meter[];
  readings: Reading[];
  notices: Notice[];
  schedules: Schedule[];
  organizations: Organization[];
};
export const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export function emptyState(): State {
  return {
    addresses: [],
    activeAddress: '',
    subscriptions: [...categories],
    subscriptionsByAddress: {},
    events: [],
    tickets: [],
    meters: [],
    readings: [],
    notices: [],
    schedules: [],
    organizations: [],
  };
}
export function validateReading(
  state: State,
  address: string,
  category: Category,
  value: number,
  period: string,
  meterId?: string,
  confirmed = false,
): string | null {
  if (!serviceById(category)?.meter) return 'Для этой услуги не предусмотрен счётчик.';
  if (!Number.isFinite(value) || value < 0 || value > 1e12)
    return 'Введите корректное неотрицательное число.';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return 'Укажите месяц подачи.';
  const records = state.readings.filter(
    (r) =>
      r.address === address &&
      r.category === category &&
      (!meterId || r.meterId === meterId || (!r.meterId && meterId.startsWith('legacy:'))),
  );
  if (records.some((r) => r.period === period)) return 'За этот месяц показания уже сохранены.';
  const previous = records.sort((a, b) => b.period.localeCompare(a.period))[0];
  if (previous && period <= previous.period) return 'Выберите период после последних показаний.';
  const baseline =
    previous?.value ?? state.meters?.find((m) => m.id === meterId)?.initialValue ?? 0;
  if (value < baseline)
    return 'Значение меньше предыдущего. При замене счётчика обратитесь к диспетчеру.';
  const hist = records.slice().sort((a, b) => a.period.localeCompare(b.period)),
    deltas = hist.map((r) => r.value - r.previous).filter((d) => d > 0);
  if (deltas.length >= 2) {
    const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    if (!confirmed && value - baseline > avg * 10)
      return `Похоже на лишний ноль: обычно за месяц около ${Math.round(avg)}, а вы вводите +${Math.round(value - baseline)}. Проверьте значение.`;
  }
  return null;
}
export { dateText, timeText } from './lib/dates';
