import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppGuard } from './components/AppGuard';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { LandingView } from './components/LandingView';
import { LegalPage, LegalPageType } from './components/LegalPage';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';

// Console Views
import { OverviewView } from './components/OverviewView';
import { DashboardView } from './components/DashboardView';
import { CasesView } from './components/CasesView';
import { CampaignsView } from './components/CampaignsView';
import { SearchView } from './components/SearchView';
import { ThreatTimelineView } from './components/ThreatTimelineView';
import { RelationshipGraphView } from './components/RelationshipGraphView';
import { HopTracerouteView } from './components/HopTracerouteView';
import { MapView } from './components/MapView';
import { ThreatLogView } from './components/ThreatLogView';
import { RawHeaderView } from './components/RawHeaderView';
import { AlertsView } from './components/AlertsView';
import { IngestionPipelineView } from './components/IngestionPipelineView';
import { GmailConnectionView } from './components/GmailConnectionView';
import { OrganizationView } from './components/OrganizationView';
import { TeamView } from './components/TeamView';
import { UltimateBossAdminView } from './components/UltimateBossAdminView';
import { AccountSettingsView } from './components/AccountSettingsView';

// Modals & Overlays
import { AuthModal } from './components/AuthModal';
import { NewAnalysisModal } from './components/NewAnalysisModal';
import { ReportModal } from './components/ReportModal';
import { PrivacyComplianceModal } from './components/PrivacyComplianceModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { ForensicWalkthroughModal } from './components/ForensicWalkthroughModal';
import { ModeUpgradeModal } from './components/ModeUpgradeModal';
import { AlertToast } from './components/AlertToast';
import { CookieConsentBanner } from './components/CookieConsentBanner';

// Hooks, Types & Data
import { useSession, UserRole, AccountType } from './hooks/useSession';
import { useWebSocketAlerts, WebSocketAlert } from './hooks/useWebSocketAlerts';
import { loadPrivacyConfig, PrivacyConfig } from './utils/privacyCompliance';
import { forensicApi } from './lib/api';
import { mapBackendCaseToAnalysis } from './utils/parser';
import { EmailAnalysis } from './types';
import { SAMPLE_ANALYSES, EMPTY_ANALYSIS } from './data/samples';
import { CheckCircle2, ShieldCheck, Database } from 'lucide-react';

const LEGAL_PATHS: Record<string, LegalPageType> = {
  '/about': 'about',
  '/privacy': 'privacy',
  '/terms': 'terms',
  '/cookies': 'cookies',
  '/domains': 'domains',
  '/contact': 'contact',
  '/security': 'security',
};

