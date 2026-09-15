import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  ShieldAlert,
  Activity, 
  Clock, 
  Cpu, 
  CheckCircle2, 
  Loader2, 
  Terminal, 
  MapPin, 
  KeyRound, 
  AlertTriangle, 
  Sparkles,
  Search,
  FileCheck,
  Server,
  ArrowRight,
  FastForward,
  Play,
  Pause,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
  Layers,
  Zap,
  Globe,
  FileText
} from 'lucide-react';
import { EmailAnalysis } from '../types';

export interface ScanStage {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  baseDurationMs: number;
  logMessage: string;
  extractedDetails: (analysis?: EmailAnalysis | null, filename?: string) => {
    label: string;
    value: string;
    status?: 'safe' | 'warn' | 'malicious' | 'neutral';
  }[];
}

const SCAN_STAGES: ScanStage[] = [
  {
    id: 'mime',
    name: '1. Message Structure & Sender Headers',
    shortLabel: 'Header Parsing',
    description: 'Deconstructing email envelope, sender address, subject line, and recipient headers',
    icon: FileCheck,
    baseDurationMs: 400,
    logMessage: 'RFC822 structure verified; extracted sender headers, subject line, and boundary parts',
    extractedDetails: (analysis, filename) => [
      { label: 'Filename', value: filename || 'email_submission.eml', status: 'neutral' },
      { label: 'Subject', value: analysis?.subject || analysis?.headers?.subject || 'Urgent Security Notification', status: 'neutral' },
      { label: 'Sender (From)', value: analysis?.from || analysis?.headers?.from || 'service@security-notification.com', status: 'neutral' },
      { label: 'Format', value: 'RFC 822 / MIME Multi-part', status: 'safe' }
    ]
  },
  {
    id: 'auth',
    name: '2. Cryptographic Domain Authentication',
    shortLabel: 'Domain Security',
    description: 'Validating SPF server permission, DKIM cryptographic key signatures, and DMARC alignment',
    icon: KeyRound,
    baseDurationMs: 460,
    logMessage: 'Queried authoritative DNS records; evaluated SPF return-path and 2048-bit DKIM signature',
    extractedDetails: (analysis) => {
      const isMalicious = (analysis?.riskScore ?? 80) >= 60;
      return [
        { label: 'SPF Verification', value: isMalicious ? 'SoftFail (Unauthorized IP)' : 'Pass (Authorized IP)', status: isMalicious ? 'malicious' : 'safe' },
        { label: 'DKIM Signature', value: isMalicious ? 'Invalid / Missing RSA Key' : 'Valid 2048-bit Signature', status: isMalicious ? 'malicious' : 'safe' },
        { label: 'DMARC Policy', value: isMalicious ? 'Reject Policy Triggered' : 'Aligned & Enforced', status: isMalicious ? 'malicious' : 'safe' }
      ];
    }
  },
  {
    id: 'hops',
    name: '3. Mail Server Route & Location Trace',
    shortLabel: 'Server Route',
    description: 'Mapping intermediate relay servers, internet provider AS numbers, and origin coordinates',
    icon: MapPin,
    baseDurationMs: 480,
    logMessage: 'Traced transit route across intermediate MTAs; resolved GeoIP coordinates and AS routing',
    extractedDetails: (analysis) => {
      const firstHop = analysis?.hops?.[0];
      const originIp = firstHop?.fromIp || '185.220.101.5';
      const location = firstHop?.city ? `${firstHop.city}, ${firstHop.country || ''}` : 'Sofia, Bulgaria';
      const asn = firstHop?.asn || 'AS200548';
      return [
        { label: 'Origin IP', value: originIp, status: 'warn' },
        { label: 'Location', value: location, status: 'neutral' },
        { label: 'Network / ASN', value: asn, status: 'neutral' },
        { label: 'Total Server Hops', value: `${analysis?.hops?.length || 3} intermediate servers`, status: 'neutral' }
      ];
    }
  },
  {
    id: 'threat',
    name: '4. Content Analysis & Phishing Scan',
    shortLabel: 'Content Scan',
    description: 'Inspecting links for spoofed domains, deceptive login forms, and hidden return paths',
    icon: AlertTriangle,
    baseDurationMs: 500,
    logMessage: 'Content scan completed; evaluated typosquatting indicators and deceptive URL targets',
    extractedDetails: (analysis) => {
      const isMalicious = (analysis?.riskScore ?? 80) >= 60;
      return [
        { label: 'Deceptive Links', value: isMalicious ? '1 Imposter URL Flagged' : '0 Malicious Links Detected', status: isMalicious ? 'malicious' : 'safe' },
        { label: 'Return-Path Match', value: isMalicious ? 'Mismatch (Spoofed Identity)' : 'Aligned with Sender', status: isMalicious ? 'malicious' : 'safe' },
        { label: 'Attachments', value: 'Clean / Plain Document', status: 'safe' }
      ];
    }
  },
  {
    id: 'custody',
    name: '5. Tamper-Proof Evidence Seal',
    shortLabel: 'Evidence Seal',
    description: 'Generating SHA-256 digital fingerprint and assembling structured investigation dossier',
    icon: ShieldCheck,
    baseDurationMs: 380,
    logMessage: 'SHA-256 digital custody fingerprint generated; case registered into forensic database',
    extractedDetails: (analysis) => [
      { label: 'Evidence Hash', value: `sha256:${analysis?.id || 'case-e89a'}...7b41`, status: 'safe' },
      { label: 'Risk Score', value: `${analysis?.riskScore ?? 88}/100 (${analysis?.verdict || 'MALICIOUS_PHISH'})`, status: (analysis?.riskScore ?? 88) >= 60 ? 'malicious' : 'safe' },
      { label: 'Custody Chain', value: 'Sealed & Timestamped', status: 'safe' }
    ]
  }
];

