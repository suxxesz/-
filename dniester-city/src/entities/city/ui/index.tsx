import {
  Zap,
  Droplets,
  Flame,
  Thermometer,
  Waves,
  Trash2,
  Building2,
  ArrowUpRight,
  CalendarDays,
} from 'lucide-react';
import { Pill } from '../../../shared/ui/ui';
import { type Category, type CityEvent, serviceById, dateText, timeText } from '../model/types';
import { useCity } from '../model/store';
import { Select } from '../../../shared/ui/Select';
export const serviceIcons = {
  power: Zap,
  water: Droplets,
  hotwater: Thermometer,
  gas: Flame,
  heat: Thermometer,
  sewer: Waves,
  waste: Trash2,
  house: Building2,
};
export function ServiceIcon({ category, size = 22 }: { category: Category; size?: number }) {
  const Icon = serviceIcons[category],
    s = serviceById(category);
  return (
    <span className="service-icon" style={{ color: s.color, background: s.color + '14' }}>
      <Icon size={size} />
    </span>
  );
}
export function StatusPill({ status }: { status: string }) {
  return (
    <Pill
      tone={
        status === 'Завершено' || status === 'Закрыта' || status === 'Выполнена'
          ? 'success'
          : status === 'Выполняется' || status === 'В работе'
            ? 'warning'
            : status === 'Черновик'
              ? 'neutral'
              : 'blue'
      }
    >
      {status}
    </Pill>
  );
}
export function EventCard({ event: e }: { event: CityEvent }) {
  const { open } = useCity();
  return (
    <button className="event-card" onClick={() => open({ type: 'event', event: e })}>
      <div className="event-top">
        <ServiceIcon category={e.category} />
        <StatusPill status={e.status} />
      </div>
      <h3>{e.title}</h3>
      <p>{e.description}</p>
      <div className="event-date">
        <CalendarDays size={16} />
        <span>
          {dateText(e.start)} · {timeText(e.start)}
          {e.end ? `–${timeText(e.end)}` : ' · срок неизвестен'}
        </span>
      </div>
      <div className="event-bottom">
        <span>{serviceById(e.category).short}</span>
        <ArrowUpRight size={17} />
      </div>
    </button>
  );
}
export function CategorySelect({
  value,
  onChange,
  meter = false,
  name = 'category',
}: {
  value: Category;
  onChange?: (c: Category) => void;
  meter?: boolean;
  name?: string;
}) {
  return (
    <Select
      name={name}
      aria-label="Услуга"
      value={value}
      onChange={(e) => onChange?.(e.target.value as Category)}
    >
      {Object.keys(serviceIcons)
        .map((c) => serviceById(c as Category))
        .filter((s) => !meter || s.meter)
        .map((s) => (
          <option value={s.id} key={s.id}>
            {s.name}
          </option>
        ))}
    </Select>
  );
}
