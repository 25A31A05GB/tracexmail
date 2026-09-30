import { useEffect, useRef, useState } from 'react';

interface ScrollRevealOptions {
  threshold?: number;
  delay?: number;
  once?: boolean;
}

export function useScrollReveal({
  threshold = 0.15,
  delay = 0,
  once = true,
}: ScrollRevealOptions = {}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !ref.current) return;

    // Respect prefers-reduced-motion: reveal immediately
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay > 0) {
            const timer = setTimeout(() => {
              setIsVisible(true);
            }, delay);
            if (once) observer.disconnect();
            return () => clearTimeout(timer);
          } else {
            setIsVisible(true);
            if (once) observer.disconnect();
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [threshold, delay, once]);

  return { ref, isVisible };
}

/**
 * Helper component for Basement Studio-inspired typography / section reveal
 */
export function RevealBlock({
  children,
  className = '',
  delay = 0,
  stagger = false,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: boolean;
}) {
  const { ref, isVisible } = useScrollReveal({ delay, threshold: 0.1 });

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-4 scale-[0.99] pointer-events-none'
      } ${className}`}
    >
      {children}
    </div>
  );
}
