import { useState, useEffect } from 'react';
import { 
  Terminal, 
  Search, 
  Copy, 
  Check, 
  RefreshCw,
  FileCode,
  Globe,
  Database,
  Cpu,
  Sparkles,
  Share2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { EmailAnalysis, ForensicLogEntry } from '../types';
import { forensicApi } from '../lib/api';

interface ThreatLogViewProps {
  analysis: EmailAnalysis;
}

export function ThreatLogView({ analysis }: ThreatLogViewProps) {
  const [filterTag, setFilterTag] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedIocs, setCopiedIocs] = useState<boolean>(false);
  const [logsState, setLogsState] = useState<ForensicLogEntry[]>(analysis?.logs || []);

  if (!analysis) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#14120f] text-[#8a8070]">
        <Terminal className="w-10 h-10 text-[#7fa3ba] mb-3" />
        <h3 className="text-base font-bold text-[#ede6d8]">No Analysis Selected</h3>
        <p className="text-xs text-[#8a8070] mt-1">Please select an analysis to inspect threat logs.</p>
      </div>
    );
  }
  const [isEnrichingVT, setIsEnrichingVT] = useState<boolean>(false);
  const [vtStatusInfo, setVtStatusInfo] = useState<{
    configured: boolean;
    active: boolean;
    provider: string;
    message: string;
  } | null>(null);
  const [vtStatus, setVtStatus] = useState<{
    vt_active?: boolean;
    is_configured?: boolean;
    scanned_count?: number;
    flagged_count?: number;
    message?: string;
    last_run?: string;
  } | null>(null);

  const tags = ['ALL', 'VT', 'API', 'SEC', 'DNS', 'ML', 'GRAPH', 'ALERT', 'INIT', 'INFO'];

  // Query VirusTotal integration status on mount
  useEffect(() => {
    let mounted = true;
    forensicApi.getVirusTotalStatus()
      .then((res) => {
        if (mounted) {
          setVtStatusInfo(res);
        }
      })
      .catch((err) => {
        console.warn('Unable to retrieve VirusTotal status:', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Keep local log state updated if analysis changes
  useEffect(() => {
    setLogsState(analysis.logs || []);
  }, [analysis]);

  const handleCopyLogs = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.tag}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyAllIocs = () => {
    const iocSet = new Set<string>();

    // 1. File hashes (SHA256, MD5)
    analysis.attachments?.forEach((att) => {
      if (att.sha256 && att.sha256.trim()) iocSet.add(att.sha256.trim());
      if (att.md5 && att.md5.trim()) iocSet.add(att.md5.trim());
    });

    // 2. IP addresses from transmission hops
    analysis.hops?.forEach((hop) => {
      if (hop.fromIp && hop.fromIp !== '127.0.0.1' && hop.fromIp !== '0.0.0.0' && hop.fromIp !== 'N/A') {
        iocSet.add(hop.fromIp.trim());
      }
    });

    // 3. Extracted Domains & URLs
    analysis.urls?.forEach((u) => {
      if (u.domain && u.domain.trim()) {
        iocSet.add(u.domain.trim());
      } else if (u.url && u.url.trim()) {
        try {
          const parsed = new URL(u.url);
          if (parsed.hostname) iocSet.add(parsed.hostname.trim());
        } catch {
          iocSet.add(u.url.trim());
        }
      }
    });

    // 4. Header sender domain
    const fromEmail = analysis.headers?.fromEmail || analysis.headers?.from || '';
    if (fromEmail.includes('@')) {
      const parts = fromEmail.split('@');
      const domain = parts[parts.length - 1].replace('>', '').trim().toLowerCase();
      if (domain) iocSet.add(domain);
    }

    const formattedBlock = Array.from(iocSet).filter(Boolean).join(', ');
    navigator.clipboard.writeText(formattedBlock);
    setCopiedIocs(true);
    setTimeout(() => setCopiedIocs(false), 2000);
  };

  const handleRunVirusTotalEnrichment = async () => {
    setIsEnrichingVT(true);
    try {
      const result = await forensicApi.enrichVirusTotal({
        caseId: analysis.id,
        urls: analysis.urls || [],
        attachments: analysis.attachments || [],
        existingLogs: logsState,
      });

      if (result.logs && Array.isArray(result.logs)) {
        setLogsState(result.logs);
      } else if (result.new_vt_logs && Array.isArray(result.new_vt_logs)) {
        setLogsState((prev) => [...prev, ...result.new_vt_logs]);
      }

      setVtStatus({
        vt_active: result.vt_active,
        is_configured: result.is_configured ?? result.vt_active,
        scanned_count: result.scanned_count,
        flagged_count: result.flagged_count,
        message: result.message,
        last_run: new Date().toLocaleTimeString(),
      });

      if (result.api_status) {
        setVtStatusInfo({
          configured: result.api_status.configured,
          active: result.api_status.configured,
          provider: result.api_status.provider,
          message: result.api_status.message
        });
      }
    } catch (err) {
      console.warn('VirusTotal enrichment request warning:', err);
      const fallbackLog: ForensicLogEntry = {
        id: `vt-err-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        tag: 'API',
        message: `[VirusTotal v3] Query attempt completed. Server returned unconfigured or unreachable status.`,
        highlight: false,
      };
      setLogsState((prev) => [...prev, fallbackLog]);
    } finally {
      setIsEnrichingVT(false);
    }
  };

  const filteredLogs = logsState.filter((log) => {
    const matchesTag =
      filterTag === 'ALL' ||
      log.tag === filterTag ||
      (filterTag === 'VT' && (log.tag === 'API' || log.tag === 'VT' || log.tag === 'VT_STATUS' || log.tag === 'VT_API' || log.message.includes('VirusTotal')));
    const matchesSearch =
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.timestamp.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.tag.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTag && matchesSearch;
  });

  const totalUrlsScanned = analysis.urls?.length || 0;
  const totalAttachmentsScanned = analysis.attachments?.length || 0;
  const maliciousUrlsCount = analysis.urls?.filter((u) => u.status === 'MALICIOUS').length || 0;
  const maliciousFilesCount = analysis.attachments?.filter((a) => a.status === 'MALICIOUS').length || 0;
  const isVtActive = vtStatusInfo ? vtStatusInfo.configured : (vtStatus ? vtStatus.vt_active : false);

  return (
    <div id="logs-view-container" className="flex-1 p-6 flex flex-col gap-4 overflow-hidden bg-[#14120f]">
      {/* Console Controls & VirusTotal Header Card */}
      <div className="bg-[#1a1712] border border-[#3a352c] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-white">Forensic Telemetry & VirusTotal Threat Intel Stream</h3>
              {isVtActive ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  VT API v3: ACTIVE
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/60 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-amber-400" />
                  VT API v3: INACTIVE (UNCONFIGURED)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Live RFC822 parsing, VirusTotal v3 URL/hash reputation, AbuseIPDB scoring, and ML audit stream
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopyAllIocs}
            className="bg-emerald-700/80 hover:bg-emerald-600 text-white border border-emerald-500/40 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            title="Copy all file hashes, IPs, and domains as a comma-separated list for SIEM / EDR import"
          >
            {copiedIocs ? (
              <Check className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Share2 className="w-3.5 h-3.5 text-emerald-300" />
            )}
            <span>{copiedIocs ? 'IOCs Copied!' : 'Copy All IOCs'}</span>
          </button>

          <button
            onClick={handleRunVirusTotalEnrichment}
            disabled={isEnrichingVT}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white border border-indigo-400/40 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isEnrichingVT ? 'animate-spin' : ''}`} />
            <span>{isEnrichingVT ? 'Querying VirusTotal...' : 'Query VirusTotal API'}</span>
          </button>

          <button
            onClick={handleCopyLogs}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Logs'}</span>
          </button>
        </div>
      </div>

      {/* Unconfigured Notice Banner when VT is inactive */}
      {!isVtActive && (
        <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-3 flex items-start gap-3 text-xs text-amber-200 font-mono">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold text-amber-300">VirusTotal v3 Integration Status: Inactive / Unconfigured.</span>
            <span className="ml-1 text-amber-200/90">
              Provide <code className="bg-amber-900/60 px-1 py-0.5 rounded text-amber-100 font-bold">VIRUSTOTAL_API_KEY</code> in your environment settings to enable live multi-engine URL and file hash reputation lookups. Local heuristics and cryptographic hash checks remain fully active.
            </span>
          </div>
        </div>
      )}

      {/* VirusTotal Threat Intelligence Summary Bar */}
      <div className="bg-[#182234] border border-slate-700/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-inner">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>URLs Scanned: <strong className="text-white">{totalUrlsScanned}</strong></span>
            {isVtActive ? (
              maliciousUrlsCount > 0 ? (
                <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800 font-semibold">
                  {maliciousUrlsCount} Malicious
                </span>
              ) : (
                <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                  All Clean
                </span>
              )
            ) : (
              <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                Dormant (Unconfigured)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
            <FileCode className="w-4 h-4 text-purple-400" />
            <span>Hashes Scanned: <strong className="text-white">{totalAttachmentsScanned}</strong></span>
            {isVtActive ? (
              maliciousFilesCount > 0 ? (
                <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800 font-semibold">
                  {maliciousFilesCount} Flagged
                </span>
              ) : (
                <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                  0 Flagged
                </span>
              )
            ) : (
              <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                Dormant (Unconfigured)
              </span>
            )}
          </div>

          {vtStatus && (
            <div className="text-[11px] text-indigo-300 font-mono flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${vtStatus.vt_active ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
              <span>{vtStatus.vt_active ? `VT API Refreshed at ${vtStatus.last_run}` : `VT Inactive at ${vtStatus.last_run}`}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <Database className="w-3.5 h-3.5 text-slate-500" />
          <span>Status: <code className={isVtActive ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>{isVtActive ? "CONFIGURED & ACTIVE" : "UNCONFIGURED (VIRUSTOTAL_API_KEY)"}</code></span>
        </div>
      </div>

      {/* Extracted IOC VirusTotal Quick Cards */}
      {((analysis.urls && analysis.urls.length > 0) || (analysis.attachments && analysis.attachments.length > 0)) && (
        <div className="bg-[#161F30] border border-slate-800 rounded-xl p-3 shrink-0 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-slate-300 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>Extracted IOC VirusTotal Detections</span>
            </div>
            <span className="text-[11px] text-slate-500 font-normal">Click log entry to inspect detail</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
            {analysis.urls?.map((u, i) => {
              const vtScore = u.virustotalScore || '';
              const isInactive = !isVtActive || vtScore.toLowerCase().includes('inactive') || vtScore.toLowerCase().includes('unconfigured') || vtScore.toLowerCase().includes('dormant');
              const isMal = u.status === 'MALICIOUS' && !isInactive;
              const isSusp = u.status === 'SUSPICIOUS' && !isInactive;
              const isClean = u.status === 'CLEAN' && !isInactive;

              return (
                <div
                  key={`u-${i}`}
                  onClick={() => setSearchQuery(u.domain || u.url)}
                  className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-lg p-2 flex items-center justify-between gap-2 text-xs font-mono transition-colors cursor-pointer"
                >
                  <div className="truncate flex-1">
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="text-slate-200 font-medium truncate">{u.domain || u.url}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">{u.defangedUrl || u.url}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      isMal 
                        ? 'bg-rose-950 text-rose-300 border border-rose-800' 
                        : isSusp
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : isClean
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {isInactive ? 'UNSCANNED' : u.status}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {isInactive ? 'VT Inactive' : (u.virustotalScore || '0/88 Engines')}
                    </div>
                  </div>
                </div>
              );
            })}

            {analysis.attachments?.map((att, i) => {
              const vtDet = att.vtDetection || '';
              const isInactive = !isVtActive || vtDet.toLowerCase().includes('inactive') || vtDet.toLowerCase().includes('unconfigured') || vtDet.toLowerCase().includes('dormant');
              const isMal = att.status === 'MALICIOUS' && !isInactive;
              const isSusp = att.status === 'SUSPICIOUS' && !isInactive;
              const isClean = att.status === 'CLEAN' && !isInactive;

              return (
                <div
                  key={`att-${i}`}
                  onClick={() => setSearchQuery(att.filename || att.sha256)}
                  className="bg-slate-900/90 border border-slate-800 hover:border-purple-500/50 rounded-lg p-2 flex items-center justify-between gap-2 text-xs font-mono transition-colors cursor-pointer"
                >
                  <div className="truncate flex-1">
                    <div className="flex items-center gap-1.5">
                      <FileCode className="w-3 h-3 text-purple-400 shrink-0" />
                      <span className="text-slate-200 font-medium truncate">{att.filename}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                      SHA256: {att.sha256 ? `${att.sha256.substring(0, 12)}...` : 'N/A'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      isMal 
                        ? 'bg-rose-950 text-rose-300 border border-rose-800' 
                        : isSusp
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : isClean
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {isInactive ? 'UNSCANNED' : att.status}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {isInactive ? 'VT Inactive' : (att.vtDetection || att.size || 'Artifact')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-[#1a1712] border border-[#3a352c] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Tag Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterTag(tag)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                filterTag === tag
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search VirusTotal logs & hashes..."
            className="w-full bg-slate-900 border border-slate-700 text-slate-200 pl-8 pr-3 py-1 rounded text-xs focus:outline-none focus:border-indigo-500 font-mono placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Terminal Display */}
      <div className="flex-1 bg-[#0B1120] border border-slate-800 rounded-xl p-4 font-mono text-xs overflow-y-auto space-y-2 shadow-inner">
        <div className="text-slate-500 pb-2 border-b border-slate-800 text-[11px] flex items-center justify-between">
          <span>VIRUSTOTAL_TELEMETRY_ENGINE: {isVtActive ? 'ACTIVE' : 'DORMANT (NO API KEY)'}</span>
          <span>ENTRIES: {filteredLogs.length}</span>
        </div>

        {filteredLogs.map((log) => {
          let tagColor = 'text-blue-400 bg-blue-950/40 border-blue-500/30';
          if (log.tag === 'DNS') tagColor = 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30';
          if (log.tag === 'SEC') tagColor = 'text-rose-400 bg-rose-950/40 border-rose-500/30';
          if (log.tag === 'API' || log.tag === 'VT' || log.tag === 'VT_API') tagColor = 'text-cyan-400 bg-cyan-950/40 border-cyan-500/30 font-semibold';
          if (log.tag === 'VT_STATUS') tagColor = 'text-amber-400 bg-amber-950/40 border-amber-500/30 font-semibold';
          if (log.tag === 'ML') tagColor = 'text-purple-400 bg-purple-950/40 border-purple-500/30';
          if (log.tag === 'ALERT') tagColor = 'text-rose-400 bg-rose-900/50 border-rose-500/50 font-bold';
          if (log.tag === 'INFO') tagColor = 'text-amber-400 bg-amber-950/40 border-amber-500/30';

          return (
            <div
              key={log.id}
              className={`p-1.5 rounded flex items-start gap-3 transition-colors hover:bg-slate-900/80 ${
                log.highlight ? 'bg-rose-950/30 border border-rose-500/40' : ''
              }`}
            >
              <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
              <span className={`px-1.5 py-0.2 rounded border text-[10px] uppercase font-bold shrink-0 ${tagColor}`}>
                {log.tag}
              </span>
              <span className="text-slate-200 break-all leading-relaxed">{log.message}</span>
            </div>
          );
        })}

        <div className="text-slate-500 pt-3 italic flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isVtActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
          <span>
            {isVtActive 
              ? 'Connected to Threat Intelligence Stream ... telemetry live' 
              : 'Threat Intelligence API integration standby (waiting for VIRUSTOTAL_API_KEY configuration)'}
          </span>
        </div>
      </div>
    </div>
  );
}
