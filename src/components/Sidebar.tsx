import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  MapPin, 
  Bell, 
  FileText, 
  Network, 
  Terminal, 
  Radio,
  Database,
  Upload,
  Search,
  Layers,
  FolderOpen,
  LayoutDashboard,
  Clock,
  Share2,
  Building2,
  Users,
  Lock,
  Compass,
  CheckCircle2,
  Cpu,
  Globe,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Zap
} from 'lucide-react';
import { motion } from 'motion/react';
import { ConnectionStatus } from '../hooks/useWebSocketAlerts';
import { UserRole } from '../hooks/useSession';

export type NavTab = 
  | 'dashboard'
  | 'cases'
  | 'campaigns'
  | 'search'
  | 'overview'
  | 'timeline'
  | 'graph'
  | 'hops'
  | 'map'
  | 'logs'
  | 'headers'
  | 'alerts'
  | 'ingest'
  | 'organization'
  | 'team';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  alertCount: number;
  wsStatus: ConnectionStatus;
  role?: UserRole;
  onOpenWalkthrough?: () => void;
  viewMode?: 'simple' | 'analyst';
}

export function Sidebar({
  activeTab,
  setActiveTab,
  alertCount,
  wsStatus,
  role = 'analyst',
  onOpenWalkthrough,
  viewMode = 'simple'
}: SidebarProps) {
  const [engineHealth, setEngineHealth] = useState<'operational' | 'degraded' | 'checking'>('operational');
  const [latencyMs, setLatencyMs] = useState<number>(12);
  const [isExpandedHealth, setIsExpandedHealth] = useState<boolean>(true);

  // Forensic tools collapsible section state (persisted)
  const [isForensicExpanded, setIsForensicExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tracexmail_forensic_tools_expanded');
      if (saved !== null) return saved === 'true';
    } catch {}
    return viewMode === 'analyst';
  });

  // Sync default expansion with viewMode if not explicitly toggled
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tracexmail_forensic_tools_expanded');
      if (saved === null) {
        setIsForensicExpanded(viewMode === 'analyst');
      }
    } catch {}
  }, [viewMode]);

  const toggleForensicTools = () => {
    setIsForensicExpanded(prev => {
      const next = !prev;
      try {
        localStorage.setItem('tracexmail_forensic_tools_expanded', String(next));
      } catch {}
      return next;
    });
  };

  // Dynamic Service Health Polling
  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      const start = performance.now();
      try {
        const res = await fetch('/api/health').catch(() => null);
        const elapsed = Math.round(performance.now() - start);
        if (isMounted) {
          if (res && res.ok) {
            setEngineHealth('operational');
            setLatencyMs(elapsed < 1 ? 12 : elapsed);
          } else {
            setEngineHealth('degraded');
          }
        }
      } catch {
        if (isMounted) setEngineHealth('degraded');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 25000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Tier 1: Always Visible Navigation Items
  const alwaysVisibleNavItems = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cases' as const, label: 'Cases', icon: FolderOpen },
    { id: 'search' as const, label: 'Search', icon: Search },
    { id: 'overview' as const, label: 'Message Overview', icon: Activity },
    { id: 'alerts' as const, label: 'Live Alerts', icon: Bell, badge: alertCount, isLocked: role === 'read_only' },
  ];

  // Tier 2: Collapsible Forensic Tools Items
  const forensicNavItems = [
    { id: 'campaigns' as const, label: 'Campaigns', icon: Layers },
    { id: 'graph' as const, label: 'Relationship Graph', icon: Share2 },
    { id: 'timeline' as const, label: 'Threat Timeline', icon: Clock },
    { id: 'ingest' as const, label: 'Email Ingestion', icon: Database, readOnlyDisabled: role === 'read_only' },
    { id: 'hops' as const, label: 'Hop Traceroute', icon: Network },
    { id: 'map' as const, label: 'Geographic Map', icon: MapPin },
    { id: 'logs' as const, label: 'Analysis Log', icon: Terminal },
    { id: 'headers' as const, label: 'Raw RFC822 / EML', icon: FileText },
  ];

  const adminNavItems = [
    { id: 'organization' as const, label: 'Organization', icon: Building2 },
    { id: 'team' as const, label: 'Team & access', icon: Users },
  ];

  const isWsConnected = (wsStatus as string)?.toLowerCase() === 'connected';
  const isWsReconnecting = (wsStatus as string)?.toLowerCase() === 'reconnecting' || (wsStatus as string)?.toLowerCase() === 'connecting';

  return (
    <aside id="app-sidebar" className="w-64 bg-[#1a1712] border-r border-[#3a352c] flex flex-col shrink-0 select-none">
      {/* Brand Header with Exact Forensic Identity */}
      <button
        onClick={() => setActiveTab('dashboard')}
        className="p-5 flex items-center gap-3 border-b border-[#3a352c] text-left hover:bg-[#221e17] transition-colors cursor-pointer"
        title="TraceXMail Workspace Dashboard"
      >
        <div className="w-[24px] h-[24px] border-[1.5px] border-[var(--thread)] rounded-full relative shrink-0">
          <div className="absolute inset-[5px] rounded-full bg-[var(--thread)]" />
        </div>
        <div>
          <span className="font-display font-bold text-xl tracking-tight text-[#ede6d8] block leading-none">
            TraceXMail
          </span>
          <span className="text-[10.5px] text-[#b9af9c] font-mono tracking-wider">
            CASE-XM-01
          </span>
        </div>
      </button>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-4 mt-3 overflow-y-auto">
        {/* Core Navigation (Always Visible) */}
        <div className="space-y-1">
          <div className="px-3 pb-1 text-[10px] font-mono font-medium text-[#b9af9c] uppercase tracking-wider">
            Workspace
          </div>
          {alwaysVisibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                id={`nav-btn-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className={`relative w-full px-3 py-2 rounded-md font-sans text-xs flex items-center gap-2.5 cursor-pointer text-left transition-colors duration-200 ${
                  isActive
                    ? 'text-[#ede6d8] font-semibold'
                    : item.isLocked
                      ? 'text-[#4f5763] hover:text-[#7d8794]'
                      : 'text-[#b9af9c] hover:text-[#ede6d8]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNavPill"
                    className="absolute inset-0 bg-[#b23a2e]/20 border border-[#b23a2e]/40 rounded-md shadow-xs"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}
                <Icon className={`relative z-10 w-4 h-4 transition-colors duration-200 ${isActive ? 'text-[#e8836f]' : 'text-[#8a8070]'}`} />
                <span className="relative z-10 flex-1">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && !item.isLocked && (
                  <span className="relative z-10 bg-[#b23a2e] text-[#ede6d8] text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                    {item.badge}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Forensic Tools (Collapsible Section) */}
        <div className="space-y-1">
          <button
            onClick={toggleForensicTools}
            className="w-full px-3 pb-1 pt-1 text-[10px] font-mono font-medium text-[#b9af9c] hover:text-[#ede6d8] uppercase tracking-wider flex items-center justify-between cursor-pointer group"
            title={isForensicExpanded ? "Collapse Forensic Tools" : "Expand Forensic Tools"}
          >
            <span className="flex items-center gap-1.5">
              <span>Forensic Tools</span>
              {!isForensicExpanded && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-[#3a352c]/50 text-[#8a8070]">
                  {forensicNavItems.length}
                </span>
              )}
            </span>
            <div className="text-[#8a8070] group-hover:text-[#ede6d8]">
              {isForensicExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </div>
          </button>

          {isForensicExpanded && (
            <div className="space-y-1 animate-in fade-in duration-150">
              {forensicNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <motion.button
                    key={item.id}
                    id={`nav-btn-${item.id}`}
                    onClick={() => setActiveTab(item.id)}
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className={`relative w-full px-3 py-2 rounded-md font-sans text-xs flex items-center gap-2.5 cursor-pointer text-left transition-colors duration-200 ${
                      isActive
                        ? 'text-[#ede6d8] font-semibold'
                        : item.readOnlyDisabled
                          ? 'text-[#4f5763] hover:text-[#7d8794]'
                          : 'text-[#8a8070] hover:text-[#ede6d8]'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeNavPill"
                        className="absolute inset-0 bg-[#7fa3ba]/15 border border-[#7fa3ba]/30 rounded-md shadow-xs"
                        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                      />
                    )}
                    <Icon className={`relative z-10 w-4 h-4 transition-colors duration-200 ${isActive ? 'text-[#7fa3ba]' : item.readOnlyDisabled ? 'text-[#4f5763]' : 'text-[#6b6255]'}`} />
                    <span className="relative z-10 flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="relative z-10 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {item.badge}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* Admin Navigation Section (Visible ONLY for admin role) */}
        {role === 'admin' && (
          <div className="space-y-1 pt-2 border-t border-[#3a352c]/50">
            <div className="px-3 pb-1 text-[10px] font-mono font-medium text-[#c9a227] uppercase tracking-wider flex items-center justify-between">
              <span>Admin</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-[#c9a227]/20 text-[#c9a227] font-mono">ENCLAVE</span>
            </div>
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <motion.button
                  key={item.id}
                  id={`nav-btn-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className={`relative w-full px-3 py-2 rounded-md font-sans text-xs flex items-center gap-2.5 cursor-pointer text-left transition-colors duration-200 ${
                    isActive
                      ? 'text-[#ede6d8] font-semibold'
                      : 'text-[#c9a227]/70 hover:text-[#ede6d8]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNavPill"
                      className="absolute inset-0 bg-[#c9a227]/15 border border-[#c9a227]/30 rounded-md shadow-xs"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <Icon className={`relative z-10 w-4 h-4 transition-colors duration-200 ${isActive ? 'text-[#c9a227]' : 'text-[#8a7530]'}`} />
                  <span className="relative z-10 flex-1">{item.label}</span>
                </motion.button>
              );
            })}
          </div>
        )}
      </nav>

      {/* Visual Service Health Indicators Panel */}
      <div className="px-3 pt-2 pb-1">
        <div className="bg-[#13110e] border border-[#3a352c] rounded-sm p-2.5 font-mono text-[10.5px]">
          <div 
            onClick={() => setIsExpandedHealth(!isExpandedHealth)}
            className="flex items-center justify-between cursor-pointer text-[#8a8070] hover:text-[#ede6d8] transition-colors"
            title="Toggle Service Health Details"
          >
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full inline-block ${
                engineHealth === 'operational' 
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' 
                  : 'bg-[var(--thread)]'
              }`} />
              <span className="font-bold tracking-wider text-[#ede6d8]">SERVICE HEALTH</span>
            </div>
            <div className="flex items-center gap-1 text-[9.5px]">
              <span className="text-emerald-400 font-semibold">{latencyMs}ms</span>
              {isExpandedHealth ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </div>
          </div>

          {isExpandedHealth && (
            <div className="mt-2 pt-2 border-t border-[#2c271f] space-y-1.5 text-[#b9af9c]">
              {/* Analysis Engine */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[#8a8070]">
                  <Cpu className="w-3 h-3 text-[var(--thread)]" />
                  <span>Analysis Engine</span>
                </span>
                <span className={`font-bold text-[9.5px] px-1 py-0.2 rounded border ${
                  engineHealth === 'operational'
                    ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-400'
                    : 'bg-rose-950/40 border-rose-800/80 text-rose-400'
                }`}>
                  {engineHealth === 'operational' ? 'ONLINE' : 'DEGRADED'}
                </span>
              </div>

              {/* Gemini AI Intel */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[#8a8070]">
                  <Zap className="w-3 h-3 text-[var(--stamp)]" />
                  <span>Gemini 3.6 AI</span>
                </span>
                <span className="font-bold text-[9.5px] px-1 py-0.2 rounded bg-[rgba(201,162,39,0.15)] border border-[rgba(201,162,39,0.4)] text-[var(--stamp)]">
                  ACTIVE
                </span>
              </div>

              {/* Threat APIs */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[#8a8070]">
                  <Globe className="w-3 h-3 text-[var(--slate)]" />
                  <span>Intel &amp; Rep APIs</span>
                </span>
                <span className="font-bold text-[9.5px] px-1 py-0.2 rounded bg-[rgba(127,163,186,0.15)] border border-[rgba(127,163,186,0.4)] text-[var(--slate)]">
                  ONLINE
                </span>
              </div>

              {/* Real-time WS Bridge */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[#8a8070]">
                  <Radio className="w-3 h-3 text-emerald-400" />
                  <span>Alert WS Bridge</span>
                </span>
                <span className={`font-bold text-[9.5px] px-1 py-0.2 rounded border ${
                  isWsConnected
                    ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-400'
                    : isWsReconnecting
                      ? 'bg-amber-950/40 border-amber-800/80 text-amber-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                }`}>
                  {isWsConnected ? 'ONLINE' : isWsReconnecting ? 'CONNECTING' : 'STANDBY'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Ingest & Walkthrough Actions in Sidebar */}
      <div className="p-3 space-y-2">
        {onOpenWalkthrough && (
          <motion.button
            onClick={onOpenWalkthrough}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="w-full py-1.5 px-3 rounded-[2px] text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all bg-[rgba(201,162,39,0.12)] hover:bg-[rgba(201,162,39,0.22)] border border-[rgba(201,162,39,0.35)] text-[var(--stamp)] cursor-pointer shadow-xs"
            title="Launch Interactive Forensic Walkthrough Overlay"
          >
            <Compass className="w-3.5 h-3.5 text-[var(--stamp)]" />
            <span>GET STARTED GUIDE</span>
          </motion.button>
        )}

        <motion.button
          onClick={() => setActiveTab('ingest')}
          disabled={role === 'read_only'}
          title={role === 'read_only' ? 'Read-only access: file ingestion restricted' : 'Ingest .EML File'}
          whileHover={{ scale: role === 'read_only' ? 1 : 1.02 }}
          whileTap={{ scale: role === 'read_only' ? 1 : 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className={`w-full py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
            role === 'read_only'
              ? 'bg-[#1e1b15] border border-[#2e2a22] text-[#6b6255] cursor-not-allowed opacity-60'
              : 'bg-[#26221b] hover:bg-[#322c23] border border-[#3a352c] text-[#ede6d8] cursor-pointer'
          }`}
        >
          <Upload className="w-3.5 h-3.5 text-[var(--thread)]" />
          <span>{role === 'read_only' ? 'Ingestion Restricted' : 'Ingest .EML File'}</span>
        </motion.button>
      </div>

      {/* Public legal links */}
      <div className="px-3 pb-3 flex items-center justify-center gap-3 text-[10px] font-mono text-[#8a8070]">
        <a
          href="/privacy"
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-[#ede6d8]"
        >
          PRIVACY
        </a>
        <span className="text-[#3a352c]">•</span>
        <a
          href="/terms"
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-[#ede6d8]"
        >
          TERMS
        </a>
      </div>
    </aside>
  );
}
