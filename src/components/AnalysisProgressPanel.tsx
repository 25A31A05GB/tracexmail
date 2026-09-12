import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle2, Loader2, Clock, ShieldCheck, Activity, Terminal } from 'lucide-react';
import { getWebSocketUrl } from '../utils/wsUrl';

export type StageKey = 'headers' | 'domain' | 'geo' | 'auth' | 'classify' | 'finalize';
export type StageStatus = 'pending' | 'active' | 'done';

export interface StageDefinition {
  key: StageKey;
  label: string;
  defaultDetail: string;
}

export const STAGES: StageDefinition[] = [
  {
    key: 'headers',
    label: 'RFC822 MIME & Header Parsing',
    defaultDetail: 'Extracting chronological relay hops, envelope addresses, and origin IP candidates'
  },
  {
    key: 'domain',
    label: 'Domain Intelligence & DNS/RDAP',
    defaultDetail: 'Querying authoritative DNS records (A, MX, SPF, DMARC) and WHOIS/RDAP registration'
  },
  {
    key: 'geo',
    label: 'MaxMind GeoIP & ASN Traceroute',
    defaultDetail: 'Resolving autonomous system numbers, network owner, and physical relay coordinates'
  },
  {
    key: 'auth',
    label: 'Cryptographic Authentication Verification',
    defaultDetail: 'Validating SPF alignment, DKIM cryptographic signatures, DMARC enforcement, and ARC chain'
  },
  {
    key: 'classify',
    label: 'Multi-Vector ML Threat Classification',
    defaultDetail: 'Evaluating Bayesian linguistic heuristics, threat vectors, and statistical risk probability'
  },
  {
    key: 'finalize',
    label: 'Evidence Vault & Case Assembly',
    defaultDetail: 'Finalizing forensic case record, SHA-256 custody chain, and IoC dispatch'
  }
];

export interface UseAnalysisProgressReturn {
  stageStatus: Record<StageKey, StageStatus>;
  stageDetail: Record<StageKey, string>;
  startedAt: number | null;
  requestId: string | null;
  start: () => string;
  finish: () => void;
}

/**
 * Shared hook to track real backend forensic analysis checkpoints via WebSockets.
 * Real checkpoints broadcasted from server:
 * - 'headers': RFC822 header parse loop completes
 * - 'domain': DNS/RDAP resolves
 * - 'geo': hop geolocation loop completes
 * - 'auth': SPF/DKIM/DMARC/ARC computed
 * - 'classify': ML classifier evaluates
 * - 'finalize': case record assembled
 */
