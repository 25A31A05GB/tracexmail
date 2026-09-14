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
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
  Mail,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { ConnectionStatus } from '../hooks/useWebSocketAlerts';
import { UserRole } from '../hooks/useSession';
import { Sparkles, Building2 as OrgIcon, ShieldCheck, Keyboard } from 'lucide-react';

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
  | 'gmail'
  | 'organization'
  | 'team'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  alertCount: number;
  wsStatus: ConnectionStatus;
  role?: UserRole;
  accountType?: 'personal' | 'organization';
  onOpenUpgradeModal?: (featureName?: string) => void;
  onOpenWalkthrough?: () => void;
  viewMode?: 'simple' | 'analyst';
  onOpenShortcutsHelp?: () => void;
  onOpenCommandPalette?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  alertCount,
  wsStatus,
  role = 'analyst',
  accountType = 'organization',
  onOpenUpgradeModal,
  onOpenWalkthrough,
  viewMode = 'simple',
  onOpenShortcutsHelp,
  onOpenCommandPalette,
  isMobileOpen = false,
  onCloseMobile
}: SidebarProps) {
  const [engineHealth, setEngineHealth] = useState<'operational' | 'degraded' | 'checking'>('operational');
  const [latencyMs, setLatencyMs] = useState<number>(12);
  const [isExpandedHealth, setIsExpandedHealth] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tracexmail_service_health_expanded');
      if (saved !== null) return saved === 'true';
    } catch {}
    return false; // Collapsed by default for progressive disclosure
  });

  // Desktop collapsed sidebar rail state (persisted)
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tracexmail_sidebar_collapsed');
      if (saved !== null) return saved === 'true';
    } catch {}
    return false;
  });

  const toggleDesktopCollapsed = () => {
    setIsDesktopCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('tracexmail_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleDesktopCollapsed();
      }
      if (e.key === 'Escape' && isMobileOpen && onCloseMobile) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  const toggleHealthExpanded = () => {
    setIsExpandedHealth(prev => {
      const next = !prev;
      try {
        localStorage.setItem('tracexmail_service_health_expanded', String(next));
      } catch {}
      return next;
    });
  };

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

  interface NavItem {
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    isLocked?: boolean;
    readOnlyDisabled?: boolean;
  }

  // Tier 1: Always Visible Navigation Items
  const alwaysVisibleNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cases', label: 'Investigation Cases', icon: FolderOpen },
    { id: 'search', label: 'Search & Filter', icon: Search },
    { id: 'overview', label: 'Email Analysis', icon: Activity },
    { id: 'alerts', label: 'Security Alerts', icon: Bell, badge: alertCount, isLocked: role === 'read_only' },
    { id: 'settings', label: 'Account & Settings', icon: SlidersHorizontal },
  ];

  // Tier 2: Collapsible Forensic Tools Items
  const forensicNavItems: NavItem[] = [
    { id: 'campaigns', label: 'Attack Campaigns', icon: Layers },
    { id: 'graph', label: 'Sender & Domain Graph', icon: Share2 },
    { id: 'timeline', label: 'Threat Timeline', icon: Clock },
    { id: 'ingest', label: 'Upload & Inspect Email', icon: Database, readOnlyDisabled: role === 'read_only' },
    { id: 'gmail', label: 'Gmail Live Sync', icon: Mail, readOnlyDisabled: role === 'read_only' },
    { id: 'hops', label: 'Server Routing & Hops', icon: Network },
    { id: 'map', label: 'Origin Geo Map', icon: MapPin },
    { id: 'logs', label: 'Security Logs', icon: Terminal },
    { id: 'headers', label: 'Raw Email Headers', icon: FileText },
  ];

  const adminNavItems: NavItem[] = [
    { id: 'organization', label: 'Organization', icon: Building2 },
    { id: 'team', label: 'Team & access', icon: Users },
  ];

  const isWsConnected = (wsStatus as string)?.toLowerCase() === 'connected';
  const isWsReconnecting = (wsStatus as string)?.toLowerCase() === 'reconnecting' || (wsStatus as string)?.toLowerCase() === 'connecting';

  const handleTabClick = (tabId: NavTab, label: string) => {
    // If in personal mode and clicking an enterprise-only feature
    const personalAllowedTabs: NavTab[] = ['ingest', 'overview', 'hops', 'map', 'headers', 'logs', 'settings'];
    if (accountType === 'personal' && !personalAllowedTabs.includes(tabId)) {
      if (onOpenUpgradeModal) {
        onOpenUpgradeModal(label);
        return;
      }
    }
    setActiveTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
          onClick={onCloseMobile}
          aria-label="Close navigation menu backdrop"
        />
      )}

      <aside 
        id="app-sidebar" 
        className={`
          fixed md:static inset-y-0 left-0 z-50
          ${isDesktopCollapsed ? 'md:w-16' : 'md:w-64'}
          w-72 max-w-[85vw]
          bg-[#1a1712] border-r border-[#3a352c] 
          flex flex-col shrink-0 select-none 
          transition-all duration-200 ease-in-out
          ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Mobile Header Bar with dedicated Close / Collapse Button */}
        <div className="md:hidden flex items-center justify-between p-3.5 border-b border-[#3a352c] bg-[#14120f]">
          <div className="flex items-center gap-2.5">
            <div className="w-[22px] h-[22px] border-[1.5px] border-[var(--thread)] rounded-full relative shrink-0">
              <div className="absolute inset-[4px] rounded-full bg-[var(--thread)]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-base tracking-tight text-[#ede6d8] leading-none">
                  TraceXMail
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[rgba(201,162,39,0.2)] text-[var(--stamp)] border border-[var(--stamp)]/40 font-bold">
                  {accountType === 'personal' ? 'INDIVIDUAL' : 'SOC'}
                </span>
              </div>
              <span className="text-[9.5px] text-[#8a8070] font-mono tracking-wider">NAVIGATION MENU</span>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="p-2 rounded-md bg-[#221e17] border border-[#3a352c] text-[#ede6d8] hover:text-[var(--thread)] hover:border-[var(--thread)] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono min-w-[44px] min-h-[44px] justify-center"
            title="Collapse navigation menu (Esc)"
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4 text-amber-400" />
            <span>Close</span>
          </button>
        </div>

        {/* Desktop Brand Header with Collapse / Expand Navigation Toggle */}
        <div className="hidden md:flex items-center justify-between border-b border-[#3a352c] p-3">
          {!isDesktopCollapsed ? (
            <>
              <button
                onClick={() => handleTabClick('dashboard', 'Dashboard')}
                className="flex items-center gap-2.5 text-left hover:opacity-90 transition-opacity cursor-pointer min-w-0"
                title="TraceXMail Workspace Dashboard"
              >
                <div className="w-[24px] h-[24px] border-[1.5px] border-[var(--thread)] rounded-full relative shrink-0">
                  <div className="absolute inset-[5px] rounded-full bg-[var(--thread)]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-display font-bold text-base tracking-tight text-[#ede6d8] leading-none">
                      TraceXMail
                    </span>
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[rgba(201,162,39,0.2)] text-[var(--stamp)] border border-[var(--stamp)]/40 font-bold">
                      {accountType === 'personal' ? 'INDIVIDUAL' : 'SOC'}
                    </span>
                  </div>
                  <span className="text-[9.5px] text-[#8a8070] font-mono tracking-wider block mt-0.5">
                    {accountType === 'personal' ? 'SINGLE EMAIL FORENSICS' : 'ENTERPRISE ENCLAVE'}
                  </span>
                </div>
              </button>

              <button
                onClick={toggleDesktopCollapsed}
                className="p-1.5 rounded-md hover:bg-[#221e17] text-[#8a8070] hover:text-[#ede6d8] border border-transparent hover:border-[#3a352c] transition-colors cursor-pointer shrink-0"
                title="Collapse navigation menu (⌘B / Ctrl+B)"
                aria-label="Collapse navigation menu"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="w-full flex flex-col items-center gap-2 py-1">
              <button
                onClick={() => handleTabClick('dashboard', 'Dashboard')}
                className="w-[26px] h-[26px] border-[1.5px] border-[var(--thread)] rounded-full relative hover:scale-105 transition-transform cursor-pointer"
                title="TraceXMail Dashboard"
              >
                <div className="absolute inset-[5px] rounded-full bg-[var(--thread)]" />
              </button>
              <button
                onClick={toggleDesktopCollapsed}
                className="p-1.5 rounded-md hover:bg-[#221e17] text-[#8a8070] hover:text-[#ede6d8] border border-[#3a352c] transition-colors cursor-pointer"
                title="Expand navigation menu (⌘B / Ctrl+B)"
                aria-label="Expand navigation menu"
              >
                <PanelLeftOpen className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          )}
        </div>

        {/* Account Type Notice for Personal Users (Only when expanded) */}
        {!isDesktopCollapsed && accountType === 'personal' && (
          <div className="mx-3 mt-3 p-2.5 rounded-[2px] bg-[rgba(201,162,39,0.1)] border border-[rgba(201,162,39,0.3)] text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-[var(--stamp)] font-semibold text-[11px]">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Individual Mode</span>
            </div>
            <p className="text-[10.5px] text-[var(--paper-dim)] leading-tight">
              Email Ingestion &amp; single-message forensic triage active.
            </p>
            <button
              onClick={() => onOpenUpgradeModal && onOpenUpgradeModal('Organization Full SOC Access')}
              className="w-full text-center py-1 rounded-[2px] bg-[var(--stamp)] text-[var(--ink)] font-bold text-[10.5px] hover:brightness-110 cursor-pointer transition-all flex items-center justify-center gap-1"
            >
              <OrgIcon className="w-3 h-3" />
              <span>Switch to Org Mode</span>
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className={`flex-1 ${isDesktopCollapsed ? 'px-1.5' : 'px-3'} space-y-4 mt-3 overflow-y-auto overflow-x-hidden`}>
          {/* Core Navigation (Always Visible) */}
          <div className="space-y-1">
            {!isDesktopCollapsed && (
              <div className="px-3 pb-1 text-[10px] font-mono font-medium text-[#b9af9c] uppercase tracking-wider">
                Workspace
              </div>
            )}
            {alwaysVisibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isRestrictedForPersonal = accountType === 'personal' && !['overview'].includes(item.id);

              return (
                <div key={item.id} className="relative group">
                  <motion.button
                    id={`nav-btn-${item.id}`}
                    onClick={() => handleTabClick(item.id, item.label)}
                    whileHover={{ x: isDesktopCollapsed ? 0 : 3 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className={`relative w-full ${
                      isDesktopCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 gap-2.5'
                    } rounded-md font-sans text-xs flex items-center cursor-pointer text-left transition-colors duration-200 ${
                      isActive
                        ? 'text-[#ede6d8] font-semibold'
                        : isRestrictedForPersonal
                          ? 'text-[#7d8794] hover:text-[#ede6d8]'
                          : item.isLocked
                            ? 'text-[#4f5763] hover:text-[#7d8794]'
                            : 'text-[#b9af9c] hover:text-[#ede6d8]'
                    }`}
                    title={isDesktopCollapsed ? item.label : undefined}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeNavPill"
                        className="absolute inset-0 bg-[#b23a2e]/20 border border-[#b23a2e]/40 rounded-md shadow-xs"
                        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                      />
                    )}
                    <Icon className={`relative z-10 w-4 h-4 transition-colors duration-200 shrink-0 ${isActive ? 'text-[#e8836f]' : 'text-[#8a8070]'}`} />
                    {!isDesktopCollapsed && (
                      <>
                        <span className="relative z-10 flex-1 truncate">{item.label}</span>
                        {isRestrictedForPersonal && (
                          <span className="relative z-10 text-[9px] font-mono px-1 py-0.2 rounded bg-[rgba(201,162,39,0.15)] text-[var(--stamp)]">
                            ORG
                          </span>
                        )}
                        {item.badge !== undefined && item.badge > 0 && !item.isLocked && !isRestrictedForPersonal && (
                          <span className="relative z-10 bg-[#b23a2e] text-[#ede6d8] text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                    {isDesktopCollapsed && item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#b23a2e] animate-pulse" />
                    )}
                  </motion.button>

                  {/* Desktop Hover Floating Tooltip when Collapsed */}
                  {isDesktopCollapsed && (
                    <div className="hidden md:group-hover:flex absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-2.5 py-1 bg-[#14120f] border border-[#3a352c] rounded shadow-xl text-xs font-medium text-[#ede6d8] z-50 whitespace-nowrap pointer-events-none items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100">
                      <span>{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="bg-[#b23a2e] text-white px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Forensic Tools (Collapsible Section) */}
          <div className="space-y-1">
            {!isDesktopCollapsed ? (
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
            ) : (
              <div className="pt-2 border-t border-[#3a352c]/40 my-1" />
            )}

            {(isForensicExpanded || isDesktopCollapsed) && (
              <div className="space-y-1 animate-in fade-in duration-150">
                {forensicNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const isRestrictedForPersonal = accountType === 'personal' && ['campaigns', 'graph', 'timeline', 'gmail'].includes(item.id);

                  return (
                    <div key={item.id} className="relative group">
                      <motion.button
                        id={`nav-btn-${item.id}`}
                        onClick={() => handleTabClick(item.id, item.label)}
                        whileHover={{ x: isDesktopCollapsed ? 0 : 3 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className={`relative w-full ${
                          isDesktopCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 gap-2.5'
                        } rounded-md font-sans text-xs flex items-center cursor-pointer text-left transition-colors duration-200 ${
                          isActive
                            ? 'text-[#ede6d8] font-semibold'
                            : isRestrictedForPersonal
                              ? 'text-[#7d8794] hover:text-[#ede6d8]'
                              : item.readOnlyDisabled
                                ? 'text-[#4f5763] hover:text-[#7d8794]'
                                : 'text-[#8a8070] hover:text-[#ede6d8]'
                        }`}
                        title={isDesktopCollapsed ? item.label : undefined}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeNavPill"
                            className="absolute inset-0 bg-[#7fa3ba]/15 border border-[#7fa3ba]/30 rounded-md shadow-xs"
                            transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                          />
                        )}
                        <Icon className={`relative z-10 w-4 h-4 transition-colors duration-200 shrink-0 ${isActive ? 'text-[#7fa3ba]' : item.readOnlyDisabled ? 'text-[#4f5763]' : 'text-[#6b6255]'}`} />
                        {!isDesktopCollapsed && (
                          <>
                            <span className="relative z-10 flex-1 truncate">{item.label}</span>
                            {isRestrictedForPersonal && (
                              <span className="relative z-10 text-[9px] font-mono px-1 py-0.2 rounded bg-[rgba(201,162,39,0.15)] text-[var(--stamp)]">
                                ORG
                              </span>
                            )}
                            {item.badge && !isRestrictedForPersonal && (
                              <span className="relative z-10 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </motion.button>

                      {/* Desktop Tooltip for Forensic Tools when Collapsed */}
                      {isDesktopCollapsed && (
                        <div className="hidden md:group-hover:flex absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-2.5 py-1 bg-[#14120f] border border-[#3a352c] rounded shadow-xl text-xs font-medium text-[#ede6d8] z-50 whitespace-nowrap pointer-events-none items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100">
                          <span>{item.label}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Admin Navigation Section (Visible ONLY for admin role in Organization Mode) */}
          {role === 'admin' && accountType === 'organization' && (
            <div className="space-y-1 pt-2 border-t border-[#3a352c]/50">
              {!isDesktopCollapsed && (
                <div className="px-3 pb-1 text-[10px] font-mono font-medium text-[#c9a227] uppercase tracking-wider flex items-center justify-between">
                  <span>Admin &amp; Employees</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-[#c9a227]/20 text-[#c9a227] font-mono">ROOT</span>
                </div>
              )}
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <div key={item.id} className="relative group">
                    <motion.button
                      id={`nav-btn-${item.id}`}
                      onClick={() => handleTabClick(item.id, item.label)}
                      whileHover={{ x: isDesktopCollapsed ? 0 : 3 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      className={`relative w-full ${
                        isDesktopCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 gap-2.5'
                      } rounded-md font-sans text-xs flex items-center cursor-pointer text-left transition-colors duration-200 ${
                        isActive
                          ? 'text-[#ede6d8] font-semibold'
                          : 'text-[#c9a227]/70 hover:text-[#ede6d8]'
                      }`}
                      title={isDesktopCollapsed ? item.label : undefined}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeNavPill"
                          className="absolute inset-0 bg-[#c9a227]/15 border border-[#c9a227]/30 rounded-md shadow-xs"
                          transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                        />
                      )}
                      <Icon className={`relative z-10 w-4 h-4 transition-colors duration-200 shrink-0 ${isActive ? 'text-[#c9a227]' : 'text-[#8a7530]'}`} />
                      {!isDesktopCollapsed && <span className="relative z-10 flex-1 truncate">{item.label}</span>}
                    </motion.button>

                    {isDesktopCollapsed && (
                      <div className="hidden md:group-hover:flex absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-2.5 py-1 bg-[#14120f] border border-[#3a352c] rounded shadow-xl text-xs font-medium text-[#c9a227] z-50 whitespace-nowrap pointer-events-none items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100">
                        <span>{item.label}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </nav>

        {/* Visual Service Health Indicators Panel (Progressive Disclosure - Collapsed by default into single status indicator) */}
        <div className={`${isDesktopCollapsed ? 'px-1.5 py-1' : 'px-3 pt-2 pb-1'}`}>
          {!isDesktopCollapsed ? (
            <div className="bg-[#13110e] border border-[#3a352c] rounded-sm p-2 font-mono text-[10.5px] transition-all">
              <button 
                type="button"
                onClick={toggleHealthExpanded}
                className="w-full flex items-center justify-between cursor-pointer text-[#8a8070] hover:text-[#ede6d8] transition-colors text-left"
                title={isExpandedHealth ? "Collapse service health breakdown" : "Expand service health breakdown"}
                aria-expanded={isExpandedHealth}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${
                    engineHealth === 'operational' 
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' 
                      : 'bg-[var(--thread)]'
                  }`} />
                  <span className="font-bold tracking-wider text-[#ede6d8] text-[10px] truncate">
                    {isExpandedHealth ? 'SERVICE HEALTH' : (engineHealth === 'operational' ? 'All Systems Operational' : 'Engine Degraded')}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[9.5px] shrink-0 ml-1.5">
                  <span className="text-emerald-400 font-semibold">{latencyMs}ms</span>
                  {isExpandedHealth ? <ChevronUp className="w-3 h-3 text-[#b9af9c]" /> : <ChevronDown className="w-3 h-3 text-[#b9af9c]" />}
                </div>
              </button>

              {isExpandedHealth && (
                <div className="mt-2 pt-2 border-t border-[#2c271f] space-y-1.5 text-[#b9af9c] animate-in fade-in duration-150">
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
          ) : (
            /* Collapsed Rail Single Dot Indicator with Tooltip */
            <div className="flex justify-center group relative">
              <button
                type="button"
                onClick={toggleDesktopCollapsed}
                className="w-8 h-8 rounded bg-[#13110e] border border-[#3a352c] flex items-center justify-center hover:border-emerald-500/60 transition-colors cursor-pointer"
                title={`Service Health: ${engineHealth === 'operational' ? 'All Systems Operational' : 'Degraded'} (${latencyMs}ms) - Click to expand sidebar`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${
                  engineHealth === 'operational'
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse'
                    : 'bg-[var(--thread)]'
                }`} />
              </button>
              <div className="hidden md:group-hover:flex absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-2.5 py-1 bg-[#14120f] border border-[#3a352c] rounded shadow-xl text-xs font-mono text-[#ede6d8] z-50 whitespace-nowrap pointer-events-none items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100">
                <span className="text-emerald-400">●</span>
                <span>Operational ({latencyMs}ms)</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions in Sidebar */}
        <div className={`p-3 space-y-2 ${isDesktopCollapsed ? 'px-1.5' : ''}`}>
          {!isDesktopCollapsed && onOpenWalkthrough && (
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
            onClick={() => handleTabClick('ingest', 'Upload & Inspect Email')}
            disabled={role === 'read_only'}
            title={role === 'read_only' ? 'Read-only access: file ingestion restricted' : 'Ingest .EML File (Alt+2 / ⌘2)'}
            whileHover={{ scale: role === 'read_only' ? 1 : 1.02 }}
            whileTap={{ scale: role === 'read_only' ? 1 : 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`w-full ${
              isDesktopCollapsed ? 'p-2 justify-center' : 'py-2 px-3 justify-center gap-2'
            } rounded-md text-xs font-semibold flex items-center transition-colors ${
              role === 'read_only'
                ? 'bg-[#1e1b15] border border-[#2e2a22] text-[#6b6255] cursor-not-allowed opacity-60'
                : 'bg-[#26221b] hover:bg-[#322c23] border border-[#3a352c] text-[#ede6d8] cursor-pointer'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-[var(--thread)] shrink-0" />
            {!isDesktopCollapsed && (
              <span>{role === 'read_only' ? 'Ingestion Restricted' : 'Ingest .EML File'}</span>
            )}
          </motion.button>

          {!isDesktopCollapsed && onOpenShortcutsHelp && (
            <button
              onClick={onOpenShortcutsHelp}
              className="w-full py-1 px-2 rounded text-[11px] font-mono text-[#8a8070] hover:text-[#ede6d8] hover:bg-[#221e17] flex items-center justify-between transition-colors cursor-pointer"
              title="View Keyboard Shortcuts Cheat Sheet (?)"
            >
              <span className="flex items-center gap-1.5">
                <Keyboard className="w-3 h-3 text-amber-400/80" />
                <span>Shortcuts</span>
              </span>
              <kbd className="px-1.5 py-0.2 bg-[#26211a] border border-[#3a352c] rounded text-[9.5px] font-mono text-amber-400/90">
                ⌘K / ?
              </kbd>
            </button>
          )}

          {/* Desktop Toggle Menu Collapse Option at Bottom */}
          <button
            onClick={toggleDesktopCollapsed}
            className={`hidden md:flex w-full py-1.5 px-2 rounded text-[11px] font-mono text-[#8a8070] hover:text-[#ede6d8] hover:bg-[#221e17] items-center ${
              isDesktopCollapsed ? 'justify-center' : 'justify-between'
            } transition-colors cursor-pointer border border-[#2d2820] mt-1`}
            title={isDesktopCollapsed ? "Expand Navigation Menu (⌘B)" : "Collapse Navigation Menu (⌘B)"}
          >
            {isDesktopCollapsed ? (
              <PanelLeftOpen className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <>
                <span className="flex items-center gap-1.5">
                  <PanelLeftClose className="w-3.5 h-3.5 text-[#8a8070]" />
                  <span>Collapse Menu</span>
                </span>
                <kbd className="px-1 py-0.2 bg-[#1c1813] border border-[#342e26] rounded text-[9px] text-[#8a8070]">
                  ⌘B
                </kbd>
              </>
            )}
          </button>
        </div>

        {/* Public legal links (Only when expanded) */}
        {!isDesktopCollapsed && (
          <div className="px-3 pb-3 flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono text-[#8a8070]">
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
            <span className="text-[#3a352c]">•</span>
            <a
              href="/cookies"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-[#ede6d8]"
            >
              COOKIES
            </a>
            <span className="text-[#3a352c]">•</span>
            <a
              href="/contact"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-[#ede6d8]"
            >
              CONTACT
            </a>
          </div>
        )}
      </aside>
    </>
  );
}

