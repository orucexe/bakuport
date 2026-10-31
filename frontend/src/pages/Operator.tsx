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
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(true);
  const [retry, setRetry] = useState(0);
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
    setHistoryError("");
    setHistoryLoading(true);
    setForecastError("");
    api<Density[]>(`/operator/density/${selectedRoute}/history?minutes=60`)
      .then((data) => {
        if (active) setHistory(data);
      })
      .catch((err) => {
        if (active) setHistoryError(err.message);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
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
  }, [selectedRoute, densityVersion, retry]);
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
      <div className="page-title" id="a-overview">
        <div>
          <div className="eyebrow">BAKI · OPERATOR İŞ SAHƏSİ</div>
          <h1>Şəbəkəyə aydın baxış.</h1>
          <p>Avtobuslar, sıxlıq və qərarlar. Hamısı bir iş sahəsində.</p>
        </div>
        <span className="operator-tag">
          <Activity size={15} />
          Əməliyyat icmalı
        </span>
      </div>
      <div className="metric-grid">
        {[
          {
            title: "İzlənən demo xətlər",
            value: routes.length,
            note: "Sınaq xətləri · real dayanacaqlar",
            icon: <Layers size={20} />,
            color: "cream",
          },
          {
            title: "Canlı avtobuslar",
            value: live,
            note: `${buses.length} avtobusdan GPS qəbul edilir`,
            icon: <BusFront size={20} />,
            color: "forest",
          },
          {
            title: "Orta sıxlıq indeksi",
            value: average === null ? "—" : `${average}/100`,
            note: known.length
              ? `${known.length} marşrut üzrə ölçülüb`
              : "Canlı məlumat gözlənilir",
            icon: <Users size={20} />,
            color: "peach",
          },
          {
            title: "Aktiv xəbərdarlıqlar",
            value: alerts.length,
            note: `${health?.alert_window_minutes ?? 10} dəqiqəlik davamlı sıxlıq qaydası`,
            icon: <AlertTriangle size={20} />,
            color: alerts.length ? "coral" : "navy",
          },
        ].map((metric) => (
          <section
            className={`card metric metric-${metric.color}`}
            key={metric.title}
          >
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
        <section className="operator-map" id="a-network">
          <div className="a-band-heading">
            <div>
              <span className="a-eyebrow">01 / ŞƏBƏKƏ</span>
              <h2>Hərəkəti bir baxışda izlə.</h2>
            </div>
            <span className="a-small-label">Canlı GPS · demo</span>
          </div>
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
        <section className="card history-card" id="a-analytics">
          <div className="section-title">
            <h2>
              <TrendingUp size={17} /> Sıxlıq dinamikası
            </h2>
            <span className="subtle-tag">Son 60 dəqiqə · {route?.code}</span>
          </div>
          {historyError ? (
            <div className="a-chart-error" role="alert">
              <p>{historyError}</p>
              <button
                className="a-secondary"
                onClick={() => setRetry((value) => value + 1)}
              >
                Yenidən yoxla
              </button>
            </div>
          ) : historyLoading ? (
            <div className="chart-empty" role="status">
              Sıxlıq tarixçəsi yüklənir…
            </div>
          ) : (
            <DensityChart history={history} theme="airtable" />
          )}
          <p className="chart-note">
            {history.some((d) => d.synthetic)
              ? "Qrafik işarələnmiş sintetik demo tarixçəsini də ehtiva edir."
              : "Canlı ölçmələr · sıxlıq 0–100 aralığında."}
          </p>
          {!historyLoading && !historyError && history.length > 0 && (
            <details className="a-data-table">
              <summary>Sıxlıq rəqəmlərinə bax</summary>
              <div>
                <table>
                  <caption>
                    {route?.code} · son saatın sıxlıq göstəriciləri
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Vaxt</th>
                      <th scope="col">İndeks / 100</th>
                      <th scope="col">Mənbə</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((point, index) => (
                      <tr key={`${point.ts}-${index}`}>
                        <td>{timeLabel(point.ts)}</td>
                        <td>{Math.round(point.score)}</td>
                        <td>{point.synthetic ? "Sintetik" : "Demo ölçmə"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </section>
        <section className="card forecast-card">
          <div className="section-title">
            <h2>
              <Sparkles size={17} /> Sıxlıq proqnozu
            </h2>
            <span className="subtle-tag purple">Növbəti 60 dəq.</span>
          </div>
          {forecastError ? (
            <div className="a-chart-error" role="alert">
              <p>{forecastError}</p>
              <button
                className="a-secondary"
                onClick={() => setRetry((value) => value + 1)}
              >
                Yenidən yoxla
              </button>
            </div>
          ) : (
            <ForecastChart forecast={forecast} theme="airtable" />
          )}
          <p className="chart-note">
            Saat və həftənin gününə əsaslanan statistik model
            {forecast?.synthetic_history
              ? " · sintetik demo tarixçəsi ilə"
              : ""}
            .
          </p>
          {forecast && !forecastError && (
            <details className="a-data-table">
              <summary>Proqnoz rəqəmlərinə bax</summary>
              <div>
                <table>
                  <caption>
                    {route?.code} · növbəti saatın təxmini sıxlığı
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Vaxt</th>
                      <th scope="col">İndeks / 100</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.points.map((point) => (
                      <tr key={point.ts}>
                        <td>{timeLabel(point.ts)}</td>
                        <td>{Math.round(point.score)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </section>
        <section
          className={`card alerts-card ${alerts.length ? "has-alerts" : ""}`}
          id="a-alerts"
        >
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
      <section className="a-ridership-band" id="a-ridership">
        <div className="a-band-heading">
          <div>
            <span className="a-eyebrow">02 / RƏSMİ STATİSTİKA</span>
            <h2>Gündəlik gedişlərə daha yaxından bax.</h2>
          </div>
          <span className="a-small-label">OpenData.az · 2026</span>
        </div>
        <RidershipPanel />
      </section>
    </>
  );
}
