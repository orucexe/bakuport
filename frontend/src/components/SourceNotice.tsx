import { Database, ExternalLink } from "lucide-react";
import type { SourceInfo } from "../types";

export default function SourceNotice({ info }: { info: SourceInfo | null }) {
  if (!info?.sources.some((source) => source.row_count)) return null;
  return (
    <section className="source-notice" aria-label="Məlumat mənbələri">
      <Database size={20} aria-hidden="true" />
      <div>
        <strong>Rəsmi açıq məlumatlarla zənginləşdirilib</strong>
        <p>
          {info.sources
            .find((s) => s.key === "stops")
            ?.row_count.toLocaleString("az-AZ")}{" "}
          real dayanacaq ·{" "}
          {info.sources
            .find((s) => s.key === "ridership")
            ?.row_count.toLocaleString("az-AZ")}{" "}
          marşrut/gün qeydi.
        </p>
        <p>
          GPS və sıxlıq simulyasiyadır. DEMO xətləri rəsmi BakuBus marşrutları
          deyil.
        </p>
      </div>
      <div className="source-links">
        <a href="#routes">AYNA · Rəsmi marşrutlara bax</a>
        {info.sources.map((source) => (
          <a
            href={source.dataset_url}
            key={source.key}
            target="_blank"
            rel="noreferrer"
          >
            {source.key === "stops"
              ? "Dayanacaq mənbəyi"
              : "Gediş sayı mənbəyi"}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
}
