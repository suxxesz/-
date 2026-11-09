import { emptyState, services, type State, type Category } from './model';
export const demoAddress = 'Тирасполь, ул. Ленина, 18';
export const secondDemoAddress = 'Бендеры, ул. Советская, 12';
export const legacyMeterId = (address: string, category: Category) =>
  `legacy:${address}:${category}`;
export function createDemoState(): State {
  const s = emptyState();
  s.addresses = [demoAddress, secondDemoAddress];
  s.activeAddress = demoAddress;
  s.events = [
    {
      id: 'evt-1',
      category: 'water',
      title: 'Плановое отключение холодной воды',
      description: 'Замена участка водопровода. Подготовьте запас воды до начала работ.',
      addresses: [demoAddress],
      start: '2026-10-28T07:00:00Z',
      end: '2026-10-28T13:00:00Z',
      status: 'Запланировано',
      source: 'Учебная диспетчерская водоснабжения',
      updated: '2026-10-27T10:30:00Z',
      history: ['27 октября, 12:30 · опубликовано диспетчером'],
      version: 1,
    },
    {
      id: 'evt-2',
      category: 'house',
      title: 'Проверка освещения в подъездах',
      description: 'Проверка светильников и замена ламп на лестничных площадках.',
      addresses: [demoAddress],
      start: '2026-10-29T08:00:00Z',
      end: '2026-10-29T10:00:00Z',
      status: 'Запланировано',
      source: 'Учебная служба обслуживания дома',
      updated: '2026-10-27T08:00:00Z',
      history: ['27 октября, 10:00 · опубликовано диспетчером'],
      version: 1,
    },
    {
      id: 'evt-3',
      category: 'power',
      title: 'Профилактика электрических сетей',
      description: 'Работы завершены. Электроснабжение восстановлено.',
      addresses: [demoAddress],
      start: '2026-10-26T06:00:00Z',
      end: '2026-10-26T09:00:00Z',
      status: 'Завершено',
      source: 'Учебная электросетевая служба',
      updated: '2026-10-26T09:05:00Z',
      history: ['26 октября, 11:05 · работы завершены'],
      version: 1,
    },
  ];
  s.tickets = [
    {
      id: 'REQ-1001',
      address: demoAddress,
      category: 'house',
      title: 'Не горит свет на третьем этаже',
      description: 'В первом подъезде не работает светильник.',
      priority: 'Обычная',
      status: 'В работе',
      created: '2026-10-26T14:40:00Z',
      history: [
        '26 октября · заявка сохранена в деморежиме',
        '27 октября · учебный диспетчер принял в работу',
      ],
      version: 1,
    },
  ];
  s.meters = services
    .filter((x) => x.meter)
    .map((x, i) => ({
      id: legacyMeterId(demoAddress, x.id),
      address: demoAddress,
      category: x.id,
      name: x.id === 'water' ? 'Холодная вода · кухня' : x.name,
      serial: `ДЕМО-${10001 + i}`,
      account: 'Учебный счёт',
      initialValue: x.id === 'power' ? 820 : x.id === 'water' ? 155 : 0,
      created: '2026-06-01T10:00:00Z',
    }));
  const series = { power: [932, 1037, 1132, 1248], water: [163, 170, 178, 184] } as const;
  for (const category of ['power', 'water'] as const) {
    const values = series[category];
    values.forEach((v, i) =>
      s.readings.unshift({
        id: `rd-${category}-${i}`,
        meterId: legacyMeterId(demoAddress, category),
        address: demoAddress,
        category,
        value: v,
        previous: i ? values[i - 1] : category === 'power' ? 820 : 155,
        period: `2026-0${6 + i}`,
        status: 'Сохранено в сервисе',
        created: `2026-0${6 + i}-25T10:00:00Z`,
      }),
    );
  }
  s.notices = [
    {
      id: 'nt-1',
      text: 'На 28 октября запланировано отключение холодной воды по вашему адресу.',
      read: false,
      created: '2026-10-27T10:30:00Z',
    },
  ];
  s.schedules = [
    {
      id: 'sc-1',
      address: demoAddress,
      category: 'waste',
      title: 'Вывоз бытовых отходов',
      when: 'Пн, ср, пт · 07:00–09:00',
      description: 'Учебный график. Контейнерная площадка во дворе.',
      source: 'Учебная служба благоустройства',
    },
    {
      id: 'sc-2',
      address: demoAddress,
      category: 'house',
      title: 'Уборка подъездов',
      when: 'Вторник и четверг · 09:00–13:00',
      description: 'Учебный график влажной уборки общих помещений.',
      source: 'Учебная служба обслуживания дома',
    },
    {
      id: 'sc-3',
      address: demoAddress,
      category: 'house',
      title: 'Осмотр лифтового оборудования',
      when: '30 октября · 10:00–12:00',
      description: 'Учебный график профилактического осмотра.',
      source: 'Учебная служба обслуживания дома',
    },
  ];
  s.organizations = services.map((x) => ({
    id: `org-${x.id}`,
    name: `${x.org} · учебная организация`,
    categories: [x.id],
    addresses: [demoAddress, secondDemoAddress],
    connected: false,
  }));
  return s;
}
