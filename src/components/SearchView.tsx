import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Mail, 
  Globe, 
  FileText, 
  Clock, 
  ArrowRight,
  Sparkles,
  Database,
  FlaskConical
} from 'lucide-react';
import { EmailAnalysis } from '../types';
import { SAMPLE_ANALYSES } from '../data/samples';
import { getStandardizedVerdict } from '../utils/verdict';

interface SearchViewProps {
  onSelectAnalysis: (analysis: EmailAnalysis) => void;
  onNavigateToOverview: () => void;
  showDemoCases?: boolean;
  currentAnalysis?: EmailAnalysis;
  onToggleDemoCases?: () => void;
}

export function SearchView({ 
  onSelectAnalysis, 
  onNavigateToOverview, 
  showDemoCases = false,
  currentAnalysis,
  onToggleDemoCases 
}: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('ALL');
  const [authFilter, setAuthFilter] = useState('ALL');

  const dataset = useMemo(() => {
    const list: EmailAnalysis[] = [];
    if (currentAnalysis && (!(currentAnalysis as any).is_demo || showDemoCases)) {
      list.push(currentAnalysis);
    }
    if (showDemoCases) {
      SAMPLE_ANALYSES.forEach(s => {
        if (!list.some(item => item.id === s.id)) {
          list.push(s);
        }
      });
    }
    return list;
  }, [showDemoCases, currentAnalysis]);

  const filteredResults = useMemo(() => {
    const q = query.toLowerCase().trim();
    return dataset.filter(analysis => {
      // Verdict check
      if (verdictFilter !== 'ALL') {
        const std = getStandardizedVerdict(analysis);
        if (std.category !== verdictFilter && std.verdict !== verdictFilter && std.severity !== verdictFilter) return false;
      }
      // Auth check
      if (authFilter !== 'ALL') {
        const spfPass = analysis.authResults?.spf?.status === 'PASS';
        const dkimPass = analysis.authResults?.dkim?.status === 'PASS';
        const dmarcPass = analysis.authResults?.dmarc?.status === 'PASS';
        if (authFilter === 'FAIL' && (spfPass && dkimPass && dmarcPass)) return false;
        if (authFilter === 'PASS' && (!spfPass || !dkimPass || !dmarcPass)) return false;
      }

      if (!q) return true;

      // Match subject, sender, recipient, messageId, IPs, URLs, hashes
      const matchSubject = analysis.subject?.toLowerCase().includes(q);
      const matchFrom = analysis.from?.toLowerCase().includes(q);
      const matchTo = analysis.to?.toLowerCase().includes(q);
      const matchMessageId = analysis.messageId?.toLowerCase().includes(q);
      const matchIps = analysis.hops?.some(h => h.fromIp?.toLowerCase().includes(q) || h.asn?.toLowerCase().includes(q) || h.org?.toLowerCase().includes(q));
      const matchUrls = analysis.urls?.some(u => u.url.toLowerCase().includes(q) || u.domain.toLowerCase().includes(q));
      const matchBody = analysis.rawHeaders?.toLowerCase().includes(q);

      return matchSubject || matchFrom || matchTo || matchMessageId || matchIps || matchUrls || matchBody;
    });
  }, [dataset, query, verdictFilter, authFilter]);

  const handleSelect = (analysis: EmailAnalysis) => {
    onSelectAnalysis(analysis);
    onNavigateToOverview();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#14120f] overflow-y-auto p-6 space-y-6">
      {/* Top Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Search className="w-5 h-5 text-cyan-400" />
              <span>Forensic Query &amp; IOC Search</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Search across ingested email corpus by IP address, domain, sender, subject, or cryptographic hash.
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2.5 py-1 rounded-full">
            {filteredResults.length} Result{filteredResults.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by IP (e.g. 185.220), domain, subject keyword, sender, SHA-256..."
            className="w-full pl-12 pr-16 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <kbd className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#1e1b15] border border-slate-700 rounded text-slate-400">
              Alt+5
            </kbd>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Verdict:</span>
          </div>
          {['ALL', 'MALICIOUS', 'SUSPICIOUS', 'CLEAN'].map((v) => (
            <button
              key={v}
              onClick={() => setVerdictFilter(v)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                verdictFilter === v
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
              }`}
            >
              {v}
            </button>
          ))}

          <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-4">
            <span>Auth:</span>
          </div>
          {['ALL', 'PASS', 'FAIL'].map((a) => (
            <button
              key={a}
              onClick={() => setAuthFilter(a)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                authFilter === a
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
              }`}
            >
              {a === 'ALL' ? 'All Records' : a === 'PASS' ? 'Passed Auth' : 'Failed Auth'}
            </button>
          ))}

          {onToggleDemoCases && (
            <button
              onClick={onToggleDemoCases}
              className={`ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-mono transition-colors ${
                showDemoCases
                  ? 'bg-amber-950/70 border-amber-600/80 text-amber-300'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-400'
              }`}
            >
              <FlaskConical className={`w-3 h-3 ${showDemoCases ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>Demo Fixtures: <strong>{showDemoCases ? 'ON' : 'OFF'}</strong></span>
            </button>
          )}
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {filteredResults.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-500">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No forensic records matched your query</p>
            <p className="text-xs text-slate-600 mt-1">Try broadening your search term or clearing active filters.</p>
          </div>
        ) : (
          filteredResults.map((analysis) => {
            const stdVerdict = getStandardizedVerdict(analysis);

            return (
              <div
                key={analysis.id}
                onClick={() => handleSelect(analysis)}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-850 cursor-pointer transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${stdVerdict.colors.badge}`}>
                      {stdVerdict.verdict}
                    </span>

                    <span className="text-xs font-mono text-slate-400">
                      {analysis.id}
                    </span>

                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {analysis.date}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors truncate">
                    {analysis.subject}
                  </h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono">
                    <span className="truncate">From: {analysis.from}</span>
                    <span>•</span>
                    <span>Score: {stdVerdict.score}/100</span>
                    <span>•</span>
                    <span>{analysis.hops?.length || 0} Hops</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="hidden lg:flex items-center gap-2">
                    {analysis.urls?.slice(0, 2).map((u, i) => (
                      <span key={i} className="text-[11px] px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400 font-mono truncate max-w-[150px]">
                        {u.domain}
                      </span>
                    ))}
                  </div>

                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 group-hover:bg-cyan-600 text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                    <span>Inspect</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
