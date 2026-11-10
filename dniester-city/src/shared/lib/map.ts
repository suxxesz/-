import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Тайлы OpenStreetMap (бесплатно, без ключа). В тёмной теме слой тайлов затемняется фильтром
// в map.css — только картинки карты, пины и подсказки остаются в цветах темы.
const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const attribution = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Карта с тайлами OSM, своими кнопками масштаба справа снизу. Возвращает карту и функцию очистки. */
export function createMap(el: HTMLElement, options: L.MapOptions = {}) {
  const map = L.map(el, { zoomControl: false, attributionControl: true, ...options });
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map);
  return { map, dispose: () => void map.remove() };
}

/** Пин-капля с цветом и иконкой (SVG-строкой). pulse — пульсирующее кольцо для текущих событий. */
export function pin(color: string, svg = '', pulse = false) {
  return L.divIcon({
    className: 'dc-pin',
    iconSize: [34, 42],
    iconAnchor: [17, 40],
    popupAnchor: [0, -36],
    tooltipAnchor: [0, -34],
    html: `${pulse ? `<span class="dc-pin-pulse" style="--pin:${color}"></span>` : ''}<span class="dc-pin-body" style="--pin:${color}">${svg}</span>`,
  });
}

/** Кнопка «Где я» — центрирует карту на геопозиции пользователя. */
export function locateControl(map: L.Map) {
  const Control = L.Control.extend({
    onAdd() {
      const b = L.DomUtil.create('button', 'dc-map-btn');
      b.type = 'button';
      b.title = 'Показать, где я';
      b.setAttribute('aria-label', 'Показать, где я');
      b.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/></svg>';
      L.DomEvent.disableClickPropagation(b);
      b.onclick = () => map.locate({ setView: true, maxZoom: 16 });
      return b;
    },
  });
  new Control({ position: 'bottomright' }).addTo(map);
  map.on('locationfound', (e) => L.circleMarker(e.latlng, { radius: 7, color: '#fff', weight: 3, fillColor: '#1f5fd6', fillOpacity: 1 }).addTo(map));
}
