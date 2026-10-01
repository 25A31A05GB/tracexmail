import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Mail, 
  Share2, 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Zap, 
  CheckCircle2, 
  Layers, 
  Globe, 
  ArrowRight,
  Sparkles,
  Lock,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { TraceXLogo } from '../common/TraceXLogo';

interface ContinuousForensicsNetworkLoopProps {
  onOpenConsole?: () => void;
  onExploreCase?: (caseIndex: number) => void;
}

// 10-step continuous cinematic growth loop
interface CinematicPhase {
  id: number;
  step: string;
  title: string;
  subtitle: string;
  category: 'threat' | 'ingest' | 'scan' | 'verdict' | 'transform' | 'share' | 'feedback' | 'correlate' | 'mesh' | 'finale';
  accentColor: string;
}

const CINEMATIC_PHASES: CinematicPhase[] = [
  {
    id: 1,
    step: '01',
    title: 'Suspicious Email Inbound',
    subtitle: 'A disguised phishing email with a red threat warning attempts to breach the organization.',
    category: 'threat',
    accentColor: '#ef4444'
  },
  {
    id: 2,
    step: '02',
    title: 'Ingestion Into TraceXMail',
    subtitle: 'The email is pulled into the central TraceXMail platform for sandboxed forensic isolation.',
    category: 'ingest',
    accentColor: '#06b6d4'
  },
  {
    id: 3,
    step: '03',
    title: 'Deep Multi-Signal Forensic Scan',
    subtitle: 'TraceXMail analyzes email headers, SPF, DKIM, DMARC, IP address, domain age, and embedded URLs.',
    category: 'scan',
    accentColor: '#38bdf8'
  },
  {
    id: 4,
    step: '04',
    title: 'Threat Detected & Risk Scored',
    subtitle: 'Result confirmed: 98/100 risk score. Malicious credential phishing attempt neutralized.',
    category: 'verdict',
    accentColor: '#ef4444'
  },
  {
    id: 5,
    step: '05',
    title: 'Transformed into Shareable Report',
    subtitle: 'The investigation result seals into a clean, tamper-proof security report ready to share.',
    category: 'transform',
    accentColor: '#10b981'
  },
  {
    id: 6,
    step: '06',
    title: 'Shared with Security Analyst Node',
    subtitle: 'The report travels outward along an encrypted telemetry path to Analyst Chen in Frankfurt.',
    category: 'share',
    accentColor: '#10b981'
  },
  {
    id: 7,
    step: '07',
    title: 'Analyst Submits Correlated Threat',
    subtitle: 'Analyst Chen identifies a matching attack invoice and submits it back into TraceXMail.',
    category: 'feedback',
    accentColor: '#f59e0b'
  },
  {
    id: 8,
    step: '08',
    title: 'Campaign Infrastructure Unmasked',
    subtitle: 'TraceXMail correlates common threat infrastructure, connecting both attacks to one actor.',
    category: 'correlate',
    accentColor: '#f59e0b'
  },
  {
    id: 9,
    step: '09',
    title: 'Global Analyst Network Expands',
    subtitle: 'More analyst nodes appear across New York, Tokyo, London, and Singapore to join the defense mesh.',
    category: 'mesh',
    accentColor: '#06b6d4'
  },
  {
    id: 10,
    step: '10',
    title: 'TraceXMail Collective Network',
    subtitle: 'TraceXMail stands in the center of a thriving, glowing network. Every investigated threat protects everyone.',
    category: 'finale',
    accentColor: '#06b6d4'
  }
];

interface NetworkNode {
  id: string;
  name: string;
  location: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  initials: string;
  activeFromPhase: number;
}

