import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BusFront,
  Check,
  ChevronDown,
  CircleHelp,
  CircleUserRound,
  Clock3,
  Globe2,
  MapPin,
  Menu,
  MessageCircle,
  Radio,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { api, levelText } from "../api";
import TransitMap from "../components/TransitMap";
import OfficialPassengerMap from "../components/OfficialPassengerMap";
import type { OfficialPassengerData } from "./OfficialPassenger";
import type { Transit } from "../useTransit";
import type { Arrival, Stop } from "../types";
import "./passenger.css";

function RoutePreview({
  stops,
  selected,
}: {
  stops: Stop[];
  selected: boolean;
}) {
  const meanLatitude =
    stops.reduce((sum, stop) => sum + stop.lat, 0) / (stops.length || 1);
  const xs = stops.map(
    (stop) => stop.lng * Math.cos((meanLatitude * Math.PI) / 180),
  );
  const ys = stops.map((stop) => -stop.lat);
  const width = Math.max(...xs) - Math.min(...xs) || 1;
  const height = Math.max(...ys) - Math.min(...ys) || 1;
  const scale = Math.min(230 / width, 66 / height);
  const points = stops.map((_, index) => ({
    x: 145 + (xs[index] - (Math.min(...xs) + width / 2)) * scale,
    y: 47 + (ys[index] - (Math.min(...ys) + height / 2)) * scale,
  }));
  return (
    <svg viewBox="0 0 290 94" className="p-route-preview" aria-hidden="true">
      <path
        d="M0 23H290M0 70H290M42 0V94M246 0V94M0 94 150 0M140 94 290 0"
        className="p-preview-grid"
      />
      <polyline
        points={[...points, ...points.slice(0, 1)]
          .map((point) => `${point.x},${point.y}`)
          .join(" ")}
        fill="none"
        stroke={selected ? "var(--p-accent)" : "var(--p-muted)"}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r="3"
          fill="var(--p-canvas)"
          stroke={selected ? "var(--p-accent)" : "var(--p-muted)"}
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

export default function Passenger({
  transit,
  selectedRoute,
  setRoute,
  selectedStop,
  setStop,
  official,
  onMode,
}: {
  transit: Transit;
  selectedRoute: number;
  setRoute: (id: number) => void;
  selectedStop: number;
  setStop: (id: number) => void;
  official?: OfficialPassengerData;
  onMode?: () => void;
}) {
  const { routes, stops, buses, density, revision } = transit;
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportBus, setReportBus] = useState(0);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{
    text: string;
    success: boolean;
  } | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchDialog = useRef<HTMLDialogElement>(null);
  const menuDialog = useRef<HTMLDialogElement>(null);
  const aboutDialog = useRef<HTMLDialogElement>(null);
  const route = routes.find((item) => item.id === selectedRoute);
  const routeStops = stops[selectedRoute] || [];
  const currentStop = routeStops.find((stop) => stop.id === selectedStop);
  const routeBuses = buses.filter((bus) => bus.route_id === selectedRoute);
  const currentDensity = density.find(
    (item) => item.route_id === selectedRoute,
  );
  const crowdLevel =
    currentDensity && currentDensity.confidence !== "unavailable"
      ? currentDensity.level
      : "unknown";
  const nextArrival = arrivals[0];
  const displayedRoutes = official
    ? [route, ...routes.filter((item) => item.id !== selectedRoute)]
        .filter((item): item is NonNullable<typeof item> => !!item)
        .slice(0, 3)
    : routes;

  useEffect(() => {
    setReportBus(0);
    setNotice(null);
  }, [selectedRoute]);
  useEffect(() => {
    if (official || !selectedStop) {
      setLoading(false);
      setArrivals([]);
      setError("");
      return;
    }
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setArrivals([]);
    async function load() {
      try {
        const data = await api<Arrival[]>(`/stops/${selectedStop}/arrivals`, {
          signal: controller.signal,
        });
        if (active) {
          setArrivals(
            data.filter((arrival) => arrival.route_id === selectedRoute),
          );
          setError("");
        }
      } catch (err) {
        if (active)
          setError(
            err instanceof Error ? err.message : "Gəliş vaxtları yüklənmədi.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const timer = setInterval(load, 10000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [selectedStop, selectedRoute, revision, !!official]);

  function scrollTo(id: string) {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    document.getElementById(id)?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }
  function showMap(event?: FormEvent) {
    event?.preventDefault();
    searchDialog.current?.close();
    setFocusRequest((value) => value + 1);
    scrollTo("passenger-map");
  }
  function openSearch() {
    searchDialog.current?.showModal();
    setSearchOpen(true);
  }
  function openMenu() {
    menuDialog.current?.showModal();
    setMenuOpen(true);
  }
  async function report(level: number) {
    if (official) return;
    setSending(true);
    setNotice(null);
    try {
      await api("/crowd-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route_id: selectedRoute,
          bus_id: reportBus || routeBuses[0]?.id,
          level,
        }),
      });
      setNotice({
        text: "Təşəkkürlər! Hesabatınız qəbul edildi. Sıxlıq növbəti dəqiqə ərzində yenilənəcək.",
        success: true,
      });
    } catch (err) {
      setNotice({
        text:
          err instanceof Error
            ? err.message
            : "Hesabat göndərilmədi. Yenidən cəhd edin.",
        success: false,
      });
    } finally {
      setSending(false);
    }
  }
  function routeOptions() {
    return routes.map((item) => (
      <option value={item.id} key={item.id}>
        {item.code} · {item.name.replace(" (demo)", "")}
      </option>
    ));
  }
  function stopOptions() {
    return routes.map((item) => (
      <optgroup key={item.id} label={item.code}>
        {(stops[item.id] || []).map((stop) => (
          <option key={stop.id} value={stop.id}>
            {stop.name}
          </option>
        ))}
      </optgroup>
    ));
  }

  return (
    <div className="passenger-app">
      <a href="#passenger-content" className="p-skip">
        Əsas məzmuna keç
      </a>
      <header className="p-header">
        <a href="#passenger" className="p-brand" aria-label="IDDA ana səhifə">
          <RouteIcon size={34} strokeWidth={2} aria-hidden="true" />
          <span>
            idda<span>.</span>
          </span>
        </a>
        <nav className="p-product-nav" aria-label="Sərnişin naviqasiyası">
          <a href="#passenger" className="active" aria-current="page">
            <BusFront size={28} strokeWidth={1.5} aria-hidden="true" />
            Avtobuslar
          </a>
          <a href="#routes">
            <RouteIcon size={28} strokeWidth={1.5} aria-hidden="true" />
            Marşrutlar
          </a>
          <button onClick={() => scrollTo("crowd-report")}>
            <Users size={28} strokeWidth={1.5} aria-hidden="true" />
            Sıxlığı bildir
          </button>
        </nav>
        <div className="p-header-tools">
          <span className="p-city">
            <Globe2 size={18} aria-hidden="true" />
            Bakı, Azərbaycan
          </span>
          <button
            className="p-menu-button"
            onClick={openMenu}
            aria-label="Naviqasiya menyusunu aç"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
          >
            <Menu size={18} aria-hidden="true" />
            <CircleUserRound size={28} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="p-search-band" aria-label="Səfər axtarışı">
        <form className="p-search-desktop" onSubmit={showMap}>
          <label className="p-search-segment">
            Marşrut
            <select
              aria-label="Səfər üçün marşrut"
              value={selectedRoute}
              onChange={(event) => setRoute(Number(event.target.value))}
              disabled={!routes.length}
            >
              {routeOptions()}
            </select>
          </label>
          <label className="p-search-segment p-search-stop">
            Harada gözləyirsiniz?
            <select
              id="stop-select"
              value={selectedStop}
              onChange={(event) => setStop(Number(event.target.value))}
              disabled={!routes.length}
            >
              {official && <option value={0}>Dayanacaq seçin</option>}
              {stopOptions()}
            </select>
          </label>
          <div className="p-search-now">
            <span>Nə vaxt?</span>
            <strong>İndi</strong>
          </div>
          <button
            type="submit"
            className="p-search-orb"
            aria-label="Seçilmiş dayanacağı xəritədə göstər"
            disabled={!currentStop}
          >
            <Search size={22} aria-hidden="true" />
          </button>
        </form>
        <button
          className="p-search-mobile"
          onClick={openSearch}
          aria-haspopup="dialog"
          aria-expanded={searchOpen}
        >
          <Search size={22} aria-hidden="true" />
          <span>
            <strong>Harada gözləyirsiniz?</strong>
            <small>
              <span>{route?.code || "Marşrut seçin"}</span>
              <i />
              <span className="p-search-stop-name">
                {currentStop?.name || "Dayanacaq seçin"}
              </span>
              <i />
              <span>İndi</span>
            </small>
          </span>
          <span className="p-mobile-search-end">
            <ChevronDown size={18} aria-hidden="true" />
          </span>
        </button>
      </section>

      <main className="p-content" id="passenger-content">
        <div className="p-intro">
          <div>
            <h1>Şəhər sənin ritmində.</h1>
            <p>Növbəti avtobusunu tap. Daha rahat yola çıx.</p>
          </div>
          <span
            className={`p-connection ${official || transit.connected ? "" : "offline"}`}
          >
            {official ? (
              <ShieldCheck size={16} aria-hidden="true" />
            ) : transit.connected ? (
              <Wifi size={16} aria-hidden="true" />
            ) : (
              <WifiOff size={16} aria-hidden="true" />
            )}
            {official
              ? "AYNA · Rəsmi mənbə"
              : transit.connected
                ? "Canlı bağlantı"
                : "Yenidən bağlanır…"}
          </span>
        </div>
        <div className="p-data-mode">
          <span>
            {official
              ? `${routes.length} rəsmi marşrut · İstədiyiniz xətti yuxarıdan seçin`
              : "BakuPort · Real Şəhər Şəbəkəsi"}
          </span>
        </div>
        {official?.route?.stale && (
          <p className="p-inline-error" role="status">
            AYNA hazırda əlçatan deyil.{" "}
            {new Date(official.route.fetched_at).toLocaleString("az-AZ")}{" "}
            tarixində alınmış saxlanmış nüsxə göstərilir.
          </p>
        )}
        {transit.error && (
          <div className="p-error" role="alert">
            <span>{transit.error}</span>
            <button onClick={() => void transit.refresh()}>
              Yenidən yoxla
            </button>
          </div>
        )}
        <section
          className="p-routes"
          aria-label="Marşrut seçimi"
        >
          {transit.loading
            ? [1, 2, 3].map((id) => (
                <div
                  key={id}
                  className="p-route-skeleton"
                  aria-label="Marşrut yüklənir"
                />
              ))
            : displayedRoutes.map((item) => {
                const d = density.find((value) => value.route_id === item.id);
                const level =
                  d && d.confidence !== "unavailable" ? d.level : "unknown";
                const selected = item.id === selectedRoute;
                return (
                  <button
                    key={item.id}
                    className={`p-route-card ${selected ? "selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() => setRoute(item.id)}
                  >
                    <div className="p-route-visual">
                      {official ? (
                        <div className="p-official-route-number">
                          <BusFront size={26} aria-hidden="true" />
                          <strong>№ {item.code}</strong>
                        </div>
                      ) : (
                        <RoutePreview
                          stops={stops[item.id] || []}
                          selected={selected}
                        />
                      )}
                      <span className="p-route-badge">
                        {selected ? (
                          <>
                            <Check size={12} aria-hidden="true" />
                            Seçilmiş xətt
                          </>
                        ) : official ? (
                          "AYNA · Rəsmi xətt"
                        ) : (
                          "BakuPort xətti"
                        )}
                      </span>
                      <span className="p-preview-bus">
                        <BusFront size={18} aria-hidden="true" />
                      </span>
                    </div>
                    <div className="p-route-meta">
                      <div>
                        <strong>{item.name}</strong>
                        <span>
                          {official
                            ? `№ ${item.code} · Rəsmi marşrut`
                            : `${item.code} · ${(stops[item.id] || []).length} dayanacaq`}
                        </span>
                      </div>
                      {!official && (
                        <span className={`p-crowd ${level}`}>
                          <i />
                          {levelText[level]}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
        </section>
        {!transit.loading && !routes.length && (
          <div className="p-no-routes">
            <BusFront size={32} aria-hidden="true" />
            <h2>Marşrutlar hələ yüklənməyib</h2>
            <p>Bağlantını yoxlayıb yenidən cəhd edin.</p>
            <button onClick={() => void transit.refresh()}>
              Yenidən yoxla
            </button>
          </div>
        )}

        <div className="p-section-title">
          <h2>Səfərinə yaxından bax</h2>
          <span>
            <Radio size={14} aria-hidden="true" />
            {official ? "AYNA · Rəsmi yol sxemi" : "Canlı marşrut telemetriyası"}
          </span>
        </div>
        {official?.route && (
          <div className="p-official-details">
            <p>
              <strong>№ {official.route.code}</strong> ·{" "}
              {official.route.carrier} · {official.route.tariff_label}
            </p>
            <div className="p-direction-picker" aria-label="Marşrut istiqaməti">
              {official.route.directions.map((direction) => (
                <button
                  key={direction.id}
                  aria-pressed={direction.id === official.directionId}
                  onClick={() => official.setDirection(direction.id)}
                >
                  {direction.label}
                  <span>{direction.stops.length} dayanacaq</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="p-journey-grid">
          <div className="p-map-column">
            <section id="passenger-map" aria-label="Səfərin xəritəsi">
              {transit.loading || !routes.length ? (
                <div className="p-map-skeleton" role="status">
                  {transit.loading
                    ? "Xəritə məlumatları hazırlanır…"
                    : "Göstəriləcək marşrut yoxdur."}
                </div>
              ) : official ? (
                <OfficialPassengerMap
                  official={official}
                  selectedStop={selectedStop}
                  onStop={setStop}
                  focusRequest={focusRequest}
                />
              ) : (
                <TransitMap
                  variant="passenger"
                  focusRequest={focusRequest}
                  catalog={transit.catalog}
                  routes={routes}
                  stops={stops}
                  buses={buses}
                  density={density}
                  selectedRoute={selectedRoute}
                  selectedStop={selectedStop}
                  onStop={setStop}
                />
              )}
            </section>
            <div className="p-place-summary">
              <span className="p-place-icon">
                <MapPin size={24} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <div>
                <h3>{currentStop?.name || "Dayanacağınızı seçin"}</h3>
                <p>
                  {route?.code || (official ? "BakuBus marşrutu" : "Şəhər marşrutu")}{" "}
                  · {routeStops.length} dayanacaq · Bakı
                </p>
              </div>
              <span className={`p-crowd ${crowdLevel}`}>
                <i />
                {levelText[crowdLevel]}
              </span>
            </div>
            {official && routeStops.length > 0 && (
              <details className="p-stop-list">
                <summary>
                  İstiqamətdəki {routeStops.length} dayanacağa bax
                </summary>
                <ol>
                  {routeStops.map((stop) => (
                    <li key={stop.id}>
                      <button
                        aria-pressed={selectedStop === stop.id}
                        onClick={() => {
                          setStop(stop.id);
                          setFocusRequest((value) => value + 1);
                        }}
                      >
                        <span>{stop.id}</span>
                        {stop.name}
                      </button>
                    </li>
                  ))}
                </ol>
              </details>
            )}
            <div className="p-community">
              <MessageCircle size={28} strokeWidth={1.4} aria-hidden="true" />
              <div>
                <h3>Rahat səfər, birlikdə.</h3>
                <p>
                  Kiçik bir hesabatın başqasının səfərini asanlaşdıra bilər.
                </p>
              </div>
              <button
                onClick={() => scrollTo("crowd-report")}
                aria-label="Sıxlıq hesabatı bölməsinə keç"
              >
                <ArrowUpRight size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
          <aside className="p-rail">
            <section className="p-arrivals">
              <div className="p-card-heading">
                <h2>Yaxınlaşan avtobuslar</h2>
                <Clock3 size={20} strokeWidth={1.5} aria-hidden="true" />
              </div>
              <p className="p-card-description">
                {official
                  ? "Canlı GPS məlumatı tələb olunur"
                  : "Seçdiyin dayanacağa təxmini çatma vaxtı"}
              </p>
              {error && (
                <p className="p-inline-error" role="alert">
                  {error}
                </p>
              )}
              {loading || transit.loading ? (
                <div className="p-arrival-loading" role="status">
                  <span />
                  <span />
                  Gəliş vaxtları yüklənir…
                </div>
              ) : arrivals.length ? (
                <div className="p-arrival-list">
                  {arrivals.map((arrival, index) => (
                    <article className="p-arrival" key={arrival.bus_id}>
                      <span className="p-bus-icon">
                        <BusFront
                          size={24}
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      </span>
                      <div>
                        <div className="p-arrival-title">
                          <strong>{route?.code}</strong>
                          {index === 0 && <span>Ən yaxın</span>}
                        </div>
                        <small>{arrival.plate}</small>
                        <span className={`p-crowd ${arrival.crowd_level}`}>
                          <i />
                          {levelText[arrival.crowd_level]}
                        </span>
                      </div>
                      <div className="p-eta">
                        <strong>{Math.ceil(arrival.eta_minutes)}</strong>
                        <span>dəqiqə</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="p-empty">
                  <Clock3 size={30} strokeWidth={1.3} aria-hidden="true" />
                  <strong>
                    {official
                      ? "Canlı gəliş məlumatı yoxdur"
                      : "Bir azdan yenidən bax"}
                  </strong>
                  <p>
                    {official
                      ? "Bu xətt üçün təsdiqlənmiş canlı GPS mənbəyi yoxdur. Avtobus mövqeyi və ETA göstərilmir."
                      : "Bu dayanacağa yaxınlaşan avtobus hələ görünmür."}
                  </p>
                  <button onClick={openSearch}>
                    Başqa dayanacaq seç
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </div>
              )}
              <p className="p-update-note">
                <span />
                {official
                  ? "Sıxlıq məlumatı yoxdur"
                  : "Hər 10 saniyədə yenilənir · Canlı GPS"}
              </p>
            </section>
            <section className="p-report" id="crowd-report">
              <div className="p-card-heading">
                <h2>Avtobusun necədir?</h2>
                <Users size={20} strokeWidth={1.5} aria-hidden="true" />
              </div>
              <p className="p-card-description">
                Bir toxunuşla sıxlığı bildir və digər sərnişinlərlə bölüş.
              </p>
              {!official && (
                <>
                  <label htmlFor="report-bus">
                    Olduğun avtobus
                    <select
                      id="report-bus"
                      value={reportBus || routeBuses[0]?.id || ""}
                      disabled={!routeBuses.length}
                      onChange={(event) =>
                        setReportBus(Number(event.target.value))
                      }
                    >
                      {routeBuses.map((bus) => (
                        <option key={bus.id} value={bus.id}>
                          {bus.plate} · {route?.code}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="p-report-buttons">
                    {[
                      {
                        level: 1,
                        text: "Boş",
                        icon: <Check size={20} aria-hidden="true" />,
                      },
                      {
                        level: 3,
                        text: "Orta",
                        icon: <Users size={20} aria-hidden="true" />,
                      },
                      {
                        level: 5,
                        text: "Dolu",
                        icon: <BusFront size={20} aria-hidden="true" />,
                      },
                    ].map((item) => (
                      <button
                        key={item.level}
                        disabled={sending || !routeBuses.length}
                        onClick={() => void report(item.level)}
                        aria-label={`${item.text} sıxlıq hesabatı göndər`}
                      >
                        {item.icon}
                        <span>{item.text}</span>
                      </button>
                    ))}
                  </div>
                  {sending && (
                    <p className="p-report-feedback" role="status">
                      Hesabat göndərilir…
                    </p>
                  )}
                  {notice && (
                    <p
                      className={`p-report-feedback ${notice.success ? "success" : "error"}`}
                      role={notice.success ? "status" : "alert"}
                    >
                      {notice.success && <Check size={16} aria-hidden="true" />}
                      {notice.text}
                    </p>
                  )}
                  <p className="p-report-footnote">
                    Sənin hesabatın. Daha məlumatlı bir şəhər.
                  </p>
                </>
              )}
            </section>
          </aside>
        </div>
        <section className="p-discover">
          <div>
            <span className="p-discover-icon">
              <RouteIcon size={28} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <h2>Bakını başqa bir xətlə kəşf et.</h2>
            <p>
              AYNA-nın rəsmi marşrutlarını, dayanacaqlarını və yol sxemlərini
              araşdır.
            </p>
          </div>
          <a href="#routes">
            Rəsmi marşrutlara bax
            <ArrowRight size={18} aria-hidden="true" />
          </a>
        </section>
      </main>

      <footer className="p-footer">
        <a href="#passenger" className="p-footer-brand">
          idda.
        </a>
        <span>© {new Date().getFullYear()} IDDA · Bakı üçün birlikdə.</span>
        <button onClick={() => aboutDialog.current?.showModal()}>
          Məlumatlar haqqında
        </button>
        <span className="p-footer-language">
          <Globe2 size={16} aria-hidden="true" />
          Azərbaycan dili
        </span>
      </footer>
      <div className="p-mobile-summary">
        <div>
          <span>{official ? "Rəsmi marşrut" : "Seçilmiş dayanacağa"}</span>
          <strong>
            {official
              ? route
                ? `№ ${route.code} · ${routeStops.length} dayanacaq`
                : "Xətt seçin"
              : !loading && nextArrival
                ? `${Math.ceil(nextArrival.eta_minutes)} dəqiqə`
                : loading
                  ? "Gəlişlər yüklənir…"
                  : "Gəliş gözlənilir"}
          </strong>
        </div>
        <button onClick={() => showMap()}>
          <MapPin size={18} aria-hidden="true" />
          Xəritədə bax
        </button>
      </div>

      <dialog
        className="p-dialog p-search-dialog"
        ref={searchDialog}
        onClose={() => setSearchOpen(false)}
        aria-labelledby="p-search-title"
      >
        <div className="p-dialog-heading">
          <h2 id="p-search-title">Səfərini planlaşdır</h2>
          <button
            onClick={() => searchDialog.current?.close()}
            aria-label="Axtarışı bağla"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={showMap}>
          <label>
            Marşrut
            <select
              value={selectedRoute}
              onChange={(event) => setRoute(Number(event.target.value))}
              disabled={!routes.length}
            >
              {routeOptions()}
            </select>
          </label>
          <label>
            Dayanacaq
            <select
              id="mobile-stop-select"
              value={selectedStop}
              onChange={(event) => setStop(Number(event.target.value))}
              disabled={!routes.length}
            >
              {official && <option value={0}>Dayanacaq seçin</option>}
              {stopOptions()}
            </select>
          </label>
          <div className="p-dialog-now">
            <Clock3 size={20} aria-hidden="true" />
            <div>
              <strong>İndi</strong>
              <p>
                {official
                  ? "Rəsmi yol sxemi və dayanacaqlar göstərilir. Canlı ETA mövcud deyil."
                  : "Gəlişlər canlı GPS məlumatlarından hesablanır."}
              </p>
            </div>
          </div>
          <button
            className="p-dialog-search"
            type="submit"
            disabled={!currentStop}
          >
            <span>Xəritədə göstər</span>
            <span className="p-search-orb">
              <Search size={22} aria-hidden="true" />
            </span>
          </button>
        </form>
      </dialog>
      <dialog
        className="p-dialog p-menu-dialog"
        ref={menuDialog}
        onClose={() => setMenuOpen(false)}
        aria-labelledby="p-menu-title"
      >
        <div className="p-dialog-heading">
          <h2 id="p-menu-title">Haraya baxaq?</h2>
          <button
            onClick={() => menuDialog.current?.close()}
            aria-label="Menyunu bağla"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Əlavə keçidlər">
          <a href="#passenger" onClick={() => menuDialog.current?.close()}>
            <BusFront size={22} aria-hidden="true" />
            Sərnişin
          </a>
          <a href="#routes" onClick={() => menuDialog.current?.close()}>
            <RouteIcon size={22} aria-hidden="true" />
            Rəsmi marşrutlar
          </a>
          <button
            onClick={() => {
              menuDialog.current?.close();
              aboutDialog.current?.showModal();
            }}
          >
            <CircleHelp size={22} aria-hidden="true" />
            Məlumatlar haqqında
          </button>
        </nav>
      </dialog>
      <dialog
        className="p-dialog p-about-dialog"
        ref={aboutDialog}
        aria-labelledby="p-about-title"
      >
        <div className="p-dialog-heading">
          <h2 id="p-about-title">Məlumatlar haqqında</h2>
          <button
            onClick={() => aboutDialog.current?.close()}
            aria-label="Məlumat pəncərəsini bağla"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <p>
          {official
            ? "Marşrutlar, yol sxemləri, istiqamətlər, dayanacaqlar və tariflər AYNA-nın rəsmi xəritə xidmətindəndir."
            : "BakuPort platformasında avtobus mövqeləri və sıxlıq göstəriciləri telemetriya və sərnişin hesabatları əsasında hesablanır."}
        </p>
        <p>
          {official
            ? "Göstərilən məlumatlar AYNA mənbəyindən alınma anına aiddir; sonrakı dəyişikliklər üçün mənbəni yoxlayın."
            : "Dayanacaq adları və koordinatları OpenData.az mənbəyindəndir. Rəsmi yol sxemləri ayrıca AYNA marşrutları bölməsindədir."}
        </p>
        <div className="p-about-links">
          {official && (
            <a
              href={official.route?.source_url || "https://map.ayna.gov.az/"}
              target="_blank"
              rel="noreferrer"
            >
              AYNA · Rəsmi mənbə
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          )}
          {transit.sources?.sources.map((source) => (
            <a
              key={source.key}
              href={source.dataset_url}
              target="_blank"
              rel="noreferrer"
            >
              {source.key === "stops"
                ? "Dayanacaq koordinatları"
                : "Gündəlik gediş statistikası"}
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          ))}
        </div>
      </dialog>
    </div>
  );
}
