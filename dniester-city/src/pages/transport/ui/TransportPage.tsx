import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bus, CarTaxiFront, Clock, Phone, Route as RouteIcon, Wallet } from 'lucide-react';
import { PageHeading, InfoStrip, Pill } from '@/shared/ui/ui';
import { Select } from '@/shared/ui/Select';
import { timeZone } from '@/shared/lib/dates';
import {
  routes,
  taxis,
  nextDeparture,
  taxiEstimate,
  taxiOpen,
  distanceKm,
  type Route,
} from '@/entities/transport/model/data';
const RouteMap = lazy(() => import('@/widgets/map/ui/RouteMap'));

// Минуты от полуночи по времени Молдовы/ПМР — расписание в местном времени, а не в часовом поясе браузера.
function localMinutes() {
  const p = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).formatToParts(new Date());
  return +p.find((x) => x.type === 'hour')!.value * 60 + +p.find((x) => x.type === 'minute')!.value;
}
function useNow() {
  const [now, setNow] = useState(localMinutes);
  useEffect(() => {
    const t = setInterval(() => setNow(localMinutes()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const allStops = [...new Map(routes.flatMap((r) => r.stops).map((s) => [s.name, s])).values()];

export default function TransportPage() {
  const [tab, setTab] = useState<'routes' | 'taxi'>('routes');
  const [selected, setSelected] = useState<Route>(routes[0]);
  const [from, setFrom] = useState(allStops[0].name);
  const [to, setTo] = useState(allStops[2].name);
  const now = useNow();
  const km = useMemo(() => {
    const a = allStops.find((s) => s.name === from)!,
      b = allStops.find((s) => s.name === to)!;
    return distanceKm(a, b);
  }, [from, to]);

  return (
    <>
      <PageHeading title="Транспорт" subtitle="Маршрутки и такси города: когда ближайший рейс, сколько стоит и кому позвонить." />
      <InfoStrip>Учебные данные: маршруты, интервалы, цены и телефоны условные. В пилоте их публикует диспетчер перевозчика.</InfoStrip>
      <div className="filter-tabs transport-tabs" role="tablist" aria-label="Вид транспорта">
        {(
          [
            ['routes', 'Маршрутки', Bus],
            ['taxi', 'Такси', CarTaxiFront],
          ] as const
        ).map(([v, label, Icon]) => (
          <button key={v} role="tab" aria-selected={tab === v} className={tab === v ? 'active' : ''} onClick={() => setTab(v)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'routes' ? (
          <motion.div key="routes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="transport-layout">
            <div className="route-list" role="list">
              {routes.map((r) => {
                const next = nextDeparture(r, now);
                return (
                  <button
                    key={r.id}
                    role="listitem"
                    className={'route-card' + (selected.id === r.id ? ' selected' : '')}
                    aria-pressed={selected.id === r.id}
                    onClick={() => setSelected(r)}
                  >
                    <span className="route-number" style={{ background: r.color }}>
                      {r.number}
                    </span>
                    <span className="route-main">
                      <strong>
                        {r.from} → {r.to}
                      </strong>
                      <small>
                        каждые {r.intervalMin} мин · {r.hours[0]}–{r.hours[1]} · {r.fare} руб.
                      </small>
                    </span>
                    {next ? (
                      <Pill tone={next.inMin <= 3 ? 'success' : 'blue'}>{next.inMin === 0 ? 'сейчас' : `через ${next.inMin} мин`}</Pill>
                    ) : (
                      <Pill>до утра</Pill>
                    )}
                  </button>
                );
              })}
            </div>
            <section className="panel route-detail" aria-label={`Маршрут ${selected.number}`}>
              <div className="route-detail-head">
                <span className="route-number big" style={{ background: selected.color }}>
                  {selected.number}
                </span>
                <div>
                  <h2>
                    {selected.from} → {selected.to}
                  </h2>
                  <p>
                    <Clock size={14} /> {selected.hours[0]}–{selected.hours[1]} · <Wallet size={14} /> {selected.fare} руб.
                  </p>
                </div>
              </div>
              <Suspense fallback={<div className="loading-panel">Загружаем карту…</div>}>
                <RouteMap route={selected} />
              </Suspense>
              <ol className="stop-line" style={{ ['--route' as string]: selected.color }}>
                {selected.stops.map((s) => (
                  <li key={s.name}>{s.name}</li>
                ))}
              </ol>
            </section>
          </motion.div>
        ) : (
          <motion.div key="taxi" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <section className="panel taxi-calc">
              <h2>
                <RouteIcon size={18} /> Сколько примерно стоит поездка
              </h2>
              <div className="taxi-calc-row">
                <label>
                  Откуда
                  <Select aria-label="Откуда" value={from} onChange={(e) => setFrom(e.target.value)}>
                    {allStops.map((s) => (
                      <option key={s.name}>{s.name}</option>
                    ))}
                  </Select>
                </label>
                <label>
                  Куда
                  <Select aria-label="Куда" value={to} onChange={(e) => setTo(e.target.value)}>
                    {allStops.map((s) => (
                      <option key={s.name}>{s.name}</option>
                    ))}
                  </Select>
                </label>
                <div className="taxi-km">
                  <small>По прямой</small>
                  <strong>{km.toFixed(1)} км</strong>
                </div>
              </div>
            </section>
            <div className="taxi-grid">
              {taxis
                .map((t) => ({ t, price: taxiEstimate(t, km), open: taxiOpen(t, now) }))
                .sort((a, b) => Number(b.open) - Number(a.open) || a.price - b.price)
                .map(({ t, price, open }) => (
                  <article key={t.id} className={'panel taxi-card' + (open ? '' : ' closed')}>
                    <div className="taxi-card-head">
                      <span className="taxi-icon">
                        <CarTaxiFront size={20} />
                      </span>
                      <div>
                        <h3>{t.name}</h3>
                        <small>{t.hours === '24/7' ? 'Круглосуточно' : `${t.hours[0]}–${t.hours[1]}`}</small>
                      </div>
                      {open ? <Pill tone="success">Работает</Pill> : <Pill>Закрыто</Pill>}
                    </div>
                    <div className="taxi-price">
                      ≈ {price} <small>руб.</small>
                    </div>
                    <small className="taxi-tariff">
                      подача {t.minFare} руб. · {t.perKm} руб./км
                    </small>
                    <div className="taxi-features">
                      {t.features.map((f) => (
                        <Pill key={f}>{f}</Pill>
                      ))}
                    </div>
                    <a className={'button primary taxi-call' + (open ? '' : ' disabled')} href={open ? `tel:${t.phone.replace(/\s/g, '')}` : undefined} aria-disabled={!open}>
                      <Phone size={16} /> {t.phone}
                    </a>
                  </article>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
