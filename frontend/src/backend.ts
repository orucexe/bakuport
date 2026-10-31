const configuredBackend = import.meta.env.VITE_BACKEND_URL?.trim().replace(/\/$/, '') || '';
export const backendConfigured = !import.meta.env.PROD || !!configuredBackend || import.meta.env.VITE_ALLOW_SAME_ORIGIN_API === 'true';
export const backendUnavailableMessage = 'Backend hələ qoşulmayıb. Səfər axtarışı və canlı məlumatlar API yayımlandıqdan sonra aktiv olacaq.';
export const apiBase = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') || configuredBackend || '/api';
export function liveSocketUrl(): string {
  if (configuredBackend) {
    const url = new URL(configuredBackend);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = `${url.pathname.replace(/\/$/, '')}/ws/live`;
    return url.toString();
  }
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/live`;
}
