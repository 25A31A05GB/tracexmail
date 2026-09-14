import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Plus, 
  FileDown, 
  ChevronDown, 
  Activity, 
  Search,
  ExternalLink,
  Shield,
  Scale,
  EyeOff,
  FlaskConical,
  UserCheck,
  FileText,
  Image as ImageIcon,
  Loader2,
  Wifi,
  WifiOff,
  Radio,
  Compass,
  HelpCircle,
  Sparkles,
  Eye,
  SlidersHorizontal,
  Lock,
  Menu,
  X
} from 'lucide-react';
import { EmailAnalysis } from '../types';
import { SAMPLE_ANALYSES } from '../data/samples';
import { PrivacyConfig } from '../utils/privacyCompliance';
import { subscribeSession, SessionUser } from '../lib/api';
import { exportEvidenceAsPdf, exportEvidenceAsImage } from '../utils/exportEvidence';
import { EvidenceTagCard } from './EvidenceTagCard';
import { AuthModal } from './AuthModal';
import { UserRole } from '../hooks/useSession';
import { AutoRefreshControl } from './AutoRefreshControl';
import { LogOut, Keyboard, Command } from 'lucide-react';

interface HeaderProps {
  currentAnalysis: EmailAnalysis;
  onSelectAnalysis: (analysis: EmailAnalysis) => void;
  onOpenNewModal: () => void;
  onOpenReportModal: () => void;
  onOpenPrivacyModal?: () => void;
  privacyConfig?: PrivacyConfig;
  showDemoCases?: boolean;
  onToggleDemoCases?: () => void;
  role?: UserRole;
  userLabel?: string;
  accountType?: 'personal' | 'organization';
  onOpenUpgradeModal?: (featureName?: string) => void;
  onSignOut?: () => void;
  onOpenSettings?: () => void;
  onSwitchRole?: (newRole: UserRole) => void;
  onOpenWalkthrough?: () => void;
  viewMode?: 'simple' | 'analyst';
  onSetViewMode?: (mode: 'simple' | 'analyst') => void;
  userPersona?: 'technical' | 'non_technical';
  onSetPersona?: (persona: 'technical' | 'non_technical') => void;
  onOpenOnboarding?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcutsHelp?: () => void;
  onToggleMobileSidebar?: () => void;
  isMobileSidebarOpen?: boolean;
  onSyncCases?: () => void | Promise<void>;
  inactivityRemainingSecs?: number;
  onLockWorkspace?: () => void;
}

