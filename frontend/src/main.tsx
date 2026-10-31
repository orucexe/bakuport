import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowUpRight,
  BusFront,
  CircleHelp,
  Radio,
  Route as RouteIcon,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useTransit } from "./useTransit";
import Passenger from "./pages/JourneyPlanner";
import OperatorWorkspace from "./pages/OperatorWorkspace";
import OfficialRoutes from "./pages/OfficialRoutes";
import AdminLogin from "./components/AdminLogin";
import SourceNotice from "./components/SourceNotice";
import { GoogleMapsProvider } from "./components/GoogleMaps";
import { BakuPortLogo } from "./components/BakuPortLogo";
import "./style.css";

function App() {
  const transit = useTransit();

  // Helper to determine active page
  function getActivePage(): "passenger" | "admin" | "routes" {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    if (
      path === "/admin" ||
      path.startsWith("/admin/") ||
      hash === "#admin" ||
      hash === "#operator"
    ) {
      return "admin";
    }
    if (hash === "#routes") {
      return "routes";
    }
    return "passenger";
  }

  const [page, setPage] = useState<"passenger" | "admin" | "routes">(getActivePage);
  const [isAdminAuth, setIsAdminAuth] = useState(
    () => sessionStorage.getItem("idda_operator_auth") === "true",
  );
  const [selectedRoute, setSelectedRoute] = useState(1);
  const [help, setHelp] = useState(false);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 10000);
    const syncRoute = () => {
      setPage(getActivePage());
      setIsAdminAuth(sessionStorage.getItem("idda_operator_auth") === "true");
    };

    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => {
      clearInterval(timer);
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  function setRoute(id: number) {
    setSelectedRoute(id);
  }

  function handleLogout() {
    sessionStorage.removeItem("idda_operator_auth");
    setIsAdminAuth(false);
    if (window.location.pathname.startsWith("/admin")) {
      window.history.pushState(null, "", "/");
    }
    window.location.hash = "#passenger";
    setPage("passenger");
  }

  function handleAdminSuccess() {
    sessionStorage.setItem("idda_operator_auth", "true");
    setIsAdminAuth(true);
  }

  function handleAdminCancel() {
    if (window.location.pathname.startsWith("/admin")) {
      window.history.pushState(null, "", "/");
    }
    window.location.hash = "#passenger";
    setPage("passenger");
  }

  // Admin / Operator protected route
  if (page === "admin") {
    if (!isAdminAuth) {
      return (
        <AdminLogin
          onSuccess={handleAdminSuccess}
          onCancel={handleAdminCancel}
        />
      );
    }
    return (
      <OperatorWorkspace
        transit={transit}
        selectedRoute={selectedRoute}
        setRoute={setRoute}
        onLogout={handleLogout}
      />
    );
  }

  // Default: Passenger app
  if (page === "passenger") {
    return <Passenger transit={transit} />;
  }

  // Official routes browser view
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#passenger" style={{ textDecoration: "none" }}>
          <BakuPortLogo size={28} light />
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
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-info">
            <span className="demo-info-icon">
              <Radio size={20} />
            </span>
            <strong>Şəhər üçün daha ağıllı yol.</strong>
            <p>İctimai nəqliyyatın gələcəyini birlikdə quraq.</p>
            <span>
              BAKUPORT TRANSIT <ArrowUpRight size={12} />
            </span>
          </div>
          <button className="help-button" onClick={() => setHelp((v) => !v)}>
            <CircleHelp size={17} /> Layihə haqqında
          </button>
          <div className="sidebar-footer">
            <span className="avatar">B</span>
            <div>
              <strong>BakuPort</strong>
              <small>v1.0 · Bakı İctimai Nəqliyyat</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="brand-mobile">
            <BakuPortLogo size={22} light />
          </div>
          <div className="live-clock">
            <span className="live-dot" />
            <span>
              {clock.toLocaleTimeString("az-AZ", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                timeZone: "Asia/Baku",
              })}{" "}
              AZT
            </span>
          </div>
          <div className="topbar-actions">
            <div className={`status-pill ${transit.connected ? "connected" : "reconnecting"}`}>
              {transit.connected ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>{transit.connected ? "Canlı şəbəkə" : "Bağlantı kəsildi"}</span>
            </div>
            <button className="pill-button" onClick={() => setHelp(true)}>
              <Activity size={14} />
              <span>Haqqında</span>
            </button>
          </div>
        </header>
        <main className="content">
          <OfficialRoutes />
        </main>
      </div>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>BakuPort Transit Haqqında</h2>
              <button className="modal-close" onClick={() => setHelp(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Bu platforma Bakı şəhəri üzrə ictimai nəqliyyatın real vaxt
                rejimində idarə edilməsi, sərnişin sıxlığının təhlili və səyahət
                planlaşdırılması üçün hazırlanmışdır.
              </p>
              <SourceNotice info={transit.sources} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <GoogleMapsProvider>
      <App />
    </GoogleMapsProvider>,
  );
}
