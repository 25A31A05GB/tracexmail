import { useEffect, useRef } from 'react';
import Lenis from 'lenis';

interface LenisOptions {
  enabled?: boolean;
}

export function useLenisScroll({ enabled = true }: LenisOptions = {}) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      // Respect accessibility: do not enable smooth scroll hijacking for users who prefer reduced motion
      return;
    }

    try {
      const lenis = new Lenis({
        duration: 1.1,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1.0,
        touchMultiplier: 1.2,
        infinite: false,
      });

      lenisRef.current = lenis;

      let rafId: number;
      const raf = (time: number) => {
        lenis.raf(time);
        rafId = requestAnimationFrame(raf);
      };

      rafId = requestAnimationFrame(raf);

      // Handle internal anchor links and button navigation cleanly
      const handleAnchorClick = (e: MouseEvent) => {
        const target = (e.target as HTMLElement).closest('a[href^="#"], button[data-scroll-to], [data-scroll-to], button[data-target]');
        if (!target) return;

        let targetId = '';
        if (target.tagName.toLowerCase() === 'a') {
          const href = target.getAttribute('href');
          if (href && href.startsWith('#') && href.length > 1) {
            targetId = href.slice(1);
          }
        } else {
          targetId = target.getAttribute('data-scroll-to') || target.getAttribute('data-target') || '';
        }

        if (targetId) {
          const cleanId = targetId.replace(/^#/, '');
          const targetEl = document.getElementById(cleanId) || document.querySelector(`#${cleanId}`) || document.querySelector(targetId);
          if (targetEl) {
            e.preventDefault();
            lenis.scrollTo(targetEl, {
              offset: -72,
              duration: 1.2,
            });
          }
        }
      };

      document.addEventListener('click', handleAnchorClick, { passive: false });

      return () => {
        document.removeEventListener('click', handleAnchorClick);
        cancelAnimationFrame(rafId);
        lenis.destroy();
        lenisRef.current = null;
      };
    } catch (err) {
      console.warn('[TraceXMail] Lenis smooth scroll initialization skipped:', err);
    }
  }, [enabled]);

  const scrollTo = (target: string | HTMLElement, offset: number = -72) => {
    if (lenisRef.current) {
      if (typeof target === 'string') {
        const cleanId = target.replace(/^#/, '');
        const targetEl = document.getElementById(cleanId) || document.querySelector(`#${cleanId}`) || (target.startsWith('.') ? document.querySelector(target) : null);
        if (targetEl) {
          lenisRef.current.scrollTo(targetEl, { offset, duration: 1.1 });
        } else {
          try {
            lenisRef.current.scrollTo(target.startsWith('#') ? target : `#${target}`, { offset, duration: 1.1 });
          } catch {
            const el = document.getElementById(cleanId);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }
        }
      } else if (target instanceof HTMLElement) {
        lenisRef.current.scrollTo(target, { offset, duration: 1.1 });
      }
    } else {
      if (typeof target === 'string') {
        const cleanId = target.replace(/^#/, '');
        const el = document.getElementById(cleanId) || document.querySelector(`#${cleanId}`);
        if (el) {
          const top = el.getBoundingClientRect().top + window.pageYOffset + offset;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      } else if (target instanceof HTMLElement) {
        const top = target.getBoundingClientRect().top + window.pageYOffset + offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }
  };

  return {
    lenis: lenisRef.current,
    scrollTo,
  };
}
