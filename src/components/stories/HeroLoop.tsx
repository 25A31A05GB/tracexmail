import React, { useEffect, useRef, useState } from 'react';
import { getHeroLoopUrls } from '../../utils/storiesManifest';

interface HeroLoopProps {
  className?: string;
}

export function HeroLoop({ className = '' }: HeroLoopProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [canAutoplay, setCanAutoplay] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [videoFailed, setVideoFailed] = useState<boolean>(false);

  const { videoUrl, posterUrl } = getHeroLoopUrls();

  useEffect(() => {
    // 1. Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 2. Check navigator.connection.saveData
    const isSaveData =
      typeof navigator !== 'undefined' && Boolean((navigator as any).connection?.saveData);

    if (prefersReducedMotion || isSaveData) {
      setCanAutoplay(false);
      return;
    }

    setCanAutoplay(true);
  }, []);

  useEffect(() => {
    if (!canAutoplay) return;

    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [canAutoplay]);

  // Ambient Canvas Cyber Loop (runs smoothly when video is unavailable or loading)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let tick = 0;

    // Particle nodes for forensic mesh
    const nodes = Array.from({ length: 24 }, () => ({
      x: Math.random() * 800,
      y: Math.random() * 400,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 1
    }));

    const render = () => {
      const w = (canvas.width = canvas.offsetWidth || 800);
      const h = (canvas.height = canvas.offsetHeight || 400);

      ctx.fillStyle = '#100e0c';
      ctx.fillRect(0, 0, w, h);

      // Subtle grid
      ctx.strokeStyle = 'rgba(58, 53, 44, 0.2)';
      ctx.lineWidth = 1;
      const step = 40;
      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Update & draw particle mesh
      tick += 0.01;
      ctx.fillStyle = '#c9a227';
      nodes.forEach((n, i) => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();

        // Connect nearby nodes
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dist = Math.hypot(n.x - n2.x, n.y - n2.y);
          if (dist < 110) {
            ctx.strokeStyle = `rgba(201, 162, 39, ${0.2 * (1 - dist / 110)})`;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();
          }
        }
      });

      // Ambient radar scan line
      const scanX = (Math.sin(tick) * 0.5 + 0.5) * w;
      ctx.strokeStyle = 'rgba(201, 162, 39, 0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(scanX, 0);
      ctx.lineTo(scanX, h);
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isVisible]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      {/* Dynamic Animated Ambient Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen"
      />

      {/* Video Element if physical MP4 stream exists */}
      {canAutoplay && !videoFailed && (
        <video
          ref={videoRef}
          src={videoUrl}
          poster={posterUrl}
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 w-full h-full object-cover opacity-45 mix-blend-screen filter saturate-120"
        />
      )}

      {/* Subtle Vignette & Grain Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#100e0c] via-transparent to-[#100e0c]/60" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#100e0c] via-transparent to-[#100e0c]" />
    </div>
  );
}
