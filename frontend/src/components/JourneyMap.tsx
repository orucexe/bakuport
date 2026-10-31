import { useEffect, useMemo, useState } from "react";
import { BusFront, Navigation, MapPin } from "lucide-react";
import {
  GoogleMapCanvas,
  GoogleMapViewport,
  GoogleRouteLines,
  GoogleStopLayer,
  MapMarker,
  MapProviderBadge,
  type MapLine,
  type MapPoint,
  type MapStop,
} from "./GoogleMaps";
import type { Place } from "./PlacePicker";
import type { Journey, Vehicle } from "../pages/journeyTypes";

export interface RouteViewData {
  code: string;
  carrier: string;
  color?: string;
  shape: { lat: number; lng: number }[];
  stops: {
    source_id: number;
    name: string;
    sequence: number;
    lat: number;
    lng: number;
  }[];
}

export default function JourneyMap({
  journey,
  user,
  origin,
  destination,
  vehicles,
  selectedVehicle,
  horizon,
  onVehicle,
  routeView,
  selectedStopSequence,
  onSelectStop,
}: {
  journey: Journey | null;
  user: Place | null;
  origin: Place | null;
  destination: Place | null;
  vehicles: Vehicle[];
  selectedVehicle: string;
  horizon: number;
  onVehicle: (id: string) => void;
  routeView?: RouteViewData | null;
  selectedStopSequence?: number | null;
  onSelectStop?: (sequence: number) => void;
}) {
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  useEffect(() => {
    const resize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Compute map polylines (Bus route + Walking paths)
  const lines = useMemo<MapLine[]>(() => {
    if (routeView) {
      return [
        {
          id: `route-${routeView.code}`,
          path: routeView.shape,
          color: routeView.color || "#0284c7",
          weight: 5,
        },
      ];
    }

    if (!journey) return [];

    const result: MapLine[] = [];

    // 1. Walking path: Origin -> Boarding Stop (dashed)
    if (origin && journey.board) {
      result.push({
        id: "walk-to-stop",
        path: journey.legs?.[0]?.shape || [
          { lat: origin.lat, lng: origin.lng },
          { lat: journey.board.lat, lng: journey.board.lng },
        ],
        color: "#64748b",
        dashed: true,
        weight: 3,
      });
    }

    // 2. Bus ride segment
    result.push({
      id: journey.key,
      path: journey.shape,
      color: "#ff385c",
      weight: 5,
    });

    // 3. Walking path: Alighting Stop -> Destination (dashed)
    if (destination && journey.alight) {
      result.push({
        id: "walk-to-dest",
        path: journey.legs?.[2]?.shape || [
          { lat: journey.alight.lat, lng: journey.alight.lng },
          { lat: destination.lat, lng: destination.lng },
        ],
        color: "#64748b",
        dashed: true,
        weight: 3,
      });
    }

    return result;
  }, [journey, origin, destination, routeView]);

  // Compute stops to display on map
  const stops = useMemo<MapStop[]>(() => {
    if (routeView) {
      return routeView.stops.map((stop) => ({
        id: String(stop.sequence),
        lat: stop.lat,
        lng: stop.lng,
        title: `${stop.sequence}. ${stop.name}`,
        details: [`Dayanacaq #${stop.sequence}`, `Xətt: ${routeView.code}`],
        color: stop.sequence === selectedStopSequence ? "#ff385c" : "#0284c7",
        size: stop.sequence === selectedStopSequence ? 8 : 5,
        selectable: true,
      }));
    }

    if (journey) {
      return [journey.board, journey.alight].map((stop, index) => ({
        lat: stop.lat,
        lng: stop.lng,
        id: String(index),
        title: `${index ? "Enəcəyiniz" : "Minəcəyiniz"}: ${stop.name}`,
        details: [`Dayanacaq ${stop.sequence}`, `Xətt: ${journey.code}`],
        color: index === 0 ? "#10b981" : "#ef4444",
        size: 8,
        selectable: false,
      }));
    }

    return [];
  }, [journey, routeView, selectedStopSequence]);

  // Points to fit viewport
  const points = useMemo<MapPoint[]>(() => {
    if (routeView && routeView.shape.length > 0) {
      return routeView.shape.map((p) => ({ lat: p.lat, lng: p.lng }));
    }
    if (journey) {
      const pts: MapPoint[] = journey.shape.map((point) => ({ lat: point.lat, lng: point.lng }));
      if (origin) pts.unshift({ lat: origin.lat, lng: origin.lng });
      if (destination) pts.push({ lat: destination.lat, lng: destination.lng });
      return pts;
    }
    return [origin, destination]
      .filter((point): point is Place => !!point)
      .map((p) => ({ lat: p.lat, lng: p.lng }));
  }, [journey, origin, destination, routeView, viewportWidth]);

  // Focused stop when user selects a stop in route view
  const focusPoint = useMemo(() => {
    if (routeView && selectedStopSequence) {
      const st = routeView.stops.find((s) => s.sequence === selectedStopSequence);
      if (st) return { lat: st.lat, lng: st.lng };
    }
    return null;
  }, [routeView, selectedStopSequence]);

  return (
    <div className="j-map-container" style={{ position: "relative", width: "100%", height: "100%" }}>
      <GoogleMapCanvas className="j-google-map">
      <GoogleMapViewport points={points} focus={focusPoint} />
      <GoogleRouteLines lines={lines} />
      <GoogleStopLayer
        stops={stops}
        selectedId={selectedStopSequence ? String(selectedStopSequence) : undefined}
        onSelect={(id) => onSelectStop?.(Number(id))}
      />

      {user && (
        <MapMarker position={user} title="Canlı məkanınız">
          <span className="j-user-marker">
            <Navigation size={16} />
          </span>
        </MapMarker>
      )}

      {origin && (
        <MapMarker position={origin} title={`Haradan: ${origin.name}`}>
          <div className="j-point-pin origin" title={origin.name}>
            <span className="pin-badge">A</span>
            <span className="pin-tooltip">{origin.name}</span>
          </div>
        </MapMarker>
      )}

      {destination && (
        <MapMarker position={destination} title={`Haraya: ${destination.name}`}>
          <div className="j-point-pin dest" title={destination.name}>
            <span className="pin-badge">B</span>
            <span className="pin-tooltip">{destination.name}</span>
          </div>
        </MapMarker>
      )}

      {vehicles.map((vehicle) => (
        <MapMarker
          key={vehicle.vehicle_id}
          position={vehicle}
          title={`${vehicle.label} · ${Math.ceil(vehicle.eta_minutes)} dəqiqə`}
          onClick={() => onVehicle(vehicle.vehicle_id)}
        >
          <span
            className={`j-bus-marker ${vehicle.vehicle_id === selectedVehicle ? "selected" : ""}`}
          >
            <BusFront size={18} />
            {journey?.code || routeView?.code}
          </span>
        </MapMarker>
      ))}

      {horizon > 0 &&
        vehicles
          .filter((vehicle) => vehicle.vehicle_id === selectedVehicle)
          .map((vehicle) => {
            const prediction = vehicle.predictions.find(
              (point) => point.minutes === horizon,
            );
            return prediction ? (
              <MapMarker
                key="prediction"
                position={prediction}
                title={`${horizon} dəqiqə sonra təxmini mövqe`}
              >
                <span className="j-prediction-marker">+{horizon} dəq</span>
              </MapMarker>
            ) : null;
          })}
    </GoogleMapCanvas>
      <div className="j-map-footer" style={{ position: "absolute", bottom: 10, right: 10, zIndex: 1000 }}>
        <MapProviderBadge />
      </div>
    </div>
  );
}
