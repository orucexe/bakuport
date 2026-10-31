import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  APIProvider,
  Map as GoogleMap,
  useMap,
  AdvancedMarker,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import L from "leaflet";
import "../maps.css";

export type MapProvider = "google" | "osm";

interface MapsStatusContextType {
  provider: MapProvider;
  activeProvider: MapProvider;
  ready: boolean;
  googleAvailable: boolean;
  toggleProvider: () => void;
  setProvider: (p: MapProvider) => void;
  error: string;
}

const MapsStatus = createContext<MapsStatusContextType>({
  provider: "google",
  activeProvider: "google",
  ready: false,
  googleAvailable: false,
  toggleProvider: () => {},
  setProvider: () => {},
  error: "",
});

export const useMapStatus = () => useContext(MapsStatus);

const LeafletContext = createContext<{ map: L.Map | null }>({ map: null });
export const useLeafletMap = () => useContext(LeafletContext).map;

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  const [requestedProvider, setRequestedProvider] = useState<MapProvider>(() => {
    return (localStorage.getItem("bakuport_map_engine") as MapProvider) || "google";
  });
  const [googleAvailable, setGoogleAvailable] = useState<boolean>(Boolean(key));
  const [googleReady, setGoogleReady] = useState(false);
  const [error, setError] = useState("");

  // Listen for Google Maps authentication/authorization failures
  useEffect(() => {
    const previous = window.gm_authFailure;
    window.gm_authFailure = () => {
      console.warn("Google Maps auth failure detected — seamlessly falling back to OpenStreetMap.");
      setGoogleAvailable(false);
      setError("Google Maps açarı qəbul edilmədi, avtomatik olaraq OpenStreetMap aktivləşdirildi.");
    };
    return () => {
      window.gm_authFailure = previous;
    };
  }, []);

  // Automatic timeout fallback: If Google Maps doesn't finish loading in 3.5s, fall back to OSM
  useEffect(() => {
    if (!key) {
      setGoogleAvailable(false);
      return;
    }
    const timer = setTimeout(() => {
      if (!googleReady) {
        console.warn("Google Maps load timeout — seamlessly falling back to OpenStreetMap.");
        setGoogleAvailable(false);
      }
    }, 3500);
    return () => clearTimeout(timer);
  }, [googleReady, key]);

  const toggleProvider = () => {
    if (requestedProvider === "google") {
      setRequestedProvider("osm");
      localStorage.setItem("bakuport_map_engine", "osm");
    } else {
      setRequestedProvider("google");
      localStorage.setItem("bakuport_map_engine", "google");
    }
  };

  const setProvider = (p: MapProvider) => {
    setRequestedProvider(p);
    localStorage.setItem("bakuport_map_engine", p);
  };

  const activeProvider: MapProvider =
    requestedProvider === "google" && googleAvailable ? "google" : "osm";
  const ready = activeProvider === "google" ? googleReady : true;

  const contextValue: MapsStatusContextType = {
    provider: activeProvider,
    activeProvider,
    ready,
    googleAvailable,
    toggleProvider,
    setProvider,
    error,
  };

  if (!key || !googleAvailable) {
    return (
      <MapsStatus.Provider value={contextValue}>
        {children}
      </MapsStatus.Provider>
    );
  }

  return (
    <APIProvider
      apiKey={key}
      language="az"
      region="AZ"
      onLoad={() => setGoogleReady(true)}
      onError={() => {
        console.warn("Google Maps failed to load — seamlessly falling back to OpenStreetMap.");
        setGoogleAvailable(false);
      }}
    >
      <MapsStatus.Provider value={contextValue}>
        {children}
      </MapsStatus.Provider>
    </APIProvider>
  );
}

function LeafletCanvas({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if ((containerRef.current as any)._leaflet_id) return;

    const instance = L.map(containerRef.current, {
      center: [40.39, 49.85],
      zoom: 13,
      zoomControl: true,
      attributionControl: false,
    });

    // CartoDB Voyager tiles: clean, modern light vector style for city transit
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 19,
        subdomains: "abcd",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }
    ).addTo(instance);

    setMap(instance);

    const t1 = setTimeout(() => instance.invalidateSize(), 150);
    const t2 = setTimeout(() => instance.invalidateSize(), 600);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        instance.invalidateSize();
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      resizeObserver?.disconnect();
      instance.remove();
      setMap(null);
    };
  }, []);

  return (
    <div className={`${className} leaflet-map-wrapper`} style={{ width: "100%", height: "100%", position: "relative" }}>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", zIndex: 1 }}
      />
      {map && (
        <LeafletContext.Provider value={{ map }}>
          {children}
        </LeafletContext.Provider>
      )}
    </div>
  );
}

