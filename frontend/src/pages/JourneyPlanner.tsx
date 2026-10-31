import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownUp,
  ArrowRight,
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
  Users,
  X,
} from "lucide-react";
import { api, utcDate } from "../api";
import PlacePicker, { type Place } from "../components/PlacePicker";
import JourneyMap from "../components/JourneyMap";
import type { Transit } from "../useTransit";
import type { Journey, Vehicle } from "./journeyTypes";
import "./passenger.css";
import "./journey.css";
import "./passenger-responsive.css";

export default function JourneyPlanner({ transit }: { transit: Transit }) {
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
            ? "Məkan icazəsi verilmədi. Dayanacağı əl ilə seçə bilərsiniz."
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
  async function search(event?: FormEvent) {
    event?.preventDefault();
    if (!origin || !destination) {
      setError("Başlanğıc və təyinat dayanacağını siyahıdan seçin.");
      return;
    }
    if (origin.lat === destination.lat && origin.lng === destination.lng) {
      setError("Başlanğıc və təyinat eyni ola bilməz. Fərqli dayanacaq seçin.");
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
      setJourneys(data.journeys);
      setPartial(data.partial);
      setStale(data.stale);
      setSearched(true);
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
        <a className="p-brand" href="#passenger" aria-label="IDDA ana səhifə">
          <Route size={34} />
          <span>
            idda<span>.</span>
          </span>
        </a>
        <nav className="p-product-nav" aria-label="Sərnişin naviqasiyası">
          <a className="active" href="#passenger" aria-current="page">
            <BusFront size={26} />
            Səfərini tap
          </a>
        </nav>
        <div className="p-header-tools">
          <span className="p-city">Bakı, Azərbaycan</span>
          <button
            className="p-menu-button"
            aria-label="Menyunu aç"
            aria-haspopup="dialog"
            onClick={() => menu.current?.showModal()}
          >
            <Menu size={20} />
          </button>
        </div>
      </header>
      <main className="p-content" id="journey-content">
        <div className="j-intro">
          <span className="j-eyebrow">
            <Navigation size={14} />
            BAKI ÜÇÜN BİRLİKDƏ
          </span>
          <h1>Haradan, haraya?</h1>
          <p>Gedəcəyin yeri seç. Sənə uyğun avtobusu tap.</p>
        </div>
        <form className="j-search" onSubmit={(event) => void search(event)}>
          <PlacePicker
            label="Haradan"
            value={origin}
            onChange={changeOrigin}
            stops={stops}
            loading={transit.loading}
          />
          <button
            type="button"
            className="j-swap"
            aria-label="Başlanğıc və təyinatı dəyiş"
            onClick={() => {
              stopLocation();
              setOrigin(destination);
              setDestination(origin);
              clearSearch();
            }}
          >
            <ArrowDownUp size={20} />
          </button>
          <PlacePicker
            label="Haraya"
            value={destination}
            onChange={changeDestination}
            stops={stops}
            loading={transit.loading}
          />
          <button
            className="j-find"
            type="submit"
            disabled={searching || !origin || !destination}
          >
            <Search size={20} />
            {searching ? "Axtarılır…" : "Avtobus tap"}
            <ArrowRight size={18} />
          </button>
        </form>
        <fieldset className="j-walking-limit"><legend>H?r t?r?fd? n? q?d?r piyada ged? bil?rsiniz?</legend><div>{[400,800,1200,1500].map(meters=><button key={meters} type="button" aria-pressed={walkingLimit===meters} onClick={()=>{setWalkingLimit(meters);clearSearch();}}>{meters<1000?`${meters} m`:`${meters/1000} km`}</button>)}</div><p>Piyada m?saf?l?ri d?z x?tt ?zr? t?xmindir; real yol uzana bil?r.</p></fieldset>
        <div className="j-search-tools">
          <button
            className={tracking ? "tracking" : ""}
            onClick={locate}
            disabled={locating}
          >
            <LocateFixed size={17} />
            {locating
              ? "Məkan alınır…"
              : tracking
                ? "Canlı məkan aktivdir · dayandır"
                : "Məkanımı istifadə et"}
          </button>
          <button onClick={switchMode}>
            {mode === "official"
              ? "Demo səfərini yoxla"
              : "Rəsmi məlumatlara qayıt"}
            <ChevronRight size={15} />
          </button>
        </div>
        {locationError && (
          <p className="j-error" role="alert">
            {locationError}
          </p>
        )}
        {error && (
          <p className="j-error" role="alert">
            {error}
          </p>
        )}
        {transit.error && (
          <p className="j-error" role="alert">
            Dayanacaqlar yüklənmədi.{" "}
            <button onClick={() => void transit.refresh()}>
              Yenidən yoxla
            </button>
          </p>
        )}
        <div className="j-workspace">
          <section className="j-results" aria-label="Uyğun avtobuslar">
            <div className="j-section-heading">
              <h2>
                {searching
                  ? "Uyğun avtobusları axtarırıq"
                  : searched
                    ? `${journeys.length} uyğun səfər`
                    : "Yolun buradan başlayır"}
              </h2>
              <span>
                {mode === "demo" ? "Simulator" : "AYNA · rəsmi xətlər"}
              </span>
            </div>
            {searching ? (
              <div className="j-state" role="status">
                <span className="j-spinner" />
                <strong>Dayanacaqlar və istiqamətlər yoxlanılır…</strong>
                <p>
                  İlk sorğu rəsmi mənbədən asılı olaraq bir qədər çəkə bilər.
                </p>
              </div>
            ) : !searched ? (
              <div className="j-state">
                <span className="j-state-icon">
                  <MapPin size={28} />
                </span>
                <h3>İki nöqtə. Daha rahat səfər.</h3>
                <p>
                  Başlanğıcı və gedəcəyin dayanacağı seç, sonra “Avtobus tap”
                  düyməsinə toxun.
                </p>
                <div className="j-steps">
                  <span>
                    <Check size={15} />
                    Uyğun avtobus
                  </span>
                  <span>
                    <Check size={15} />
                    Minmə və enmə dayanacağı
                  </span>
                  <span>
                    <Check size={15} />
                    Seçdiyin avtobusun yolu
                  </span>
                </div>
              </div>
            ) : !journeys.length ? (
              <div className="j-state">
                <Search size={30} />
                <h3>Birbaşa avtobus tapılmadı</h3>
                <p>
                  800 metrədək yaxın dayanacaqlar yoxlanıldı. Daha yaxın
                  dayanacaq seçin. Dəyişməli səfərlər hələ dəstəklənmir.
                </p>
              </div>
            ) : (
              <div className="j-result-list">
                {journeys.map((journey) => (
                  <button
                    className={`j-result ${selected?.key === journey.key ? "selected" : ""}`}
                    aria-pressed={selected?.key === journey.key}
                    key={journey.key}
                    onClick={() => {
                      setSelected(journey);
                      if (innerWidth < 744)
                        document.getElementById("journey-map")?.scrollIntoView({
                          behavior: matchMedia(
                            "(prefers-reduced-motion: reduce)",
                          ).matches
                            ? "auto"
                            : "smooth",
                        });
                    }}
                  >
                    <div className="j-result-top">
                      <span className="j-route-number">
                        <BusFront size={22} />
                        {journey.mode === "demo"
                          ? journey.code
                          : `№ ${journey.code}`}
                      </span>
                      <span className="j-plan-time">
                        ~{journey.planned_minutes} dəq
                        <small>gözləmə xaric</small>
                      </span>
                    </div>
                    <strong>
                      {journey.board.name}
                      <ArrowRight size={14} />
                      {journey.alight.name}
                    </strong>
                    <div className="j-trip-timeline"><p>{journey.walk_to_m} m piyada ? {journey.board.name}</p><p>{journey.code} avtobusu ? {journey.alight.name}</p><p>{journey.walk_from_m} m piyada ? t?yinat</p></div><div className="j-result-meta">
                      <span>
                        <Footprints size={15} />
                        {journey.walk_to_m + journey.walk_from_m} m
                      </span>
                      <span>{journey.stop_count} dayanacaq</span>
                      <span>{journey.tariff_label}</span>
                    </div>
                    <span className="j-result-link">
                      {selected?.key === journey.key
                        ? "Yol xəritədə göstərilir"
                        : "Bu avtobusu seç"}
                      <ChevronRight size={16} />
                    </span>
                  </button>
                ))}
              </div>
            )}
            {(partial || stale) && searched && (
              <p className="j-note">
                {partial
                  ? "Axtarış ən yaxın 4 dayanacaqla məhdudlaşıb; bütün mümkün səfərləri əhatə etməyə bilər. "
                  : ""}
                {stale
                  ? "Mənbə əlçatan deyil, saxlanmış məlumat istifadə olunur."
                  : ""}
              </p>
            )}
            <p className="j-method">
              <ShieldCheck size={15} />
              {mode === "official"
                ? "Rəsmi yol sxemi · birbaşa səfərlər"
                : "Demo yollar və simulyasiya edilmiş GPS"}
            </p>
          </section>
          <section
            className="j-map-column"
            id="journey-map"
            aria-label="Seçilmiş səfərin xəritəsi"
          >
            <div className="j-map-card">
              <div className="j-map-heading">
                <span>
                  <MapPin size={16} />
                  {selected
                    ? `${selected.code} · ${selected.direction_label}`
                    : "Səfərin xəritəsi"}
                </span>
                <span>{tracking ? "Canlı məkan" : "Google Maps"}</span>
              </div>
              <JourneyMap
                journey={selected}
                user={tracking ? user : null}
                origin={origin}
                destination={destination}
                vehicles={freshVehicles}
                selectedVehicle={vehicleId}
                horizon={horizon}
                onVehicle={setVehicleId}
              />
              <div className="j-map-foot">
                <span>
                  <i />
                  Seçilmiş avtobusun yolu
                </span>
                {selected && (
                  <span>
                    {selected.stop_count} dayanacaq · {selected.carrier}
                  </span>
                )}
              </div>
            </div>
            {selected && (
              <section className="j-live">
                <div className="j-section-heading">
                  <h2>Avtobus nə vaxt gəlir?</h2>
                  <span>{mode === "demo" ? "Demo GPS" : "GPS məlumatı"}</span>
                </div>
                {gpsError ? (
                  <p role="alert" className="j-error">
                    {gpsError}
                  </p>
                ) : gpsLoading ? (
                  <p role="status">GPS məlumatı yüklənir…</p>
                ) : freshVehicles.length ? (
                  <>
                    <div className="j-vehicle-list">
                      {freshVehicles.map((vehicle) => (
                        <button
                          key={vehicle.vehicle_id}
                          className={
                            vehicle.vehicle_id === vehicleId ? "active" : ""
                          }
                          aria-pressed={vehicle.vehicle_id === vehicleId}
                          onClick={() => setVehicleId(vehicle.vehicle_id)}
                        >
                          <BusFront size={24} />
                          <span>
                            <strong>{vehicle.label}</strong>
                            <small>
                              {Math.max(
                                0,
                                Math.floor(
                                  (tick - utcDate(vehicle.ts).getTime()) / 1000,
                                ),
                              )}{" "}
                              san əvvəl · {vehicle.speed_kmh} km/saat
                            </small>
                          </span>
                          <b>
                            {Math.ceil(vehicle.eta_minutes)}
                            <small>dəq</small>
                          </b>
                        </button>
                      ))}
                    </div>
                    {currentVehicle &&
                      freshVehicles.some(
                        (v) => v.vehicle_id === currentVehicle.vehicle_id,
                      ) && (
                        <>
                          <p className="j-destination-time">
                            <Clock3 size={16} />
                            Enəcəyin dayanacaqda təxminən{" "}
                            {Math.ceil(currentVehicle.destination_minutes)}{" "}
                            dəqiqə sonra.
                          </p>
                          <div
                            className="j-predictions"
                            aria-label="Avtobusun təxmini gələcək mövqeyi"
                          >
                            {[0, 5, 10, 15].map((minute) => (
                              <button
                                key={minute}
                                aria-pressed={horizon === minute}
                                onClick={() => setHorizon(minute)}
                              >
                                {minute ? `+${minute} dəq` : "İndi"}
                              </button>
                            ))}
                          </div>
                          <p className="j-note">
                            Gələcək mövqelər son 5 dəqiqənin sürətinə əsaslanan
                            təxmindir. Tıxac və dayanma vaxtı dəyişə bilər.
                          </p>
                          {mode === "demo" && (
                            <div className="j-crowd">
                              <span>
                                <Users size={16} />
                                Sıxlığı bildir
                              </span>
                              {[
                                { level: 1, text: "Boş" },
                                { level: 3, text: "Orta" },
                                { level: 5, text: "Dolu" },
                              ].map((item) => (
                                <button
                                  key={item.level}
                                  onClick={() => void report(item.level)}
                                >
                                  {item.text}
                                </button>
                              ))}
                              <p role="status">{reportMessage}</p>
                            </div>
                          )}
                        </>
                      )}
                  </>
                ) : (
                  <div className="j-no-gps">
                    <Clock3 size={24} />
                    <div>
                      <h3>Canlı avtobus mövqeyi yoxdur</h3>
                      <p>
                        {mode === "official"
                          ? "Bu xəttə canlı GPS mənbəyi qoşulmayıb. Yol sxemi rəsmi məlumatdır; plan vaxtına gözləmə daxil deyil."
                          : "Minəcəyin dayanacağa yaxınlaşan təzə GPS-li avtobus görünmür. Başqa dayanacaq seç və ya bir qədər gözlə."}
                      </p>
                    </div>
                  </div>
                )}
              </section>
            )}
          </section>
        </div>
        <p className="j-disclaimer">
          Piyada məsafələri düz xətt üzrə, plan vaxtı 18 km/saat əsasında
          hesablanır. Piyada yolun əlçatanlığı və avtobusun gözləmə vaxtı bu
          hesablamaya daxil deyil.
        </p>
      </main>
      <footer className="p-footer">
        <a className="p-footer-brand" href="#passenger">
          idda.
        </a>
        <span>© {new Date().getFullYear()} IDDA · Bakı üçün birlikdə.</span>
        <a href="https://map.ayna.gov.az/" target="_blank" rel="noreferrer">
          AYNA · məlumat mənbəyi
        </a>
      </footer>
      <dialog
        className="p-dialog p-menu-dialog"
        ref={menu}
        aria-labelledby="j-menu-title"
      >
        <div className="p-dialog-heading">
          <h2 id="j-menu-title">Haraya baxaq?</h2>
          <button
            aria-label="Menyunu bağla"
            onClick={() => menu.current?.close()}
          >
            <X size={22} />
          </button>
        </div>
        <nav>
          <a href="#passenger" onClick={() => menu.current?.close()}>
            <Navigation size={22} />
            Səfərini tap
          </a>
          <a href="#operator" onClick={() => menu.current?.close()}>
            <Users size={22} />
            Operator paneli
          </a>
        </nav>
      </dialog>
    </div>
  );
}
