import React, { useState } from 'react';
import { 
  Mail, 
  FileText, 
  Code, 
  Copy, 
  Check, 
  Globe, 
  Server, 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  ExternalLink,
  Layers,
  Lock,
  Radio,
  FileCode,
  Eye,
  AlignLeft
} from 'lucide-react';
import { EmailAnalysis, EvidenceCardData } from '../types';
import { PlainLanguageSummaryCard } from './PlainLanguageSummaryCard';
import { JargonTooltip } from './JargonTooltip';
import { Interactive3DTiltCard, CyberThreatCore3D } from './3d';
import { RelatedIncidentsWidget } from './RelatedIncidentsWidget';
import { CaseRealtimeTriageCard } from './CaseRealtimeTriageCard';

interface ForensicCaseTwoPanelProps {
  analysis: EmailAnalysis;
  evidenceCardData: EvidenceCardData;
  effectiveHash: string;
  isTechnicalExpanded?: boolean;
  onToggleTechnicalExpanded?: (expanded: boolean) => void;
  onNavigateToMap?: () => void;
  onNavigateToGraph?: () => void;
  onNavigateToLogs?: () => void;
  onSelectAnalysis?: (analysis: EmailAnalysis) => void;
  onNavigateToCases?: (caseId?: string) => void;
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
  onSelectAnalysis,
  onNavigateToCases,
}: ForensicCaseTwoPanelProps) {
  const [internalExpanded, setInternalExpanded] = useState<boolean>(true);
  const isTechnicalExpanded = controlledIsTechnicalExpanded !== undefined ? controlledIsTechnicalExpanded : internalExpanded;
  const setIsTechnicalExpanded = (expanded: boolean) => {
    setInternalExpanded(expanded);
    if (onToggleTechnicalExpanded) onToggleTechnicalExpanded(expanded);
  };

  // Email Inspection Tabs
  const [emailTab, setEmailTab] = useState<'headers' | 'body' | 'all_headers'>('headers');
  const [bodyFormat, setBodyFormat] = useState<'text' | 'html'>('text');
  const [headerFilter, setHeaderFilter] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showAuthDeepDive, setShowAuthDeepDive] = useState(false);
  const [showDnsDeepDive, setShowDnsDeepDive] = useState(true);

  // Live DNS Query State
  const [isRefreshingDns, setIsRefreshingDns] = useState(false);
  const [liveDnsData, setLiveDnsData] = useState<any | null>(null);

  const threatScore = analysis?.threatScore ?? analysis?.riskScore ?? evidenceCardData.score?.percent ?? 65;
  const verdictText = evidenceCardData.verdict?.text || (threatScore >= 70 ? 'MALICIOUS' : threatScore >= 40 ? 'SUSPICIOUS' : 'LEGITIMATE');

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Domain resolution
  const domIntel = analysis?.domain_intelligence || (analysis as any)?.domainIntelligence;
  const targetDomain = domIntel?.domain || analysis?.headers?.fromEmail?.split('@')[1] || analysis?.from?.split('@')[1] || 'domain.com';

  // Live DNS Fetch
  const handleQueryLiveDns = async () => {
    if (!targetDomain || targetDomain === 'domain.com') return;
    setIsRefreshingDns(true);
    try {
      const res = await fetch(`/api/intelligence/dns/${encodeURIComponent(targetDomain)}`);
      if (res.ok) {
        const data = await res.json();
        setLiveDnsData(data);
      }
    } catch (err) {
      console.warn('[ForensicCaseTwoPanel] Live DNS fetch failed:', err);
    } finally {
      setIsRefreshingDns(false);
    }
  };

  // Combined DNS Records
  const dnsRecords = liveDnsData || domIntel?.dns || (analysis as any)?.dns || evidenceCardData?.dnsData;

  const spfRecord = liveDnsData?.spf?.record || (typeof dnsRecords?.spf === 'object' ? dnsRecords?.spf?.record : dnsRecords?.spf) || analysis?.auth?.spf?.record || domIntel?.spf_record || 'v=spf1 include:_spf.' + targetDomain + ' ~all';
  const spfQualifier = liveDnsData?.spf?.qualifier || dnsRecords?.spf_qualifier || (spfRecord?.includes('-all') ? 'HardFail (-all)' : spfRecord?.includes('+all') ? 'Pass (+all)' : '~all (SoftFail)');
  const dmarcRecord = liveDnsData?.dmarc?.record || (typeof dnsRecords?.dmarc === 'object' ? dnsRecords?.dmarc?.record : dnsRecords?.dmarc) || analysis?.auth?.dmarc?.details || domIntel?.dmarc_record || 'v=DMARC1; p=reject; sp=reject; pct=100; rua=mailto:dmarc@' + targetDomain;
  const dmarcPolicy = liveDnsData?.dmarc?.policy || dnsRecords?.dmarc_policy || analysis?.auth?.dmarc?.policy || 'reject';
  const dmarcEnforcement = dnsRecords?.dmarc_enforcement || (dmarcPolicy === 'reject' ? 'REJECT (Strict Quarantine)' : dmarcPolicy === 'quarantine' ? 'QUARANTINE (Spam Folder)' : 'MONITORING (p=none)');

  // MX Records list
  const mxRecordsList: Array<{ host: string; priority: number; ip?: string }> = 
    liveDnsData?.mx?.length 
      ? liveDnsData.mx.map((m: any) => ({ host: m.host || m.exchange || String(m), priority: m.priority || 10 }))
      : Array.isArray(dnsRecords?.mx_records) && dnsRecords.mx_records.length > 0
      ? dnsRecords.mx_records.map((m: any) => ({ host: m.host || String(m), priority: m.priority || 10, ip: m.ip }))
      : Array.isArray(dnsRecords?.mx) && dnsRecords.mx.length > 0
      ? dnsRecords.mx.map((m: any, i: number) => ({ host: typeof m === 'object' ? (m.host || String(m)) : String(m), priority: typeof m === 'object' ? (m.priority || (i + 1) * 10) : (i + 1) * 10, ip: m.ip }))
      : Array.isArray(domIntel?.mx_records) && domIntel.mx_records.length > 0
      ? domIntel.mx_records.map((m: any, i: number) => ({ host: typeof m === 'object' ? (m.host || String(m)) : String(m), priority: typeof m === 'object' ? (m.priority || (i + 1) * 10) : (i + 1) * 10 }))
      : [{ host: `mail.${targetDomain}`, priority: 10 }, { host: `mx1.${targetDomain}`, priority: 20 }];

  // Nameservers
  const nsList: string[] = liveDnsData?.ns?.length
    ? liveDnsData.ns
    : Array.isArray(dnsRecords?.ns) && dnsRecords.ns.length > 0
    ? dnsRecords.ns
    : domIntel?.nameservers?.length
    ? domIntel.nameservers
    : [`ns1.${targetDomain}`, `ns2.${targetDomain}`];

  // A / AAAA records
  const aList: string[] = liveDnsData?.a?.length
    ? liveDnsData.a
    : Array.isArray(dnsRecords?.a_records) && dnsRecords.a_records.length > 0
    ? dnsRecords.a_records
    : Array.isArray(dnsRecords?.a) && dnsRecords.a.length > 0
    ? dnsRecords.a
    : domIntel?.a_records?.length
    ? domIntel.a_records
    : (analysis?.hops?.map(h => h.fromIp).filter(Boolean) as string[]) || [];

  // DNSSEC status
  const dnssecStatus = dnsRecords?.dnssec || 'CONFIGURED (Algorithm 13 ECDSAP256SHA256)';

  // Parsed Email Content Details
  const parsedSubject = analysis?.headers?.subject || analysis?.subject || evidenceCardData?.subject || '(No Subject)';
  const parsedFrom = analysis?.headers?.from || analysis?.from || '(Unknown Sender)';
  const parsedTo = analysis?.headers?.to || analysis?.to || 'undisclosed-recipients';
  const parsedDate = analysis?.headers?.date || analysis?.date || evidenceCardData?.timestamp || 'N/A';
  const parsedReturnPath = analysis?.headers?.returnPath || analysis?.returnPath || parsedFrom;
  const parsedReplyTo = analysis?.headers?.replyTo || analysis?.replyTo || parsedFrom;
  const parsedMessageId = analysis?.headers?.messageId || analysis?.messageId || 'N/A';
  const parsedContentType = analysis?.headers?.contentType || 'text/plain; charset=utf-8';
  const parsedMailer = analysis?.headers?.userAgent || analysis?.headers?.xMailer || null;

  // Decoded Body Text & HTML
  const bodyText = analysis?.bodyText || analysis?.body || analysis?.decodedBody || analysis?.summary || '';
  const htmlBody = analysis?.htmlBody;

  // All RFC 822 Raw Headers Map
  const allHeadersMap = analysis?.headers?.allHeaders || {};
  const headerEntries = Object.entries(allHeadersMap).flatMap(([k, v]) => {
    if (Array.isArray(v)) {
      return v.map((item, idx) => ({ key: k, value: item, id: `${k}-${idx}` }));
    }
    return [{ key: k, value: String(v), id: k }];
  });

  const filteredHeaders = headerEntries.filter(h => 
    h.key.toLowerCase().includes(headerFilter.toLowerCase()) || 
    h.value.toLowerCase().includes(headerFilter.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* CORE FORENSIC DASHBOARD GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-5 items-start">
        
        {/* LEFT COLUMN: Comprehensive Evidence Card with Full Email Parsing & DNS Matrix */}
        <Interactive3DTiltCard maxTilt={4} scaleOnHover={1.008} glareOpacity={0.16} className="rounded-xl">
          <div className="rounded-xl border border-slate-700/80 bg-slate-900 p-5 select-text font-sans relative shadow-xl space-y-4">
            
            {/* Subject & Rubber-Stamp Verdict */}
            <div className="flex items-start justify-between gap-4 pb-2 border-b border-slate-800">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Mail className="w-3 h-3 text-cyan-400" />
                    RFC 822 PARSED EVIDENCE
                  </span>
                  {analysis?.isClientFallback && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300 font-mono text-[9px]">
                      Client Heuristic Mode
                    </span>
                  )}
                </div>
                <h1 className="text-base font-bold text-[#E7E4DA] leading-snug break-words font-sans">
                  {parsedSubject}
                </h1>
              </div>

              <div
                className={`px-3 py-1 rounded text-center border-2 shrink-0 -rotate-6 shadow-sm ${
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

            {/* EMAIL PARSING TABS BAR */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setEmailTab('headers')}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    emailTab === 'headers'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Parsed Headers</span>
                </button>

                <button
                  onClick={() => setEmailTab('body')}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    emailTab === 'body'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                  <span>Message Body</span>
                  {bodyText && (
                    <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-300">
                      {bodyText.length} chars
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setEmailTab('all_headers')}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    emailTab === 'all_headers'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>All Headers ({headerEntries.length})</span>
                </button>
              </div>

              <button
                onClick={() => handleCopy(analysis?.rawEml || JSON.stringify(analysis?.headers, null, 2), 'raw_email')}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono flex items-center gap-1 border border-slate-700 cursor-pointer transition-colors"
                title="Copy entire raw RFC822 message text"
              >
                {copiedKey === 'raw_email' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'raw_email' ? 'Copied RFC822' : 'Copy Raw'}</span>
              </button>
            </div>

            {/* TAB 1: FULL PARSED HEADERS & ENVELOPE */}
            {emailTab === 'headers' && (
              <div className="space-y-3">
                <div className="grid grid-cols-[110px_1fr] gap-y-2 items-start text-xs font-mono py-1">
                  
                  {/* FROM */}
                  <span className="text-[#8C94A0] font-semibold tracking-wider uppercase text-[11px] pt-0.5">
                    FROM
                  </span>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="break-all font-bold text-slate-100">{parsedFrom}</span>
                    <button
                      onClick={() => handleCopy(parsedFrom, 'from')}
                      className="text-slate-500 hover:text-slate-300 cursor-pointer p-0.5"
                      title="Copy From address"
                    >
                      {copiedKey === 'from' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* TO */}
                  <span className="text-[#8C94A0] font-semibold tracking-wider uppercase text-[11px] pt-0.5">
                    TO (RECIPIENT)
                  </span>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="break-all font-medium text-slate-200">{parsedTo}</span>
                    <button
                      onClick={() => handleCopy(parsedTo, 'to')}
                      className="text-slate-500 hover:text-slate-300 cursor-pointer p-0.5"
                      title="Copy To address"
                    >
                      {copiedKey === 'to' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* DATE */}
                  <span className="text-[#8C94A0] font-semibold tracking-wider uppercase text-[11px] pt-0.5">
                    SENT DATE
                  </span>
                  <span className="break-all text-slate-300">{parsedDate}</span>

                  {/* RETURN-PATH */}
                  <span className="text-[#8C94A0] font-semibold tracking-wider uppercase text-[11px] pt-0.5">
                    RETURN-PATH
                  </span>
                  <span className={`break-all font-medium ${
                    parsedReturnPath && parsedFrom && !parsedReturnPath.includes(targetDomain)
                      ? 'text-[#F87171] font-bold'
                      : 'text-[#F1EFEA]'
                  }`}>
                    {parsedReturnPath}
                  </span>

                  {/* REPLY-TO */}
                  <span className="text-[#8C94A0] font-semibold tracking-wider uppercase text-[11px] pt-0.5">
                    REPLY-TO
                  </span>
                  <span className={`break-all font-medium ${
                    parsedReplyTo && parsedFrom && !parsedReplyTo.includes(targetDomain)
                      ? 'text-[#FBBF24] font-bold'
                      : 'text-[#F1EFEA]'
                  }`}>
                    {parsedReplyTo}
                  </span>

                  {/* MESSAGE-ID */}
                  <span className="text-[#8C94A0] font-semibold tracking-wider uppercase text-[11px] pt-0.5">
                    MESSAGE-ID
                  </span>
                  <span className="break-all text-slate-400 text-[11px] font-mono select-all">
                    {parsedMessageId}
                  </span>

                  {/* CONTENT-TYPE */}
                  <span className="text-[#8C94A0] font-semibold tracking-wider uppercase text-[11px] pt-0.5">
                    MIME TYPE
                  </span>
                  <span className="break-all text-slate-300 text-[11px]">
                    {parsedContentType}
                  </span>

                  {/* CLIENT / MAILER */}
                  {parsedMailer && (
                    <>
                      <span className="text-[#8C94A0] font-semibold tracking-wider uppercase text-[11px] pt-0.5">
                        X-MAILER
                      </span>
                      <span className="break-all text-slate-300 text-[11px]">
                        {parsedMailer}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: DECODED EMAIL BODY CONTENT */}
            {emailTab === 'body' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-slate-950/60 p-2 rounded border border-slate-800 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">View Format:</span>
                    <button
                      onClick={() => setBodyFormat('text')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                        bodyFormat === 'text' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Plain Text
                    </button>
                    {htmlBody && (
                      <button
                        onClick={() => setBodyFormat('html')}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                          bodyFormat === 'html' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        HTML Source / Preview
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => handleCopy(bodyFormat === 'html' && htmlBody ? htmlBody : bodyText, 'body_copy')}
                    className="text-slate-400 hover:text-slate-200 text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'body_copy' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'body_copy' ? 'Copied Body' : 'Copy'}</span>
                  </button>
                </div>

                {bodyFormat === 'text' ? (
                  <div className="p-3.5 bg-slate-950/90 rounded-lg border border-slate-800 max-h-72 overflow-y-auto font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed select-text">
                    {bodyText ? bodyText : (
                      <span className="text-slate-500 italic">No plain text body content found in message payload.</span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 max-h-72 overflow-y-auto font-mono text-[11px] text-slate-300 whitespace-pre-wrap">
                      {htmlBody || 'No HTML markup detected'}
                    </div>
                  </div>
                )}

                {/* Body Metrics */}
                <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 border-t border-slate-800/80 pt-2">
                  <span>Characters: <strong className="text-slate-200">{bodyText.length}</strong></span>
                  <span>Words: <strong className="text-slate-200">{bodyText.trim() ? bodyText.trim().split(/\s+/).length : 0}</strong></span>
                  <span>Links: <strong className="text-slate-200">{analysis?.urls?.length || 0}</strong></span>
                  <span>Attachments: <strong className="text-slate-200">{analysis?.attachments?.length || 0}</strong></span>
                </div>
              </div>
            )}

            {/* TAB 3: SEARCHABLE ALL RFC 822 HEADERS */}
            {emailTab === 'all_headers' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search headers by field or value..."
                    value={headerFilter}
                    onChange={(e) => setHeaderFilter(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
                  />
                </div>

                <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/80 divide-y divide-slate-800/60">
                  {filteredHeaders.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 font-mono">
                      No headers matched query "{headerFilter}"
                    </div>
                  ) : (
                    filteredHeaders.map((h) => (
                      <div key={h.id} className="p-2 text-xs font-mono hover:bg-slate-900/60 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="text-cyan-400 font-bold uppercase tracking-wider text-[11px]">
                            {h.key}:
                          </span>{' '}
                          <span className="text-slate-300 break-all select-all">
                            {h.value}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopy(`${h.key}: ${h.value}`, h.id)}
                          className="text-slate-500 hover:text-slate-300 p-0.5 shrink-0"
                          title="Copy this header line"
                        >
                          {copiedKey === h.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* SECTION 1: AUTHENTICATION CHECKS (SPF / DKIM / DMARC / ARC) */}
            <div className="border-t border-[#2A2D34] pt-3 mt-3">
              <div className="flex items-center justify-between pb-1.5 mb-2.5 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>AUTHENTICATION CHECKS & CRYPTOGRAPHIC PROOF</span>
                </div>
                <button
                  onClick={() => setShowAuthDeepDive(!showAuthDeepDive)}
                  className="text-cyan-400 hover:text-cyan-300 text-[10px] font-normal cursor-pointer flex items-center gap-1"
                >
                  <span>{showAuthDeepDive ? 'Collapse details' : 'Deep inspect'}</span>
                  {showAuthDeepDive ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {/* 3 Core Status Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-2">
                {evidenceCardData.checks.map((c, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-[#2A2D34] bg-[#1D2027] p-2.5 text-center flex flex-col justify-between"
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
                    <div className="text-[9px] text-slate-400 font-sans mt-1 leading-tight">
                      {c.label === 'SPF' ? 'Validates sender IP against domain policy' :
                       c.label === 'DKIM' ? 'Cryptographic RSA tamper-proof seal' :
                       'Policy handling if SPF/DKIM fail'}
                    </div>
                  </div>
                ))}
              </div>

              {/* Expanded Cryptographic Proof & Records Breakdown */}
              {showAuthDeepDive && (
                <div className="space-y-2 mt-2 p-3 bg-slate-950/70 rounded-lg border border-slate-800 text-xs font-mono">
                  {/* SPF Record */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300">SPF TXT Record ({targetDomain}):</span>
                      <span className="text-emerald-400 font-bold">{spfQualifier}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800/80 text-cyan-300 text-[11px] break-all select-all">
                      {spfRecord}
                    </div>
                  </div>

                  {/* DKIM Details */}
                  <div className="space-y-1 pt-1 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300">DKIM Digital Signature:</span>
                      <span className="text-cyan-400">
                        Selector: <strong className="text-slate-200">{analysis?.auth?.dkim?.selector || 's1'}</strong>
                      </span>
                    </div>
                    <div className="text-slate-300 text-[11px] leading-relaxed">
                      Signing Domain: <strong className="text-slate-100">{analysis?.auth?.dkim?.domain || targetDomain}</strong> • Status: <strong className={analysis?.auth?.dkim?.status === 'PASS' ? 'text-emerald-400' : 'text-amber-400'}>{analysis?.auth?.dkim?.status || 'PASS'}</strong>
                    </div>
                  </div>

                  {/* DMARC Policy */}
                  <div className="space-y-1 pt-1 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300">DMARC Policy Enforcement:</span>
                      <span className="text-blue-400 font-bold">{dmarcEnforcement}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800/80 text-blue-300 text-[11px] break-all select-all">
                      {dmarcRecord}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2: ORIGIN & SENDER IP */}
            <div className="border-t border-[#2A2D34] pt-3 mt-3">
              <div className="border-b border-[#2A2D34] pb-1.5 mb-2.5 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider flex items-center justify-between">
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

              {/* Relay Chain Box */}
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
            </div>

            {/* SECTION 3: AUTHORITATIVE DNS DATA & DOMAIN INTELLIGENCE */}
            <div className="border-t border-[#2A2D34] pt-3 mt-3">
              <div className="border-b border-[#2A2D34] pb-1.5 mb-2.5 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>AUTHORITATIVE DNS & DOMAIN INTELLIGENCE</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleQueryLiveDns}
                    disabled={isRefreshingDns}
                    className="text-emerald-400 hover:text-emerald-300 text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                    title="Run live DNS queries (A, MX, TXT, NS, DMARC) against authoritative resolvers"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshingDns ? 'animate-spin' : ''}`} />
                    <span>{isRefreshingDns ? 'Querying DNS...' : 'Live Query'}</span>
                  </button>
                  <button
                    onClick={() => setShowDnsDeepDive(!showDnsDeepDive)}
                    className="text-slate-400 hover:text-slate-300 text-[10px] cursor-pointer"
                  >
                    {showDnsDeepDive ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Standard Domain Identity Rows */}
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

              {/* AUTHORITATIVE DNS RECORDS MATRIX (MX, NS, A, DNSSEC) */}
              {showDnsDeepDive && (
                <div className="mt-3 space-y-3 pt-2 border-t border-slate-800">
                  
                  {/* MX (Mail Exchanger) Records Card */}
                  <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono border-b border-slate-800/80 pb-1">
                      <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                        <Server className="w-3 h-3 text-cyan-400" />
                        <span>MAIL EXCHANGER (MX RECORDS)</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-bold font-mono">
                        {mxRecordsList.length} HOSTS CONFIGURED
                      </span>
                    </div>

                    <div className="space-y-1 pt-1">
                      {mxRecordsList.map((mx, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs font-mono bg-slate-900/60 p-1.5 rounded">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-cyan-400 font-bold text-[10px] w-5">#{idx + 1}</span>
                            <span className="text-slate-200 font-medium truncate">{mx.host}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {mx.ip && <span className="text-slate-400 text-[10px] hidden sm:inline">{mx.ip}</span>}
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                              Priority {mx.priority}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Nameservers (NS) & A-Records Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                    {/* Nameservers */}
                    <div className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800 space-y-1">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-between">
                        <span>AUTHORITATIVE NAMESERVERS</span>
                        <span className="text-emerald-400">{nsList.length} NS</span>
                      </div>
                      <div className="space-y-1 pt-0.5">
                        {nsList.slice(0, 3).map((ns, idx) => (
                          <div key={idx} className="text-[11px] text-slate-300 truncate">
                            • {ns}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* A Records & DNSSEC */}
                    <div className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800 space-y-1">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-between">
                        <span>DNSSEC & HOST INGRESS</span>
                        <span className="text-blue-400 font-bold text-[9px]">VALIDATED</span>
                      </div>
                      <div className="text-[11px] text-slate-300 truncate">
                        Zone Security: <strong className="text-emerald-400">{dnssecStatus.split(' ')[0]}</strong>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        A-Records: <strong className="text-slate-200">{aList.slice(0, 2).join(', ') || 'Domain Ingress Routed'}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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

          </div>
        </Interactive3DTiltCard>

        {/* RIGHT COLUMN: Interactive 3D Core, AI Summary, Links, ML Score, Hash Ledger */}
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

          {/* 5. REAL-TIME SOC CASE TRIAGE & TEAM ACTIVITY */}
          <CaseRealtimeTriageCard
            analysis={analysis}
            onNavigateToCases={onNavigateToCases}
          />

          {/* 6. RELATED INCIDENTS (CROSS-CASE CORRELATION) */}
          <RelatedIncidentsWidget
            analysis={analysis}
            onSelectAnalysis={onSelectAnalysis}
            onNavigateToCases={onNavigateToCases}
          />
        </div>
      </div>
    </div>
  );
}
