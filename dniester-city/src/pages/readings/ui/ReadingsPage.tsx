import { useState } from 'react';
import { Plus, Download, ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import { useCity } from '@/entities/city/model/store';
import { serviceById, type Meter } from '@/entities/city/model/types';
import { PageHeading, SectionHeading, InfoStrip, Empty, Pill } from '@/shared/ui/ui';
import { ServiceIcon } from '@/entities/city/ui';
import { exportReadings } from '@/features/export-readings';
import { monthText } from '@/shared/lib/dates';
export default function Readings() {
  const { state, open } = useCity(),
    [selected, setSelected] = useState('');
  const meters = state.meters.filter((m) => m.address === state.activeAddress),
    readings = state.readings.filter((r) => r.address === state.activeAddress);
  const meter = meters.find((m) => m.id === selected) || meters[0],
    series = readings
      .filter((r) => r.meterId === meter?.id)
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-6),
    max = Math.max(...series.map((r) => r.value - r.previous), 1);
  const last = series.at(-1),
    previous = series.at(-2),
    change =
      last && previous && previous.value !== previous.previous
        ? Math.round(
            ((last.value - last.previous) / (previous.value - previous.previous) - 1) * 100,
          )
        : null;
  function card(m: Meter) {
    const s = serviceById(m.category),
      last = readings
        .filter((r) => r.meterId === m.id)
        .sort((a, b) => b.period.localeCompare(a.period))[0];
    return (
      <article className="panel meter-card" key={m.id}>
        <div className="meter-top">
          <ServiceIcon category={m.category} />
          <Pill>{last ? 'Есть история' : 'Новый счётчик'}</Pill>
        </div>
        <h3>{m.name}</h3>
        <p className="meter-serial">№ {m.serial}</p>
        <div className="meter-value">
          {(last?.value ?? m.initialValue).toLocaleString('ru-RU')}
          <small>{s.unit}</small>
        </div>
        <p>{last ? monthText(last.period) : 'Начальное значение'}</p>
        <button className="outline" onClick={() => open({ type: 'reading', category: m.category })}>
          Ввести показания
          <ArrowRight size={16} />
        </button>
      </article>
    );
  }
  return (
    <>
      <PageHeading
        title="Показания счётчиков"
        subtitle="Отдельные счётчики, история и понятная динамика расхода."
      >
        <button className="outline" onClick={() => open({ type: 'meter' })}>
          <Plus size={17} />
          Добавить счётчик
        </button>
        <button className="primary" onClick={() => open({ type: 'reading' })}>
          <Plus size={17} />
          Передать показания
        </button>
      </PageHeading>
      <InfoStrip>
        Показания сохраняются в сервисе. Официальная передача поставщикам ещё не подключена.
      </InfoStrip>
      <div className="meter-grid">{meters.map(card)}</div>
      {!meters.length && (
        <Empty
          title="Добавьте первый счётчик"
          action={
            <button className="primary" onClick={() => open({ type: 'meter' })}>
              <Plus size={17} />
              Добавить счётчик
            </button>
          }
        >
          Укажите его номер и начальные показания. Несколько счётчиков одной услуги поддерживаются
          отдельно.
        </Empty>
      )}
      {meter && (
        <section className="panel consumption-panel">
          <div className="section-heading">
            <div>
              <h2>Как меняется расход</h2>
              <p className="muted">
                Сравнение по сохранённым показаниям · {serviceById(meter.category).unit}
              </p>
            </div>
            <select
              aria-label="Счётчик для графика"
              value={meter.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {meters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          {series.length ? (
            <>
              <div
                className="chart"
                role="img"
                aria-label={`Расход: ${series.map((r) => `${monthText(r.period)} — ${r.value - r.previous}`).join('; ')}`}
              >
                {series.map((r) => (
                  <div className="chart-column" key={r.id}>
                    <strong>{r.value - r.previous}</strong>
                    <div
                      style={{ height: `${Math.max(((r.value - r.previous) / max) * 140, 4)}px` }}
                    />
                    <span>
                      {new Date(`${r.period}-15`).toLocaleDateString('ru-RU', { month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
              {change !== null && (
                <p className="consumption-note">
                  {change <= 0 ? <TrendingDown size={17} /> : <TrendingUp size={17} />}На{' '}
                  {Math.abs(change)}% {change <= 0 ? 'меньше' : 'больше'} предыдущего периода. Это
                  сравнение расхода, не сумма к оплате.
                </p>
              )}
            </>
          ) : (
            <Empty title="График появится после первой подачи" />
          )}
        </section>
      )}
      <SectionHeading title="История показаний">
        <button className="text-link" onClick={() => exportReadings({ ...state, readings })}>
          <Download size={16} />
          Экспорт CSV
        </button>
      </SectionHeading>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Счётчик / услуга</th>
              <th>Период</th>
              <th>Показания</th>
              <th>Расход</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{serviceById(r.category).name}</strong>
                  <small>
                    {state.meters.find((m) => m.id === r.meterId)?.serial || 'Номер не указан'}
                  </small>
                </td>
                <td>{monthText(r.period)}</td>
                <td>{r.value.toLocaleString('ru-RU')}</td>
                <td>
                  {(r.value - r.previous).toLocaleString('ru-RU')} {serviceById(r.category).unit}
                </td>
                <td>
                  <Pill>{r.status}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!readings.length && <Empty title="История пока пуста" />}
      </div>
    </>
  );
}
