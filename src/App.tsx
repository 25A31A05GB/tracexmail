import React, { useState, useEffect } from 'react';
import { LegalPage } from './components/LegalPage';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { LandingView } from './components/LandingView';
import { DashboardView } from './components/DashboardView';
import { CasesView } from './components/CasesView';
import { CampaignsView } from './components/CampaignsView';
import { SearchView } from './components/SearchView';
import { OverviewView } from './components/OverviewView';
import { ThreatTimelineView } from './components/ThreatTimelineView';
import { RelationshipGraphView } from './components/RelationshipGraphView';
import { HopTracerouteView } from './components/HopTracerouteView';
import { MapView } from './components/MapView';
import { ThreatLogView } from './components/ThreatLogView';
import { RawHeaderView } from './components/RawHeaderView';
import { AlertsView } from './components/AlertsView';
import { IngestionPipelineView } from './components/IngestionPipelineView';
import { OrganizationView } from './components/OrganizationView';
import { TeamView } from './components/TeamView';
import { NewAnalysisModal } from './components/NewAnalysisModal';
import { ReportModal } from './components/ReportModal';
import { PrivacyComplianceModal } from './components/PrivacyComplianceModal';
import { ForensicWalkthroughModal } from './components/ForensicWalkthroughModal';
import { InvestigationObjectiveModal, ObjectiveSelection } from './components/InvestigationObjectiveModal';
import { AlertToast } from './components/AlertToast';
import { LoginView } from './components/LoginView';
import { SignupView } from './components/SignupView';
import { SAMPLE_ANALYSES } from './data/samples';
import { EmailAnalysis } from './types';
import { useWebSocketAlerts, WebSocketAlert } from './hooks/useWebSocketAlerts';
import { PrivacyConfig, loadPrivacyConfig, savePrivacyConfig } from './utils/privacyCompliance';
import { useSession } from './hooks/useSession';
import { Loader2 } from 'lucide-react';
import { OAuthConsentScreen } from './components/OAuthConsentScreen';
import { forensicApi } from './lib/api';
import { mapBackendCaseToAnalysis } from './utils/parser';
import { supabase, isSupabaseConfigured } from './lib/supabase';