export function GoogleMapCanvas({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const { activeProvider, ready } = useMapStatus();

  if (activeProvider === "osm") {
    return <LeafletCanvas className={className}>{children}</LeafletCanvas>;
  }

  return (
    <div className={`${className} google-map-canvas`}>
      {ready ? (
        <GoogleMap
          reuseMaps
          defaultCenter={{ lat: 40.39, lng: 49.85 }}
          defaultZoom={13}
          mapId={import.meta.env.VITE_GOOGLE_MAP_ID || "DEMO_MAP_ID"}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          gestureHandling="cooperative"
          style={{ width: "100%", height: "100%" }}
        >
          {children}
        </GoogleMap>
      ) : (
        <LeafletCanvas className={className}>{children}</LeafletCanvas>
      )}
    </div>
  );
}

export interface MapPoint {
  lat: number;
  lng: number;
}
export interface MapLine {
  id: string;
  path: MapPoint[];
  color: string;
  dashed?: boolean;
  weight?: number;
}
export interface MapStop extends MapPoint {
  id: string;
  title: string;
  details: string[];
  color: string;
  size: number;
  selectable: boolean;
}

function GoogleMapViewportInner({
  points,
  focus,
}: {
  points: MapPoint[];
  focus?: MapPoint | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map || !points.length) return;
    const bounds = new google.maps.LatLngBounds();
    points.forEach((point) => bounds.extend(point));
    const listener = google.maps.event.addListenerOnce(map, "idle", () => {
      if ((map.getZoom() || 0) > 14) map.setZoom(14);
    });
    map.fitBounds(bounds, 40);
    return () => listener.remove();
  }, [map, points]);

  useEffect(() => {
    if (map && focus) {
      map.setCenter(focus);
      map.setZoom(16);
    }
  }, [map, focus]);

  return null;
}