export function Header({
  currentAnalysis,
  onSelectAnalysis,
  onOpenNewModal,
  onOpenReportModal,
  onOpenPrivacyModal,
  privacyConfig,
  showDemoCases = false,
  onToggleDemoCases,
  role = 'analyst',
  userLabel = 'SA',
  accountType = 'organization',
  onOpenUpgradeModal,
  onSignOut,
  onOpenSettings,
  onSwitchRole,
  onOpenWalkthrough,
  viewMode = 'simple',
  onSetViewMode,
  userPersona = 'technical',
  onSetPersona,
  onOpenOnboarding,
  onOpenCommandPalette,
  onOpenShortcutsHelp,
  onToggleMobileSidebar,
  isMobileSidebarOpen = false,
  onSyncCases,
  inactivityRemainingSecs,
  onLockWorkspace
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setDropdownOpen(false);
        setUserDropdownOpen(false);
        setToolsDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setUserDropdownOpen(false);
        setToolsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    return subscribeSession((sess) => {
      setSessionUser(sess.user);
    });
  }, []);

  const getExportTargetElement = (): HTMLElement | null => {
    // Prefer visible .evidence-card or #card in main view first, fallback to header target card
    const visibleCard = document.querySelector('main .evidence-card') as HTMLElement || 
                        document.querySelector('.evidence-card') as HTMLElement || 
                        document.getElementById('card');
    if (visibleCard) return visibleCard;

    const headerHiddenCard = document.getElementById('header-evidence-export-target')?.querySelector('.evidence-card') as HTMLElement;
    return headerHiddenCard || null;
  };

  const handleExportPdf = async () => {
    const target = getExportTargetElement();
    setExportingPdf(true);
    try {
      const filename = `TraceXMail-Evidence-${currentAnalysis.id || 'case'}.pdf`;
      await exportEvidenceAsPdf(target!, filename, {
        caseId: currentAnalysis.id,
        evidenceId: currentAnalysis.evidenceId || currentAnalysis.id,
        title: currentAnalysis.subject,
        analysis: currentAnalysis
      });
    } catch (err) {
      console.error('Failed to export Evidence as PDF:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportPng = async () => {
    const target = getExportTargetElement();
    setExportingPng(true);
    try {
      const filename = `TraceXMail-Evidence-${currentAnalysis.id || 'case'}.png`;
      await exportEvidenceAsImage(target!, filename, {
        caseId: currentAnalysis.id,
        evidenceId: currentAnalysis.evidenceId || currentAnalysis.id,
        title: currentAnalysis.subject,
        analysis: currentAnalysis
      });
    } catch (err) {
      console.error('Failed to export Evidence as PNG:', err);
    } finally {
      setExportingPng(false);
    }
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict?.toUpperCase()) {
      case 'MALICIOUS':
      case 'PHISHING':
        return {
          bg: 'bg-red-950/60 border-red-800/80 text-red-400',
          icon: ShieldAlert,
          label: 'MALICIOUS / PHISHING'
        };
      case 'SUSPICIOUS':
        return {
          bg: 'bg-amber-950/60 border-amber-800/80 text-amber-400',
          icon: AlertTriangle,
          label: 'SUSPICIOUS'
        };
      default:
        return {
          bg: 'bg-emerald-950/60 border-emerald-800/80 text-emerald-400',
          icon: ShieldCheck,
          label: 'LEGITIMATE / CLEAN'
        };
    }
  };

  const badge = getVerdictBadge(currentAnalysis.threatVerdict || 'MALICIOUS');
  const BadgeIcon = badge.icon;

  return (
    <header className="h-16 border-b border-[#3a352c] bg-[#14120f]/95 backdrop-blur px-3 sm:px-4 md:px-6 flex items-center justify-between shrink-0 z-20 select-none gap-2">
      {/* Left: Mobile Toggle & Active Case Switcher & Title */}
      <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
        {onToggleMobileSidebar && (
          <button
            type="button"
            id="btn-mobile-sidebar-toggle"
            onClick={onToggleMobileSidebar}
            className="md:hidden p-2 rounded-md bg-[#221e17] border border-[#3a352c] text-[#ede6d8] hover:text-[var(--stamp)] hover:border-[var(--stamp)] transition-colors cursor-pointer flex items-center justify-center shrink-0 min-w-[40px] min-h-[40px]"
            aria-label={isMobileSidebarOpen ? "Close Navigation Menu" : "Open Navigation Menu"}
          >
            {isMobileSidebarOpen ? <X className="w-5 h-5 text-amber-400" /> : <Menu className="w-5 h-5" />}
          </button>
        )}

        <div className="relative dropdown-container">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md bg-[#221e17] border border-[#3a352c] hover:border-[#b9af9c] text-sm font-medium text-[#ede6d8] transition-colors cursor-pointer"
            title="Switch Case / Dataset Presets"
          >
            <Shield className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#7fa3ba] shrink-0" />
            <span className="max-w-[110px] sm:max-w-[160px] md:max-w-[180px] truncate font-mono text-xs text-[#ede6d8]">
              {currentAnalysis.id || 'CASE-ACTIVE'}
            </span>
            <ChevronDown className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-[#8a8070] shrink-0" />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 mt-2 w-80 max-w-[calc(100vw-24px)] rounded-lg bg-[#1a1712] border border-[#3a352c] shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-2 border-b border-[#2d2820] mb-2 px-1">
                <span className="text-[10px] font-mono font-semibold uppercase text-[#8a8070] tracking-wider">
                  Case &amp; Ingestion Hub
                </span>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Enclave
                </span>
              </div>

              <div className="p-2 rounded bg-[#12100d] border border-[#2d2820] mb-2.5 text-xs">
                <div className="text-[10px] font-mono text-[#8a8070]">Active Investigation:</div>
                <div className="font-semibold text-[#ede6d8] truncate mt-0.5">{currentAnalysis.subject}</div>
                <div className="text-[10.5px] font-mono text-[#b9af9c] truncate mt-0.5">{currentAnalysis.from}</div>
              </div>

              <div className="text-[10px] font-mono font-semibold uppercase text-[#8a8070] px-1 py-1 tracking-wider">
                Benchmark Forensic Samples
              </div>
              <div className="space-y-1 mt-1 max-h-52 overflow-y-auto">
                {SAMPLE_ANALYSES.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => {
                      onSelectAnalysis(sample);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded text-xs transition-colors flex flex-col gap-0.5 cursor-pointer ${
                      sample.id === currentAnalysis.id
                        ? 'bg-[#b23a2e]/20 border border-[#b23a2e]/40 text-[#ede6d8]'
                        : 'hover:bg-[#221e17] text-[#b9af9c]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-display font-semibold truncate text-[#ede6d8]">{sample.subject}</span>
                      <span className="text-[9.5px] font-mono uppercase px-1 py-0.2 rounded bg-black/40 text-amber-300 shrink-0">
                        {sample.threatVerdict || sample.verdict}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#8a8070] font-mono truncate">{sample.from}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="hidden lg:flex flex-col min-w-0">
          <h1 className="font-display text-sm font-semibold text-[#ede6d8] truncate max-w-xs xl:max-w-md">
            {currentAnalysis.subject || 'Forensic Case View'}
          </h1>
          <span className="text-xs text-[#8a8070] truncate">
            From: <span className="text-[#b9af9c] font-mono">{currentAnalysis.from}</span>
          </span>
        </div>

        {/* Verdict Pill */}
        <div className={`hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full border text-[11px] sm:text-xs font-semibold ${badge.bg}`}>
          <BadgeIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{badge.label}</span>
          <span className="opacity-80 font-mono text-[10.5px]">({currentAnalysis.threatScore || 0}/100)</span>
        </div>
      </div>

      {/* Right: Consolidated Actions with Progressive Disclosure */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Background Auto-Sync / Auto-Refresh Control */}
        <AutoRefreshControl onSyncCases={onSyncCases} />

        {/* Command Palette / Quick Search Trigger */}
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            className="hidden xl:flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#1c1813] hover:bg-[#25201a] border border-[#342e26] hover:border-[#4d4439] text-xs text-[#9d9282] hover:text-[#f4efe6] transition-all cursor-pointer group"
            title="Open Command Palette & IOC Search (⌘K / Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-amber-400/80 group-hover:text-amber-400" />
            <span className="font-sans">Command Deck</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[#26211a] border border-[#3a352c] rounded text-amber-400/90 group-hover:text-amber-300">
              ⌘K
            </kbd>
          </button>
        )}

        {/* Enclave Tools & Safety Overflow Menu (Progressive Disclosure) */}
        <div className="relative dropdown-container">
          <button
            onClick={() => setToolsDropdownOpen(!toolsDropdownOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all cursor-pointer border text-xs ${
              toolsDropdownOpen || privacyConfig?.maskingEnabled
                ? 'bg-[#221e17] border-[var(--stamp)] text-[#ede6d8]'
                : 'bg-[#1a1713] hover:bg-[#221e17] border-[#342e26] text-[#b9af9c]'
            }`}
            title="Enclave Tools, View Modes & Privacy Controls"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--stamp)]" />
            <span className="hidden sm:inline font-medium">Tools</span>
            {privacyConfig?.maskingEnabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" title="PII Masking Active" />
            )}
            <ChevronDown className="w-3 h-3 text-[#8a8070]" />
          </button>

          {toolsDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-72 max-w-[calc(100vw-24px)] bg-[#16130f] border border-[#3a352c] rounded-md shadow-2xl p-2.5 z-50 text-xs text-[#ede6d8] animate-in fade-in zoom-in-95 duration-100 space-y-2.5">
              <div className="text-[10px] font-mono uppercase text-[#8a8070] font-semibold tracking-wider pb-1 border-b border-[#2d2820]">
                Workspace View &amp; Safety Controls
              </div>

              {/* View Mode Switcher */}
              {onSetViewMode && (
                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-[#8a8070]">Console Perspective:</div>
                  <div className="grid grid-cols-2 gap-1.5 bg-[#100e0b] p-1 rounded border border-[#2d2820]">
                    <button
                      onClick={() => {
                        onSetViewMode('simple');
                        if (onSetPersona) onSetPersona('non_technical');
                      }}
                      className={`py-1 px-2 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        viewMode === 'simple' || userPersona === 'non_technical'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                          : 'text-[#9d9282] hover:text-[#ede6d8]'
                      }`}
                    >
                      <Eye className="w-3 h-3 text-amber-400" />
                      <span>Human View</span>
                    </button>
                    <button
                      onClick={() => {
                        onSetViewMode('analyst');
                        if (onSetPersona) onSetPersona('technical');
                      }}
                      className={`py-1 px-2 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        viewMode === 'analyst' && userPersona === 'technical'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold'
                          : 'text-[#9d9282] hover:text-[#ede6d8]'
                      }`}
                    >
                      <SlidersHorizontal className="w-3 h-3 text-blue-400" />
                      <span>Analyst SOC</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Privacy Safeguards */}
              {onOpenPrivacyModal && (
                <button
                  onClick={() => {
                    setToolsDropdownOpen(false);
                    onOpenPrivacyModal();
                  }}
                  className={`w-full text-left p-2 rounded flex items-center justify-between transition-colors border cursor-pointer ${
                    privacyConfig?.maskingEnabled
                      ? 'bg-purple-950/40 border-purple-800/80 text-purple-200'
                      : 'bg-[#1a1712] hover:bg-[#221e17] border-[#2d2820] text-[#ede6d8]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Scale className="w-3.5 h-3.5 text-purple-400" />
                    <div>
                      <div className="font-semibold text-[11.5px]">Privacy &amp; PII Masking</div>
                      <div className="text-[9.5px] text-[#8a8070]">
                        {privacyConfig?.maskingEnabled ? 'Active (Redacting PII/Tokens)' : 'Standard pass-through'}
                      </div>
                    </div>
                  </div>
                  <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-[#221e17] border border-[#3a352c] rounded text-[#8a8070]">
                    ⌘⇧P
                  </kbd>
                </button>
              )}

              {/* Objective Setup */}
              {onOpenWalkthrough && (
                <button
                  onClick={() => {
                    setToolsDropdownOpen(false);
                    onOpenWalkthrough();
                  }}
                  className="w-full text-left p-2 rounded bg-[#1a1712] hover:bg-[#221e17] border border-[#2d2820] flex items-center justify-between text-[#ede6d8] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Compass className="w-3.5 h-3.5 text-[var(--stamp)]" />
                    <div>
                      <div className="font-semibold text-[11.5px]">Investigation Objective</div>
                      <div className="text-[9.5px] text-[#8a8070]">Configure focus area &amp; goals</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--stamp)]">Setup &rarr;</span>
                </button>
              )}

              {/* Keyboard Shortcuts */}
              {onOpenShortcutsHelp && (
                <button
                  onClick={() => {
                    setToolsDropdownOpen(false);
                    onOpenShortcutsHelp();
                  }}
                  className="w-full text-left p-2 rounded bg-[#1a1712] hover:bg-[#221e17] border border-[#2d2820] flex items-center justify-between text-[#ede6d8] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Keyboard className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-medium text-[11.5px]">Keyboard Shortcuts Cheat Sheet</span>
                  </div>
                  <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-[#221e17] border border-[#3a352c] rounded text-amber-300">
                    ?
                  </kbd>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Unified Workspace Status & Operator Clearance (Progressive Disclosure) */}
        <div className="relative dropdown-container">
          <button 
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-md hover:bg-[#221e17] transition-all cursor-pointer border border-[#342e26] bg-[#1a1713]"
            title={`Workspace Status & Operator Clearance | ${sessionUser?.email || userLabel}`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${role === 'admin' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <span className="hidden sm:inline text-xs font-semibold text-[#f4efe6] capitalize">
              {role === 'admin' ? 'Admin' : 'Analyst'}
            </span>
            <span className="hidden md:inline text-[10px] font-mono text-[#8a8070] bg-[#100e0b] px-1 py-0.2 rounded border border-[#2d2820]">
              0/100
            </span>
            <div className="w-5 h-5 rounded bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-[10px] font-bold text-amber-300">
              {userLabel.slice(0, 2)}
            </div>
            <ChevronDown className="w-3 h-3 text-[#9d9282]" />
          </button>

          {userDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-68 max-w-[calc(100vw-24px)] bg-[#16130f] border border-[#3a352c] rounded-md shadow-2xl py-2 z-50 text-xs text-[#ede6d8] animate-in fade-in zoom-in-95 duration-100 divide-y divide-[#3a352c]">
              <div className="px-3 py-2 text-[11px] text-[#8a8070]">
                <div className="font-mono text-[10px] uppercase text-[#8a8070]">Workspace Operator</div>
                <div className="truncate text-[#ede6d8] font-semibold mt-0.5">{sessionUser?.email || userLabel}</div>
                <div className="font-mono text-[10.5px] mt-1 flex items-center justify-between">
                  <span className="text-[#8a8070]">Organization:</span>
                  <span className="font-bold text-[var(--stamp)] truncate max-w-[130px]" title={sessionUser?.organizationId || 'Acme Cyber Defense SOC'}>
                    {accountType === 'personal' ? 'Personal Sandbox' : 'Acme Cyber Defense SOC'}
                  </span>
                </div>
                <div className="mt-2 pt-1.5 border-t border-[#3a352c] flex items-center justify-between text-[10px] font-mono">
                  <span className="text-[#8a8070]">Clearance:</span>
                  <span className={`font-bold flex items-center gap-1 ${
                    role === 'admin' ? 'text-[var(--stamp)]' : role === 'analyst' ? 'text-[var(--slate)]' : 'text-[var(--paper-dim)]'
                  }`}>
                    <Lock className="w-2.5 h-2.5" />
                    {role === 'admin' ? 'GOLD (ADMIN)' : role === 'analyst' ? 'STEEL (ANALYST)' : 'SILVER (AUDITOR)'}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-[#8a8070]">Usage Quota:</span>
                  <span className="font-semibold text-emerald-400">0 / 100 cases (Active Tier)</span>
                </div>
              </div>

              {/* Strict Access Verified Notice */}
              <div className="px-3 py-2 bg-[rgba(0,0,0,0.3)]">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--forensic-green)] font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--forensic-green)] shrink-0" />
                  <span>Verified Strict Enclave Access</span>
                </div>
                <div className="text-[9.5px] text-[#8a8070] mt-0.5 leading-tight">
                  Tenant tenancy locked to verified organization profile.
                </div>
              </div>

              <div className="py-1">
                {onOpenOnboarding && (
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onOpenOnboarding();
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#ede6d8] hover:bg-[rgba(201,162,39,0.15)] hover:text-[var(--stamp)] flex items-center gap-2 cursor-pointer transition-colors font-sans font-medium"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#D3A039]" />
                    <span>Personalize Persona &amp; Goals</span>
                  </button>
                )}
                {onOpenSettings && (
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#ede6d8] hover:bg-[rgba(201,162,39,0.15)] hover:text-[var(--stamp)] flex items-center gap-2 cursor-pointer transition-colors font-sans font-medium"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--stamp)]" />
                    <span>Account &amp; MFA Settings</span>
                  </button>
                )}
                {onLockWorkspace && (
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onLockWorkspace();
                    }}
                    className="w-full text-left px-3 py-1.5 text-amber-300 hover:bg-[rgba(201,162,39,0.15)] flex items-center justify-between cursor-pointer transition-colors font-sans font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Lock Workspace Now</span>
                    </div>
                    <kbd className="px-1 py-0.2 text-[9px] font-mono bg-black/40 border border-[#3a352c] rounded text-[#8a8070]">
                      ⌘⇧L
                    </kbd>
                  </button>
                )}
                {onSignOut && (
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onSignOut();
                    }}
                    className="w-full text-left px-3 py-1.5 text-[var(--rose-400)] hover:bg-[rgba(178,58,46,0.15)] flex items-center gap-2 cursor-pointer transition-colors font-sans font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5 text-[var(--thread)]" />
                    <span>Sign out of enclave</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Forensic Dossier & Executive Compliance Report Button */}
        {onOpenReportModal && (
          <button
            onClick={onOpenReportModal}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-sm bg-[#1c1813] hover:bg-[#25201a] border border-[#342e26] hover:border-[var(--stamp)] text-xs font-mono font-semibold text-[#ede6d8] transition-all cursor-pointer shrink-0 group shadow-sm"
            title="Open Forensic Dossier & Executive Incident Report"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-300" />
            <span className="hidden sm:inline">Forensic Report</span>
            <span className="inline sm:hidden">Report</span>
          </button>
        )}

        {/* Primary CTA: New Analysis Button with Shortcut Badge */}
        <button
          onClick={onOpenNewModal}
          className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-sm bg-[var(--thread)] hover:bg-[#c94337] text-xs font-mono font-bold text-[#ede6d8] shadow-md transition-all cursor-pointer shrink-0"
          title="Create New Email Analysis (⌘N / Ctrl+N)"
        >
          <Plus className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
          <span className="hidden xs:inline sm:inline">New Analysis</span>
          <span className="inline xs:hidden sm:hidden">New</span>
          <kbd className="hidden md:inline-block px-1.5 py-0.2 bg-black/25 border border-white/20 rounded text-[9.5px] font-mono text-amber-200">
            ⌘N
          </kbd>
        </button>
      </div>

      {/* Hidden Evidence Card Export Target Container */}
      <div 
        id="header-evidence-export-target" 
        className="fixed -left-[9999px] -top-[9999px] w-[720px] pointer-events-none opacity-0 z-[-9999] aria-hidden"
        aria-hidden="true"
      >
        <EvidenceTagCard analysis={currentAnalysis} />
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={sessionUser}
      />
    </header>
  );
}