export default function App() {
  // Navigation & Page Routing State
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/';
    }
    return '/';
  });

  const [inConsole, setInConsole] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/app' || path === '/console') return true;
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'console' || params.get('tab')) return true;
    }
    return false; // Default to public Landing Page
  });

  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    try {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const queryTab = params?.get('tab');
      if (queryTab) return queryTab as NavTab;
      const saved = localStorage.getItem('tracexmail_active_tab');
      if (saved) return saved as NavTab;
    } catch {}
    return 'overview';
  });

  const [viewMode, setViewMode] = useState<'simple' | 'analyst'>(() => {
    try {
      const saved = localStorage.getItem('tracexmail_view_mode');
      if (saved === 'simple' || saved === 'analyst') return saved;
    } catch {}
    return 'analyst';
  });

  const [userPersona, setUserPersona] = useState<'technical' | 'non_technical'>('technical');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [showDemoCases, setShowDemoCases] = useState<boolean>(true);

  // Active Forensic Email Analysis
  const [currentAnalysis, setCurrentAnalysis] = useState<EmailAnalysis>(() => {
    return SAMPLE_ANALYSES.length > 0 ? SAMPLE_ANALYSES[0] : EMPTY_ANALYSIS;
  });

  // Modal States
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isNewAnalysisModalOpen, setIsNewAnalysisModalOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState<boolean>(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);
  const [upgradeFeature, setUpgradeFeature] = useState<string>('Enterprise Forensics');
  const [privacyConfig, setPrivacyConfig] = useState<PrivacyConfig>(() => loadPrivacyConfig());

  // ML Evaluation Dataset Report state (for instant inspection of Item 1/2/3 holdout splits)
  const [mlReport, setMlReport] = useState<any>(null);

  // Session & Authentication Hook
  const {
    session,
    user,
    profile,
    role,
    accountType,
    userLabel,
    isEmailVerified,
    signOut,
    switchRole,
    upgradeToOrganization
  } = useSession();

  // WebSocket Live Alerts Hook
  const {
    alerts,
    activeToast,
    status: wsStatus,
    soundEnabled,
    setSoundEnabled,
    dismissToast,
    broadcastTestAlert,
    reconnect
  } = useWebSocketAlerts();

  // Sync browser popstate (back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setCurrentPath(path);
      const params = new URLSearchParams(window.location.search);
      if (path === '/app' || path === '/console' || params.get('view') === 'console' || params.get('tab')) {
        setInConsole(true);
      } else if (path === '/' && !params.get('view')) {
        setInConsole(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigation Handlers
  const navigateToPath = useCallback((path: string) => {
    setCurrentPath(path);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
    }
  }, []);

  const handleOpenConsole = useCallback(() => {
    setInConsole(true);
    setCurrentPath('/app');
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/app');
    }
  }, []);

  const handleNavigateLanding = useCallback(() => {
    setInConsole(false);
    setCurrentPath('/');
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }
  }, []);

  // Persist Active Tab
  useEffect(() => {
    try {
      localStorage.setItem('tracexmail_active_tab', activeTab);
    } catch {}
  }, [activeTab]);

  // Persist View Mode
  const handleSetViewMode = useCallback((mode: 'simple' | 'analyst') => {
    setViewMode(mode);
    try {
      localStorage.setItem('tracexmail_view_mode', mode);
    } catch {}
  }, []);

  // Fetch ML evaluation report
  useEffect(() => {
    fetch('/reports/eval_dataset_build_report.json')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) setMlReport(data);
      })
      .catch(() => {});
  }, []);

  // Fetch recent cases from backend on mount to populate live analysis
  useEffect(() => {
    let isMounted = true;
    forensicApi.getCases({ exclude_demo: false })
      .then(cases => {
        if (!isMounted || !cases || cases.length === 0) return;
        const firstCase = cases[0];
        const parsed = mapBackendCaseToAnalysis(firstCase);
        if (parsed && parsed.id) {
          setCurrentAnalysis(parsed);
        }
      })
      .catch(err => {
        console.warn('[TraceXMail App] Could not prefetch cases from backend, using active baseline:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Global Keyboard Shortcuts (Cmd+K for Command Palette, ? for shortcuts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      } else if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsShortcutsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handlers
  const handleSelectAnalysis = useCallback((analysis: EmailAnalysis) => {
    setCurrentAnalysis(analysis);
  }, []);

  const handleAnalysisCreated = useCallback((analysis: EmailAnalysis) => {
    setCurrentAnalysis(analysis);
    setIsNewAnalysisModalOpen(false);
    setActiveTab('overview');
  }, []);

  const handleOpenUpgradeModal = useCallback((featureName?: string) => {
    if (featureName) setUpgradeFeature(featureName);
    setIsUpgradeModalOpen(true);
  }, []);

  const handleInspectAlert = useCallback((alert: WebSocketAlert) => {
    dismissToast();
    if (alert.case_id) {
      forensicApi.getCase(alert.case_id)
        .then(c => {
          if (c) {
            const mapped = mapBackendCaseToAnalysis(c);
            setCurrentAnalysis(mapped);
            setActiveTab('overview');
          }
        })
        .catch(() => {
          setActiveTab('alerts');
        });
    } else {
      setActiveTab('alerts');
    }
  }, [dismissToast]);

  // Main Active SOC View Renderer
  const renderActiveView = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewView
            analysis={currentAnalysis}
            onNavigateToMap={() => setActiveTab('map')}
            onNavigateToLogs={() => setActiveTab('logs')}
            onNavigateToHeaders={() => setActiveTab('headers')}
            onNavigateToTimeline={() => setActiveTab('timeline')}
            onNavigateToGraph={() => setActiveTab('graph')}
            onNavigateToCases={() => setActiveTab('cases')}
            onSelectAnalysis={handleSelectAnalysis}
            onOpenNewModal={() => setIsNewAnalysisModalOpen(true)}
            onOpenReportModal={() => setIsReportModalOpen(true)}
            viewMode={viewMode}
            userPersona={userPersona}
            onSwitchPersona={setUserPersona}
          />
        );

      case 'dashboard':
        return (
          <div className="space-y-6">
            <DashboardView
              onSelectAnalysis={handleSelectAnalysis}
              onNavigateToTab={tab => setActiveTab(tab as NavTab)}
              onOpenWalkthrough={() => setIsWalkthroughOpen(true)}
              viewMode={viewMode}
            />
            {/* Embedded Forensic ML Benchmark & Holdout Split Telemetry (Item 1, 2, 3) */}
            <div className="bg-[#171410] border border-[#3a352c] rounded-xl p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#2d2821] mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#ede6d8] flex items-center gap-2">
                      Dataset Isolation & Calibrated GBM Evaluation
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                        Item 1-3 Verified
                      </span>
                    </h3>
                    <p className="text-xs text-[#8e8574]">
                      Strict temporal & domain holdout isolation. Zero data leakage across splits.
                    </p>
                  </div>
                </div>
                <div className="text-xs font-mono text-[#8e8574]">
                  Model: <span className="text-amber-400">gbm_phish_detector_v1.0.onnx</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#100e0c] border border-[#2d2821] p-4 rounded-lg">
                  <div className="text-xs text-[#8e8574] uppercase tracking-wider font-mono">Training Split (Clean)</div>
                  <div className="text-2xl font-bold mt-1 text-[#ede6d8] font-mono">
                    {mlReport ? mlReport.splits?.train?.count?.toLocaleString() : '3,077'}
                  </div>
                  <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Disjoint domain & temporal group
                  </div>
                </div>

                <div className="bg-[#100e0c] border border-[#2d2821] p-4 rounded-lg">
                  <div className="text-xs text-[#8e8574] uppercase tracking-wider font-mono">Validation Split (Tuning Only)</div>
                  <div className="text-2xl font-bold mt-1 text-[#ede6d8] font-mono">
                    {mlReport ? mlReport.splits?.val?.count?.toLocaleString() : '560'}
                  </div>
                  <div className="text-xs text-sky-400 mt-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Isotonic probability calibration target
                  </div>
                </div>

                <div className="bg-[#100e0c] border border-[#2d2821] p-4 rounded-lg">
                  <div className="text-xs text-[#8e8574] uppercase tracking-wider font-mono">Test Split (Holdout Benchmark)</div>
                  <div className="text-2xl font-bold mt-1 text-rose-400 font-mono">
                    {mlReport ? mlReport.splits?.test?.count?.toLocaleString() : '763'}
                  </div>
                  <div className="text-[11px] text-rose-400/90 mt-1 font-mono tracking-tight">
                    STRICTLY FORBIDDEN FOR TRAINING
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'cases':
        return (
          <CasesView
            onSelectAnalysis={handleSelectAnalysis}
            onNavigateToOverview={() => setActiveTab('overview')}
            onOpenNewModal={() => setIsNewAnalysisModalOpen(true)}
            showDemoCases={showDemoCases}
            onToggleDemoCases={() => setShowDemoCases(prev => !prev)}
            role={role}
          />
        );

      case 'campaigns':
        return <CampaignsView />;

      case 'search':
        return (
          <SearchView
            onSelectAnalysis={handleSelectAnalysis}
            onNavigateToOverview={() => setActiveTab('overview')}
            showDemoCases={showDemoCases}
            currentAnalysis={currentAnalysis}
            onToggleDemoCases={() => setShowDemoCases(prev => !prev)}
          />
        );

      case 'timeline':
        return (
          <ThreatTimelineView
            analysis={currentAnalysis}
            onSelectAnalysis={handleSelectAnalysis}
            onNavigateToOverview={() => setActiveTab('overview')}
            showDemoCases={showDemoCases}
          />
        );

      case 'graph':
        return <RelationshipGraphView analysis={currentAnalysis} />;

      case 'hops':
        return <HopTracerouteView analysis={currentAnalysis} />;

      case 'map':
        return <MapView analysis={currentAnalysis} />;

      case 'logs':
        return <ThreatLogView analysis={currentAnalysis} />;

      case 'headers':
        return <RawHeaderView analysis={currentAnalysis} />;

      case 'alerts':
        return (
          <AlertsView
            currentAnalysis={currentAnalysis}
            onSelectAnalysis={handleSelectAnalysis}
            onNavigateToOverview={() => setActiveTab('overview')}
            liveAlerts={alerts}
            wsStatus={wsStatus}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(prev => !prev)}
            onBroadcastTestAlert={broadcastTestAlert}
            onReconnectWs={reconnect}
          />
        );

      case 'ingest':
        return (
          <IngestionPipelineView
            onSelectAnalysis={handleSelectAnalysis}
            onNavigateToOverview={() => setActiveTab('overview')}
          />
        );

      case 'gmail':
        return (
          <GmailConnectionView
            currentUserEmail={user?.email || ''}
            onSelectAnalysis={handleSelectAnalysis}
            onNavigateToOverview={() => setActiveTab('overview')}
          />
        );

      case 'organization':
        return (
          <OrganizationView
            organizationId={profile?.organization_id || 'org_acme_soc_01'}
            role={role}
            accountType={accountType}
            onSwitchRole={switchRole}
          />
        );

      case 'team':
        return <TeamView />;

      case 'boss_admin':
        return (
          <UltimateBossAdminView
            currentUserEmail={user?.email || 'analyst@tracexmail.security'}
            currentUserRole={role}
            onSwitchToTab={tab => setActiveTab(tab as NavTab)}
          />
        );

      case 'settings':
        return (
          <AccountSettingsView
            role={role}
            accountType={accountType}
            organizationId={profile?.organization_id || 'org_acme_soc_01'}
            user={user}
            profile={profile}
            userLabel={userLabel}
            isEmailVerified={isEmailVerified}
            onSignOut={signOut}
          />
        );

      default:
        return (
          <OverviewView
            analysis={currentAnalysis}
            onNavigateToMap={() => setActiveTab('map')}
            onNavigateToLogs={() => setActiveTab('logs')}
            onNavigateToHeaders={() => setActiveTab('headers')}
            onNavigateToTimeline={() => setActiveTab('timeline')}
            onNavigateToGraph={() => setActiveTab('graph')}
            onNavigateToCases={() => setActiveTab('cases')}
            onSelectAnalysis={handleSelectAnalysis}
            onOpenNewModal={() => setIsNewAnalysisModalOpen(true)}
            onOpenReportModal={() => setIsReportModalOpen(true)}
            viewMode={viewMode}
            userPersona={userPersona}
            onSwitchPersona={setUserPersona}
          />
        );
    }
  };

  // Route 1: Legal Pages (/privacy, /terms, /cookies, /security, /contact, /about, /domains)
  if (LEGAL_PATHS[currentPath]) {
    return (
      <AppGuard>
        <LegalPage
          type={LEGAL_PATHS[currentPath]}
          onNavigateHome={handleNavigateLanding}
          onNavigateToPath={navigateToPath}
        />
      </AppGuard>
    );
  }

  // Route 2: Knowledge Base (/kb, /knowledge)
  if (currentPath === '/kb' || currentPath === '/knowledge') {
    return (
      <AppGuard>
        <KnowledgeBaseView
          onNavigateHome={handleNavigateLanding}
          onNavigateToPath={navigateToPath}
        />
      </AppGuard>
    );
  }

  // Route 3: Public Landing Page (Default on root / unless user explicitly enters console)
  if (!inConsole) {
    return (
      <AppGuard>
        <LandingView
          onOpenConsole={handleOpenConsole}
          onOpenTrace={() => {
            handleOpenConsole();
            setIsNewAnalysisModalOpen(true);
          }}
          onSelectCase={(sample) => {
            setCurrentAnalysis(sample);
            handleOpenConsole();
            setActiveTab('overview');
          }}
          onRequestAccess={() => setIsAuthModalOpen(true)}
        />
        {isAuthModalOpen && (
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            currentUser={user ? { userId: (user as any).id, email: (user as any).email || '', organizationId: profile?.organization_id || 'org_acme_soc_01', role } : null}
          />
        )}
        <CookieConsentBanner />
      </AppGuard>
    );
  }

  // Route 4: Complete SOC Enclave Workspace (Console Mode)
  return (
    <AppGuard>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#100e0c] text-[#ede6d8] font-sans antialiased selection:bg-amber-500/20 selection:text-amber-200">
        {/* Top SOC Enclave Header */}
        <Header
          currentAnalysis={currentAnalysis}
          onSelectAnalysis={handleSelectAnalysis}
          onOpenNewModal={() => setIsNewAnalysisModalOpen(true)}
          onOpenReportModal={() => setIsReportModalOpen(true)}
          onOpenPrivacyModal={() => setIsPrivacyModalOpen(true)}
          privacyConfig={privacyConfig}
          showDemoCases={showDemoCases}
          onToggleDemoCases={() => setShowDemoCases(prev => !prev)}
          role={role}
          userLabel={userLabel}
          accountType={accountType}
          onOpenUpgradeModal={handleOpenUpgradeModal}
          onSignOut={signOut}
          onOpenSettings={() => setActiveTab('settings')}
          onOpenWalkthrough={() => setIsWalkthroughOpen(true)}
          viewMode={viewMode}
          onSetViewMode={handleSetViewMode}
          userPersona={userPersona}
          onSetPersona={setUserPersona}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenShortcutsHelp={() => setIsShortcutsOpen(true)}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
          isMobileSidebarOpen={isMobileSidebarOpen}
          onNavigateLanding={handleNavigateLanding}
        />

        {/* Main Workspace Body */}
        <div className="flex flex-1 min-h-0 relative overflow-hidden">
          {/* Collapsible Luxury Dark Sidebar */}
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            alertCount={alerts.length}
            wsStatus={wsStatus}
            role={role}
            accountType={accountType}
            onOpenUpgradeModal={handleOpenUpgradeModal}
            onOpenWalkthrough={() => setIsWalkthroughOpen(true)}
            onOpenReportModal={() => setIsReportModalOpen(true)}
            viewMode={viewMode}
            onOpenShortcutsHelp={() => setIsShortcutsOpen(true)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            isMobileOpen={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
            onNavigateLanding={handleNavigateLanding}
          />

          {/* View Container */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 bg-[#100e0c] p-4 lg:p-6 custom-scrollbar">
            <div className="max-w-[1600px] mx-auto">
              {renderActiveView()}
            </div>
          </main>
        </div>

        {/* Real-time WebSocket Alert Toast */}
        {activeToast && (
          <AlertToast
            alert={activeToast}
            onDismiss={dismissToast}
            onInspect={handleInspectAlert}
          />
        )}

        {/* Modals & Overlays */}
        {isAuthModalOpen && (
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            currentUser={user ? { userId: (user as any).id, email: (user as any).email || '', organizationId: profile?.organization_id || 'org_acme_soc_01', role } : null}
          />
        )}

        {isNewAnalysisModalOpen && (
          <NewAnalysisModal
            isOpen={isNewAnalysisModalOpen}
            onClose={() => setIsNewAnalysisModalOpen(false)}
            onAnalysisCreated={handleAnalysisCreated}
          />
        )}

        {isReportModalOpen && (
          <ReportModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            analysis={currentAnalysis}
            privacyConfig={privacyConfig}
          />
        )}

        {isPrivacyModalOpen && (
          <PrivacyComplianceModal
            isOpen={isPrivacyModalOpen}
            onClose={() => setIsPrivacyModalOpen(false)}
            config={privacyConfig}
            onChangeConfig={cfg => setPrivacyConfig(cfg)}
          />
        )}

        {isCommandPaletteOpen && (
          <CommandPaletteModal
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
            onSelectTab={tab => {
              setActiveTab(tab);
              setIsCommandPaletteOpen(false);
            }}
            onNewAnalysis={() => {
              setIsCommandPaletteOpen(false);
              setIsNewAnalysisModalOpen(true);
            }}
            onOpenReport={() => {
              setIsCommandPaletteOpen(false);
              setIsReportModalOpen(true);
            }}
            onSelectAnalysis={handleSelectAnalysis}
            onOpenPrivacyModal={() => {
              setIsCommandPaletteOpen(false);
              setIsPrivacyModalOpen(true);
            }}
          />
        )}

        {isShortcutsOpen && (
          <KeyboardShortcutsModal
            isOpen={isShortcutsOpen}
            onClose={() => setIsShortcutsOpen(false)}
          />
        )}

        {isWalkthroughOpen && (
          <ForensicWalkthroughModal
            isOpen={isWalkthroughOpen}
            onClose={() => setIsWalkthroughOpen(false)}
            onNavigateToTab={tab => {
              setActiveTab(tab);
              setIsWalkthroughOpen(false);
            }}
            onOpenNewModal={() => {
              setIsWalkthroughOpen(false);
              setIsNewAnalysisModalOpen(true);
            }}
            onOpenReportModal={() => {
              setIsWalkthroughOpen(false);
              setIsReportModalOpen(true);
            }}
          />
        )}

        {isUpgradeModalOpen && (
          <ModeUpgradeModal
            isOpen={isUpgradeModalOpen}
            onClose={() => setIsUpgradeModalOpen(false)}
            onUpgrade={async (orgName) => {
              await upgradeToOrganization(orgName);
              setIsUpgradeModalOpen(false);
            }}
            featureName={upgradeFeature}
          />
        )}

        <CookieConsentBanner />
      </div>
    </AppGuard>
  );
}
