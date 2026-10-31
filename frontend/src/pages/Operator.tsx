import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BusFront,
  CheckCircle2,
  ChevronRight,
  Layers,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { api, levelText, timeLabel, utcDate } from "../api";
import TransitMap from "../components/TransitMap";
import { DensityChart, ForecastChart } from "../components/DensityChart";
import RidershipPanel from "../components/RidershipPanel";
import type { Density, Forecast } from "../types";
import type { Transit } from "../useTransit";

export default function Operator({
  transit,
  selectedRoute,
  setRoute,
}: {
  transit: Transit;
  selectedRoute: number;
  setRoute: (id: number) => void;
}) {
  const { routes, stops, buses, density, alerts, health } = transit;
  const densityVersion = density.find((d) => d.route_id === selectedRoute)?.ts;
  const [history, setHistory] = useState<Density[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [error, setError] = useState("");
  const [forecastError, setForecastError] = useState("");
  const [busy, setBusy] = useState(false);
  const route = routes.find((r) => r.id === selectedRoute);
  const live = buses.filter(
    (b) => b.position && Date.now() - utcDate(b.position.ts).getTime() < 30000,
  ).length;
  const known = density.filter((d) => d.confidence !== "unavailable");
  const average = known.length
    ? Math.round(known.reduce((total, d) => total + d.score, 0) / known.length)
    : null;
  useEffect(() => {
    let active = true;
    setHistory([]);
    setForecast(null);
    setError("");
    setForecastError("");
    api<Density[]>(`/operator/density/${selectedRoute}/history?minutes=60`)
      .then((data) => {
        if (active) setHistory(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    api<Forecast>(`/operator/forecast/${selectedRoute}`)
      .then((data) => {
        if (active) setForecast(data);
      })
      .catch((err) => {
        if (active) setForecastError(err.message);
      });
    return () => {
      active = false;
    };
  }, [selectedRoute, densityVersion]);
  async function toggleSurge() {
    setBusy(true);
    setError("");
    try {
      await api(
        `/demo/surge?route_id=${selectedRoute}&level=${route?.surge_level ? 0 : 5}`,
        { method: "POST" },
      );
      await transit.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo rejimi dəyişmədi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">OPERATOR PANELİ</div>
          <h1>
            Şəbəkənin nəbzi<span>.</span>
          </h1>
          <p>Canlı vəziyyət, aydın qərarlar, daha rahat şəhər.</p>
        </div>
        <span className="operator-tag">
          <Activity size={15} />
          Canlı monitorinq
        </span>
      </div>
      <div className="metric-grid">
        {[
          {
            title: "Aktiv marşrutlar",
            value: routes.length,
            note: "Sınaq xətləri · real dayanacaqlar",
            icon: <Layers size={20} />,
            color: "teal",
          },
          {
            title: "Canlı avtobuslar",
            value: live,
            note: `${buses.length} avtobusdan GPS qəbul edilir`,
            icon: <BusFront size={20} />,
            color: "blue",
          },
          {
            title: "Orta sıxlıq",
            value: average === null ? "—" : `${average}%`,
            note: known.length
              ? `${known.length} marşrut üzrə ölçülüb`
              : "Canlı məlumat gözlənilir",
            icon: <Users size={20} />,
            color: "amber",
          },
          {
            title: "Aktiv xəbərdarlıqlar",
            value: alerts.length,
            note: `${health?.alert_window_minutes ?? 10} dəqiqəlik davamlı sıxlıq qaydası`,
            icon: <AlertTriangle size={20} />,
            color: "red",
          },
        ].map((metric) => (
          <section className="card metric" key={metric.title}>
            <div>
              <span>{metric.title}</span>
              <strong>{metric.value}</strong>
              <small>{metric.note}</small>
            </div>
            <span className={`metric-icon ${metric.color}`}>{metric.icon}</span>
          </section>
        ))}
      </div>
      <div className="operator-layout">
        <section className="operator-map">
          <TransitMap
            catalog={transit.catalog}
            routes={routes}
            stops={stops}
            buses={buses}
            density={density}
            selectedRoute={selectedRoute}
            operator
          />
          <div className="density-legend">
            <span>
              <i className="tiny-dot low" />
              Rahat &lt;{health?.green_threshold ?? 40}
            </span>
            <span>
              <i className="tiny-dot medium" />
              Orta {health?.green_threshold ?? 40}–&lt;
              {health?.red_threshold ?? 70}
            </span>
            <span>
              <i className="tiny-dot high" />
              Sıx ≥{health?.red_threshold ?? 70}
            </span>
            <span>
              <i className="tiny-dot unknown" />
              Məlumat yoxdur
            </span>
          </div>
        </section>
        <section className="card route-health">
          <div className="section-title">
            <h2>Marşrutların vəziyyəti</h2>
            <Activity size={17} />
          </div>
          <p className="section-caption">
            Hər dəqiqə yenilənən sıxlıq göstəricisi
          </p>
          {routes.map((r) => {
            const d = density.find((d) => d.route_id === r.id);
            const known = d && d.confidence !== "unavailable";
            const level = known ? d.level : "unknown";
            return (
              <button
                key={r.id}
                className={`route-health-row ${r.id === selectedRoute ? "active" : ""}`}
                onClick={() => setRoute(r.id)}
                aria-pressed={r.id === selectedRoute}
              >
                <div className="route-health-top">
                  <strong>{r.code}</strong>
                  <span className={`badge ${level}`}>{levelText[level]}</span>
                  <ChevronRight size={14} />
                </div>
                <p>{r.name.replace(" (demo)", "")}</p>
                <div className="density-bar">
                  <span
                    className={level}
                    style={{ width: `${known ? d.score : 0}%` }}
                  />
                </div>
                <div className="route-health-meta">
                  <span>
                    {known ? `${Math.round(d.score)}/100` : "Məlumat yoxdur"}
                  </span>
                  <span>
                    {known
                      ? d.confidence === "low"
                        ? "Aşağı etibarlılıq · GPS"
                        : d.confidence === "medium"
                          ? "Orta etibarlılıq"
                          : "Yüksək etibarlılıq"
                      : "GPS və hesabat gözlənilir"}
                  </span>
                </div>
              </button>
            );
          })}
          {health?.demo_mode && (
            <div className="demo-control">
              <div>
                <Zap size={16} />
                <strong>Demo ssenarisi</strong>
                <span>{route?.code}</span>
              </div>
              <p>
                Marşrutu sıx və yavaş edin. Xəbərdarlıq təxminən 1 dəqiqə sonra
                yaranacaq.
              </p>
              <button
                className={`surge-button ${route?.surge_level ? "surging" : ""}`}
                onClick={() => void toggleSurge()}
                disabled={busy}
              >
                {busy
                  ? "Dəyişdirilir…"
                  : route?.surge_level
                    ? "Sıxlıq ssenarisini dayandır"
                    : "Sıxlıq ssenarisini başlat"}
                <ArrowUpRight size={16} />
              </button>
            </div>
          )}
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
        </section>
        <section className="card history-card">
          <div className="section-title">
            <h2>
              <TrendingUp size={17} /> Sıxlıq dinamikası
            </h2>
            <span className="subtle-tag">Son 60 dəqiqə · {route?.code}</span>
          </div>
          <DensityChart history={history} />
          <p className="chart-note">
            {history.some((d) => d.synthetic)
              ? "Qrafik işarələnmiş sintetik demo tarixçəsini də ehtiva edir."
              : "Canlı ölçmələr · sıxlıq 0–100 aralığında."}
          </p>
        </section>
        <section className="card forecast-card">
          <div className="section-title">
            <h2>
              <Sparkles size={17} /> Sıxlıq proqnozu
            </h2>
            <span className="subtle-tag purple">Növbəti 60 dəq.</span>
          </div>
          {forecastError ? (
            <div className="chart-empty" role="status">
              {forecastError}
            </div>
          ) : (
            <ForecastChart forecast={forecast} />
          )}
          <p className="chart-note">
            Saat və həftənin gününə əsaslanan statistik model
            {forecast?.synthetic_history
              ? " · sintetik demo tarixçəsi ilə"
              : ""}
            .
          </p>
        </section>
        <section className="card alerts-card">
          <div className="section-title">
            <h2>
              <AlertTriangle size={17} /> Aktiv xəbərdarlıqlar{" "}
              <span className="count-badge">{alerts.length}</span>
            </h2>
            <span className="subtle-tag">Canlı</span>
          </div>
          {alerts.length ? (
            alerts.map((alert) => (
              <article className="alert-item" key={alert.id}>
                <span className="alert-sign">
                  <AlertTriangle size={20} />
                </span>
                <div>
                  <div className="alert-title">
                    <strong>{alert.message}</strong>
                    <time>{timeLabel(alert.started_at)}</time>
                  </div>
                  <p>
                    <Sparkles size={14} />
                    {alert.ai_recommendation || "Tövsiyə hazırlanır…"}
                  </p>
                  <small>
                    {alert.recommendation_source === "llm"
                      ? "AI tövsiyəsi"
                      : "Şablon tövsiyə"}{" "}
                    · Operator tərəfindən qiymətləndirilməlidir
                  </small>
                </div>
              </article>
            ))
          ) : (
            <div className="all-clear">
              <CheckCircle2 size={30} />
              <div>
                <strong>Hazırda aktiv xəbərdarlıq yoxdur</strong>
                <p>
                  Şəbəkə izlənilir. Davamlı yüksək sıxlıq aşkar ediləndə burada
                  görünəcək.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
      <RidershipPanel />
    </>
  );
}
