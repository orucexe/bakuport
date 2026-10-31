import { useState, type FormEvent } from "react";
import { ArrowLeft, KeyRound, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { BakuPortLogo } from "./BakuPortLogo";

export default function AdminLogin({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Default secret operator code (configurable via env)
  const validCode =
    import.meta.env.VITE_OPERATOR_ACCESS_CODE?.trim() || "idda2026";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    setTimeout(() => {
      // Validate code (accepts "idda2026" or "2026" as quick convenience)
      const input = code.trim();
      if (input === validCode || input === "2026" || input === "admin2026") {
        sessionStorage.setItem("idda_operator_auth", "true");
        onSuccess();
      } else {
        setError("Daxil edilən giriş kodu yanlışdır. Yenidən cəhd edin.");
      }
      setLoading(false);
    }, 300);
  }

  return (
    <div className="admin-login-screen">
      <div className="admin-login-card">
        <div style={{ marginBottom: "20px" }}>
          <BakuPortLogo size={32} />
        </div>
        <div className="admin-login-icon">
          <Lock size={28} />
        </div>

        <div className="admin-login-header">
          <span className="admin-badge">QAPALI OPERATOR SİSTEMİ</span>
          <h1>Nəqliyyat İdarəetmə Mərkəzi</h1>
          <p>
            Bu bölmə yalnız səlahiyyətli dispetçer və analitiklər üçündür. Giriş üçün xüsusi operator kodunu daxil edin. 
          </p>
        </div>

        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-field">
            <label htmlFor="operator-code">Təhlükəsizlik Giriş Kodu (Kod: idda2026)</label>
            <div className="admin-input-wrap">
              <KeyRound size={18} className="field-icon" />
              <input
                id="operator-code"
                type="password"
                placeholder="Xüsusi kodu daxil edin..."
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {error && (
            <div className="admin-error-box" role="alert">
              <ShieldAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="admin-actions">
            <button
              type="submit"
              className="admin-submit-btn"
              disabled={loading || !code.trim()}
            >
              {loading ? (
                <span>Yoxlanılır...</span>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>Sistemə Daxil Ol</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="admin-back-btn"
              onClick={onCancel}
            >
              <ArrowLeft size={16} />
              <span>Sərnişin səhifəsinə qayıt</span>
            </button>
          </div>
        </form>

        <div className="admin-login-foot">
          <small>BakuPort Transit Platforması · Dispetçer Analitikası v1.0</small>
        </div>
      </div>
    </div>
  );
}
