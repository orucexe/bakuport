import { useEffect, useMemo, useState } from "react";
import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { BusFront, Navigation } from "lucide-react";
import {
  GoogleMapCanvas,
  GoogleMapViewport,
  GoogleRouteLines,
  GoogleStopLayer,
  type MapStop,
} from "./GoogleMaps";
import type { Place } from "./PlacePicker";
import type { Journey, Vehicle } from "../pages/journeyTypes";

export default function JourneyMap({
  journey,
  user,
  origin,
  destination,
  vehicles,
  selectedVehicle,
  horizon,
  onVehicle,
}: {
  journey: Journey | null;
  user: Place | null;
  origin: Place | null;
  destination: Place | null;
  vehicles: Vehicle[];
  selectedVehicle: string;
  horizon: number;
  onVehicle: (id: string) => void;
}) {
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  useEffect(() => {
    const resize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const lines = useMemo(
    () =>
      journey
        ? [{ id: journey.key, path: journey.shape, color: "#ff385c" }]
        : [],
    [journey],
  );
  const stops = useMemo<MapStop[]>(
    () =>
      journey
        ? [journey.board, journey.alight].map((stop, index) => ({
            ...stop,
            id: String(index),
            title: `${index ? "Enəcəyiniz" : "Minəcəyiniz"}: ${stop.name}`,
            details: [`Dayanacaq ${stop.sequence}`],
            color: "#ff385c",
            size: 8,
            selectable: false,
          }))
        : [],
    [journey],
  );
  const points = useMemo(
    () =>
      journey?.shape.map((point) => ({ ...point })) ||
      [origin, destination].filter((point): point is Place => !!point),
    [journey, origin, destination, viewportWidth],
  );
  return (
    <GoogleMapCanvas className="j-google-map">
      <GoogleMapViewport points={points} />
      <GoogleRouteLines lines={lines} />
      <GoogleStopLayer stops={stops} />
      {user && (
        <AdvancedMarker position={user} title="Canlı məkanınız">
          <span className="j-user-marker">
            <Navigation size={16} />
          </span>
        </AdvancedMarker>
      )}
      {!journey && origin && (
        <AdvancedMarker position={origin} title="Haradan">
          <span className="j-point-marker">A</span>
        </AdvancedMarker>
      )}
      {!journey && destination && (
        <AdvancedMarker position={destination} title="Haraya">
          <span className="j-point-marker">B</span>
        </AdvancedMarker>
      )}
      {vehicles.map((vehicle) => (
        <AdvancedMarker
          key={vehicle.vehicle_id}
          position={vehicle}
          title={`${vehicle.label} · ${Math.ceil(vehicle.eta_minutes)} dəqiqə`}
          onClick={() => onVehicle(vehicle.vehicle_id)}
        >
          <span
            className={`j-bus-marker ${vehicle.vehicle_id === selectedVehicle ? "selected" : ""}`}
          >
            <BusFront size={18} />
            {journey?.code}
          </span>
        </AdvancedMarker>
      ))}
      {horizon > 0 &&
        vehicles
          .filter((vehicle) => vehicle.vehicle_id === selectedVehicle)
          .map((vehicle) => {
            const prediction = vehicle.predictions.find(
              (point) => point.minutes === horizon,
            );
            return prediction ? (
              <AdvancedMarker
                key="prediction"
                position={prediction}
                title={`${horizon} dəqiqə sonra təxmini mövqe`}
              >
                <span className="j-prediction-marker">+{horizon} dəq</span>
              </AdvancedMarker>
            ) : null;
          })}
    </GoogleMapCanvas>
  );
}
