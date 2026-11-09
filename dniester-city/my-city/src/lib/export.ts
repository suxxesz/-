import { type State, serviceById } from '../model';
export function exportReadings(state: State) {
  const rows = [
    ['Номер', 'Адрес', 'Услуга', 'Счётчик', 'Период', 'Показания', 'Расход', 'Статус'],
    ...state.readings.map((r) => [
      r.id,
      r.address,
      serviceById(r.category).name,
      state.meters.find((m) => m.id === r.meterId)?.serial || 'Не указан',
      r.period,
      String(r.value),
      String(r.value - r.previous),
      r.status,
    ]),
  ];
  const escape = (s: string) =>
    '"' + (/^[\s]*[=+@\-]/.test(s) ? "'" : '') + s.replaceAll('"', '""') + '"';
  const blob = new Blob(['\uFEFF' + rows.map((r) => r.map(escape).join(';')).join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = 'мой-город-показания.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
