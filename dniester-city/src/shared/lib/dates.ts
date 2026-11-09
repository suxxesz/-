export const timeZone = 'Europe/Chisinau';
export const dateText = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone });
export const timeText = (value: string) =>
  new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone });
export const monthText = (value: string) =>
  new Date(`${value}-15T12:00:00Z`).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
    timeZone,
  });
export const currentPeriod = () => {
  const p = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: '2-digit',
    timeZone,
  }).formatToParts(new Date());
  return `${p.find((x) => x.type === 'year')!.value}-${p.find((x) => x.type === 'month')!.value}`;
};
export function wallTime(value: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  })
    .format(new Date(value))
    .replace(' ', 'T');
}
export function eventTime(value: string): string {
  if (/(Z|[+-]\d{2}:\d{2})$/.test(value)) return new Date(value).toISOString();
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) throw Error('Укажите корректные дату и время.');
  const base = Date.parse(value + 'Z');
  let candidate = base;
  for (let i = 0; i < 3; i++) {
    const shown = Date.parse(wallTime(new Date(candidate).toISOString()) + 'Z');
    candidate += base - shown;
  }
  const iso = new Date(candidate).toISOString();
  if (wallTime(iso) !== value) throw Error('Это время не существует при переходе на летнее время.');
  return iso;
}
