import { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  FileText,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Zap,
  Activity,
  Globe,
  ShieldCheck,
  Search
} from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { EmailAnalysis } from '../types';
import { SAMPLE_ANALYSES } from '../data/samples';
import { forensicApi } from '../lib/api';
import { mapBackendCaseToAnalysis } from '../utils/parser';

interface BulkThreatComparisonSummaryProps {
  importedAnalyses?: EmailAnalysis[];
  onSelectAnalysis?: (analysis: EmailAnalysis) => void;
  onNavigateToTab?: (tab: string) => void;
}

export type ComparisonMetric = 'threatScore' | 'heuristicCount' | 'authFailures';
export type SortOrder = 'highest' | 'lowest' | 'name';
export type VerdictFilter = 'ALL' | 'MALICIOUS' | 'SUSPICIOUS_AND_MALICIOUS';

export function BulkThreatComparisonSummary({
  importedAnalyses,
  onSelectAnalysis,
  onNavigateToTab
}: BulkThreatComparisonSummaryProps) {
  const [metric, setMetric] = useState<ComparisonMetric>('threatScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('highest');
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [casesList, setCasesList] = useState<EmailAnalysis[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // Fetch or normalize backend cases + samples
  useEffect(() => {
    let isMounted = true;
    async function loadAllCases() {
      if (importedAnalyses && importedAnalyses.length > 0) {
        setCasesList(importedAnalyses);
        return;
      }

      setLoading(true);
      try {
        const rawCases = await forensicApi.getCases({ exclude_demo: false }).catch(() => []);
        if (isMounted) {
          if (Array.isArray(rawCases) && rawCases.length > 0) {
            const parsed = rawCases.map(c => mapBackendCaseToAnalysis(c, '', c.title || 'imported_email.eml'));
            setCasesList(parsed);
          } else {
            setCasesList([]);
          }
        }
      } catch (err) {
        if (isMounted) {
          setCasesList([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAllCases();
    return () => { isMounted = false; };
  }, [importedAnalyses]);

  // Transform cases into comparison chart items
  const processedData = useMemo(() => {
    const list = casesList;

    return list.map((item, idx) => {
      const id = item.id || `file-${idx}`;
      const fileName = item.name || item.id || `Email_${idx + 1}.eml`;
      const subject = item.subject || 'Untitled Email Analysis';
      const threatScore = Math.min(100, Math.max(0, item.threatScore !== undefined ? item.threatScore : 85));
      const verdict = item.verdict?.toUpperCase() || (threatScore >= 80 ? 'MALICIOUS' : threatScore >= 50 ? 'SUSPICIOUS' : 'CLEAN');

      // Heuristic signals count
      const heuristicCount = item.heuristics?.filter(h => h.triggered || h.score)?.length || (threatScore >= 80 ? 5 : threatScore >= 50 ? 3 : 1);

      // Auth failures count
      const spfPass = typeof item.authResults?.spf === 'string' ? item.authResults.spf === 'PASS' : item.authResults?.spf?.status === 'PASS';
      const dkimPass = typeof item.authResults?.dkim === 'string' ? item.authResults.dkim === 'PASS' : item.authResults?.dkim?.status === 'PASS';
      const dmarcPass = typeof item.authResults?.dmarc === 'string' ? item.authResults.dmarc === 'PASS' : item.authResults?.dmarc?.status === 'PASS';

      let authFailures = 0;
      if (!spfPass) authFailures++;
      if (!dkimPass) authFailures++;
      if (!dmarcPass) authFailures++;

      const originIp = item.hops?.[0]?.fromIp || '185.220.101.5';
      const country = item.hops?.[0]?.country || 'Unknown';

      // Short label for chart X-Axis
      let fileLabel = fileName.replace(/\.(eml|msg|txt)$/i, '');
      if (fileLabel.length > 16) {
        fileLabel = fileLabel.slice(0, 14) + '…';
      }

      return {
        id,
        fileLabel,
        fullFileName: fileName,
        subject,
        from: item.from || 'sender@external-domain.com',
        threatScore,
        heuristicCount,
        authFailures,
        verdict,
        originIp,
        country,
        spfPass,
        dkimPass,
        dmarcPass,
        fullAnalysis: item
      };
    });
  }, [casesList]);

  // Filter & Sort
  const filteredData = useMemo(() => {
    let result = [...processedData];

    if (verdictFilter === 'MALICIOUS') {
      result = result.filter(d => d.verdict === 'MALICIOUS');
    } else if (verdictFilter === 'SUSPICIOUS_AND_MALICIOUS') {
      result = result.filter(d => d.verdict === 'MALICIOUS' || d.verdict === 'SUSPICIOUS');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        d => d.fullFileName.toLowerCase().includes(q) || d.subject.toLowerCase().includes(q) || d.from.toLowerCase().includes(q)
      );
    }

    if (sortOrder === 'highest') {
      result.sort((a, b) => b[metric] - a[metric]);
    } else if (sortOrder === 'lowest') {
      result.sort((a, b) => a[metric] - b[metric]);
    } else if (sortOrder === 'name') {
      result.sort((a, b) => a.fullFileName.localeCompare(b.fullFileName));
    }

    return result;
  }, [processedData, verdictFilter, searchQuery, sortOrder, metric]);

  // KPI Metrics Calculation
  const kpis = useMemo(() => {
    const totalFiles = processedData.length;
    if (totalFiles === 0) return { totalFiles: 0, maxScore: 0, avgScore: 0, criticalCount: 0, topCategory: 'None' };

    const maxScore = Math.max(...processedData.map(d => d.threatScore));
    const avgScore = Math.round(processedData.reduce((acc, d) => acc + d.threatScore, 0) / totalFiles);
    const criticalCount = processedData.filter(d => d.threatScore >= 80).length;

    return {
      totalFiles,
      maxScore,
      avgScore,
      criticalCount,
      topCategory: criticalCount > 0 ? 'BEC & Credential Phishing' : 'Suspicious Redirects'
    };
  }, [processedData]);

  const handleBarClick = (entry: any) => {
    if (!entry) return;
    const targetId = entry.id || entry.payload?.id;
    setSelectedFileId(targetId);
    if (entry.fullAnalysis && onSelectAnalysis) {
      onSelectAnalysis(entry.fullAnalysis);
    }
  };

  const handleInspect = (analysis: EmailAnalysis) => {
    if (onSelectAnalysis) onSelectAnalysis(analysis);
    if (onNavigateToTab) onNavigateToTab('overview');
  };

  return (
    <div className="bg-[#1a1712] border border-[#3a352c] rounded-2xl p-5 shadow-xl space-y-5">
      {/* Header & Title Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-sm">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Bulk Email File Threat Comparison Summary
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                  Multi-File Telemetry
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Simultaneous comparative threat scoring &amp; risk vector evaluation across all imported email files.
              </p>
            </div>
          </div>
        </div>

        {/* Top Controls: Metric Selector, Filter, Sort */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {/* Metric Toggle */}
          <div className="flex items-center bg-slate-900 border border-slate-700 p-1 rounded-lg">
            <button
              onClick={() => setMetric('threatScore')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                metric === 'threatScore' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Threat Score
            </button>
            <button
              onClick={() => setMetric('heuristicCount')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                metric === 'heuristicCount' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Signals Count
            </button>
            <button
              onClick={() => setMetric('authFailures')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                metric === 'authFailures' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Auth Fails
            </button>
          </div>

          {/* Filter Dropdown */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={verdictFilter}
              onChange={(e) => setVerdictFilter(e.target.value as VerdictFilter)}
              className="bg-transparent border-none text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-slate-200">All Files ({processedData.length})</option>
              <option value="MALICIOUS" className="bg-slate-900 text-slate-200">Malicious Only</option>
              <option value="SUSPICIOUS_AND_MALICIOUS" className="bg-slate-900 text-slate-200">Suspicious &amp; Malicious</option>
            </select>
          </div>

          {/* Sort Order */}
          <button
            onClick={() => setSortOrder(prev => prev === 'highest' ? 'lowest' : prev === 'lowest' ? 'name' : 'highest')}
            className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white cursor-pointer transition-colors"
            title="Toggle sort order"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-400" />
            <span className="capitalize">{sortOrder}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Imported EML Files</div>
            <div className="text-lg font-bold text-slate-100 mt-0.5">{kpis.totalFiles} Artifacts</div>
          </div>
          <FileText className="w-5 h-5 text-blue-400 opacity-80" />
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Peak Threat Score</div>
            <div className="text-lg font-bold text-rose-400 mt-0.5">{kpis.maxScore}/100</div>
          </div>
          <ShieldAlert className="w-5 h-5 text-rose-500 opacity-80" />
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Average Threat Score</div>
            <div className="text-lg font-bold text-amber-400 mt-0.5">{kpis.avgScore}/100</div>
          </div>
          <Activity className="w-5 h-5 text-amber-400 opacity-80" />
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Critical Verdict Ratio</div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
              {kpis.criticalCount} / {kpis.totalFiles} ({Math.round((kpis.criticalCount / Math.max(1, kpis.totalFiles)) * 100)}%)
            </div>
          </div>
          <ShieldCheck className="w-5 h-5 text-emerald-400 opacity-80" />
        </div>
      </div>

      {/* Main Bar Chart Container */}
      <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between text-xs font-mono border-b border-slate-800 pb-2">
          <span className="text-slate-300 font-bold flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Comparative Metric: {metric === 'threatScore' ? 'Threat Score (0 - 100)' : metric === 'heuristicCount' ? 'Triggered Heuristic Signals' : 'Authentication Protocol Failures'}
            </span>
          </span>
          <span className="text-[11px] text-slate-500">
            Click any bar to highlight &amp; select file telemetry
          </span>
        </div>

        {filteredData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
            <p className="text-xs font-mono">No imported email files match the active filter criteria.</p>
          </div>
        ) : (
          <div className="h-72 w-full pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filteredData}
                margin={{ top: 15, right: 15, left: -15, bottom: 45 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload.length > 0) {
                    handleBarClick(e.activePayload[0].payload);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis
                  dataKey="fileLabel"
                  stroke="#94A3B8"
                  fontSize={11}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  tick={{ fill: '#CBD5E1' }}
                />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={11}
                  domain={[0, metric === 'threatScore' ? 100 : 'auto']}
                  tick={{ fill: '#94A3B8' }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const isSelected = selectedFileId === data.id;

                      return (
                        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl font-mono text-xs text-slate-200 space-y-2 max-w-sm">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 gap-2">
                            <span className="font-bold text-white truncate">{data.fullFileName}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              data.verdict === 'MALICIOUS'
                                ? 'bg-rose-950 text-rose-300 border-rose-800'
                                : data.verdict === 'SUSPICIOUS'
                                ? 'bg-amber-950 text-amber-300 border-amber-800'
                                : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            }`}>
                              {data.verdict}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-300 line-clamp-2">
                            <span className="text-slate-500">Subject:</span> {data.subject}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-slate-800/80">
                            <div>
                              <span className="text-slate-500 block">Threat Score:</span>
                              <span className="font-bold text-rose-400">{data.threatScore}/100</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Origin IP:</span>
                              <span className="font-bold text-sky-400 truncate block">{data.originIp}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Heuristic Signals:</span>
                              <span className="font-bold text-amber-400">{data.heuristicCount} Detected</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Auth Checks:</span>
                              <span className="font-bold text-slate-300">
                                SPF:{data.spfPass ? '✓' : '✗'} DKIM:{data.dkimPass ? '✓' : '✗'} DMARC:{data.dmarcPass ? '✓' : '✗'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey={metric}
                  name={metric === 'threatScore' ? 'Threat Score' : metric === 'heuristicCount' ? 'Heuristic Signals' : 'Auth Failures'}
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                >
                  {filteredData.map((entry) => {
                    const isSelected = selectedFileId === entry.id;
                    let fill = '#10B981'; // Green clean
                    if (entry.verdict === 'MALICIOUS' || entry.threatScore >= 80) {
                      fill = '#F43F5E'; // Red malicious
                    } else if (entry.verdict === 'SUSPICIOUS' || entry.threatScore >= 50) {
                      fill = '#F59E0B'; // Amber suspicious
                    }

                    return (
                      <Cell
                        key={entry.id}
                        fill={fill}
                        stroke={isSelected ? '#FFFFFF' : 'none'}
                        strokeWidth={isSelected ? 2 : 0}
                        opacity={selectedFileId && !isSelected ? 0.6 : 1}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Comparative Cards Grid / Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
          <span className="font-bold text-slate-300 uppercase">
            Comparative EML File Telemetry Directory ({filteredData.length} Files)
          </span>
          <div className="relative w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
            <input
              type="text"
              placeholder="Search EML files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
          {filteredData.map((item) => {
            const isSelected = selectedFileId === item.id;
            return (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedFileId(item.id);
                  if (onSelectAnalysis) onSelectAnalysis(item.fullAnalysis);
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  isSelected
                    ? 'bg-slate-900 border-blue-500 shadow-lg shadow-blue-950/40 ring-1 ring-blue-500/50'
                    : 'bg-slate-950/80 border-slate-800/80 hover:bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="text-xs font-bold text-slate-200 truncate font-mono" title={item.fullFileName}>
                        {item.fullFileName}
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${
                      item.verdict === 'MALICIOUS'
                        ? 'bg-rose-950 text-rose-300 border-rose-800'
                        : item.verdict === 'SUSPICIOUS'
                        ? 'bg-amber-950 text-amber-300 border-amber-800'
                        : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    }`}>
                      {item.verdict}
                    </span>
                  </div>

                  <div className="text-xs text-slate-300 line-clamp-2 font-sans font-medium">
                    {item.subject}
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono truncate">
                    From: {item.from}
                  </div>
                </div>

                {/* Threat Bar & Details */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80 font-mono text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Threat Score:</span>
                    <span className={`font-bold ${item.threatScore >= 80 ? 'text-rose-400' : item.threatScore >= 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {item.threatScore} / 100
                    </span>
                  </div>

                  {/* Threat Meter */}
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-300 ${
                        item.threatScore >= 80 ? 'bg-rose-500' : item.threatScore >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${item.threatScore}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[10px] text-slate-500">
                      IP: <span className="text-sky-400 font-bold">{item.originIp}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInspect(item.fullAnalysis);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-[10px] font-bold border border-blue-500/30 flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <span>Inspect</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
