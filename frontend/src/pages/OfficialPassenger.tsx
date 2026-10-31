import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { api } from "../api";
import Passenger from "./Passenger";
import type { Catalog, OfficialRoute } from "./OfficialRoutes";
import type { Stop } from "../types";

export interface OfficialPassengerData {
  route: OfficialRoute | null;
  directionId: number;
  setDirection: (id: number) => void;
}

export default function OfficialPassenger(
  props: ComponentProps<typeof Passenger>,
) {
  const [demo, setDemo] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [route, setRoute] = useState<OfficialRoute | null>(null);
  const [selectedRoute, setSelectedRoute] = useState(1);
  const [selectedStop, setSelectedStop] = useState(0);
  const [directionId, setDirectionId] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<Catalog>("/official/routes", { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setCatalog(data);
        if (!data.routes.length) {
          setLoading(false);
          return;
        }
        setSelectedRoute((old) =>
          data.routes.some((item) => item.source_id === old)
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
  }, [retry, demo]);
  useEffect(() => {
    if (demo || !catalog?.routes.length) return;
    const controller = new AbortController();
    setRoute(null);
    setSelectedStop(0);
    setLoading(true);
    setError("");
    api<OfficialRoute>(`/official/routes/${selectedRoute}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) {
          setRoute(data);
          setDirectionId(data.directions[0]?.id ?? 1);
          setSelectedStop(0);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [catalog, selectedRoute, retry, demo]);
  const direction = route?.directions.find((item) => item.id === directionId);
  const stops = useMemo<Record<number, Stop[]>>(
    () => ({
      [selectedRoute]: (direction?.stops || []).map((stop) => ({
        ...stop,
        id: stop.sequence,
        source_id: stop.source_code,
      })),
    }),
    [selectedRoute, direction],
  );
  const routes = useMemo(
    () =>
      (catalog?.routes || []).map((item) => ({
        id: item.source_id,
        code: item.code,
        name:
          route?.source_id === item.source_id
            ? `${route.first_stop} — ${route.last_stop}`
            : `Marşrut № ${item.code}`,
        color: "#ff385c",
        surge_level: 0,
      })),
    [catalog, route],
  );
  if (demo)
    return <Passenger key="demo" {...props} onMode={() => setDemo(false)} />;
  return (
    <Passenger
      key="official"
      {...props}
      selectedRoute={selectedRoute}
      selectedStop={selectedStop}
      setRoute={(id) => {
        if (id === selectedRoute) return;
        setSelectedRoute(id);
        setRoute(null);
        setSelectedStop(0);
      }}
      setStop={setSelectedStop}
      transit={{
        ...props.transit,
        routes,
        stops,
        buses: [],
        density: [],
        catalog: [],
        loading,
        error,
        revision: 0,
        refresh: async () => {
          setRetry((value) => value + 1);
        },
      }}
      official={{
        route,
        directionId,
        setDirection: (id) => {
          setDirectionId(id);
          setSelectedStop(0);
        },
      }}
      onMode={() => setDemo(true)}
    />
  );
}
