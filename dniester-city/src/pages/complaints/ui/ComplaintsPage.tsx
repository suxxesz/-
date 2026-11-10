import { lazy, Suspense, useState } from 'react';
import { useCity } from '@/entities/city/model/store';
import { PageHeading, InfoStrip, Empty, Pill } from '@/shared/ui/ui';
import { reportTypes, reportStatuses, type Report } from '@/entities/city/model/types';
import { dateText } from '@/shared/lib/dates';
import { Select } from '@/shared/ui/Select';
const ReportMap = lazy(() => import('@/widgets/map/ui/ReportMap'));
const readFile = (f: File) =>
  new Promise<string>((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => no(Error('Не удалось прочитать файл.'));
    r.readAsDataURL(f);
  });
export default function Complaints() {
  const { state, role, act } = useCity(),
    reports = state.reports ?? [],
    [type, setType] = useState<(typeof reportTypes)[number]>('ЖКХ'),
    [title, setTitle] = useState(''),
    [description, setDescription] = useState(''),
    [address, setAddress] = useState(''),
    [point, setPoint] = useState<[number, number]>(),
    [file, setFile] = useState<File>(),
    [err, setErr] = useState('');
  async function submit() {
    setErr('');
    if (!file) return setErr('Прикрепите фото или видео проблемы.');
    if (file.size > 2_000_000) return setErr('Файл больше 2 МБ.');
    if (!point && !address.trim()) return setErr('Отметьте точку на карте ПМР или укажите адрес.');
    const media = await readFile(file);
    const ok = await act(
      {
        type: 'report.create',
        payload: {
          type,
          title,
          description,
          address: address.trim() || `Точка на карте ${point![0]}, ${point![1]}`,
          lat: point?.[0] ?? 46.84,
          lng: point?.[1] ?? 29.63,
          media,
          mediaKind: file.type.startsWith('video') ? 'video' : 'image',
        },
      },
      'Жалоба принята',
    );
    if (ok) {
      setTitle('');
      setDescription('');
      setAddress('');
      setPoint(undefined);
      setFile(undefined);
    }
  }
  async function advance(r: Report, file?: File) {
    const next = reportStatuses[reportStatuses.indexOf(r.status) + 1];
    await act(
      {
        type: 'report.status',
        payload: {
          id: r.id,
          status: next,
          comment: next === 'Исполнено' ? 'Работы выполнены.' : 'Исполнитель назначен.',
          reportPhoto: file ? await readFile(file) : undefined,
          expectedVersion: r.version,
        },
      },
      `Статус: ${next}`,
    );
  }
  return (
    <>
      <PageHeading
        title="Книга жалоб"
        subtitle="ЖКХ, дороги и благоустройство: фото, точка на карте и открытый статус."
      />
      <InfoStrip>
        Обязательны фото или видео и точка на карте ПМР (или адрес). Это не вызов аварийной службы.
      </InfoStrip>
      <section className="panel" style={{ padding: 20, display: 'grid', gap: 12 }}>
        <Select
          aria-label="Категория"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
        >
          {reportTypes.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
        <input
          aria-label="Кратко"
          placeholder="Например: яма на ул. Ленина"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          aria-label="Описание"
          placeholder="Что случилось?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          aria-label="Адрес"
          placeholder="Адрес (если не отмечаете точку)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <Suspense fallback={<Empty title="Загрузка карты">Подождите…</Empty>}>
          <ReportMap mode="pick" point={point} onPick={(a, b) => setPoint([a, b])} />
        </Suspense>
        <input
          aria-label="Фото или видео"
          type="file"
          accept="image/*,video/*"
          onChange={(e) => setFile(e.target.files?.[0])}
        />
        {err && <p role="alert">{err}</p>}
        <button className="primary" onClick={submit}>
          Отправить жалобу
        </button>
      </section>
      {role !== 'resident' && (
        <Suspense fallback={null}>
          <h2>Тепловая карта проблем</h2>
          <ReportMap mode="heat" reports={reports} />
        </Suspense>
      )}
      <div className="ticket-list">
        {reports.map((r) => (
          <article className="panel" key={r.id} style={{ padding: 16 }}>
            <small className="muted">
              {r.id.slice(0, 12)} · {dateText(r.created)} · {r.type}
            </small>
            <h3>{r.title}</h3>
            <p>{r.description}</p>
            <ol
              aria-label="Статус"
              style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0 }}
            >
              {reportStatuses.map((s, i) => (
                <li key={s}>
                  <Pill tone={i <= reportStatuses.indexOf(r.status) ? 'success' : 'neutral'}>
                    {s}
                  </Pill>
                </li>
              ))}
            </ol>
            {r.mediaKind === 'image' ? (
              <img src={r.media} alt="Фото проблемы" style={{ maxWidth: 240, borderRadius: 12 }} />
            ) : (
              <video src={r.media} controls style={{ maxWidth: 240 }} />
            )}
            {r.reportPhoto && (
              <img
                src={r.reportPhoto}
                alt="Фотоотчёт исполнителя"
                style={{ maxWidth: 240, borderRadius: 12 }}
              />
            )}
            {role !== 'resident' &&
              r.status !== 'Исполнено' &&
              (r.status === 'Принято' ? (
                <button className="primary" onClick={() => advance(r)}>
                  Взять в работу
                </button>
              ) : (
                <label>
                  Фотоотчёт и закрытие{' '}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && advance(r, e.target.files[0])}
                  />
                </label>
              ))}
          </article>
        ))}
      </div>
      {!reports.length && <Empty title="Жалоб пока нет">Отправьте первую жалобу выше.</Empty>}
    </>
  );
}
