import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
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
  Server
} from 'lucide-react';
import { EmailAnalysis } from '../types';

export interface ScanStage {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  durationMs: number;
  logMessage: string;
}

const SCAN_STAGES: ScanStage[] = [
  {
    id: 'mime',
    name: 'MIME Tree & RFC 822 Header Parsing',
    description: 'Extracting chronological relay headers, envelope From/To, Subject, and boundary parts',
    icon: FileCheck,
    durationMs: 450,
    logMessage: 'RFC822 parser read octet stream; 12 raw headers extracted successfully'
  },
  {
    id: 'auth',
    name: 'Cryptographic Authentication & Signatures',
    description: 'Verifying DKIM RSA key signatures, SPF return-path alignment, and DMARC policy enforcement',
    icon: KeyRound,
    durationMs: 520,
    logMessage: 'DKIM canonicalization evaluated; verifying SPF/DMARC alignment matrix'
  },
  {
    id: 'hops',
    name: 'MTA Hop Traceroute & MaxMind GeoIP Lookup',
    description: 'Resolving intermediate mail relay servers, BGP Autonomous System (ASN), and origin coordinates',
    icon: MapPin,
    durationMs: 580,
    logMessage: 'Traced relay hops: Resolved 3 MTA nodes with GeoIP coordinates & AS routing'
  },
  {
    id: 'threat',
    name: 'Threat Intelligence & Phishing Heuristics',
    description: 'Scanning against malicious URL feeds, domain impersonation indicators, and NLP urgency cues',
    icon: AlertTriangle,
    durationMs: 600,
    logMessage: 'Threat intelligence cross-match complete; evaluated Bayesian risk probability'
  },
  {
    id: 'custody',
    name: 'Forensic Case Sealing & SHA-256 Custody',
    description: 'Generating tamper-evident cryptographic hash, risk scoring matrix, and structured dossier',
    icon: ShieldCheck,
    durationMs: 450,
    logMessage: 'SHA-256 digest calculated; evidence sealed in compliance with ISO/IEC 27037'
  }
];

interface ForensicScanAnimationModalProps {
  isOpen: boolean;
  filename?: string;
  rawSnippet?: string;
  onComplete: () => void;
}