export function useAnalysisProgress(): UseAnalysisProgressReturn {
  const [stageStatus, setStageStatus] = useState<Record<StageKey, StageStatus>>({
    headers: 'pending',
    domain: 'pending',
    geo: 'pending',
    auth: 'pending',
    classify: 'pending',
    finalize: 'pending'
  });

  const [stageDetail, setStageDetail] = useState<Record<StageKey, string>>({
    headers: '',
    domain: '',
    geo: '',
    auth: '',
    classify: '',
    finalize: ''
  });

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const currentRequestIdRef = useRef<string | null>(null);

  const start = useCallback((): string => {
    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    currentRequestIdRef.current = newId;
    setRequestId(newId);
    setStartedAt(Date.now());

    // Reset initial status: first stage active, rest pending
    setStageStatus({
      headers: 'active',
      domain: 'pending',
      geo: 'pending',
      auth: 'pending',
      classify: 'pending',
      finalize: 'pending'
    });

    setStageDetail({
      headers: 'Parsing RFC822 headers and relay chain...',
      domain: '',
      geo: '',
      auth: '',
      classify: '',
      finalize: ''
    });

    // Close any previous socket connection
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    try {
      const wsUrl = getWebSocketUrl('/ws/alerts');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (
            data &&
            data.type === 'ANALYSIS_PROGRESS' &&
            data.requestId === currentRequestIdRef.current
          ) {
            const stage = data.stage as StageKey;
            const status: StageStatus = data.status === 'active' ? 'active' : 'done';
            const label: string = data.label || '';

            const stageIndex = STAGES.findIndex((s) => s.key === stage);
            if (stageIndex !== -1) {
              setStageStatus((prev) => {
                const next = { ...prev };
                // All stages prior to this checkpoint are completed
                for (let i = 0; i < stageIndex; i++) {
                  next[STAGES[i].key] = 'done';
                }
                next[stage] = status;
                // If this checkpoint is done and next stage is pending, set next stage active
                if (
                  status === 'done' &&
                  stageIndex + 1 < STAGES.length &&
                  next[STAGES[stageIndex + 1].key] === 'pending'
                ) {
                  next[STAGES[stageIndex + 1].key] = 'active';
                }
                return next;
              });

              if (label) {
                setStageDetail((prev) => ({
                  ...prev,
                  [stage]: label
                }));
              }
            }
          }
        } catch (err) {
          console.warn('[useAnalysisProgress] Error parsing WS progress message:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('[useAnalysisProgress] WebSocket error on progress feed:', err);
      };
    } catch (err) {
      console.warn('[useAnalysisProgress] Failed to connect WebSocket for analysis progress:', err);
    }

    return newId;
  }, []);

  const finish = useCallback(() => {
    setStageStatus({
      headers: 'done',
      domain: 'done',
      geo: 'done',
      auth: 'done',
      classify: 'done',
      finalize: 'done'
    });

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    stageStatus,
    stageDetail,
    startedAt,
    requestId,
    start,
    finish
  };
}

export interface AnalysisProgressPanelProps {
  stageStatus: Record<StageKey, StageStatus>;
  stageDetail: Record<StageKey, string>;
  startedAt: number | null;
  className?: string;
}

export function AnalysisProgressPanel({
  stageStatus,
  stageDetail,
  startedAt,
  className = ''
}: AnalysisProgressPanelProps) {
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsedMs(0);
      return;
    }
    // Update elapsed timer every 100ms
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 100);
    return () => clearInterval(timer);
  }, [startedAt]);

  const doneCount = STAGES.filter((s) => stageStatus[s.key] === 'done').length;
  const totalCount = STAGES.length;
  const progressPct = Math.round((doneCount / totalCount) * 100);

  return (
    <div
      id="analysis-progress-panel"
      className={`bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl ${className}`}
    >
      {/* Header telemetry row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center">
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <span>Forensic Pipeline Execution</span>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            </div>
            <p className="text-[11px] text-slate-400">
              Live server-side checkpoints from Threat Intelligence, RDAP, GeoIP &amp; Machine Learning
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Checkpoint tally badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 rounded-md border border-slate-700/80 text-[11px] font-mono text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {doneCount}/{totalCount} checkpoints
            </span>
          </div>

          {/* Live elapsed time counter */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 rounded-md border border-slate-700/80 text-[11px] font-mono text-amber-400">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{(elapsedMs / 1000).toFixed(1)}s elapsed</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] font-mono text-slate-400">
          <span>PIPELINE PROGRESS</span>
          <span>{progressPct}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 rounded-full"
            style={{ width: `${Math.max(5, progressPct)}%` }}
          />
        </div>
      </div>

      {/* 6-Stage Checklist */}
      <div className="space-y-2">
        {STAGES.map((stage, idx) => {
          const status = stageStatus[stage.key] || 'pending';
          const isDone = status === 'done';
          const isActive = status === 'active';
          const isPending = status === 'pending';
          const detail = stageDetail[stage.key] || stage.defaultDetail;

          return (
            <div
              key={stage.key}
              id={`stage-${stage.key}`}
              className={`p-3 rounded-lg border flex items-start justify-between gap-3 transition-all duration-200 ${
                isDone
                  ? 'bg-slate-900/90 border-emerald-900/40 text-slate-200'
                  : isActive
                  ? 'bg-cyan-950/30 border-cyan-700/60 text-slate-100 shadow-sm shadow-cyan-950/50'
                  : 'bg-slate-950/40 border-slate-800/50 text-slate-500 opacity-70'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {/* Status icon */}
                <div className="shrink-0 mt-0.5">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full border border-slate-600 bg-slate-800" />
                    </div>
                  )}
                </div>

                {/* Stage info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      {idx + 1}. {stage.label}
                    </span>
                  </div>
                  <div
                    className={`text-[11px] mt-0.5 break-words font-mono ${
                      isActive
                        ? 'text-cyan-300 font-medium'
                        : isDone
                        ? 'text-emerald-400/90'
                        : 'text-slate-500'
                    }`}
                  >
                    {detail}
                  </div>
                </div>
              </div>

              {/* Status pill */}
              <div className="shrink-0 pt-0.5">
                {isDone ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950/70 text-emerald-400 border border-emerald-800/60 uppercase">
                    Done
                  </span>
                ) : isActive ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-950/70 text-cyan-300 border border-cyan-700/60 uppercase animate-pulse">
                    Running
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-slate-800/40 border border-slate-800 uppercase">
                    Pending
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
        <Terminal className="w-3 h-3 text-slate-500 shrink-0" />
        <span>Authoritative checkpoints emitted over WebSocket stream /ws/alerts</span>
      </div>
    </div>
  );
}
