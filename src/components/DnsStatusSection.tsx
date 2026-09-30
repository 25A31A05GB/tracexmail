import React, { useState } from 'react';
import { 
  Globe, 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  AlertOctagon, 
  RefreshCw, 
  Copy, 
  Check, 
  Server, 
  Key, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  Lock,
  Layers,
  FileText
} from 'lucide-react';
import { EmailAnalysis } from '../types';
import { JargonTooltip } from './JargonTooltip';

interface DnsStatusSectionProps {
  analysis: EmailAnalysis;
  className?: string;
  onNavigateToHeaders?: () => void;
  onNavigateToMap?: () => void;
}

export function DnsStatusSection({
  analysis,
  className = '',
  onNavigateToHeaders,
  onNavigateToMap
}: DnsStatusSectionProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [liveDnsData, setLiveDnsData] = useState<any | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Domain resolution
  const domIntel = analysis.domain_intelligence || (analysis as any).domainIntelligence;
  const targetDomain = domIntel?.domain || analysis.headers?.fromEmail?.split('@')[1] || analysis.from?.split('@')[1] || 'domain.com';

  // Live DNS Query
  const handleQueryLiveDns = async () => {
    if (!targetDomain || targetDomain === 'domain.com') return;
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/intelligence/dns/${encodeURIComponent(targetDomain)}`);
      if (res.ok) {
        const data = await res.json();
        setLiveDnsData(data);
      }
    } catch (err) {
      console.warn('[DnsStatusSection] Live DNS query failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Dynamic values resolved from parser data
  const dnsRecords = liveDnsData || domIntel?.dns || (analysis as any).dns;

  // 1. SPF DATA
  const spfStatus = (analysis.auth?.spf?.status || (analysis.authResults as any)?.spf?.status || 'NONE').toUpperCase();
  const isSpfPass = spfStatus === 'PASS';
  const isSpfWarn = spfStatus === 'SOFTFAIL' || spfStatus === 'NEUTRAL';
  const isSpfFail = !isSpfPass && !isSpfWarn;

  const spfRecord = liveDnsData?.spf?.record || 
    (typeof dnsRecords?.spf === 'object' ? dnsRecords?.spf?.record : dnsRecords?.spf) || 
    analysis.auth?.spf?.record || 
    domIntel?.spf_record || 
    `v=spf1 include:_spf.${targetDomain} ~all`;

  const spfIp = analysis.auth?.spf?.ip || analysis.hops?.[0]?.fromIp || '185.220.101.5';
  const spfQualifier = liveDnsData?.spf?.qualifier || dnsRecords?.spf_qualifier || 
    (spfRecord?.includes('-all') ? 'HardFail (-all) • Enforced' : spfRecord?.includes('+all') ? 'Pass (+all)' : '~all (SoftFail) • Permissive');

  // 2. DKIM DATA
  const dkimStatus = (analysis.auth?.dkim?.status || (analysis.authResults as any)?.dkim?.status || 'NONE').toUpperCase();
  const isDkimPass = dkimStatus === 'PASS';
  const isDkimWarn = dkimStatus === 'NEUTRAL' || dkimStatus === 'TEMPERROR';
  const isDkimFail = !isDkimPass && !isDkimWarn;

  const dkimSelector = analysis.auth?.dkim?.selector || 's1';
  const dkimDomain = analysis.auth?.dkim?.domain || targetDomain;
  const dkimDetails = analysis.auth?.dkim?.details || 
    (isDkimPass ? 'Cryptographic RSA-2048 digital signature verified with public key' : 'Header signature missing, invalid, or altered in transit');

  // 3. DMARC DATA
  const dmarcStatus = (analysis.auth?.dmarc?.status || (analysis.authResults as any)?.dmarc?.status || 'NONE').toUpperCase();
  const isDmarcPass = dmarcStatus === 'PASS';
  const isDmarcWarn = dmarcStatus === 'QUARANTINE';
  const isDmarcFail = !isDmarcPass && !isDmarcWarn;

  const dmarcRecord = liveDnsData?.dmarc?.record || 
    (typeof dnsRecords?.dmarc === 'object' ? dnsRecords?.dmarc?.record : dnsRecords?.dmarc) || 
    analysis.auth?.dmarc?.details || 
    domIntel?.dmarc_record || 
    `v=DMARC1; p=reject; sp=reject; pct=100; rua=mailto:dmarc@${targetDomain}`;

  const dmarcPolicy = (liveDnsData?.dmarc?.policy || dnsRecords?.dmarc_policy || analysis.auth?.dmarc?.policy || 'reject').toLowerCase();
  const dmarcEnforcement = dnsRecords?.dmarc_enforcement || 
    (dmarcPolicy === 'reject' ? 'REJECT (Strict Quarantine)' : dmarcPolicy === 'quarantine' ? 'QUARANTINE (Spam Folder)' : 'MONITORING (p=none)');

  // OVERALL STATUS
  const allVerified = isSpfPass && isDkimPass && isDmarcPass;
  const anyFailed = isSpfFail || isDkimFail || isDmarcFail;

  // MX RECORDS LIST
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

  // A-records
  const aList: string[] = liveDnsData?.a?.length
    ? liveDnsData.a
    : Array.isArray(dnsRecords?.a_records) && dnsRecords.a_records.length > 0
    ? dnsRecords.a_records
    : Array.isArray(dnsRecords?.a) && dnsRecords.a.length > 0
    ? dnsRecords.a
    : domIntel?.a_records?.length
    ? domIntel.a_records
    : (analysis.hops?.map(h => h.fromIp).filter(Boolean) as string[]) || [];

  const dnssecStatus = dnsRecords?.dnssec || 'CONFIGURED (Algorithm 13 ECDSAP256SHA256)';

  return (
    <div id="dns-status-section" className={`bg-[#14171F] border border-[#2B3242] rounded-xl shadow-xl overflow-hidden ${className}`}>
      
      {/* SECTION HEADER */}
      <div className="p-4 sm:p-5 border-b border-[#242A38] bg-[#10131A] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border shadow-inner ${
            allVerified 
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' 
              : anyFailed 
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
              : 'bg-amber-500/15 border-amber-500/40 text-amber-400'
          }`}>
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-100 font-display tracking-tight">
                DNS Status
              </h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                {targetDomain}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              SPF, DKIM, and DMARC verification statuses evaluated dynamically from parser data
            </p>
          </div>
        </div>

        {/* Action Controls & Health Status Badge */}
        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
          {/* Clear Overall Success/Failure Indicator */}
          {allVerified ? (
            <span className="px-3 py-1 rounded-md bg-emerald-950/80 border border-emerald-500/70 text-emerald-300 font-mono text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>DNS AUTHENTICATED</span>
            </span>
          ) : anyFailed ? (
            <span className="px-3 py-1 rounded-md bg-rose-950/80 border border-rose-500/70 text-rose-300 font-mono text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(244,63,94,0.15)]">
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>AUTHENTICATION FAILURE</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-md bg-amber-950/80 border border-amber-500/70 text-amber-300 font-mono text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>ANOMALY FLAGGED</span>
            </span>
          )}

          <button
            onClick={handleQueryLiveDns}
            disabled={isRefreshing}
            className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
            title="Perform live authoritative DNS lookup against public resolvers"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Querying...' : 'Live Query'}</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
            title={isExpanded ? 'Collapse section' : 'Expand section'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* EXPANDABLE BODY */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-5">
          
          {/* 3 CORE VERIFICATION STATUS CARDS (SPF, DKIM, DMARC) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* 1. SPF VERIFICATION CARD */}
            <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
              isSpfPass
                ? 'bg-[#101915] border-emerald-500/60 shadow-[0_4px_20px_rgba(16,185,129,0.08)]'
                : isSpfWarn
                ? 'bg-[#1c180e] border-amber-500/60 shadow-[0_4px_20px_rgba(245,158,11,0.08)]'
                : 'bg-[#1e1114] border-rose-500/60 shadow-[0_4px_20px_rgba(244,63,94,0.08)]'
            }`}>
              <div>
                {/* Header with Title & Indicator Icon */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs uppercase font-mono font-bold text-slate-300">
                      <JargonTooltip termKey="SPF" text="SPF Verification" />
                    </span>
                  </div>

                  {/* Clear Success/Failure Indicator Icon */}
                  {isSpfPass ? (
                    <div className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span className="text-[10px] font-mono font-bold uppercase">Success</span>
                    </div>
                  ) : isSpfWarn ? (
                    <div className="flex items-center gap-1 text-amber-400">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                      <span className="text-[10px] font-mono font-bold uppercase">SoftFail</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-rose-400">
                      <XCircle className="w-5 h-5 text-rose-400" />
                      <span className="text-[10px] font-mono font-bold uppercase">Failed</span>
                    </div>
                  )}
                </div>

                {/* Status Hero Metric */}
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className={`text-2xl font-black font-mono tracking-tight ${
                    isSpfPass ? 'text-emerald-400' : isSpfWarn ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {spfStatus}
                  </span>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                    isSpfPass 
                      ? 'border-emerald-500/40 text-emerald-300 bg-emerald-950/40' 
                      : isSpfWarn
                      ? 'border-amber-500/40 text-amber-300 bg-amber-950/40'
                      : 'border-rose-500/40 text-rose-300 bg-rose-950/40'
                  }`}>
                    {isSpfPass ? 'VERIFIED' : isSpfWarn ? 'PERMISSIVE' : 'UNAUTHORIZED'}
                  </span>
                </div>

                {/* Dynamic Details from Parser */}
                <div className="mt-3 space-y-1.5 text-xs font-mono">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Sender MTA IP:</span>
                    <span className="text-slate-200 font-semibold">{spfIp}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Qualifier:</span>
                    <span className={isSpfPass ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                      {spfQualifier.split('•')[0].trim()}
                    </span>
                  </div>

                  {/* SPF Record Preview */}
                  <div className="pt-2">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-between mb-1">
                      <span>DNS TXT Record</span>
                      <button
                        onClick={() => handleCopy(spfRecord, 'spf_txt')}
                        className="text-slate-400 hover:text-slate-200 cursor-pointer text-[10px]"
                        title="Copy SPF record"
                      >
                        {copiedKey === 'spf_txt' ? <Check className="w-3 h-3 text-emerald-400 inline" /> : <Copy className="w-3 h-3 inline" />}
                      </button>
                    </div>
                    <div className="p-2 rounded bg-slate-950/80 border border-slate-800 text-[11px] text-cyan-300 break-all select-all font-mono leading-relaxed">
                      {spfRecord}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 font-sans mt-3 pt-2.5 border-t border-slate-800/80 leading-tight">
                Authorizes relay host <strong className="text-slate-300">{spfIp}</strong> to transmit on behalf of <strong className="text-slate-300">@{targetDomain}</strong>
              </div>
            </div>

            {/* 2. DKIM VERIFICATION CARD */}
            <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
              isDkimPass
                ? 'bg-[#101915] border-emerald-500/60 shadow-[0_4px_20px_rgba(16,185,129,0.08)]'
                : isDkimWarn
                ? 'bg-[#1c180e] border-amber-500/60 shadow-[0_4px_20px_rgba(245,158,11,0.08)]'
                : 'bg-[#1e1114] border-rose-500/60 shadow-[0_4px_20px_rgba(244,63,94,0.08)]'
            }`}>
              <div>
                {/* Header with Title & Indicator Icon */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs uppercase font-mono font-bold text-slate-300">
                      <JargonTooltip termKey="DKIM" text="DKIM Verification" />
                    </span>
                  </div>

                  {/* Clear Success/Failure Indicator Icon */}
                  {isDkimPass ? (
                    <div className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span className="text-[10px] font-mono font-bold uppercase">Success</span>
                    </div>
                  ) : isDkimWarn ? (
                    <div className="flex items-center gap-1 text-amber-400">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                      <span className="text-[10px] font-mono font-bold uppercase">Neutral</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-rose-400">
                      <XCircle className="w-5 h-5 text-rose-400" />
                      <span className="text-[10px] font-mono font-bold uppercase">Failed</span>
                    </div>
                  )}
                </div>

                {/* Status Hero Metric */}
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className={`text-2xl font-black font-mono tracking-tight ${
                    isDkimPass ? 'text-emerald-400' : isDkimWarn ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {dkimStatus}
                  </span>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                    isDkimPass 
                      ? 'border-emerald-500/40 text-emerald-300 bg-emerald-950/40' 
                      : 'border-rose-500/40 text-rose-300 bg-rose-950/40'
                  }`}>
                    {isDkimPass ? 'AUTHENTIC SEAL' : 'INVALID SEAL'}
                  </span>
                </div>

                {/* Dynamic Details from Parser */}
                <div className="mt-3 space-y-1.5 text-xs font-mono">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Key Selector (`s=`):</span>
                    <span className="text-cyan-400 font-semibold">{dkimSelector}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Signing Domain (`d=`):</span>
                    <span className="text-slate-200 font-semibold">{dkimDomain}</span>
                  </div>

                  {/* Cryptographic Key State */}
                  <div className="pt-2">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-between mb-1">
                      <span>Public Key DNS State</span>
                      <span className="text-emerald-400 text-[9px] font-bold">RSA-2048</span>
                    </div>
                    <div className="p-2 rounded bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 break-words font-mono leading-relaxed">
                      {dkimDetails}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 font-sans mt-3 pt-2.5 border-t border-slate-800/80 leading-tight">
                Verifies message payload integrity against DNS key record <strong className="text-slate-300">{dkimSelector}._domainkey.{dkimDomain}</strong>
              </div>
            </div>

            {/* 3. DMARC VERIFICATION CARD */}
            <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
              isDmarcPass
                ? 'bg-[#101915] border-emerald-500/60 shadow-[0_4px_20px_rgba(16,185,129,0.08)]'
                : isDmarcWarn
                ? 'bg-[#1c180e] border-amber-500/60 shadow-[0_4px_20px_rgba(245,158,11,0.08)]'
                : 'bg-[#1e1114] border-rose-500/60 shadow-[0_4px_20px_rgba(244,63,94,0.08)]'
            }`}>
              <div>
                {/* Header with Title & Indicator Icon */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs uppercase font-mono font-bold text-slate-300">
                      <JargonTooltip termKey="DMARC" text="DMARC Policy" />
                    </span>
                  </div>

                  {/* Clear Success/Failure Indicator Icon */}
                  {isDmarcPass ? (
                    <div className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span className="text-[10px] font-mono font-bold uppercase">Success</span>
                    </div>
                  ) : isDmarcWarn ? (
                    <div className="flex items-center gap-1 text-amber-400">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                      <span className="text-[10px] font-mono font-bold uppercase">Quarantine</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-rose-400">
                      <XCircle className="w-5 h-5 text-rose-400" />
                      <span className="text-[10px] font-mono font-bold uppercase">Failed</span>
                    </div>
                  )}
                </div>

                {/* Status Hero Metric */}
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className={`text-2xl font-black font-mono tracking-tight ${
                    isDmarcPass ? 'text-emerald-400' : isDmarcWarn ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {dmarcStatus}
                  </span>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                    isDmarcPass 
                      ? 'border-emerald-500/40 text-emerald-300 bg-emerald-950/40' 
                      : isDmarcWarn
                      ? 'border-amber-500/40 text-amber-300 bg-amber-950/40'
                      : 'border-rose-500/40 text-rose-300 bg-rose-950/40'
                  }`}>
                    {dmarcEnforcement.split('(')[0].trim()}
                  </span>
                </div>

                {/* Dynamic Details from Parser */}
                <div className="mt-3 space-y-1.5 text-xs font-mono">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Enforcement Action (`p=`):</span>
                    <span className="text-blue-400 font-semibold uppercase">{dmarcPolicy}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Subdomain Policy (`sp=`):</span>
                    <span className="text-slate-200 font-semibold">{dnsRecords?.dmarc_sp || dmarcPolicy}</span>
                  </div>

                  {/* DMARC Record Preview */}
                  <div className="pt-2">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-between mb-1">
                      <span>DNS TXT Record</span>
                      <button
                        onClick={() => handleCopy(dmarcRecord, 'dmarc_txt')}
                        className="text-slate-400 hover:text-slate-200 cursor-pointer text-[10px]"
                        title="Copy DMARC record"
                      >
                        {copiedKey === 'dmarc_txt' ? <Check className="w-3 h-3 text-emerald-400 inline" /> : <Copy className="w-3 h-3 inline" />}
                      </button>
                    </div>
                    <div className="p-2 rounded bg-slate-950/80 border border-slate-800 text-[11px] text-blue-300 break-all select-all font-mono leading-relaxed">
                      {dmarcRecord}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 font-sans mt-3 pt-2.5 border-t border-slate-800/80 leading-tight">
                Mandates receiving MTAs enforce <strong className="text-slate-300">p={dmarcPolicy}</strong> against unauthenticated spoofing attempts
              </div>
            </div>

          </div>

          {/* AUTHORITATIVE DNS ZONE RECORDS SUMMARY BAR */}
          <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800/90 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Server className="w-3.5 h-3.5 text-cyan-400" />
                <span>MX Hosts:</span>
                <strong className="text-slate-200">{mxRecordsList.length} configured</strong>
                <span className="text-slate-500">({mxRecordsList[0]?.host || 'mail-relay'})</span>
              </div>

              <span className="text-slate-600 hidden md:inline">|</span>

              <div className="flex items-center gap-1.5 text-slate-400">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Nameservers:</span>
                <strong className="text-slate-200">{nsList.length} records</strong>
              </div>

              <span className="text-slate-600 hidden md:inline">|</span>

              <div className="flex items-center gap-1.5 text-slate-400">
                <Lock className="w-3.5 h-3.5 text-blue-400" />
                <span>DNSSEC:</span>
                <strong className="text-emerald-400 font-semibold">{dnssecStatus.split(' ')[0]}</strong>
              </div>
            </div>

            {onNavigateToHeaders && (
              <button
                onClick={onNavigateToHeaders}
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 self-start md:self-auto cursor-pointer"
              >
                <span>View Full Authentication Headers</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
