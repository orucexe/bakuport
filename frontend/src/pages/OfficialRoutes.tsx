import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  ArrowLeftRight,
  Building2,
  ExternalLink,
  MapPin,
  Route,
  ShieldCheck,
} from "lucide-react";
import { api, utcDate } from "../api";

interface Point {
  lat: number;
  lng: number;
}
interface OfficialStop extends Point {
  source_id: number;
  source_code: string;
  name: string;
  sequence: number;
}
interface Direction {
  id: number;
  label: string;
  shape: Point[];
  stops: OfficialStop[];
}
interface Provenance {
  source_url: string;
  fetched_at: string;
  stale: boolean;
  live_positions_available: boolean;
}
interface Catalog extends Provenance {
  routes: { source_id: number; code: string }[];
}
interface OfficialRoute extends Provenance {
  source_id: number;
  code: string;
  carrier: string;
  first_stop: string;
  last_stop: string;
  length_km: number;
  tariff_label: string;
  directions: Direction[];
}

function MapFocus({
  shape,
  stop,
}: {
  shape: Point[];
  stop: OfficialStop | null;
}) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(
      L.latLngBounds(shape.map((point) => [point.lat, point.lng])),
      { padding: [35, 35], maxZoom: 14, animate: false },
    );
  }, [map, shape]);
  useEffect(() => {
    if (stop) map.setView([stop.lat, stop.lng], 16, { animate: false });
  }, [map, stop]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

export default function OfficialRoutes() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selectedId, setSelectedId] = useState(1);
  const [route, setRoute] = useState<OfficialRoute | null>(null);
  const [directionId, setDirectionId] = useState(1);
  const [selectedSequence, setSelectedSequence] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tileError, setTileError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<Catalog>("/official/routes", { signal: controller.signal })
      .then((data) => {
        setCatalog(data);
        setSelectedId((old) =>
          data.routes.some((r) => r.source_id === old)
            ? old
            : data.routes[0].source_id,
        );
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    if (!catalog) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setRoute(null);
    setSelectedSequence(null);
    api<OfficialRoute>(`/official/routes/${selectedId}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setRoute(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [catalog, selectedId, retry]);
  const direction =
    route?.directions.find((d) => d.id === directionId) || route?.directions[0];
  const stop =
    direction?.stops.find((stop) => stop.sequence === selectedSequence) || null;
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">AYNA · RƏSMİ MARŞRUTLAR</div>
          <h1>
            Şəhərin real yolları<span>.</span>
          </h1>
          <p>
            Həqiqi marşrutlar, dayanacaq ardıcıllığı və hər iki istiqamətin yol
            sxemi.
          </p>
        </div>
        <span className="operator-tag">
          <ShieldCheck size={16} />
          Rəsmi mənbə
        </span>
      </div>
      <div className="official-notice">
        <ShieldCheck size={20} aria-hidden="true" />
        <p>
          Bu bölmədəki marşrutlar AYNA-nın rəsmi xəritə xidmətindəndir.{" "}
          <strong>Canlı GPS mənbəyi təsdiqlənməyib:</strong> burada hərəkət edən
          avtobus, doluluq və canlı ETA göstərilmir.
        </p>
      </div>
      <section className="card official-picker">
        <label htmlFor="official-route">
          Rəsmi marşrutu seçin
          <select
            id="official-route"
            value={selectedId}
            onChange={(e) => {
              setSelectedId(Number(e.target.value));
              setDirectionId(1);
            }}
            disabled={!catalog}
          >
            {catalog?.routes.map((route) => (
              <option value={route.source_id} key={route.source_id}>
                № {route.code}
              </option>
            ))}
          </select>
        </label>
        <div>
          <strong>{catalog?.routes.length ?? "—"} marşrut</strong>
          <small>Rəsmi kataloq · demo xətti deyil</small>
        </div>
        {route && (
          <div className="official-fetched">
            <span>Son alınma</span>
            <time dateTime={route.fetched_at}>
              {utcDate(route.fetched_at).toLocaleString("az-AZ", {
                timeZone: "Asia/Baku",
              })}{" "}
              AZT
            </time>
          </div>
        )}
      </section>
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setRetry((n) => n + 1)}>
            Yenidən cəhd et
          </button>
        </div>
      )}
      {loading ? (
        <div className="chart-empty" role="status">
          Rəsmi marşrut məlumatları yüklənir…
        </div>
      ) : route && direction ? (
        <>
          {route.stale && (
            <div className="official-stale" role="status">
              AYNA mənbəyi hazırda əlçatan deyil. Son alınma tarixi yuxarıda
              göstərilən saxlanmış nüsxə təqdim edilir.
            </div>
          )}
          <div className="official-summary">
            <div>
              <span>
                <Route size={16} /> Marşrut № {route.code}
              </span>
              <h2>
                {route.first_stop} — {route.last_stop}
              </h2>
            </div>
            <div>
              <Building2 size={16} />
              <span>{route.carrier}</span>
            </div>
            <div>
              <strong>{route.tariff_label}</strong>
              <small>Mənbədə göstərilən tarif</small>
            </div>
            <div>
              <strong>{route.length_km} km</strong>
              <small>Mənbədəki marşrut uzunluğu</small>
            </div>
          </div>
          <div className="official-directions" aria-label="Marşrut istiqaməti">
            <ArrowLeftRight size={17} />
            {route.directions.map((item) => (
              <button
                key={item.id}
                aria-pressed={direction.id === item.id}
                className={direction.id === item.id ? "active" : ""}
                onClick={() => {
                  setDirectionId(item.id);
                  setSelectedSequence(null);
                }}
              >
                {item.label}
                <span>{item.stops.length} dayanacaq</span>
              </button>
            ))}
          </div>
          <div className="official-layout">
            <section
              className="map-panel official-map"
              aria-label="Rəsmi marşrutun yol sxemi"
            >
              <div className="map-heading">
                <span>
                  <MapPin size={16} /> № {route.code} · {direction.label}
                </span>
                <small>Hərəkət sxemi · statik məlumat</small>
              </div>
              <MapContainer
                center={[40.39, 49.85]}
                zoom={12}
                preferCanvas
                className="official-leaflet"
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  eventHandlers={{ tileerror: () => setTileError(true) }}
                />
                <MapFocus shape={direction.shape} stop={stop} />
                <Polyline
                  positions={direction.shape.map((point) => [
                    point.lat,
                    point.lng,
                  ])}
                  pathOptions={{ color: "#087f81", weight: 5, opacity: 0.8 }}
                />
                {direction.stops.map((item) => (
                  <CircleMarker
                    key={item.sequence}
                    center={[item.lat, item.lng]}
                    radius={selectedSequence === item.sequence ? 9 : 5}
                    pathOptions={{
                      color:
                        selectedSequence === item.sequence
                          ? "#8361cd"
                          : "#087f81",
                      fillColor: "#fff",
                      fillOpacity: 1,
                      weight: 2,
                    }}
                    eventHandlers={{
                      click: () => setSelectedSequence(item.sequence),
                    }}
                  >
                    <Popup>
                      <strong>
                        {item.sequence}. {item.name}
                      </strong>
                      <p>AYNA dayanacaq kodu: {item.source_code}</p>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
              {tileError && <div className="tile-error" role="status">Xəritə fonu yüklənmədi. Rəsmi yol xətti və dayanacaqlar göstərilir.</div>}
              <div className="map-legend">
                <span>
                  <i className="legend-stop" />
                  {direction.stops.length} rəsmi dayanacaq
                </span>
                <span>Canlı avtobus mövqeyi yoxdur</span>
              </div>
            </section>
            <section className="card official-stops">
              <div className="section-title">
                <h2>Dayanacaqların ardıcıllığı</h2>
                <span className="subtle-tag">{direction.label}</span>
              </div>
              <ol>
                {direction.stops.map((item) => (
                  <li key={item.sequence}>
                    <button
                      className={
                        selectedSequence === item.sequence ? "active" : ""
                      }
                      aria-pressed={selectedSequence === item.sequence}
                      onClick={() => setSelectedSequence(item.sequence)}
                    >
                      <span>{item.sequence}</span>
                      <div>
                        <strong>{item.name}</strong>
                        <small>AYNA kodu: {item.source_code}</small>
                      </div>
                      <MapPin size={14} />
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          </div>
          <a
            className="official-source"
            href={route.source_url}
            target="_blank"
            rel="noreferrer"
          >
            Mənbə: Azərbaycan Yerüstü Nəqliyyat Agentliyi · Map AYNA
            <ExternalLink size={13} />
          </a>
        </>
      ) : (
        !error && (
          <div className="chart-empty">Bu marşrut üçün məlumat yoxdur.</div>
        )
      )}
    </>
  );
}
