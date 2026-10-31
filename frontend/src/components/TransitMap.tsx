import { useEffect, useId, useMemo, useState } from "react";
import { BusFront, Maximize2, MapPin } from "lucide-react";
import { levelColor, levelText, utcDate } from "../api";
import {
  GoogleMapCanvas,
  GoogleMapViewport,
  GoogleRouteLines,
  GoogleStopLayer,
  MapMarker,
  MapInfoWindow,
  MapProviderBadge,
  type MapLine,
  type MapStop,
} from "./GoogleMaps";
import type { Bus, Density, Level, Route, Stop } from "../types";

function LiveBus({
  bus,
  route,
  level,
  color,
}: {
  bus: Bus;
  route?: Route;
  level: Level;
  color?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!bus.position) return null;
  return (
    <>
      <MapMarker
        position={bus.position}
        title={`${route?.code} · ${bus.plate}`}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="bus-map-icon">
          <span style={{ background: color || route?.color || "#087f8c" }}>
            <BusFront size={17} />
            <b>{bus.id}</b>
          </span>
        </div>
      </MapMarker>
      {open && (
        <MapInfoWindow
          position={bus.position}
          onCloseClick={() => setOpen(false)}
        >
          <div className="google-stop-info">
            <strong>
              {route?.code} · {bus.plate}
            </strong>
            <p>
              {Math.round(bus.position.speed_kmh)} km/saat · {levelText[level]}
            </p>
          </div>
        </MapInfoWindow>
      )}
    </>
  );
}

interface Props {
  variant?: "passenger";
  focusRequest?: number;
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
  variant,
  focusRequest = 0,
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
  const [showCatalog, setShowCatalog] = useState(false);
  const [search, setSearch] = useState("");
  const [focusedStop, setFocusedStop] = useState<Stop | null>(null);
  useEffect(() => {
    if (!focusRequest || !selectedStop) return;
    const stop = Object.values(stops)
      .flat()
      .find((stop) => stop.id === selectedStop);
    if (stop) setFocusedStop({ ...stop });
  }, [focusRequest, selectedStop, stops]);
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
            : variant === "passenger"
              ? "#ff385c"
              : route.color,
        };
      }),
    [visibleRoutes, stops, density, operator, variant],
  );
  const mapStops = useMemo<MapStop[]>(() => {
    const result = new Map<string, MapStop>();

    // 1. Only route stops for the selected or visible routes (very fast, ~10-30 stops total)
    visibleRoutes.forEach((route) =>
      (stops[route.id] || []).forEach((stop) =>
        result.set(String(stop.id), {
          ...stop,
          id: String(stop.id),
          title: stop.name,
          color: variant === "passenger" ? "#ff385c" : route.color,
          size: route.id === selectedRoute ? 6 : 4,
          selectable: true,
          details: [
            stop.source_id
              ? `OpenData.az · ID ${stop.source_id}`
              : "Dayanacaq",
            `Xətt: ${route.code}`,
          ],
        }),
      ),
    );

    // 2. If user searched in catalog, show matching stops (max 10)
    if (matches.length > 0) {
      matches.forEach((stop) =>
        result.set(String(stop.id), {
          ...stop,
          id: String(stop.id),
          title: stop.name,
          color: "#0284c7",
          size: 7,
          selectable: true,
          details: [
            `Rəsmi dayanacaq · ID ${stop.source_id}`,
            stop.stop_type || "Dayanacaq",
          ],
        }),
      );
    } else if (showCatalog) {
      // If user explicitly enables full catalog, limit to max 50 to prevent browser freezing
      catalog.slice(0, 50).forEach((stop) =>
        result.set(String(stop.id), {
          ...stop,
          id: String(stop.id),
          title: stop.name,
          color: variant === "passenger" ? "#929292" : "#668aa0",
          size: 3,
          selectable: false,
          details: [
            `Rəsmi dayanacaq · ID ${stop.source_id}`,
            ...(stop.stop_type ? [stop.stop_type] : []),
          ],
        }),
      );
    }

    return [...result.values()];
  }, [showCatalog, catalog, visibleRoutes, stops, variant, matches, selectedRoute]);
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
          selectedColor={variant === "passenger" ? "#ff385c" : undefined}
          stops={mapStops}
          selectedId={selectedStop ? String(selectedStop) : null}
          onSelect={(id) => onStop?.(Number(id))}
        />
        {fresh.map((bus) => {
          const d = density.find((d) => d.route_id === bus.route_id);
          return (
            <LiveBus
              color={variant === "passenger" ? "#ff385c" : undefined}
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
        <MapProviderBadge />
      </div>
    </section>
  );
}
