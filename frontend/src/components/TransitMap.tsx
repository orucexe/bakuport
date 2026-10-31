import { Fragment, useEffect, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { Maximize2, MapPin } from 'lucide-react';
import { levelColor, levelText, utcDate } from '../api';
import type { Bus, Density, Route, Stop } from '../types';

function FitRoute({ stops }: { stops: Stop[] }) {
  const map = useMap();
  useEffect(() => { if (stops.length) map.fitBounds(L.latLngBounds(stops.map(s => [s.lat, s.lng])), { padding: [45, 45], maxZoom: 14 }); }, [map, stops]);
  return null;
}
function ResizeMap() {
  const map = useMap();
  useEffect(() => { const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(map.getContainer()); return () => observer.disconnect(); }, [map]);
  return null;
}
const icons = new Map<string, L.DivIcon>();
function busIcon(id: number, color: string) {
  const key = `${id}-${color}`;
  if (!icons.has(key)) icons.set(key, L.divIcon({ className: 'bus-map-icon', html: `<span style="background:${color}"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 11h14M9 3v8M8 19v3M16 19v3"/><circle cx="8.5" cy="15" r=".8"/><circle cx="15.5" cy="15" r=".8"/></svg><b>${id}</b></span>`, iconSize: [52, 34], iconAnchor: [26, 17] }));
  return icons.get(key)!;
}
interface Props { routes: Route[]; stops: Record<number, Stop[]>; buses: Bus[]; density: Density[]; selectedRoute: number; selectedStop?: number; operator?: boolean; onStop?: (stopId: number) => void }
export default function TransitMap({ routes, stops, buses, density, selectedRoute, selectedStop, operator, onStop }: Props) {
  const [tileError, setTileError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const visibleRoutes = operator ? routes : routes.filter(r => r.id === selectedRoute);
  const focusedStops = stops[selectedRoute] || [];
  const fresh = buses.filter(b => b.position && Date.now() - utcDate(b.position.ts).getTime() < 30000 && (operator || b.route_id === selectedRoute));
  return <section className={`map-panel ${expanded ? 'expanded-map' : ''}`} aria-label="Canlı nəqliyyat xəritəsi">
    <div className="map-heading"><span><MapPin size={16}/> Bakı, Azərbaycan <small>· Demo şəbəkəsi</small></span><button className="icon-button" onClick={() => setExpanded(v => !v)} aria-label={expanded ? 'Xəritəni kiçilt' : 'Xəritəni böyüt'}><Maximize2 size={16}/></button></div>
    <MapContainer center={[40.39, 49.85]} zoom={13} scrollWheelZoom className="transit-map">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' eventHandlers={{ tileerror: () => setTileError(true), load: () => setTileError(false) }}/>
      <FitRoute stops={focusedStops}/><ResizeMap/>
      {visibleRoutes.map(route => {
        const routeStops = stops[route.id] || [];
        const d = density.find(d => d.route_id === route.id);
        const color = operator ? levelColor[d && d.confidence !== 'unavailable' ? d.level : 'unknown'] : route.color;
        return <Fragment key={route.id}><Polyline positions={[...routeStops, ...routeStops.slice(0, 1)].map(s => [s.lat, s.lng])} pathOptions={{ color, weight: 5, opacity: 0.8 }}/>
          {routeStops.map(stop => <CircleMarker key={stop.id} center={[stop.lat, stop.lng]} radius={stop.id === selectedStop ? 9 : 4} pathOptions={{ color: stop.id === selectedStop ? '#152d33' : color, fillColor: '#fff', fillOpacity: 1, weight: 2.5 }} eventHandlers={{ click: () => onStop?.(stop.id) }}><Popup><strong>{stop.name}</strong><p>Demo dayanacağı</p></Popup></CircleMarker>)}
        </Fragment>;
      })}
      {fresh.map(bus => {
        const route = routes.find(r => r.id === bus.route_id); const d = density.find(d => d.route_id === bus.route_id);
        return <Marker key={bus.id} position={[bus.position!.lat, bus.position!.lng]} icon={busIcon(bus.id, route?.color || '#087f8c')}><Popup><strong>{route?.code} · {bus.plate}</strong><p>{Math.round(bus.position!.speed_kmh)} km/saat · {levelText[d && d.confidence !== 'unavailable' ? d.level : 'unknown']}</p></Popup></Marker>;
      })}
    </MapContainer>
    <div className="map-legend"><span><i className="legend-bus"/>{fresh.length} canlı avtobus</span><span><i className="legend-stop"/>Dayanacaq</span><span className="map-live"><i/>Canlı xəritə</span></div>
    {tileError && <div className="tile-error" role="status">Xəritə fonu yüklənmədi. İnternet bağlantısını yoxlayın; canlı mövqelər göstərilir.</div>}
  </section>;
}