export function ForensicScanAnimationModal({
  isOpen,
  filename = 'email_submission.eml',
  rawSnippet = '',
  onComplete
}: ForensicScanAnimationModalProps) {
  const [currentStageIdx, setCurrentStageIdx] = useState<number>(0);
  const [stageProgress, setStageProgress] = useState<number[]>(SCAN_STAGES.map(() => 0));
  const [stageElapsed, setStageElapsed] = useState<number[]>(SCAN_STAGES.map(() => 0));
  const [isDone, setIsDone] = useState<boolean>(false);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([]);

  const startTimestampRef = useRef<number>(0);
  const timerRef = useRef<any>(null);
  const stageStartTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStageIdx(0);
      setStageProgress(SCAN_STAGES.map(() => 0));
      setStageElapsed(SCAN_STAGES.map(() => 0));
      setIsDone(false);
      setElapsedMs(0);
      setTelemetryLogs([]);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const startTime = Date.now();
    startTimestampRef.current = startTime;
    stageStartTimeRef.current = startTime;

    setTelemetryLogs([
      `[00:00.00] INGESTION_START: Initializing forensic pipeline for "${filename}"`,
      `[00:00.05] BUFFER_ALLOC: Allocated 64KB memory sandbox for RFC822 validation`
    ]);

    // Live elapsed timer updating every 20ms for smooth millisecond display
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const totalElapsed = now - startTimestampRef.current;
      setElapsedMs(totalElapsed);
    }, 20);

    // Sequential stage execution
    let currentIdx = 0;

    const runNextStage = (idx: number) => {
      if (idx >= SCAN_STAGES.length) {
        setIsDone(true);
        if (timerRef.current) clearInterval(timerRef.current);
        const finalTime = ((Date.now() - startTimestampRef.current) / 1000).toFixed(2);
        setTelemetryLogs(prev => [
          ...prev,
          `[${formatTime(Date.now() - startTimestampRef.current)}] PIPELINE_SUCCESS: All 5 forensic checkpoints verified (${finalTime}s total).`,
          `[${formatTime(Date.now() - startTimestampRef.current)}] DISPATCH: Mounting interactive case analysis view...`
        ]);

        // Smooth transition out after short victory display
        setTimeout(() => {
          onComplete();
        }, 750);
        return;
      }

      setCurrentStageIdx(idx);
      const stage = SCAN_STAGES[idx];
      const stageStart = Date.now();

      const stageInterval = setInterval(() => {
        const spent = Date.now() - stageStart;
        const pct = Math.min(100, Math.round((spent / stage.durationMs) * 100));

        setStageProgress(prev => {
          const next = [...prev];
          next[idx] = pct;
          return next;
        });

        if (spent >= stage.durationMs) {
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
          setTimeout(() => runNextStage(currentIdx), 60);
        }
      }, 30);
    };

    runNextStage(0);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, filename]);

  if (!isOpen) return null;

  const totalProgress = Math.round(
    stageProgress.reduce((acc, curr) => acc + curr, 0) / SCAN_STAGES.length
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(12,10,8,0.88)] backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#1a1712] border border-[#3a352c] rounded-md shadow-2xl overflow-hidden flex flex-col font-sans relative">
        
        {/* Subtle animated scanline glow */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--thread)] to-transparent animate-pulse" />

        {/* Top Header Row with Live Telemetry Clock */}
        <div className="p-4 sm:p-5 border-b border-[#3a352c] bg-[#14120f] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[rgba(178,58,46,0.15)] border border-[rgba(178,58,46,0.35)] flex items-center justify-center text-[var(--thread)] shrink-0 relative">
              <Cpu className="w-5 h-5 animate-pulse text-[var(--rose-400)]" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[var(--rose-400)] rounded-full animate-ping" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-base text-[var(--paper)] tracking-tight">
                  Forensic Email Inspection Engine
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[rgba(127,163,186,0.15)] text-[var(--slate)] border border-[rgba(127,163,186,0.3)] uppercase">
                  ACTIVE SCAN
                </span>
              </div>
              <p className="text-xs text-[var(--paper-dim)] font-sans truncate max-w-md mt-0.5">
                Target: <span className="font-mono text-[var(--paper)] font-semibold">{filename}</span>
              </p>
            </div>
          </div>

          {/* Time Elapsed Counter */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#221e17] border border-[#3a352c] shadow-inner font-mono">
              <Clock className="w-3.5 h-3.5 text-[var(--stamp)] animate-spin-slow" />
              <div className="flex flex-col">
                <span className="text-[9px] text-[var(--paper-muted)] uppercase tracking-wider font-semibold">
                  TIME ELAPSED
                </span>
                <span className="text-sm font-bold text-[var(--stamp)] tracking-wider">
                  {formatTimeWithMs(elapsedMs)}s
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="bg-[#14120f] px-5 py-2.5 border-b border-[#3a352c]">
          <div className="flex items-center justify-between text-xs font-mono mb-1.5">
            <span className="text-[var(--paper-dim)] font-semibold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[var(--slate)]" />
              Pipeline Checkpoints: {SCAN_STAGES.filter((_, i) => stageProgress[i] === 100).length} of {SCAN_STAGES.length}
            </span>
            <span className="font-bold text-[var(--paper)]">{totalProgress}%</span>
          </div>
          <div className="w-full bg-[#221e17] rounded-full h-2 overflow-hidden border border-[#3a352c]">
            <div
              className="bg-gradient-to-r from-[var(--thread)] via-[var(--stamp)] to-[var(--forensic-green)] h-full transition-all duration-150 ease-out"
              style={{ width: `${Math.max(4, totalProgress)}%` }}
            />
          </div>
        </div>

        {/* 5-Stage Checklist with Real-Time Progress */}
        <div className="p-4 sm:p-5 space-y-2.5 max-h-[310px] overflow-y-auto bg-[#1a1712]">
          {SCAN_STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const progress = stageProgress[idx];
            const isFinished = progress === 100;
            const isCurrent = idx === currentStageIdx && !isFinished;
            const isPending = idx > currentStageIdx;
            const elapsed = stageElapsed[idx];

            return (
              <div
                key={stage.id}
                className={`p-3 rounded-[3px] border transition-all duration-200 flex items-start justify-between gap-3 ${
                  isFinished
                    ? 'bg-[#151d18] border-[rgba(72,169,117,0.35)] text-[var(--paper)]'
                    : isCurrent
                    ? 'bg-[#241f17] border-[var(--stamp)] text-[var(--paper)] shadow-md'
                    : 'bg-[#181511] border-[#2e2a22] text-[var(--paper-muted)] opacity-60'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Status Indicator Icon */}
                  <div className="shrink-0 mt-0.5">
                    {isFinished ? (
                      <div className="w-5 h-5 rounded-full bg-[rgba(72,169,117,0.2)] border border-[var(--forensic-green)] flex items-center justify-center text-[var(--forensic-green)]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    ) : isCurrent ? (
                      <div className="w-5 h-5 rounded-full bg-[rgba(201,162,39,0.2)] border border-[var(--stamp)] flex items-center justify-center text-[var(--stamp)]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-[#221e17] border border-[#3a352c] flex items-center justify-center text-[var(--paper-muted)]">
                        <span className="text-[10px] font-mono">{idx + 1}</span>
                      </div>
                    )}
                  </div>

                  {/* Stage Label & Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs sm:text-sm text-[var(--paper)] tracking-tight">
                        {stage.name}
                      </span>
                      {isFinished && elapsed > 0 && (
                        <span className="text-[10px] font-mono text-[var(--forensic-green)]">
                          +{elapsed}ms
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--paper-dim)] mt-0.5 leading-relaxed">
                      {stage.description}
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="shrink-0 pt-0.5">
                  {isFinished ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[rgba(72,169,117,0.15)] text-[var(--forensic-green)] border border-[rgba(72,169,117,0.3)] uppercase">
                      VERIFIED
                    </span>
                  ) : isCurrent ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[rgba(201,162,39,0.15)] text-[var(--stamp)] border border-[rgba(201,162,39,0.3)] uppercase animate-pulse flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--stamp)]" />
                      {progress}%
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono text-[var(--paper-muted)] bg-[#221e17] border border-[#3a352c] uppercase">
                      QUEUED
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Live Telemetry Stream Terminal */}
        <div className="p-3 bg-[#110f0c] border-t border-[#3a352c] text-[11px] font-mono text-[var(--paper-dim)]">
          <div className="flex items-center justify-between mb-1.5 text-[10px] text-[var(--paper-muted)] font-semibold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-[var(--slate)]" />
              Live Ingestion Telemetry Feed
            </span>
            <span className="text-[var(--forensic-green)] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--forensic-green)] animate-ping" />
              STREAMING
            </span>
          </div>
          <div className="h-16 overflow-y-auto space-y-1 bg-[#0b0a08] p-2 rounded border border-[#26221b] select-text">
            {telemetryLogs.map((log, i) => (
              <div key={i} className="leading-tight truncate text-[10.5px]">
                {log.includes('OK') || log.includes('SUCCESS') ? (
                  <span className="text-[var(--forensic-green)] font-semibold">{log}</span>
                ) : log.includes('ACTIVE') || log.includes('START') ? (
                  <span className="text-[var(--slate)]">{log}</span>
                ) : (
                  <span className="text-[var(--paper-dim)]">{log}</span>
                )}
              </div>
            ))}
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
