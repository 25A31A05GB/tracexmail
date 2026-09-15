import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RotateCcw, 
  Sparkles, 
  ShieldAlert, 
  CheckCircle2, 
  Play, 
  Pause, 
  ChevronRight,
  ArrowRight,
  Zap,
  Terminal,
  Activity
} from 'lucide-react';

interface HeroEvidenceBoardProps {
  onExploreCase?: (sampleIndex: number) => void;
  onOpenConsole?: () => void;
  className?: string;
}

interface StepInfo {
  step: number;
  label: string;
  badge: string;
  detail: string;
  color: string;
}

const FORENSIC_STEPS: StepInfo[] = [
  {
    step: 1,
    label: 'Origin Socket Provenance',
    badge: 'HOP 01: UNMASKED',
    detail: 'Physical connection originated from 185.220.101.5 (Sofia, Tor Exit Relay AS200548)',
    color: '#ff6b5a'
  },
  {
    step: 2,
    label: 'Cryptographic Auth Failure',
    badge: 'AUTH: SPF/DKIM FAIL',
    detail: 'Sender IP is unauthorized in PayPal DNS SPF records; RSA signature verification failed',
    color: '#ff8d7d'
  },
  {
    step: 3,
    label: 'BGP Routing & ASN Attribution',
    badge: 'ASN: BULGARIAN RELAY',
    detail: 'Transit routed via AS200548 ZettaHost bulletproof hosting infrastructure',
    color: '#f59e0b'
  },
  {
    step: 4,
    label: 'Typosquat Domain Heuristics',
    badge: 'MIME: HOMOGRAPH ATTACK',
    detail: 'Header domain "paypal-secure-update.com" unmasked as deceptive lookalike decoy',
    color: '#ef4444'
  },
  {
    step: 5,
    label: 'Forensic Verdict Issued',
    badge: 'VERDICT: MALICIOUS PHISH',
    detail: 'Chain of evidence confirms targeted phishing attack • Score: 98/100 • Blocked',
    color: '#b23a2e'
  }
];

