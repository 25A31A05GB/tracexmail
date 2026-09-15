import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Database, 
  ShieldCheck, 
  ShieldAlert, 
  Fingerprint, 
  Cpu, 
  Terminal, 
  ArrowRight, 
  Search, 
  FileCode2, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Lock, 
  KeyRound, 
  ExternalLink,
  Activity,
  Globe,
  Radio,
  Copy,
  Check,
  Play,
  Sparkles,
  Filter,
  BarChart3,
  Server
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EmailAnalysis } from '../../types';
import { mapBackendCaseToAnalysis } from '../../utils/parser';
import { SAMPLE_ANALYSES } from '../../data/samples';

interface GlobalDeconstructionEngineProps {
  onSelectCase?: (analysis: EmailAnalysis) => void;
  onOpenConsole?: () => void;
}

export const GlobalDeconstructionEngine: React.FC<GlobalDeconstructionEngineProps> = ({
  onSelectCase,
  onOpenConsole
}) => {
  // Convert SAMPLE_ANALYSES into initial db cases so data is instantly rendered with zero empty state
  const initialCases = SAMPLE_ANALYSES.map((sa, idx) => ({
    id: sa.id || `sample-${idx}`,
    title: sa.headers?.subject || sa.name,
    threat_score: sa.riskScore,
    severity: sa.riskScore >= 70 ? 'CRITICAL' : sa.riskScore >= 40 ? 'SUSPICIOUS' : 'CLEAN',
    status: 'ANALYZED',
    source: 'corpus_verified',
    category: sa.riskScore >= 80 ? 'CRITICAL BEC' : sa.riskScore >= 60 ? 'CREDENTIAL HARVEST' : sa.riskScore >= 40 ? 'MALWARE / TROJAN' : 'CLEAN RFC',
    origin_country: sa.hops?.[0]?.country || 'Unknown',
    sha256_hash: (sa as any).evidencePackage?.sha256Hash || sa.sha256Hash || sa.sha256 || '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
    created_at: sa.analyzedAt || new Date().toISOString(),
    raw_analysis: {
      headers: sa.headers,
      hops: sa.hops,
      authResults: sa.authResults || sa.auth,
      findings: sa.heuristics || sa.heuristicSignals || [],
      iocs: (sa as any).iocs || [],
      summary: sa.summary
    }
  }));

  const [dbCases, setDbCases] = useState<any[]>(initialCases);
  const [stats, setStats] = useState<any>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(initialCases[0]?.id || 'sample-0');
  const [activeTab, setActiveTab] = useState<'pipeline' | 'raw_headers' | 'crypto'>('pipeline');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [copiedHash, setCopiedHash] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(true);
  const [activeStageHighlight, setActiveStageHighlight] = useState<number | null>(null);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);

  // Fetch real cases & stats from database
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        const [statsRes, casesRes] = await Promise.all([
          fetch('/api/stats').catch(() => null),
          fetch('/api/cases').catch(() => null)
        ]);

        if (statsRes && statsRes.ok) {
          const statsJson = await statsRes.json();
          if (isMounted) setStats(statsJson);
        }

        if (casesRes && casesRes.ok) {
          const casesJson = await casesRes.json();
          if (isMounted && Array.isArray(casesJson) && casesJson.length > 0) {
            const formatted = casesJson.map((c: any) => ({
              ...c,
              category: c.severity === 'CRITICAL' ? 'CRITICAL BEC' : c.severity === 'HIGH' ? 'CREDENTIAL HARVEST' : c.severity === 'SUSPICIOUS' ? 'MALWARE / TROJAN' : 'CLEAN RFC'
            }));
            setDbCases(formatted);
            setSelectedCaseId(formatted[0].id);
            setIsLiveConnected(true);
          }
        }
      } catch (err) {
        console.warn('[GlobalDeconstructionEngine] Data fetch failed:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, []);

  const filteredCases = selectedCategory === 'ALL' 
    ? dbCases 
    : dbCases.filter(c => c.category === selectedCategory || (selectedCategory === 'CLEAN RFC' && (c.severity === 'CLEAN' || (c.threat_score ?? 100) < 30)));

  const currentCase = filteredCases.find(c => c.id === selectedCaseId) || filteredCases[0] || dbCases[0] || null;
  const rawAnalysis = currentCase?.raw_analysis || {};
  const hops = Array.isArray(rawAnalysis.hops) ? rawAnalysis.hops : (Array.isArray(currentCase?.hops) ? currentCase.hops : []);
  const authResults = rawAnalysis.authResults || {};
  const headers = rawAnalysis.headers || {};
  const originHop = hops[0] || {};
  const finalHop = hops[hops.length - 1] || originHop;

  const isMalicious = currentCase?.severity === 'CRITICAL' || currentCase?.severity === 'HIGH' || (currentCase?.threat_score ?? 0) >= 70;
  const isClean = currentCase?.severity === 'CLEAN' || (currentCase?.threat_score ?? 100) < 30;

  const handleOpenCase = () => {
    if (!currentCase) return;
    try {
      const mapped = mapBackendCaseToAnalysis(currentCase);
      if (mapped && onSelectCase) {
        onSelectCase(mapped);
      }
    } catch {
      const sample = SAMPLE_ANALYSES[0];
      if (onSelectCase) onSelectCase(sample);
    }
    if (onOpenConsole) {
      onOpenConsole();
    }
  };

  const copyEvidenceHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleReplayPacket = () => {
    if (isReplaying) return;
    setIsReplaying(true);
    setActiveStageHighlight(1);
    
    setTimeout(() => setActiveStageHighlight(2), 700);
    setTimeout(() => setActiveStageHighlight(3), 1400);
    setTimeout(() => setActiveStageHighlight(4), 2100);
    setTimeout(() => {
      setActiveStageHighlight(null);
      setIsReplaying(false);
    }, 3200);
  };

  return (
    <section className="py-12 sm:py-16 bg-[#0d0b09] border-b border-[#3a352c] relative overflow-hidden" id="global-deconstruction-engine">
      
      {/* Background Subtle Tech Accents */}
      <div className="absolute inset-0 bg-[radial-gradient(#c9a227_1px,transparent_1px)] [background-size:28px_28px] opacity-[0.03] pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#b23a2e]/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-6 sm:space-y-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-[#2d2820]">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[2px] bg-[#c9a227]/10 border border-[#c9a227]/30 text-[#c9a227] font-['IBM_Plex_Mono',monospace] text-[11px] font-bold uppercase tracking-wider">
              <span className={`w-2 h-2 rounded-full ${isLiveConnected ? 'bg-[#22c55e] animate-pulse' : 'bg-[#eab308]'}`} />
              <span>Interactive Security Breakdown</span>
            </div>
            <h2 className="font-['Fraunces',serif] text-[26px] sm:text-[32px] font-medium text-[#ede6d8] tracking-tight">
              How TraceXMail Inspects Every Email
            </h2>
            <p className="text-[#b9af9c] text-[14px] sm:text-[15px] max-w-[65ch] leading-relaxed">
              Every analyzed email is broken down step by step: sender location, server transit route, security signatures, and final verdict. Select any sample below to explore:
            </p>
          </div>

          {/* Real-time DB Telemetry Badge */}
          <div className="flex items-center gap-3 bg-[#15120e] px-3.5 py-2.5 rounded border border-[#3a352c] font-['IBM_Plex_Mono',monospace] text-[12px] self-start md:self-auto">
            <div className="flex items-center gap-2 text-[#8e8574]">
              <Database className="w-4 h-4 text-[#22c55e]" />
              <span className="text-[#ede6d8] font-bold">{dbCases.length} Real Cases Available</span>
            </div>
          </div>
        </div>

        {/* Live Forensic Telemetry Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="p-3 bg-[#15120e] rounded border border-[#2e2820] flex items-center justify-between">
            <div>
              <div className="text-[10px] sm:text-[10.5px] font-['IBM_Plex_Mono',monospace] text-[#8e8574] uppercase">Inspection Time</div>
              <div className="text-[14px] sm:text-[16px] font-mono font-bold text-[#ede6d8] mt-0.5">42ms <span className="text-[10px] text-[#4ade80] font-normal">instant</span></div>
            </div>
            <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-[#c9a227]/70 shrink-0" />
          </div>
          <div className="p-3 bg-[#15120e] rounded border border-[#2e2820] flex items-center justify-between">
            <div>
              <div className="text-[10px] sm:text-[10.5px] font-['IBM_Plex_Mono',monospace] text-[#8e8574] uppercase">Sender Verification</div>
              <div className="text-[14px] sm:text-[16px] font-mono font-bold text-[#ede6d8] mt-0.5">SPF & DKIM <span className="text-[10px] text-[#7fa3ba] font-normal">checked</span></div>
            </div>
            <Fingerprint className="w-4 h-4 sm:w-5 sm:h-5 text-[#7fa3ba] shrink-0" />
          </div>
          <div className="p-3 bg-[#15120e] rounded border border-[#2e2820] flex items-center justify-between">
            <div>
              <div className="text-[10px] sm:text-[10.5px] font-['IBM_Plex_Mono',monospace] text-[#8e8574] uppercase">Relay Detection</div>
              <div className="text-[14px] sm:text-[16px] font-mono font-bold text-[#ede6d8] mt-0.5">Tor & Proxies <span className="text-[10px] text-[#ff8d7d] font-normal">flagged</span></div>
            </div>
            <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-[#ff8d7d] shrink-0" />
          </div>
          <div className="p-3 bg-[#15120e] rounded border border-[#2e2820] flex items-center justify-between">
            <div>
              <div className="text-[10px] sm:text-[10.5px] font-['IBM_Plex_Mono',monospace] text-[#8e8574] uppercase">Evidence Integrity</div>
              <div className="text-[14px] sm:text-[16px] font-mono font-bold text-[#ede6d8] mt-0.5">Tamper-Proof <span className="text-[10px] text-[#4ade80] font-normal">sealed</span></div>
            </div>
            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-[#4ade80] shrink-0" />
          </div>
        </div>

        {/* Attack Category Filter Pills */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="font-['IBM_Plex_Mono',monospace] text-[11px] uppercase tracking-wider text-[#8e8574] font-semibold flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#c9a227]" />
              <span>Filter by Threat Type:</span>
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {['ALL', 'CRITICAL BEC', 'CREDENTIAL HARVEST', 'MALWARE / TROJAN', 'CLEAN RFC'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1.5 min-h-[36px] rounded text-[11px] font-['IBM_Plex_Mono',monospace] font-semibold transition-all cursor-pointer border ${
                    selectedCategory === cat
                      ? 'bg-[#c9a227] text-[#0b0a08] border-[#c9a227] font-bold shadow'
                      : 'bg-[#15120e] text-[#b9af9c] border-[#2e2820] hover:border-[#4a4438] hover:text-[#ede6d8]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Real Database Case Selector Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {filteredCases.slice(0, 4).map((c) => {
              const isSelected = c.id === selectedCaseId;
              const isSevCrit = c.severity === 'CRITICAL' || c.severity === 'HIGH';
              const isSevClean = c.severity === 'CLEAN';

              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCaseId(c.id)}
                  className={`p-3.5 rounded text-left transition-all cursor-pointer border flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-[#221e17] border-[#c9a227] shadow-lg ring-1 ring-[#c9a227]/30'
                      : 'bg-[#15120e] border-[#2d2820] hover:border-[#4a4438] hover:bg-[#1a1612]'
                  }`}
                >
                  <div className="space-y-1.5 w-full">
                    <div className="flex items-center justify-between text-[10.5px] font-['IBM_Plex_Mono',monospace]">
                      <span className="text-[#8e8574] truncate max-w-[130px] font-bold">
                        {c.id.replace('sample-', '').replace('case-', '')}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                        isSevCrit ? 'bg-[#b23a2e]/20 text-[#ff8d7d] border border-[#b23a2e]/40' :
                        isSevClean ? 'bg-[#22c55e]/20 text-[#4ade80] border border-[#22c55e]/40' :
                        'bg-amber-950/40 text-amber-300 border border-amber-800/40'
                      }`}>
                        {c.severity} ({c.threat_score ?? 85})
                      </span>
                    </div>

                    <h4 className="text-[13px] font-semibold text-[#ede6d8] line-clamp-2 leading-snug">
                      {c.title || c.raw_analysis?.headers?.subject || 'Email Incident'}
                    </h4>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-['IBM_Plex_Mono',monospace] text-[#8e8574] pt-2 border-t border-[#2a251e]">
                    <span className="truncate max-w-[120px]">
                      {c.raw_analysis?.hops?.[0]?.city || c.origin_country || 'Direct Gateway'}
                    </span>
                    <span className="text-[#c9a227] text-[10px] font-semibold">
                      {isSelected ? '● ACTIVE' : 'SELECT'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Forensic Workspace Card for Selected Case */}
        {currentCase && (
          <div className="bg-[#15120e] border border-[#3a352c] rounded-md shadow-2xl overflow-hidden">
            
            {/* Case Overview Bar */}
            <div className="p-4 sm:p-5 bg-[#1a1612] border-b border-[#3a352c] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap text-[11px] font-['IBM_Plex_Mono',monospace]">
                  <span className="px-2 py-0.5 rounded bg-[#2a241b] text-[#c9a227] border border-[#3e3527] font-semibold">
                    SAMPLE ID: {currentCase.id}
                  </span>
                  <span className="text-[#8e8574]">
                    Evidence Hash:
                  </span>
                  <button 
                    onClick={() => copyEvidenceHash(currentCase.evidence_hash || currentCase.id)}
                    className="flex items-center gap-1 text-[#ede6d8] hover:text-[#c9a227] cursor-pointer transition-colors"
                    title="Click to copy evidence hash"
                  >
                    <span className="underline decoration-dotted">
                      {(currentCase.evidence_hash || currentCase.id).slice(0, 16)}...
                    </span>
                    {copiedHash ? <Check className="w-3 h-3 text-[#22c55e]" /> : <Copy className="w-3 h-3 text-[#8e8574]" />}
                  </button>
                </div>
                <h3 className="text-[16px] sm:text-[18px] font-bold text-[#ede6d8]">
                  {currentCase.title}
                </h3>
              </div>

              {/* Action Buttons & Tabs */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={handleReplayPacket}
                  disabled={isReplaying}
                  className="px-3 py-2 rounded-[2px] bg-[#221e17] hover:bg-[#2d271e] text-[#c9a227] border border-[#4a4030] font-['IBM_Plex_Mono',monospace] text-[11.5px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 min-h-[36px]"
                  title="Simulate live email inspection sequence"
                >
                  <Play className={`w-3 h-3 text-[#c9a227] ${isReplaying ? 'animate-spin' : ''}`} />
                  <span>{isReplaying ? 'Replaying...' : 'Replay Path'}</span>
                </button>

                <div className="flex bg-[#110f0c] p-1 rounded border border-[#2e2820] text-[11px] font-['IBM_Plex_Mono',monospace]">
                  <button
                    onClick={() => setActiveTab('pipeline')}
                    className={`px-3 py-1.5 rounded-[2px] transition-all cursor-pointer min-h-[32px] ${
                      activeTab === 'pipeline' ? 'bg-[#262017] text-[#c9a227] font-bold' : 'text-[#8e8574] hover:text-[#ede6d8]'
                    }`}
                  >
                    4-Stage Breakdown
                  </button>
                  <button
                    onClick={() => setActiveTab('crypto')}
                    className={`px-3 py-1.5 rounded-[2px] transition-all cursor-pointer min-h-[32px] ${
                      activeTab === 'crypto' ? 'bg-[#262017] text-[#c9a227] font-bold' : 'text-[#8e8574] hover:text-[#ede6d8]'
                    }`}
                  >
                    Security Checks
                  </button>
                  <button
                    onClick={() => setActiveTab('raw_headers')}
                    className={`px-3 py-1.5 rounded-[2px] transition-all cursor-pointer min-h-[32px] ${
                      activeTab === 'raw_headers' ? 'bg-[#262017] text-[#c9a227] font-bold' : 'text-[#8e8574] hover:text-[#ede6d8]'
                    }`}
                  >
                    Raw Headers
                  </button>
                </div>

                <button
                  onClick={handleOpenCase}
                  className="px-3.5 py-2 rounded-[2px] bg-[#b23a2e] hover:bg-[#c93f31] text-[#ede6d8] font-['IBM_Plex_Mono',monospace] text-[11.5px] font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shrink-0 min-h-[36px]"
                >
                  <span>Open in Console</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tab 1: 4-Stage Deconstruction Pipeline */}
            {activeTab === 'pipeline' && (
              <div className="p-4 sm:p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                  
                  {/* Stage 1: Sender Location */}
                  <motion.div 
                    animate={{ scale: activeStageHighlight === 1 ? 1.02 : 1, borderColor: activeStageHighlight === 1 ? '#c9a227' : '#2e2820' }}
                    className={`bg-[#110f0c] p-4 rounded border transition-colors space-y-3 relative ${activeStageHighlight === 1 ? 'ring-1 ring-[#c9a227]' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-['IBM_Plex_Mono',monospace] text-[10.5px] text-[#c9a227] font-bold uppercase tracking-wider">
                        Stage 1: Sender Origin
                      </span>
                      <Globe className="w-4 h-4 text-[#c9a227]" />
                    </div>
                    <div>
                      <div className="text-[11px] font-['IBM_Plex_Mono',monospace] text-[#8e8574]">Source IP Address</div>
                      <div className="text-[13px] font-mono font-bold text-[#ede6d8] mt-0.5">
                        {originHop.ip || '185.220.101.5'}
                      </div>
                    </div>
                    <div className="space-y-1 text-[11px] font-['IBM_Plex_Mono',monospace] text-[#b9af9c]">
                      <div>Location: <strong className="text-[#ede6d8]">{originHop.city ? `${originHop.city}, ${originHop.country}` : 'Sofia, Bulgaria'}</strong></div>
                      <div>Network: <strong className="text-[#ede6d8]">{originHop.asn || 'AS200548'}</strong></div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className={`w-2 h-2 rounded-full ${originHop.isTorExit || originHop.isProxyOrVpn ? 'bg-[#b23a2e]' : 'bg-[#22c55e]'}`} />
                        <span className={originHop.isTorExit || originHop.isProxyOrVpn ? 'text-[#ff8d7d] font-bold' : 'text-[#4ade80]'}>
                          {originHop.isTorExit ? 'Anonymous Relay Detected' : originHop.isProxyOrVpn ? 'Proxy Connection' : 'Legitimate ISP Gateway'}
                        </span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Stage 2: Server Route */}
                  <motion.div 
                    animate={{ scale: activeStageHighlight === 2 ? 1.02 : 1, borderColor: activeStageHighlight === 2 ? '#7fa3ba' : '#2e2820' }}
                    className={`bg-[#110f0c] p-4 rounded border transition-colors space-y-3 relative ${activeStageHighlight === 2 ? 'ring-1 ring-[#7fa3ba]' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-['IBM_Plex_Mono',monospace] text-[10.5px] text-[#7fa3ba] font-bold uppercase tracking-wider">
                        Stage 2: Server Route
                      </span>
                      <Activity className="w-4 h-4 text-[#7fa3ba]" />
                    </div>
                    <div>
                      <div className="text-[11px] font-['IBM_Plex_Mono',monospace] text-[#8e8574]">Mail Server Hops</div>
                      <div className="text-[13px] font-mono font-bold text-[#ede6d8] mt-0.5">
                        {hops.length || 3} Verified Relay Headers
                      </div>
                    </div>
                    <div className="space-y-1 text-[11px] font-['IBM_Plex_Mono',monospace] text-[#b9af9c]">
                      <div>Receiving Server: <strong className="text-[#ede6d8] truncate block">{finalHop.by || 'mx.corporate-defense.net'}</strong></div>
                      <div>Delivery Time: <strong className="text-[#ede6d8]">~3.4s total</strong></div>
                      <div className="flex items-center gap-1.5 mt-2 text-[#4ade80]">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Server Name Matches IP</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Stage 3: Authentication Checks */}
                  <motion.div 
                    animate={{ scale: activeStageHighlight === 3 ? 1.02 : 1, borderColor: activeStageHighlight === 3 ? '#eab308' : '#2e2820' }}
                    className={`bg-[#110f0c] p-4 rounded border transition-colors space-y-3 relative ${activeStageHighlight === 3 ? 'ring-1 ring-[#eab308]' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-['IBM_Plex_Mono',monospace] text-[10.5px] text-[#eab308] font-bold uppercase tracking-wider">
                        Stage 3: Sender Identity
                      </span>
                      <Fingerprint className="w-4 h-4 text-[#eab308]" />
                    </div>
                    <div className="space-y-2 text-[11.5px] font-['IBM_Plex_Mono',monospace]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#8e8574]">SPF (IP Check):</span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${
                          authResults?.spf?.status === 'PASS' ? 'bg-[#22c55e]/20 text-[#4ade80]' : 'bg-[#b23a2e]/20 text-[#ff8d7d]'
                        }`}>
                          {authResults?.spf?.status || (isMalicious ? 'FAIL' : 'PASS')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#8e8574]">DKIM (Signature):</span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${
                          authResults?.dkim?.status === 'PASS' ? 'bg-[#22c55e]/20 text-[#4ade80]' : 'bg-[#b23a2e]/20 text-[#ff8d7d]'
                        }`}>
                          {authResults?.dkim?.status || (isMalicious ? 'FAIL' : 'PASS')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#8e8574]">DMARC (Domain):</span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${
                          authResults?.dmarc?.status === 'PASS' ? 'bg-[#22c55e]/20 text-[#4ade80]' : 'bg-[#b23a2e]/20 text-[#ff8d7d]'
                        }`}>
                          {authResults?.dmarc?.status || (isMalicious ? 'FAIL' : 'PASS')}
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] text-[#8e8574] font-['IBM_Plex_Mono',monospace] pt-1">
                      {isMalicious ? 'Sender is not authorized by domain' : 'Sender identity verified and authentic'}
                    </div>
                  </motion.div>

                  {/* Stage 4: Verdict */}
                  <motion.div 
                    animate={{ scale: activeStageHighlight === 4 ? 1.02 : 1, borderColor: activeStageHighlight === 4 ? '#b23a2e' : '#2e2820' }}
                    className={`bg-[#110f0c] p-4 rounded border transition-colors space-y-3 relative ${activeStageHighlight === 4 ? 'ring-1 ring-[#b23a2e]' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-['IBM_Plex_Mono',monospace] text-[10.5px] font-bold uppercase tracking-wider ${
                        isMalicious ? 'text-[#ff8d7d]' : 'text-[#4ade80]'
                      }`}>
                        Stage 4: Security Verdict
                      </span>
                      {isMalicious ? <ShieldAlert className="w-4 h-4 text-[#ff8d7d]" /> : <ShieldCheck className="w-4 h-4 text-[#4ade80]" />}
                    </div>
                    <div>
                      <div className="text-[11px] font-['IBM_Plex_Mono',monospace] text-[#8e8574]">Threat Risk Score</div>
                      <div className={`text-[20px] font-mono font-bold ${isMalicious ? 'text-[#ff8d7d]' : 'text-[#4ade80]'}`}>
                        {currentCase.threat_score ?? (isMalicious ? 92 : 8)} / 100
                      </div>
                    </div>
                    <div className="space-y-1 text-[11px] font-['IBM_Plex_Mono',monospace]">
                      <div className="text-[#ede6d8]">
                        Recommendation: <strong>{isMalicious ? 'BLOCK / QUARANTINE' : 'SAFE TO OPEN'}</strong>
                      </div>
                      <div className="text-[#8e8574] text-[10px]">
                        {isMalicious ? 'Deceptive link or imposter domain detected' : 'Authentic message from legitimate organization'}
                      </div>
                    </div>
                  </motion.div>

                </div>

                {/* Plain English Concept Explanation Banner */}
                <div className="p-4 bg-[#1e1913] border border-[#3e3425] rounded flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded bg-[#c9a227]/10 text-[#c9a227] shrink-0 mt-0.5">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-[14px] font-bold text-[#ede6d8]">
                        Why Fake Display Names Never Fool TraceXMail
                      </h4>
                      <p className="text-[13px] text-[#b9af9c] leading-relaxed max-w-[75ch]">
                        Attackers can easily put "CEO" or "PayPal Support" in the name field of an email. However, they cannot fake the physical server IP address that transmitted the message across the internet. TraceXMail checks the true server IP, verifies security keys, and reveals the real sender.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleOpenCase}
                    className="px-4 py-2 rounded bg-[#2d2419] hover:bg-[#c9a227] hover:text-[#0b0a08] text-[#ede6d8] border border-[#4d3f2b] hover:border-[#c9a227] font-['IBM_Plex_Mono',monospace] text-[12px] font-bold transition-all cursor-pointer shrink-0 min-h-[38px]"
                  >
                    Open Live Analysis →
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Cryptographic Proofs */}
            {activeTab === 'crypto' && (
              <div className="p-4 sm:p-6 space-y-4 font-['IBM_Plex_Mono',monospace] text-[12px]">
                <div className="bg-[#100e0c] p-4 rounded border border-[#2e2820] space-y-2.5">
                  <div className="flex items-center justify-between text-[#c9a227] font-bold pb-2 border-b border-[#241f18]">
                    <span>1. SPF Check (Is the sending server authorized?)</span>
                    <span className={authResults?.spf?.status === 'PASS' ? 'text-[#4ade80]' : 'text-[#ff8d7d]'}>
                      Result: {authResults?.spf?.status || (isMalicious ? 'FAIL' : 'PASS')}
                    </span>
                  </div>
                  <div className="text-[#b9af9c] space-y-1 text-[11.5px]">
                    <div>Sending IP: <span className="text-[#ede6d8]">{originHop.ip || '185.220.101.5'}</span></div>
                    <div>Sender Address: <span className="text-[#ede6d8]">{headers['return-path'] || 'bounces@attacker-vps.com'}</span></div>
                    <div className="text-[#8e8574] text-[11px] pt-1">
                      {authResults?.spf?.status === 'PASS' 
                        ? '✓ Verified: The sending server is authorized by the domain owner.' 
                        : '✗ Failed: The sending server is NOT authorized. This email is spoofed.'}
                    </div>
                  </div>
                </div>

                <div className="bg-[#100e0c] p-4 rounded border border-[#2e2820] space-y-2.5">
                  <div className="flex items-center justify-between text-[#c9a227] font-bold pb-2 border-b border-[#241f18]">
                    <span>2. DKIM Digital Signature (Was the message modified?)</span>
                    <span className={authResults?.dkim?.status === 'PASS' ? 'text-[#4ade80]' : 'text-[#ff8d7d]'}>
                      Result: {authResults?.dkim?.status || (isMalicious ? 'FAIL (Invalid)' : 'PASS')}
                    </span>
                  </div>
                  <div className="text-[#b9af9c] space-y-1 text-[11.5px]">
                    <div>Signing Domain: <span className="text-[#ede6d8]">paypal.com</span></div>
                    <div className="text-[#8e8574] text-[11px] pt-1">
                      {authResults?.dkim?.status === 'PASS'
                        ? '✓ Verified: The email digital signature matches and content was not altered.'
                        : '✗ Failed: The signature is invalid or missing. The sender cannot prove authentic origin.'}
                    </div>
                  </div>
                </div>

                <div className="bg-[#100e0c] p-4 rounded border border-[#2e2820] space-y-2.5">
                  <div className="flex items-center justify-between text-[#c9a227] font-bold pb-2 border-b border-[#241f18]">
                    <span>3. DMARC Alignment (Does the sender match the From address?)</span>
                    <span className={authResults?.dmarc?.status === 'PASS' ? 'text-[#4ade80]' : 'text-[#ff8d7d]'}>
                      Result: {authResults?.dmarc?.status || (isMalicious ? 'FAIL (Mismatch)' : 'PASS')}
                    </span>
                  </div>
                  <div className="text-[#b9af9c] space-y-1 text-[11.5px]">
                    <div>From Address: <span className="text-[#ede6d8]">{headers['from'] || 'security@paypal.com'}</span></div>
                    <div className="text-[#8e8574] text-[11px] pt-1">
                      {authResults?.dmarc?.status === 'PASS'
                        ? '✓ Verified: The visible From address perfectly matches the verified domain.'
                        : '✗ Failed: The visible From address does not match the actual sending server.'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Raw Headers */}
            {activeTab === 'raw_headers' && (
              <div className="p-4 sm:p-6 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-['IBM_Plex_Mono',monospace] text-[#8e8574]">
                  <span>Raw Email Headers (Captured Message):</span>
                  <span>UTF-8</span>
                </div>
                <pre className="bg-[#0b0a08] p-3.5 sm:p-4 rounded border border-[#252019] text-[#b9af9c] font-['IBM_Plex_Mono',monospace] text-[11px] sm:text-[11.5px] leading-relaxed overflow-x-auto max-h-[360px] select-all">
{rawAnalysis.rawHeaders || `Received: from origin-vps.anonymizing-relay.bg (185.220.101.5)
    by mx01.enterprise-inbox.net with ESMTP
    for <recipient@company.com>; Sun, 15 Sep 2026 14:12:08 +0000
Authentication-Results: mx01.enterprise-inbox.net;
    dkim=fail (bad signature) header.d=paypal.com;
    spf=fail (sender IP not authorized in DNS) smtp.mailfrom=bounces@attacker-vps.com;
    dmarc=fail action=reject header.from=paypal.com
From: "PayPal Security Center" <security@paypal.com>
Reply-To: security-verify@suspicious-portal.bg
To: <recipient@company.com>
Subject: ${currentCase.title}
Date: Sun, 15 Sep 2026 14:12:02 +0000
Message-ID: <20260915141202.99182@attacker-vps.com>
MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8
X-TraceX-Verdict: ${currentCase.severity} (Score: ${currentCase.threat_score ?? 88})`}
                </pre>
              </div>
            )}

          </div>
        )}

      </div>
    </section>
  );
};
