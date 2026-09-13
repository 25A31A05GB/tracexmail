import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { LandingView } from './components/LandingView';
import { OverviewView } from './components/OverviewView';
import { ThreatTimelineView } from './components/ThreatTimelineView';
import { HopTracerouteView } from './components/HopTracerouteView';
import { ThreatLogView } from './components/ThreatLogView';
import { RawHeaderView } from './components/RawHeaderView';
import { OrganizationView } from './components/OrganizationView';
import { TeamView } from './components/TeamView';
import { AccountSettingsView } from './components/AccountSettingsView';
import { AlertToast } from './components/AlertToast';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { SAMPLE_ANALYSES } from './data/samples';
import { EmailAnalysis } from './types';
import { useWebSocketAlerts, WebSocketAlert } from './hooks/useWebSocketAlerts';
import { PrivacyConfig, loadPrivacyConfig, savePrivacyConfig } from './utils/privacyCompliance';
import { useSession } from './hooks/useSession';
import { Loader2, MailCheck, ShieldAlert, RefreshCw, LogOut, ArrowRight, Sparkles } from 'lucide-react';
import { forensicApi } from './lib/api';
import { mapBackendCaseToAnalysis } from './utils/parser';
import { supabase, isSupabaseConfigured, getIsSupabaseConfigured } from './lib/supabase';
import type { ObjectiveSelection } from './components/InvestigationObjectiveModal';

const DashboardView = lazy(() => import('./components/DashboardView').then(m => ({ default: m.DashboardView })));
const CasesView = lazy(() => import('./components/CasesView').then(m => ({ default: m.CasesView })));
const CampaignsView = lazy(() => import('./components/CampaignsView').then(m => ({ default: m.CampaignsView })));
const SearchView = lazy(() => import('./components/SearchView').then(m => ({ default: m.SearchView })));
const RelationshipGraphView = lazy(() => import('./components/RelationshipGraphView').then(m => ({ default: m.RelationshipGraphView })));
const MapView = lazy(() => import('./components/MapView').then(m => ({ default: m.MapView })));
const AlertsView = lazy(() => import('./components/AlertsView').then(m => ({ default: m.AlertsView })));
const IngestionPipelineView = lazy(() => import('./components/IngestionPipelineView').then(m => ({ default: m.IngestionPipelineView })));
const GmailConnectionView = lazy(() => import('./components/GmailConnectionView').then(m => ({ default: m.GmailConnectionView })));

// Code-split modals and non-critical dialogs
const ModeUpgradeModal = lazy(() => import('./components/ModeUpgradeModal').then(m => ({ default: m.ModeUpgradeModal })));
const NewAnalysisModal = lazy(() => import('./components/NewAnalysisModal').then(m => ({ default: m.NewAnalysisModal })));
const ReportModal = lazy(() => import('./components/ReportModal').then(m => ({ default: m.ReportModal })));
const PrivacyComplianceModal = lazy(() => import('./components/PrivacyComplianceModal').then(m => ({ default: m.PrivacyComplianceModal })));
const ForensicWalkthroughModal = lazy(() => import('./components/ForensicWalkthroughModal').then(m => ({ default: m.ForensicWalkthroughModal })));
const InvestigationObjectiveModal = lazy(() => import('./components/InvestigationObjectiveModal').then(m => ({ default: m.InvestigationObjectiveModal })));
const CommandPaletteModal = lazy(() => import('./components/CommandPaletteModal').then(m => ({ default: m.CommandPaletteModal })));
const KeyboardShortcutsModal = lazy(() => import('./components/KeyboardShortcutsModal').then(m => ({ default: m.KeyboardShortcutsModal })));

// Code-split authentication flows
const LoginView = lazy(() => import('./components/LoginView').then(m => ({ default: m.LoginView })));
const SignupView = lazy(() => import('./components/SignupView').then(m => ({ default: m.SignupView })));
const ForgotPasswordView = lazy(() => import('./components/ForgotPasswordView').then(m => ({ default: m.ForgotPasswordView })));
const ResetPasswordView = lazy(() => import('./components/ResetPasswordView').then(m => ({ default: m.ResetPasswordView })));
const AcceptInviteView = lazy(() => import('./components/AcceptInviteView').then(m => ({ default: m.AcceptInviteView })));
const MagicLinkVerifyView = lazy(() => import('./components/MagicLinkVerifyView').then(m => ({ default: m.MagicLinkVerifyView })));
const OAuthConsentScreen = lazy(() => import('./components/OAuthConsentScreen').then(m => ({ default: m.OAuthConsentScreen })));

