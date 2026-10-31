import React from 'react';
import { createRoot } from 'react-dom/client';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function App() {
  const [positions, setPositions] = React.useState<Record<number, { bus_id: number; lat: number; lng: number }>>({});
  React.useEffect(() => {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/live`);
    ws.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.type === 'bus_position') setPositions(old => ({ ...old, [message.data.bus_id]: message.data }));
    };
    return () => ws.close();
  }, []);
  return <main><h1>IDDA · Canlı nəqliyyat</h1><p>İllüstrativ Bakı marşrutları — demo məlumatları</p>
    <MapContainer center={[40.39, 49.85]} zoom={13} style={{ height: '75vh' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors'/>
      {Object.values(positions).map(p => <CircleMarker key={p.bus_id} center={[p.lat, p.lng]}><Popup>Avtobus {p.bus_id}</Popup></CircleMarker>)}
    </MapContainer></main>;
}

createRoot(document.getElementById('root')!).render(<App/>);
