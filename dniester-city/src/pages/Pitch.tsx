import { useState } from 'react';
import {
  ArrowRight,
  Check,
  Play,
  Building2,
  ShieldCheck,
  MessageSquare,
  Bell,
  ArrowUpRight,
} from 'lucide-react';
import { useCity } from '../store/CityProvider';
import { PageHeading, InfoStrip, SectionHeading, Pill } from '../components/ui';
import { serverMode } from '../api';
import { demoAddress } from '../demo';
import { navigate } from '../lib/navigation';
const steps = [
  {
    title: 'Сохранить сводку',
    description: 'Диспетчер создаёт черновик. Жители его ещё не видят, рассылка не запускается.',
  },
  {
    title: 'Проверить и опубликовать',
    description: 'После проверки событие попадает в кабинет жителя и журнал уведомлений.',
  },
  {
    title: 'Подать обращение',
    description: 'Житель сообщает о проблеме. Заявка получает номер и сохраняется в очереди.',
  },
  {
    title: 'Принять в работу',
    description: 'Диспетчер отвечает на заявку. Житель видит обновлённый статус и историю.',
  },
];
export default function Pitch() {
  const { state, role, setDemoRole, act, busy, open, announce } = useCity(),
    [step, setStep] = useState(0),
    [marker] = useState(() => Date.now().toString(36));
  const demoEvent = state.events.find((e) => e.title === `Учебные работы · ${marker}`),
    demoTicket = state.tickets.find((t) => t.title === `Учебное обращение · ${marker}`);
  async function run() {
    if (serverMode) return;
    setDemoRole('admin');
    if (!state.addresses.includes(demoAddress)) {
      announce(
        'Сначала добавьте адрес Тирасполь, ул. Ленина, 18 или восстановите демоданные в настройках.',
      );
      return;
    }
    let success = false;
    // This interactive scenario only mutates explicitly marked browser-local demo records.
    if (step === 0) {
      const start = new Date(Date.now() + 3600000).toISOString(),
        end = new Date(Date.now() + 10800000).toISOString();
      success = await act(
        {
          type: 'event.create',
          payload: {
            category: 'water',
            title: `Учебные работы · ${marker}`,
            description:
              'Демонстрационный сценарий проверки перед публикацией. Реальных отключений и отправки в Telegram нет.',
            addresses: [demoAddress],
            start,
            end,
            source: 'Учебная диспетчерская',
            draft: true,
          },
        },
        'Черновик создан. Рассылка не выполнялась.',
      );
    }
    if (step === 1 && demoEvent)
      success = await act(
        {
          type: 'event.publish',
          payload: { id: demoEvent.id, expectedVersion: demoEvent.version },
        },
        'Учебное событие опубликовано. Проверьте колокольчик.',
      );
    if (step === 2)
      success = await act(
        {
          type: 'ticket.create',
          payload: {
            address: demoAddress,
            category: 'house',
            title: `Учебное обращение · ${marker}`,
            description: 'Демонстрация прозрачного пути обращения от жителя к диспетчеру.',
          },
        },
        'Учебная заявка создана',
      );
    if (step === 3 && demoTicket)
      success = await act(
        {
          type: 'ticket.status',
          payload: {
            id: demoTicket.id,
            status: 'Принята',
            expectedVersion: demoTicket.version,
            comment: 'Учебный диспетчер принял заявку и назначит исполнителя.',
          },
        },
        'Результат сохранён в истории заявки',
      );
    if (success) {
      setStep((x) => x + 1);
    }
  }
  const completed = state.tickets.filter((t) => ['Выполнена', 'Закрыта'].includes(t.status)).length;
  return (
    <>
      <PageHeading
        title="Город, который слышит жителей"
        subtitle="Рабочий сценарий, прозрачные данные и реалистичный путь к пилоту."
        eyebrow="Мой город · Режим защиты"
      >
        <Pill>Демонстрация продукта</Pill>
      </PageHeading>
      <section className="pitch-hero">
        <span className="eyebrow">Одна точка входа вместо разрозненных сводок</span>
        <h2>
          Узнать. Сообщить.
          <br />
          <em>Увидеть результат.</em>
        </h2>
        <p>
          Адрес объединяет отключения, счётчики, графики и обращения. Организация получает рабочий
          кабинет — запуск можно начать с ручного ввода.
        </p>
        <div className="pitch-chips">
          <span>
            <Building2 size={17} />8 направлений
          </span>
          <span>
            <ShieldCheck size={17} />
            Доступ по ответственности
          </span>
          <span>
            <Bell size={17} />
            Адресные уведомления
          </span>
        </div>
      </section>
      <SectionHeading title="Показать за три минуты" />
      {serverMode ? (
        <InfoStrip>
          Автоматический учебный сценарий доступен только в браузерном деморежиме. Серверные данные
          он не изменяет.
        </InfoStrip>
      ) : (
        <>
          <InfoStrip>
            Все действия ниже создают помеченные учебные записи только в вашем браузере.
            Telegram-сообщения не отправляются.
          </InfoStrip>
          <div className="walkthrough">
            <div className="walkthrough-steps">
              {steps.map((s, i) => (
                <div
                  className={
                    'walkthrough-step ' + (i === step ? 'current' : i < step ? 'done' : '')
                  }
                  key={s.title}
                >
                  <span>{i < step ? <Check size={16} /> : String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="walkthrough-stage">
              <div className="stage-icon">
                {step >= 4 ? (
                  <ShieldCheck size={36} />
                ) : step === 0 ? (
                  <Building2 size={36} />
                ) : step === 1 ? (
                  <Bell size={36} />
                ) : (
                  <MessageSquare size={36} />
                )}
              </div>
              <Pill tone="success">{step >= 4 ? 'Сценарий завершён' : `Шаг ${step + 1} из 4`}</Pill>
              <h2>{step >= 4 ? 'Путь жителя прозрачен' : steps[step].title}</h2>
              <p>
                {step >= 4
                  ? 'Черновик, публикация, уведомление и обработка заявки — в одной системе. Все созданные записи можно открыть в соответствующих разделах.'
                  : steps[step].description}
              </p>
              {step < 4 ? (
                <button className="primary" disabled={busy || role !== 'admin'} onClick={run}>
                  <Play size={17} />
                  {busy ? 'Выполняем…' : 'Выполнить шаг'}
                </button>
              ) : (
                <button className="primary" onClick={() => navigate('admin')}>
                  Открыть панель
                  <ArrowRight size={17} />
                </button>
              )}
              {role !== 'admin' && (
                <button className="outline" onClick={() => setDemoRole('admin')}>
                  Включить учебную роль диспетчера
                </button>
              )}
              {step >= 2 && (
                <button className="text-link" onClick={() => open({ type: 'notices' })}>
                  Посмотреть уведомления
                  <ArrowUpRight size={16} />
                </button>
              )}
            </div>
          </div>
        </>
      )}
      <SectionHeading title="Что можно измерить уже сейчас" />
      <div className="stats-grid">
        {[
          ['Сохранённых адресов', state.addresses.length],
          ['Опубликованных событий', state.events.filter((e) => e.status !== 'Черновик').length],
          ['Показаний в истории', state.readings.length],
          ['Выполненных обращений', completed],
        ].map(([label, n]) => (
          <div className="panel stat" key={label}>
            <span>{label}</span>
            <strong>{n}</strong>
          </div>
        ))}
      </div>
      <p className="hint">
        Счётчики отражают текущие данные кабинета. Это не статистика внедрения и не количество
        реальных пользователей.
      </p>
      <SectionHeading title="Пилот без ожидания больших интеграций" />
      <div className="pilot-grid">
        {[
          [
            '01',
            'Подключить одну организацию',
            'Согласовать ответственного диспетчера, источники и небольшой список домов.',
          ],
          [
            '02',
            'Проверить полный цикл',
            'Опубликовать событие, доставить уведомление и обработать обращение.',
          ],
          [
            '03',
            'Измерить результат',
            'Сравнить время публикации, успешность доставки и срок первого ответа.',
          ],
          [
            '04',
            'Масштабировать по данным',
            'Добавлять услуги и адреса после обратной связи жителей и диспетчеров.',
          ],
        ].map(([n, title, text]) => (
          <article className="panel" key={n}>
            <span className="pilot-number">{n}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </>
  );
}
