import { useEffect, useState } from "react";
import {
  AlertCircle,
  BusFront,
  CheckCircle2,
  Clock,
  Send,
  Smile,
  Users,
  Zap,
} from "lucide-react";
import { api } from "../api";

const COOLDOWN_SECONDS = 120; // 2 minutes cooldown
const STORAGE_KEY = "bakuport_last_crowd_report_ts";

export default function CrowdReportCard({
  defaultRouteCode = "",
  className = "",
}: {
  defaultRouteCode?: string;
  className?: string;
}) {
  const [routeNumber, setRouteNumber] = useState(defaultRouteCode);
  const [level, setLevel] = useState<1 | 3 | 5>(1); // 1 = Asan, 3 = Orta, 5 = Yüksək
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Cooldown countdown state in seconds
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return 0;
      const elapsed = Math.floor((Date.now() - Number(saved)) / 1000);
      return elapsed < COOLDOWN_SECONDS ? COOLDOWN_SECONDS - elapsed : 0;
    } catch {
      return 0;
    }
  });

  // Sync default route code if changed
  useEffect(() => {
    if (defaultRouteCode && !routeNumber) {
      setRouteNumber(defaultRouteCode);
    }
  }, [defaultRouteCode]);

  // Tick timer for 2-minute cooldown
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const timer = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  // Format mm:ss
  function formatCooldown(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  async function handleSendReport(e: React.FormEvent) {
    e.preventDefault();
    if (cooldownRemaining > 0) return;

    const busCode = routeNumber.trim();
    if (!busCode) {
      setMessage({ text: "Zəhmət olmasa avtobusun nömrəsini daxil edin.", type: "error" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await api("/crowd-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route_code: busCode,
          level: level,
        }),
      });

      // Save timestamp for 2-minute cooldown
      const now = Date.now();
      try {
        localStorage.setItem(STORAGE_KEY, String(now));
      } catch {
        // Ignore storage errors
      }
      setCooldownRemaining(COOLDOWN_SECONDS);

      const levelTitle = level === 1 ? "Asan / Rahat" : level === 3 ? "Orta Sıxlıq" : "Yüksək Sıxlıq";
      setMessage({
        text: `Təşəkkür edirik! № ${busCode} avtobusu üçün "${levelTitle}" rəyiniz qəbul edildi.`,
        type: "success",
      });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Rəy göndərilmədi. Zəhmət olmasa yenidən cəhd edin.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  const isBlocked = cooldownRemaining > 0;

  return (
    <div className={`crowd-report-box ${className}`}>
      <div className="crowd-header">
        <div className="crowd-header-title">
          <Users size={20} className="crowd-title-icon" />
          <div>
            <h3>Avtobusda Sıxlıq Səviyyəsini Bildir</h3>
            <p>Digər sərnişinlərin və nəqliyyat orqanlarının məlumatlanmasına töhfə verin</p>
          </div>
        </div>

        {isBlocked && (
          <div className="cooldown-pill" title="2 dəqiqəlik donma limiti aktivdir">
            <Clock size={15} />
            <span>Növbəti rəy: <strong>{formatCooldown(cooldownRemaining)}</strong></span>
          </div>
        )}
      </div>

      <form onSubmit={handleSendReport} className="crowd-form">
        {/* Bus number input */}
        <div className="crowd-input-group">
          <label htmlFor="crowd-bus-code">Avtobus Nömrəsi</label>
          <div className="crowd-bus-field">
            <BusFront size={18} className="field-bus-icon" />
            <input
              id="crowd-bus-code"
              type="text"
              placeholder="Məsələn: 62, 1, 14, 175, 88..."
              value={routeNumber}
              onChange={(e) => setRouteNumber(e.target.value)}
              disabled={isBlocked || loading}
              required
            />
          </div>
        </div>

        {/* Density Level Buttons: Asan, Orta, Yüksək */}
        <div className="crowd-levels-group">
          <span className="levels-label">Mövcud Sıxlıq Səviyyəsi</span>
          <div className="crowd-level-options">
            {/* Level 1: Asan / Rahat */}
            <button
              type="button"
              className={`crowd-lvl-btn easy ${level === 1 ? "active" : ""}`}
              onClick={() => setLevel(1)}
              disabled={isBlocked || loading}
            >
              <div className="lvl-dot easy-dot" />
              <div className="lvl-content">
                <strong>Asan</strong>
                <small>Boş yerlər çoxdur</small>
              </div>
            </button>

            {/* Level 3: Orta */}
            <button
              type="button"
              className={`crowd-lvl-btn medium ${level === 3 ? "active" : ""}`}
              onClick={() => setLevel(3)}
              disabled={isBlocked || loading}
            >
              <div className="lvl-dot medium-dot" />
              <div className="lvl-content">
                <strong>Orta</strong>
                <small>Oturacaqlar doludur</small>
              </div>
            </button>

            {/* Level 5: Yüksək */}
            <button
              type="button"
              className={`crowd-lvl-btn high ${level === 5 ? "active" : ""}`}
              onClick={() => setLevel(5)}
              disabled={isBlocked || loading}
            >
              <div className="lvl-dot high-dot" />
              <div className="lvl-content">
                <strong>Yüksək</strong>
                <small>Tam doludur, çox sıx</small>
              </div>
            </button>
          </div>
        </div>

        {/* Status / Error Message */}
        {message && (
          <div className={`crowd-msg-box ${message.type}`}>
            {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Submit button & Cooldown banner */}
        <div className="crowd-actions-row">
          <button
            type="submit"
            className="crowd-submit-btn"
            disabled={isBlocked || loading || !routeNumber.trim()}
          >
            {loading ? (
              <span>Göndərilir...</span>
            ) : isBlocked ? (
              <>
                <Clock size={16} />
                <span>Gözləmə rejimi ({formatCooldown(cooldownRemaining)})</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>Sıxlıq Rəyini Göndər</span>
              </>
            )}
          </button>

          {isBlocked && (
            <p className="cooldown-notice">
              Hər rəydən sonra məlumat dəqiqliyi üçün <strong>2 dəqiqəlik</strong> fasilə limiti tətbiq olunur.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
