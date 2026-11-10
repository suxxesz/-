import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { Route } from '@/entities/transport/model/data';
import { createMap, locateControl } from '@/shared/lib/map';

/** Линия маршрутки с остановками; конечные крупнее. */
export default function RouteMap({ route }: { route: Route }) {
  const ref = useRef<HTMLDivElement>(null),
    [map, setMap] = useState<L.Map>();
  useEffect(() => {
    if (!ref.current) return;
    const m = createMap(ref.current, { scrollWheelZoom: false });
    m.map.setView([46.84, 29.6], 12);
    locateControl(m.map);
    setMap(m.map);
    return m.dispose;
  }, []);
  useEffect(() => {
    if (!map) return;
    const layer = L.featureGroup().addTo(map);
    const line = route.stops.map((s) => [s.lat, s.lng] as [number, number]);
    L.polyline(line, { color: '#fff', weight: 9, opacity: 0.9 }).addTo(layer);
    L.polyline(line, { color: route.color, weight: 5 }).addTo(layer);
    route.stops.forEach((s, i) => {
      const end = i === 0 || i === route.stops.length - 1;
      L.circleMarker([s.lat, s.lng], {
        radius: end ? 8 : 5,
        color: route.color,
        weight: 3,
        fillColor: '#fff',
        fillOpacity: 1,
      })
        .bindTooltip(s.name, { className: 'dc-map-tip', direction: 'top', permanent: end })
        .addTo(layer);
    });
    map.fitBounds(layer.getBounds(), { padding: [36, 36] });
    return () => void layer.remove();
  }, [map, route]);
  return <div ref={ref} className="map route-map" aria-label={`Карта маршрута ${route.number}`} />;
}
