import { useEffect, useRef, type ReactNode } from 'react';
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
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { type Category, type CityEvent, serviceById, dateText, timeText } from '../model';
import { useCity } from '../store/CityProvider';
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
export function PageHeading({
  title,
  subtitle,
  children,
  eyebrow = 'Ваш город. Ваш дом.',
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
  eyebrow?: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        <p>{subtitle}</p>
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}
export function SectionHeading({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <h2>
        {title}
        {count !== undefined && <span className="count-badge">{count}</span>}
      </h2>
      {children}
    </div>
  );
}
export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'blue' | 'success' | 'warning';
}) {
  return <span className={'pill ' + tone}>{children}</span>;
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
export function InfoStrip({ children }: { children: ReactNode }) {
  return (
    <div className="info-strip">
      <AlertCircle size={19} />
      <div>{children}</div>
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <CheckCircle2 size={28} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
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
export function ArrowLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowRight size={16} />
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
    <select
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
    </select>
  );
}
