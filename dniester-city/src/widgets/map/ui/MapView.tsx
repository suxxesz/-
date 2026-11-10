import { createElement, useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import { type CityEvent, serviceById, dateText, timeText } from '@/entities/city/model/types';
import { serviceIcons } from '@/entities/city/ui';
import { InfoStrip } from '@/shared/ui/ui';
import { createMap, locateControl, pin } from '@/shared/lib/map';

const icon = (e: CityEvent) =>
  pin(
    serviceById(e.category).color,
    renderToStaticMarkup(
      createElement(serviceIcons[e.category], { size: 16, color: '#fff', strokeWidth: 2.4 }),
    ),
    e.status === 'Выполняется',
  );

export default function MapView({
  events,
  onSelect,
}: {
  events: CityEvent[];
  onSelect: (e: CityEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    selectRef = useRef(onSelect),
    [map, setMap] = useState<L.Map>();
  selectRef.current = onSelect;
  useEffect(() => {
    if (!ref.current) return;
    const m = createMap(ref.current, { scrollWheelZoom: false });
    m.map.setView([46.84, 29.63], 14);
    locateControl(m.map);
    setMap(m.map);
    return m.dispose;
  }, []);
  useEffect(() => {
    if (!map) return;
    const layer = L.featureGroup().addTo(map);
    events.forEach((e, i) => {
      const marker = L.marker([46.841 + i * 0.002, 29.624 + i * 0.004], {
        icon: icon(e),
        keyboard: true,
        title: e.title,
      }).addTo(layer);
      // Название события — пользовательские данные, поэтому только textContent.
      const tip = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = e.title;
      const when = document.createElement('small');
      when.textContent = `${serviceById(e.category).short} · ${dateText(e.start)}, ${timeText(e.start)}`;
      tip.append(title, when);
      marker.bindTooltip(tip, { className: 'dc-map-tip', direction: 'top' });
      marker.on('click keypress', () => selectRef.current(e));
    });
    if (events.length) map.fitBounds(layer.getBounds(), { padding: [48, 48], maxZoom: 15 });
    return () => void layer.remove();
  }, [map, events]);
  return (
    <>
      <InfoStrip>
        Учебная карта: точки условные. В пилоте координаты будут привязаны к проверенным адресам.
      </InfoStrip>
      <div ref={ref} className="map" aria-label="Карта коммунальных событий" />
      <div className="map-legend" aria-hidden="true">
        {[...new Set(events.map((e) => e.category))].map((c) => (
          <span key={c}>
            <i style={{ background: serviceById(c).color }} />
            {serviceById(c).short}
          </span>
        ))}
      </div>
    </>
  );
}
