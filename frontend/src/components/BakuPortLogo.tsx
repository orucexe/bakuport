export function BakuPortIcon({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="9" fill="#0f172a" />
      {/* Dynamic port arc connecting nodes */}
      <path
        d="M8 22C8 14.268 14.268 8 22 8"
        stroke="#ff385c"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="22" cy="8" r="3.5" fill="#ff385c" />
      <path
        d="M10 24H21C22.6569 24 24 22.6569 24 21V13"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="24" r="2.5" fill="#ffffff" />
    </svg>
  );
}

export function BakuPortLogo({
  size = 28,
  compact = false,
  className = "",
  light = false,
}: {
  size?: number;
  compact?: boolean;
  className?: string;
  light?: boolean;
}) {
  return (
    <div
      className={`bakuport-brand ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        textDecoration: "none",
        fontWeight: 700,
        letterSpacing: "-0.5px",
        color: light ? "#ffffff" : "#0f172a",
        fontSize: size ? size * 0.72 : 20,
      }}
    >
      <BakuPortIcon size={size} />
      {!compact && (
        <span className="bakuport-name" style={{ lineHeight: 1 }}>
          <span style={{ fontWeight: 500, color: light ? "#e2e8f0" : "#334155" }}>baku</span>
          <span style={{ fontWeight: 800, color: light ? "#ffffff" : "#0f172a" }}>port</span>
          <span style={{ color: "#ff385c" }}>.</span>
        </span>
      )}
    </div>
  );
}
