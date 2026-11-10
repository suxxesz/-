import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { PMR_BOUNDS, type Report } from '@/entities/city/model/types';
import { createMap, locateControl, pin } from '@/shared/lib/map';
const bounds = L.latLngBounds([PMR_BOUNDS.south, PMR_BOUNDS.west], [PMR_BOUNDS.north, PMR_BOUNDS.east]);
const pickIcon = pin('#1f5fd6', '<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="12" r="6"/></svg>');
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
    pick = useRef(onPick),
    [map, setMap] = useState<L.Map>();
  pick.current = onPick;
  // Карта создаётся один раз: раньше она пересоздавалась на каждый клик и сбрасывала масштаб.
  useEffect(() => {
    if (!ref.current) return;
    const m = createMap(ref.current, { maxBounds: bounds, minZoom: 8, scrollWheelZoom: mode === 'pick' });
    m.map.setView([46.84, 29.63], 12);
    locateControl(m.map);
    if (mode === 'pick') m.map.on('click', (e) => pick.current?.(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)));
    setMap(m.map);
    return m.dispose;
  }, [mode]);
  useEffect(() => {
    if (!map || mode !== 'heat') return;
    const layer = L.featureGroup().addTo(map);
    reports.forEach((r) => {
      const color = r.status === 'Исполнено' ? '#1f9d6b' : '#e0533d';
      L.circle([r.lat, r.lng], { radius: 140, stroke: false, fillColor: color, fillOpacity: 0.22 }).addTo(layer);
      const dot = L.circleMarker([r.lat, r.lng], { radius: 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }).addTo(layer);
      const tip = document.createElement('span');
      tip.textContent = `${r.type}: ${r.title} (${r.status})`;
      dot.bindTooltip(tip, { className: 'dc-map-tip', direction: 'top' });
    });
    if (reports.length) map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 15 });
    return () => void layer.remove();
  }, [map, mode, reports]);
  useEffect(() => {
    if (!map || !point) return;
    const marker = L.marker(point, { icon: pickIcon }).addTo(map);
    map.panTo(point);
    return () => void marker.remove();
  }, [map, point]);
  return <div ref={ref} className="map" aria-label={mode === 'heat' ? 'Тепловая карта жалоб' : 'Выберите точку на карте ПМР'} />;
}
