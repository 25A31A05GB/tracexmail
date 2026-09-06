import { useEffect, useState, useMemo } from 'react';
import {
  ShieldAlert,
  Activity,
  Layers,
  AlertTriangle,
  Server,
  Zap,
  RefreshCw,
  TrendingUp,
  Globe,
  Database,
  ShieldCheck,
  BarChart3,
  AreaChart as AreaIcon,
  PieChart as PieIcon,
  MapPin,
  Radio,
  Filter,
  Compass,
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  XCircle,
  ShieldX,
  Share2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Minimize2,
  Maximize2,
  Network
} from 'lucide-react';
import {
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line
} from 'recharts';
import { forensicApi, DashboardStats, HealthResponse } from '../lib/api';
import { EmailAnalysis } from '../types';
import { useWebSocketAlerts } from '../hooks/useWebSocketAlerts';
import { SAMPLE_ANALYSES } from '../data/samples';
import { getStandardizedVerdict } from '../utils/verdict';
import { NetworkIntelligenceCard } from './NetworkIntelligenceCard';
import { BulkThreatComparisonSummary } from './BulkThreatComparisonSummary';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface DashboardViewProps {
  onSelectAnalysis?: (analysis: EmailAnalysis) => void;
  onNavigateToTab?: (tab: any) => void;
  onOpenWalkthrough?: () => void;
  viewMode?: 'simple' | 'analyst';
}

export interface RegionThreat {
  id: string;
  region: string;
  country: string;
  code: string;
  x: number;
  y: number;
  z: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'BEC' | 'HARVESTING' | 'MALWARE' | 'EXPLOIT';
  topAsn: string;
  topMalware: string;
  ipRange: string;
  riskScore: number;
  recentSpike: boolean;
}

const REGIONAL_THREATS_DATA: RegionThreat[] = [
  {
    id: 'geo-1',
    region: 'Eastern Europe / CIS',
    country: 'Bulgaria (AS200548)',
    code: 'BG',
    x: 38,
    y: 55,
    z: 284,
    severity: 'CRITICAL',
    category: 'BEC',
    topAsn: 'AS200548 (Zettahost Ltd)',
    topMalware: 'Commodity BEC / Phishing Kit',
    ipRange: '185.220.101.0/24',
    riskScore: 94,
    recentSpike: true
  },
  {
    id: 'geo-2',
    region: 'East Asia',
    country: 'China (AS4134)',
    code: 'CN',
    x: 114,
    y: 34,
    z: 242,
    severity: 'CRITICAL',
    category: 'HARVESTING',
    topAsn: 'AS4134 (Chinanet)',
    topMalware: 'Commodity Credential PhishKit v4.2',
    ipRange: '218.92.0.0/16',
    riskScore: 91,
    recentSpike: true
  },
  {
    id: 'geo-3',
    region: 'North America East',
    country: 'United States (AS14061)',
    code: 'US-EST',
    x: -75,
    y: 40,
    z: 165,
    severity: 'HIGH',
    category: 'BEC',
    topAsn: 'AS14061 (DigitalOcean)',
    topMalware: 'Executive Wire Spoof Relay',
    ipRange: '159.65.0.0/16',
    riskScore: 78,
    recentSpike: false
  },
  {
    id: 'geo-4',
    region: 'Western Europe',
    country: 'Netherlands / UK (AS24940)',
    code: 'NL/UK',
    x: 10,
    y: 52,
    z: 138,
    severity: 'HIGH',
    category: 'MALWARE',
    topAsn: 'AS24940 (Hetzner / Serverius)',
    topMalware: 'Emotet / Cobalt Strike C2',
    ipRange: '178.62.0.0/16',
    riskScore: 82,
    recentSpike: false
  },
  {
    id: 'geo-5',
    region: 'Middle East / Gulf',
    country: 'United Arab Emirates',
    code: 'AE',
    x: 55,
    y: 25,
    z: 96,
    severity: 'HIGH',
    category: 'BEC',
    topAsn: 'AS5384 (Emirates Telecom)',
    topMalware: 'Invoice Redirection Lure',
    ipRange: '86.96.0.0/16',
    riskScore: 74,
    recentSpike: false
  },
  {
    id: 'geo-6',
    region: 'West Africa',
    country: 'Nigeria (AS37148)',
    code: 'NG',
    x: 8,
    y: 9,
    z: 185,
    severity: 'CRITICAL',
    category: 'BEC',
    topAsn: 'AS37148 (Globacom)',
    topMalware: '419 Wire Lure / AgentTesla',
    ipRange: '197.210.0.0/16',
    riskScore: 89,
    recentSpike: true
  },
  {
    id: 'geo-7',
    region: 'South America East',
    country: 'Brazil (AS28573)',
    code: 'BR',
    x: -47,
    y: -15,
    z: 112,
    severity: 'HIGH',
    category: 'HARVESTING',
    topAsn: 'AS28573 (CLARO SA)',
    topMalware: 'Grandoreiro Banking Trojan',
    ipRange: '177.12.0.0/16',
    riskScore: 76,
    recentSpike: false
  },
  {
    id: 'geo-8',
    region: 'South Asia',
    country: 'India (AS55836)',
    code: 'IN',
    x: 78,
    y: 20,
    z: 124,
    severity: 'HIGH',
    category: 'HARVESTING',
    topAsn: 'AS55836 (Reliance Jio)',
    topMalware: 'M365 OAuth Consent Phish',
    ipRange: '49.207.0.0/16',
    riskScore: 72,
    recentSpike: false
  },
  {
    id: 'geo-9',
    region: 'Southeast Asia',
    country: 'Vietnam / Singapore',
    code: 'VN/SG',
    x: 104,
    y: 12,
    z: 88,
    severity: 'MEDIUM',
    category: 'MALWARE',
    topAsn: 'AS45899 (VNPT)',
    topMalware: 'Ducktail Stealer Payload',
    ipRange: '113.160.0.0/16',
    riskScore: 68,
    recentSpike: false
  },
  {
    id: 'geo-10',
    region: 'North America West',
    country: 'United States (AS16509)',
    code: 'US-WST',
    x: -122,
    y: 37,
    z: 74,
    severity: 'MEDIUM',
    category: 'EXPLOIT',
    topAsn: 'AS16509 (Amazon AWS)',
    topMalware: 'ProxyShell Relay Probe',
    ipRange: '54.212.0.0/16',
    riskScore: 62,
    recentSpike: false
  },
  {
    id: 'geo-11',
    region: 'Oceania / Pacific',
    country: 'Australia (AS4804)',
    code: 'AU',
    x: 135,
    y: -25,
    z: 32,
    severity: 'LOW',
    category: 'BEC',
    topAsn: 'AS4804 (Telstra)',
    topMalware: 'Payroll Impersonation Lure',
    ipRange: '139.130.0.0/16',
    riskScore: 42,
    recentSpike: false
  }
];

