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
  SlidersHorizontal
} from 'lucide-react';
import { EmailAnalysis } from '../types';
import { SAMPLE_ANALYSES } from '../data/samples';
import { PrivacyConfig } from '../utils/privacyCompliance';
import { subscribeSession, SessionUser } from '../lib/api';
import { exportEvidenceAsPdf, exportEvidenceAsImage } from '../utils/exportEvidence';
import { EvidenceTagCard } from './EvidenceTagCard';
import { AuthModal } from './AuthModal';
import { UserRole } from '../hooks/useSession';
import { LogOut } from 'lucide-react';

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
  onSwitchRole?: (newRole: UserRole) => void;
  onOpenWalkthrough?: () => void;
  viewMode?: 'simple' | 'analyst';
  onSetViewMode?: (mode: 'simple' | 'analyst') => void;
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
  onSwitchRole,
  onOpenWalkthrough,
  viewMode = 'simple',
  onSetViewMode
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

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
    <header className="h-16 border-b border-[#3a352c] bg-[#14120f]/90 backdrop-blur px-6 flex items-center justify-between shrink-0 z-20 select-none">
      {/* Left: Active Case Switcher & Title */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#221e17] border border-[#3a352c] hover:border-[#b9af9c] text-sm font-medium text-[#ede6d8] transition-colors cursor-pointer"
          >
            <Shield className="w-4 h-4 text-[#7fa3ba]" />
            <span className="max-w-[200px] truncate font-mono text-xs text-[#ede6d8]">
              {currentAnalysis.id || 'CASE-ACTIVE'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#8a8070]" />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 mt-2 w-72 rounded-lg bg-[#1a1712] border border-[#3a352c] shadow-2xl p-2 z-50">
              <div className="text-[10px] font-mono font-semibold uppercase text-[#8a8070] px-2 py-1 tracking-wider">
                Preset Forensic Samples
              </div>
              <div className="space-y-1 mt-1">
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
                    <span className="font-display font-semibold truncate text-[#ede6d8]">{sample.subject}</span>
                    <span className="text-[10px] text-[#8a8070] font-mono truncate">{sample.from}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="hidden md:flex flex-col min-w-0">
          <h1 className="font-display text-sm font-semibold text-[#ede6d8] truncate max-w-md">
            {currentAnalysis.subject || 'Forensic Case View'}
          </h1>
          <span className="text-xs text-[#8a8070] truncate">
            From: <span className="text-[#b9af9c] font-mono">{currentAnalysis.from}</span>
          </span>
        </div>

        {/* Verdict Pill */}
        <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${badge.bg}`}>
          <BadgeIcon className="w-3.5 h-3.5" />
          <span>{badge.label}</span>
          <span className="opacity-80 font-mono text-[11px]">({currentAnalysis.threatScore || 0}/100)</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Persisted View Mode Toggle (Simple / Analyst Console) */}
        {onSetViewMode && (
          <div className="flex items-center rounded-lg bg-[#1a1713] p-1 border border-[#342e26] text-xs">
            <button
              onClick={() => onSetViewMode('simple')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer font-medium flex items-center gap-1.5 ${
                viewMode === 'simple'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-[#9d9282] hover:text-[#f4efe6]'
              }`}
              title="Clean view"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>Standard</span>
            </button>
            <button
              onClick={() => onSetViewMode('analyst')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer font-medium flex items-center gap-1.5 ${
                viewMode === 'analyst'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'text-[#9d9282] hover:text-[#f4efe6]'
              }`}
              title="Deep analysis view"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
              <span>Analyst</span>
            </button>
          </div>
        )}

        {/* User Account / Clearance */}
        <div className="relative">
          <button 
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-[#221e17] transition-all cursor-pointer border border-[#342e26] bg-[#1a1713]"
            title={`Role: ${role.toUpperCase()} | ${sessionUser?.email || userLabel}`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${role === 'admin' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <span className="text-xs font-semibold text-[#f4efe6] capitalize">
                {role === 'admin' ? 'Admin' : 'Analyst'}
              </span>
            </div>
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-300">
              {userLabel.slice(0, 2)}
            </div>
            <ChevronDown className="w-3 h-3 text-[#9d9282]" />
          </button>

          {userDropdownOpen && (
            <div className="absolute right-0 mt-1 w-64 bg-[#16130f] border border-[#3a352c] rounded-[2px] shadow-[0_20px_40px_rgba(0,0,0,0.8)] py-1.5 z-50 text-xs text-[#ede6d8] animate-in fade-in zoom-in-95 duration-100 divide-y divide-[#3a352c]">
              <div className="px-3 py-2 text-[11px] text-[#8a8070]">
                <div className="font-mono text-[10px] uppercase text-[#8a8070]">Operator Identity</div>
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

              {onSignOut && (
                <div className="py-1">
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
                </div>
              )}
            </div>
          )}
        </div>

        {/* Investigation Objective Setup Prompt */}
        {onOpenWalkthrough && (
          <button
            onClick={onOpenWalkthrough}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[2px] bg-[rgba(201,162,39,0.15)] hover:bg-[rgba(201,162,39,0.25)] border border-[rgba(201,162,39,0.4)] hover:border-[var(--stamp)] text-xs font-mono text-[var(--stamp)] transition-all cursor-pointer shadow-[0_0_10px_rgba(201,162,39,0.15)]"
            title="Setup Investigation Goal & Tailor Enclave Workspace"
          >
            <Compass className="w-3.5 h-3.5 text-[var(--stamp)]" />
            <span className="font-bold tracking-wide">OBJECTIVE</span>
          </button>
        )}

        {/* Privacy & Compliance Button */}
        {onOpenPrivacyModal && (
          <button
            onClick={onOpenPrivacyModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              privacyConfig?.maskingEnabled
                ? 'bg-purple-950/70 border-purple-700 text-purple-200'
                : 'bg-[#221e17] hover:bg-[#2c271f] border-[#3a352c] text-[#ede6d8]'
            }`}
            title="Configure Privacy Safeguards, Retention & PII Masking"
          >
            <Scale className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline font-mono">Privacy &amp; Compliance</span>
            {privacyConfig?.maskingEnabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            )}
          </button>
        )}

        {/* New Analysis Button */}
        <button
          onClick={onOpenNewModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm bg-[var(--thread)] hover:bg-[#c94337] text-xs font-mono font-bold text-[#ede6d8] shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Analysis</span>
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
