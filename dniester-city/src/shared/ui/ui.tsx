import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
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
export function ArrowLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowRight size={16} />
    </button>
  );
}
