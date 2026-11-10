import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';

type Opt = { value: string; label: ReactNode; disabled?: boolean };
type OptionProps = { value?: string | number; children?: ReactNode; disabled?: boolean };

// Собирает <option> из детей (в том числе из массивов от .map), как это делает нативный select.
function collect(children: ReactNode): Opt[] {
  const out: Opt[] = [];
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    const el = c as ReactElement<OptionProps & { children?: ReactNode }>;
    if (el.type === 'option') {
      const label = el.props.children;
      out.push({ value: String(el.props.value ?? label), label, disabled: el.props.disabled });
    } else out.push(...collect(el.props.children));
  });
  return out;
}

/**
 * Свой выпадающий список с API нативного <select>: value/defaultValue, onChange({ target: { value } }),
 * name (скрытое поле для FormData), disabled, aria-label и <option> внутри.
 */
export function Select({
  value,
  defaultValue,
  onChange,
  name,
  disabled,
  children,
  className = '',
  ...aria
}: {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: { target: { value: string; name?: string } }) => void;
  name?: string;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
  required?: boolean;
}) {
  const options = collect(children);
  const [inner, setInner] = useState(String(defaultValue ?? options[0]?.value ?? ''));
  const current = value !== undefined ? String(value) : inner;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const selected = options.find((o) => o.value === current) ?? options[0];
  const [up, setUp] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  function show() {
    if (disabled) return;
    const r = button.current?.getBoundingClientRect();
    setUp(!!r && window.innerHeight - r.bottom < 280 && r.top > 280);
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === current),
      ),
    );
    setOpen(true);
  }
  function pick(o: Opt) {
    if (o.disabled) return;
    setOpen(false);
    button.current?.focus();
    if (o.value === current) return;
    if (value === undefined) setInner(o.value);
    onChange?.({ target: { value: o.value, name } });
  }
  function move(step: number) {
    let i = active;
    for (let n = 0; n < options.length; n++) {
      i = (i + step + options.length) % options.length;
      if (!options[i].disabled) break;
    }
    setActive(i);
  }
  function key(e: React.KeyboardEvent) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') (e.preventDefault(), move(1));
    else if (e.key === 'ArrowUp') (e.preventDefault(), move(-1));
    else if (e.key === 'Home') (e.preventDefault(), setActive(0));
    else if (e.key === 'End') (e.preventDefault(), setActive(options.length - 1));
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (options[active]) pick(options[active]);
    }
  }

  return (
    <div
      ref={root}
      className={'dc-select ' + className}
      data-name={name}
      data-open={open || undefined}
    >
      {name && <input type="hidden" name={name} value={current} />}
      <button
        ref={button}
        type="button"
        className="dc-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-label={aria['aria-label']}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={key}
      >
        <span className="dc-select-value">{selected?.label}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18 }}
          className="dc-select-chev"
        >
          <ChevronDown size={17} />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            id={id}
            role="listbox"
            aria-label={aria['aria-label']}
            className="dc-select-menu"
            data-up={up || undefined}
            initial={{ opacity: 0, y: up ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: up ? 4 : -4, scale: 0.98, transition: { duration: 0.1 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-${i}`}
                data-value={o.value}
                role="option"
                aria-selected={o.value === current}
                aria-disabled={o.disabled || undefined}
                data-active={i === active || undefined}
                onPointerEnter={() => setActive(i)}
                onClick={(e) => {
                  e.preventDefault(); // внутри <label> клик иначе снова откроет список
                  pick(o);
                }}
              >
                <span>{o.label}</span>
                {o.value === current && <Check size={16} />}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