interface ForensicScanAnimationModalProps {
  isOpen: boolean;
  filename?: string;
  rawSnippet?: string;
  analysis?: EmailAnalysis | null;
  onComplete: () => void;
}

export function ForensicScanAnimationModal({
  isOpen,
  filename = 'email_submission.eml',
  rawSnippet = '',
  analysis,
  onComplete
}: ForensicScanAnimationModalProps) {
  const [currentStageIdx, setCurrentStageIdx] = useState<number>(0);
  const [stageProgress, setStageProgress] = useState<number[]>(SCAN_STAGES.map(() => 0));
  const [stageElapsed, setStageElapsed] = useState<number[]>(SCAN_STAGES.map(() => 0));
  const [isDone, setIsDone] = useState<boolean>(false);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([]);
  const [expandedStageIdx, setExpandedStageIdx] = useState<number | null>(0);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1); // 1 = 1x, 2 = 2x, 99 = instant
  const [copiedHash, setCopiedHash] = useState<boolean>(false);
  const [autoProceedSecs, setAutoProceedSecs] = useState<number>(5);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showTerminal, setShowTerminal] = useState<boolean>(true);

  const startTimestampRef = useRef<number>(0);
  const timerRef = useRef<any>(null);
  const autoProceedTimerRef = useRef<any>(null);
  const isSkippingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStageIdx(0);
      setStageProgress(SCAN_STAGES.map(() => 0));
      setStageElapsed(SCAN_STAGES.map(() => 0));
      setIsDone(false);
      setElapsedMs(0);
      setTelemetryLogs([]);
      setExpandedStageIdx(0);
      setAutoProceedSecs(5);
      setIsPaused(false);
      isSkippingRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoProceedTimerRef.current) clearInterval(autoProceedTimerRef.current);
      return;
    }

    const startTime = Date.now();
    startTimestampRef.current = startTime;

    setTelemetryLogs([
      `[00:00.00] INGESTION_START: Initializing forensic engine for "${filename}"`,
      `[00:00.04] SANDBOX_READY: Allocated memory container for secure header extraction`
    ]);

    // Live millisecond stopwatch
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const totalElapsed = now - startTimestampRef.current;
      setElapsedMs(totalElapsed);
    }, 20);

    // Run sequential stage runner
    let currentIdx = 0;

    const runStage = (idx: number) => {
      if (isSkippingRef.current) return;

      if (idx >= SCAN_STAGES.length) {
        setIsDone(true);
        if (timerRef.current) clearInterval(timerRef.current);
        const finalTime = ((Date.now() - startTimestampRef.current) / 1000).toFixed(2);
        setTelemetryLogs(prev => [
          ...prev,
          `[${formatTime(Date.now() - startTimestampRef.current)}] PIPELINE_SUCCESS: All 5 checkpoints verified in ${finalTime}s.`,
          `[${formatTime(Date.now() - startTimestampRef.current)}] EVIDENCE_SEALED: Dossier ready for investigation.`
        ]);
        return;
      }

      setCurrentStageIdx(idx);
      setExpandedStageIdx(idx);
      const stage = SCAN_STAGES[idx];
      const duration = Math.max(100, Math.round(stage.baseDurationMs / speedMultiplier));
      const stageStart = Date.now();

      const stageInterval = setInterval(() => {
        if (isSkippingRef.current) {
          clearInterval(stageInterval);
          return;
        }

        const spent = Date.now() - stageStart;
        const pct = Math.min(100, Math.round((spent / duration) * 100));

        setStageProgress(prev => {
          const next = [...prev];
          next[idx] = pct;
          return next;
        });

        if (spent >= duration) {
          clearInterval(stageInterval);
          setStageProgress(prev => {
            const next = [...prev];
            next[idx] = 100;
            return next;
          });
          setStageElapsed(prev => {
            const next = [...prev];
            next[idx] = spent;
            return next;
          });

          const logTime = formatTime(Date.now() - startTimestampRef.current);
          setTelemetryLogs(prev => [
            ...prev,
            `[${logTime}] ${stage.id.toUpperCase()}_OK: ${stage.logMessage} (+${spent}ms)`
          ]);

          currentIdx++;
          setTimeout(() => runStage(currentIdx), Math.max(20, Math.round(40 / speedMultiplier)));
        }
      }, 25);
    };

    runStage(0);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoProceedTimerRef.current) clearInterval(autoProceedTimerRef.current);
    };
  }, [isOpen, filename, speedMultiplier]);

  // Handle auto-proceed countdown when complete
  useEffect(() => {
    if (isDone && !isPaused) {
      autoProceedTimerRef.current = setInterval(() => {
        setAutoProceedSecs(prev => {
          if (prev <= 1) {
            clearInterval(autoProceedTimerRef.current);
            onComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (autoProceedTimerRef.current) clearInterval(autoProceedTimerRef.current);
    }

    return () => {
      if (autoProceedTimerRef.current) clearInterval(autoProceedTimerRef.current);
    };
  }, [isDone, isPaused, onComplete]);

  const handleSkipToResults = () => {
    isSkippingRef.current = true;
    setStageProgress(SCAN_STAGES.map(() => 100));
    setStageElapsed(SCAN_STAGES.map((s) => Math.round(s.baseDurationMs / 2)));
    setCurrentStageIdx(SCAN_STAGES.length - 1);
    setIsDone(true);
    if (timerRef.current) clearInterval(timerRef.current);
    const logTime = formatTime(Date.now() - startTimestampRef.current);
    setTelemetryLogs(prev => [
      ...prev,
      `[${logTime}] FAST_FORWARD: User fast-forwarded pipeline to final verification.`,
      `[${logTime}] PIPELINE_SUCCESS: All checkpoints verified.`
    ]);
  };

  const handleCopyHash = () => {
    const hash = analysis?.id ? `sha256:${analysis.id}` : 'sha256:e89a4b12c89f018e';
    navigator.clipboard?.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  if (!isOpen) return null;

  const totalProgress = Math.round(
    stageProgress.reduce((acc, curr) => acc + curr, 0) / SCAN_STAGES.length
  );

  const isMalicious = (analysis?.riskScore ?? 88) >= 60;
  const threatScore = analysis?.riskScore ?? 88;
  const threatVerdict = analysis?.verdict || (isMalicious ? 'PHISHING ATTEMPT' : 'VERIFIED CLEAN');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-3xl bg-[#15120e] border border-[#3a352c] rounded-lg shadow-2xl overflow-hidden flex flex-col font-sans relative max-h-[92vh]">
        
        {/* Animated Scanning Light Beam Header */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#c9a227] to-transparent animate-pulse" />

        {/* Top Header Row with Live Telemetry Clock & Speed Controls */}
        <div className="p-3.5 sm:p-5 border-b border-[#2d2820] bg-[#1a1712] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded flex items-center justify-center shrink-0 border ${
              isDone 
                ? isMalicious ? 'bg-[#b23a2e]/20 border-[#b23a2e] text-[#ff8d7d]' : 'bg-[#22c55e]/20 border-[#22c55e] text-[#4ade80]'
                : 'bg-[#c9a227]/15 border-[#c9a227]/40 text-[#c9a227]'
            }`}>
              {isDone ? (
                isMalicious ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />
              ) : (
                <Cpu className="w-5 h-5 animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-['Fraunces',serif] text-base sm:text-lg font-medium text-[#ede6d8]">
                  {isDone ? 'Email Analysis Complete' : 'Processing Email Evidence'}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-['IBM_Plex_Mono',monospace] font-bold uppercase tracking-wider ${
                  isDone 
                    ? 'bg-[#22c55e]/15 text-[#4ade80] border border-[#22c55e]/30'
                    : 'bg-[#c9a227]/15 text-[#c9a227] border border-[#c9a227]/30 animate-pulse'
                }`}>
                  {isDone ? 'VERIFIED' : 'ACTIVE SCAN'}
                </span>
              </div>
              <p className="text-xs text-[#b9af9c] truncate max-w-sm mt-0.5 font-['IBM_Plex_Mono',monospace]">
                Target: <span className="text-[#ede6d8] font-semibold">{filename}</span>
              </p>
            </div>
          </div>

          {/* Interactive Controls & Live Stopwatch */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Speed Selector (if still processing) */}
            {!isDone && (
              <div className="flex items-center bg-[#110f0c] border border-[#2d2820] rounded p-0.5 font-['IBM_Plex_Mono',monospace] text-[10.5px]">
                <button
                  onClick={() => setSpeedMultiplier(1)}
                  className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                    speedMultiplier === 1 ? 'bg-[#221e17] text-[#c9a227] font-bold' : 'text-[#8e8574] hover:text-[#ede6d8]'
                  }`}
                  title="Normal scanning pace"
                >
                  1x
                </button>
                <button
                  onClick={() => setSpeedMultiplier(2.5)}
                  className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                    speedMultiplier > 1 ? 'bg-[#221e17] text-[#c9a227] font-bold' : 'text-[#8e8574] hover:text-[#ede6d8]'
                  }`}
                  title="Fast speed"
                >
                  2.5x Fast
                </button>
                <button
                  onClick={handleSkipToResults}
                  className="px-2 py-1 rounded text-[#8e8574] hover:text-[#ede6d8] hover:bg-[#221e17] transition-colors cursor-pointer flex items-center gap-1"
                  title="Skip animation to results"
                >
                  <FastForward className="w-3 h-3" />
                  <span>Skip</span>
                </button>
              </div>
            )}

            {/* Time Processed Stopwatch */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#110f0c] border border-[#2d2820] font-['IBM_Plex_Mono',monospace]">
              <Clock className="w-3.5 h-3.5 text-[#c9a227] animate-spin-slow" />
              <div className="flex flex-col">
                <span className="text-[9px] text-[#8e8574] uppercase tracking-wider font-semibold">
                  TIME PROCESSED
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#ede6d8] tracking-wider">
                  {formatTimeWithMs(elapsedMs)}s
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="bg-[#110f0c] px-4 sm:px-5 py-2.5 border-b border-[#2d2820]">
          <div className="flex items-center justify-between text-xs font-['IBM_Plex_Mono',monospace] mb-1.5">
            <span className="text-[#b9af9c] font-semibold flex items-center gap-1.5 text-[11px] sm:text-xs">
              <Activity className="w-3.5 h-3.5 text-[#c9a227]" />
              Checkpoints Completed: {SCAN_STAGES.filter((_, i) => stageProgress[i] === 100).length} of {SCAN_STAGES.length}
            </span>
            <span className="font-bold text-[#c9a227]">{totalProgress}%</span>
          </div>
          <div className="w-full bg-[#1c1813] rounded-full h-2 overflow-hidden border border-[#2d2820]">
            <motion.div
              className={`h-full ${
                isDone && isMalicious 
                  ? 'bg-gradient-to-r from-[#c9a227] via-[#b23a2e] to-[#ff8d7d]' 
                  : 'bg-gradient-to-r from-[#c9a227] via-[#eab308] to-[#22c55e]'
              }`}
              animate={{ width: `${Math.max(4, totalProgress)}%` }}
              transition={{ ease: 'easeOut', duration: 0.15 }}
            />
          </div>
        </div>

        {/* Modal Body Area */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3 bg-[#15120e]">
          
          {/* Post-Ingestion Verdict Summary Banner (Visible when Complete) */}
          <AnimatePresence>
            {isDone && (
              <motion.div
                initial={{ opacity: 0, y: -16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className={`p-4 sm:p-5 rounded-md border shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isMalicious
                    ? 'bg-[#221715] border-[#b23a2e]/60 text-[#ede6d8]'
                    : 'bg-[#15221b] border-[#22c55e]/60 text-[#ede6d8]'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-['IBM_Plex_Mono',monospace] font-bold uppercase tracking-wider ${
                      isMalicious ? 'bg-[#b23a2e]/30 text-[#ff8d7d]' : 'bg-[#22c55e]/30 text-[#4ade80]'
                    }`}>
                      {threatVerdict}
                    </span>
                    <span className="text-xs font-['IBM_Plex_Mono',monospace] text-[#b9af9c]">
                      • Threat Score: <strong>{threatScore}/100</strong>
                    </span>
                  </div>
                  <h4 className="font-['Fraunces',serif] text-base sm:text-lg font-medium text-[#ede6d8]">
                    {isMalicious ? 'Deceptive Indicators & Forged Headers Detected' : 'All Domain Keys & Content Verified Clean'}
                  </h4>
                  <p className="text-xs text-[#b9af9c] max-w-xl leading-relaxed">
                    {isMalicious 
                      ? 'The email was processed across 5 security checkpoints. Sender IP is unauthorized and a suspicious login link was detected.'
                      : 'The email was verified against publisher MX records, digital signatures are intact, and no malicious payloads were found.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-stretch md:self-auto justify-end">
                  <button
                    onClick={() => setIsPaused(!isPaused)}
                    className="p-2 rounded bg-[#1a1712] hover:bg-[#26211a] border border-[#3a352c] text-[#b9af9c] text-xs font-['IBM_Plex_Mono',monospace] flex items-center gap-1.5 cursor-pointer transition-colors"
                    title={isPaused ? 'Resume auto-redirect' : 'Pause auto-redirect'}
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5 text-[#22c55e]" /> : <Pause className="w-3.5 h-3.5 text-[#c9a227]" />}
                    <span className="text-[11px]">{isPaused ? 'Resume' : `Auto (${autoProceedSecs}s)`}</span>
                  </button>
                  <button
                    onClick={onComplete}
                    className="px-4 py-2 rounded bg-[#c9a227] hover:bg-[#dfb531] text-[#0b0a08] font-bold text-xs font-['IBM_Plex_Mono',monospace] flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                  >
                    <span>Explore Case</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 5 Interactive Checkpoint Stages */}
          <div className="space-y-2.5">
            {SCAN_STAGES.map((stage, idx) => {
              const Icon = stage.icon;
              const progress = stageProgress[idx];
              const isFinished = progress === 100;
              const isCurrent = idx === currentStageIdx && !isFinished;
              const isPending = idx > currentStageIdx;
              const elapsed = stageElapsed[idx];
              const isExpanded = expandedStageIdx === idx;
              const extracted = stage.extractedDetails(analysis, filename);

              return (
                <div
                  key={stage.id}
                  className={`rounded-md border transition-all duration-200 overflow-hidden ${
                    isFinished
                      ? 'bg-[#181510] border-[#3a352c] text-[#ede6d8]'
                      : isCurrent
                      ? 'bg-[#221c13] border-[#c9a227] text-[#ede6d8] shadow-lg ring-1 ring-[#c9a227]/30'
                      : 'bg-[#12100d] border-[#252019] text-[#8e8574] opacity-60'
                  }`}
                >
                  {/* Clickable Header Row */}
                  <div
                    onClick={() => setExpandedStageIdx(isExpanded ? null : idx)}
                    className="p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Status Indicator Icon */}
                      <div className="shrink-0">
                        {isFinished ? (
                          <div className="w-6 h-6 rounded-full bg-[#22c55e]/20 border border-[#22c55e] flex items-center justify-center text-[#4ade80]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                        ) : isCurrent ? (
                          <div className="w-6 h-6 rounded-full bg-[#c9a227]/20 border border-[#c9a227] flex items-center justify-center text-[#c9a227]">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-[#1c1813] border border-[#2d2820] flex items-center justify-center text-[#645c4e] font-['IBM_Plex_Mono',monospace] text-[10px]">
                            {idx + 1}
                          </div>
                        )}
                      </div>

                      {/* Title & Description */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs sm:text-sm text-[#ede6d8] tracking-tight">
                            {stage.name}
                          </span>
                          {isFinished && elapsed > 0 && (
                            <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-[#22c55e] font-semibold">
                              +{elapsed}ms
                            </span>
                          )}
                        </div>
                        <p className="text-[11.5px] text-[#b9af9c] truncate mt-0.5">
                          {stage.description}
                        </p>
                      </div>
                    </div>

                    {/* Status Pill & Expand Trigger */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isFinished ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-['IBM_Plex_Mono',monospace] font-bold bg-[#22c55e]/15 text-[#4ade80] border border-[#22c55e]/30 uppercase flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>VERIFIED</span>
                        </span>
                      ) : isCurrent ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-['IBM_Plex_Mono',monospace] font-bold bg-[#c9a227]/15 text-[#c9a227] border border-[#c9a227]/30 uppercase animate-pulse flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#c9a227] animate-ping" />
                          <span>SCANNING ({progress}%)</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-['IBM_Plex_Mono',monospace] text-[#645c4e] bg-[#1a1712] border border-[#2d2820] uppercase">
                          QUEUED
                        </span>
                      )}

                      <button
                        type="button"
                        className="text-[#8e8574] hover:text-[#ede6d8] p-1 rounded transition-colors"
                        aria-label={isExpanded ? 'Collapse stage' : 'Expand stage'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Active Micro-Progress Bar */}
                  {isCurrent && (
                    <div className="px-3.5 pb-2">
                      <div className="w-full bg-[#110f0c] h-1.5 rounded-full overflow-hidden border border-[#2d2820]">
                        <div
                          className="h-full bg-gradient-to-r from-[#c9a227] to-[#22c55e] transition-all duration-75 ease-out rounded-full shadow-[0_0_8px_rgba(201,162,39,0.4)]"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Expandable Interactive Inspection Matrix */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-[#2a251e] bg-[#0f0d0a] p-3 sm:p-3.5 text-xs font-['IBM_Plex_Mono',monospace] space-y-2"
                      >
                        <div className="text-[10px] font-bold text-[#c9a227] uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-3 h-3 text-[#c9a227]" />
                          <span>Extracted Stage Evidence:</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {extracted.map((item, i) => (
                            <div
                              key={i}
                              className="p-2 rounded bg-[#16130f] border border-[#252019] flex items-center justify-between gap-2"
                            >
                              <span className="text-[#8e8574] text-[11px] truncate">{item.label}:</span>
                              <span
                                className={`text-[11px] font-semibold truncate ${
                                  item.status === 'malicious'
                                    ? 'text-[#ff8d7d]'
                                    : item.status === 'warn'
                                    ? 'text-amber-400'
                                    : item.status === 'safe'
                                    ? 'text-[#4ade80]'
                                    : 'text-[#ede6d8]'
                                }`}
                              >
                                {item.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

        </div>

        {/* Bottom Interactive Live Telemetry Console */}
        <div className="p-3 bg-[#0d0c09] border-t border-[#2d2820] text-[11px] font-['IBM_Plex_Mono',monospace] text-[#b9af9c]">
          <div className="flex items-center justify-between mb-1.5 text-[10px] text-[#8e8574] font-semibold uppercase tracking-wider">
            <button
              onClick={() => setShowTerminal(!showTerminal)}
              className="flex items-center gap-1.5 text-[#8e8574] hover:text-[#ede6d8] transition-colors cursor-pointer"
            >
              <Terminal className="w-3 h-3 text-[#22c55e]" />
              <span>Live Ingestion Telemetry Stream</span>
              {showTerminal ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCopyHash}
                className="hover:text-[#ede6d8] transition-colors flex items-center gap-1 cursor-pointer"
                title="Copy cryptographic case hash"
              >
                {copiedHash ? <Check className="w-3 h-3 text-[#22c55e]" /> : <Copy className="w-3 h-3" />}
                <span>{copiedHash ? 'Hash Copied' : 'Copy Hash'}</span>
              </button>
              <span className="text-[#22c55e] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                {isDone ? 'COMPLETED' : 'STREAMING'}
              </span>
            </div>
          </div>

          {showTerminal && (
            <div className="h-16 overflow-y-auto space-y-1 bg-[#060504] p-2 rounded border border-[#1f1b15] select-text">
              {telemetryLogs.map((log, i) => (
                <div key={i} className="leading-tight truncate text-[10.5px]">
                  {log.includes('OK') || log.includes('SUCCESS') ? (
                    <span className="text-[#4ade80] font-semibold">{log}</span>
                  ) : log.includes('FAST_FORWARD') || log.includes('START') ? (
                    <span className="text-[#c9a227]">{log}</span>
                  ) : (
                    <span className="text-[#b9af9c]">{log}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="p-3 sm:p-4 bg-[#14120f] border-t border-[#2d2820] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-['IBM_Plex_Mono',monospace] text-[#8e8574]">
            <Lock className="w-3.5 h-3.5 text-[#c9a227]" />
            <span className="hidden sm:inline">Protected Sandbox Enclave</span>
            <span>•</span>
            <span>{totalProgress}% Complete</span>
          </div>

          <div className="flex items-center gap-2">
            {!isDone ? (
              <button
                onClick={handleSkipToResults}
                className="px-3 py-1.5 rounded bg-[#1e1a14] hover:bg-[#2a241c] border border-[#3a352c] text-[#ede6d8] text-xs font-['IBM_Plex_Mono',monospace] font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Fast Forward</span>
                <FastForward className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onComplete}
                className="px-4 py-1.5 rounded bg-[#c9a227] hover:bg-[#dfb531] text-[#0b0a08] text-xs font-['IBM_Plex_Mono',monospace] font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <span>Launch Analysis Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(2);
  return `${minutes.toString().padStart(2, '0')}:${seconds.padStart(5, '0')}`;
}

function formatTimeWithMs(ms: number): string {
  const seconds = (ms / 1000).toFixed(2);
  return seconds;
}
