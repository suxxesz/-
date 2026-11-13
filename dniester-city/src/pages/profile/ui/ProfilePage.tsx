import { useEffect, useState, type FormEvent } from 'react';
import { Save, UserRound } from 'lucide-react';
import { useCity } from '@/entities/city/model/store';
import {
  ageOf,
  benefitKinds,
  contactChannels,
  emptyProfile,
  genders,
  pmrCities,
  profileCompletion,
  profileSchema,
  type Profile,
} from '@/entities/profile/model/schema';
import { loadProfile, saveProfile } from '@/entities/profile/api/profile';
import { PageHeading } from '@/shared/ui/ui';
import { Hint, FieldHint } from '@/shared/ui/Hint';
import { Select } from '@/shared/ui/Select';
import { serverMode } from '@/entities/city/api/client';

type Draft = Record<keyof Profile, string | string[] | number | undefined>;
const toDraft = (p: Profile): Draft => ({ ...p }) as Draft;

export default function ProfilePage() {
  const { announce } = useCity(),
    [draft, setDraft] = useState<Draft>(toDraft(emptyProfile())),
    [saved, setSaved] = useState<Profile>(emptyProfile()),
    [errors, setErrors] = useState<Partial<Record<string, string>>>({}),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadProfile()
      .then((p) => {
        setSaved(p);
        setDraft(toDraft(p));
      })
      .catch((e) => announce((e as Error).message))
      .finally(() => setLoaded(true));
  }, []);

  const set = (key: keyof Profile, value: Draft[keyof Profile]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const text = (key: keyof Profile) => (draft[key] ?? '') as string;
  const field = (key: keyof Profile) => ({
    id: `profile-${key}`,
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': `profile-${key}-hint`,
  });
  const error = (key: keyof Profile) =>
    errors[key] && (
      <span className="field-error" role="alert">
        {errors[key]}
      </span>
    );

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = profileSchema.safeParse(draft);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message;
      setErrors(next);
      document.getElementById(`profile-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const p = await saveProfile(parsed.data);
      setSaved(p);
      setDraft(toDraft(p));
      announce('Профиль сохранён');
    } catch (err) {
      announce((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const birth = text('birthDate'),
    age = /^\d{4}-\d{2}-\d{2}$/.test(birth) ? ageOf(birth) : undefined,
    completion = profileCompletion(saved),
    benefits = (draft.benefits as string[]) || [];

  return (
    <>
      <PageHeading
        eyebrow="Личный кабинет"
        title="Мой профиль"
        subtitle="Кто вы и как с вами связаться — чтобы службы отвечали быстрее."
      />
      <Hint title="Зачем это нужно">
        Профиль помогает диспетчеру понять, кому перезвонить по заявке, и учесть льготы.
        Обязательно только имя — всё остальное по желанию.
        <ul className="simple-only">
          <li>Данные видите вы и диспетчер организации, которая обслуживает ваш дом.</li>
          <li>Телефон нужен, только если вам удобнее звонок, чем сообщение в Telegram.</li>
          <li>Изменить или стереть данные можно здесь же в любой момент.</li>
        </ul>
      </Hint>
      <div className="panel profile-card">
        <span className="avatar">{(saved.displayName[0] || 'Ж').toUpperCase()}</span>
        <div>
          <strong>{saved.displayName}</strong>
          <small className="muted">
            {[saved.city, saved.birthDate && `${ageOf(saved.birthDate)} лет`]
              .filter(Boolean)
              .join(' · ') || (serverMode ? 'Telegram-аккаунт' : 'Учебный профиль')}
          </small>
          <div
            className="progress"
            role="progressbar"
            aria-label="Заполненность профиля"
            aria-valuenow={completion}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${completion}%` }} />
          </div>
          <small className="muted">Профиль заполнен на {completion}%</small>
        </div>
      </div>
      <form className="panel" onSubmit={submit} noValidate aria-busy={!loaded || busy}>
        <h2>
          <UserRound size={20} /> Основное
        </h2>
        <div className="form-grid">
          <label htmlFor="profile-displayName">
            Как к вам обращаться *
            <input
              {...field('displayName')}
              autoComplete="name"
              value={text('displayName')}
              onChange={(e) => set('displayName', e.target.value)}
            />
            <FieldHint id="profile-displayName-hint">Имя увидит диспетчер в заявке.</FieldHint>
            {error('displayName')}
          </label>
          <label htmlFor="profile-birthDate">
            Дата рождения
            <input
              {...field('birthDate')}
              type="date"
              autoComplete="bday"
              max={new Date().toISOString().slice(0, 10)}
              value={birth}
              onChange={(e) => set('birthDate', e.target.value)}
            />
            <FieldHint id="profile-birthDate-hint">
              {age !== undefined && age >= 0
                ? `Возраст: ${age}.`
                : 'Возраст считается сам. Нужен для льгот пенсионерам.'}
            </FieldHint>
            {error('birthDate')}
          </label>
          <div className="field wide">
            Пол
            <div className="segmented" role="group" aria-label="Пол">
              {genders.map(([v, n]) => (
                <button
                  type="button"
                  key={v}
                  aria-pressed={draft.gender === v}
                  onClick={() => set('gender', v)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <h2>Место жительства</h2>
        <div className="form-grid">
          <label>
            Город
            <Select
              aria-label="Город"
              value={text('city')}
              onChange={(e) => set('city', e.target.value)}
            >
              <option value="">Не указан</option>
              {pmrCities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <FieldHint id="profile-city-hint">
              Точный адрес дома добавляется отдельно — в «Мой адрес».
            </FieldHint>
          </label>
          <label htmlFor="profile-district">
            Район или микрорайон
            <input
              {...field('district')}
              placeholder="Например, Балка"
              value={text('district')}
              onChange={(e) => set('district', e.target.value)}
            />
            <FieldHint id="profile-district-hint">Поможет при авариях на целый квартал.</FieldHint>
            {error('district')}
          </label>
          <label htmlFor="profile-householdSize">
            Сколько человек живёт в квартире
            <input
              {...field('householdSize')}
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={text('householdSize')}
              onChange={(e) => set('householdSize', e.target.value)}
            />
            <FieldHint id="profile-householdSize-hint">
              Для начислений без счётчика (по нормативу).
            </FieldHint>
            {error('householdSize')}
          </label>
          <div className="field">
            Льготы
            <div className="check-pills">
              {benefitKinds.map(([v, n]) => (
                <label key={v}>
                  <input
                    type="checkbox"
                    checked={benefits.includes(v)}
                    onChange={(e) =>
                      set(
                        'benefits',
                        e.target.checked ? [...benefits, v] : benefits.filter((b) => b !== v),
                      )
                    }
                  />
                  {n}
                </label>
              ))}
            </div>
            <FieldHint>Документ всё равно покажут в абонотделе — здесь только отметка.</FieldHint>
          </div>
        </div>
        <h2>Связь</h2>
        <div className="form-grid">
          <label htmlFor="profile-phone">
            Телефон
            <input
              {...field('phone')}
              type="tel"
              autoComplete="tel"
              placeholder="+373 777 12345"
              value={text('phone')}
              onChange={(e) => set('phone', e.target.value)}
            />
            <FieldHint id="profile-phone-hint">Пробелы и скобки можно — уберём сами.</FieldHint>
            {error('phone')}
          </label>
          <label htmlFor="profile-email">
            Почта
            <input
              {...field('email')}
              type="email"
              autoComplete="email"
              placeholder="name@mail.md"
              value={text('email')}
              onChange={(e) => set('email', e.target.value)}
            />
            <FieldHint id="profile-email-hint">Для копий ответов по заявкам.</FieldHint>
            {error('email')}
          </label>
          <div className="field wide">
            Как удобнее связаться
            <div className="segmented" role="group" aria-label="Способ связи">
              {contactChannels.map(([v, n]) => (
                <button
                  type="button"
                  key={v}
                  aria-pressed={draft.contactChannel === v}
                  onClick={() => set('contactChannel', v)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label htmlFor="profile-about" className="wide">
            О себе и доступе в квартиру
            <textarea
              {...field('about')}
              maxLength={500}
              placeholder="Например: дома после 18:00, домофон не работает — звоните."
              value={text('about')}
              onChange={(e) => set('about', e.target.value)}
            />
            <FieldHint id="profile-about-hint">{text('about').length}/500</FieldHint>
            {error('about')}
          </label>
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="outline"
            disabled={busy}
            onClick={() => {
              setDraft(toDraft(saved));
              setErrors({});
            }}
          >
            Отменить изменения
          </button>
          <button className="primary" disabled={busy || !loaded}>
            <Save size={18} />
            {busy ? 'Сохраняем…' : 'Сохранить профиль'}
          </button>
        </div>
      </form>
    </>
  );
}