function ViewSuspenseLoader() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0b0d12] text-[#8a8070] min-h-[350px]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--stamp)]" />
        <span className="text-xs font-mono uppercase tracking-widest text-[#b9af9c]">Loading forensic module...</span>
      </div>
    </div>
  );
}

export default function App() {
  const publicPath = (window.location.pathname || '').toLowerCase().replace(/\/+$/, '') || '/';

  if (publicPath === '/oauth/consent' || publicPath === '/oauth/authorize') {
    return (
      <Suspense fallback={<ViewSuspenseLoader />}>
        <OAuthConsentScreen />
      </Suspense>
    );
  }

  // Real Supabase Auth, RBAC, and Account Tiers hook
  const { 
    session, 
    user,
    profile, 
    role, 
    accountType,
    isEmailVerified,
    organizationId, 
    loading: authLoading, 
    signOut, 
    revokeAllOtherSessions,
    loginAsRole, 
    switchRole,
    upgradeToOrganization,
    switchAccountType 
  } = useSession();

  const [authView, setAuthView] = useState<'intro' | 'login' | 'signup' | 'forgot-password' | 'reset-password' | 'accept-invite' | 'magic-link'>('intro');
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  // Auto-detect invitation tokens, password resets, magic links, or recovery tokens in URL
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || '';
      const search = window.location.search || '';

      const searchParams = new URLSearchParams(search);
      const hashQuery = hash.replace(/^#\/?/, '').replace(/^reset-password\??/, '').replace(/^magic-link\??/, '');
      const hashParams = new URLSearchParams(hashQuery);

      const code = searchParams.get('code') || hashParams.get('code');
      const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
      const type = searchParams.get('type') || hashParams.get('type');
      const token = searchParams.get('token') || hashParams.get('token') || searchParams.get('magic_token') || hashParams.get('magic_token');

      const isRecovery = type === 'recovery' || 
                         hash.includes('type=recovery') || 
                         search.includes('type=recovery') || 
                         hash.startsWith('#reset-password') || 
                         hash.includes('reset-password');

      if (hash.startsWith('#invite=')) {
        const invite = hash.replace('#invite=', '').trim();
        if (invite) {
          setInviteToken(invite);
          setAuthView('accept-invite');
        }
      } else if (isRecovery) {
        setAuthView('reset-password');
      } else if (
        code || 
        accessToken || 
        hash.startsWith('#magic-link') || 
        hash.includes('magic_token') || 
        search.includes('magic_token') || 
        (token && token.startsWith('mlk_')) ||
        (search.includes('token=') && !hash.startsWith('#reset-password'))
      ) {
        setAuthView('magic-link');
      } else if (hash.startsWith('#forgot-password')) {
        setAuthView('forgot-password');
      } else if (hash.startsWith('#login')) {
        setAuthView('login');
      } else if (hash.startsWith('#signup')) {
        setAuthView('signup');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    // Supabase Auth State listener for real-time magic link verification & password recovery
    let authSub: any = null;
    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (event === 'PASSWORD_RECOVERY') {
          setAuthView('reset-password');
        } else if (event === 'SIGNED_IN' && newSession) {
          if (typeof window !== 'undefined' && (window.location.search.includes('code=') || window.location.hash.includes('access_token='))) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          setActiveTab('ingest');
          setAuthView('intro');
        }
      });
      authSub = subscription;
    }

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      if (authSub) authSub.unsubscribe();
    };
  }, []);
  const [currentAnalysis, setCurrentAnalysis] = useState<EmailAnalysis>(SAMPLE_ANALYSES[0]);
  const [activeTab, setActiveTab] = useState<NavTab>('ingest');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);
  const [upgradeTargetFeature, setUpgradeTargetFeature] = useState<string>('Enterprise SOC Suite');
  const [verificationChecking, setVerificationChecking] = useState<boolean>(false);
  const [verificationResent, setVerificationResent] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  const handleOpenUpgradeModal = (featureName?: string) => {
    if (featureName) setUpgradeTargetFeature(featureName);
    setIsUpgradeModalOpen(true);
  };

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
    if (getIsSupabaseConfigured() && supabase) {
      try {
        const channel = supabase
          .channel('realtime_cases_feed')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cases' }, (payload) => {
            if (payload.new && isMounted) {
              setCasesRefreshSignal(prev => prev + 1);
            }
          })
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              supabase.removeChannel(channel);
            }
          });

        return () => {
          isMounted = false;
          supabase.removeChannel(channel);
        };
      } catch {
        // ignore
      }
    }

    return () => {
      isMounted = false;
    };
  }, [session]);
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

  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState<boolean>(false);
  const [isObjectiveModalOpen, setIsObjectiveModalOpen] = useState<boolean>(false);
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState<boolean>(false);

  // Global Keyboard Shortcuts (Cmd+K for search, Cmd+N for new analysis, Cmd+E for report, 1-9 for tabs, ? for help)
  useKeyboardShortcuts({
    onOpenCommandPalette: () => setIsCommandPaletteOpen(prev => !prev),
    onNewAnalysis: () => setIsNewModalOpen(true),
    onOpenReport: () => setIsReportModalOpen(true),
    onOpenPrivacyModal: () => setIsPrivacyModalOpen(true),
    onOpenWalkthrough: () => setIsObjectiveModalOpen(true),
    onToggleViewMode: () => handleToggleViewMode(viewMode === 'simple' ? 'analyst' : 'simple'),
    onToggleDemoCases: handleToggleDemoCases,
    onOpenShortcutsHelp: () => setIsShortcutsHelpOpen(prev => !prev),
    onSelectTab: (tab) => setActiveTab(tab),
    onCloseModals: () => {
      setIsCommandPaletteOpen(false);
      setIsShortcutsHelpOpen(false);
      setIsNewModalOpen(false);
      setIsReportModalOpen(false);
      setIsPrivacyModalOpen(false);
      setIsObjectiveModalOpen(false);
      setIsWalkthroughOpen(false);
      setIsUpgradeModalOpen(false);
    },
    enabled: true
  });

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
    return (
      <Suspense fallback={<ViewSuspenseLoader />}>
        {authView === 'login' && (
          <LoginView
            onBackToIntro={() => setAuthView('intro')}
            onRequestAccess={() => setAuthView('signup')}
            onForgotPassword={() => setAuthView('forgot-password')}
            onSelectRoleLogin={(selectedRole, options) => {
              setActiveTab('ingest');
              loginAsRole(selectedRole, options);
            }}
            onSuccess={() => {
              setActiveTab('ingest');
              setAuthView('intro');
            }}
          />
        )}
        {authView === 'signup' && (
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
        )}
        {authView === 'forgot-password' && (
          <ForgotPasswordView
            onBackToLogin={() => setAuthView('login')}
            onBackToIntro={() => setAuthView('intro')}
            onSuccess={() => {
              setActiveTab('ingest');
              setAuthView('intro');
            }}
          />
        )}
        {authView === 'reset-password' && (
          <ResetPasswordView
            onRequestResetLink={() => {
              setAuthView('forgot-password');
              window.location.hash = '#forgot-password';
            }}
            onSuccess={() => {
              setActiveTab('ingest');
              setAuthView('intro');
              window.location.hash = '';
            }}
            onBackToLogin={() => {
              setAuthView('login');
              window.location.hash = '';
            }}
            onSelectRoleLogin={(selectedRole, options) => {
              setActiveTab('ingest');
              loginAsRole(selectedRole, options);
              window.location.hash = '';
            }}
          />
        )}
        {authView === 'accept-invite' && (
          <AcceptInviteView
            token={inviteToken || ''}
            onSuccess={(userData) => {
              if (userData.token && userData.user) {
                loginAsRole(userData.user.role || 'analyst', {
                  token: userData.token,
                  userId: userData.user.id,
                  email: userData.user.email,
                  fullName: userData.user.fullName,
                  orgName: userData.user.orgName,
                  accountType: userData.user.accountType || 'organization',
                  isEmailVerified: true
                });
              }
              setActiveTab('ingest');
              setAuthView('intro');
              window.location.hash = '';
            }}
            onBackToLogin={() => {
              setAuthView('login');
              window.location.hash = '';
            }}
          />
        )}
        {authView === 'magic-link' && (
          <MagicLinkVerifyView
            onBackToLogin={() => {
              setAuthView('login');
              window.location.hash = '';
            }}
            onBackToIntro={() => {
              setAuthView('intro');
              window.location.hash = '';
            }}
            onRequestNewLink={() => {
              setAuthView('login');
              window.location.hash = '';
            }}
            onSelectRoleLogin={(selectedRole, options) => {
              setActiveTab('ingest');
              loginAsRole(selectedRole, options);
              setAuthView('intro');
              window.location.hash = '';
            }}
            onSuccess={() => {
              setActiveTab('ingest');
              setAuthView('intro');
              window.location.hash = '';
            }}
          />
        )}
        {authView === 'intro' && (
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
        )}
      </Suspense>
    );
  }

  // Strict Login Check: Email verification barrier
  if (session && !isEmailVerified) {
    const userEmail = session.user?.email || 'your account email';
    return (
      <div className="min-h-screen w-screen bg-[#0b0d12] flex flex-col items-center justify-center p-4 text-[#e7ebf1] font-sans select-text">
        <div className="w-full max-w-md bg-[#16130f] border border-[#3a352c] rounded-[2px] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.8)] space-y-5 text-center">
          <div className="w-12 h-12 rounded-full bg-[rgba(201,162,39,0.15)] border border-[var(--stamp)] text-[var(--stamp)] flex items-center justify-center mx-auto">
            <MailCheck className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <h2 className="font-display font-bold text-xl text-[#ede6d8]">
              Verify Your Email Address
            </h2>
            <p className="text-xs text-[#b9af9c] leading-relaxed">
              A cryptographic verification confirmation was sent to <span className="font-mono text-[var(--stamp)] font-semibold">{userEmail}</span>. Please verify your email to unlock your forensic workspace.
            </p>
          </div>

          <div className="p-3 rounded-[2px] bg-[#1a1712] border border-[#2c271f] text-left text-xs space-y-1 text-[#8a8070]">
            <div className="flex items-center gap-1.5 text-[var(--stamp)] font-semibold text-[11px]">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Cryptographic Enclave Mandate</span>
            </div>
            <p className="text-[10.5px]">
              Email confirmation ensures that forensic audit logs, chain-of-custody tokens, and team investigations are attributed to verified analysts.
            </p>
          </div>

          {verificationResent && (
            <div className="p-2 rounded-[2px] bg-emerald-950/40 border border-emerald-800 text-emerald-400 text-xs font-mono">
              Verification email resent! Please check your inbox and spam folder.
            </div>
          )}

          <div className="space-y-2 pt-2">
            <button
              onClick={async () => {
                setVerificationChecking(true);
                try {
                  if (isSupabaseConfigured) {
                    const { data } = await supabase.auth.getUser();
                    if (data?.user?.email_confirmed_at) {
                      window.location.reload();
                    } else {
                      alert('Email is not verified yet. Please click the link in your email or try Resend.');
                    }
                  } else {
                    window.location.reload();
                  }
                } catch (e) {
                  console.error(e);
                } finally {
                  setVerificationChecking(false);
                }
              }}
              disabled={verificationChecking}
              className="w-full btn-primary py-2 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              {verificationChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Check Verification Status</span>
            </button>

            <button
              onClick={async () => {
                try {
                  if (session.user?.email && isSupabaseConfigured) {
                    await supabase.auth.signInWithOtp({
                      email: session.user.email,
                      options: {
                        emailRedirectTo: window.location.origin
                      }
                    });
                    await supabase.auth.resend({ type: 'signup', email: session.user.email, options: { emailRedirectTo: window.location.origin } });
                    setVerificationResent(true);
                  }
                } catch (e) {
                  console.error(e);
                }
              }}
              className="w-full btn-secondary py-2 text-xs cursor-pointer text-[#ede6d8]"
            >
              Resend Verification Email
            </button>

            <button
              onClick={() => signOut()}
              className="w-full text-xs text-[#8a8070] hover:text-[#b23a2e] py-1 transition-colors cursor-pointer bg-transparent border-0 flex items-center justify-center gap-1 mt-2"
            >
              <LogOut className="w-3 h-3" />
              <span>Sign out / Return to Login</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Ensure non-admins cannot access admin tabs
  const effectiveTab = (activeTab === 'organization' || activeTab === 'team') && role !== 'admin'
    ? 'dashboard'
    : activeTab;

  const isPersonalRestrictedTab = accountType === 'personal' && !['ingest', 'overview', 'hops', 'map', 'logs', 'headers', 'settings'].includes(effectiveTab);

  return (
    <div className="flex h-screen w-screen bg-[#0b0d12] text-[#e7ebf1] overflow-hidden font-sans select-text">
      {/* Sidebar with role-differentiated navigation */}
      <Sidebar
        activeTab={effectiveTab}
        setActiveTab={setActiveTab}
        alertCount={unreadCount}
        wsStatus={wsStatus}
        role={role}
        accountType={accountType}
        onOpenUpgradeModal={handleOpenUpgradeModal}
        onOpenWalkthrough={() => setIsObjectiveModalOpen(true)}
        viewMode={viewMode}
        onOpenShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

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
          accountType={accountType}
          onOpenUpgradeModal={handleOpenUpgradeModal}
          onSignOut={signOut}
          onOpenSettings={() => setActiveTab('settings')}
          onSwitchRole={switchRole}
          viewMode={viewMode}
          onSetViewMode={handleToggleViewMode}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
          isMobileSidebarOpen={isMobileSidebarOpen}
        />

        {/* View Switcher Container */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {isPersonalRestrictedTab ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0b0d12]">
              <div className="max-w-lg p-6 bg-[#16130f] border border-[#3a352c] rounded-[2px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] space-y-4">
                <div className="w-12 h-12 rounded-full bg-[rgba(201,162,39,0.15)] border border-[var(--stamp)] text-[var(--stamp)] flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-lg text-[#ede6d8]">
                  Organization Mode Required
                </h3>
                <p className="text-xs text-[#b9af9c] leading-relaxed">
                  You are currently in <strong>Individual Mode</strong>, which is focused on single email analysis and raw RFC822 ingestion. To get more analysis, live threat alerts, organization employee management, and historical case archives, switch to Organization Mode.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setActiveTab('ingest')}
                    className="btn-secondary text-xs px-3 py-2 cursor-pointer"
                  >
                    Return to Email Ingestion
                  </button>
                  <button
                    onClick={() => handleOpenUpgradeModal('Full Enterprise SOC Module')}
                    className="btn-primary text-xs px-4 py-2 cursor-pointer flex items-center gap-1.5 font-bold"
                  >
                    <span>Switch to Org Mode</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center h-full">
                <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              </div>
            }>
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

              {effectiveTab === 'gmail' && (
                <GmailConnectionView
                  onSelectAnalysis={handleAnalysisCreated}
                  currentUserEmail={user?.email || session?.user?.email || ''}
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

              {effectiveTab === 'settings' && (
                <AccountSettingsView
                  role={role}
                  accountType={accountType}
                  organizationId={organizationId || 'org_acme_soc_01'}
                  user={user}
                  profile={profile}
                  userLabel={userInitials}
                  isEmailVerified={isEmailVerified}
                  onSignOut={signOut}
                  revokeAllOtherSessions={revokeAllOtherSessions}
                  onNavigateTab={setActiveTab}
                />
              )}
            </Suspense>
          )}
        </div>
      </main>

      <Suspense fallback={null}>
        {/* Mode Upgrade Modal (Individual -> Organization) */}
        {isUpgradeModalOpen && (
          <ModeUpgradeModal
            isOpen={isUpgradeModalOpen}
            onClose={() => setIsUpgradeModalOpen(false)}
            onUpgrade={async (newOrgName) => {
              if (upgradeToOrganization) {
                await upgradeToOrganization(newOrgName);
              }
            }}
            featureName={upgradeTargetFeature}
          />
        )}

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

        {/* Global Command Palette / Spotlight Search (Cmd+K / Ctrl+K) */}
        <CommandPaletteModal
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setIsCommandPaletteOpen(false);
          }}
          onNewAnalysis={() => {
            setIsCommandPaletteOpen(false);
            setIsNewModalOpen(true);
          }}
          onOpenReport={() => {
            setIsCommandPaletteOpen(false);
            setIsReportModalOpen(true);
          }}
          onOpenPrivacyModal={() => {
            setIsCommandPaletteOpen(false);
            setIsPrivacyModalOpen(true);
          }}
          onOpenWalkthrough={() => {
            setIsCommandPaletteOpen(false);
            setIsObjectiveModalOpen(true);
          }}
          onToggleViewMode={() => handleToggleViewMode(viewMode === 'simple' ? 'analyst' : 'simple')}
          onToggleDemoCases={handleToggleDemoCases}
          onOpenShortcutsHelp={() => {
            setIsCommandPaletteOpen(false);
            setIsShortcutsHelpOpen(true);
          }}
          onSelectAnalysis={(analysis) => {
            setCurrentAnalysis(analysis);
            setActiveTab('overview');
          }}
          currentAnalysis={currentAnalysis}
          viewMode={viewMode}
          showDemoCases={showDemoCases}
        />

        {/* Keyboard Shortcuts Reference Modal (Cmd+/ or ?) */}
        <KeyboardShortcutsModal
          isOpen={isShortcutsHelpOpen}
          onClose={() => setIsShortcutsHelpOpen(false)}
        />
      </Suspense>

      {/* Real-time WebSocket Alert Toast */}
      <AlertToast
        alert={activeToast}
        onDismiss={dismissToast}
        onInspect={handleToastInspect}
      />
    </div>
  );
}
