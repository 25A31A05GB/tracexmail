import React, { useState } from 'react';
import { EmailAnalysis, EvidenceCardData } from '../types';
import { PlainLanguageSummaryCard } from './PlainLanguageSummaryCard';
import { JargonTooltip } from './JargonTooltip';
import { Interactive3DTiltCard, CyberThreatCore3D } from './3d';

interface ForensicCaseTwoPanelProps {
  analysis: EmailAnalysis;
  evidenceCardData: EvidenceCardData;
  effectiveHash: string;
  isTechnicalExpanded?: boolean;
  onToggleTechnicalExpanded?: (expanded: boolean) => void;
  onNavigateToMap?: () => void;
  onNavigateToGraph?: () => void;
  onNavigateToLogs?: () => void;
}

export function ForensicCaseTwoPanel({
  analysis,
  evidenceCardData,
  effectiveHash,
  isTechnicalExpanded: controlledIsTechnicalExpanded,
  onToggleTechnicalExpanded,
  onNavigateToMap,
  onNavigateToGraph,
  onNavigateToLogs,
}: ForensicCaseTwoPanelProps) {
  const [internalExpanded, setInternalExpanded] = useState<boolean>(true);
  const isTechnicalExpanded = controlledIsTechnicalExpanded !== undefined ? controlledIsTechnicalExpanded : internalExpanded;
  const setIsTechnicalExpanded = (expanded: boolean) => {
    setInternalExpanded(expanded);
    if (onToggleTechnicalExpanded) onToggleTechnicalExpanded(expanded);
  };

  const threatScore = analysis?.threatScore ?? analysis?.riskScore ?? evidenceCardData.score?.percent ?? 65;
  const verdictText = evidenceCardData.verdict?.text || (threatScore >= 70 ? 'MALICIOUS' : threatScore >= 40 ? 'SUSPICIOUS' : 'LEGITIMATE');

  return (
    <div className="space-y-5">
      {/* CORE FORENSIC DASHBOARD GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5 items-start">
        {/* LEFT COLUMN: The Evidence Card with 3D Interactive Tilt & Specular Physics */}
        <Interactive3DTiltCard maxTilt={5} scaleOnHover={1.01} glareOpacity={0.18} className="rounded-xl">
          <div className="rounded-xl border border-slate-700/80 bg-slate-900 p-5 select-text font-sans relative shadow-xl">
            {/* Subject & Rubber-Stamp Verdict */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-[15px] font-bold text-[#E7E4DA] leading-snug break-words">
                {evidenceCardData.subject}
              </h1>
            </div>
            <div
              className={`px-2.5 py-1 rounded text-center border-2 shrink-0 -rotate-6 shadow-sm ${
                evidenceCardData.verdict.status === 'good'
                  ? 'border-[#2E8B63] text-[#34D399] bg-[#2E8B63]/15'
                  : evidenceCardData.verdict.status === 'warn'
                  ? 'border-[#C68A34] text-[#FBBF24] bg-[#C68A34]/15'
                  : 'border-[#C6402F] text-[#F87171] bg-[#C6402F]/15'
              }`}
            >
              <div className="text-xs font-black tracking-wider leading-none">
                {evidenceCardData.verdict.text}
              </div>
              <div className="text-[9px] font-bold tracking-tight opacity-90 mt-0.5">
                {evidenceCardData.verdict.scoreLabel}
              </div>
            </div>
          </div>

          {/* Identity Rows: FROM, RETURN-PATH, REPLY-TO */}
          <div className="grid grid-cols-[110px_1fr] gap-y-1.5 items-start text-xs font-mono py-1">
            {evidenceCardData.identityRows.map((r, idx) => (
              <div key={idx} className="contents">
                <span className="text-[#8C94A0] font-semibold tracking-wider uppercase text-[11px] pt-0.5">
                  {r.k}
                </span>
                <span
                  className={`break-all font-medium ${
                    r.status === 'bad'
                      ? 'text-[#F87171] font-bold'
                      : r.status === 'warn'
                      ? 'text-[#FBBF24] font-bold'
                      : 'text-[#F1EFEA]'
                  }`}
                >
                  {r.v}
                </span>
              </div>
            ))}
          </div>

          {/* Section 1: AUTHENTICATION */}
          <div className="border-b border-[#2A2D34] pb-1.5 mb-3 mt-4 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider flex items-center justify-between">
            <span>AUTHENTICATION CHECKS</span>
            <span className="text-[10px] text-slate-400 font-normal">
              Hover (?) for definitions
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5 mb-1">
            {evidenceCardData.checks.map((c, idx) => (
              <div
                key={idx}
                className="rounded border border-[#2A2D34] bg-[#1D2027] p-2.5 text-center flex flex-col justify-between"
              >
                <div>
                  <div className="text-[10px] text-[#8C94A0] font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                    <JargonTooltip termKey={c.label} text={c.label} />
                  </div>
                  <div
                    className={`text-sm font-black mt-0.5 ${
                      c.status === 'fail'
                        ? 'text-[#F87171]'
                        : c.status === 'pass'
                        ? 'text-[#34D399]'
                        : 'text-[#FBBF24]'
                    }`}
                  >
                    {c.value}
                  </div>
                </div>
                <div className="text-[9px] text-slate-400 font-sans mt-1.5 leading-tight">
                  {c.label === 'SPF' ? 'Checks if sender is authorized by domain owner' :
                   c.label === 'DKIM' ? 'Verifies message was not altered in transit' :
                   'Tells receivers what to do if authentication fails'}
                </div>
              </div>
            ))}
          </div>

          {/* Section 2: ORIGIN & SENDER IP (Always visible for primary attribution) */}
          <div className="border-b border-[#2A2D34] pb-1.5 mb-3 mt-4 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider flex items-center justify-between">
            <span>{evidenceCardData.origin?.sectionTitle || 'ORIGIN & SENDER IP'}</span>
            <JargonTooltip termKey="ASN" text="Network Operator (ASN)" />
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-y-1.5 items-start text-xs font-mono py-1">
            {evidenceCardData.origin && (
              <>
                <span className="text-[#8C94A0] font-semibold tracking-wider uppercase text-[11px] pt-0.5">
                  FIRST-HOP IP
                </span>
                <span
                  className={`break-all font-bold ${
                    evidenceCardData.origin.ipStatus === 'bad'
                      ? 'text-[#F87171]'
                      : 'text-[#34D399]'
                  }`}
                >
                  {evidenceCardData.origin.ip}
                </span>

                <span className="text-[#8C94A0] font-semibold tracking-wider uppercase text-[11px] pt-0.5">
                  LOCATION
                </span>
                <div className="text-[#F1EFEA] flex items-center justify-between gap-2 flex-wrap">
                  <span className="break-all">{evidenceCardData.origin.location}</span>
                  {onNavigateToMap && (
                    <button
                      onClick={onNavigateToMap}
                      className="text-[#38BDF8] hover:text-[#7DD3FC] text-[11px] font-bold shrink-0 cursor-pointer ml-auto"
                    >
                      Maps ↗
                    </button>
                  )}
                </div>

                {evidenceCardData.origin.extraRows?.map((r, idx) => (
                  <div key={idx} className="contents">
                    <span className="text-[#8C94A0] font-semibold tracking-wider uppercase text-[11px] pt-0.5">
                      {r.k}
                    </span>
                    <span
                      className={`break-all font-bold ${
                        r.status === 'bad'
                          ? 'text-[#F87171]'
                          : r.status === 'warn'
                          ? 'text-[#FBBF24]'
                          : r.status === 'good'
                          ? 'text-[#34D399]'
                          : 'text-[#CBD5E1]'
                      }`}
                    >
                      {r.v}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Relay Chain Box (Progressive Disclosure - only expanded during technical deep dive) */}
          {isTechnicalExpanded && evidenceCardData.relay && (
            <div className="mt-2.5 p-2.5 rounded border border-[#2A2D34] bg-[#1D2027] text-xs flex items-center justify-between gap-3 flex-wrap">
              <span
                className="text-[#8C94A0] font-mono break-words leading-relaxed [&>b]:text-[#F1EFEA] [&>span]:text-[#F87171]"
                dangerouslySetInnerHTML={{ __html: evidenceCardData.relay.chain }}
              />
              {onNavigateToGraph && (
                <button
                  onClick={onNavigateToGraph}
                  className="text-[#38BDF8] hover:text-[#7DD3FC] text-[11px] font-bold shrink-0 cursor-pointer"
                >
                  Full graph ↗
                </button>
              )}
            </div>
          )}

          {/* Section 3: DOMAIN INTELLIGENCE */}
          <div className="border-b border-[#2A2D34] pb-1.5 mb-3 mt-4 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider flex items-center justify-between">
            <span>{evidenceCardData.entity?.sectionTitle || 'DOMAIN INTELLIGENCE'}</span>
            <JargonTooltip termKey="RDAP" text="Registrar & RDAP Info" />
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-y-1.5 items-start text-xs font-mono py-1">
            {evidenceCardData.entity?.rows.map((r, idx) => (
              <div key={idx} className="contents">
                <span className="text-[#8C94A0] font-semibold tracking-wider uppercase text-[11px] pt-0.5">
                  {r.k}
                </span>
                <span
                  className={`break-all ${
                    r.status === 'bad'
                      ? 'text-[#F87171] font-bold'
                      : r.status === 'warn'
                      ? 'text-[#FBBF24] font-bold'
                      : 'text-[#F1EFEA] font-medium'
                  }`}
                >
                  {r.v}
                </span>
              </div>
            ))}
          </div>

          {/* Domain Flags */}
          {evidenceCardData.entity?.flags && evidenceCardData.entity.flags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 pt-1">
              {evidenceCardData.entity.flags.map((f, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase border ${
                    f.level === 'red'
                      ? 'border-[#C6402F] text-[#F87171] bg-[#C6402F]/15'
                      : f.level === 'amber'
                      ? 'border-[#2A2D34] text-[#F1EFEA] bg-[#1D2027]'
                      : 'border-[#2E8B63] text-[#34D399] bg-[#2E8B63]/15'
                  }`}
                >
                  {f.text}
                </span>
              ))}
            </div>
          )}
          </div>
        </Interactive3DTiltCard>

        {/* RIGHT COLUMN: Separate bounded cards */}
        <div className="space-y-4">
          {/* 3D HOLOGRAPHIC THREAT CORE VISUALIZATION */}
          <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 p-4 font-sans select-text shadow-xl relative overflow-hidden group">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">
                  3D Holographic Threat Core
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                threatScore >= 70 ? 'border-rose-500/40 text-rose-400 bg-rose-950/40' :
                threatScore >= 40 ? 'border-amber-500/40 text-amber-400 bg-amber-950/40' :
                'border-emerald-500/40 text-emerald-400 bg-emerald-950/40'
              }`}>
                {verdictText} • {threatScore}/100
              </span>
            </div>
            
            <div className="h-44 w-full relative flex items-center justify-center bg-slate-950/60 rounded-lg border border-slate-800/80 overflow-hidden">
              <CyberThreatCore3D 
                threatScore={threatScore}
                verdict={verdictText}
                size="full"
                interactive={true}
                className="w-full h-full"
              />
              <div className="absolute bottom-2 left-2 pointer-events-none text-[9px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/60">
                Drag to rotate • Hover to pulse
              </div>
            </div>
          </div>

          {/* 1. AI CASE SUMMARY */}
          {evidenceCardData.aiSummary && (
            <div className="rounded-xl border border-slate-700/80 bg-slate-900 p-4 font-sans select-text shadow-sm">
              <div className="border-b border-slate-700 pb-1.5 mb-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                AI CASE SUMMARY
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-sans">
                {evidenceCardData.aiSummary.text}
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-800">
                <span className="font-sans text-slate-300 font-semibold">{evidenceCardData.aiSummary.engine}</span>
                {onNavigateToLogs && (
                  <button
                    onClick={onNavigateToLogs}
                    className="text-amber-400 hover:text-amber-300 font-bold text-[11px] cursor-pointer"
                  >
                    Full narrative ↗
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 2. LINKS AND ATTACHMENTS */}
          {evidenceCardData.findings && evidenceCardData.findings.length > 0 && (
            <div className="rounded-xl border border-slate-700/80 bg-slate-900 p-4 font-sans select-text shadow-sm">
              <div className="border-b border-slate-700 pb-1.5 mb-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                LINKS AND ATTACHMENTS
              </div>
              <div className="space-y-2">
                {evidenceCardData.findings.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 text-xs py-1 border-b border-slate-800 last:border-0"
                  >
                    <span className="text-slate-200 break-all font-mono">
                      {f.label}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans border shrink-0 ${
                        f.status === 'clean'
                          ? 'border-emerald-500/50 text-emerald-400 bg-emerald-950/30'
                          : 'border-rose-500/50 text-rose-400 bg-rose-950/30'
                      }`}
                    >
                      {f.badge}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. ML VERDICT */}
          {evidenceCardData.score && (
            <div className="rounded-xl border border-slate-700/80 bg-slate-900 p-4 font-sans select-text shadow-sm">
              <div className="border-b border-slate-700 pb-1.5 mb-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                ML CLASSIFICATION & CONFIDENCE
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">
                  {evidenceCardData.score.label}
                </span>
                <span
                  className={`font-bold ${
                    evidenceCardData.score.good ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {evidenceCardData.score.resultText} {evidenceCardData.score.resultLabel}
                </span>
              </div>
              <div className="w-full h-2 rounded bg-slate-950 border border-slate-800 overflow-hidden mt-2">
                <div
                  className={`h-full rounded ${
                    evidenceCardData.score.good
                      ? 'bg-emerald-400'
                      : 'bg-gradient-to-r from-amber-500 to-rose-500'
                  }`}
                  style={{
                    width: `${Math.max(4, Math.min(100, evidenceCardData.score.percent))}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* 4. SHA-256 LEDGER */}
          {isTechnicalExpanded && (
            <div className="rounded-xl border border-slate-700/80 bg-slate-900 p-4 font-sans select-text shadow-sm">
              <div className="border-b border-[#2A2D34] pb-1.5 mb-3 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">
                SHA-256 IMMUTABLE HASH
              </div>
              <div className="text-xs text-[#8C94A0] font-mono break-all mb-2 flex items-center justify-between gap-2">
                <span className="text-[#F1EFEA] break-all">{effectiveHash}</span>
              </div>
              {/* Barcode visual */}
              <div
                className="h-6 flex gap-0.5 items-stretch opacity-60 my-2"
                title={`SHA-256 Digest: ${effectiveHash}`}
              >
                {[
                  3, 1, 2, 1, 4, 1, 1, 3, 2, 1, 1, 4, 2, 1, 3, 1, 2, 4, 1, 1, 2, 3,
                  1, 1, 4, 2, 1, 3, 1, 2, 1, 4, 1, 2, 3, 1, 1, 2, 4, 1, 2, 1, 3, 1,
                ].map((w, idx) => (
                  <div
                    key={idx}
                    style={{ width: `${w}px` }}
                    className="bg-[#E7E4DA]"
                  />
                ))}
              </div>
              {evidenceCardData.footer?.action && (
                <div className="flex items-center justify-between text-xs text-[#8C94A0] mt-3 pt-2 border-t border-[#2A2D34]/80">
                  <span>{evidenceCardData.footer.actionLabel}</span>
                  <span
                    className={`font-bold ${
                      evidenceCardData.footer.actionGood
                        ? 'text-[#34D399]'
                        : 'text-[#F87171]'
                    }`}
                  >
                    {evidenceCardData.footer.action}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
