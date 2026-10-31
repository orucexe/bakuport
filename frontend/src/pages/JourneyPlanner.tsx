import { useEffect, useRef, useState, useMemo, type FormEvent } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  ArrowLeftRight,
  BusFront,
  Check,
  ChevronRight,
  Clock3,
  Footprints,
  LocateFixed,
  MapPin,
  Menu,
  Navigation,
  Route,
  Search,
  ShieldCheck,
  Compass,
  Users,
  X,
} from "lucide-react";
import { api, utcDate } from "../api";
import { backendConfigured, backendUnavailableMessage } from '../backend';
import PlacePicker, { type Place } from "../components/PlacePicker";
import JourneyMap, { type RouteViewData } from "../components/JourneyMap";
import { BakuPortLogo } from "../components/BakuPortLogo";
import CrowdReportCard from "../components/CrowdReportCard";
import type { Transit } from "../useTransit";
import type { Journey, Vehicle } from "./journeyTypes";
import { refineWalking } from '../services/walking';
import "./passenger.css";
import "./journey.css";
import "./passenger-responsive.css";

interface CatalogRoute {
  source_id: number;
  code: string;
}

interface OfficialStop {
  source_id: number;
  source_code: string;
  name: string;
  sequence: number;
  lat: number;
  lng: number;
}

interface Direction {
  id: number;
  label: string;
  shape: { lat: number; lng: number }[];
  stops: OfficialStop[];
}

interface OfficialRouteDetail {
  source_id: number;
  code: string;
  carrier: string;
  first_stop: string;
  last_stop: string;
  length_km: number;
  tariff_label: string;
  directions: Direction[];
}

