import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  APIProvider,
  Map as GoogleMap,
  useMap,
} from "@vis.gl/react-google-maps";

const MapsStatus = createContext({ ready: false, error: "" });

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = window.gm_authFailure;
    window.gm_authFailure = () =>
      setError(
        "Google Maps açarı qəbul edilmədi. Maps JavaScript API, billing və icazəli sayt ünvanlarını Google Cloud-da yoxlayın.",
      );
    return () => {
      window.gm_authFailure = previous;
    };
  }, []);
  if (!key)
    return (
      <MapsStatus.Provider
        value={{
          ready: false,
          error:
            "Google Maps açarı konfiqurasiya edilməyib. .env faylında VITE_GOOGLE_MAPS_API_KEY dəyərini əlavə edin.",
        }}
      >
        {children}
      </MapsStatus.Provider>
    );
  return (
    <APIProvider
      apiKey={key}
      language="az"
      region="AZ"
      onLoad={() => setReady(true)}
      onError={() =>
        setError(
          "Google Maps yüklənmədi. İnternet bağlantısını və Google Cloud konfiqurasiyasını yoxlayın.",
        )
      }
    >
      <MapsStatus.Provider value={{ ready, error }}>
        {children}
      </MapsStatus.Provider>
    </APIProvider>
  );
}

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

export function GoogleMapCanvas({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const status = useContext(MapsStatus);
  return (
    <div className={`${className} google-map-canvas`}>
      {status.error ? (
        <div className="map-provider-status map-provider-error" role="alert">
          {status.error}
        </div>
      ) : status.ready ? (
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
        <div className="map-provider-status" role="status">
          Google Maps yüklənir…
        </div>
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
}
export interface MapStop extends MapPoint {
  id: string;
  title: string;
  details: string[];
  color: string;
  size: number;
  selectable: boolean;
}

export function GoogleMapViewport({
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

export function GoogleRouteLines({ lines }: { lines: MapLine[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const paths = lines.map(
      (line) =>
        new google.maps.Polyline({
          map,
          path: line.path,
          strokeColor: line.color,
          strokeOpacity: 0.85,
          strokeWeight: 5,
          clickable: false,
        }),
    );
    return () => paths.forEach((path) => path.setMap(null));
  }, [map, lines]);
  return null;
}

function infoContent(stop: MapStop): HTMLElement {
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
