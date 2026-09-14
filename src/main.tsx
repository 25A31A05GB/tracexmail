import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Global handler for Vite dynamic chunk preload errors across all deployments
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[TraceXMail] Vite preload chunk error caught. Refreshing to sync latest enclave bundle...', event);
    const lastReload = sessionStorage.getItem('tracexmail_preload_reload');
    const now = Date.now();
    if (!lastReload || now - Number(lastReload) > 15000) {
      sessionStorage.setItem('tracexmail_preload_reload', String(now));
      window.location.reload();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reasonMsg = String(event?.reason?.message || event?.reason || '');
    if (
      reasonMsg.includes('Failed to fetch dynamically imported module') ||
      reasonMsg.includes('Importing a module script failed') ||
      reasonMsg.includes('error loading dynamically imported module') ||
      reasonMsg.includes('ChunkLoadError')
    ) {
      console.warn('[TraceXMail] Unhandled dynamic module rejection detected. Triggering auto-recovery...');
      const lastReload = sessionStorage.getItem('tracexmail_unhandled_chunk_reload');
      const now = Date.now();
      if (!lastReload || now - Number(lastReload) > 15000) {
        sessionStorage.setItem('tracexmail_unhandled_chunk_reload', String(now));
        window.location.reload();
      }
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

