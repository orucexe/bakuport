import { useId, useMemo, useState } from "react";
import {
  AdvancedMarker,
  InfoWindow,
  useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";
import { BusFront, Maximize2, MapPin } from "lucide-react";
import { levelColor, levelText, utcDate } from "../api";
import {
  GoogleMapCanvas,
  GoogleMapViewport,
  GoogleRouteLines,
  GoogleStopLayer,
  type MapLine,
  type MapStop,
} from "./GoogleMaps";
import type { Bus, Density, Level, Route, Stop } from "../types";

function LiveBus({
  bus,
  route,
  level,
}: {
  bus: Bus;
  route?: Route;
  level: Level;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);
  if (!bus.position) return null;
  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={bus.position}
        title={`${route?.code} · ${bus.plate}`}
        onClick={() => setOpen(true)}
      >
        <div className="bus-map-icon">
          <span style={{ background: route?.color || "#087f8c" }}>
            <BusFront size={17} />
            <b>{bus.id}</b>
          </span>
        </div>
      </AdvancedMarker>
      {open && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)}>
          <div className="google-stop-info">
            <strong>
              {route?.code} · {bus.plate}
            </strong>
            <p>
              {Math.round(bus.position.speed_kmh)} km/saat · {levelText[level]}
            </p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

interface Props {
  catalog?: Stop[];
  routes: Route[];
  stops: Record<number, Stop[]>;
  buses: Bus[];
  density: Density[];
  selectedRoute: number;
  selectedStop?: number;
  operator?: boolean;
  onStop?: (stopId: number) => void;
}

export default function TransitMap({
  catalog = [],
  routes,
  stops,
  buses,
  density,
  selectedRoute,
  selectedStop,
  operator,
  onStop,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showCatalog, setShowCatalog] = useState(true);
  const [search, setSearch] = useState("");
  const [focusedStop, setFocusedStop] = useState<Stop | null>(null);
  const catalogId = useId();
  const visibleRoutes = useMemo(
    () =>
      operator ? routes : routes.filter((route) => route.id === selectedRoute),
    [operator, routes, selectedRoute],
  );
  const focusedStops = useMemo(
    () => (operator ? Object.values(stops).flat() : stops[selectedRoute] || []),
    [stops, operator, selectedRoute],
  );
  const matches = useMemo(
    () =>
      search.trim().length >= 2
        ? catalog
            .filter((stop) =>
              `${stop.name} ${stop.source_id}`
                .toLocaleLowerCase("az")
                .includes(search.trim().toLocaleLowerCase("az")),
            )
            .slice(0, 7)
        : [],
    [catalog, search],
  );
  const lines = useMemo<MapLine[]>(
    () =>
      visibleRoutes.map((route) => {
        const path = stops[route.id] || [];
        const d = density.find((d) => d.route_id === route.id);
        return {
          id: String(route.id),
          path: [...path, ...path.slice(0, 1)],
          color: operator
            ? levelColor[
                d && d.confidence !== "unavailable" ? d.level : "unknown"
              ]
            : route.color,
        };
      }),
    [visibleRoutes, stops, density, operator],
  );
  const mapStops = useMemo<MapStop[]>(() => {
    const result = new Map<string, MapStop>();
    if (showCatalog)
      catalog.forEach((stop) =>
        result.set(String(stop.id), {
          ...stop,
          id: String(stop.id),
          title: stop.name,
          color: "#668aa0",
          size: 3,
          selectable: false,
          details: [
            `Rəsmi dayanacaq · ID ${stop.source_id}`,
            ...(stop.stop_type ? [stop.stop_type] : []),
            "Marşrut uyğunluğu bu CSV məlumat dəstində yoxdur.",
          ],
        }),
      );
    visibleRoutes.forEach((route) =>
      (stops[route.id] || []).forEach((stop) =>
        result.set(String(stop.id), {
          ...stop,
          id: String(stop.id),
          title: stop.name,
          color: route.color,
          size: 5,
          selectable: true,
          details: [
            stop.source_id
              ? `OpenData.az · ID ${stop.source_id}`
              : "Demo dayanacağı",
            "Demo xəttinə daxil edilib; rəsmi marşrut uyğunluğu deyil.",
          ],
        }),
      ),
    );
    return [...result.values()];
  }, [showCatalog, catalog, visibleRoutes, stops]);
  const fresh = buses.filter(
    (bus) =>
      bus.position &&
      Date.now() - utcDate(bus.position.ts).getTime() < 30000 &&
      (operator || bus.route_id === selectedRoute),
  );
  return (
    <section
      className={`map-panel ${expanded ? "expanded-map" : ""}`}
      aria-label="Canlı nəqliyyat xəritəsi"
    >
      <div className="map-heading">
        <span>
          <MapPin size={16} />
          Bakı, Azərbaycan <small>· Google Maps</small>
        </span>
        <button
          className="icon-button"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? "Xəritəni kiçilt" : "Xəritəni böyüt"}
        >
          <Maximize2 size={16} />
        </button>
      </div>
      {catalog.length > 0 && (
        <div className="catalog-toolbar">
          <label className="catalog-toggle" htmlFor={catalogId}>
            <input
              id={catalogId}
              type="checkbox"
              checked={showCatalog}
              onChange={(event) => setShowCatalog(event.target.checked)}
            />
            {catalog.length.toLocaleString("az-AZ")} real dayanacaq
          </label>
          <div className="catalog-search">
            <label className="sr-only" htmlFor={`${catalogId}-search`}>
              Rəsmi dayanacaq adı və ya ID-si ilə axtar
            </label>
            <input
              id={`${catalogId}-search`}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Dayanacaq adı və ya ID…"
              autoComplete="off"
            />
            {search.trim().length >= 2 && (
              <div className="catalog-results">
                {matches.length ? (
                  matches.map((stop) => (
                    <button
                      key={stop.id}
                      onClick={() => {
                        setFocusedStop(stop);
                        setSearch("");
                      }}
                    >
                      <strong>{stop.name}</strong>
                      <small>ID {stop.source_id}</small>
                    </button>
                  ))
                ) : (
                  <p>Uyğun dayanacaq tapılmadı.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <GoogleMapCanvas className="transit-map">
        <GoogleMapViewport points={focusedStops} focus={focusedStop} />
        <GoogleRouteLines lines={lines} />
        <GoogleStopLayer
          stops={mapStops}
          selectedId={selectedStop ? String(selectedStop) : null}
          onSelect={(id) => onStop?.(Number(id))}
        />
        {fresh.map((bus) => {
          const d = density.find((d) => d.route_id === bus.route_id);
          return (
            <LiveBus
              key={bus.id}
              bus={bus}
              route={routes.find((route) => route.id === bus.route_id)}
              level={d && d.confidence !== "unavailable" ? d.level : "unknown"}
            />
          );
        })}
      </GoogleMapCanvas>
      <div className="map-legend">
        <span>
          <i className="legend-bus" />
          {fresh.length} canlı avtobus
        </span>
        <span>
          <i className="legend-stop" />
          Dayanacaq
        </span>
        <span className="map-live">
          <i />
          Google Maps
        </span>
      </div>
    </section>
  );
}