export default function JourneyPlanner({ transit }: { transit: Transit }) {
  // Navigation tab: 'journey' (Haradan - Haraya) or 'findRoute' (Avtobus xətti axtarışı)
  const [activeTab, setActiveTab] = useState<"journey" | "findRoute">("journey");

  // Journey state
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [mode, setMode] = useState<"official" | "demo">("official");
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selected, setSelected] = useState<Journey | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [partial, setPartial] = useState(false);
  const [stale, setStale] = useState(false);
  const [walkingLimit, setWalkingLimit] = useState(1200);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [gpsError, setGpsError] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [horizon, setHorizon] = useState(0);
  const [tick, setTick] = useState(Date.now());
  const [user, setUser] = useState<Place | null>(null);
  const [locating, setLocating] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [reportMessage, setReportMessage] = useState("");

  // Find Route state
  const [routeQuery, setRouteQuery] = useState("");
  const [catalog, setCatalog] = useState<CatalogRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [routeDetail, setRouteDetail] = useState<OfficialRouteDetail | null>(null);
  const [directionIndex, setDirectionIndex] = useState(0);
  const [selectedStopSeq, setSelectedStopSeq] = useState<number | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");

  const watch = useRef<number | null>(null);
  const searchController = useRef<AbortController | null>(null);
  const menu = useRef<HTMLDialogElement>(null);

  const stops =
    mode === "demo" ? Object.values(transit.stops).flat() : transit.catalog;
  const currentVehicle = vehicles.find(
    (vehicle) => vehicle.vehicle_id === vehicleId,
  );
  const freshVehicles = vehicles.filter(
    (vehicle) => tick - utcDate(vehicle.ts).getTime() <= 30000,
  );

  // Fetch routes catalog for Find Route tab
  useEffect(() => {
    let active = true;
    api<{ routes: CatalogRoute[] }>("/official/routes")
      .then((data) => {
        if (!active) return;
        setCatalog(data.routes || []);
        if (data.routes && data.routes.length > 0 && selectedRouteId === null) {
          // Preselect route 62 or first route
          const initial = data.routes.find((r) => r.code === "62") || data.routes[0];
          setSelectedRouteId(initial.source_id);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Fetch route details when a route is selected in Find Route tab
  useEffect(() => {
    if (!selectedRouteId) return;
    let active = true;
    setRouteLoading(true);
    setRouteError("");
    setSelectedStopSeq(null);

    api<OfficialRouteDetail>(`/official/routes/${selectedRouteId}`)
      .then((data) => {
        if (!active) return;
        setRouteDetail(data);
        setDirectionIndex(0);
      })
      .catch((err) => {
        if (!active) return;
        setRouteError(err instanceof Error ? err.message : "Xətt məlumatı yüklənmədi.");
      })
      .finally(() => {
        if (active) setRouteLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedRouteId]);

  // Filtered routes based on search query
  const filteredCatalog = useMemo(() => {
    const q = routeQuery.trim().toLocaleLowerCase("az");
    if (!q) return catalog.slice(0, 24);
    return catalog.filter((r) => r.code.toLocaleLowerCase("az").includes(q));
  }, [catalog, routeQuery]);

  // Active direction in route view
  const activeDirection = useMemo(() => {
    if (!routeDetail || !routeDetail.directions.length) return null;
    return routeDetail.directions[directionIndex] || routeDetail.directions[0];
  }, [routeDetail, directionIndex]);

  // Format data for JourneyMap in route view mode
  const currentRouteView = useMemo<RouteViewData | null>(() => {
    if (activeTab !== "findRoute" || !routeDetail || !activeDirection) return null;
    return {
      code: routeDetail.code,
      carrier: routeDetail.carrier,
      color: "#ff385c",
      shape: activeDirection.shape,
      stops: activeDirection.stops,
    };
  }, [activeTab, routeDetail, activeDirection]);

  function clearSearch() {
    searchController.current?.abort();
    setSearching(false);
    setSearched(false);
    setJourneys([]);
    setSelected(null);
    setVehicles([]);
    setError("");
  }

  function changeOrigin(place: Place | null) {
    stopLocation();
    setOrigin(place);
    clearSearch();
  }

  function changeDestination(place: Place | null) {
    setDestination(place);
    clearSearch();
  }

  function stopLocation() {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setTracking(false);
    setLocating(false);
  }

  function locate() {
    if (tracking) {
      stopLocation();
      return;
    }
    if (!navigator.geolocation) {
      setLocationError("Bu brauzerdə məkan funksiyası dəstəklənmir.");
      return;
    }
    setLocating(true);
    clearSearch();
    setLocationError("");
    watch.current = navigator.geolocation.watchPosition(
      (position) => {
        const place = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          name: "Cari məkanım",
        };
        setUser(place);
        setOrigin(place);
        setLocating(false);
        setTracking(true);
      },
      (failure) => {
        setLocationError(
          failure.code === 1
            ? "Məkan icazəsi verilmədi. Ünvanı daxil edə bilərsiniz."
            : failure.code === 3
              ? "Məkan sorğusunun vaxtı bitdi. Yenidən cəhd edin."
              : "Məkan müəyyən edilmədi. GPS və bağlantını yoxlayın.",
        );
        stopLocation();
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 },
    );
  }

  useEffect(
    () => () => {
      if (watch.current !== null)
        navigator.geolocation.clearWatch(watch.current);
      searchController.current?.abort();
    },
    [],
  );

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch live vehicle GPS fixes for selected journey
  useEffect(() => {
    setVehicles([]);
    setVehicleId("");
    setHorizon(0);
    setReportMessage("");
    setGpsError("");
    if (!selected) return;
    const controller = new AbortController();
    setGpsLoading(true);
    async function load() {
      try {
        const params = new URLSearchParams({
          route_id: String(selected!.route_id),
          direction_id: String(selected!.direction_id),
          board: String(selected!.board.sequence),
          alight: String(selected!.alight.sequence),
          mode: selected!.mode,
        });
        const data = await api<{ vehicles: Vehicle[] }>(
          `/journeys/vehicles?${params}`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setVehicles(data.vehicles);
        setVehicleId((old) =>
          data.vehicles.some((vehicle) => vehicle.vehicle_id === old)
            ? old
            : data.vehicles[0]?.vehicle_id || "",
        );
        setGpsError("");
      } catch (err) {
        if (!controller.signal.aborted) {
          setGpsError(
            err instanceof Error ? err.message : "GPS məlumatı alınmadı.",
          );
          setVehicles([]);
        }
      } finally {
        if (!controller.signal.aborted) setGpsLoading(false);
      }
    }
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [selected]);

  // Search journeys between origin and destination
  async function search(event?: FormEvent) {
    event?.preventDefault();
    if (!origin || !destination) {
      setError("Başlanğıc və təyinat ünvanını daxil edin.");
      return;
    }
    if (origin.lat === destination.lat && origin.lng === destination.lng) {
      setError("Başlanğıc və təyinat eyni ola bilməz. Fərqli nöqtə seçin.");
      return;
    }
    clearSearch();
    const controller = new AbortController();
    searchController.current = controller;
    setSearching(true);
    try {
      const data = await api<{
        journeys: Journey[];
        partial: boolean;
        stale: boolean;
      }>("/journeys/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, mode, walking_limit_m: walkingLimit }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const refined=mode==='official'?await refineWalking(data.journeys,walkingLimit,controller.signal):data.journeys;
      if(controller.signal.aborted)return;
      setJourneys(refined);
      setPartial(data.partial);
      setStale(data.stale);
      setSearched(true);
      if (refined.length > 0) {
        setSelected(refined[0]);
      }
    } catch (err) {
      if (!controller.signal.aborted)
        setError(
          err instanceof Error ? err.message : "Səfər axtarışı alınmadı.",
        );
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }

  function switchMode() {
    stopLocation();
    clearSearch();
    const next = mode === "official" ? "demo" : "official";
    setMode(next);
    setOrigin(null);
    setDestination(null);
    if (next === "demo") {
      const path = Object.values(transit.stops)[0] || [];
      setOrigin(path[5] || null);
      setDestination(path[9] || null);
    }
  }

  async function report(level: number) {
    if (mode !== "demo" || !selected || !currentVehicle) return;
    try {
      await api("/crowd-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route_id: selected.route_id,
          bus_id: Number(currentVehicle.vehicle_id),
          level,
        }),
      });
      setReportMessage("Hesabatınız qəbul edildi.");
    } catch {
      setReportMessage("Hesabat göndərilmədi. Yenidən cəhd edin.");
    }
  }

  return (
    <div className="passenger-app journey-planner">
      <a className="p-skip" href="#journey-content">
        Əsas məzmuna keç
      </a>
      <header className="p-header">
        <a className="p-brand" href="#passenger" aria-label="BakuPort ana səhifə" style={{ textDecoration: "none" }}>
          <BakuPortLogo size={32} />
        </a>

        {/* Global tab buttons: Haradan-Haraya vs Xətt Axtar */}
        <div className="j-tabs-wrapper" style={{ margin: 0 }}>
          <div className="j-tabs-nav">
            <button
              type="button"
              className={`j-tab-trigger ${activeTab === "journey" ? "active" : ""}`}
              onClick={() => setActiveTab("journey")}
            >
              <Navigation size={16} />
              <span>Haradan – Haraya</span>
            </button>
            <button
              type="button"
              className={`j-tab-trigger ${activeTab === "findRoute" ? "active" : ""}`}
              onClick={() => setActiveTab("findRoute")}
            >
              <BusFront size={16} />
              <span>Avtobus Xətti Tap</span>
            </button>
          </div>
        </div>

        <div className="p-header-right">
          <button
            type="button"
            className="p-icon-button"
            onClick={() => menu.current?.showModal()}
            aria-label="Əsas menyu"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      <dialog ref={menu} className="p-dialog" aria-labelledby="menu-title">
        <div className="p-dialog-content">
          <div className="p-dialog-header">
            <h2 id="menu-title">İdarəetmə paneli</h2>
            <button
              type="button"
              className="p-icon-button"
              onClick={() => menu.current?.close()}
              aria-label="Menyunu bağla"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-dialog-body">
            <div className="p-menu-group">
              <a href="#routes" className="p-menu-link">
                Marşrut Kataloqu
                <ArrowRight size={18} />
              </a>
            </div>
            <div className="p-menu-mode">
              <div>
                <strong>Məlumat rejimi:</strong>
                <p>
                  {mode === "official"
                    ? "AYNA rəsmi Bakı marşrutları və koordinatları"
                    : "Simulyasiya edilmiş demo avtobusları və canlı sıxlıq"}
                </p>
              </div>
              <button
                type="button"
                className="p-button p-button-secondary"
                onClick={() => {
                  switchMode();
                  menu.current?.close();
                }}
              >
                {mode === "official" ? "Demo rejiminə keç" : "Rəsmi rejimə keç"}
              </button>
            </div>
          </div>
        </div>
      </dialog>

      <main id="journey-content" className="p-main">
        {!backendConfigured&&<p className="j-banner error" role="status">{backendUnavailableMessage}</p>}
        {/* ================= TAB 1: HARADAN - HARAYA (JOURNEY PLANNER) ================= */}
        {activeTab === "journey" && (
          <section className="j-hero-section">
            <div className="j-intro">
              <div className="j-eyebrow">
                <Compass size={14} />
                <span>BAKUPORT · BAKI ŞƏHƏR İCTİMAİ NƏQLİYYAT ŞƏBƏKƏSİ</span>
              </div>
              <h1>Hara getmək istəyirsiniz?</h1>
              <p>
                Başlanğıcı və gedəcəyiniz yeri seçin. Yaxın dayanacağa piyada yol, uyğun avtobus və enəndən sonra təyinata piyada məsafə birlikdə hesablanacaq.
              </p>
            </div>

            <form className="j-search" onSubmit={search}>
              <PlacePicker
                label="Haradan"
                placeholder="Başlanğıc: məkan, metro, ünvan və ya dayanacaq..."
                value={origin}
                onChange={changeOrigin}
                stops={stops}
              />

              <button
                type="button"
                className="j-swap"
                title="Başlanğıc və təyinat yerini dəyiş"
                onClick={() => {
                  const temp = origin;
                  changeOrigin(destination);
                  changeDestination(temp);
                }}
              >
                <ArrowDownUp size={18} />
              </button>

              <PlacePicker
                label="Haraya"
                placeholder="Təyinat: məkan, ticarət mərkəzi, küçə..."
                value={destination}
                onChange={changeDestination}
                stops={stops}
              />

              <div className="j-actions">
                <button
                  type="button"
                  className={`j-locate-btn ${tracking ? "active" : ""}`}
                  onClick={locate}
                  title="Cari yerləşdiyim məkanı seç"
                >
                  <LocateFixed size={20} />
                  <span>{locating ? "Müəyyən edilir..." : tracking ? "Canlı GPS" : "Cari məkan"}</span>
                </button>

                <button
                  type="submit"
                  className="j-find-btn"
                  disabled={searching || !origin || !destination}
                >
                  {searching ? (
                    <span className="j-place-spin" />
                  ) : (
                    <Search size={18} />
                  )}
                  <span>Marşrut Axtar</span>
                </button>
              </div>
            </form>
            <fieldset className="j-walking-limit"><legend>Hər tərəfdə nə qədər piyada gedə bilərsiniz?</legend><div>{[400,800,1200,1500].map(meters=><button key={meters} type="button" aria-pressed={walkingLimit===meters} onClick={()=>{setWalkingLimit(meters);clearSearch();}}>{meters<1000?`${meters} m`:`${meters/1000} km`}</button>)}</div><p>Piyada məsafələri düz xətt üzrə təxmindir; keçidlər və maneələrə görə real yol uzana bilər.</p></fieldset>

            {locationError && (
              <div className="j-banner error" role="alert">
                {locationError}
              </div>
            )}
            {error && (
              <div className="j-banner error" role="alert">
                {error}
              </div>
            )}

            {/* Results layout */}
            <div className={`j-grid-layout j-journey-centered ${!searched ? 'awaiting-search' : ''}`}>
              {/* Left results column */}
              <div className="j-results-col">
                {searched && (
                  <div className="j-results-header">
                    <h2>Uyğun Avtobus Seçimləri ({journeys.length})</h2>
                    <span className="j-results-badge">
                      {mode === "official" ? "Rəsmi AYNA xətləri" : "Demo xətləri"}
                    </span>
                  </div>
                )}

                {searched && journeys.length === 0 && (
                  <div className="j-empty-state">
                    <BusFront size={42} />
                    <h3>Uyğun piyada + avtobus səfəri tapılmadı</h3>
                    <p>
                      Hər tərəfdə {walkingLimit} metrədək piyada yol nəzərə alındı. Piyada həddini artırın və ya başqa məkan seçin. Avtobuslar arasında dəyişmə bu axtarışa daxil deyil.
                    </p>
                  </div>
                )}

                <div className="j-result-list">
                  {journeys.map((item) => {
                    const isSelected = selected?.key === item.key;
                    const walkToMin = Math.ceil(item.walk_to_minutes ?? item.walk_to_m / 75);
                    const walkFromMin = Math.ceil(item.walk_from_minutes ?? item.walk_from_m / 75);

                    return (
                      <div
                        key={item.key}
                        className={`j-card ${isSelected ? "selected" : ""}`}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelected(item);}}}
                        onClick={() => setSelected(item)}
                      >
                        <div className="j-card-top">
                          <div className="j-route-pill">
                            <BusFront size={18} />
                            <span>{item.code} nömrəli</span>
                          </div>
                          <div className="j-trip-time">
                            <Clock3 size={15} />
                            <strong>~{item.planned_minutes} dəqiqə</strong>
                          </div>
                          <small className="j-wait-note">Piyada + avtobus · gözləmə xaric</small>
                          <div className="j-fare-tag">
                            {item.tariff_label || "Tarif məlum deyil"}
                          </div>
                        </div>

                        <div className="j-carrier-info">
                          <span>Daşıyıcı: <strong>{item.carrier}</strong></span>
                          <span>•</span>
                          <span>{item.direction_label}</span>
                        </div>
                        <p className="j-search-disclosure">{item.walking_status==='provider'?'Piyada yolu: Google Routes':'Piyada yolu: düz xətt təxmini'} · {item.ride_time_basis==='published_route_duration_scaled'?'Avtobus vaxtı: mənbənin ümumi müddətindən təxmini':'Avtobus vaxtı: 18 km/saat fərziyyəsi'} · gözləmə daxil deyil.</p>
                        {item.fetched_at&&<p className="j-search-disclosure">AYNA məlumatı: {utcDate(item.fetched_at).toLocaleDateString('az-AZ')}{item.stale?' · saxlanmış nüsxə':''}</p>}
                        {item.walking_warnings?.map((warning,index)=><p key={index} className="j-search-disclosure">{warning.replace(/<[^>]*>/g,'')}</p>)}

                        {/* Walking and transit breakdown */}
                        <div className="j-trip-timeline">
                          <div className="j-timeline-item">
                            <div className="j-timeline-icon walk">
                              <Footprints size={14} />
                            </div>
                            <div>
                              <span><strong>{item.walk_to_m} m ({walkToMin} dəq)</strong> piyada</span>
                              <div style={{ color: "var(--p-muted)", fontSize: "12px" }}>
                                ➔ <strong>{item.board.name}</strong> dayanacağına
                              </div>
                            </div>
                          </div>

                          <div className="j-timeline-item">
                            <div className="j-timeline-icon bus">
                              <BusFront size={14} />
                            </div>
                            <div>
                              <span><strong>{item.code} nömrəli avtobus</strong> ({item.stop_count} dayanacaq • {item.ride_minutes} dəq)</span>
                              <div style={{ color: "var(--p-muted)", fontSize: "12px" }}>
                                {item.board.name} ➔ {item.alight.name}
                              </div>
                            </div>
                          </div>

                          <div className="j-timeline-item">
                            <div className="j-timeline-icon walk">
                              <Footprints size={14} />
                            </div>
                            <div>
                              <span><strong>{item.walk_from_m} m ({walkFromMin} dəq)</strong> piyada</span>
                              <div style={{ color: "var(--p-muted)", fontSize: "12px" }}>
                                ➔ Təyinat məntəqəsinə
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {searched && (partial || stale) && <p className="j-search-disclosure">{partial?'Məhdud və ya natamam mənbə məlumatı səbəbindən bütün mümkün səfərlər göstərilməyə bilər. ':''}{stale?'Saxlanmış mənbə nüsxəsi istifadə olunur.':''}</p>}
              </div>

              {/* Right interactive map column */}
              <div className="j-map-col">
                <div className="j-map-card">
                  <JourneyMap
                    journey={selected}
                    user={user}
                    origin={origin}
                    destination={destination}
                    vehicles={freshVehicles}
                    selectedVehicle={vehicleId}
                    horizon={horizon}
                    onVehicle={setVehicleId}
                  />
                  {selected && (
                    <div className="j-map-legend">
                      <div className="legend-item">
                        <span className="legend-dot walk" /> Piyada gəzinti (kəsik xətt)
                      </div>
                      <div className="legend-item">
                        <span className="legend-dot bus" /> Avtobus xətti ({selected.code})
                      </div>
                      <div className="legend-item">
                        <span className="legend-dot start" /> Minik: {selected.board.name}
                      </div>
                      <div className="legend-item">
                        <span className="legend-dot end" /> Düşmə: {selected.alight.name}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ================= TAB 2: AVTOBUS XƏTTİ AXTAR (FIND ROUTE) ================= */}
        {activeTab === "findRoute" && (
          <section className="find-route-section">
            <div className="j-intro">
              <div className="j-eyebrow">
                <BusFront size={14} />
                <span>RƏSMİ AVTOBUS MARŞRUTLARI VƏ DAYANACAQLAR</span>
              </div>
              <h1>Avtobus xəttini tapın</h1>
              <p>
                İstədiyiniz avtobusun nömrəsini daxil edin. İnteraktiv xəritədə həmin xəttin bütün trayektoriyası, dayanacaqları və istiqamətləri əks olunacaq.
              </p>
            </div>

            <div className="route-finder-box">
              <div className="route-search-bar">
                <Search size={20} color="var(--p-muted)" />
                <input
                  type="text"
                  placeholder="Avtobusun nömrəsini daxil edin (məs: 62, 1, 14, 175, 88...)"
                  value={routeQuery}
                  onChange={(e) => setRouteQuery(e.target.value)}
                />
                {routeQuery && (
                  <button
                    type="button"
                    style={{ border: "none", background: "transparent", cursor: "pointer" }}
                    onClick={() => setRouteQuery("")}
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {/* Popular route quick chips */}
              <div className="route-chips">
                <span style={{ fontSize: "13px", color: "var(--p-muted)", alignSelf: "center", marginRight: "4px" }}>
                  Tez seçim:
                </span>
                {["1", "62", "14", "175", "88", "M8", "5", "18", "24", "133"].map((code) => {
                  const match = catalog.find((r) => r.code === code);
                  if (!match) return null;
                  const isCur = selectedRouteId === match.source_id;
                  return (
                    <button
                      key={match.source_id}
                      type="button"
                      className={`route-chip-btn ${isCur ? "active" : ""}`}
                      onClick={() => setSelectedRouteId(match.source_id)}
                    >
                      <BusFront size={14} />
                      № {match.code}
                    </button>
                  );
                })}
              </div>

              {/* If query has matches, display matched buttons */}
              {routeQuery && (
                <div style={{ marginTop: "12px" }}>
                  <div style={{ fontSize: "12px", color: "var(--p-muted)", marginBottom: "6px" }}>
                    Axtarışa uyğun xətlər ({filteredCatalog.length}):
                  </div>
                  <div className="route-chips">
                    {filteredCatalog.map((r) => (
                      <button
                        key={r.source_id}
                        type="button"
                        className={`route-chip-btn ${selectedRouteId === r.source_id ? "active" : ""}`}
                        onClick={() => setSelectedRouteId(r.source_id)}
                      >
                        № {r.code}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Route details banner */}
              {routeDetail && (
                <div className="route-info-card">
                  <div className="route-header-flex">
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span className="route-number-badge">{routeDetail.code}</span>
                      <div>
                        <strong style={{ fontSize: "17px", color: "var(--p-ink)" }}>
                          {activeDirection?.label || `${routeDetail.first_stop} ➔ ${routeDetail.last_stop}`}
                        </strong>
                        <div className="route-carrier-tag">
                          Daşıyıcı: <strong>{routeDetail.carrier}</strong> • Tarif: <strong>{routeDetail.tariff_label || "Tarif məlum deyil"}</strong> • Uzunluq: <strong>{routeDetail.length_km} km</strong>
                        </div>
                      </div>
                    </div>

                    {/* Direction toggle button */}
                    {routeDetail.directions.length > 1 && (
                      <button
                        type="button"
                        className="direction-toggle-btn"
                        onClick={() => setDirectionIndex((prev) => (prev === 0 ? 1 : 0))}
                      >
                        <ArrowLeftRight size={16} />
                        <span>İstiqaməti dəyiş ({directionIndex === 0 ? "Əks istiqamətə" : "Düz istiqamətə"})</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {routeLoading && (
              <div style={{ textAlign: "center", padding: "20px", color: "var(--p-muted)" }}>
                Xətt məlumatları və xəritə koordinatları yüklənir...
              </div>
            )}
            {routeError && (
              <div className="j-banner error" role="alert">
                {routeError}
              </div>
            )}

            {/* Split view: Route Map & Stops List */}
            {routeDetail && activeDirection && (
              <div className="j-grid-layout">
                {/* Left: Stops list */}
                <div className="j-results-col">
                  <div className="j-results-header">
                    <h2>Dayanacaqlar Siyahısı ({activeDirection.stops.length})</h2>
                    <span style={{ fontSize: "12px", color: "var(--p-muted)" }}>
                      Dayanacağa basaraq xəritədə görün
                    </span>
                  </div>

                  <div className="route-stops-container">
                    {activeDirection.stops.map((stop) => {
                      const isSelected = stop.sequence === selectedStopSeq;
                      return (
                        <div
                          key={`${stop.source_id}-${stop.sequence}`}
                          className={`route-stop-row ${isSelected ? "selected" : ""}`}
                          onClick={() => setSelectedStopSeq(stop.sequence)}
                        >
                          <span className="stop-seq-num">{stop.sequence}</span>
                          <span className="stop-row-name">{stop.name}</span>
                          <ChevronRight size={16} color="var(--p-muted)" />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Map with route polyline and all stops */}
                <div className="j-map-col">
                  <div className="j-map-card">
                    <JourneyMap
                      journey={null}
                      user={user}
                      origin={null}
                      destination={null}
                      vehicles={[]}
                      selectedVehicle=""
                      horizon={0}
                      onVehicle={() => {}}
                      routeView={currentRouteView}
                      selectedStopSequence={selectedStopSeq}
                      onSelectStop={(seq) => setSelectedStopSeq(seq)}
                    />
                    <div className="j-map-legend">
                      <div className="legend-item">
                        <span className="legend-dot bus" /> {routeDetail.code} nömrəli marşrut xətti
                      </div>
                      <div className="legend-item">
                        <span className="legend-dot start" /> {activeDirection.stops.length} rəsmi dayanacaq
                      </div>
                      {selectedStopSeq && (
                        <div className="legend-item" style={{ color: "#ff385c", fontWeight: 600 }}>
                          Seçilmiş: #{selectedStopSeq} {activeDirection.stops.find((s) => s.sequence === selectedStopSeq)?.name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Real-time Passenger Crowd Reporting with 2-minute cooldown */}
        <CrowdReportCard defaultRouteCode={routeDetail?.code || selected?.code || ""} />
      </main>

      <footer className="p-footer">
        <div>
          <span>© 2026 BakuPort Transit Platforması · Bakı şəhəri ictimai nəqliyyatı</span>
        </div>
      </footer>
    </div>
  );
}
