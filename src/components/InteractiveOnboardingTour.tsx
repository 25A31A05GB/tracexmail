import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  Check, 
  Compass, 
  ShieldCheck, 
  LayoutDashboard, 
  Upload, 
  Activity, 
  Network, 
  Search, 
  SlidersHorizontal,
  FileCheck2,
  HelpCircle,
  Play,
  RotateCcw,
  Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { NavTab } from './Sidebar';

export type TourStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

export interface TourStep {
  id: string;
  targetSelector: string;
  fallbackSelector?: string;
  targetTab?: NavTab;
  title: string;
  shortTag: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  whatYouCanDo: string;
  proTip?: string;
  placement?: 'bottom' | 'top' | 'right' | 'left' | 'auto';
  highlightPadding?: number;
}

export const ONBOARDING_TOUR_STEPS: TourStep[] = [
  {
    id: 'dashboard',
    targetSelector: '[data-tour="nav-dashboard"]',
    fallbackSelector: '#nav-btn-dashboard',
    targetTab: 'dashboard',
    title: 'Your Security Dashboard',
    shortTag: 'Home Base',
    icon: LayoutDashboard,
    description: 'This is your main command center. View live threat metrics, security alert counters, and recent email incidents at a glance.',
    whatYouCanDo: 'Monitor overall threat levels and track your organization’s email security posture in real time.',
    proTip: 'Quickly spot active phishing waves and urgent security escalations from here.',
    placement: 'right',
    highlightPadding: 6
  },
  {
    id: 'ingest',
    targetSelector: '[data-tour="nav-ingest"]',
    fallbackSelector: '#nav-btn-ingest',
    targetTab: 'ingest',
    title: 'Upload & Inspect Any Email',
    shortTag: 'Main Feature',
    icon: Upload,
    description: 'This is where you inspect suspicious emails. Drag and drop any .eml file or paste raw email headers to instantly detect phishing, spoofing, and scam links.',
    whatYouCanDo: 'Analyze emails with 5-stage automated forensics and receive an instant, plain-English security verdict.',
    proTip: 'You can also connect your Gmail inbox for automated continuous threat scanning.',
    placement: 'right',
    highlightPadding: 6
  },
  {
    id: 'overview',
    targetSelector: '[data-tour="nav-overview"]',
    fallbackSelector: '#nav-btn-overview',
    targetTab: 'overview',
    title: 'Forensic Analysis & Safety Verdict',
    shortTag: 'Evidence & Score',
    icon: Activity,
    description: 'See the complete breakdown: AI threat scores out of 100, cryptographic domain checks (SPF & DKIM), and human-friendly explanations.',
    whatYouCanDo: 'Review flagged links, inspect sender authenticity, and export tamper-evident forensic PDF reports.',
    proTip: 'Switch between "Human View" for simple guidance and "Analyst SOC" for technical deep-dives.',
    placement: 'right',
    highlightPadding: 6
  },
  {
    id: 'hops',
    targetSelector: '[data-tour="nav-hops"]',
    fallbackSelector: '#nav-btn-hops',
    targetTab: 'hops',
    title: 'Server Route & GeoIP Map',
    shortTag: 'Origin Traceroute',
    icon: Network,
    description: 'Trace where an email actually originated and follow every intermediate mail server it passed through across the globe.',
    whatYouCanDo: 'Unmask spoofed sender addresses by seeing the true origin IP and Autonomous System (ASN) route.',
    proTip: 'Identifies relay hops through VPNs, Tor exit nodes, and bulletproof hosting providers.',
    placement: 'right',
    highlightPadding: 6
  },
  {
    id: 'search',
    targetSelector: '[data-tour="header-search"]',
    fallbackSelector: '#btn-header-search',
    title: 'Quick Search & Command Bar',
    shortTag: 'Instant Search',
    icon: Search,
    description: 'Press ⌘K or click here to search through all your cases, senders, IP addresses, domains, and security tools instantly.',
    whatYouCanDo: 'Jump straight to any case, look up suspicious domains, or run fast actions without navigating menus.',
    proTip: 'Type a question or action in the command palette for instant navigation.',
    placement: 'bottom',
    highlightPadding: 6
  },
  {
    id: 'profile',
    targetSelector: '[data-tour="header-profile"]',
    fallbackSelector: '#btn-header-profile',
    title: 'Account, Security & Help',
    shortTag: 'Settings & Profile',
    icon: SlidersHorizontal,
    description: 'Manage your profile, enable two-factor authentication (MFA), lock your workspace for privacy, or take this tour again anytime.',
    whatYouCanDo: 'Update your account preferences, view keyboard shortcuts (?), and adjust security settings.',
    proTip: 'Need a refresher later? Click here and select "Take Tour Again".',
    placement: 'bottom',
    highlightPadding: 6
  }
];

