/**
 * Resolves the appropriate WebSocket URL for real-time endpoints.
 * Handles production Render backends, Vercel deployments, custom VITE_WS_URL, and local development.
 */
export function getWebSocketUrl(path: string = '/ws/alerts'): string {
  if (typeof window === 'undefined') {
    return `ws://localhost:3000${path.startsWith('/') ? path : '/' + path}`;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // 1. Prioritize explicitly configured VITE_WS_URL
  const envWsUrl = (import.meta as any).env?.VITE_WS_URL;
  if (typeof envWsUrl === 'string' && envWsUrl.trim() !== '') {
    const trimmed = envWsUrl.trim();
    if (trimmed.endsWith('/ws/alerts') && normalizedPath !== '/ws/alerts') {
      return trimmed.replace(/\/ws\/alerts$/, normalizedPath);
    }
    if (!trimmed.includes(normalizedPath) && !trimmed.endsWith('/ws/alerts')) {
      const base = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
      return `${base}${normalizedPath}`;
    }
    return trimmed;
  }

  // 2. Production Vercel deployment: connect to Render backend
  const isVercel = window.location.host.includes('vercel.app');
  if (isVercel) {
    return `wss://tracexmail-l6c7.onrender.com${normalizedPath}`;
  }

  // 3. Same-origin fallback for local dev or standard fullstack containers
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${normalizedPath}`;
}
