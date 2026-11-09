import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { type CityEvent, serviceById } from '../model';
import { InfoStrip } from './ui';
export default function MapView({
  events,
  onSelect,
}: {
  events: CityEvent[];
  onSelect: (e: CityEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current).setView([46.84, 29.63], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);
    events.forEach((e, i) => {
      const marker = L.circleMarker([46.841 + i * 0.002, 29.624 + i * 0.004], {
        radius: 12,
        color: serviceById(e.category).color,
        fillOpacity: 0.7,
      }).addTo(map);
      const label = document.createElement('span');
      label.textContent = e.title;
      marker.bindTooltip(label);
      marker.on('click', () => selectRef.current(e));
    });
    return () => {
      map.remove();
    };
  }, [events]);
  return (
    <>
      <InfoStrip>
        Учебная карта: точки условные. В пилоте координаты будут привязаны к проверенным адресам.
      </InfoStrip>
      <div ref={ref} className="map" aria-label="Карта учебных коммунальных событий" />
    </>
  );
}
