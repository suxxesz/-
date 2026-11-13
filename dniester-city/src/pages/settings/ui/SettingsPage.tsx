import { applyThemeWithWave, currentTheme, themes, accents } from '@/shared/lib/theme';
import { layoutOptions, useLayout, type Layout } from '@/shared/lib/layout';
import { Plus, MapPin, Check, UserRound, ArrowRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useCity } from '@/entities/city/model/store';
import { services } from '@/entities/city/model/types';
import { PageHeading, SectionHeading } from '@/shared/ui/ui';
import { Hint, FieldHint } from '@/shared/ui/Hint';
import { navigate } from '@/shared/lib/navigation';
import { serverMode } from '@/entities/city/api/client';

/** Ряд настройки: подпись с пояснением слева, переключатель справа. */
function Row({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div>
        <strong>{title}</strong>
        <FieldHint>{hint}</FieldHint>
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T, el: HTMLElement) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map(([v, n]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={(e) => onChange(v, e.currentTarget)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function Settings() {
  const { state, act, open, busy } = useCity(),
    [layout, setLayout] = useLayout(),
    [theme, setTheme] = useState(currentTheme());
  const toggle = (key: keyof Layout, label: string) => (
    <input
      type="checkbox"
      aria-label={label}
      checked={layout[key] as boolean}
      onChange={(e) => setLayout({ [key]: e.target.checked })}
    />
  );
  return (
    <>
      <PageHeading
        title="Настройки"
        subtitle="Адреса, уведомления, внешний вид и удобство чтения — всё для этого устройства."
      />
      <Hint title="Как устроены настройки">
        Адреса и уведомления сохраняются в аккаунте, а оформление и макет — только на этом
        устройстве.
        <p className="simple-only">
          Если текст кажется мелким, включите «Простой режим» ниже: всё станет крупнее, а на
          каждой странице появятся пошаговые подсказки.
        </p>
      </Hint>
      <div className="settings-grid">
        <section className="panel">
          <SectionHeading title="Профиль" />
          <p className="muted">Имя, возраст, город и способ связи — чтобы службы отвечали быстрее.</p>
          <div className="form-actions">
            <button className="outline" onClick={() => navigate('profile')}>
              <UserRound size={18} />
              Открыть профиль
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
        <section className="panel">
          <SectionHeading title="Мои адреса">
            <button className="text-link" onClick={() => open({ type: 'address' })}>
              <Plus size={17} />
              Добавить
            </button>
          </SectionHeading>
          <FieldHint>Нажмите на адрес, чтобы сделать его текущим во всех разделах.</FieldHint>
          {state.addresses.map((a) => (
            <button
              disabled={busy}
              className={'address-row ' + (a === state.activeAddress ? 'active' : '')}
              key={a}
              aria-pressed={a === state.activeAddress}
              onClick={() => act({ type: 'address.select', payload: { address: a } })}
            >
              <MapPin size={19} />
              <span>{a}</span>
              {a === state.activeAddress && <Check size={18} />}
            </button>
          ))}
        </section>
        <section className="panel">
          <h2>Оформление</h2>
          <Row title="Тема" hint="Системная — как на телефоне или компьютере.">
            <Segmented
              label="Тема"
              value={theme[0] as (typeof themes)[number][0]}
              options={themes}
              onChange={(v, el) => {
                applyThemeWithWave(v, theme[1], el);
                setTheme([v, theme[1]]);
              }}
            />
          </Row>
          <Row title="Акцентный цвет" hint="Цвет кнопок, ссылок и рамки фокуса.">
            <Segmented
              label="Акцентный цвет"
              value={theme[1] as (typeof accents)[number][0]}
              options={accents}
              onChange={(v, el) => {
                applyThemeWithWave(theme[0], v, el);
                setTheme([theme[0], v]);
              }}
            />
          </Row>
        </section>
        <section className="panel">
          <h2>Макет</h2>
          <Row title="Ширина" hint="Во весь экран — больше карточек в ряд на большом мониторе.">
            <Segmented
              label="Ширина"
              value={layout.width}
              options={layoutOptions.width}
              onChange={(width) => setLayout({ width })}
            />
          </Row>
          <Row title="Плотность" hint="Расстояния между карточками и внутри них.">
            <Segmented
              label="Плотность"
              value={layout.density}
              options={layoutOptions.density}
              onChange={(density) => setLayout({ density })}
            />
          </Row>
          <Row title="Анимации" hint="«Минимум» — без волн и плавных переходов.">
            <Segmented
              label="Анимации"
              value={layout.motion}
              options={layoutOptions.motion}
              onChange={(motion) => setLayout({ motion })}
            />
          </Row>
        </section>
        <section className="panel">
          <h2>Читаемость</h2>
          <Row
            title="Простой режим"
            hint="Крупный текст и кнопки, пошаговые подсказки на каждой странице."
          >
            {toggle('simple', 'Простой режим')}
          </Row>
          <Row title="Увеличенный текст" hint="Только крупнее шрифт, без лишних подсказок.">
            {toggle('large', 'Увеличенный текст')}
          </Row>
        </section>
        <section className="panel">
          <h2>Уведомления</h2>
          <FieldHint>
            Для адреса: {state.activeAddress || 'добавьте дом'}. Бот пришлёт сообщение в
            Telegram, когда по выбранной услуге начнутся работы.
          </FieldHint>
          {services.map((s) => (
            <label className="toggle-row" key={s.id}>
              <span>{s.name}</span>
              <input
                type="checkbox"
                disabled={busy || !state.activeAddress}
                checked={state.subscriptions.includes(s.id)}
                onChange={(e) =>
                  act({
                    type: 'subscriptions',
                    payload: {
                      categories: e.target.checked
                        ? [...state.subscriptions, s.id]
                        : state.subscriptions.filter((c) => c !== s.id),
                    },
                  })
                }
              />
            </label>
          ))}
        </section>
        <section className="panel">
          <h2>Ваши данные</h2>
          <p className="muted">
            {serverMode
              ? 'Показания и обращения хранятся на сервере. Доступ зависит от текущей роли и назначенной организации.'
              : 'В демонстрации изменения хранятся только в вашем браузере. Реальные лицевые счета и личные данные для показа не нужны.'}
          </p>
          {!serverMode && (
            <button className="outline danger" onClick={() => open({ type: 'reset' })}>
              Сбросить демо
            </button>
          )}
        </section>
      </div>
    </>
  );
}