export default function App() {
  const publicPath = window.location.pathname;

  if (publicPath === '/privacy') {
    return <LegalPage type="privacy" />;
  }

  if (publicPath === '/terms') {
    return <LegalPage type="terms" />;
  }

  if (publicPath === '/oauth/consent' || publicPath === '/oauth/authorize') {
    return <OAuthConsentScreen />;
  }

  // Real Supabase Auth & RBAC hook
  const { 
    session, 
    profile, 
    role, 
    organizationId, 
    loading: authLoading, 
    signOut, 
    loginAsRole, 
    switchRole 
  } = useSession();

  const [authView, setAuthView] = useState<'intro' | 'login' | 'signup'>('intro');
  const [currentAnalysis, setCurrentAnalysis] = useState<EmailAnalysis>(SAMPLE_ANALYSES[0]);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Track session transition to automatically redirect to Email Ingestion tab upon confirmed login
  const prevSessionUserIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    const currentUserId = session?.user?.id || null;
    if (currentUserId && prevSessionUserIdRef.current !== currentUserId) {
      setActiveTab('ingest');
    }
    prevSessionUserIdRef.current = currentUserId;
  }, [session?.user?.id]);

  // Load real persisted case from Supabase to replace hardcoded sample initial state
  useEffect(() => {
    if (!session) return;
    let isMounted = true;

    async function fetchLatestSupabaseCase() {
      try {
        if (isSupabaseConfigured) {
          const { data, error } = await supabase
            .from('cases')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);

          if (!error && data && data.length > 0 && isMounted) {
            const mapped = mapBackendCaseToAnalysis(data[0]);
            setCurrentAnalysis(mapped);
          }
        }
      } catch (err) {
        console.debug('[App] Supabase case sync fallback:', err);
      }
    }

    fetchLatestSupabaseCase();

    // Supabase Realtime channel subscription for instant case synchronization
    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('realtime_cases_feed')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cases' }, (payload) => {
          if (payload.new && isMounted) {
            console.log('[Supabase Realtime] New forensic case inserted:', payload.new);
            setCasesRefreshSignal(prev => prev + 1);
          }
        })
        .subscribe();

      return () => {
        isMounted = false;
        supabase.removeChannel(channel);
      };
    }

    return () => {
      isMounted = false;
    };
  }, [session]);
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState<boolean>(false);
  const [isObjectiveModalOpen, setIsObjectiveModalOpen] = useState<boolean>(false);
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState<boolean>(false);

  const handleApplyObjective = (selection: ObjectiveSelection) => {
    // 1. Switch Role
    if (selection.recommendedRole && switchRole) {
      switchRole(selection.recommendedRole);
    }
    // 2. Set Active Tab
    setActiveTab(selection.defaultTab);
    // 3. Configure Privacy Masking if required
    if (selection.privacyMasking) {
      const updatedCfg = { ...privacyConfig, maskingEnabled: true };
      setPrivacyConfig(updatedCfg);
      savePrivacyConfig(updatedCfg);
    }
  };
  const [privacyConfig, setPrivacyConfig] = useState<PrivacyConfig>(() => loadPrivacyConfig());
  const [casesRefreshSignal, setCasesRefreshSignal] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'simple' | 'analyst'>(() => {
    try {
      return (localStorage.getItem('tracexmail_view_mode') as 'simple' | 'analyst') || 'simple';
    } catch {
      return 'simple';
    }
  });

  const handleToggleViewMode = (mode: 'simple' | 'analyst') => {
    setViewMode(mode);
    try {
      localStorage.setItem('tracexmail_view_mode', mode);
    } catch {}
  };

  const [showDemoCases, setShowDemoCases] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tracexmail_show_demo_cases') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleDemoCases = () => {
    setShowDemoCases(prev => {
      const next = !prev;
      try {
        localStorage.setItem('tracexmail_show_demo_cases', String(next));
      } catch {}
      return next;
    });
  };

  const handleUpdatePrivacyConfig = (newCfg: PrivacyConfig) => {
    setPrivacyConfig(newCfg);
    savePrivacyConfig(newCfg);
  };

  // Real-Time WebSockets Alerting Hook - only active if session is present
  const {
    alerts: liveAlerts,
    activeToast,
    status: wsStatus,
    unreadCount,
    soundEnabled,
    setSoundEnabled,
    dismissToast,
    broadcastTestAlert,
    reconnect: reconnectWs
  } = useWebSocketAlerts();

  const handleAnalysisCreated = (newAnalysis: EmailAnalysis) => {
    console.log('📥 [App.tsx] handleAnalysisCreated received new analysis:', {
      id: newAnalysis?.id,
      subject: newAnalysis?.subject || newAnalysis?.headers?.subject,
      threatScore: newAnalysis?.threatScore ?? newAnalysis?.riskScore,
      from: newAnalysis?.headers?.from,
      fullObject: newAnalysis
    });
    setCurrentAnalysis(newAnalysis);
    setActiveTab('overview');
    setCasesRefreshSignal(prev => prev + 1);
  };

  const handleToastInspect = async (alert: WebSocketAlert) => {
    if (alert.case_id) {
      const matchingSample = SAMPLE_ANALYSES.find(s => s.id === alert.case_id);
      if (matchingSample) {
        setCurrentAnalysis(matchingSample);
        setActiveTab('overview');
        return;
      }
      try {
        const fetchedCase = await forensicApi.getCase(alert.case_id);
        if (fetchedCase) {
          const mapped = mapBackendCaseToAnalysis(fetchedCase);
          setCurrentAnalysis(mapped);
          setActiveTab('overview');
          return;
        }
      } catch (err) {
        console.warn('Could not fetch specific case from backend, opening cases list:', err);
      }
    }
    // If it's a general Gmail sync completion without a specific case or fallback
    if (alert.category === 'GMAIL_SYNC') {
      setActiveTab('cases');
      setCasesRefreshSignal(prev => prev + 1);
      return;
    }
    setCurrentAnalysis(SAMPLE_ANALYSES[0]);
    setActiveTab('overview');
  };

  // Calculate user initials for the avatar badge
  const userInitials = React.useMemo(() => {
    if (profile?.full_name) {
      const parts = profile.full_name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return parts[0].substring(0, 2).toUpperCase();
    }
    if (session?.user?.email) {
      const name = session.user.email.split('@')[0];
      return name.substring(0, 2).toUpperCase();
    }
    return role === 'admin' ? 'AD' : role === 'read_only' ? 'AU' : 'AN';
  }, [profile, session, role]);

  // If Supabase authentication check is in-flight
  if (authLoading) {
    return (
      <div className="min-h-screen w-screen bg-[#0b0d12] flex flex-col items-center justify-center text-[#e7ebf1] font-sans">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[#5b8dd6]" />
          <span className="font-mono text-xs tracking-wider text-[#7d8794]">
            VERIFYING ENCLAVE CLEARANCE…
          </span>
        </div>
      </div>
    );
  }

  // If user is unauthenticated: First show our Intro Page, then click opens Login / Request Access, and once verified gives role-based access
  if (!session) {
    if (authView === 'login') {
      return (
        <LoginView
          onBackToIntro={() => setAuthView('intro')}
          onRequestAccess={() => setAuthView('signup')}
          onSelectRoleLogin={(selectedRole, options) => {
            setActiveTab('ingest');
            loginAsRole(selectedRole, options);
          }}
          onSuccess={() => {
            setActiveTab('ingest');
            setAuthView('intro');
          }}
        />
      );
    }
    if (authView === 'signup') {
      return (
        <SignupView
          onBackToLogin={() => setAuthView('login')}
          onBackToIntro={() => setAuthView('intro')}
          onSelectRoleLogin={(selectedRole, options) => {
            setActiveTab('ingest');
            loginAsRole(selectedRole, options);
          }}
          onSuccess={() => {
            setActiveTab('ingest');
            setAuthView('intro');
          }}
        />
      );
    }
    // Default intro page for visitors
    return (
      <LandingView
        onOpenConsole={() => setAuthView('login')}
        onOpenTrace={() => {
          setCurrentAnalysis(SAMPLE_ANALYSES[0]);
          setAuthView('login');
        }}
        onRequestAccess={() => setAuthView('signup')}
        onSelectCase={(sample) => {
          setCurrentAnalysis(sample);
          setAuthView('login');
        }}
      />
    );
  }

  // Ensure non-admins cannot access admin tabs
  const effectiveTab = (activeTab === 'organization' || activeTab === 'team') && role !== 'admin'
    ? 'dashboard'
    : activeTab;

  return (
    <div className="flex h-screen w-screen bg-[#0b0d12] text-[#e7ebf1] overflow-hidden font-sans select-text">
      {/* Sidebar with role-differentiated navigation */}
      <Sidebar
        activeTab={effectiveTab}
        setActiveTab={setActiveTab}
        alertCount={unreadCount}
        wsStatus={wsStatus}
        role={role}
        onOpenWalkthrough={() => setIsObjectiveModalOpen(true)}
        viewMode={viewMode}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full bg-[#0b0d12] min-w-0 overflow-hidden">
        {/* Top Header with clearance badge, avatar, role switcher, and sign-out */}
        <Header
          currentAnalysis={currentAnalysis}
          onSelectAnalysis={setCurrentAnalysis}
          onOpenNewModal={() => setIsNewModalOpen(true)}
          onOpenReportModal={() => setIsReportModalOpen(true)}
          onOpenPrivacyModal={() => setIsPrivacyModalOpen(true)}
          onOpenWalkthrough={() => setIsObjectiveModalOpen(true)}
          privacyConfig={privacyConfig}
          showDemoCases={showDemoCases}
          onToggleDemoCases={handleToggleDemoCases}
          role={role}
          userLabel={userInitials}
          onSignOut={signOut}
          onSwitchRole={switchRole}
          viewMode={viewMode}
          onSetViewMode={handleToggleViewMode}
        />

        {/* View Switcher Container */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {effectiveTab === 'dashboard' && (
            <DashboardView
              onSelectAnalysis={setCurrentAnalysis}
              onNavigateToTab={setActiveTab}
              onOpenWalkthrough={() => setIsWalkthroughOpen(true)}
              viewMode={viewMode}
            />
          )}

          {effectiveTab === 'cases' && (
            <CasesView
              onSelectAnalysis={setCurrentAnalysis}
              onNavigateToOverview={() => setActiveTab('overview')}
              onOpenNewModal={() => setIsNewModalOpen(true)}
              refreshSignal={casesRefreshSignal}
              showDemoCases={showDemoCases}
              onToggleDemoCases={handleToggleDemoCases}
              role={role}
            />
          )}

          {effectiveTab === 'campaigns' && (
            <CampaignsView />
          )}

          {effectiveTab === 'search' && (
            <SearchView
              onSelectAnalysis={setCurrentAnalysis}
              onNavigateToOverview={() => setActiveTab('overview')}
              showDemoCases={showDemoCases}
              currentAnalysis={currentAnalysis}
              onToggleDemoCases={handleToggleDemoCases}
            />
          )}

          {effectiveTab === 'overview' && (
            <OverviewView
              analysis={currentAnalysis}
              onNavigateToMap={() => setActiveTab('map')}
              onNavigateToLogs={() => setActiveTab('logs')}
              onNavigateToHeaders={() => setActiveTab('headers')}
              onNavigateToTimeline={() => setActiveTab('timeline')}
              onNavigateToGraph={() => setActiveTab('graph')}
              onOpenNewModal={() => setIsNewModalOpen(true)}
              onOpenReportModal={() => setIsReportModalOpen(true)}
              viewMode={viewMode}
            />
          )}

          {effectiveTab === 'graph' && (
            <div className="flex-1 p-6 overflow-hidden flex flex-col h-full bg-[#0b0d12]">
              <RelationshipGraphView
                analysis={currentAnalysis}
                caseId={currentAnalysis?.id}
              />
            </div>
          )}

          {effectiveTab === 'timeline' && (
            <ThreatTimelineView
              analysis={currentAnalysis}
              onSelectAnalysis={setCurrentAnalysis}
              onNavigateToOverview={() => setActiveTab('overview')}
              showDemoCases={showDemoCases}
            />
          )}

          {effectiveTab === 'ingest' && (
            <IngestionPipelineView
              onSelectAnalysis={handleAnalysisCreated}
              onNavigateToOverview={() => setActiveTab('overview')}
            />
          )}

          {effectiveTab === 'hops' && (
            <HopTracerouteView analysis={currentAnalysis} />
          )}

          {effectiveTab === 'map' && (
            <MapView analysis={currentAnalysis} />
          )}

          {effectiveTab === 'logs' && (
            <ThreatLogView analysis={currentAnalysis} />
          )}

          {effectiveTab === 'headers' && (
            <RawHeaderView analysis={currentAnalysis} />
          )}

          {effectiveTab === 'alerts' && (
            <AlertsView
              currentAnalysis={currentAnalysis}
              onSelectAnalysis={setCurrentAnalysis}
              onNavigateToOverview={() => setActiveTab('overview')}
              liveAlerts={liveAlerts}
              wsStatus={wsStatus}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled(!soundEnabled)}
              onBroadcastTestAlert={broadcastTestAlert}
              onReconnectWs={reconnectWs}
            />
          )}

          {effectiveTab === 'organization' && role === 'admin' && (
            <OrganizationView organizationId={organizationId || 'org_acme_soc_01'} />
          )}

          {effectiveTab === 'team' && role === 'admin' && (
            <TeamView />
          )}
        </div>
      </main>

      {/* Real-time WebSocket Alert Toast */}
      <AlertToast
        alert={activeToast}
        onDismiss={dismissToast}
        onInspect={handleToastInspect}
      />

      {/* Modal for Raw Email Analysis & Ingestion */}
      {isNewModalOpen && (
        <NewAnalysisModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onAnalysisCreated={handleAnalysisCreated}
        />
      )}

      {/* Forensic Report Modal */}
      {isReportModalOpen && (
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          analysis={currentAnalysis}
          privacyConfig={privacyConfig}
        />
      )}

      {/* Privacy, Legal & Compliance Safeguards Modal */}
      {isPrivacyModalOpen && (
        <PrivacyComplianceModal
          isOpen={isPrivacyModalOpen}
          onClose={() => setIsPrivacyModalOpen(false)}
          config={privacyConfig}
          onChangeConfig={handleUpdatePrivacyConfig}
          currentDate={currentAnalysis?.date}
        />
      )}

      {/* Interactive Workspace Objective Setup Questionnaire */}
      {isObjectiveModalOpen && (
        <InvestigationObjectiveModal
          isOpen={isObjectiveModalOpen}
          onClose={() => setIsObjectiveModalOpen(false)}
          onApplyObjective={handleApplyObjective}
          currentRole={role}
        />
      )}

      {/* Interactive Get Started Forensic Walkthrough Overlay */}
      {isWalkthroughOpen && (
        <ForensicWalkthroughModal
          isOpen={isWalkthroughOpen}
          onClose={() => setIsWalkthroughOpen(false)}
          onNavigateToTab={(tab) => {
            setActiveTab(tab);
            setIsWalkthroughOpen(false);
          }}
          onOpenNewModal={() => {
            setIsNewModalOpen(true);
            setIsWalkthroughOpen(false);
          }}
          onOpenReportModal={() => {
            setIsReportModalOpen(true);
            setIsWalkthroughOpen(false);
          }}
          onOpenPrivacyModal={() => {
            setIsPrivacyModalOpen(true);
            setIsWalkthroughOpen(false);
          }}
          onSelectAnalysis={(analysis) => {
            setCurrentAnalysis(analysis);
          }}
        />
      )}
    </div>
  );
}
