import type { ReactNode } from 'react';
import { Lightbulb } from 'lucide-react';

/**
 * Пояснение на странице. Короткий текст виден всегда; блоки с классом `simple-only`
 * внутри (пошаговые списки, примеры) показываются только в простом режиме.
 */
export function Hint({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="hint" aria-label={title}>
      <Lightbulb size={20} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <div className="hint-body">{children}</div>
      </div>
    </aside>
  );
}

/** Подсказка под полем формы; id связывают с полем через aria-describedby. */
export function FieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <small id={id} className="field-hint">
      {children}
    </small>
  );
}
