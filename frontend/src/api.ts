import { apiBase, backendConfigured, backendUnavailableMessage } from './backend';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (!backendConfigured) throw new Error(backendUnavailableMessage);
  const response = await fetch(`${apiBase}${path}`, init);
  if (!response.ok)
    throw new Error(
      response.status === 403
        ? "Bu əməliyyat üçün icazə yoxdur."
        : `Sorğu alınmadı (${response.status}). Yenidən cəhd edin.`,
    );
  return response.json() as Promise<T>;
}
export function utcDate(ts: string): Date {
  return new Date(/Z$|[+-]\d{2}:\d{2}$/.test(ts) ? ts : `${ts}Z`);
}
export function timeLabel(ts: string): string {
  return utcDate(ts).toLocaleTimeString("az-AZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Baku",
  });
}
export const levelText = {
  low: "Rahat",
  medium: "Orta sıxlıq",
  high: "Sıx",
  unknown: "Məlumat yoxdur",
};
export const levelColor = {
  low: "#16835f",
  medium: "#d49322",
  high: "#da5b50",
  unknown: "#8b969d",
};
