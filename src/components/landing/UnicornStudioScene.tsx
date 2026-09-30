import React, { useEffect, useRef, useState } from 'react';

interface UnicornStudioSceneProps {
  projectId?: string;
  className?: string;
}

export function UnicornStudioScene({
  className = '',
}: UnicornStudioSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const mouseTargetRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });

  // Detect prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(media.matches);

      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, []);

  // Responsive interactive canvas animation
  useEffect(() => {
    if (reducedMotion || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let isVisible = true;
    let startTime = performance.now();

    const resize = () => {
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(rect.width * dpr);
      const h = Math.floor(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = Math.max(300, w);
        canvas.height = Math.max(300, h);
      }
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          isVisible = e.isIntersecting;
        });
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    // Cryptographic Matrix Particle Nodes
    const particleCount = 45;
    const particles = Array.from({ length: particleCount }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 60 + Math.random() * 120,
      speed: (0.15 + Math.random() * 0.4) * (Math.random() > 0.5 ? 1 : -1),
      size: 1.2 + Math.random() * 2,
      color: Math.random() > 0.6 ? '#c9a227' : Math.random() > 0.3 ? '#b23a2e' : '#22c55e',
      pulseSpeed: 1 + Math.random() * 2,
    }));

    const render = () => {
      if (isVisible && ctx && canvas) {
        const now = performance.now();
        const t = (now - startTime) * 0.001;
        const w = canvas.width;
        const h = canvas.height;
        const cx = w * 0.5;
        const cy = h * 0.5;

        // Smooth mouse interpolation
        mousePos.x += (mouseTargetRef.current.x - mousePos.x) * 0.05;
        mousePos.y += (mouseTargetRef.current.y - mousePos.y) * 0.05;

        ctx.clearRect(0, 0, w, h);

        const offsetX = (mousePos.x - 0.5) * 40;
        const offsetY = (mousePos.y - 0.5) * 40;
        const centerX = cx + offsetX;
        const centerY = cy + offsetY;

        // 1. Ambient holographic radial glow
        const glowRadius = Math.min(w, h) * 0.45;
        const glow = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, glowRadius);
        glow.addColorStop(0, 'rgba(201, 162, 39, 0.12)');
        glow.addColorStop(0.4, 'rgba(178, 58, 46, 0.06)');
        glow.addColorStop(1, 'rgba(20, 18, 15, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // 2. Outer Cryptographic Orbit Ring
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(t * 0.08);

        ctx.strokeStyle = 'rgba(201, 162, 39, 0.22)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([8, 12]);
        ctx.beginPath();
        ctx.arc(0, 0, Math.min(w, h) * 0.38, 0, Math.PI * 2);
        ctx.stroke();

        // 3. Middle Crimson Verification Orbit Ring
        ctx.rotate(-t * 0.18);
        ctx.strokeStyle = 'rgba(178, 58, 46, 0.28)';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, Math.min(w, h) * 0.26, 0, Math.PI * 2);
        ctx.stroke();

        // 4. Inner Emerald Hash Ring
        ctx.rotate(t * 0.25);
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, Math.min(w, h) * 0.16, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();

        // 5. Constellation Nodes & Connectors
        const scale = Math.min(w, h) / 400;
        particles.forEach((p, idx) => {
          const currentAngle = p.angle + t * p.speed * 0.5;
          const currentRadius = p.radius * scale;
          const px = centerX + Math.cos(currentAngle) * currentRadius;
          const py = centerY + Math.sin(currentAngle) * (currentRadius * 0.75); // Elliptical 3D perspective

          // Pulsing node
          const alpha = 0.4 + Math.sin(t * p.pulseSpeed + idx) * 0.3;
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0.1, Math.min(1, alpha));
          ctx.beginPath();
          ctx.arc(px, py, p.size * scale, 0, Math.PI * 2);
          ctx.fill();

          // Connect nearby nodes with forensic line
          for (let j = idx + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const p2Angle = p2.angle + t * p2.speed * 0.5;
            const p2Radius = p2.radius * scale;
            const p2x = centerX + Math.cos(p2Angle) * p2Radius;
            const p2y = centerY + Math.sin(p2Angle) * (p2Radius * 0.75);

            const dx = px - p2x;
            const dy = py - p2y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 75 * scale) {
              ctx.strokeStyle = p.color;
              ctx.globalAlpha = (1 - dist / (75 * scale)) * 0.15;
              ctx.lineWidth = 0.8;
              ctx.setLineDash([]);
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.lineTo(p2x, p2y);
              ctx.stroke();
            }
          }
        });

        ctx.globalAlpha = 1.0;
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      observer.disconnect();
      cancelAnimationFrame(animId);
    };
  }, [reducedMotion]);

  // Subtle interactive parallax on mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    mouseTargetRef.current = { x, y };
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative w-full h-full overflow-hidden select-none pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block opacity-85 transition-opacity duration-1000"
      />

      {/* Atmospheric depth vignette to protect foreground typography */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#14120f] via-transparent to-[#14120f]/60" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#14120f]/80 via-transparent to-[#14120f]/80" />
    </div>
  );
}