function LeafletViewportInner({
  points,
  focus,
}: {
  points: MapPoint[];
  focus?: MapPoint | null;
}) {
  const map = useLeafletMap();
  useEffect(() => {
    if (!map || !points.length) return;
    const valid = points.filter((p) => p && !isNaN(p.lat) && !isNaN(p.lng));
    if (!valid.length) return;
    const bounds = L.latLngBounds(valid.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [map, points]);

  useEffect(() => {
    if (map && focus && !isNaN(focus.lat) && !isNaN(focus.lng)) {
      map.setView([focus.lat, focus.lng], 16, { animate: true });
    }
  }, [map, focus]);

  return null;
}

export function GoogleMapViewport({
  points,
  focus,
}: {
  points: MapPoint[];
  focus?: MapPoint | null;
}) {
  const { activeProvider } = useMapStatus();
  if (activeProvider === "osm") {
    return <LeafletViewportInner points={points} focus={focus} />;
  }
  return <GoogleMapViewportInner points={points} focus={focus} />;
}

function GoogleRouteLinesInner({ lines }: { lines: MapLine[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const paths = lines.map((line) => {
      if (line.dashed) {
        const lineSymbol = {
          path: "M 0,-1 0,1",
          strokeOpacity: 1,
          scale: line.weight ? line.weight * 0.8 : 3,
          strokeColor: line.color,
        };
        return new google.maps.Polyline({
          map,
          path: line.path,
          strokeOpacity: 0,
          icons: [
            {
              icon: lineSymbol,
              offset: "0",
              repeat: "14px",
            },
          ],
          clickable: false,
        });
      }
      return new google.maps.Polyline({
        map,
        path: line.path,
        strokeColor: line.color,
        strokeOpacity: 0.85,
        strokeWeight: line.weight || 5,
        clickable: false,
      });
    });
    return () => paths.forEach((path) => path.setMap(null));
  }, [map, lines]);
  return null;
}

function LeafletRouteLinesInner({ lines }: { lines: MapLine[] }) {
  const map = useLeafletMap();
  useEffect(() => {
    if (!map || !lines.length) return;
    const polylines = lines.map((line) => {
      const validPoints = line.path.filter(
        (p) => p && !isNaN(p.lat) && !isNaN(p.lng)
      );
      return L.polyline(
        validPoints.map((p) => [p.lat, p.lng]),
        {
          color: line.color || "#0284c7",
          weight: line.weight || 5,
          opacity: 0.85,
          dashArray: line.dashed ? "6, 10" : undefined,
          interactive: false,
        }
      ).addTo(map);
    });

    return () => {
      polylines.forEach((p) => p.remove());
    };
  }, [map, lines]);

  return null;
}

export function GoogleRouteLines({ lines }: { lines: MapLine[] }) {
  const { activeProvider } = useMapStatus();
  if (activeProvider === "osm") {
    return <LeafletRouteLinesInner lines={lines} />;
  }
  return <GoogleRouteLinesInner lines={lines} />;
}

export function infoContent(stop: MapStop): HTMLElement {
  const content = document.createElement("div");
  content.className = "google-stop-info";
  const title = document.createElement("strong");
  title.textContent = stop.title;
  content.append(title);
  stop.details.forEach((detail) => {
    const line = document.createElement("p");
    line.textContent = detail;
    content.append(line);
  });
  return content;
}

function GoogleStopLayerInner({
  stops,
  selectedId,
  onSelect,
  selectedColor = "#8361cd",
}: {
  stops: MapStop[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  selectedColor?: string;
}) {
  const map = useMap();
  const layer = useRef<google.maps.Data | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  useEffect(() => {
    if (!map) return;
    const data = new google.maps.Data({ map });
    const popup = new google.maps.InfoWindow();
    const lookup = new globalThis.Map(stops.map((stop) => [stop.id, stop]));
    stops.forEach((stop) =>
      data.add({
        id: stop.id,
        geometry: new google.maps.Data.Point(stop),
        properties: { title: stop.title, color: stop.color, size: stop.size },
      }),
    );
    const listener = data.addListener(
      "click",
      (event: google.maps.Data.MouseEvent) => {
        const stop = lookup.get(String(event.feature.getId()));
        if (!stop) return;
        if (stop.selectable) selectRef.current?.(stop.id);
        popup.setContent(infoContent(stop));
        popup.setPosition(stop);
        popup.open({ map, shouldFocus: false });
      },
    );
    layer.current = data;
    return () => {
      listener.remove();
      popup.close();
      data.setMap(null);
      layer.current = null;
    };
  }, [map, stops]);
  useEffect(() => {
    layer.current?.setStyle((feature) => ({
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale:
          String(feature.getId()) === selectedId
            ? 9
            : Number(feature.getProperty("size")),
        fillColor: "#fff",
        fillOpacity: 0.9,
        strokeColor:
          String(feature.getId()) === selectedId
            ? selectedColor
            : String(feature.getProperty("color")),
        strokeWeight: String(feature.getId()) === selectedId ? 3 : 1.5,
      },
      title: String(feature.getProperty("title")),
      zIndex: String(feature.getId()) === selectedId ? 5 : 1,
    }));
  }, [map, stops, selectedId, selectedColor]);
  return null;
}

function LeafletStopLayerInner({
  stops,
  selectedId,
  onSelect,
  selectedColor = "#8361cd",
}: {
  stops: MapStop[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  selectedColor?: string;
}) {
  const map = useLeafletMap();
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    if (!map || !stops.length) return;
    const markers = stops.map((stop) => {
      const isSelected = String(stop.id) === String(selectedId);
      const marker = L.circleMarker([stop.lat, stop.lng], {
        radius: isSelected ? 8 : (stop.size || 5),
        fillColor: "#ffffff",
        fillOpacity: 0.95,
        color: isSelected ? selectedColor : (stop.color || "#0284c7"),
        weight: isSelected ? 3.5 : 2,
      }).addTo(map);

      marker.bindPopup(infoContent(stop), {
        className: "leaflet-stop-popup",
        closeButton: true,
      });

      marker.on("click", () => {
        if (stop.selectable) {
          selectRef.current?.(stop.id);
        }
      });

      return marker;
    });

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [map, stops, selectedId, selectedColor]);

  return null;
}

export function GoogleStopLayer({
  stops,
  selectedId,
  onSelect,
  selectedColor = "#8361cd",
}: {
  stops: MapStop[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  selectedColor?: string;
}) {
  const { activeProvider } = useMapStatus();
  if (activeProvider === "osm") {
    return (
      <LeafletStopLayerInner
        stops={stops}
        selectedId={selectedId}
        onSelect={onSelect}
        selectedColor={selectedColor}
      />
    );
  }
  return (
    <GoogleStopLayerInner
      stops={stops}
      selectedId={selectedId}
      onSelect={onSelect}
      selectedColor={selectedColor}
    />
  );
}

function GoogleMarkerInner({
  position,
  title,
  onClick,
  children,
}: {
  position: { lat: number; lng: number };
  title?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <AdvancedMarker position={position} title={title} onClick={onClick}>
      {children}
    </AdvancedMarker>
  );
}

function LeafletMarkerInner({
  position,
  title,
  onClick,
  children,
}: {
  position: { lat: number; lng: number };
  title?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const map = useLeafletMap();
  const [container] = useState(() => {
    const el = document.createElement("div");
    el.className = "custom-osm-marker-wrap";
    return el;
  });

  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    const icon = L.divIcon({
      className: "custom-osm-marker",
      html: container,
      iconSize: [0, 0],
    });

    const marker = L.marker([position.lat, position.lng], {
      icon,
      title: title || "",
      zIndexOffset: 1000,
    }).addTo(map);

    if (onClick) {
      marker.on("click", onClick);
    }

    markerRef.current = marker;

    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng([position.lat, position.lng]);
    }
  }, [position.lat, position.lng]);

  return createPortal(children, container);
}

export function MapMarker({
  position,
  title,
  onClick,
  children,
}: {
  position: { lat: number; lng: number };
  title?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const { activeProvider } = useMapStatus();
  if (activeProvider === "osm") {
    return (
      <LeafletMarkerInner position={position} title={title} onClick={onClick}>
        {children}
      </LeafletMarkerInner>
    );
  }
  return (
    <GoogleMarkerInner position={position} title={title} onClick={onClick}>
      {children}
    </GoogleMarkerInner>
  );
}

function GoogleInfoWindowInner({
  position,
  onCloseClick,
  children,
}: {
  position: { lat: number; lng: number };
  onCloseClick?: () => void;
  children: ReactNode;
}) {
  return (
    <InfoWindow position={position} onCloseClick={onCloseClick}>
      {children}
    </InfoWindow>
  );
}

function LeafletInfoWindowInner({
  position,
  onCloseClick,
  children,
}: {
  position: { lat: number; lng: number };
  onCloseClick?: () => void;
  children: ReactNode;
}) {
  const map = useLeafletMap();
  const [container] = useState(() => document.createElement("div"));

  useEffect(() => {
    if (!map) return;
    const popup = L.popup({
      className: "leaflet-custom-popup",
      closeButton: true,
      autoClose: true,
    })
      .setLatLng([position.lat, position.lng])
      .setContent(container)
      .openOn(map);

    popup.on("remove", () => {
      onCloseClick?.();
    });

    return () => {
      map.closePopup(popup);
    };
  }, [map, position.lat, position.lng]);

  return createPortal(children, container);
}

export function MapInfoWindow({
  position,
  onCloseClick,
  children,
}: {
  position: { lat: number; lng: number };
  onCloseClick?: () => void;
  children: ReactNode;
}) {
  const { activeProvider } = useMapStatus();
  if (activeProvider === "osm") {
    return (
      <LeafletInfoWindowInner position={position} onCloseClick={onCloseClick}>
        {children}
      </LeafletInfoWindowInner>
    );
  }
  return (
    <GoogleInfoWindowInner position={position} onCloseClick={onCloseClick}>
      {children}
    </GoogleInfoWindowInner>
  );
}

export function MapProviderBadge({ className = "" }: { className?: string }) {
  const { activeProvider, googleAvailable, toggleProvider } = useMapStatus();
  const isGoogle = activeProvider === "google";
  return (
    <button
      type="button"
      className={`map-engine-badge ${className}`}
      onClick={toggleProvider}
      title="Xəritə mühərrikini dəyişmək üçün klikləyin (Google Maps / OpenStreetMap)"
    >
      <span className={`engine-dot ${isGoogle ? "google" : "osm"}`} />
      <span>{isGoogle ? "Google Maps" : "OpenStreetMap"}</span>
      {!googleAvailable && !isGoogle && (
        <span className="engine-fallback-tag">Avtomatik</span>
      )}
    </button>
  );
}
