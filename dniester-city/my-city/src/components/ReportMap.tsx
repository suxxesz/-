import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PMR_BOUNDS, type Report } from '../model';
const bounds = L.latLngBounds([PMR_BOUNDS.south, PMR_BOUNDS.west], [PMR_BOUNDS.north, PMR_BOUNDS.east]);
export default function ReportMap({
  mode,
  reports = [],
  point,
  onPick,
}: {
  mode: 'pick' | 'heat';
  reports?: Report[];
  point?: [number, number];
  onPick?: (lat: number, lng: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    pick = useRef(onPick);
  pick.current = onPick;
  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { maxBounds: bounds, minZoom: 8 }).setView([46.84, 29.63], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);
    if (mode === 'heat')
      reports.forEach((r) =>
        L.circleMarker([r.lat, r.lng], {
          radius: 22,
          stroke: false,
          fillColor: r.status === 'Исполнено' ? '#3f8987' : '#d6452f',
          fillOpacity: 0.28,
        })
          .bindTooltip(`${r.type}: ${r.title} (${r.status})`)
          .addTo(map),
      );
    else {
      if (point) L.marker(point).addTo(map);
      map.on('click', (e) => pick.current?.(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)));
    }
    return () => void map.remove();
  }, [mode, reports, point]);
  return <div ref={ref} className="map" aria-label={mode === 'heat' ? 'Тепловая карта жалоб' : 'Выберите точку на карте ПМР'} />;
}
