import { CalendarDays } from 'lucide-react';
import { useCity } from '@/entities/city/model/store';
import { PageHeading, Pill, Empty } from '@/shared/ui/ui';
import { ServiceIcon } from '@/entities/city/ui';
import { serverMode } from '@/entities/city/api/client';
export default function Schedule() {
  const { state } = useCity(),
    items = state.schedules.filter((s) => s.address === state.activeAddress);
  return (
    <>
      <PageHeading
        title="Графики обслуживания"
        subtitle="Регулярная забота о доме: вывоз отходов, уборка и профилактика."
      />
      <div className="schedule-grid">
        {items.map((s) => (
          <article className="panel schedule-card" key={s.id}>
            <div className="card-top">
              <ServiceIcon category={s.category} />
              <Pill>{serverMode ? 'Опубликованный график' : 'Демо-график'}</Pill>
            </div>
            <h2>{s.title}</h2>
            <div className="schedule-time">
              <CalendarDays size={19} />
              {s.when}
            </div>
            <p>{s.description}</p>
            <div className="source-line">Источник: {s.source || 'Диспетчер организации'}</div>
          </article>
        ))}
      </div>
      {!items.length && (
        <Empty title="Графики ещё не опубликованы">
          Для выбранного адреса пока нет подтверждённого расписания.
        </Empty>
      )}
    </>
  );
}