interface InteractiveOnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onNavigateTab?: (tab: NavTab) => void;
  currentTab?: NavTab;
  userRole?: string;
  isInitialWelcome?: boolean;
}

export function InteractiveOnboardingTour({
  isOpen,
  onClose,
  onComplete,
  onNavigateTab,
  currentTab,
  userRole = 'analyst',
  isInitialWelcome = false
}: InteractiveOnboardingTourProps) {
  // Tour Stage: 'welcome' (dialog) | 'touring' (interactive spotlight) | 'completed' (celebration modal)
  const [stage, setStage] = useState<'welcome' | 'touring' | 'completed'>(
    isInitialWelcome ? 'welcome' : 'touring'
  );
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isElementVisible, setIsElementVisible] = useState<boolean>(false);
  const [tooltipPos, setTooltipPos] = useState<{
    top: number;
    left: number;
    arrowPlacement: 'top' | 'bottom' | 'left' | 'right';
    arrowOffset: number;
  }>({
    top: 0,
    left: 0,
    arrowPlacement: 'top',
    arrowOffset: 20
  });

  const tooltipRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const targetElementRef = useRef<HTMLElement | null>(null);

  const activeStep = ONBOARDING_TOUR_STEPS[currentStepIdx] || ONBOARDING_TOUR_STEPS[0];
  const isLastStep = currentStepIdx === ONBOARDING_TOUR_STEPS.length - 1;

  // Persist tour completion
  const recordTourState = useCallback(async (state: TourStatus) => {
    try {
      localStorage.setItem('tracexmail_tour_status', state);
      localStorage.setItem('tracexmail_tour_timestamp', new Date().toISOString());

      if (supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.auth.updateUser({
              data: {
                tour_status: state,
                tour_completed_at: state === 'completed' ? new Date().toISOString() : undefined
              }
            }).catch(() => null);
          }
        } catch {
          // background sync fallback
        }
      }
    } catch {
      // localStorage fallback
    }
  }, []);

  // Update target rect and smart positioning
  const updatePosition = useCallback(() => {
    if (!isOpen || stage !== 'touring') return;

    const step = ONBOARDING_TOUR_STEPS[currentStepIdx];
    if (!step) return;

    let el = document.querySelector(step.targetSelector) as HTMLElement | null;
    if (!el && step.fallbackSelector) {
      el = document.querySelector(step.fallbackSelector) as HTMLElement | null;
    }

    if (!el) {
      // If target element is not found, fallback to center of screen
      targetElementRef.current = null;
      setIsElementVisible(false);
      setTargetRect(null);

      const vpW = window.innerWidth;
      const vpH = window.innerHeight;
      const cardW = Math.min(380, vpW - 32);
      const cardH = 260;
      setTooltipPos({
        top: Math.max(16, (vpH - cardH) / 2),
        left: Math.max(16, (vpW - cardW) / 2),
        arrowPlacement: 'top',
        arrowOffset: cardW / 2
      });
      return;
    }

    targetElementRef.current = el;
    setIsElementVisible(true);

    const rect = el.getBoundingClientRect();
    setTargetRect(rect);

    // Calculate smart tooltip coordinates
    const padding = step.highlightPadding || 6;
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const isMobile = vpW < 640;
    const isTablet = vpW < 1024;

    const tooltipEl = tooltipRef.current;
    const cardW = tooltipEl ? tooltipEl.offsetWidth : (isMobile ? Math.min(340, vpW - 24) : 380);
    const cardH = tooltipEl ? tooltipEl.offsetHeight : 240;

    const targetCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };

    let chosenPlacement: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
    let top = 0;
    let left = 0;
    let arrowOffset = 24;

    // Check available space in each direction
    const spaceBelow = vpH - (rect.bottom + padding + 12);
    const spaceAbove = rect.top - padding - 12;
    const spaceRight = vpW - (rect.right + padding + 12);
    const spaceLeft = rect.left - padding - 12;

    if (isMobile) {
      // Mobile: prefer bottom or top, center horizontally bounded to screen
      if (spaceBelow >= cardH + 10 || spaceBelow >= spaceAbove) {
        chosenPlacement = 'bottom';
        top = Math.min(vpH - cardH - 12, rect.bottom + padding + 12);
      } else {
        chosenPlacement = 'top';
        top = Math.max(12, rect.top - padding - cardH - 12);
      }
      left = Math.max(12, Math.min(vpW - cardW - 12, targetCenter.x - cardW / 2));
      arrowOffset = Math.max(20, Math.min(cardW - 20, targetCenter.x - left));
    } else {
      // Desktop / Tablet: check requested placement or pick best
      const preferred = step.placement || 'right';

      if (preferred === 'right' && spaceRight >= cardW + 12) {
        chosenPlacement = 'right';
        left = rect.right + padding + 14;
        top = Math.max(16, Math.min(vpH - cardH - 16, targetCenter.y - cardH / 2));
        arrowOffset = Math.max(20, Math.min(cardH - 20, targetCenter.y - top));
      } else if (preferred === 'bottom' && spaceBelow >= cardH + 12) {
        chosenPlacement = 'bottom';
        top = rect.bottom + padding + 14;
        left = Math.max(16, Math.min(vpW - cardW - 16, targetCenter.x - cardW / 2));
        arrowOffset = Math.max(20, Math.min(cardW - 20, targetCenter.x - left));
      } else if (spaceRight >= cardW + 12) {
        chosenPlacement = 'right';
        left = rect.right + padding + 14;
        top = Math.max(16, Math.min(vpH - cardH - 16, targetCenter.y - cardH / 2));
        arrowOffset = Math.max(20, Math.min(cardH - 20, targetCenter.y - top));
      } else if (spaceBelow >= cardH + 12) {
        chosenPlacement = 'bottom';
        top = rect.bottom + padding + 14;
        left = Math.max(16, Math.min(vpW - cardW - 16, targetCenter.x - cardW / 2));
        arrowOffset = Math.max(20, Math.min(cardW - 20, targetCenter.x - left));
      } else if (spaceAbove >= cardH + 12) {
        chosenPlacement = 'top';
        top = rect.top - padding - cardH - 14;
        left = Math.max(16, Math.min(vpW - cardW - 16, targetCenter.x - cardW / 2));
        arrowOffset = Math.max(20, Math.min(cardW - 20, targetCenter.x - left));
      } else {
        chosenPlacement = 'left';
        left = Math.max(16, rect.left - padding - cardW - 14);
        top = Math.max(16, Math.min(vpH - cardH - 16, targetCenter.y - cardH / 2));
        arrowOffset = Math.max(20, Math.min(cardH - 20, targetCenter.y - top));
      }
    }

    setTooltipPos({
      top: Math.round(top),
      left: Math.round(left),
      arrowPlacement: chosenPlacement,
      arrowOffset: Math.round(arrowOffset)
    });
  }, [isOpen, stage, currentStepIdx]);

  // Navigate to step tab and scroll element into view
  const navigateToStep = useCallback((stepIdx: number) => {
    const step = ONBOARDING_TOUR_STEPS[stepIdx];
    if (!step) return;

    setCurrentStepIdx(stepIdx);

    if (step.targetTab && onNavigateTab && currentTab !== step.targetTab) {
      onNavigateTab(step.targetTab);
    }

    // Allow tab transition & DOM render, then scroll target into view
    setTimeout(() => {
      let el = document.querySelector(step.targetSelector) as HTMLElement | null;
      if (!el && step.fallbackSelector) {
        el = document.querySelector(step.fallbackSelector) as HTMLElement | null;
      }

      if (el) {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        } catch {
          // scroll fallback
        }
      }
      updatePosition();
    }, 120);
  }, [onNavigateTab, currentTab, updatePosition]);

  // Handle Step Advancement
  const handleNext = () => {
    if (isLastStep) {
      setStage('completed');
      recordTourState('completed');
    } else {
      navigateToStep(currentStepIdx + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIdx > 0) {
      navigateToStep(currentStepIdx - 1);
    }
  };

  const handleSkip = () => {
    recordTourState('skipped');
    onClose();
  };

  const handleStartTourFromWelcome = () => {
    setStage('touring');
    navigateToStep(0);
  };

  const handleFinishAll = () => {
    recordTourState('completed');
    onComplete();
    onClose();
  };

  // Keyboard navigation & resize listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      } else if (stage === 'touring') {
        if (e.key === 'ArrowRight' || e.key === 'Enter') {
          e.preventDefault();
          handleNext();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handlePrev();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, stage, currentStepIdx, handleNext, handlePrev, updatePosition]);

  // When tour opens or stage changes to touring, initialize step
  useEffect(() => {
    if (isOpen) {
      if (isInitialWelcome) {
        setStage('welcome');
      } else {
        setStage('touring');
        navigateToStep(0);
      }
    }
  }, [isOpen, isInitialWelcome]);

  // Periodic position refresher while active to handle layout shifts
  useEffect(() => {
    if (!isOpen || stage !== 'touring') return;
    updatePosition();
    const interval = setInterval(updatePosition, 300);
    return () => clearInterval(interval);
  }, [isOpen, stage, currentStepIdx, updatePosition]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {/* 1. WELCOME MODAL */}
      {stage === 'welcome' && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full max-w-lg bg-[#14110d] border border-[#383024] rounded-xl shadow-[0_30px_90px_rgba(0,0,0,0.95)] p-5 sm:p-7 text-[#ede6d8] font-sans my-auto overflow-hidden"
          >
            {/* Top decorative laser line */}
            <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-amber-500 via-[var(--stamp)] to-amber-400" />

            {/* Header Badge */}
            <div className="flex items-center justify-between pb-3.5 border-b border-[#29231a]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/25">
                  First-Time Orientation
                </span>
                <span className="text-[11px] font-mono text-[#8a8070]">1 Min Quick Tour</span>
              </div>

              <button
                onClick={handleSkip}
                className="p-1 rounded text-[#8a8070] hover:text-[#ede6d8] hover:bg-[#201b15] transition-colors cursor-pointer"
                title="Skip Tour"
                aria-label="Skip onboarding tour"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main Greeting */}
            <div className="pt-4 space-y-2">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2 shadow-inner">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>

              <h2 id="welcome-modal-title" className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
                Welcome to TraceXMail! 👋
              </h2>
              
              <p className="text-xs sm:text-sm text-[#b9af9c] leading-relaxed font-sans">
                TraceXMail helps you inspect suspicious emails, unmask spoofed senders, and catch phishing attacks before they cause harm.
              </p>
            </div>

            {/* 3 Core Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-4">
              <div className="p-2.5 rounded-lg bg-[#1a1612] border border-[#2d261e] space-y-1">
                <Upload className="w-4 h-4 text-amber-400" />
                <div className="font-semibold text-xs text-[#ede6d8]">1. Upload &amp; Scan</div>
                <p className="text-[10.5px] text-[#8a8070] leading-tight">Drag and drop any .eml file or raw text.</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[#1a1612] border border-[#2d261e] space-y-1">
                <Activity className="w-4 h-4 text-emerald-400" />
                <div className="font-semibold text-xs text-[#ede6d8]">2. Safety Verdict</div>
                <p className="text-[10.5px] text-[#8a8070] leading-tight">Instant threat score and SPF/DKIM verification.</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[#1a1612] border border-[#2d261e] space-y-1">
                <Network className="w-4 h-4 text-cyan-400" />
                <div className="font-semibold text-xs text-[#ede6d8]">3. Trace Server Route</div>
                <p className="text-[10.5px] text-[#8a8070] leading-tight">Follow every server hop across the globe.</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-[#29231a]">
              <button
                type="button"
                onClick={handleSkip}
                className="px-3.5 py-2 rounded text-xs font-mono text-[#8a8070] hover:text-[#ede6d8] transition-colors cursor-pointer text-center"
              >
                Skip &amp; explore on my own
              </button>

              <button
                type="button"
                onClick={handleStartTourFromWelcome}
                className="px-5 py-2.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <span>Start Quick Tour</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 2. INTERACTIVE SPOTLIGHT & SMART TOOLTIP CARD */}
      {stage === 'touring' && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-step-title"
          className="fixed inset-0 z-50 pointer-events-auto select-none"
        >
          {/* SVG Spotlight Mask */}
          <svg className="fixed inset-0 w-full h-full pointer-events-none z-10">
            <defs>
              <mask id="tour-spotlight-mask">
                {/* White fills everything (opaque) */}
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {/* Black cutout creates the transparent spotlight hole */}
                {targetRect && (
                  <rect
                    x={targetRect.left - (activeStep.highlightPadding || 6)}
                    y={targetRect.top - (activeStep.highlightPadding || 6)}
                    width={targetRect.width + (activeStep.highlightPadding || 6) * 2}
                    height={targetRect.height + (activeStep.highlightPadding || 6) * 2}
                    rx="8"
                    ry="8"
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            {/* Backdrop with mask cut-out */}
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.72)"
              mask="url(#tour-spotlight-mask)"
            />
          </svg>

          {/* Glowing Focus Ring around Target Element */}
          {targetRect && (
            <div
              className="fixed pointer-events-none z-20 transition-all duration-200 border-2 border-amber-400/90 rounded-lg shadow-[0_0_20px_rgba(245,158,11,0.45)]"
              style={{
                top: `${targetRect.top - (activeStep.highlightPadding || 6)}px`,
                left: `${targetRect.left - (activeStep.highlightPadding || 6)}px`,
                width: `${targetRect.width + (activeStep.highlightPadding || 6) * 2}px`,
                height: `${targetRect.height + (activeStep.highlightPadding || 6) * 2}px`,
              }}
            >
              {/* Subtle animated corner brackets */}
              <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-amber-300" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-amber-300" />
              <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-amber-300" />
              <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-amber-300" />
            </div>
          )}

          {/* Floating Tooltip Card */}
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            key={`step-${currentStepIdx}`}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed z-30 bg-[#16130f] border border-[#3a3225] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] p-4 sm:p-5 text-[#ede6d8] font-sans w-full max-w-[340px] sm:max-w-[380px] pointer-events-auto"
            style={{
              top: `${tooltipPos.top}px`,
              left: `${tooltipPos.left}px`,
            }}
          >
            {/* Step Counter Badge & Category */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#2b241c]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
                  {React.createElement(activeStep.icon, { className: 'w-3.5 h-3.5' })}
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 block leading-none">
                    {activeStep.shortTag}
                  </span>
                  <span className="text-[11px] font-mono text-[#8a8070]">
                    Step {currentStepIdx + 1} of {ONBOARDING_TOUR_STEPS.length}
                  </span>
                </div>
              </div>

              {/* Progress Dots */}
              <div className="flex items-center gap-1">
                {ONBOARDING_TOUR_STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => navigateToStep(i)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      i === currentStepIdx
                        ? 'w-4 bg-amber-400'
                        : i < currentStepIdx
                        ? 'w-1.5 bg-amber-400/50'
                        : 'w-1.5 bg-[#3a3225]'
                    }`}
                    title={`Go to step ${i + 1}`}
                    aria-label={`Go to step ${i + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Step Content */}
            <div className="pt-3 space-y-2">
              <h3 id="tour-step-title" className="font-display text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                {activeStep.title}
              </h3>

              <p className="text-xs text-[#b9af9c] leading-relaxed font-sans">
                {activeStep.description}
              </p>

              <div className="p-2.5 rounded bg-[#100e0b] border border-[#272118] space-y-1 text-[11px]">
                <div className="text-[9.5px] font-mono text-[#8a8070] uppercase tracking-wider font-bold">
                  What you can do here:
                </div>
                <p className="text-[#ede6d8] font-medium leading-normal">
                  {activeStep.whatYouCanDo}
                </p>
              </div>

              {activeStep.proTip && (
                <p className="text-[10.5px] text-[#8a8070] italic font-sans flex items-start gap-1.5">
                  <span className="text-amber-400 font-bold not-italic font-mono">Tip:</span>
                  <span>{activeStep.proTip}</span>
                </p>
              )}
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between gap-2 pt-3.5 mt-2 border-t border-[#2b241c]">
              <button
                type="button"
                onClick={handleSkip}
                className="text-[11px] font-mono text-[#8a8070] hover:text-[#ede6d8] transition-colors cursor-pointer px-1 py-1"
              >
                Skip Tour
              </button>

              <div className="flex items-center gap-2">
                {currentStepIdx > 0 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="px-2.5 py-1.5 rounded bg-[#201b15] hover:bg-[#2c251c] text-[#ede6d8] text-xs font-mono flex items-center gap-1 border border-[#3a3225] cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Back</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-3.5 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs font-mono flex items-center gap-1.5 shadow-md cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>{isLastStep ? 'Finish' : 'Next'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Keyboard shortcut hint */}
            <div className="text-[9.5px] font-mono text-[#6b6255] text-center pt-2">
              Press <kbd className="px-1 py-0.2 rounded bg-black/40 border border-[#3a3225] text-[#8a8070]">Esc</kbd> to skip · <kbd className="px-1 py-0.2 rounded bg-black/40 border border-[#3a3225] text-[#8a8070]">&rarr;</kbd> for next
            </div>
          </motion.div>
        </div>
      )}

      {/* 3. TOUR COMPLETED CELEBRATION MODAL */}
      {stage === 'completed' && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-completed-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full max-w-md bg-[#14110d] border border-[#383024] rounded-xl shadow-[0_30px_90px_rgba(0,0,0,0.95)] p-5 sm:p-6 text-[#ede6d8] font-sans my-auto overflow-hidden text-center"
          >
            {/* Top decorative laser line */}
            <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-400" />

            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
              <Check className="w-7 h-7" />
            </div>

            <h2 id="tour-completed-title" className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
              You&apos;re All Set! 🎉
            </h2>

            <p className="text-xs sm:text-sm text-[#b9af9c] mt-1.5 leading-relaxed font-sans max-w-sm mx-auto">
              You now know where everything is. You&apos;re ready to inspect emails, track threat routes, and secure your inbox.
            </p>

            {/* Quick Next Actions */}
            <div className="space-y-2 py-4 text-left">
              <button
                onClick={() => {
                  if (onNavigateTab) onNavigateTab('ingest');
                  handleFinishAll();
                }}
                className="w-full p-2.5 rounded-lg bg-[#1a1612] hover:bg-[#241f19] border border-[#2d261e] hover:border-amber-500/40 flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <Upload className="w-4 h-4 text-amber-400" />
                  <div>
                    <div className="font-semibold text-xs text-[#ede6d8] group-hover:text-white">
                      Upload an Email to Inspect
                    </div>
                    <div className="text-[10px] text-[#8a8070]">Drop a .eml file or paste raw headers</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#8a8070] group-hover:text-amber-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={() => {
                  if (onNavigateTab) onNavigateTab('dashboard');
                  handleFinishAll();
                }}
                className="w-full p-2.5 rounded-lg bg-[#1a1612] hover:bg-[#241f19] border border-[#2d261e] hover:border-amber-500/40 flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="font-semibold text-xs text-[#ede6d8] group-hover:text-white">
                      Open Threat Dashboard
                    </div>
                    <div className="text-[10px] text-[#8a8070]">View incident analytics &amp; active cases</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#8a8070] group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Bottom reminder & Done Button */}
            <div className="pt-2 border-t border-[#29231a] flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleFinishAll}
                className="w-full py-2.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <span className="text-[10px] text-[#8a8070] font-sans">
                You can restart this tour anytime from your Profile menu (top-right) or Settings.
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
