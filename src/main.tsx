import * as Sentry from "@sentry/react";
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

Sentry.init({
  dsn: "https://9992e15f5960d46b12aafc1481677cfe@o4512227424534528.ingest.us.sentry.io/4512227431809024"
});

// Register Service Worker for offline forensics asset caching and instant updates in production
if (import.meta.env.PROD && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const updateSW = registerSW({
    onNeedRefresh() {
      console.log('[TraceXMail ServiceWorker] New forensic engine build available. Ready for hot-reload.');
      updateSW(true);
    },
    onOfflineReady() {
      console.log('[TraceXMail ServiceWorker] Essential offline assets cached. Offline investigation mode engaged.');
    },
    onRegisterError(error) {
      console.warn('[TraceXMail ServiceWorker] Registration notice:', error);
    }
  });
}

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

const container = document.getElementById("app") || document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

