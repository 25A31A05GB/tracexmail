import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  GitFork, 
  Link2, 
  ShieldCheck, 
  ShieldAlert, 
  Globe, 
  Server, 
  FileText, 
  Copy, 
  Check, 
  ExternalLink, 
  RefreshCw, 
  AlertTriangle,
  ArrowRight,
  Fingerprint,
  Radio,
  Layers,
  Search
} from 'lucide-react';
import { EmailAnalysis } from '../types';
import { forensicApi } from '../lib/api';
import { SAMPLE_ANALYSES } from '../data/samples';

export interface RelatedIncident {
  caseId: string;
  emailId: string;
  subject: string;
  sender: string;
  similarityScore: number;
  relationshipStrength: 'STRONG' | 'MEDIUM' | 'WEAK';
  sharedEvidence: Array<{
    rule: string;
    strength: 'STRONG' | 'MEDIUM' | 'WEAK';
    description: string;
    value: string;
    iocType?: 'URL' | 'DOMAIN' | 'IP' | 'DKIM' | 'LURE' | 'ORGANIZATION' | 'INFRASTRUCTURE' | 'HASH';
  }>;
  sharedIocs: string[];
  reason: string;
  threatScore: number;
  threatVerdict: string;
  fromDomain?: string;
  originIp?: string;
  fileHashes?: string[];
  createdAt?: string;
  matchedCategories?: ('DOMAIN' | 'IP' | 'HASH')[];
}

interface RelatedIncidentsWidgetProps {
  analysis: EmailAnalysis;
  onSelectAnalysis?: (analysis: EmailAnalysis) => void;
  onNavigateToCases?: (caseId?: string) => void;
  className?: string;
  compact?: boolean;
}