export const HeroEvidenceBoard: React.FC<HeroEvidenceBoardProps> = ({
  onExploreCase,
  onOpenConsole,
  className = ''
}) => {
  // Step progresses from 1 to 5
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [replayCount, setReplayCount] = useState<number>(0);

  // Auto-progress through the 5 forensic steps sequentially
  useEffect(() => {
    if (!isPlaying) return;

    const stepIntervals = [1200, 1400, 1400, 1400, 3800]; // Step durations
    const currentDuration = stepIntervals[activeStep - 1] || 1500;

    const timer = setTimeout(() => {
      if (activeStep < 5) {
        setActiveStep(prev => prev + 1);
        if (activeStep === 4) {
          // Trigger impact shake when moving to step 5 (stamp slam)
          setTimeout(() => {
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 240);
          }, 300);
        }
      } else {
        // Loop back to step 1 after lingering on final verdict
        setActiveStep(1);
      }
    }, currentDuration);

    return () => clearTimeout(timer);
  }, [activeStep, isPlaying, replayCount]);

  const handleClick = () => {
    if (onExploreCase) {
      onExploreCase(0);
    } else if (onOpenConsole) {
      onOpenConsole();
    }
  };

  const handleReplay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveStep(1);
    setIsPlaying(true);
    setReplayCount(prev => prev + 1);
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(prev => !prev);
  };

  const currentStepData = FORENSIC_STEPS[activeStep - 1] || FORENSIC_STEPS[0];

  return (
    <motion.div
      key={`board-${replayCount}`}
      onClick={handleClick}
      animate={isShaking ? { x: [-3, 3, -2, 2, 0], y: [2, -2, 1, 0] } : { x: 0, y: 0 }}
      transition={{ duration: 0.22 }}
      className={`relative w-full h-[430px] sm:h-[460px] rounded-[6px] border border-[#3a352c] bg-[#14100b] overflow-hidden shadow-2xl cursor-pointer select-none group flex flex-col justify-between ${className}`}
    >
      {/* Background Subtle Radar / Concentric Coordinate Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <svg className="w-full h-full" viewBox="0 0 1000 700" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="radarGridAnim" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="#c9a227" stopOpacity="0.35" />
              <stop offset="55%" stopColor="#b23a2e" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.05" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#radarGridAnim)" />
          {/* Concentric Coordinate Rings */}
          <circle cx="500" cy="350" r="110" fill="none" stroke="#ede6d8" strokeWidth="0.7" strokeDasharray="4 4" />
          <circle cx="500" cy="350" r="210" fill="none" stroke="#ede6d8" strokeWidth="0.7" strokeDasharray="4 4" />
          <circle cx="500" cy="350" r="320" fill="none" stroke="#ede6d8" strokeWidth="0.7" strokeDasharray="4 4" />
          <circle cx="500" cy="350" r="430" fill="none" stroke="#ede6d8" strokeWidth="0.7" strokeDasharray="4 4" />
          {/* Radial Crosshairs */}
          <line x1="500" y1="0" x2="500" y2="700" stroke="#ede6d8" strokeWidth="0.7" strokeDasharray="5 5" />
          <line x1="0" y1="350" x2="1000" y2="350" stroke="#ede6d8" strokeWidth="0.7" strokeDasharray="5 5" />
          <line x1="80" y1="56" x2="920" y2="644" stroke="#ede6d8" strokeWidth="0.4" strokeDasharray="4 4" />
          <line x1="80" y1="644" x2="920" y2="56" stroke="#ede6d8" strokeWidth="0.4" strokeDasharray="4 4" />
        </svg>
      </div>

      {/* Subtle Radar Scanner Beam sweeping across */}
      <motion.div
        className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-[#c9a227]/10 to-transparent pointer-events-none"
        animate={{ x: [-100, 700] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'linear' }}
      />

      {/* TOP HEADER CONTROLS & STEP INDICATOR */}
      <div className="relative z-30 px-3.5 pt-3 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-2 bg-[#1a1712]/95 border border-[#3a352c] px-2.5 py-1 rounded-[4px] shadow-sm">
          <Activity className="w-3.5 h-3.5 text-[#b23a2e] animate-pulse" />
          <span className="font-['IBM_Plex_Mono',monospace] text-[11px] font-bold text-[#ede6d8]">
            STAGE 0{activeStep}/05:
          </span>
          <span className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#ff8d7d] font-semibold">
            {currentStepData.badge}
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-[#1a1712]/95 border border-[#3a352c] p-0.5 rounded-[4px]">
          {/* Step dots */}
          <div className="flex items-center gap-1 px-2">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveStep(s);
                  setIsPlaying(false);
                }}
                className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                  s === activeStep
                    ? 'bg-[#ff6b5a] scale-125 shadow-[0_0_6px_#ff6b5a]'
                    : s < activeStep
                    ? 'bg-[#b23a2e]'
                    : 'bg-[#3a352c]'
                }`}
                title={`Jump to Step ${s}`}
              />
            ))}
          </div>

          <button
            onClick={togglePlay}
            className="p-1 rounded bg-[#26221b] hover:bg-[#342e24] text-[#ede6d8] text-[11px] transition-colors cursor-pointer"
            title={isPlaying ? 'Pause Sequence' : 'Resume Sequence'}
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 text-[#ff8d7d]" />}
          </button>

          <button
            onClick={handleReplay}
            className="p-1 rounded bg-[#26221b] hover:bg-[#342e24] text-[#8e8574] hover:text-[#ede6d8] text-[11px] transition-colors cursor-pointer"
            title="Replay Investigation From Step 1"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* MAIN EVIDENCE BOARD CANVAS (SVG THREADS + HTML CARDS) */}
      <div className="relative flex-1 w-full overflow-hidden">
        {/* SVG Animated Red Thread Strings */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none z-10" 
          viewBox="0 0 1000 700" 
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="stringShadowAccurate2" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="1.5" dy="3.5" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.85" />
            </filter>
            <linearGradient id="activeThreadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff8d7d" />
              <stop offset="50%" stopColor="#b23a2e" />
              <stop offset="100%" stopColor="#7a140b" />
            </linearGradient>
            <filter id="laserGlow2" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* THREAD 1: Pin 1 (220, 148) -> Pin 2 (565, 120) - Draws during Step 2+ */}
          {activeStep >= 2 && (
            <motion.path
              d="M 220 148 Q 385 185 565 120"
              fill="none"
              stroke={hoveredCard === 1 || hoveredCard === 2 ? '#ff604d' : 'url(#activeThreadGrad)'}
              strokeWidth={hoveredCard === 1 || hoveredCard === 2 ? '4.0' : '3.2'}
              strokeLinecap="round"
              filter="url(#stringShadowAccurate2)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
            />
          )}

          {/* THREAD 2: Pin 2 (565, 120) -> Pin 3 (705, 315) - Draws during Step 3+ */}
          {activeStep >= 3 && (
            <motion.path
              d="M 565 120 Q 615 205 705 315"
              fill="none"
              stroke={hoveredCard === 2 || hoveredCard === 3 ? '#ff604d' : 'url(#activeThreadGrad)'}
              strokeWidth={hoveredCard === 2 || hoveredCard === 3 ? '4.0' : '3.2'}
              strokeLinecap="round"
              filter="url(#stringShadowAccurate2)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
            />
          )}

          {/* THREAD 3: Pin 2 Hanging Loop - Draws during Step 3+ */}
          {activeStep >= 3 && (
            <motion.path
              d="M 565 120 Q 475 250 535 390"
              fill="none"
              stroke="#b23a2e"
              strokeWidth="2.2"
              strokeLinecap="round"
              filter="url(#stringShadowAccurate2)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.85 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          )}

          {/* THREAD 4: Pin 3 (705, 315) -> Pin 4 (320, 475) - Draws during Step 4+ */}
          {activeStep >= 4 && (
            <motion.path
              d="M 705 315 Q 520 425 320 475"
              fill="none"
              stroke={hoveredCard === 3 || hoveredCard === 4 ? '#ff604d' : 'url(#activeThreadGrad)'}
              strokeWidth={hoveredCard === 3 || hoveredCard === 4 ? '4.0' : '3.2'}
              strokeLinecap="round"
              filter="url(#stringShadowAccurate2)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.75, ease: 'easeOut' }}
            />
          )}

          {/* Traveling Signal Pulse Particle along the current active chain */}
          {activeStep >= 2 && (
            <motion.circle
              r="5"
              fill="#ffd54f"
              filter="url(#laserGlow2)"
              animate={
                activeStep === 2
                  ? { cx: [220, 390, 565], cy: [148, 172, 120], opacity: [0, 1, 0] }
                  : activeStep === 3
                  ? { cx: [220, 565, 705], cy: [148, 120, 315], opacity: [0, 1, 0] }
                  : { cx: [220, 390, 565, 630, 705, 520, 320], cy: [148, 172, 120, 210, 315, 420, 475], opacity: [0, 1, 1, 1, 1, 1, 0] }
              }
              transition={{
                duration: activeStep === 2 ? 1.4 : activeStep === 3 ? 1.8 : 2.6,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
          )}
        </svg>

        {/* CARD 1: 185.220.101.5 / TOR EXIT NODE (Revealed in Step 1) */}
        <div 
          className="absolute z-20 pointer-events-auto"
          style={{ left: '22.0%', top: '21.1%' }}
        >
          <AnimatePresence>
            {activeStep >= 1 && (
              <motion.div
                className="relative -translate-x-1/2 -translate-y-2"
                initial={{ opacity: 0, y: -45, scale: 0.7, rotate: 0 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotate: -4 }}
                transition={{ duration: 0.45, type: 'spring', damping: 12, stiffness: 180 }}
                onMouseEnter={() => setHoveredCard(1)}
                onMouseLeave={() => setHoveredCard(null)}
                whileHover={{ scale: 1.07, rotate: -2, zIndex: 40 }}
              >
                {/* Red Pushpin with Impact Ring */}
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#ff8375] via-[#b23a2e] to-[#4d100a] shadow-[0_3px_7px_rgba(0,0,0,0.7)] border border-[#ff9d91]/60" />
                  <div className="w-1.5 h-1 bg-[#1a1712] rounded-full opacity-60" />
                  {/* Pulse wave when pin hits */}
                  <motion.div
                    className="absolute -inset-1 rounded-full border border-[#ff6b5a]"
                    initial={{ scale: 0.8, opacity: 1 }}
                    animate={{ scale: 2.2, opacity: 0 }}
                    transition={{ duration: 0.6 }}
                  />
                </div>

                {/* Card Body */}
                <div className={`w-[145px] sm:w-[160px] bg-[#ede6d8] text-[#14120f] p-3 pt-4 rounded-[2px] shadow-[0_10px_22px_rgba(0,0,0,0.65)] border transition-all ${
                  activeStep === 1 || hoveredCard === 1 ? 'border-[#b23a2e] ring-2 ring-[#b23a2e]/40' : 'border-[#d6ccb8]'
                }`}>
                  <div className="font-['IBM_Plex_Mono',monospace] text-[12px] sm:text-[13px] font-bold text-[#14120f] tracking-tight truncate flex items-center justify-between">
                    <span>185.220.101.5</span>
                    {activeStep === 1 && <span className="w-1.5 h-1.5 rounded-full bg-[#b23a2e] animate-ping" />}
                  </div>
                  <div className="font-['IBM_Plex_Mono',monospace] text-[9.5px] font-bold text-[#b23a2e] uppercase tracking-wider mt-0.5">
                    TOR EXIT NODE
                  </div>
                  <div className="w-full h-1.5 bg-[#d8cfbe] rounded-[1px] mt-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-[#b23a2e]"
                      initial={{ width: 0 }}
                      animate={{ width: '92%' }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CARD 2: SPF · SOFTFAIL / UNAUTHORIZED SENDER (Revealed in Step 2) */}
        <div 
          className="absolute z-20 pointer-events-auto"
          style={{ left: '56.5%', top: '17.1%' }}
        >
          <AnimatePresence>
            {activeStep >= 2 && (
              <motion.div
                className="relative -translate-x-1/2 -translate-y-2"
                initial={{ opacity: 0, y: -45, scale: 0.7, rotate: 0 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotate: 3 }}
                transition={{ duration: 0.45, type: 'spring', damping: 12, stiffness: 180 }}
                onMouseEnter={() => setHoveredCard(2)}
                onMouseLeave={() => setHoveredCard(null)}
                whileHover={{ scale: 1.07, rotate: 5, zIndex: 40 }}
              >
                {/* Red Pushpin with Impact Ring */}
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#ff8375] via-[#b23a2e] to-[#4d100a] shadow-[0_3px_7px_rgba(0,0,0,0.7)] border border-[#ff9d91]/60" />
                  <div className="w-1.5 h-1 bg-[#1a1712] rounded-full opacity-60" />
                  <motion.div
                    className="absolute -inset-1 rounded-full border border-[#ff6b5a]"
                    initial={{ scale: 0.8, opacity: 1 }}
                    animate={{ scale: 2.2, opacity: 0 }}
                    transition={{ duration: 0.6 }}
                  />
                </div>

                {/* Card Body */}
                <div className={`w-[145px] sm:w-[160px] bg-[#ede6d8] text-[#14120f] p-3 pt-4 rounded-[2px] shadow-[0_10px_22px_rgba(0,0,0,0.65)] border transition-all ${
                  activeStep === 2 || hoveredCard === 2 ? 'border-[#b23a2e] ring-2 ring-[#b23a2e]/40' : 'border-[#d6ccb8]'
                }`}>
                  <div className="font-['IBM_Plex_Mono',monospace] text-[11.5px] sm:text-[12.5px] font-bold text-[#14120f] tracking-tight truncate flex items-center justify-between">
                    <span>SPF · SOFTFAIL</span>
                    {activeStep === 2 && <span className="w-1.5 h-1.5 rounded-full bg-[#b23a2e] animate-ping" />}
                  </div>
                  <div className="font-['IBM_Plex_Mono',monospace] text-[9.5px] font-bold text-[#b23a2e] uppercase tracking-wider mt-0.5">
                    UNAUTHORIZED SENDER
                  </div>
                  <div className="w-full h-1.5 bg-[#d8cfbe] rounded-[1px] mt-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-[#b23a2e]"
                      initial={{ width: 0 }}
                      animate={{ width: '75%' }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CARD 3: AS200548 / BULGARIA · ZETTAHOST (Revealed in Step 3) */}
        <div 
          className="absolute z-20 pointer-events-auto"
          style={{ left: '70.5%', top: '45.0%' }}
        >
          <AnimatePresence>
            {activeStep >= 3 && (
              <motion.div
                className="relative -translate-x-1/2 -translate-y-2"
                initial={{ opacity: 0, y: -45, scale: 0.7, rotate: 0 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotate: -2 }}
                transition={{ duration: 0.45, type: 'spring', damping: 12, stiffness: 180 }}
                onMouseEnter={() => setHoveredCard(3)}
                onMouseLeave={() => setHoveredCard(null)}
                whileHover={{ scale: 1.07, rotate: 0, zIndex: 40 }}
              >
                {/* Red Pushpin with Impact Ring */}
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#ff8375] via-[#b23a2e] to-[#4d100a] shadow-[0_3px_7px_rgba(0,0,0,0.7)] border border-[#ff9d91]/60" />
                  <div className="w-1.5 h-1 bg-[#1a1712] rounded-full opacity-60" />
                  <motion.div
                    className="absolute -inset-1 rounded-full border border-[#ff6b5a]"
                    initial={{ scale: 0.8, opacity: 1 }}
                    animate={{ scale: 2.2, opacity: 0 }}
                    transition={{ duration: 0.6 }}
                  />
                </div>

                {/* Card Body */}
                <div className={`w-[145px] sm:w-[160px] bg-[#ede6d8] text-[#14120f] p-3 pt-4 rounded-[2px] shadow-[0_10px_22px_rgba(0,0,0,0.65)] border transition-all ${
                  activeStep === 3 || hoveredCard === 3 ? 'border-[#b23a2e] ring-2 ring-[#b23a2e]/40' : 'border-[#d6ccb8]'
                }`}>
                  <div className="font-['IBM_Plex_Mono',monospace] text-[12px] sm:text-[13px] font-bold text-[#14120f] tracking-tight truncate flex items-center justify-between">
                    <span>AS200548</span>
                    {activeStep === 3 && <span className="w-1.5 h-1.5 rounded-full bg-[#b23a2e] animate-ping" />}
                  </div>
                  <div className="font-['IBM_Plex_Mono',monospace] text-[9.5px] font-bold text-[#b23a2e] uppercase tracking-wider mt-0.5">
                    BULGARIA · ZETTAHOST
                  </div>
                  <div className="w-full h-1.5 bg-[#d8cfbe] rounded-[1px] mt-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-[#b23a2e]"
                      initial={{ width: 0 }}
                      animate={{ width: '55%' }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CARD 4: paypal-secure-update.... / TYPOSQUAT DOMAIN (Revealed in Step 4) */}
        <div 
          className="absolute z-20 pointer-events-auto"
          style={{ left: '32.0%', top: '67.8%' }}
        >
          <AnimatePresence>
            {activeStep >= 4 && (
              <motion.div
                className="relative -translate-x-1/2 -translate-y-2"
                initial={{ opacity: 0, y: -45, scale: 0.7, rotate: 0 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotate: 2.5 }}
                transition={{ duration: 0.45, type: 'spring', damping: 12, stiffness: 180 }}
                onMouseEnter={() => setHoveredCard(4)}
                onMouseLeave={() => setHoveredCard(null)}
                whileHover={{ scale: 1.07, rotate: 4, zIndex: 40 }}
              >
                {/* Red Pushpin with Impact Ring */}
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#ff8375] via-[#b23a2e] to-[#4d100a] shadow-[0_3px_7px_rgba(0,0,0,0.7)] border border-[#ff9d91]/60" />
                  <div className="w-1.5 h-1 bg-[#1a1712] rounded-full opacity-60" />
                  <motion.div
                    className="absolute -inset-1 rounded-full border border-[#ff6b5a]"
                    initial={{ scale: 0.8, opacity: 1 }}
                    animate={{ scale: 2.2, opacity: 0 }}
                    transition={{ duration: 0.6 }}
                  />
                </div>

                {/* Card Body */}
                <div className={`w-[145px] sm:w-[160px] bg-[#ede6d8] text-[#14120f] p-3 pt-4 rounded-[2px] shadow-[0_10px_22px_rgba(0,0,0,0.65)] border transition-all ${
                  activeStep === 4 || hoveredCard === 4 ? 'border-[#b23a2e] ring-2 ring-[#b23a2e]/40' : 'border-[#d6ccb8]'
                }`}>
                  <div className="font-['IBM_Plex_Mono',monospace] text-[10.5px] sm:text-[11.5px] font-bold text-[#14120f] tracking-tight truncate flex items-center justify-between">
                    <span>paypal-secure-update...</span>
                    {activeStep === 4 && <span className="w-1.5 h-1.5 rounded-full bg-[#b23a2e] animate-ping" />}
                  </div>
                  <div className="font-['IBM_Plex_Mono',monospace] text-[9.5px] font-bold text-[#b23a2e] uppercase tracking-wider mt-0.5">
                    TYPOSQUAT DOMAIN
                  </div>
                  <div className="w-full h-1.5 bg-[#d8cfbe] rounded-[1px] mt-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-[#b23a2e]"
                      initial={{ width: 0 }}
                      animate={{ width: '88%' }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* STEP 5: SLAM-DOWN CIRCULAR RUBBER STAMP */}
        <AnimatePresence>
          {activeStep >= 5 && (
            <motion.div
              className="absolute bottom-[16px] sm:bottom-[24px] right-[24px] sm:right-[40px] z-20 pointer-events-none"
              initial={{ opacity: 0, scale: 3.0, rotate: -45 }}
              animate={{ opacity: 1, scale: 1, rotate: -11 }}
              transition={{ duration: 0.38, type: 'spring', damping: 9, stiffness: 240 }}
            >
              <div className="relative w-[126px] sm:w-[138px] h-[126px] sm:h-[138px] rounded-full border-[3.5px] border-[#b23a2e]/90 p-1 flex items-center justify-center shadow-[0_0_22px_rgba(178,58,46,0.45)] backdrop-blur-[0.5px]">
                <div className="w-full h-full rounded-full border-[1.5px] border-[#b23a2e]/75 border-dashed flex flex-col items-center justify-center text-center p-2">
                  <span className="font-['IBM_Plex_Mono',monospace] text-[10.5px] font-extrabold text-[#b23a2e] tracking-widest uppercase leading-tight">
                    VERDICT
                  </span>
                  <span className="font-['IBM_Plex_Mono',monospace] text-[12.5px] font-extrabold text-[#b23a2e] tracking-wider uppercase leading-tight my-0.5">
                    PHISHING
                  </span>
                  <span className="font-['IBM_Plex_Mono',monospace] text-[10px] font-extrabold text-[#b23a2e] tracking-widest uppercase leading-tight">
                    CONFIRMED
                  </span>
                </div>

                {/* Ink Impact Shockwave Ring */}
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-[#b23a2e]"
                  initial={{ scale: 1, opacity: 1 }}
                  animate={{ scale: 1.85, opacity: 0 }}
                  transition={{ duration: 0.75, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* BOTTOM FORENSIC DETAIL HUD TICKER */}
      <div className="relative z-30 px-3.5 pb-3 pt-1 border-t border-[#3a352c]/70 bg-[#16120d]/95 flex items-center justify-between text-[11.5px] font-['IBM_Plex_Mono',monospace]">
        <div className="flex items-center gap-2 truncate pr-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#b23a2e] shrink-0" />
          <span className="text-[#8e8574] shrink-0 uppercase">Analysis:</span>
          <span className="text-[#ede6d8] truncate font-medium">
            {currentStepData.detail}
          </span>
        </div>
        <span className="text-[#b9af9c] group-hover:text-[#ede6d8] font-semibold shrink-0 flex items-center gap-1 transition-colors text-[11px]">
          Inspect in Console
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </motion.div>
  );
};
