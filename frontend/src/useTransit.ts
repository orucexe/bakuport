import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type {
  Alert,
  Bus,
  Density,
  Health,
  Position,
  Route,
  Stop,
  SourceInfo,
} from "./types";

export function useTransit() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<Record<number, Stop[]>>({});
  const [catalog, setCatalog] = useState<Stop[]>([]);
  const [sources, setSources] = useState<SourceInfo | null>(null);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [density, setDensity] = useState<Density[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [revision, setRevision] = useState(0);
  const loadingRef = useRef(false);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const [rs, ds, als, hs, officialStops, sourceInfo] = await Promise.all([
        api<Route[]>("/routes"),
        api<Density[]>("/operator/density"),
        api<Alert[]>("/operator/alerts"),
        api<Health>("/health"),
        api<Stop[]>("/stops"),
        api<SourceInfo>("/data/sources"),
      ]);
      const details = await Promise.all(
        rs.map(async (r) => ({
          id: r.id,
          stops: await api<Stop[]>(`/routes/${r.id}/stops`),
          buses: await api<Bus[]>(`/routes/${r.id}/buses`),
        })),
      );
      if (!mounted.current) return;
      setRoutes(rs);
      setCatalog(officialStops.filter((stop) => stop.source_id));
      setSources(sourceInfo);
      setDensity(ds);
      setAlerts(als);
      setHealth(hs);
      setStops(Object.fromEntries(details.map((d) => [d.id, d.stops])));
      setBuses(details.flatMap((d) => d.buses));
      setError("");
      setRevision((n) => n + 1);
    } catch (err) {
      if (mounted.current)
        setError(err instanceof Error ? err.message : "Bağlantı xətası");
    } finally {
      loadingRef.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout>;
    let ws: WebSocket;
    let heartbeat: ReturnType<typeof setInterval>;
    function connect() {
      ws = new WebSocket(
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/live`,
      );
      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }
        setConnected(true);
        void refresh();
        heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 20000);
      };
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "bus_position") {
          const p = message.data as Position;
          setBuses((old) =>
            old.map((bus) =>
              bus.id === p.bus_id ? { ...bus, position: p } : bus,
            ),
          );
        } else if (message.type === "density_update") {
          const d = message.data as Density;
          setDensity((old) => [
            ...old.filter((item) => item.route_id !== d.route_id),
            d,
          ]);
          setRevision((n) => n + 1);
        } else if (
          ["alert_created", "alert_resolved", "alert_updated"].includes(
            message.type,
          )
        ) {
          const alert = message.data as Alert;
          setAlerts((old) =>
            alert.status === "open"
              ? [alert, ...old.filter((a) => a.id !== alert.id)]
              : old.filter((a) => a.id !== alert.id),
          );
        } else if (message.type === "crowd_report") {
          setRevision((n) => n + 1);
        } else if (message.type === "surge_changed") {
          setRoutes((old) =>
            old.map((r) =>
              r.id === message.data.route_id
                ? { ...r, surge_level: message.data.level }
                : r,
            ),
          );
        }
      };
      ws.onclose = () => {
        clearInterval(heartbeat);
        if (!disposed) {
          setConnected(false);
          retry = setTimeout(connect, 2500);
        }
      };
      ws.onerror = () => ws.close();
    }
    void refresh();
    connect();
    const poll = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) void refresh();
    }, 15000);
    return () => {
      disposed = true;
      mounted.current = false;
      clearTimeout(retry);
      clearInterval(heartbeat);
      clearInterval(poll);
      ws.close();
    };
  }, [refresh]);
  return {
    catalog,
    sources,
    routes,
    stops,
    buses,
    density,
    alerts,
    health,
    loading,
    error,
    connected,
    revision,
    refresh,
  };
}
export type Transit = ReturnType<typeof useTransit>;