const NETWORK_NODES: NetworkNode[] = [
  { id: 'node-chen', name: 'Analyst Chen', location: 'Frankfurt SOC', x: 80, y: 24, initials: 'AC', activeFromPhase: 6 },
  { id: 'node-mercer', name: 'Analyst Mercer', location: 'New York SOC', x: 18, y: 74, initials: 'AM', activeFromPhase: 8 },
  { id: 'node-sato', name: 'Analyst Sato', location: 'Tokyo SOC', x: 82, y: 74, initials: 'AS', activeFromPhase: 9 },
  { id: 'node-vance', name: 'Analyst Vance', location: 'London SOC', x: 18, y: 24, initials: 'AV', activeFromPhase: 9 },
  { id: 'node-rao', name: 'Analyst Rao', location: 'Singapore SOC', x: 50, y: 88, initials: 'AR', activeFromPhase: 9 }
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface PhotonComet {
  path: 1 | 2 | 3;
  t: number;
  speed: number;
  size: number;
  color: string;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

export function ContinuousForensicsNetworkLoop({
  onOpenConsole
}: ContinuousForensicsNetworkLoopProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Web Audio Context for cinematic soundscape
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastAudioPhaseRef = useRef<number>(-1);

  // Canvas simulation elements
  const particlesRef = useRef<Particle[]>([]);
  const cometsRef = useRef<PhotonComet[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  const TOTAL_DURATION = 11.0; // 11s smooth cinematic loop

  // Synthesize delicate futuristic acoustic cues
  const playCinematicChime = useCallback((freq = 520, duration = 0.12, type: OscillatorType = 'sine') => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const AudioClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioClass) audioCtxRef.current = new AudioClass();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      if (audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.35, ctx.currentTime + duration);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      }
    } catch {
      // Audio autoplay policy handled
    }
  }, [soundEnabled]);

  // Current phase calculation (1 to 10)
  const currentPhaseIndex = useMemo(() => {
    const progress = (currentTime % TOTAL_DURATION) / TOTAL_DURATION;
    const phase = Math.min(10, Math.max(1, Math.floor(progress * 10) + 1));
    return phase;
  }, [currentTime]);

  const activePhase = CINEMATIC_PHASES[currentPhaseIndex - 1] || CINEMATIC_PHASES[0];

  // Precise fractional progress inside active phase [0, 1]
  const phaseProgress = useMemo(() => {
    const phaseDuration = TOTAL_DURATION / 10;
    const currentPhaseStartTime = (currentPhaseIndex - 1) * phaseDuration;
    const elapsedInPhase = currentTime - currentPhaseStartTime;
    return Math.min(1, Math.max(0, elapsedInPhase / phaseDuration));
  }, [currentTime, currentPhaseIndex]);

  // Sound and shockwave triggers on phase change
  useEffect(() => {
    if (currentPhaseIndex !== lastAudioPhaseRef.current) {
      lastAudioPhaseRef.current = currentPhaseIndex;
      
      if (currentPhaseIndex === 1) playCinematicChime(340, 0.14, 'triangle');
      if (currentPhaseIndex === 3) playCinematicChime(640, 0.1, 'sine'); // Laser scan
      if (currentPhaseIndex === 4) playCinematicChime(280, 0.16, 'sawtooth'); // Threat alert
      if (currentPhaseIndex === 5) playCinematicChime(760, 0.18, 'sine'); // Report sealed
      if (currentPhaseIndex === 6) playCinematicChime(880, 0.12, 'sine'); // Outbound travel
      if (currentPhaseIndex === 7) playCinematicChime(540, 0.12, 'triangle'); // Feedback loop
      if (currentPhaseIndex === 8) playCinematicChime(920, 0.16, 'sine'); // Correlation
      if (currentPhaseIndex === 9) playCinematicChime(1080, 0.18, 'sine'); // Mesh expanded
      if (currentPhaseIndex === 10) playCinematicChime(1240, 0.24, 'sine'); // Consensus finale

      // Radial shockwave ripples
      if (currentPhaseIndex === 3 || currentPhaseIndex === 4 || currentPhaseIndex === 5 || currentPhaseIndex === 8 || currentPhaseIndex === 10) {
        shockwavesRef.current.push({
          x: 500,
          y: 300,
          radius: 15,
          maxRadius: currentPhaseIndex === 10 ? 340 : 230,
          color: currentPhaseIndex === 4 ? '#ef4444' : currentPhaseIndex === 5 ? '#10b981' : '#06b6d4',
          alpha: 0.7
        });
      }

      // Shockwave at Analyst Chen's workstation in Phase 6
      if (currentPhaseIndex === 6) {
        shockwavesRef.current.push({
          x: 800,
          y: 144,
          radius: 10,
          maxRadius: 110,
          color: '#10b981',
          alpha: 0.85
        });
      }
    }
  }, [currentPhaseIndex, playCinematicChime]);

  // Subtle 3D tilt
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setMousePos({ x: nx, y: ny });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  // Trajectory Spline Math
  // Path 1 (Inbound): (140, 110) -> (270, 130) -> (390, 220) -> (500, 300)
  const getPath1 = (t: number) => {
    const p0 = { x: 140, y: 110 };
    const p1 = { x: 270, y: 130 };
    const p2 = { x: 390, y: 220 };
    const p3 = { x: 500, y: 300 };
    const x = Math.pow(1 - t, 3) * p0.x + 3 * Math.pow(1 - t, 2) * t * p1.x + 3 * (1 - t) * Math.pow(t, 2) * p2.x + Math.pow(t, 3) * p3.x;
    const y = Math.pow(1 - t, 3) * p0.y + 3 * Math.pow(1 - t, 2) * t * p1.y + 3 * (1 - t) * Math.pow(t, 2) * p2.y + Math.pow(t, 3) * p3.y;
    return { x, y };
  };

  // Path 2 (Outbound to Analyst Chen): (500, 300) -> (630, 250) -> (720, 190) -> (800, 144)
  const getPath2 = (t: number) => {
    const p0 = { x: 500, y: 300 };
    const p1 = { x: 630, y: 250 };
    const p2 = { x: 720, y: 190 };
    const p3 = { x: 800, y: 144 };
    const x = Math.pow(1 - t, 3) * p0.x + 3 * Math.pow(1 - t, 2) * t * p1.x + 3 * (1 - t) * Math.pow(t, 2) * p2.x + Math.pow(t, 3) * p3.x;
    const y = Math.pow(1 - t, 3) * p0.y + 3 * Math.pow(1 - t, 2) * t * p1.y + 3 * (1 - t) * Math.pow(t, 2) * p2.y + Math.pow(t, 3) * p3.y;
    return { x, y };
  };

  // Path 3 (Feedback from Analyst Chen): (800, 144) -> (750, 330) -> (630, 340) -> (500, 300)
  const getPath3 = (t: number) => {
    const p0 = { x: 800, y: 144 };
    const p1 = { x: 750, y: 330 };
    const p2 = { x: 630, y: 340 };
    const p3 = { x: 500, y: 300 };
    const x = Math.pow(1 - t, 3) * p0.x + 3 * Math.pow(1 - t, 2) * t * p1.x + 3 * (1 - t) * Math.pow(t, 2) * p2.x + Math.pow(t, 3) * p3.x;
    const y = Math.pow(1 - t, 3) * p0.y + 3 * Math.pow(1 - t, 2) * t * p1.y + 3 * (1 - t) * Math.pow(t, 2) * p2.y + Math.pow(t, 3) * p3.y;
    return { x, y };
  };

  // Canvas VFX Engine Setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 1000);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 600);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Subtle ambient starlight particles
    const particles: Particle[] = [];
    for (let i = 0; i < 45; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.6,
        color: Math.random() > 0.4 ? '#06b6d4' : '#38bdf8',
        alpha: Math.random() * 0.35 + 0.1,
        life: Math.random() * 200,
        maxLife: 200 + Math.random() * 100
      });
    }
    particlesRef.current = particles;

    // Glowing photon comets
    const comets: PhotonComet[] = [];
    for (let i = 0; i < 18; i++) {
      comets.push({
        path: i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 3,
        t: Math.random(),
        speed: 0.0035 + Math.random() * 0.003,
        size: 2.2 + Math.random() * 1.5,
        color: i % 3 === 0 ? '#ef4444' : i % 3 === 1 ? '#10b981' : '#f59e0b'
      });
    }
    cometsRef.current = comets;

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 60 FPS RequestAnimationFrame Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = (timestamp: number) => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }
      const delta = (timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;

      if (isPlaying) {
        setCurrentTime(prev => {
          const next = prev + delta;
          return next >= TOTAL_DURATION ? next % TOTAL_DURATION : next;
        });
      }

      const width = canvas.width;
      const height = canvas.height;
      const sx = width / 1000;
      const sy = height / 600;

      ctx.clearRect(0, 0, width, height);

      // 1. Draw ambient particles
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life += 1;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        const pulse = Math.sin((p.life / p.maxLife) * Math.PI) * p.alpha;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, pulse);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Draw shockwaves with glow
      const shockwaves = shockwavesRef.current;
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.radius += 2.8;
        sw.alpha *= 0.955;

        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = sw.alpha;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sw.x * sx, sw.y * sy, sw.radius, 0, Math.PI * 2);
        ctx.stroke();

        if (sw.radius >= sw.maxRadius || sw.alpha <= 0.01) {
          shockwaves.splice(i, 1);
        }
      }

      // 3. Draw luminous photon comets along the active trajectory
      const comets = cometsRef.current;
      for (let i = 0; i < comets.length; i++) {
        const c = comets[i];
        c.t = (c.t + c.speed) % 1;

        let pt = { x: 500, y: 300 };
        let active = false;

        // Path 1 active during Phase 1-2
        if (c.path === 1 && currentPhaseIndex <= 2) {
          pt = getPath1(c.t);
          active = true;
        }
        // Path 2 active during Phase 5-7
        else if (c.path === 2 && currentPhaseIndex >= 5 && currentPhaseIndex <= 7) {
          pt = getPath2(c.t);
          active = true;
        }
        // Path 3 active during Phase 7-8
        else if (c.path === 3 && (currentPhaseIndex === 7 || currentPhaseIndex === 8)) {
          pt = getPath3(c.t);
          active = true;
        }

        if (active) {
          const cx = pt.x * sx;
          const cy = pt.y * sy;

          ctx.globalAlpha = 0.95;
          ctx.fillStyle = c.color;
          ctx.shadowColor = c.color;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(cx, cy, c.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      ctx.globalAlpha = 1.0;
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, currentPhaseIndex]);

  // Coordinates for the 3 moving cards
  // 1. Inbound Suspicious Email Card (Phase 1-2)
  const inboundCardCoords = useMemo(() => {
    if (currentPhaseIndex > 2) return null;
    const t = currentPhaseIndex === 1 ? 0 : phaseProgress;
    const pt = getPath1(t);
    const scale = currentPhaseIndex === 1 ? 1 : 1 - t * 0.45;
    const opacity = currentPhaseIndex === 1 ? 1 : Math.max(0, 1 - t * 1.35);
    const rotation = currentPhaseIndex === 1 ? -6 : -6 + t * 12;
    return { x: pt.x, y: pt.y, scale, opacity, rotation };
  }, [currentPhaseIndex, phaseProgress]);

  // 2. Outbound Shareable Report Dossier (Phase 6)
  const outboundDossierCoords = useMemo(() => {
    if (currentPhaseIndex !== 6) return null;
    const t = phaseProgress;
    const pt = getPath2(t);
    const scale = 0.7 + t * 0.3;
    const opacity = t < 0.1 ? t * 10 : t > 0.88 ? (1 - t) / 0.12 : 1;
    return { x: pt.x, y: pt.y, scale, opacity };
  }, [currentPhaseIndex, phaseProgress]);

  // 3. Correlated Email from Analyst Chen back to Center (Phase 7)
  const feedbackEmailCoords = useMemo(() => {
    if (currentPhaseIndex !== 7) return null;
    const t = phaseProgress;
    const pt = getPath3(t);
    const scale = 1 - t * 0.35;
    const opacity = t > 0.85 ? (1 - t) / 0.15 : 1;
    return { x: pt.x, y: pt.y, scale, opacity };
  }, [currentPhaseIndex, phaseProgress]);

  const handleSeek = (phaseId: number) => {
    const target = ((phaseId - 1) / 10) * TOTAL_DURATION + 0.02;
    setCurrentTime(target);
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`w-full relative rounded-2xl border border-cyan-500/20 bg-[#050B14] text-[#ede6d8] shadow-[0_25px_80px_-15px_rgba(0,180,255,0.12)] overflow-hidden select-none font-sans transition-all duration-300 ${
        isTheaterMode ? 'fixed inset-4 z-50 rounded-2xl shadow-2xl border-cyan-500/50 bg-[#050B14]' : ''
      }`}
      style={{
        perspective: '1400px'
      }}
    >
      
      {/* Cinematic Deep Ambience: Deep Navy #050B14 & Soft Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft electric blue radial flare */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[760px] h-[560px] bg-[radial-gradient(ellipse_at_center,rgba(0,210,255,0.08)_0%,rgba(14,165,233,0.015)_50%,transparent_75%)] blur-3xl" />
        
        {/* Subtle grid */}
        <div 
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(56,189,248,0.7) 1px, transparent 0)`,
            backgroundSize: '36px 36px'
          }}
        />

        {/* Ambient Orbit Filaments */}
        <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50%" cy="50%" r="180" fill="none" stroke="#0ea5e9" strokeWidth="0.8" strokeDasharray="3 8" className="animate-[spin_120s_linear_infinite]" />
          <circle cx="50%" cy="50%" r="290" fill="none" stroke="#0284c7" strokeWidth="0.6" strokeDasharray="4 12" className="animate-[spin_180s_linear_infinite_reverse]" />
          <circle cx="50%" cy="50%" r="390" fill="none" stroke="#38bdf8" strokeWidth="0.4" strokeDasharray="2 10" />
        </svg>
      </div>

      {/* HTML5 Canvas Simulation Layer for Particles & Energy Pulses */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full pointer-events-none z-10" 
      />

      {/* Main Interactive Stage Visualization with 3D Parallax */}
      <div 
        className="relative min-h-[520px] sm:min-h-[580px] lg:min-h-[640px] w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden transition-transform duration-200 ease-out"
        style={{
          transform: `rotateX(${mousePos.y * -3.5}deg) rotateY(${mousePos.x * 3.5}deg)`
        }}
      >
        
        {/* Glowing Trajectory Filaments */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none z-10" 
          viewBox="0 0 1000 600" 
          preserveAspectRatio="none"
        >
          <defs>
            <filter id="neonBeamGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Track 1: Inbound Suspicious Email Path */}
          <path
            d="M 140 110 C 270 130, 390 220, 500 300"
            fill="none"
            stroke={currentPhaseIndex <= 2 ? '#ef4444' : '#1e385b'}
            strokeWidth={currentPhaseIndex <= 2 ? '2.5' : '1'}
            strokeDasharray={currentPhaseIndex <= 2 ? '6 6' : '2 6'}
            opacity={currentPhaseIndex <= 2 ? 0.95 : 0.25}
            filter={currentPhaseIndex <= 2 ? 'url(#neonBeamGlow)' : undefined}
          />

          {/* Track 2: Outbound Shared Intelligence Path */}
          <path
            d="M 500 300 C 630 250, 720 190, 800 144"
            fill="none"
            stroke={currentPhaseIndex >= 5 && currentPhaseIndex <= 7 ? '#10b981' : '#1e385b'}
            strokeWidth={currentPhaseIndex >= 5 && currentPhaseIndex <= 7 ? '3' : '1'}
            strokeDasharray={currentPhaseIndex >= 5 && currentPhaseIndex <= 7 ? '8 4' : '2 6'}
            opacity={currentPhaseIndex >= 5 ? 0.95 : 0.2}
            filter={currentPhaseIndex >= 5 && currentPhaseIndex <= 7 ? 'url(#neonBeamGlow)' : undefined}
          />

          {/* Track 3: Analyst Feedback Loop */}
          <path
            d="M 800 144 C 750 330, 630 340, 500 300"
            fill="none"
            stroke={currentPhaseIndex === 7 ? '#f59e0b' : '#1e385b'}
            strokeWidth={currentPhaseIndex === 7 ? '2.5' : '1'}
            strokeDasharray={currentPhaseIndex === 7 ? '6 4' : '2 6'}
            opacity={currentPhaseIndex >= 7 ? 0.85 : 0.2}
            filter={currentPhaseIndex === 7 ? 'url(#neonBeamGlow)' : undefined}
          />

          {/* Connected Network Mesh (Phases 8-10) */}
          {currentPhaseIndex >= 8 && (
            <g opacity="0.45" className="transition-opacity duration-1000">
              <path d="M 500 300 L 180 444" stroke="#06b6d4" strokeWidth="1.2" strokeDasharray="3 5" filter="url(#neonBeamGlow)" />
              <path d="M 500 300 L 820 444" stroke="#06b6d4" strokeWidth="1.2" strokeDasharray="3 5" filter="url(#neonBeamGlow)" />
              <path d="M 500 300 L 180 144" stroke="#06b6d4" strokeWidth="1.2" strokeDasharray="3 5" filter="url(#neonBeamGlow)" />
              <path d="M 500 300 L 500 528" stroke="#06b6d4" strokeWidth="1.2" strokeDasharray="3 5" filter="url(#neonBeamGlow)" />
              
              {/* Outer perimeter synchronization filaments */}
              <path d="M 180 144 C 350 90, 620 110, 800 144" stroke="#0284c7" strokeWidth="1" strokeDasharray="2 8" opacity="0.75" />
              <path d="M 800 144 L 820 444" stroke="#0284c7" strokeWidth="1" strokeDasharray="2 8" opacity="0.65" />
              <path d="M 820 444 L 500 528" stroke="#0284c7" strokeWidth="1" strokeDasharray="2 8" opacity="0.65" />
              <path d="M 500 528 L 180 444" stroke="#0284c7" strokeWidth="1" strokeDasharray="2 8" opacity="0.65" />
              <path d="M 180 444 L 180 144" stroke="#0284c7" strokeWidth="1" strokeDasharray="2 8" opacity="0.65" />
            </g>
          )}
        </svg>

        {/* =========================================================================
            STAGE ELEMENT 1: INBOUND SUSPICIOUS EMAIL CARD (Smooth Flight Physics)
        ========================================================================= */}
        {inboundCardCoords && (
          <div
            style={{
              position: 'absolute',
              left: `${(inboundCardCoords.x / 1000) * 100}%`,
              top: `${(inboundCardCoords.y / 600) * 100}%`,
              transform: `translate(-50%, -50%) scale(${inboundCardCoords.scale}) rotate(${inboundCardCoords.rotation}deg)`,
              opacity: inboundCardCoords.opacity,
              transition: 'transform 0.05s linear, opacity 0.05s linear',
              zIndex: 35
            }}
            className="max-w-[280px] sm:max-w-[320px] w-full pointer-events-none"
          >
            <div className="p-4 rounded-2xl bg-[#091322]/95 border border-rose-500/60 shadow-[0_12px_45px_rgba(239,68,68,0.45)] backdrop-blur-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500" />
              
              <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[#1c2c44]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    Suspicious Email
                  </span>
                </div>
                <span className="text-[10px] font-mono text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800/80">
                  URGENT WARNING
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="text-white font-semibold truncate">
                  [URGENT] PayPal Account Lockout
                </div>
                <div className="text-rose-300/90 text-[11px] truncate">
                  From: Security Team &lt;auth@paypa1-update.com&gt;
                </div>
                <div className="text-[#94a3b8] text-[10.5px] pt-1 border-t border-[#132135] flex items-center justify-between">
                  <span>Origin: Tor Exit Relay</span>
                  <span className="text-rose-400 font-bold">Unverified</span>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-[#162942] flex items-center justify-between text-[11px] text-[#64748b]">
                <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
                  <Zap className="w-3.5 h-3.5 animate-pulse" />
                  Inbound to TraceXMail
                </span>
                <span className="text-[10px]">MIME Payload</span>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            STAGE ELEMENT 2: CENTRAL TRACEXMAIL FORENSIC PLATFORM CORE (HERO)
        ========================================================================= */}
        <div className="relative z-20 max-w-[360px] sm:max-w-[440px] md:max-w-[490px] w-full">
          <div className={`p-5 sm:p-6 rounded-2xl bg-[#071224]/95 border shadow-2xl backdrop-blur-2xl relative overflow-hidden transition-all duration-500 ${
            currentPhaseIndex === 4 
              ? 'border-rose-500/70 shadow-[0_0_80px_rgba(239,68,68,0.25)]'
              : currentPhaseIndex >= 5 && currentPhaseIndex <= 7
              ? 'border-emerald-500/70 shadow-[0_0_80px_rgba(16,185,129,0.25)]'
              : currentPhaseIndex === 8
              ? 'border-amber-500/70 shadow-[0_0_80px_rgba(245,158,11,0.25)]'
              : 'border-cyan-500/50 shadow-[0_0_80px_rgba(6,182,212,0.22)]'
          }`}>
            
            {/* Top Status Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-[#142640] mb-3.5">
              <div className="flex items-center gap-3">
                <TraceXLogo size="sm" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-bold tracking-tight text-white font-['Fraunces',serif]">
                      TraceXMail
                    </span>
                    <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/80">
                      FORENSICS CORE
                    </span>
                  </div>
                  <span className="text-[10px] text-[#64748b] block mt-0.5">
                    Automated Email Threat Investigation Platform
                  </span>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  currentPhaseIndex >= 3 && currentPhaseIndex <= 4
                    ? 'bg-rose-500 animate-ping'
                    : currentPhaseIndex >= 5 && currentPhaseIndex <= 7
                    ? 'bg-emerald-400 animate-pulse'
                    : currentPhaseIndex === 8
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-cyan-400 animate-pulse'
                }`} />
                <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-cyan-300">
                  {currentPhaseIndex <= 2 && 'AIRLOCK READY'}
                  {currentPhaseIndex === 3 && 'SCANNING SIGNALS'}
                  {currentPhaseIndex === 4 && 'THREAT VERIFIED'}
                  {(currentPhaseIndex === 5 || currentPhaseIndex === 6) && 'REPORT READY'}
                  {currentPhaseIndex === 7 && 'CORRELATING'}
                  {currentPhaseIndex === 8 && 'PATTERN MATCH'}
                  {currentPhaseIndex >= 9 && 'NETWORK IMMUNE'}
                </span>
              </div>
            </div>

            {/* HOLOGRAPHIC SCANNING LASER SWEEP (Phase 3 & Phase 7) */}
            {(currentPhaseIndex === 3 || currentPhaseIndex === 7) && (
              <motion.div 
                initial={{ top: '15%' }}
                animate={{ top: ['15%', '85%', '15%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_25px_#06b6d4] z-30 pointer-events-none"
              />
            )}

            {/* Central Content Area: Changes with Phase */}
            <div className="min-h-[190px] flex flex-col justify-center">
              
              {/* State A: Airlock / Ingesting (Phases 1, 2) */}
              {(currentPhaseIndex === 1 || currentPhaseIndex === 2) && (
                <div className="space-y-3 py-2 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-950/50 border border-cyan-800/60 flex items-center justify-center mx-auto text-cyan-400 shadow-inner">
                    <Mail className="w-7 h-7 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white tracking-wide">
                      Sandboxed Email Ingestion
                    </h4>
                    <p className="text-xs text-[#94a3b8] max-w-xs mx-auto mt-1 leading-relaxed">
                      Suspicious email pulled into isolated memory enclave for zero-trust forensic dissection.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 text-[11px] font-mono text-cyan-400 bg-[#0c182b] px-3 py-1 rounded-full border border-[#1b3152]">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                    <span>Airlock Isolated &bull; Safe Execution Enclave</span>
                  </div>
                </div>
              )}

              {/* State B: Active Multi-Signal Forensic Scan (Phase 3) */}
              {currentPhaseIndex === 3 && (
                <div className="space-y-2 py-1">
                  <div className="flex items-center justify-between text-[11px] text-cyan-400 font-bold border-b border-[#142640] pb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>X-RAY SIGNAL ANALYSIS</span>
                    </span>
                    <span className="text-[#64748b]">ANALYZING...</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-2 rounded-lg bg-[#091526] border border-rose-500/40 flex items-center justify-between">
                      <span className="text-slate-400">1. Headers</span>
                      <span className="text-rose-400 font-bold">Spoofed</span>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }} className="p-2 rounded-lg bg-[#091526] border border-rose-500/40 flex items-center justify-between">
                      <span className="text-slate-400">2. SPF Check</span>
                      <span className="text-rose-400 font-bold">Failed</span>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="p-2 rounded-lg bg-[#091526] border border-rose-500/40 flex items-center justify-between">
                      <span className="text-slate-400">3. DKIM Sig</span>
                      <span className="text-rose-400 font-bold">Forged</span>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }} className="p-2 rounded-lg bg-[#091526] border border-rose-500/40 flex items-center justify-between">
                      <span className="text-slate-400">4. DMARC</span>
                      <span className="text-rose-400 font-bold">Reject</span>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="p-2 rounded-lg bg-[#091526] border border-amber-500/40 flex items-center justify-between">
                      <span className="text-slate-400">5. IP &amp; ASN</span>
                      <span className="text-amber-300 font-bold">Tor Relay</span>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }} className="p-2 rounded-lg bg-[#091526] border border-rose-500/40 flex items-center justify-between">
                      <span className="text-slate-400">6. URL Links</span>
                      <span className="text-rose-400 font-bold">Malicious</span>
                    </motion.div>
                  </div>
                </div>
              )}

              {/* State C: Forensic Verdict Report (Phase 4) */}
              {currentPhaseIndex === 4 && (
                <div className="space-y-3 py-1">
                  <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-600/60 flex items-center justify-between shadow-[0_0_30px_rgba(239,68,68,0.25)]">
                    <div className="flex items-center gap-2.5">
                      <ShieldAlert className="w-7 h-7 text-rose-400 shrink-0 animate-pulse" />
                      <div>
                        <div className="font-mono text-sm font-bold text-rose-200">
                          THREAT DETECTED
                        </div>
                        <div className="text-xs text-rose-300/90 font-medium">
                          Malicious Credential Phishing Attack
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-2xl font-bold text-rose-400">98</span>
                      <span className="text-xs text-rose-300/80">/100</span>
                      <div className="text-[10px] text-rose-400 font-semibold uppercase">High Risk</div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#091526] border border-[#1a2d48] text-xs text-slate-300 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">Investigation Verdict:</span>
                      <span className="text-rose-400 font-bold">CONFIRMED MALICIOUS</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">Cryptographic Evidence:</span>
                      <span className="text-emerald-400 font-bold">100% Deterministic Proof</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">Platform Action:</span>
                      <span className="text-amber-300 font-bold">Auto-Quarantine &bull; Domain Blacklisted</span>
                    </div>
                  </div>
                </div>
              )}

              {/* State D: Transformed Shareable Security Report (Phases 5-6) */}
              {(currentPhaseIndex === 5 || currentPhaseIndex === 6) && (
                <div className="space-y-3 py-1">
                  <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/60 flex items-center justify-between shadow-[0_0_30px_rgba(16,185,129,0.25)]">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-mono text-sm font-bold text-emerald-200">
                          ANALYSIS COMPLETE
                        </div>
                        <div className="text-xs text-emerald-300/90 font-medium">
                          Shareable Security Report Generated
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-emerald-900/60 border border-emerald-600 text-emerald-300 text-xs font-mono font-bold">
                      READY TO SHARE
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#091526] border border-[#1a2d48] text-xs text-slate-300 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">Report ID:</span>
                      <span className="text-cyan-300 font-bold">#TMX-892 (Sealed)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">Export Formats:</span>
                      <span className="text-white">PDF Summary &bull; JSON &bull; STIX 2.1</span>
                    </div>
                    <div className="flex justify-between text-cyan-400 font-medium pt-0.5">
                      <span>Dispatch:</span>
                      <span className="flex items-center gap-1.5">
                        <Share2 className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
                        Routing to Frankfurt Analyst Chen...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* State E: Correlated Campaign Ingestion (Phase 7-8) */}
              {(currentPhaseIndex === 7 || currentPhaseIndex === 8) && (
                <div className="space-y-3 py-1">
                  <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-500/60 flex items-center justify-between shadow-[0_0_30px_rgba(245,158,11,0.25)]">
                    <div className="flex items-center gap-2.5">
                      <Layers className="w-7 h-7 text-amber-400 shrink-0" />
                      <div>
                        <div className="font-mono text-sm font-bold text-amber-200">
                          CAMPAIGN CORRELATION
                        </div>
                        <div className="text-xs text-amber-300/90 font-medium">
                          2 Related Incidents Connected to One Attacker
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-amber-900/60 border border-amber-600 text-amber-300 text-xs font-mono font-bold">
                      CLUSTER #89
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#091526] border border-[#1a2d48] text-xs text-slate-300 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">Identified Threat Actor:</span>
                      <span className="text-rose-400 font-bold">APT-412 ShadowRelay</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">Shared Infrastructure:</span>
                      <span className="text-cyan-300 font-medium">Tor Exit Relay + Fake Domains</span>
                    </div>
                    <div className="flex justify-between text-emerald-400 font-bold pt-0.5">
                      <span>Network Status:</span>
                      <span>Proactive Defense Inoculation Active</span>
                    </div>
                  </div>
                </div>
              )}

              {/* State F: Unified Network Mesh Consensus (Phases 9-10) */}
              {currentPhaseIndex >= 9 && (
                <div className="space-y-3 py-1 text-center">
                  <div className="p-4 rounded-xl bg-cyan-950/50 border border-cyan-500/60 shadow-[0_0_35px_rgba(6,182,212,0.3)]">
                    <div className="w-11 h-11 rounded-full bg-cyan-900/50 border border-cyan-400 text-cyan-300 flex items-center justify-center mx-auto mb-2 shadow-[0_0_20px_rgba(6,182,212,0.5)]">
                      <Globe className="w-6 h-6 animate-pulse" />
                    </div>
                    <div className="font-mono text-sm font-bold text-white tracking-wide">
                      TraceXMail Defense Network Synchronized
                    </div>
                    <div className="text-xs text-cyan-300 mt-1">
                      Every threat investigated protects all connected security analysts
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-[#091526] border border-[#1c304f]">
                      <div className="text-[#64748b] text-[10px]">Connected Nodes</div>
                      <div className="text-cyan-300 font-bold text-sm">5 Regions</div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#091526] border border-[#1c304f]">
                      <div className="text-[#64748b] text-[10px]">Shared Intel</div>
                      <div className="text-emerald-400 font-bold text-sm">Real-Time</div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#091526] border border-[#1c304f]">
                      <div className="text-[#64748b] text-[10px]">Protection</div>
                      <div className="text-cyan-300 font-bold text-sm">100% Mesh</div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Platform Action Row */}
            <div className="pt-3 border-t border-[#13233b] flex items-center justify-between text-xs text-[#64748b]">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                Zero-Trust Sandboxed Enclave
              </span>
              {onOpenConsole && (
                <button
                  type="button"
                  onClick={onOpenConsole}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Launch Live Scanner</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================================
            STAGE ELEMENT 3: OUTBOUND SHAREABLE REPORT CARD (Smooth Flight)
        ========================================================================= */}
        {outboundDossierCoords && (
          <div
            style={{
              position: 'absolute',
              left: `${(outboundDossierCoords.x / 1000) * 100}%`,
              top: `${(outboundDossierCoords.y / 600) * 100}%`,
              transform: `translate(-50%, -50%) scale(${outboundDossierCoords.scale})`,
              opacity: outboundDossierCoords.opacity,
              transition: 'transform 0.05s linear, opacity 0.05s linear',
              zIndex: 35
            }}
            className="max-w-[250px] pointer-events-none"
          >
            <div className="p-3 rounded-xl bg-[#071927]/95 border border-emerald-400/80 shadow-[0_8px_35px_rgba(16,185,129,0.45)] backdrop-blur-md">
              <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-xs font-bold">
                <Share2 className="w-4 h-4 animate-spin" />
                <span>Sharing Intelligence</span>
              </div>
              <div className="text-xs text-white font-semibold mt-1">
                Security_Report_TMX892.pdf
              </div>
              <div className="text-[10.5px] text-emerald-300/80 mt-0.5">
                Traveling to Analyst Chen (Frankfurt)
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            STAGE ELEMENT 4: CORRELATED INBOUND EMAIL SUBMISSION (Smooth Flight)
        ========================================================================= */}
        {feedbackEmailCoords && (
          <div
            style={{
              position: 'absolute',
              left: `${(feedbackEmailCoords.x / 1000) * 100}%`,
              top: `${(feedbackEmailCoords.y / 600) * 100}%`,
              transform: `translate(-50%, -50%) scale(${feedbackEmailCoords.scale}) rotate(5deg)`,
              opacity: feedbackEmailCoords.opacity,
              transition: 'transform 0.05s linear, opacity 0.05s linear',
              zIndex: 35
            }}
            className="max-w-[270px] pointer-events-none"
          >
            <div className="p-3.5 rounded-xl bg-[#091526]/95 border border-amber-500/70 shadow-[0_12px_40px_rgba(245,158,11,0.35)] backdrop-blur-xl">
              <div className="flex items-center gap-1.5 text-amber-400 font-mono text-xs font-bold">
                <Zap className="w-4 h-4 animate-pulse" />
                <span>New Correlated Phish Submitted</span>
              </div>
              <div className="text-xs text-white font-semibold mt-1">
                Invoice_Wire_902.eml
              </div>
              <div className="text-[10.5px] text-[#94a3b8] mt-0.5">
                Submitted by Analyst Chen &bull; Related Domain Match
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            STAGE ELEMENT 5: GLOBAL ANALYST NODES (Alpha, Beta, Gamma, Delta, Epsilon)
        ========================================================================= */}
        {NETWORK_NODES.map((node) => {
          const isVisible = currentPhaseIndex >= node.activeFromPhase;
          const isTargetInCurrentPhase = 
            (node.id === 'node-chen' && currentPhaseIndex === 6) ||
            (node.id === 'node-chen' && currentPhaseIndex === 7);

          return (
            <motion.div
              key={node.id}
              initial={false}
              animate={{
                opacity: isVisible ? 1 : 0.15,
                scale: isVisible ? (isTargetInCurrentPhase ? 1.08 : 1) : 0.85
              }}
              transition={{ duration: 0.5 }}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
              className="absolute z-20"
            >
              <div className={`p-2.5 sm:p-3 rounded-xl backdrop-blur-xl border transition-all duration-300 ${
                isTargetInCurrentPhase
                  ? 'bg-[#0a2038] border-cyan-400 shadow-[0_0_35px_rgba(6,182,212,0.5)] ring-2 ring-cyan-400/60'
                  : isVisible
                  ? 'bg-[#091526]/90 border-[#1d3557] shadow-md'
                  : 'bg-[#060e1a]/60 border-[#102035] opacity-40'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold transition-all ${
                    isTargetInCurrentPhase
                      ? 'bg-cyan-500 text-slate-950 shadow-md scale-110'
                      : isVisible
                      ? 'bg-[#12253f] text-cyan-300 border border-[#234570]'
                      : 'bg-[#0b172a] text-[#475569]'
                  }`}>
                    {node.initials}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-semibold text-white">
                      {node.name}
                    </div>
                    <div className="text-[10.5px] text-[#64748b]">
                      {node.location}
                    </div>
                  </div>
                </div>

                {isTargetInCurrentPhase && (
                  <div className="mt-1.5 pt-1 border-t border-[#1e3a63] text-[10px] font-mono text-emerald-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>Inoculating Defense...</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

      </div>

      {/* Floating Cinematic Subtitle & Timeline HUD (Simple, Elegant, Clean) */}
      <div className="relative z-30 px-4 sm:px-6 py-4 border-t border-[#13233b] bg-[#07101e]/95 backdrop-blur-md">
        
        {/* Main Cinema Subtitle Title Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-cyan-400">
                SCENE {activePhase.step} / 10
              </span>
              <span className="text-[#64748b]">&bull;</span>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                {activePhase.title}
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#94a3b8] leading-relaxed max-w-3xl">
              {activePhase.subtitle}
            </p>
          </div>

          {/* Minimalist Floating Controls */}
          <div className="flex items-center gap-2 self-start sm:self-center font-mono text-xs">
            {/* Play / Pause */}
            <button
              type="button"
              onClick={() => setIsPlaying(prev => !prev)}
              className="p-2 rounded-lg bg-[#0f1d33] hover:bg-[#162a4a] border border-[#1e3a63] text-cyan-300 hover:text-cyan-200 transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
              title={isPlaying ? 'Pause visual loop' : 'Play visual loop'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            {/* Replay */}
            <button
              type="button"
              onClick={() => { setCurrentTime(0); setIsPlaying(true); }}
              className="p-2 rounded-lg bg-[#0f1d33] hover:bg-[#162a4a] border border-[#1e3a63] text-[#94a3b8] hover:text-white transition-colors cursor-pointer active:scale-95"
              title="Restart loop from beginning"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Sound Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(prev => !prev)}
              className={`p-2 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                soundEnabled
                  ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
                  : 'bg-[#0f1d33] border-[#1e3a63] text-[#64748b] hover:text-[#94a3b8]'
              }`}
              title={soundEnabled ? 'Mute sound' : 'Enable cinematic sound'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Fullscreen / Theater Mode */}
            <button
              type="button"
              onClick={() => setIsTheaterMode(prev => !prev)}
              className="p-2 rounded-lg bg-[#0f1d33] hover:bg-[#162a4a] border border-[#1e3a63] text-[#94a3b8] hover:text-cyan-300 transition-colors cursor-pointer active:scale-95"
              title={isTheaterMode ? 'Exit theater view' : 'Expand theater view'}
            >
              {isTheaterMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 10-Segment Continuous Timeline Scrubber */}
        <div className="grid grid-cols-10 gap-1 sm:gap-1.5 pt-1.5">
          {CINEMATIC_PHASES.map((phase) => {
            const isActive = currentPhaseIndex === phase.id;
            const isCompleted = currentPhaseIndex > phase.id;

            return (
              <button
                key={phase.id}
                type="button"
                onClick={() => handleSeek(phase.id)}
                className={`group relative h-2 sm:h-2.5 rounded-full transition-all cursor-pointer ${
                  isActive
                    ? 'bg-cyan-400 shadow-[0_0_12px_#06b6d4]'
                    : isCompleted
                    ? 'bg-cyan-700/60 hover:bg-cyan-600'
                    : 'bg-[#142338] hover:bg-[#1d3557]'
                }`}
                title={`Scene ${phase.step}: ${phase.title}`}
                aria-label={`Jump to Scene ${phase.step}: ${phase.title}`}
              >
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30 px-2 py-1 rounded bg-[#091322] border border-[#1e3a63] text-[10px] font-mono text-cyan-200 whitespace-nowrap shadow-xl">
                  {phase.step}. {phase.title}
                </span>
              </button>
            );
          })}
        </div>

      </div>

    </div>
  );
}