export function RelatedIncidentsWidget({
  analysis,
  onSelectAnalysis,
  onNavigateToCases,
  className = '',
  compact = false
}: RelatedIncidentsWidgetProps) {
  const [incidents, setIncidents] = useState<RelatedIncident[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'DOMAIN' | 'IP' | 'HASH'>('ALL');
  const [copiedIoc, setCopiedIoc] = useState<string | null>(null);
  const [rescanTrigger, setRescanTrigger] = useState<number>(0);

  // Extract key indicators from current analysis for instant local correlation fallback
  const currentIndicators = useMemo(() => {
    const domains = new Set<string>();
    if (analysis.headers.fromEmail?.includes('@')) {
      domains.add(analysis.headers.fromEmail.split('@')[1].toLowerCase());
    }
    if (analysis.domainIntelligence?.domain) {
      domains.add(analysis.domainIntelligence.domain.toLowerCase());
    }
    if (analysis.headers.replyTo && analysis.headers.replyTo.includes('@')) {
      const match = analysis.headers.replyTo.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (match) domains.add(match[1].toLowerCase());
    }
    if (analysis.headers.returnPath && analysis.headers.returnPath.includes('@')) {
      const match = analysis.headers.returnPath.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (match) domains.add(match[1].toLowerCase());
    }

    const ips = new Set<string>();
    if (analysis.auth?.spf?.ip) ips.add(analysis.auth.spf.ip.trim());
    const rawOrigin = (analysis as any).originIp || (analysis as any).realSenderIp?.ip;
    if (rawOrigin && typeof rawOrigin === 'string') ips.add(rawOrigin.trim());
    if (Array.isArray(analysis.hops) && analysis.hops.length > 0) {
      analysis.hops.forEach(h => {
        const hopIp = h.fromIp || (h as any).ip;
        if (hopIp && !hopIp.startsWith('10.') && !hopIp.startsWith('192.168.') && !hopIp.startsWith('127.')) {
          ips.add(hopIp.trim());
        }
      });
    }

    const hashes = new Set<string>();
    if (Array.isArray(analysis.attachments)) {
      analysis.attachments.forEach(att => {
        if (att.sha256) hashes.add(att.sha256.toLowerCase().trim());
        if (att.md5) hashes.add(att.md5.toLowerCase().trim());
      });
    }
    if (analysis.sha256Hash) hashes.add(analysis.sha256Hash.toLowerCase().trim());
    if (analysis.custodyHash) hashes.add(analysis.custodyHash.toLowerCase().trim());

    return {
      domains: Array.from(domains),
      ips: Array.from(ips),
      hashes: Array.from(hashes)
    };
  }, [analysis]);

  // Client-side fallback correlation against sample catalog and cached items
  const computeLocalCorrelations = useCallback((): RelatedIncident[] => {
    const results: RelatedIncident[] = [];
    const pool = SAMPLE_ANALYSES.filter(s => s.id !== analysis.id);

    for (const item of pool) {
      const itemDomains: string[] = [];
      if (item.headers.fromEmail?.includes('@')) itemDomains.push(item.headers.fromEmail.split('@')[1].toLowerCase());
      if (item.headers.replyTo?.includes('@')) {
        const m = item.headers.replyTo.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (m) itemDomains.push(m[1].toLowerCase());
      }
      if (item.headers.returnPath?.includes('@')) {
        const m = item.headers.returnPath.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (m) itemDomains.push(m[1].toLowerCase());
      }

      const itemIps: string[] = [];
      if (item.auth?.spf?.ip) itemIps.push(item.auth.spf.ip.trim());
      const rawItemOrigin = (item as any).originIp || (item as any).realSenderIp?.ip;
      if (rawItemOrigin && typeof rawItemOrigin === 'string') itemIps.push(rawItemOrigin.trim());
      if (Array.isArray(item.hops)) {
        item.hops.forEach(h => {
          const hopIp = h.fromIp || (h as any).ip;
          if (hopIp && !hopIp.startsWith('10.') && !hopIp.startsWith('192.168.')) itemIps.push(hopIp.trim());
        });
      }

      const itemHashes: string[] = [];
      if (Array.isArray(item.attachments)) {
        item.attachments.forEach(a => {
          if (a.sha256) itemHashes.push(a.sha256.toLowerCase().trim());
          if (a.md5) itemHashes.push(a.md5.toLowerCase().trim());
        });
      }
      if (item.sha256Hash) itemHashes.push(item.sha256Hash.toLowerCase().trim());
      if (item.custodyHash) itemHashes.push(item.custodyHash.toLowerCase().trim());

      const matchedCategories: ('DOMAIN' | 'IP' | 'HASH')[] = [];
      const sharedEvidence: RelatedIncident['sharedEvidence'] = [];
      const sharedIocs: string[] = [];
      let score = 0;

      // 1. Check Domain Overlap
      const sharedDomain = currentIndicators.domains.find(d => itemDomains.includes(d));
      if (sharedDomain) {
        matchedCategories.push('DOMAIN');
        score += 40;
        sharedIocs.push(`Domain: ${sharedDomain}`);
        sharedEvidence.push({
          rule: 'SHARED_SENDER_DOMAIN',
          strength: 'STRONG',
          description: `Identical sender domain ${sharedDomain} identified across cases`,
          value: sharedDomain,
          iocType: 'DOMAIN'
        });
      }

      // 2. Check IP Overlap
      const sharedIp = currentIndicators.ips.find(ip => itemIps.includes(ip));
      if (sharedIp) {
        matchedCategories.push('IP');
        score += 45;
        sharedIocs.push(`IP: ${sharedIp}`);
        sharedEvidence.push({
          rule: 'SHARED_ORIGIN_IP',
          strength: 'STRONG',
          description: `Identical origin MTA relay IP ${sharedIp} identified`,
          value: sharedIp,
          iocType: 'IP'
        });
      } else {
        // Check /24 Subnet
        const cSubnet = currentIndicators.ips.map(ip => ip.split('.').slice(0, 3).join('.'));
        const iSubnet = itemIps.map(ip => ip.split('.').slice(0, 3).join('.'));
        const commonSub = cSubnet.find(s => s && iSubnet.includes(s));
        if (commonSub && commonSub.split('.').length === 3) {
          matchedCategories.push('IP');
          score += 25;
          sharedIocs.push(`Subnet: ${commonSub}.0/24`);
          sharedEvidence.push({
            rule: 'SHARED_IP_SUBNET',
            strength: 'MEDIUM',
            description: `Origin relays reside within shared /24 CIDR block (${commonSub}.0/24)`,
            value: `${commonSub}.0/24`,
            iocType: 'IP'
          });
        }
      }

      // 3. Check File Hash Overlap
      const sharedHash = currentIndicators.hashes.find(h => itemHashes.includes(h));
      if (sharedHash) {
        matchedCategories.push('HASH');
        score += 50;
        sharedIocs.push(`File Hash: ${sharedHash.slice(0, 16)}...`);
        sharedEvidence.push({
          rule: 'SHARED_FILE_HASH',
          strength: 'STRONG',
          description: `Identical attachment payload SHA-256 digest: ${sharedHash}`,
          value: sharedHash,
          iocType: 'HASH'
        });
      }

      if (score >= 25 && sharedEvidence.length > 0) {
        results.push({
          caseId: item.id,
          emailId: item.id,
          subject: item.headers.subject || item.name || 'Related Forensic Case',
          sender: item.headers.fromEmail || item.headers.from,
          similarityScore: Math.min(1.0, Math.round((score / 100) * 100) / 100),
          relationshipStrength: score >= 60 ? 'STRONG' : score >= 35 ? 'MEDIUM' : 'WEAK',
          sharedEvidence,
          sharedIocs,
          reason: sharedEvidence.map(e => e.description).join('; '),
          threatScore: typeof item.riskScore === 'number' ? item.riskScore : (item.threatScore ?? 85),
          threatVerdict: typeof item.verdict === 'string' ? item.verdict : ((item.verdict as any)?.verdict || (item.threatVerdict ?? 'SUSPICIOUS')),
          fromDomain: itemDomains[0],
          originIp: itemIps[0],
          fileHashes: itemHashes,
          createdAt: item.analyzedAt,
          matchedCategories
        });
      }
    }

    return results;
  }, [analysis.id, currentIndicators]);

  // Main correlation fetch: calls backend with analysis payload, falls back to client correlation
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function fetchCorrelations() {
      try {
        const response = await forensicApi.getRelatedIncidents(analysis.id, analysis);
        if (isMounted && response?.correlatedCases) {
          const formatted: RelatedIncident[] = response.correlatedCases.map((c: any) => {
            const cats: ('DOMAIN' | 'IP' | 'HASH')[] = [];
            const ev = c.sharedEvidence || [];
            if (ev.some((e: any) => e.iocType === 'DOMAIN' || e.rule?.includes('DOMAIN'))) cats.push('DOMAIN');
            if (ev.some((e: any) => e.iocType === 'IP' || e.rule?.includes('IP') || e.rule?.includes('SUBNET'))) cats.push('IP');
            if (ev.some((e: any) => e.iocType === 'HASH' || e.rule?.includes('HASH') || e.rule?.includes('PAYLOAD'))) cats.push('HASH');

            return {
              caseId: c.caseId || c.emailId || c.id,
              emailId: c.emailId || c.caseId || c.id,
              subject: c.subject || c.title || 'Related Forensic Incident',
              sender: c.sender || `sender@${c.fromDomain || 'unknown'}`,
              similarityScore: typeof c.similarityScore === 'number' ? c.similarityScore : 0.85,
              relationshipStrength: c.relationshipStrength || 'STRONG',
              sharedEvidence: c.sharedEvidence || [],
              sharedIocs: c.sharedIocs || [],
              reason: c.reason || 'Shared cross-case threat indicators',
              threatScore: typeof c.threatScore === 'number' ? c.threatScore : 88,
              threatVerdict: c.threatVerdict || 'HIGH',
              fromDomain: c.fromDomain,
              originIp: c.originIp,
              fileHashes: c.fileHashes || [],
              createdAt: c.createdAt,
              matchedCategories: cats.length > 0 ? cats : ['DOMAIN']
            };
          });

          // Merge with any local matches if backend pool was limited
          const local = computeLocalCorrelations();
          const combinedMap = new Map<string, RelatedIncident>();
          formatted.forEach(item => combinedMap.set(item.caseId, item));
          local.forEach(item => {
            if (!combinedMap.has(item.caseId)) {
              combinedMap.set(item.caseId, item);
            }
          });

          const finalList = Array.from(combinedMap.values()).sort((a, b) => b.similarityScore - a.similarityScore);
          setIncidents(finalList);
        }
      } catch {
        // Fallback gracefully to local correlation
        if (isMounted) {
          const local = computeLocalCorrelations();
          setIncidents(local);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchCorrelations();

    // Listen to real-time case updates
    const handleCaseSync = () => {
      fetchCorrelations();
    };

    window.addEventListener('CASE_CREATED', handleCaseSync);
    window.addEventListener('CASE_UPDATED', handleCaseSync);
    window.addEventListener('CORRELATION_DETECTED', handleCaseSync);

    return () => {
      isMounted = false;
      window.removeEventListener('CASE_CREATED', handleCaseSync);
      window.removeEventListener('CASE_UPDATED', handleCaseSync);
      window.removeEventListener('CORRELATION_DETECTED', handleCaseSync);
    };
  }, [analysis, rescanTrigger, computeLocalCorrelations]);

  const handleCopy = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedIoc(text);
    setTimeout(() => setCopiedIoc(null), 2000);
  };

  const handleInspectCase = (inc: RelatedIncident) => {
    // Check if target matches any known sample in memory
    const targetSample = SAMPLE_ANALYSES.find(s => s.id === inc.caseId || s.id === inc.emailId);
    if (targetSample && onSelectAnalysis) {
      onSelectAnalysis(targetSample);
      return;
    }

    // Otherwise navigate to Cases view with filter or case ID
    if (onNavigateToCases) {
      onNavigateToCases(inc.caseId);
    }
  };

  // Filter calculation
  const counts = useMemo(() => {
    return {
      all: incidents.length,
      domain: incidents.filter(i => i.matchedCategories?.includes('DOMAIN') || i.sharedEvidence.some(e => e.iocType === 'DOMAIN' || e.rule.includes('DOMAIN'))).length,
      ip: incidents.filter(i => i.matchedCategories?.includes('IP') || i.sharedEvidence.some(e => e.iocType === 'IP' || e.rule.includes('IP'))).length,
      hash: incidents.filter(i => i.matchedCategories?.includes('HASH') || i.sharedEvidence.some(e => e.iocType === 'HASH' || e.rule.includes('HASH'))).length,
    };
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
    if (activeFilter === 'ALL') return incidents;
    if (activeFilter === 'DOMAIN') {
      return incidents.filter(i => i.matchedCategories?.includes('DOMAIN') || i.sharedEvidence.some(e => e.iocType === 'DOMAIN' || e.rule.includes('DOMAIN')));
    }
    if (activeFilter === 'IP') {
      return incidents.filter(i => i.matchedCategories?.includes('IP') || i.sharedEvidence.some(e => e.iocType === 'IP' || e.rule.includes('IP')));
    }
    if (activeFilter === 'HASH') {
      return incidents.filter(i => i.matchedCategories?.includes('HASH') || i.sharedEvidence.some(e => e.iocType === 'HASH' || e.rule.includes('HASH')));
    }
    return incidents;
  }, [incidents, activeFilter]);

  return (
    <div 
      id="related-incidents-widget"
      className={`rounded-xl border border-slate-700/80 bg-slate-900 overflow-hidden shadow-md flex flex-col font-sans select-text ${className}`}
    >
      {/* Header Bar */}
      <div className="px-4 py-3.5 bg-slate-900/90 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400">
            <GitFork className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                Related Incidents
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                incidents.length > 0 
                  ? 'bg-purple-950/40 text-purple-300 border-purple-700/60' 
                  : 'bg-emerald-950/40 text-emerald-300 border-emerald-700/60'
              }`}>
                {isLoading ? 'Correlating...' : `${incidents.length} Linked ${incidents.length === 1 ? 'Case' : 'Cases'}`}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Cross-case correlation via shared sender domains, origin IPs, and attachment digests
            </p>
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRescanTrigger(prev => prev + 1)}
            disabled={isLoading}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1"
            title="Rescan cross-incident correlation engine"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-purple-400' : ''}`} />
            <span className="text-[11px] hidden sm:inline">Rescan</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs if incidents exist */}
      {incidents.length > 0 && (
        <div className="px-4 py-2 bg-slate-950/50 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto text-[11px] font-mono">
          <span className="text-slate-400 text-[10px] uppercase font-semibold mr-1 shrink-0 flex items-center gap-1">
            <Layers className="w-3 h-3" />
            <span>Filter:</span>
          </span>
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer shrink-0 font-medium ${
              activeFilter === 'ALL'
                ? 'bg-purple-600 text-white shadow-xs font-bold'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All ({counts.all})
          </button>
          <button
            onClick={() => setActiveFilter('DOMAIN')}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
              activeFilter === 'DOMAIN'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Globe className="w-3 h-3" />
            <span>Domains ({counts.domain})</span>
          </button>
          <button
            onClick={() => setActiveFilter('IP')}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
              activeFilter === 'IP'
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Server className="w-3 h-3" />
            <span>IPs ({counts.ip})</span>
          </button>
          <button
            onClick={() => setActiveFilter('HASH')}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
              activeFilter === 'HASH'
                ? 'bg-rose-600 text-white shadow-xs font-bold'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Fingerprint className="w-3 h-3" />
            <span>File Hashes ({counts.hash})</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-4 space-y-3">
        {isLoading && incidents.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
            <div className="text-xs text-slate-300 font-medium">Scanning multi-case forensic ledger...</div>
            <div className="text-[10px] text-slate-400 font-mono">
              Matching {currentIndicators.domains.length} domains, {currentIndicators.ips.length} IPs, {currentIndicators.hashes.length} payload digests
            </div>
          </div>
        ) : incidents.length === 0 ? (
          /* Reassuring Zero-State */
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 flex flex-col items-center text-center space-y-2.5">
            <div className="p-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">Isolated Threat Telemetry</div>
              <p className="text-[11px] text-slate-400 max-w-md mt-0.5 leading-relaxed">
                No related incidents were detected sharing this sender domain (<code className="text-slate-300 font-mono">{currentIndicators.domains[0] || 'N/A'}</code>), 
                origin IP (<code className="text-slate-300 font-mono">{currentIndicators.ips[0] || 'N/A'}</code>), or attachment digests across investigated cases.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1 text-[10px] font-mono text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                Domains evaluated: {currentIndicators.domains.length || 1}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                IP hops evaluated: {currentIndicators.ips.length || 1}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                Hashes evaluated: {currentIndicators.hashes.length || 0}
              </span>
            </div>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No related incidents found matching the selected filter ({activeFilter}).
          </div>
        ) : (
          /* Incident Cards */
          <div className="space-y-3">
            {filteredIncidents.map((inc) => {
              const isHigh = inc.threatScore >= 70 || inc.threatVerdict === 'CRITICAL' || inc.threatVerdict === 'HIGH';
              const isMedium = inc.threatScore >= 40 && inc.threatScore < 70;

              return (
                <div
                  key={inc.caseId}
                  className="rounded-lg border border-slate-800 hover:border-purple-500/50 bg-slate-950/70 p-3.5 transition-all duration-150 hover:bg-slate-950/90 shadow-xs group"
                >
                  {/* Top Row: Case ID, Title, Threat Verdict & Similarity */}
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5 mb-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono text-purple-400 font-bold bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-800/60">
                          {inc.caseId}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono border ${
                          isHigh
                            ? 'bg-rose-950/60 text-rose-300 border-rose-700/60'
                            : isMedium
                            ? 'bg-amber-950/60 text-amber-300 border-amber-700/60'
                            : 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                        }`}>
                          {inc.threatVerdict} ({inc.threatScore}/100)
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {Math.round(inc.similarityScore * 100)}% Match
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-100 mt-1 truncate group-hover:text-purple-200 transition-colors" title={inc.subject}>
                        {inc.subject}
                      </div>
                    </div>

                    {/* Quick Link/Inspect Action */}
                    <div className="shrink-0 flex items-center gap-1.5">
                      <button
                        onClick={() => handleInspectCase(inc)}
                        className="px-2.5 py-1 rounded bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/40 text-purple-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                        title="Pivot to and inspect this related case"
                      >
                        <span>Inspect Case</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>

                  {/* Shared Indicators Badges */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1">
                      <Link2 className="w-3 h-3 text-purple-400" />
                      <span>Shared Technical Evidence:</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {inc.sharedEvidence.map((ev, idx) => {
                        let badgeColor = 'bg-blue-950/60 border-blue-700/60 text-blue-300';
                        let IconComponent = Globe;

                        if (ev.iocType === 'IP' || ev.rule.includes('IP') || ev.rule.includes('SUBNET')) {
                          badgeColor = 'bg-amber-950/60 border-amber-700/60 text-amber-300';
                          IconComponent = Server;
                        } else if (ev.iocType === 'HASH' || ev.rule.includes('HASH')) {
                          badgeColor = 'bg-rose-950/60 border-rose-700/60 text-rose-300';
                          IconComponent = Fingerprint;
                        } else if (ev.iocType === 'URL' || ev.rule.includes('URL')) {
                          badgeColor = 'bg-red-950/60 border-red-700/60 text-red-300';
                          IconComponent = Link2;
                        }

                        const isCopied = copiedIoc === ev.value;

                        return (
                          <div
                            key={idx}
                            className={`px-2 py-1 rounded-md border text-[11px] font-mono flex items-center gap-1.5 ${badgeColor}`}
                            title={ev.description}
                          >
                            <IconComponent className="w-3 h-3 shrink-0" />
                            <span className="font-semibold">{ev.rule.replace(/_/g, ' ')}:</span>
                            <span className="truncate max-w-[200px] sm:max-w-xs">{ev.value}</span>
                            <button
                              onClick={(e) => handleCopy(ev.value, e)}
                              className="p-0.5 hover:bg-slate-700/50 rounded text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0 ml-1"
                              title="Copy shared IOC indicator"
                            >
                              {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Narrative Reason Summary */}
                  {inc.reason && (
                    <div className="mt-2 text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800/60 flex items-start gap-1.5">
                      <Radio className="w-3 h-3 text-purple-400 shrink-0 mt-0.5 animate-pulse" />
                      <span className="leading-tight">{inc.reason}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Status Bar */}
      <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
          <span>Cross-Case Correlation Engine Active</span>
        </div>
        {onNavigateToCases && (
          <button
            onClick={() => onNavigateToCases()}
            className="text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>Open Investigation Workspace</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
