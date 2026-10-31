import { useMemo, useState } from "react";
import { MapPin, Maximize2 } from "lucide-react";
import {
  GoogleMapCanvas,
  GoogleMapViewport,
  GoogleRouteLines,
  GoogleStopLayer,
  type MapStop,
} from "./GoogleMaps";
import type { OfficialPassengerData } from "../pages/OfficialPassenger";

export default function OfficialPassengerMap({
  official,
  selectedStop,
  onStop,
  focusRequest,
}: {
  official: OfficialPassengerData;
  selectedStop: number;
  onStop: (id: number) => void;
  focusRequest: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const direction = official.route?.directions.find(
    (item) => item.id === official.directionId,
  );
  const lines = useMemo(
    () =>
      direction
        ? [
            {
              id: String(direction.id),
              path: direction.shape,
              color: "#ff385c",
            },
          ]
        : [],
    [direction],
  );
  const stops = useMemo<MapStop[]>(
    () =>
      (direction?.stops || []).map((stop) => ({
        ...stop,
        id: String(stop.sequence),
        title: `${stop.sequence}. ${stop.name}`,
        details: [`AYNA dayanacaq kodu: ${stop.source_code}`],
        color: "#ff385c",
        size: 5,
        selectable: true,
      })),
    [direction],
  );
  const selected = direction?.stops.find(
    (item) => item.sequence === selectedStop,
  );
  const focus = useMemo(
    () => (selected ? { ...selected } : null),
    [selected, focusRequest],
  );
  return (
    <section
      className={`map-panel ${expanded ? "expanded-map" : ""}`}
      aria-label="Rəsmi marşrutun xəritəsi"
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
      <GoogleMapCanvas className="transit-map">
        <GoogleMapViewport points={direction?.shape || []} focus={focus} />
        <GoogleRouteLines lines={lines} />
        <GoogleStopLayer
          stops={stops}
          selectedId={String(selectedStop)}
          selectedColor="#ff385c"
          onSelect={(id) => onStop(Number(id))}
        />
      </GoogleMapCanvas>
      <div className="map-legend">
        <span>AYNA · {stops.length} dayanacaq</span>
        <span>Rəsmi yol sxemi</span>
      </div>
    </section>
  );
}
