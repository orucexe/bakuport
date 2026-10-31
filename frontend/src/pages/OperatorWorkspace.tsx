import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Database,
  Layers,
  LogOut,
  Menu,
  RefreshCw,
  Route,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import Operator from "./Operator";
import SourceNotice from "../components/SourceNotice";
import { BakuPortLogo } from "../components/BakuPortLogo";
import type { Transit } from "../useTransit";
import "./operator.css";

export default function OperatorWorkspace({
  transit,
  selectedRoute,
  setRoute,
  onLogout,
}: {
  transit: Transit;
  selectedRoute: number;
  setRoute: (id: number) => void;
  onLogout?: () => void;
}) {
  const [active, setActive] = useState("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [clock, setClock] = useState(new Date());
  const menu = useRef<HTMLDialogElement>(null);
  const sources = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);
  const sections = [
    { id: "overview", label: "Ümumi baxış" },
    { id: "network", label: "Şəbəkə" },
    { id: "analytics", label: "Analitika" },
    { id: "alerts", label: `Xəbərdarlıqlar (${transit.alerts.length})` },
    { id: "ridership", label: "Gedişlər" },
  ];
  function navigate(id: string) {
    setActive(id);
    menu.current?.close();
    document.getElementById(`a-${id}`)?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }
  async function refresh() {
    setRefreshing(true);
    try {
      await transit.refresh();
    } finally {
      setRefreshing(false);
    }
  }
  return (
    <div className="operator-app">
      <a
        className="a-skip"
        href="#operator-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("operator-content")?.focus();
        }}
      >
        Əsas məzmuna keç
      </a>
      <header className="a-header">
        <a
          className="a-brand"
          href="#admin"
          aria-label="BakuPort operator ana səhifə"
          style={{ textDecoration: "none" }}
        >
          <BakuPortLogo size={26} />
        </a>
        <span className="a-workspace-name">Nəqliyyat Əməliyyatları</span>
        <div className="a-header-actions">
          <span
            className={`a-connection ${transit.connected ? "" : "offline"}`}
          >
            {transit.connected ? <Wifi size={15} /> : <WifiOff size={15} />}
            <span>
              {transit.connected ? "Canlı bağlantı" : "Yenidən bağlanır…"}
            </span>
          </span>
          <button
            className="a-icon-button"
            onClick={() => void refresh()}
            disabled={refreshing || transit.loading}
            aria-label="Operator məlumatlarını yenilə"
          >
            <RefreshCw size={17} className={refreshing ? "a-spinning" : ""} />
          </button>
          <a className="a-passenger-link" href="#passenger">
            Sərnişin ekranı
            <ArrowUpRight size={16} />
          </a>
          {onLogout && (
            <button
              type="button"
              className="a-icon-button"
              onClick={onLogout}
              title="Operator sessiyasından çıxış et"
              aria-label="Operator sessiyasından çıxış et"
              style={{ color: "#ef4444" }}
            >
              <LogOut size={17} />
            </button>
          )}
          <button
            className="a-mobile-menu a-icon-button"
            onClick={() => menu.current?.showModal()}
            aria-label="Operator menyusunu aç"
            aria-haspopup="dialog"
          >
            <Menu size={21} />
          </button>
        </div>
      </header>
      <div className="a-section-nav">
        <nav aria-label="Operator bölmələri">
          {sections.map((section) => (
            <button
              key={section.id}
              aria-current={active === section.id ? "location" : undefined}
              onClick={() => navigate(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>
        <time dateTime={clock.toISOString()}>
          {clock.toLocaleTimeString("az-AZ", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Baku",
          })}{" "}
          AZT
        </time>
      </div>
      <main className="a-content" id="operator-content" tabIndex={-1}>
        <div className="a-scope">
          <span>
            <Route size={16} />
            Real vaxt marşrut telemetriyası və sıxlıq analitikası
          </span>
          <button onClick={() => sources.current?.showModal()}>
            <Database size={15} />
            Rəsmi məlumat mənbələri
            <ArrowUpRight size={14} />
          </button>
        </div>
        {transit.error && (
          <div className="a-error" role="alert">
            <span>{transit.error}</span>
            <button
              className="a-secondary"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              Yenidən yoxla
            </button>
          </div>
        )}
        {transit.loading ? (
          <div className="a-loading" role="status">
            <div />
            <div />
            <p>Şəbəkə məlumatları yüklənir…</p>
          </div>
        ) : !transit.routes.length ? (
          <div className="a-empty">
            <WifiOff size={30} />
            <h1>Şəbəkə məlumatı alınmadı</h1>
            <p>Backend bağlantısını yoxlayıb yenidən cəhd edin.</p>
            <button className="a-primary" onClick={() => void refresh()}>
              Yenidən yoxla
            </button>
          </div>
        ) : (
          <Operator
            transit={transit}
            selectedRoute={selectedRoute}
            setRoute={setRoute}
          />
        )}
      </main>
      <footer className="a-footer">
        <a className="a-brand" href="#admin" style={{ textDecoration: "none" }}>
          <BakuPortLogo size={22} />
        </a>
        <span>© {clock.getFullYear()} BakuPort · Operator iş sahəsi</span>
        <button onClick={() => sources.current?.showModal()}>
          Mənbələr və məlumat sərhədləri
          <ArrowUpRight size={14} />
        </button>
      </footer>
      <dialog
        className="a-dialog a-mobile-sheet"
        ref={menu}
        aria-labelledby="a-menu-title"
      >
        <div className="a-dialog-heading">
          <h2 id="a-menu-title">İş sahəsi</h2>
          <button
            className="a-icon-button"
            onClick={() => menu.current?.close()}
            aria-label="Menyunu bağla"
          >
            <X size={20} />
          </button>
        </div>
        <nav aria-label="Mobil operator bölmələri">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => navigate(section.id)}
              aria-current={active === section.id ? "location" : undefined}
            >
              {section.label}
            </button>
          ))}
          <a href="#passenger" onClick={() => menu.current?.close()}>
            Sərnişin ekranı
            <ArrowUpRight size={16} />
          </a>
        </nav>
      </dialog>
      <dialog
        className="a-dialog a-source-dialog"
        ref={sources}
        aria-labelledby="a-source-title"
      >
        <div className="a-dialog-heading">
          <h2 id="a-source-title">Məlumat mənbələri</h2>
          <button
            className="a-icon-button"
            aria-label="Mənbə pəncərəsini bağla"
            onClick={() => sources.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <p>
          Canlı mövqelər, sıxlıq analitikası və proqnozlar Bakı şəhəri üzrə operativ
          nəqliyyat telemetriyasına və rəsmi daşıyıcı məlumatlarına əsaslanır.
        </p>
        <SourceNotice info={transit.sources} />
      </dialog>
    </div>
  );
}
