import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowUpRight,
  BusFront,
  CircleHelp,
  LayoutDashboard,
  Radio,
  Route as RouteIcon,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useTransit } from "./useTransit";
import Passenger from "./pages/JourneyPlanner";
import OperatorWorkspace from "./pages/OperatorWorkspace";
import OfficialRoutes from "./pages/OfficialRoutes";
import SourceNotice from "./components/SourceNotice";
import { GoogleMapsProvider } from "./components/GoogleMaps";
import "./style.css";

function App() {
  const transit = useTransit();
  const [page, setPage] = useState<"passenger" | "operator" | "routes">(
    location.hash === "#routes"
      ? "routes"
      : location.hash === "#operator"
        ? "operator"
        : "passenger",
  );
  const [selectedRoute, setSelectedRoute] = useState(1);
  const [help, setHelp] = useState(false);
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 10000);
    const hash = () =>
      setPage(
        location.hash === "#routes"
          ? "routes"
          : location.hash === "#operator"
            ? "operator"
            : "passenger",
      );
    window.addEventListener("hashchange", hash);
    return () => {
      clearInterval(timer);
      window.removeEventListener("hashchange", hash);
    };
  }, []);
  function setRoute(id: number) {
    setSelectedRoute(id);
  }
  if (page === "passenger") {
    return <Passenger transit={transit} />;
  }
  if (page === "operator") {
    return (
      <OperatorWorkspace
        transit={transit}
        selectedRoute={selectedRoute}
        setRoute={setRoute}
      />
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#passenger">
          <span className="brand-mark">
            <RouteIcon size={25} />
          </span>
          <span>
            idda<span className="brand-dot">.</span>
            <small>SMART TRANSIT</small>
          </span>
        </a>
        <div className="workspace-label">İŞ SAHƏSİ</div>
        <nav aria-label="Əsas naviqasiya">
          <a className={page === "routes" ? "active" : ""} href="#routes">
            <RouteIcon size={19} />
            <span>Marşrutlar</span>
            {page === "routes" && <span className="nav-dot" />}
          </a>
          <a href="#passenger">
            <BusFront size={19} />
            <span>Sərnişin</span>
          </a>
          <a href="#operator">
            <LayoutDashboard size={19} />
            <span>Operator</span>
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-info">
            <span className="demo-info-icon">
              <Radio size={20} />
            </span>
            <strong>Şəhər üçün daha ağıllı yol.</strong>
            <p>İctimai nəqliyyatın gələcəyini birlikdə quraq.</p>
            <span>
              IDDA HACKATHON <ArrowUpRight size={12} />
            </span>
          </div>
          <button className="help-button" onClick={() => setHelp((v) => !v)}>
            <CircleHelp size={17} /> Layihə haqqında
          </button>
          <div className="sidebar-footer">
            <span className="avatar">İ</span>
            <div>
              <strong>IDDA Demo</strong>
              <small>İllüstrativ məlumatlar</small>
            </div>
            <span className="tiny-dot low" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            İş sahəsi <span>/</span>
            <strong>
              {page === "routes" ? "Rəsmi marşrutlar" : "Operator paneli"}
            </strong>
          </div>
          <div className="topbar-right">
            <span
              className={`connection ${transit.connected ? "" : "offline"}`}
            >
              {transit.connected ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>
                {transit.connected ? "Canlı bağlantı" : "Yenidən bağlanır…"}
              </span>
            </span>
            <span className="topbar-clock">
              {clock.toLocaleTimeString("az-AZ", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Baku",
              })}
              <small>AZT</small>
            </span>
            <span className="top-avatar">İD</span>
          </div>
        </header>
        <main className="page-content">
          {help && (
            <section className="about-banner" role="status">
              <Activity size={19} />
              <p>
                <strong>Smart Transit & Crowdsourcing Engine.</strong>{" "}
                Dayanacaqlar və gündəlik gediş statistikası OpenData.az
                mənbələrindəndir. GPS və sıxlıq simulatorla yaradılır. DEMO
                xətləri yalnız sınaq üçündür; rəsmi marşrut-dayanacaq
                ardıcıllığı təqdim edilmir.
              </p>
              <button
                onClick={() => setHelp(false)}
                aria-label="Məlumatı bağla"
              >
                ×
              </button>
            </section>
          )}
          {transit.error && (
            <div className="error-banner" role="alert">
              <span>{transit.error}</span>
              <button onClick={() => void transit.refresh()}>
                Yenidən yoxla
              </button>
            </div>
          )}
          <SourceNotice info={transit.sources} />
          {transit.loading ? (
            <div className="initial-loading">
              <span className="loading-orbit" />
              <h2>Şəbəkəyə qoşuluruq…</h2>
              <p>Canlı nəqliyyat məlumatları hazırlanır.</p>
            </div>
          ) : !transit.routes.length ? (
            <div className="initial-loading">
              <WifiOff size={35} />
              <h2>Məlumat əldə edilmədi</h2>
              <p>Backend bağlantısını yoxlayın.</p>
              <button
                className="primary-button"
                onClick={() => void transit.refresh()}
              >
                Yenidən cəhd et
              </button>
            </div>
          ) : (
            <OfficialRoutes />
          )}
          <footer className="page-footer">
            <span>© {new Date().getFullYear()} IDDA · Smart Transit</span>
            <span>
              <i />
              OpenData.az məlumatları · GPS və sıxlıq simulyasiyası
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <GoogleMapsProvider>
    <App />
  </GoogleMapsProvider>,
);
