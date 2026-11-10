/*
 * Справочник транспорта: маршрутки (микротакси) и службы такси.
 * Учебные данные для демо: номера, остановки, интервалы и цены условные.
 * В пилоте их публикует диспетчер, а не код.
 */
export type Stop = { name: string; lat: number; lng: number };
export type Route = {
  id: string;
  number: string;
  from: string;
  to: string;
  color: string;
  intervalMin: number;
  hours: [string, string]; // первый и последний рейс, местное время
  fare: number; // руб. ПМР
  stops: Stop[];
};
export type TaxiService = {
  id: string;
  name: string;
  phone: string;
  minFare: number;
  perKm: number;
  features: string[];
  hours: '24/7' | [string, string];
};

export const routes: Route[] = [
  {
    id: 'r1',
    number: '1',
    from: 'Балка',
    to: 'Кировский',
    color: '#1f5fd6',
    intervalMin: 7,
    hours: ['06:00', '22:30'],
    fare: 3,
    stops: [
      { name: 'Балка', lat: 46.8655, lng: 29.6005 },
      { name: 'Ул. Шевченко', lat: 46.8505, lng: 29.6085 },
      { name: 'Центр', lat: 46.8405, lng: 29.6305 },
      { name: 'Ул. 25 Октября', lat: 46.8352, lng: 29.6402 },
      { name: 'Кировский', lat: 46.8205, lng: 29.6555 },
    ],
  },
  {
    id: 'r3',
    number: '3',
    from: 'Вокзал',
    to: 'Бородинка',
    color: '#0ea5a4',
    intervalMin: 10,
    hours: ['06:15', '21:45'],
    fare: 3,
    stops: [
      { name: 'Вокзал', lat: 46.8475, lng: 29.6365 },
      { name: 'Рынок', lat: 46.8425, lng: 29.6285 },
      { name: 'Ул. Карла Маркса', lat: 46.8372, lng: 29.6195 },
      { name: 'Бородинка', lat: 46.8285, lng: 29.6005 },
    ],
  },
  {
    id: 'r19',
    number: '19',
    from: 'Тирасполь',
    to: 'Бендеры',
    color: '#c2410c',
    intervalMin: 5,
    hours: ['05:40', '23:00'],
    fare: 6,
    stops: [
      { name: 'Тирасполь, центр', lat: 46.8405, lng: 29.6305 },
      { name: 'Парканы', lat: 46.8205, lng: 29.5505 },
      { name: 'Мост', lat: 46.8172, lng: 29.4905 },
      { name: 'Бендеры, центр', lat: 46.8305, lng: 29.4775 },
    ],
  },
];

export const taxis: TaxiService[] = [
  { id: 't1', name: 'Такси «Город»', phone: '+373 533 0 00 01', minFare: 20, perKm: 4, features: ['Детское кресло', 'Безнал'], hours: '24/7' },
  { id: 't2', name: 'Такси «Днестр»', phone: '+373 533 0 00 02', minFare: 18, perKm: 4.5, features: ['Минивэн', 'Межгород'], hours: '24/7' },
  { id: 't3', name: 'Эконом-такси', phone: '+373 533 0 00 03', minFare: 15, perKm: 3.5, features: ['Самая низкая цена'], hours: ['06:00', '00:00'] },
];

const toMin = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);

/** Ближайший рейс маршрутки после `now` (минуты от полуночи) или null, если рейсов сегодня больше нет. */
export function nextDeparture(route: Route, now: number) {
  const [first, last] = route.hours.map(toMin);
  if (now > last) return null;
  if (now <= first) return { inMin: first - now, at: route.hours[0] };
  const passed = Math.ceil((now - first) / route.intervalMin) * route.intervalMin;
  const at = first + passed;
  if (at > last) return null;
  const hh = String(Math.floor(at / 60)).padStart(2, '0'),
    mm = String(at % 60).padStart(2, '0');
  return { inMin: at - now, at: `${hh}:${mm}` };
}

/** Примерная цена такси: подача + км. Расстояние по прямой × 1,3 на изгибы дорог. */
export function taxiEstimate(t: TaxiService, km: number) {
  return Math.max(t.minFare, Math.round(t.minFare + t.perKm * km * 1.3));
}

/** Расстояние между двумя точками, км (формула гаверсинусов). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6371,
    rad = Math.PI / 180,
    dLat = (b.lat - a.lat) * rad,
    dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/** Работает ли служба такси в момент `now` (минуты от полуночи); учитывает смену после полуночи. */
export function taxiOpen(t: TaxiService, now: number) {
  if (t.hours === '24/7') return true;
  const [from, to] = t.hours.map(toMin);
  return to > from ? now >= from && now < to : now >= from || now < to;
}
