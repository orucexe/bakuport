import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Database, ExternalLink } from "lucide-react";
import { api } from "../api";
import type { RidershipHistory, RidershipRoute } from "../types";

const number = (value: number) => value.toLocaleString("az-AZ");
const day = (value: string) => value.split("-").reverse().join(".");

export default function RidershipPanel() {
  const [routes, setRoutes] = useState<RidershipRoute[]>([]);
  const [code, setCode] = useState("");
  const [days, setDays] = useState(30);
  const [history, setHistory] = useState<RidershipHistory | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api<RidershipRoute[]>("/operator/ridership/routes")
      .then((data) => {
        if (active) {
          setRoutes(data);
          setCode((old) => old || data[0]?.route_code || "");
          if (!data.length) setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [retry]);
  useEffect(() => {
    if (!code) return;
    let active = true;
    setLoading(true);
    setError("");
    setHistory(null);
    api<RidershipHistory>(
      `/operator/ridership/${encodeURIComponent(code)}?days=${days}`,
    )
      .then((data) => {
        if (active) setHistory(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [code, days, retry]);
  return (
    <section className="card ridership-panel">
      <div className="section-title">
        <h2>
          <Database size={18} aria-hidden="true" /> BakuBus · real gündəlik
          gedişlər
        </h2>
        <span className="subtle-tag">Rəsmi açıq məlumat · 2026</span>
      </div>
      <p className="ridership-explanation">
        Ödəniş validasiyalarının sayıdır; unikal sərnişin sayı və ya avtobusun
        hazırkı doluluğu deyil. Bu qrafik demo sıxlıq qrafikindən ayrıdır.
      </p>
      <div className="ridership-filters">
        <label>
          Real marşrut
          <select
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-label="Gediş statistikası üçün real marşrut"
          >
            {routes.map((route) => (
              <option key={route.route_code} value={route.route_code}>
                № {route.route_code}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dövr
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Son 7 gün</option>
            <option value={30}>Son 30 gün</option>
            <option value={90}>Son 90 gün</option>
            <option value={366}>Bütün məlumatlar</option>
          </select>
        </label>
        {history && (
          <span className="ridership-period">
            {day(history.first_date)} — {day(history.last_date)}
            <small>Dövr mənbədəki son tarixdən hesablanır.</small>
          </span>
        )}
      </div>
      {error ? (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setRetry((n) => n + 1)}>
            Yenidən cəhd et
          </button>
        </div>
      ) : loading ? (
        <div className="chart-empty" role="status">
          Rəsmi statistika yüklənir…
        </div>
      ) : history ? (
        <>
          <div className="ridership-stats">
            <div>
              <span>Son qeydə alınmış gün</span>
              <strong>{number(history.latest_daily_rides)}</strong>
              <small>{day(history.last_date)} · gediş</small>
            </div>
            <div>
              <span>Dövr üzrə gündəlik orta</span>
              <strong>{number(history.average_daily_rides)}</strong>
              <small>{history.recorded_days} qeydə alınmış gün</small>
            </div>
            <div>
              <span>Seçilmiş dövrdə cəmi</span>
              <strong>{number(history.total_rides)}</strong>
              <small>Marşrut № {history.route_code}</small>
            </div>
          </div>
          <div
            className="ridership-chart"
            role="img"
            aria-label={`${code} marşrutu üçün ${history.recorded_days} günün gediş sayı; gündəlik orta ${history.average_daily_rides}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={history.points}
                margin={{ left: 2, right: 14, top: 10, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#e9eeec"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => day(v).slice(0, 5)}
                  minTickGap={38}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <YAxis
                  tickFormatter={(v) =>
                    Number(v) >= 1000 ? `${Number(v) / 1000}k` : String(v)
                  }
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <Tooltip
                  labelFormatter={(v) => day(String(v))}
                  formatter={(value) => [number(Number(value)), "Gediş sayı"]}
                />
                <Area
                  type="linear"
                  dataKey="rides"
                  stroke="#0a2e0e"
                  fill="#a8d8c4"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <details className="ridership-table">
            <summary>Gündəlik rəqəmlərə cədvəldə bax</summary>
            <div>
              <table>
                <caption>
                  Marşrut № {code} · gündəlik ödəniş validasiyaları
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Tarix</th>
                    <th scope="col">Gediş sayı</th>
                  </tr>
                </thead>
                <tbody>
                  {history.points.map((point) => (
                    <tr key={point.date}>
                      <td>{day(point.date)}</td>
                      <td>{number(point.rides)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <a
            className="ridership-source"
            href={history.source_url}
            target="_blank"
            rel="noreferrer"
          >
            Mənbə: OpenData.az · Bakı Metropoliteni / BakuBus · Bakı Kart
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        </>
      ) : (
        <div className="chart-empty">Gediş məlumatları idxal edilməyib.</div>
      )}
    </section>
  );
}
