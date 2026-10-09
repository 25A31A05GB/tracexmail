/**
 * Google Analytics 4 (GA4) Lightweight Client Integration
 * Handles virtual pageviews and SOC event diagnostics without blocking thread.
 */

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

export const GA_MEASUREMENT_ID = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GA_MEASUREMENT_ID) || 'G-TRACEXMAIL1';

/**
 * Tracks virtual SPA pageview transitions for SEO & traffic source attribution
 */
export function trackPageView(path: string, title?: string): void {
  if (typeof window === 'undefined') return;

  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_title: title || document.title,
        page_location: window.location.href,
        page_path: path
      });
    }
  } catch (err) {
    // Non-blocking fail-safe
  }
}

/**
 * Tracks custom security interaction events
 */
export function trackEvent(action: string, category: string, label?: string, value?: number): void {
  if (typeof window === 'undefined') return;

  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', action, {
        event_category: category,
        event_label: label,
        value: value
      });
    }
  } catch (err) {
    // Non-blocking fail-safe
  }
}