const getHeatColor = (z: number, severity: string) => {
  if (severity === 'CRITICAL' || z >= 180) {
    return { fill: '#F43F5E', stroke: '#FB7185', glow: 'rgba(244, 63, 94, 0.6)' };
  }
  if (severity === 'HIGH' || z >= 100) {
    return { fill: '#F59E0B', stroke: '#FBBF24', glow: 'rgba(245, 158, 11, 0.5)' };
  }
  if (severity === 'MEDIUM' || z >= 50) {
    return { fill: '#FACC15', stroke: '#FDE047', glow: 'rgba(250, 204, 21, 0.4)' };
  }
  return { fill: '#38BDF8', stroke: '#7DD3FC', glow: 'rgba(56, 189, 248, 0.4)' };
};

export function DashboardView({ onSelectAnalysis, onNavigateToTab, onOpenWalkthrough, viewMode = 'simple' }: DashboardViewProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [chartType, setChartType] = useState<'AREA' | 'BAR' | 'PIE'>('AREA');
  const [selectedGeoCategory, setSelectedGeoCategory] = useState<'ALL' | 'BEC' | 'HARVESTING' | 'MALWARE' | 'EXPLOIT'>('ALL');
  const [selectedRegion, setSelectedRegion] = useState<RegionThreat | null>(REGIONAL_THREATS_DATA[0]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>(SAMPLE_ANALYSES[0]?.id || 'sample-paypal-phish');
  const [isForensicConsoleExpanded, setIsForensicConsoleExpanded] = useState<boolean>(viewMode === 'analyst');

  useEffect(() => {
    setIsForensicConsoleExpanded(viewMode === 'analyst');
  }, [viewMode]);
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tracexmail_dashboard_minimized') === 'true';
    } catch {
      return false;
    }
  });

  const toggleMinimize = () => {
    setIsMinimized(prev => {
      const next = !prev;
      try {
        localStorage.setItem('tracexmail_dashboard_minimized', String(next));
      } catch {}
      return next;
    });
  };

  const activeFocusAnalysis = useMemo(() => {
    return SAMPLE_ANALYSES.find(a => a.id === selectedAnalysisId) || SAMPLE_ANALYSES[0];
  }, [selectedAnalysisId]);

  // Real-Time WebSocket Alerts Hook
  const { alerts } = useWebSocketAlerts();

  const filteredGeoData = useMemo(() => {
    if (selectedGeoCategory === 'ALL') return REGIONAL_THREATS_DATA;
    return REGIONAL_THREATS_DATA.filter(item => item.category === selectedGeoCategory);
  }, [selectedGeoCategory]);

  const geoStats = useMemo(() => {
    const totalIncidents = filteredGeoData.reduce((acc, curr) => acc + curr.z, 0);
    const criticalCount = filteredGeoData.filter(d => d.severity === 'CRITICAL').length;
    const spikingCount = filteredGeoData.filter(d => d.recentSpike).length;
    return { totalIncidents, criticalCount, spikingCount };
  }, [filteredGeoData]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsData, healthData] = await Promise.all([
        forensicApi.getDashboardStats().catch(() => null),
        forensicApi.getHealth().catch(() => null)
      ]);
      if (statsData) setStats(statsData);
      if (healthData) setHealth(healthData);

      if (isSupabaseConfigured) {
        try {
          const { count, error } = await supabase
            .from('cases')
            .select('*', { count: 'exact', head: true });
          if (!error && typeof count === 'number' && statsData) {
            setStats(prev => prev ? { ...prev, totalCases: Math.max(prev.totalCases || 0, count) } : statsData);
          }
        } catch (e) {
          console.debug('[DashboardView] Supabase cases count query fallback:', e);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger refetch on mount and whenever a new WebSocket alert message arrives
  useEffect(() => {
    fetchDashboardData();
  }, [alerts]);

  // Periodic safety net polling interval (30s)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Generate past 30 days email verdict data
  const verdict30DayData = useMemo(() => {
    const data = [];
    const today = new Date('2026-08-30T00:00:00Z');

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayName = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

      const baseVal = isWeekend ? 12 : 36;
      const isSpike = i === 5 || i === 18 || i === 24;

      const clean = Math.floor(baseVal + Math.sin(i) * 6 + 10);
      const suspicious = Math.floor(baseVal * 0.32 + (isSpike ? 24 : Math.cos(i) * 4 + 5));
      const malicious = Math.floor(baseVal * 0.14 + (isSpike ? 16 : Math.sin(i * 1.5) * 3 + 3));

      const cleanVal = Math.max(6, clean);
      const suspiciousVal = Math.max(2, suspicious);
      const maliciousVal = Math.max(1, malicious);
      const threatsVal = suspiciousVal + maliciousVal;

      data.push({
        date: dayName,
        Clean: cleanVal,
        Suspicious: suspiciousVal,
        Malicious: maliciousVal,
        Threats: threatsVal,
        Total: cleanVal + suspiciousVal + maliciousVal
      });
    }

    return data;
  }, []);

  // Compute 30-day totals & percentages
  const totals30Day = useMemo(() => {
    const cleanTotal = verdict30DayData.reduce((acc, curr) => acc + curr.Clean, 0);
    const suspiciousTotal = verdict30DayData.reduce((acc, curr) => acc + curr.Suspicious, 0);
    const maliciousTotal = verdict30DayData.reduce((acc, curr) => acc + curr.Malicious, 0);
    const grandTotal = cleanTotal + suspiciousTotal + maliciousTotal;

    return {
      clean: cleanTotal,
      cleanPct: Math.round((cleanTotal / grandTotal) * 100),
      suspicious: suspiciousTotal,
      suspiciousPct: Math.round((suspiciousTotal / grandTotal) * 100),
      malicious: maliciousTotal,
      maliciousPct: Math.round((maliciousTotal / grandTotal) * 100),
      total: grandTotal
    };
  }, [verdict30DayData]);

  const pieChartData = useMemo(() => {
    return [
      { name: 'Clean', value: totals30Day.clean, color: '#10B981' },
      { name: 'Suspicious', value: totals30Day.suspicious, color: '#F59E0B' },
      { name: 'Malicious', value: totals30Day.malicious, color: '#F43F5E' }
    ];
  }, [totals30Day]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Activity className="w-6 h-6 text-blue-400" />
              Security Operations Dashboard
            </h1>
            {isMinimized && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Minimized HUD
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Real-time multi-tenant threat intelligence, BEC anomaly scoring, and forensic telemetry.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleMinimize}
            id="btn-toggle-minimize-dashboard"
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-2 cursor-pointer transition-colors shadow-sm ${
              isMinimized
                ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title={isMinimized ? "Expand full dashboard with deep graphs & telemetry" : "Minimize dashboard into compact overview hub"}
          >
            {isMinimized ? (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Expand Dashboard</span>
              </>
            ) : (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Minimize Dashboard</span>
              </>
            )}
          </button>
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* When Minimized: Compact Executive Summary & Direct Action Hub */}
      {isMinimized ? (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Health & Status Bar */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></div>
              <div>
                <div className="text-xs font-bold text-slate-200">
                  {health?.default_tenant?.organization_name || 'Enterprise Cyber Defense SOC'}
                </div>
                <div className="text-[11px] text-slate-400 font-sans">
                  Status: <span className="text-emerald-400 font-semibold">SOC Incident Response Active</span> | Protection: <span className="text-blue-400 font-semibold">Multi-Tenant Isolation Protected</span>
                </div>
              </div>
            </div>
            {false && (
              <div className="flex items-center gap-2 font-sans text-xs">
                <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300">
                  SOC Engine Active
                </span>
                <span className="px-2 py-1 bg-blue-900/40 border border-blue-700/50 rounded text-blue-300">
                  Telemetry Stream Healthy
                </span>
              </div>
            )}
          </div>

          {/* Compact KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div 
              onClick={() => onNavigateToTab?.('cases')}
              className="bg-slate-900/90 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3.5 cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Active Cases</span>
                <ShieldAlert className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-xl font-bold text-white font-mono">
                {stats?.summary?.total_cases || 6}
              </div>
              <div className="text-[10px] text-rose-400/90 font-mono mt-0.5 flex items-center justify-between">
                <span>2 Critical BEC</span>
                <span className="text-blue-400 group-hover:translate-x-0.5 transition-transform">View →</span>
              </div>
            </div>

            <div 
              onClick={() => onNavigateToTab?.('campaigns')}
              className="bg-slate-900/90 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3.5 cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Campaigns</span>
                <Layers className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-xl font-bold text-white font-mono">
                {stats?.summary?.active_campaigns || 3}
              </div>
              <div className="text-[10px] text-purple-400/90 font-mono mt-0.5 flex items-center justify-between">
                <span>Threat Clusters</span>
                <span className="text-blue-400 group-hover:translate-x-0.5 transition-transform">View →</span>
              </div>
            </div>

            <div 
              onClick={() => onNavigateToTab?.('ingest')}
              className="bg-slate-900/90 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3.5 cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Ingested RFC 822</span>
                <Database className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-xl font-bold text-white font-mono">
                {stats?.summary?.total_emails_ingested || 14}
              </div>
              <div className="text-[10px] text-blue-400 font-mono mt-0.5 flex items-center justify-between">
                <span>Ingest Pipeline</span>
                <span className="text-blue-400 group-hover:translate-x-0.5 transition-transform">Run →</span>
              </div>
            </div>

            <div 
              onClick={() => onNavigateToTab?.('overview')}
              className="bg-slate-900/90 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3.5 cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Avg Threat Score</span>
                <ShieldCheck className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-xl font-bold text-white font-mono">
                76.4<span className="text-xs text-slate-500 font-normal"> / 100</span>
              </div>
              <div className="text-[10px] text-amber-400/90 font-mono mt-0.5 flex items-center justify-between">
                <span>High Malicious Ratio</span>
                <span className="text-blue-400 group-hover:translate-x-0.5 transition-transform">Overview →</span>
              </div>
            </div>
          </div>

          {/* Quick Direct Navigation Hub */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <div className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Quick Forensic Actions</span>
              <span className="text-[10px] text-slate-400 font-mono">Click any module to jump</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <button
                onClick={() => onNavigateToTab?.('ingest')}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/80 text-left transition-all group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-md bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center mb-2">
                  <Database className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-xs font-bold text-slate-200">Email Ingestion</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Parse RFC822 EML</div>
              </button>

              <button
                onClick={() => onNavigateToTab?.('overview')}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900/80 text-left transition-all group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-md bg-blue-950/60 border border-blue-800/60 flex items-center justify-center mb-2">
                  <Activity className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-xs font-bold text-slate-200">Message Overview</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Forensic evidence card</div>
              </button>

              <button
                onClick={() => onNavigateToTab?.('cases')}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/80 text-left transition-all group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-md bg-indigo-950/60 border border-indigo-800/60 flex items-center justify-center mb-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-xs font-bold text-slate-200">Incident Cases</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Quarantine &amp; audit</div>
              </button>

              <button
                onClick={() => onNavigateToTab?.('alerts')}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-500/50 hover:bg-slate-900/80 text-left transition-all group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-md bg-rose-950/60 border border-rose-800/60 flex items-center justify-center mb-2">
                  <Radio className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-xs font-bold text-slate-200">Live Alerts</div>
                <div className="text-[10px] text-slate-400 mt-0.5">WebSocket feeds</div>
              </button>

              <button
                onClick={() => onNavigateToTab?.('map')}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/80 text-left transition-all group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-md bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center mb-2">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-xs font-bold text-slate-200">Geographic Map</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Hop GeoIP &amp; ASN</div>
              </button>

              <button
                onClick={() => onNavigateToTab?.('graph')}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-900/80 text-left transition-all group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-md bg-purple-950/60 border border-purple-800/60 flex items-center justify-center mb-2">
                  <Share2 className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-xs font-bold text-slate-200">Relationship Graph</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Entity &amp; IOC nexus</div>
              </button>
            </div>
          </div>

          {/* Minimized Recent Incidents Queue - Prioritizing Case ID & Threat Score */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Active Forensic Incidents (Case ID &amp; Threat Score Overview)
                </span>
              </div>
              <button
                onClick={() => onNavigateToTab?.('cases')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer transition-colors"
              >
                View All Cases →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {SAMPLE_ANALYSES.slice(0, 4).map((sample) => {
                const verdictInfo = getStandardizedVerdict(sample);
                return (
                  <div
                    key={sample.id}
                    onClick={() => {
                      onSelectAnalysis?.(sample);
                      onNavigateToTab?.('overview');
                    }}
                    className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-blue-500/70 cursor-pointer transition-all flex flex-col justify-between gap-3 group shadow-md hover:shadow-blue-500/10"
                  >
                    {/* Header: Case ID & Threat Score Priority */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-cyan-300 font-mono text-[11px] font-bold shadow-inner">
                        <ShieldAlert className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>{sample.id}</span>
                      </div>
                      <div className={`px-2 py-0.5 rounded-md border font-mono text-[11px] font-black flex items-center gap-1 shadow-sm ${verdictInfo.colors.badge}`}>
                        <Zap className="w-3 h-3 shrink-0" />
                        <span>{verdictInfo.score}/100</span>
                      </div>
                    </div>

                    {/* Middle: Subject & Sender */}
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-slate-100 line-clamp-2 group-hover:text-blue-300 transition-colors leading-tight">
                        {sample.subject || sample.headers?.subject || 'Untitled Email Analysis'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {sample.from || sample.headers?.from || 'Unknown Sender'}
                      </div>
                    </div>

                    {/* Footer: Verdict Tag & Inspect CTA */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] font-mono">
                      <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${verdictInfo.colors.badge}`}>
                        {verdictInfo.verdict}
                      </span>
                      <div className="flex items-center gap-1 text-blue-400 font-semibold group-hover:translate-x-1 transition-transform">
                        <span>Inspect</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bulk Email File Threat Comparison Bar Chart Section */}
          <BulkThreatComparisonSummary
            onSelectAnalysis={onSelectAnalysis}
            onNavigateToTab={onNavigateToTab}
          />

          {/* Expand Full Dashboard Callout Banner */}
          <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-800/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-xs text-slate-300">
                <span className="font-semibold text-white">Full Analytics Mode Available:</span> View 30-day interactive area charts, global threat scatter plots, and telemetry matrices.
              </div>
            </div>
            <button
              onClick={toggleMinimize}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-md cursor-pointer transition-colors flex items-center gap-2 shrink-0"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Expand Full Dashboard</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Health & Status Bar */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></div>
              <div>
                <div className="text-xs font-bold text-slate-200">
                  {health?.default_tenant?.organization_name || 'Enterprise Cyber Defense SOC'}
                </div>
                <div className="text-[11px] text-slate-400 font-sans">
                  Status: <span className="text-emerald-400 font-semibold">SOC Incident Response Active</span> | Protection: <span className="text-blue-400 font-semibold">Multi-Tenant Isolation Protected</span>
                </div>
              </div>
            </div>
            {false && (
              <div className="flex items-center gap-2 font-sans text-xs">
                <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300">
                  SOC Engine Active
                </span>
                <span className="px-2 py-1 bg-blue-900/40 border border-blue-700/50 rounded text-blue-300">
                  Telemetry Stream Healthy
                </span>
              </div>
            )}
          </div>

          {/* Interactive Get Started Forensic Walkthrough Launcher Banner */}
          {onOpenWalkthrough && (
            <div className="bg-[#181410] border border-[#3a352c] rounded-md p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-[2px] bg-[rgba(201,162,39,0.15)] border border-[rgba(201,162,39,0.35)] flex items-center justify-center shrink-0">
                  <Compass className="w-5 h-5 text-[var(--stamp)] animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-sm text-[#ede6d8]">
                      New to TraceXMail Enclave?
                    </span>
                    <span className="font-mono text-[9.5px] px-1.5 py-0.2 rounded bg-[rgba(201,162,39,0.18)] text-[var(--stamp)] border border-[rgba(201,162,39,0.35)] font-bold uppercase">
                      GUIDED WALKTHROUGH
                    </span>
                  </div>
                  <p className="text-xs text-[#b9af9c] mt-0.5">
                    Explore the 4 core pillars: SOC Dashboard, Ingestion Decomposition, BGP Hop Traceroute, and Court-Admissible Dossiers.
                  </p>
                </div>
              </div>

              <button
                onClick={onOpenWalkthrough}
                className="px-4 py-2 rounded-[2px] bg-[rgba(201,162,39,0.2)] hover:bg-[rgba(201,162,39,0.3)] border border-[var(--stamp)] text-[var(--stamp)] hover:text-[#ede6d8] text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 shadow-[0_0_12px_rgba(201,162,39,0.2)]"
              >
                <span>LAUNCH WALKTHROUGH</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Cases</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {stats?.summary?.total_cases || 6}
          </div>
          <div className="text-[11px] text-rose-400/90 font-mono mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 inline" /> 2 Critical Wire BEC Lures
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Threat Campaigns</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {stats?.summary?.active_campaigns || 3}
          </div>
          <div className="text-[11px] text-purple-400/90 font-mono mt-1">
            Unattributed Threat Clusters
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Ingested RFC 822</span>
            <Database className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {stats?.summary?.total_emails_ingested || 14}
          </div>
          <div className="text-[11px] text-blue-400/90 font-mono mt-1">
            Nazario & Enron Corpus Verified
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Threat Score</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {stats?.summary?.average_threat_score || 72.4} / 100
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-1">
            Threat Intelligence &amp; Behavioral Analysis
          </div>
        </div>
      </div>

      {/* PRIORITIZED ACTIVE CASES & THREAT SCORE MATRIX */}
      <div className="bg-[#1a1712] border border-[#3a352c] rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-950/80 border border-rose-700/60 flex items-center justify-center text-rose-400 shadow-md">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight uppercase">
                Active Forensic Cases &amp; Threat Score Queue
              </h3>
              <p className="text-[11px] text-slate-400 font-sans">
                Priority-ranked investigation queue with instant Case ID and Threat Score visibility
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab?.('cases')}
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 font-mono self-start sm:self-auto cursor-pointer transition-colors"
          >
            <span>Full Case Inventory ({SAMPLE_ANALYSES.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {SAMPLE_ANALYSES.map((sample) => {
            const verdictInfo = getStandardizedVerdict(sample);
            const isSelected = selectedAnalysisId === sample.id;
            return (
              <div
                key={sample.id}
                onClick={() => {
                  setSelectedAnalysisId(sample.id);
                  if (onSelectAnalysis) onSelectAnalysis(sample);
                }}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-3 group ${
                  isSelected
                    ? 'bg-blue-950/70 border-blue-500 shadow-lg ring-1 ring-blue-500/50'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                {/* Header: Case ID & Threat Score */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-xs font-bold">
                    <ShieldAlert className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>{sample.id}</span>
                  </div>
                  <div className={`px-2.5 py-0.5 rounded-md border font-mono text-xs font-black flex items-center gap-1 shadow-sm ${verdictInfo.colors.badge}`}>
                    <Zap className="w-3 h-3 shrink-0" />
                    <span>{verdictInfo.score}/100</span>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-100 line-clamp-2 leading-tight group-hover:text-blue-300 transition-colors">
                    {sample.subject || sample.headers?.subject || 'Forensic EML Analysis'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">
                    {sample.from || sample.headers?.from || 'Unknown Sender'}
                  </div>
                </div>

                {/* Footer Tag & Select Action */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] font-mono">
                  <span className={`px-2 py-0.5 rounded font-bold uppercase ${verdictInfo.colors.badge}`}>
                    {verdictInfo.verdict}
                  </span>
                  <span className={`text-[11px] font-semibold flex items-center gap-1 ${isSelected ? 'text-blue-300 font-bold' : 'text-slate-400 group-hover:text-blue-400'}`}>
                    <span>{isSelected ? 'Active Focus' : 'Triage Case'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ANALYST FORENSIC TRIAGE CONSOLE ACCORDION */}
      <div className="bg-[#1a1712] border border-[#3a352c] rounded-xl p-4 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-950/80 border border-blue-600/50 flex items-center justify-center text-blue-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>Forensic Triage Console &amp; Deep Telemetry</span>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  {isForensicConsoleExpanded ? 'Expanded' : 'Collapsed'}
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Full 5-panel breakdown: Fraud Score, Spoofing, Trace Path, Geolocation &amp; ML Attribution
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsForensicConsoleExpanded(prev => !prev)}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs text-slate-200 font-mono font-semibold flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-auto"
          >
            {isForensicConsoleExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 text-blue-400" />
                <span>Hide Full Forensic Console</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 text-blue-400" />
                <span>Show Full Forensic Console</span>
              </>
            )}
          </button>
        </div>

        {isForensicConsoleExpanded && (
          <div className="pt-3 border-t border-slate-800 animate-in fade-in duration-200">
            {(() => {
              const focusVerdict = getStandardizedVerdict(activeFocusAnalysis);
              const focusOriginHop = activeFocusAnalysis.hops?.find(h => h.isOrigin) || activeFocusAnalysis.hops?.[0];
              const originIp = focusOriginHop?.fromIp || '185.220.101.5';
              const isSpfPass = activeFocusAnalysis.auth?.spf?.status === 'PASS';
              const isDkimPass = activeFocusAnalysis.auth?.dkim?.status === 'PASS';
              const isDmarcPass = activeFocusAnalysis.auth?.dmarc?.status === 'PASS';
              const hasReplyDiverter = Boolean(activeFocusAnalysis.replyTo || activeFocusAnalysis.headers?.replyTo);
              const attributionConfidence = activeFocusAnalysis.mlConfidence 
                ? (activeFocusAnalysis.mlConfidence * 100).toFixed(1) 
                : '98.4';

              const handleFocusInspect = (targetTab: string) => {
                if (onSelectAnalysis) onSelectAnalysis(activeFocusAnalysis);
                if (onNavigateToTab) onNavigateToTab(targetTab);
              };

              return (
                <div className="bg-[#1a1712] rounded-xl space-y-5">
            {/* Console Header & Case Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-950/80 border border-blue-600/70 flex items-center justify-center text-blue-400 shadow-md">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Analyst Forensic Triage Console
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase font-bold">
                      Active Investigation
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Synthesized real-time telemetry: Fraud Score • Spoofing Indicators • Sender Trace Path • Geolocation • Attribution Confidence
                  </p>
                </div>
              </div>

              {/* Case Selector Dropdown & Quick Actions */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg">
                  <span className="text-xs text-slate-400 font-mono">Case:</span>
                  <select
                    value={selectedAnalysisId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedAnalysisId(newId);
                      const target = SAMPLE_ANALYSES.find(a => a.id === newId);
                      if (target && onSelectAnalysis) onSelectAnalysis(target);
                    }}
                    className="bg-transparent text-xs font-semibold text-slate-200 border-none outline-none cursor-pointer pr-1"
                  >
                    {SAMPLE_ANALYSES.map((sample) => (
                      <option key={sample.id} value={sample.id} className="bg-slate-900 text-slate-200">
                        {sample.name || sample.headers?.subject || sample.id}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => handleFocusInspect('overview')}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-blue-600/20"
                >
                  <span>Open Deep Overview</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Core 5-Module Analyst Deck */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              
              {/* 1. FRAUD SCORE & VERDICT */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider font-mono">1. Fraud Score</span>
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-black font-mono ${focusVerdict.colors.text}`}>
                      {focusVerdict.score}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">/ 100</span>
                  </div>

                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${focusVerdict.colors.badge}`}>
                      {focusVerdict.verdict}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {focusVerdict.severityLabel}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] space-y-1 font-mono text-slate-400">
                  <div className="flex justify-between">
                    <span>NLP Deception:</span>
                    <span className="text-slate-200 font-bold">{focusVerdict.score >= 60 ? '94.2%' : '12.0%'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ML Confidence:</span>
                    <span className="text-cyan-400 font-bold">{attributionConfidence}%</span>
                  </div>
                </div>
              </div>

              {/* 2. SPOOFING INDICATORS */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider font-mono">2. Spoofing Indicators</span>
                    <ShieldX className="w-4 h-4 text-amber-400" />
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between p-1 rounded bg-slate-950/60 border border-slate-800/80">
                      <span className="text-slate-400">SPF Alignment:</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isSpfPass ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
                        {activeFocusAnalysis.auth?.spf?.status || 'FAIL'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-1 rounded bg-slate-950/60 border border-slate-800/80">
                      <span className="text-slate-400">DKIM Signature:</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDkimPass ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
                        {activeFocusAnalysis.auth?.dkim?.status || 'FAIL'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-1 rounded bg-slate-950/60 border border-slate-800/80">
                      <span className="text-slate-400">DMARC Policy:</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDmarcPass ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
                        {activeFocusAnalysis.auth?.dmarc?.status || 'FAIL'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[10px] font-mono">
                  {hasReplyDiverter ? (
                    <div className="text-rose-400 flex items-center gap-1 font-bold">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>Reply-To Diverter Active</span>
                    </div>
                  ) : (
                    <div className="text-slate-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>Direct Reply Channel</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. SENDER TRACE PATH (HOP PIPELINE) */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider font-mono">3. Sender Trace Path</span>
                    <Network className="w-4 h-4 text-cyan-400" />
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-slate-300 font-mono flex items-center justify-between">
                      <span>Total Hops:</span>
                      <span className="font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">
                        {activeFocusAnalysis.hops?.length || 4} Hops
                      </span>
                    </div>

                    {/* Miniature visual route */}
                    <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5 text-[10px] font-mono">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                        <span className="truncate">Hop 0: LAN Subnet (RFC 1918)</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-rose-300 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse"></span>
                        <span className="truncate">Hop 1: {originIp} (Origin)</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0"></span>
                        <span className="truncate">Hop 2: Intermediate Relay</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                        <span className="truncate">Hop 3: Enterprise MX Gateway</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-mono">Protocol:</span>
                  <button
                    onClick={() => handleFocusInspect('hops')}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold font-mono flex items-center gap-1 cursor-pointer"
                  >
                    <span>Inspect Traceroute</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* 4. GEOLOCATION MAP & IP COORDINATES */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider font-mono">4. Geolocation Map</span>
                    <MapPin className="w-4 h-4 text-emerald-400" />
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Origin Location:</span>
                      <span className="text-slate-200 font-bold">
                        {focusOriginHop?.city || 'Moscow'}, {focusOriginHop?.country || 'Russian Federation'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Coordinates:</span>
                      <span className="text-cyan-300 font-bold text-[11px]">
                        {focusOriginHop?.lat ? `${focusOriginHop.lat.toFixed(4)}° N, ${focusOriginHop.lng?.toFixed(4)}° E` : '55.7558° N, 37.6173° E'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Origin ASN:</span>
                      <span className="text-slate-300 truncate block text-[11px]">
                        {focusOriginHop?.asn || 'AS44050 Selectel LLC'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-mono">
                    {focusOriginHop?.is_tor ? 'TOR EXIT NODE' : 'PUBLIC ORIGIN'}
                  </span>
                  <button
                    onClick={() => handleFocusInspect('map')}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold font-mono flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Map</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* 5. ATTRIBUTION CONFIDENCE */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider font-mono">5. Attribution</span>
                    <Globe className="w-4 h-4 text-purple-400" />
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span className="text-slate-400">Confidence:</span>
                        <span className="text-purple-300 font-bold">{attributionConfidence}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-purple-500 h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, Math.max(10, parseFloat(attributionConfidence)))}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="p-2 rounded bg-slate-950/70 border border-slate-800 text-[11px] font-mono">
                      <span className="text-slate-500 block text-[10px] uppercase">Threat Actor / Campaign:</span>
                      <span className="text-slate-100 font-bold">
                        {activeFocusAnalysis.id.includes('paypal') ? 'Unattributed (BEC Spoof Net)' : 'Unattributed (Deceptive Relay)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    onClick={() => handleFocusInspect('graph')}
                    className="text-purple-400 hover:text-purple-300 text-[11px] font-semibold font-mono flex items-center gap-1 cursor-pointer"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>Relay Graph</span>
                  </button>
                  <button
                    onClick={() => handleFocusInspect('campaigns')}
                    className="text-slate-400 hover:text-slate-200 text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                  >
                    <span>Campaigns</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}
          </div>
        )}
      </div>

      {/* Bulk Email File Threat Comparison Bar Chart Section */}
      <BulkThreatComparisonSummary
        onSelectAnalysis={onSelectAnalysis}
        onNavigateToTab={onNavigateToTab}
      />

      {/* Email Verdict Distribution (Last 30 Days) Chart */}
      <div className="bg-[#1a1712] border border-[#3a352c] rounded-xl p-5 shadow-lg space-y-4">
        {/* Chart Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                30-Day Email Verdict Distribution
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                Telemetry Trend
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Daily forensic analysis outcome breakdown across Clean, Suspicious, and Malicious email classifications.
            </p>
          </div>

          {/* Controls: Area vs Bar vs Pie */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 p-1 rounded-lg self-start sm:self-auto font-mono text-xs">
            <button
              onClick={() => setChartType('AREA')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                chartType === 'AREA' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AreaIcon className="w-3.5 h-3.5" />
              <span>Stacked Area</span>
            </button>
            <button
              onClick={() => setChartType('BAR')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                chartType === 'BAR' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Bar Chart</span>
            </button>
            <button
              onClick={() => setChartType('PIE')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                chartType === 'PIE' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span>Donut Ratio</span>
            </button>
          </div>
        </div>

        {/* Aggregate Verdict Summary Pill Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-900/80 border border-slate-800 rounded-lg p-3 text-xs font-mono">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase block">Clean / Legitimate:</span>
              <span className="text-emerald-400 font-bold font-mono text-sm">
                {totals30Day.clean.toLocaleString()} <span className="text-xs text-slate-400 font-normal">({totals30Day.cleanPct}%)</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-amber-500 shrink-0"></div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase block">Suspicious:</span>
              <span className="text-amber-400 font-bold font-mono text-sm">
                {totals30Day.suspicious.toLocaleString()} <span className="text-xs text-slate-400 font-normal">({totals30Day.suspiciousPct}%)</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-rose-500 shrink-0"></div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase block">Malicious Phish:</span>
              <span className="text-rose-400 font-bold font-mono text-sm">
                {totals30Day.malicious.toLocaleString()} <span className="text-xs text-slate-400 font-normal">({totals30Day.maliciousPct}%)</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-sky-400 shrink-0"></div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase block">Threat Trend Line:</span>
              <span className="text-sky-400 font-bold font-mono text-sm">
                {(totals30Day.suspicious + totals30Day.malicious).toLocaleString()} <span className="text-xs text-slate-400 font-normal">({totals30Day.suspiciousPct + totals30Day.maliciousPct}%)</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 border-l border-slate-800 pl-3">
            <Activity className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <span className="text-slate-400 text-[10px] uppercase block">30-Day Total Volume:</span>
              <span className="text-slate-200 font-bold font-mono text-sm">
                {totals30Day.total.toLocaleString()} emails
              </span>
            </div>
          </div>
        </div>

        {/* Chart Canvas Area */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'AREA' ? (
              <ComposedChart data={verdict30DayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cleanGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="suspiciousGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="maliciousGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const total = payload
                        .filter((entry) => entry.dataKey !== 'Threats')
                        .reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl font-mono text-xs text-slate-200 space-y-1.5 min-w-[170px]">
                          <div className="font-bold border-b border-slate-800 pb-1 text-slate-300">{label} (30-Day Window)</div>
                          {payload.map((entry, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-4">
                              <span style={{ color: entry.color }} className="font-semibold">{entry.name}:</span>
                              <span className="font-bold text-white">{entry.value}</span>
                            </div>
                          ))}
                          <div className="border-t border-slate-800 pt-1 flex items-center justify-between text-slate-400 font-bold">
                            <span>Total Analyzed:</span>
                            <span className="text-blue-400">{total}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontFamily: 'monospace' }}
                  iconType="circle"
                />
                <Area type="monotone" dataKey="Malicious" stackId="1" stroke="#F43F5E" fill="url(#maliciousGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="Suspicious" stackId="1" stroke="#F59E0B" fill="url(#suspiciousGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="Clean" stackId="1" stroke="#10B981" fill="url(#cleanGrad)" strokeWidth={2} />
                <Line
                  type="monotone"
                  dataKey="Threats"
                  name="Threat Trend"
                  stroke="#38BDF8"
                  strokeWidth={2.5}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#38BDF8', stroke: '#14120f', strokeWidth: 1 }}
                  activeDot={{ r: 6, fill: '#38BDF8', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              </ComposedChart>
            ) : chartType === 'BAR' ? (
              <ComposedChart data={verdict30DayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const total = payload
                        .filter((entry) => entry.dataKey !== 'Threats')
                        .reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl font-mono text-xs text-slate-200 space-y-1.5 min-w-[170px]">
                          <div className="font-bold border-b border-slate-800 pb-1 text-slate-300">{label}</div>
                          {payload.map((entry, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-4">
                              <span style={{ color: entry.color }} className="font-semibold">{entry.name}:</span>
                              <span className="font-bold text-white">{entry.value}</span>
                            </div>
                          ))}
                          <div className="border-t border-slate-800 pt-1 flex items-center justify-between text-slate-400 font-bold">
                            <span>Total Volume:</span>
                            <span className="text-blue-400">{total}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontFamily: 'monospace' }} />
                <Bar dataKey="Clean" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Suspicious" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Malicious" stackId="a" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="Threats"
                  name="Threat Trend"
                  stroke="#38BDF8"
                  strokeWidth={2.5}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#38BDF8', stroke: '#14120f', strokeWidth: 1 }}
                  activeDot={{ r: 6, fill: '#38BDF8', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              </ComposedChart>
            ) : (
              <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(1)}%`}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#14120f" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0];
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl font-mono text-xs text-slate-200 space-y-1">
                          <div className="font-bold" style={{ color: data.payload.color }}>
                            {data.name} Verdicts
                          </div>
                          <div>Total Count: <strong className="text-white">{data.value}</strong></div>
                          <div>Share: <strong className="text-blue-400">{((Number(data.value) / totals30Day.total) * 100).toFixed(1)}%</strong></div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', fontFamily: 'monospace' }} />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* World Geographic Threat Heatmap Section (Recharts ScatterChart) */}
      <div className="bg-[#1a1712] border border-[#3a352c] rounded-xl p-5 shadow-lg space-y-5">
        {/* Header Bar & Vector Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Global Threat Origin Heatmap
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                Recharts Geo Density
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Geographic density visualization of email threat origin servers, relays, and targeted IP subnets across global tactical sectors.
            </p>
          </div>

          {/* Category Filter Pills & Summary Metrics */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="text-[11px] text-slate-400 uppercase font-semibold flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> Vector:
            </span>
            {(['ALL', 'BEC', 'HARVESTING', 'MALWARE', 'EXPLOIT'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedGeoCategory(cat)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  selectedGeoCategory === cat
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-700'
                }`}
              >
                {cat === 'ALL' ? 'All Vectors' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Heatmap Metrics & Density Legend Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs font-mono">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-slate-400 text-[11px]">Filtered Threat Volume:</span>
              <span className="text-emerald-400 font-bold font-mono text-sm">{geoStats.totalIncidents} incidents</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 border-l border-slate-800 pl-4">
              <AlertOctagon className="w-4 h-4 text-rose-400" />
              <span className="text-slate-400 text-[11px]">Critical Hotspots:</span>
              <span className="text-rose-400 font-bold font-mono">{geoStats.criticalCount} Sectors</span>
            </div>
            <div className="hidden md:flex items-center gap-2 border-l border-slate-800 pl-4">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-slate-400 text-[11px]">Active Volume Spikes:</span>
              <span className="text-amber-400 font-bold font-mono">{geoStats.spikingCount} Regions</span>
            </div>
          </div>

          {/* Density Heat Scale Legend */}
          <div className="flex items-center gap-3 text-[10px] text-slate-400 border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0 w-full sm:w-auto justify-end">
            <span className="uppercase font-semibold text-slate-500">Density Scale:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block"></span> Low (&lt;50)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span> Medium (50-100)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> High (100-180)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block animate-pulse"></span> Critical (&gt;180)
            </div>
          </div>
        </div>

        {/* Tactical Map Display Container (SVG Vector Backdrop + Recharts ScatterChart Overlay) */}
        <div className="relative w-full h-[360px] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner flex flex-col justify-between">
          {/* Background Tactical SVG World Map Outlines & Grid */}
          <svg className="absolute inset-0 w-full h-full opacity-25 pointer-events-none stroke-slate-700 fill-slate-900/60" viewBox="-180 -85 360 170" preserveAspectRatio="none">
            {/* Equator and Prime Meridian */}
            <line x1="-180" y1="0" x2="180" y2="0" stroke="#475569" strokeDasharray="4 4" strokeWidth="0.6" />
            <line x1="0" y1="-85" x2="0" y2="85" stroke="#475569" strokeDasharray="4 4" strokeWidth="0.6" />
            
            {/* Latitude Gridlines */}
            <line x1="-180" y1="40" x2="180" y2="40" stroke="#334155" strokeDasharray="2 4" strokeWidth="0.4" />
            <line x1="-180" y1="-30" x2="180" y2="-30" stroke="#334155" strokeDasharray="2 4" strokeWidth="0.4" />
            <line x1="-100" y1="-85" x2="-100" y2="85" stroke="#334155" strokeDasharray="2 4" strokeWidth="0.4" />
            <line x1="100" y1="-85" x2="100" y2="85" stroke="#334155" strokeDasharray="2 4" strokeWidth="0.4" />

            {/* Continent Vector Polygons */}
            {/* North America */}
            <path d="M -168 65 L -130 72 L -65 72 L -65 42 L -82 25 L -92 14 L -105 18 L -122 35 L -125 50 Z" />
            {/* South America */}
            <path d="M -80 10 L -45 -5 L -35 -15 L -55 -52 L -75 -52 L -70 -20 Z" />
            {/* Europe */}
            <path d="M -10 65 L 35 68 L 40 48 L 30 35 L 5 36 L -10 45 Z" />
            {/* Africa */}
            <path d="M -15 35 L 38 32 L 50 12 L 40 -35 L 20 -35 L 10 0 L -15 15 Z" />
            {/* Asia */}
            <path d="M 40 70 L 175 70 L 170 50 L 142 35 L 120 18 L 75 10 L 45 30 Z" />
            {/* Australia / Oceania */}
            <path d="M 115 -12 L 155 -12 L 150 -38 L 115 -32 Z" />
          </svg>

          {/* Top Corner Map Overlay Info */}
          <div className="relative z-10 p-3 flex items-center justify-between text-[11px] font-mono text-slate-400 pointer-events-none">
            <div className="flex items-center gap-2 bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800">
              <Compass className="w-3.5 h-3.5 text-blue-400" />
              <span>Mercator Projection (-180° W to +180° E)</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Recharts Scatter Layer Active</span>
            </div>
          </div>

          {/* Recharts ScatterChart Canvas for Geographic Heatmap */}
          <div className="relative z-10 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 15, right: 25, bottom: 20, left: 25 }}>
                <XAxis type="number" dataKey="x" name="Longitude" domain={[-180, 180]} hide />
                <YAxis type="number" dataKey="y" name="Latitude" domain={[-60, 85]} hide />
                <ZAxis type="number" dataKey="z" range={[160, 950]} name="Incident Density" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3', stroke: '#475569' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item: RegionThreat = payload[0].payload;
                      const colors = getHeatColor(item.z, item.severity);
                      return (
                        <div className="bg-slate-900/95 border border-slate-700 p-3.5 rounded-xl shadow-2xl font-mono text-xs text-slate-200 space-y-2 min-w-[230px] backdrop-blur-md">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-700/50 text-[11px]">
                                {item.code}
                              </span>
                              <span className="font-bold text-slate-100">{item.region}</span>
                            </div>
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold border"
                              style={{
                                backgroundColor: `${colors.fill}20`,
                                color: colors.fill,
                                borderColor: `${colors.fill}50`
                              }}
                            >
                              {item.severity}
                            </span>
                          </div>
                          <div className="space-y-1 text-[11px]">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Origin / Country:</span>
                              <span className="text-slate-200 font-semibold">{item.country}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Threat Volume:</span>
                              <span className="font-bold text-white">{item.z} incidents</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Risk Severity Score:</span>
                              <span className="font-bold" style={{ color: colors.fill }}>
                                {item.riskScore} / 100
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Primary Vector:</span>
                              <span className="text-blue-400 font-semibold">{item.category}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Top ASN / ISP:</span>
                              <span className="text-slate-300 truncate max-w-[130px]" title={item.topAsn}>
                                {item.topAsn}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Malware Family:</span>
                              <span className="text-amber-300 font-semibold truncate max-w-[130px]">
                                {item.topMalware}
                              </span>
                            </div>
                          </div>
                          {item.recentSpike && (
                            <div className="pt-1.5 border-t border-slate-800 text-[10px] text-rose-400 font-bold flex items-center gap-1.5 animate-pulse">
                              <Zap className="w-3 h-3" />
                              <span>Active Volume Spike Detected</span>
                            </div>
                          )}
                          <div className="text-[10px] text-slate-500 text-center pt-1 italic border-t border-slate-800/80">
                            Click heat node to inspect sector telemetry
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter
                  data={filteredGeoData}
                  onClick={(entry) => setSelectedRegion(entry.payload)}
                  className="cursor-pointer"
                  animationDuration={600}
                >
                  {filteredGeoData.map((entry, index) => {
                    const colors = getHeatColor(entry.z, entry.severity);
                    const isSelected = selectedRegion?.id === entry.id;
                    return (
                      <Cell
                        key={`geo-cell-${index}`}
                        fill={colors.fill}
                        stroke={isSelected ? '#FFFFFF' : colors.stroke}
                        strokeWidth={isSelected ? 3 : 1.5}
                        fillOpacity={isSelected ? 0.95 : 0.75}
                      />
                    );
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom Coordinate Bar */}
          <div className="relative z-10 px-3 py-1 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>MAP LATITUDE RANGE: -60° S TO +85° N</span>
            <span>INTENSITY CALIBRATION: THREAT INTELLIGENCE &amp; GEOLOCATION TELEMETRY</span>
          </div>
        </div>

        {/* Selected Region Forensic Inspector Card & Threat Leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
          {/* Top Threat Origins Leaderboard (2 Cols) */}
          <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Regional Threat Origin Sectors ({filteredGeoData.length} Active)
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Click any sector to inspect
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[190px] overflow-y-auto pr-1">
              {filteredGeoData.map((reg) => {
                const colors = getHeatColor(reg.z, reg.severity);
                const isSelected = selectedRegion?.id === reg.id;
                return (
                  <button
                    key={reg.id}
                    onClick={() => setSelectedRegion(reg)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-950/70 border-blue-500/80 shadow-md ring-1 ring-blue-500/40'
                        : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: colors.fill }}
                      ></span>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-200 truncate flex items-center gap-1.5">
                          <span>{reg.region}</span>
                          <span className="text-[10px] font-mono text-slate-400 font-normal">({reg.code})</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {reg.country}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-2 font-mono">
                      <div className="text-xs font-bold text-slate-100">{reg.z}</div>
                      <div className="text-[10px]" style={{ color: colors.fill }}>
                        Risk {reg.riskScore}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Region Detailed Telemetry Card (1 Col) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            {selectedRegion ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-mono font-bold">
                      {selectedRegion.code}
                    </span>
                    <h4 className="text-xs font-bold text-slate-100 truncate max-w-[140px]" title={selectedRegion.region}>
                      {selectedRegion.region}
                    </h4>
                  </div>
                  <span
                    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase"
                    style={{
                      backgroundColor: `${getHeatColor(selectedRegion.z, selectedRegion.severity).fill}20`,
                      color: getHeatColor(selectedRegion.z, selectedRegion.severity).fill,
                      borderColor: `${getHeatColor(selectedRegion.z, selectedRegion.severity).fill}50`
                    }}
                  >
                    {selectedRegion.severity}
                  </span>
                </div>

                {/* Risk Progress Bar */}
                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-slate-400">Sector Threat Index:</span>
                    <span className="font-bold text-white">{selectedRegion.riskScore} / 100</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${selectedRegion.riskScore}%`,
                        backgroundColor: getHeatColor(selectedRegion.z, selectedRegion.severity).fill
                      }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] font-mono text-slate-300">
                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span className="text-slate-500">Origin Network:</span>
                    <span className="font-semibold text-slate-200 truncate max-w-[150px]" title={selectedRegion.topAsn}>
                      {selectedRegion.topAsn}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span className="text-slate-500">Subnet Block:</span>
                    <span className="text-emerald-400 font-semibold">{selectedRegion.ipRange}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span className="text-slate-500">Malware Family:</span>
                    <span className="text-amber-300 font-semibold">{selectedRegion.topMalware}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Threat Vector:</span>
                    <span className="text-blue-400 font-semibold">{selectedRegion.category}</span>
                  </div>
                </div>

                {onNavigateToTab && (
                  <button
                    onClick={() => onNavigateToTab('alerts')}
                    className="w-full mt-2 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <span>Investigate {selectedRegion.code} Alerts</span>
                    <span>→</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
                Select a region on the map to inspect
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Threat Actor & Campaigns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tracked Threat Actors */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Tracked Threat Actors & Syndicates
              </h2>
            </div>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('campaigns')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
              >
                View All →
              </button>
            )}
          </div>

          <div className="space-y-3">
            {(stats?.threat_actors || [
              { name: 'Unattributed (BEC Spoof Net)', campaign_count: 2, target: 'Financial & Supply Chain', status: 'ACTIVE' },
              { name: 'Unattributed (Credential Phishing Kit)', campaign_count: 1, target: 'Enterprise Office 365', status: 'MONITORING' },
              { name: 'Unattributed (Deceptive Signature Relay)', campaign_count: 1, target: 'Executive Office', status: 'EVALUATING' }
            ]).map((actor, i) => (
              <div key={i} className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-200">{actor.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">Target: {actor.target}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 bg-blue-950/80 border border-blue-700/50 text-blue-300 rounded font-mono">
                    {actor.campaign_count} Campaigns
                  </span>
                  <span className="text-[10px] px-2 py-0.5 bg-rose-950/80 border border-rose-700/50 text-rose-300 rounded font-mono font-bold">
                    {actor.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Alerts Feed */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Recent Threat Detections
              </h2>
            </div>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('alerts')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
              >
                Alert Console →
              </button>
            )}
          </div>

          <div className="space-y-3">
            {(stats?.recent_alerts || [
              {
                id: 'ALT-C4B821',
                title: 'Critical BEC & Display Name Spoof Detected',
                description: 'CEO impersonation lure with typo-squatted sender domain and wire transfer request.',
                severity: 'CRITICAL',
                status: 'NEW'
              },
              {
                id: 'ALT-8F92A0',
                title: 'SPF / DMARC Domain Alignment Failure',
                description: 'Originating IP from Moscow (AS44050) failed envelope sender validation.',
                severity: 'HIGH',
                status: 'NEW'
              },
              {
                id: 'ALT-3E12D7',
                title: 'Deceptive Redirect Chain (3 Hops)',
                description: 'Hyperlink anchor text mismatch targeting credentials harvesting endpoint.',
                severity: 'HIGH',
                status: 'ACKNOWLEDGED'
              }
            ]).map((alt, i) => (
              <div key={i} className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono border ${
                    alt.severity === 'CRITICAL'
                      ? 'bg-rose-950/80 border-rose-600 text-rose-300'
                      : 'bg-amber-950/80 border-amber-600 text-amber-300'
                  }`}>
                    {alt.severity}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{alt.id}</span>
                </div>
                <div className="text-xs font-semibold text-slate-200">{alt.title}</div>
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">{alt.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Analyst Workstation & Network Intelligence Telemetry */}
      <div className="mt-6">
        <NetworkIntelligenceCard />
      </div>
    </div>
  )}
</div>
  );
}
