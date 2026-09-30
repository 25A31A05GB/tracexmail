import React, { useState, useEffect, useRef } from 'react';
import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas';
import { ShieldCheck, Activity, Lock, RefreshCw, Cpu } from 'lucide-react';

interface RiveInteractiveVisualProps {
  className?: string;
  onInteract?: () => void;
}

export function RiveInteractiveVisual({ className = '', onInteract }: RiveInteractiveVisualProps) {
  const [loadError, setLoadError] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [activeMode, setActiveMode] = useState<'provenance' | 'cryptographic' | 'asn'>('provenance');
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(true);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(media.matches);

      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, []);

  // IntersectionObserver to pause/play when visible
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Initialize Rive with local verified asset
  const { rive, RiveComponent } = useRive({
    src: '/assets/sample.riv',
    autoplay: !reducedMotion && isVisible,
    layout: new Layout({
      fit: Fit.Contain,
      alignment: Alignment.Center,
    }),
    onLoadError: () => {
      setLoadError(true);
    },
  });

  // Pause Rive when off-screen or in reduced-motion mode
  useEffect(() => {
    if (!rive) return;
    if (reducedMotion || !isVisible) {
      rive.pause();
    } else {
      rive.play();
    }
  }, [rive, reducedMotion, isVisible]);

  const handleContainerClick = () => {
    if (onInteract) onInteract();
    // Toggle telemetry inspection mode
    setActiveMode(prev => {
      if (prev === 'provenance') return 'cryptographic';
      if (prev === 'cryptographic') return 'asn';
      return 'provenance';
    });
  };

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="region"
      aria-label="Interactive Forensic Sentinel & Cryptographic Verification Visualizer"
      className={`relative rounded-[4px] border border-[#3a352c] bg-[#14120f] overflow-hidden p-3.5 transition-all duration-300 hover:border-[#c9a227]/70 hover:shadow-[0_8px_30px_rgba(201,162,39,0.08)] cursor-pointer group ${className}`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[#3a352c]/60 pb-2 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="font-['IBM_Plex_Mono',monospace] text-[11px] font-semibold tracking-wider text-[#ede6d8] uppercase">
            FORENSIC CRYPTOGRAPHIC SENTINEL
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-['IBM_Plex_Mono',monospace] text-[10px] text-[#c9a227] bg-[#1f1a14] px-2 py-0.5 rounded border border-[#3a352c]">
          <Activity className="w-3 h-3 text-[#22c55e]" />
          <span>{activeMode.toUpperCase()}</span>
        </div>
      </div>

      {/* Visual Canvas Area with Fallback */}
      <div className="relative w-full h-[140px] sm:h-[160px] flex items-center justify-center rounded-[3px] bg-[#100e0c] border border-[#2b251d] overflow-hidden">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1d1a15_1px,transparent_1px),linear-gradient(to_bottom,#1d1a15_1px,transparent_1px)] bg-[size:16px_16px] opacity-40 pointer-events-none" />

        {/* If Rive is available and not in reduced-motion, render Rive canvas */}
        {!loadError && !reducedMotion && RiveComponent ? (
          <div className="w-full h-full relative z-10 transition-transform duration-300 group-hover:scale-105">
            <RiveComponent className="w-full h-full" />
          </div>
        ) : (
          /* Graceful, interactive SVG/Canvas Forensic Radar Fallback */
          <div className="relative w-full h-full flex items-center justify-center z-10 select-none">
            {/* Concentric radar rings */}
            <div className={`absolute w-28 h-28 rounded-full border border-[#c9a227]/30 transition-transform duration-700 ${reducedMotion ? '' : 'animate-ping opacity-25'}`} />
            <div className="absolute w-20 h-20 rounded-full border border-[#b23a2e]/40 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border border-[#22c55e]/50 flex items-center justify-center bg-[#171410]/80">
                <ShieldCheck className="w-6 h-6 text-[#22c55e]" />
              </div>
            </div>

            {/* Orbital telemetry nodes */}
            <div className={`absolute w-32 h-32 flex items-center justify-center ${reducedMotion ? '' : 'animate-spin'} [animation-duration:16s]`}>
              <span className="absolute -top-1 w-2.5 h-2.5 rounded-full bg-[#c9a227] border border-[#14120f] shadow-sm" />
              <span className="absolute -bottom-1 w-2 h-2 rounded-full bg-[#b23a2e] border border-[#14120f] shadow-sm" />
              <span className="absolute -right-1 w-1.5 h-1.5 rounded-full bg-[#22c55e] border border-[#14120f]" />
            </div>

            {/* Sweep radar line */}
            {!reducedMotion && (
              <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0_300deg,rgba(201,162,39,0.18)_360deg)] rounded-full animate-spin [animation-duration:4s]" />
            )}
          </div>
        )}

        {/* Dynamic telemetry HUD overlay */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[9.5px] font-['IBM_Plex_Mono',monospace] text-[#8e8574] z-20 pointer-events-none">
          <span className="bg-[#14120f]/80 px-1.5 py-0.5 rounded border border-[#3a352c]/50">
            {activeMode === 'provenance' && 'HOP LATENCY: 2.4ms'}
            {activeMode === 'cryptographic' && 'DKIM 2048-BIT: VERIFIED'}
            {activeMode === 'asn' && 'BGP ASN: AS200548'}
          </span>
          <span className="text-[#c9a227] flex items-center gap-1">
            <span>CLICK TO CYCLE</span>
            <RefreshCw className="w-2.5 h-2.5 group-hover:rotate-180 transition-transform duration-500" />
          </span>
        </div>
      </div>

      {/* Micro-Interaction description */}
      <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-[#b9af9c]">
        <div className="flex items-center gap-1.5">
          <Lock className="w-3 h-3 text-[#c9a227]" />
          <span>RFC-822 Tamper-Proof Custody Seal</span>
        </div>
        <span className="text-[#22c55e] font-semibold text-[10.5px]">LIVE SYNC</span>
      </div>
    </div>
  );
}
