import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  Terminal, 
  FileText, 
  MapPin, 
  Network, 
  Lock, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  Upload, 
  Search, 
  Layers, 
  Scale, 
  FileDown, 
  Compass, 
  Zap, 
  Cpu, 
  Fingerprint, 
  Eye, 
  Sparkles,
  HelpCircle,
  Database,
  ExternalLink,
  ChevronRight,
  Server
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NavTab } from './Sidebar';
import { EmailAnalysis } from '../types';
import { SAMPLE_ANALYSES } from '../data/samples';

interface ForensicWalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTab?: (tab: NavTab) => void;
  onOpenNewModal?: () => void;
  onOpenReportModal?: () => void;
  onOpenPrivacyModal?: () => void;
  onSelectAnalysis?: (analysis: EmailAnalysis) => void;
}

interface WalkthroughStep {
  id: string;
  stepNumber: number;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  description: string;
  coreHighlights: Array<{
    title: string;
    detail: string;
    icon: any;
    tag?: string;
  }>;
  quickAction?: {
    label: string;
    icon: any;
    onClick: () => void;
    secondaryLabel?: string;
    secondaryAction?: () => void;
  };
  forensicSecretTip: string;
  codePreviewTitle: string;
  codePreviewSnippet: string;
}

export function ForensicWalkthroughModal({
  isOpen,
  onClose,
  onNavigateToTab,
  onOpenNewModal,
  onOpenReportModal,
  onOpenPrivacyModal,
  onSelectAnalysis
}: ForensicWalkthroughModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Check if user previously marked don't show
      try {
        const saved = localStorage.getItem('tracexmail_walkthrough_completed');
        if (saved === 'true') {
          setDontShowAgain(true);
        }
      } catch {}
    }
  }, [isOpen]);

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('tracexmail_walkthrough_completed', 'true');
      } catch {}
    }
    onClose();
  };

  const steps: WalkthroughStep[] = [
    {
      id: 'dashboard',
      stepNumber: 1,
      badge: 'ENCLAVE ARCHITECTURE • STEP 1/4',
      badgeColor: 'text-[var(--stamp)] bg-[rgba(201,162,39,0.15)] border-[rgba(201,162,39,0.35)]',
      title: 'SOC Dashboard & Real-Time Threat Intelligence',
      subtitle: 'Your centralized command center for zero-trust email telemetry.',
      description: 'The TraceXMail dashboard aggregates active threat scores, regional incident heatmaps, campaign clusters, and real-time WebSocket incident notifications across your organization.',
      coreHighlights: [
        {
          title: 'Threat Score Telemetry (0 - 100)',
          detail: 'Composite score evaluated across SPF/DKIM/DMARC alignment, domain age, BGP ASNs, and header tampering.',
          icon: Activity,
          tag: 'Risk Matrix'
        },
        {
          title: 'Real-Time Alert Feed & WebSockets',
          detail: 'Live detection events broadcast with audio cues and instant incident triage toasts.',
          icon: Zap,
          tag: 'Sub-Second'
        },
        {
          title: 'Pre-Loaded Forensic Threat Presets',
          detail: 'Explore authentic real-world cases: CEO wire fraud, credential harvesting, malware droppers, and verified receipts.',
          icon: ShieldAlert,
          tag: 'Case Vault'
        }
      ],
      quickAction: {
        label: 'Explore SOC Dashboard',
        icon: ArrowRight,
        onClick: () => {
          if (onNavigateToTab) onNavigateToTab('dashboard');
          handleClose();
        },
        secondaryLabel: 'Load Wire Fraud Case',
        secondaryAction: () => {
          if (onSelectAnalysis) onSelectAnalysis(SAMPLE_ANALYSES[0]);
          if (onNavigateToTab) onNavigateToTab('overview');
          handleClose();
        }
      },
      forensicSecretTip: 'Pro-Tip: Click the Case Selector dropdown at the top-left of the header anytime to switch between live case files.',
      codePreviewTitle: 'Live Telemetry Engine Protocol',
      codePreviewSnippet: `[DASHBOARD_INIT] SOC Enclave Clearance: ACTIVE
[TELEMETRY] WebSocket Live Feed: CONNECTED (Port 3000)
[STATS] Total Analyzed: 142 | Malicious: 88 | Clean: 54
[ALERT] Spike Detected: Offshore ASN AS200548 (Bulgaria)
[STATUS] Real-Time Threat Heatmap Synchronized`
    },
    {
      id: 'ingestion',
      stepNumber: 2,
      badge: 'HEADER DECOMPOSITION • STEP 2/4',
      badgeColor: 'text-[var(--rose-400)] bg-[rgba(178,58,46,0.15)] border-[rgba(178,58,46,0.35)]',
      title: 'Ingestion Pipeline & Multi-Stage Forensic Parsing',
      subtitle: 'Deconstructing raw RFC822 headers down to cryptographic foundations.',
      description: 'Ingest raw .EML files, .MSG packages, or paste raw email header text. TraceXMail strips deceptive display names, extracts all Received: transport nodes, and validates authoritative DNS records.',
      coreHighlights: [
        {
          title: 'Drag-and-Drop .EML / .MSG Ingestion',
          detail: 'Instant client-side RFC5322 parsing with 100% zero-retention privacy mode.',
          icon: Upload,
          tag: 'RFC822'
        },
        {
          title: 'Display Name vs Return-Path Unmasking',
          detail: 'Exposes how attackers spoof "CEO Direct" while routing bounce envelopes to offshore bulletproof relays.',
          icon: Eye,
          tag: 'Anti-Spoof'
        },
        {
          title: 'DNS TXT & Cryptographic Key Validation',
          detail: 'Evaluates 2048-bit RSA DKIM selectors, SPF IP designation, and DMARC p=reject enforcement.',
          icon: Lock,
          tag: 'SPF/DKIM'
        }
      ],
      quickAction: {
        label: 'Open Ingestion Pipeline',
        icon: Upload,
        onClick: () => {
          if (onNavigateToTab) onNavigateToTab('ingest');
          handleClose();
        },
        secondaryLabel: 'Paste Raw Headers Modal',
        secondaryAction: () => {
          if (onOpenNewModal) onOpenNewModal();
          handleClose();
        }
      },
      forensicSecretTip: 'Pro-Tip: You can press "+ New Analysis" in the top-right header anytime to paste headers or upload an email file.',
      codePreviewTitle: 'Stage 2 Ingestion Telemetry Stream',
      codePreviewSnippet: `[MIME_DECOMPOSE] Extracting 4 Received: transport nodes...
[CHECK_1] From: "CEO Office" <ceo@company.com>
[CHECK_2] Return-Path: <spoof@bulletproof-relay.bg>
[VERDICT] 100% Display Envelope Mismatch Detected
[DNS_TXT] SPF IP 185.220.101.42 -> FAIL (Not in SPF record)
[DKIM]    RSA Signature Body Hash -> FAIL (Unsigned)`
    },
    {
      id: 'traceroute',
      stepNumber: 3,
      badge: 'BGP HOP TRACKER • STEP 3/4',
      badgeColor: 'text-[var(--slate)] bg-[rgba(127,163,186,0.15)] border-[rgba(127,163,186,0.35)]',
      title: 'Hop Traceroute & Geographic Network Mapping',
      subtitle: 'Following the digital transmission chain backwards across the globe.',
      description: 'Every Mail Transfer Agent (MTA) stamps an immutable IP and timestamp. TraceXMail reverses the chain chronologically, measuring inter-hop network delays, detecting injected fake headers, and plotting physical origins on interactive Leaflet maps.',
      coreHighlights: [
        {
          title: 'Chronological Hop Reversal (Top-to-Bottom)',
          detail: 'Detects suspect injectors and anonymizing VPN/Tor proxies by analyzing inter-hop latency spikes.',
          icon: Network,
          tag: 'Delta-T'
        },
        {
          title: 'Interactive World Map with Great-Circle Arcs',
          detail: 'Visualize physical email transmission routes from Sofia to Frankfurt to New York.',
          icon: MapPin,
          tag: 'Geo IP'
        },
        {
          title: 'ASN & Threat Infrastructure Attribution',
          detail: 'Cross-references Autonomous System Numbers with known bulletproof hosting providers.',
          icon: Server,
          tag: 'BGP ASN'
        }
      ],
      quickAction: {
        label: 'View Hop Traceroute',
        icon: Network,
        onClick: () => {
          if (onNavigateToTab) onNavigateToTab('hops');
          handleClose();
        },
        secondaryLabel: 'Open Geographic Map',
        secondaryAction: () => {
          if (onNavigateToTab) onNavigateToTab('map');
          handleClose();
        }
      },
      forensicSecretTip: 'Pro-Tip: Visit the "Hop Traceroute" tab to inspect step-by-step latency deltas and server hostnames for any active case.',
      codePreviewTitle: 'Hop 01 Reverse Geolocation Output',
      codePreviewSnippet: `[HOP 01] 185.220.101.42 -> Sofia, Bulgaria (AS200548)
[HOP 02] 194.156.98.12  -> Reykjavik, Iceland (AS49981) [+1.4s]
[HOP 03] 84.17.44.19    -> Frankfurt, Germany (AS13335)  [+0.8s]
[HOP 04] 104.244.42.1   -> New York, USA (Destination)   [+0.3s]
[FLAG]   Origin Hop #1 Identified as Offshore Ingestion Point`
    },
    {
      id: 'reports',
      stepNumber: 4,
      badge: 'EVIDENCE VAULT • STEP 4/4',
      badgeColor: 'text-[var(--forensic-green)] bg-[rgba(72,169,117,0.15)] border-[rgba(72,169,117,0.35)]',
      title: 'Court-Admissible Dossiers & Privacy Controls',
      subtitle: 'Exporting SHA-256 sealed reports formatted for legal and executive review.',
      description: 'Generate comprehensive forensic incident dossiers with one click. Export multi-page printable PDFs, cryptographic PNG evidence cards, or configure GDPR/HIPAA recipient PII masking to protect sensitive employee identities.',
      coreHighlights: [
        {
          title: 'Deterministic SHA-256 Evidence Seal',
          detail: 'Cryptographic hash guarantees evidence integrity for cyber insurance, HR, or law enforcement.',
          icon: Fingerprint,
          tag: 'Chain of Custody'
        },
        {
          title: 'One-Click PDF / PNG Dossier Export',
          detail: 'Download formatted incident reports complete with header deconstructions, hop logs, and threat verdicts.',
          icon: FileDown,
          tag: 'Court-Ready'
        },
        {
          title: 'GDPR & HIPAA PII Sanitization',
          detail: 'Automatically redact recipient names, private mailboxes, and corporate subdomains before exporting.',
          icon: Scale,
          tag: 'Compliance'
        }
      ],
      quickAction: {
        label: 'Open Forensic Report Modal',
        icon: FileText,
        onClick: () => {
          if (onOpenReportModal) onOpenReportModal();
          handleClose();
        },
        secondaryLabel: 'Configure Privacy & PII',
        secondaryAction: () => {
          if (onOpenPrivacyModal) onOpenPrivacyModal();
          handleClose();
        }
      },
      forensicSecretTip: 'Pro-Tip: Click "Export as PDF" or "Export Forensic Report" in the top bar to generate your branded incident dossier.',
      codePreviewTitle: 'Evidence Seal Attestation Header',
      codePreviewSnippet: `[DOSSIER_GEN] Exporting Case CASE-2291...
[INTEGRITY]  SHA-256: 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1f...
[COMPLIANCE] PII Masking: ACTIVE (Recipients Redacted)
[SIGNATURE]  Enclave Operator: SOC-ANALYST-STEEL
[STATUS]     Court-Admissible Evidence Sealed & Ready for PDF Export`
    }
  ];

  const currentStep = steps[currentStepIndex];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-y-auto font-sans">
      {/* Dark Forensic Backdrop */}
      <div 
        onClick={handleClose}
        className="fixed inset-0 bg-[#080706]/90 backdrop-blur-md transition-opacity"
      />

      {/* Main Walkthrough Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full max-w-4xl bg-[#14120f] border-2 border-[#3a352c] rounded-md shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[92vh] z-10 text-[#ede6d8]"
      >
        {/* Top Header Bar */}
        <div className="bg-[#100e0c] px-5 py-3.5 border-b border-[#3a352c] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full border border-[var(--thread)] relative flex items-center justify-center shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--thread)] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold text-[#ede6d8]">
                  TraceXMail Enclave Onboarding &amp; Forensic Guide
                </span>
                <span className="px-2 py-0.2 rounded-sm bg-[rgba(201,162,39,0.15)] text-[var(--stamp)] border border-[rgba(201,162,39,0.3)] font-mono text-[10px] font-bold">
                  GET STARTED
                </span>
              </div>
              <span className="text-[11px] text-[#8a8070] font-sans">
                Master core workflows: Dashboard, Ingestion, Hop Tracing &amp; Forensic Reports.
              </span>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-sm bg-[#1a1712] border border-[#3a352c] hover:border-[#6e6454] flex items-center justify-center text-[#8a8070] hover:text-[#ede6d8] transition-colors cursor-pointer"
            title="Close Walkthrough"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 4 Step Progression Header Bar */}
        <div className="bg-[#181410] border-b border-[#3a352c] px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex items-center gap-2 min-w-max">
            {steps.map((st, idx) => {
              const isCurrent = idx === currentStepIndex;
              const isPast = idx < currentStepIndex;
              return (
                <button
                  key={st.id}
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`px-3 py-1.5 rounded-[2px] font-mono text-xs flex items-center gap-2 transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-[#2b251d] text-[#ede6d8] border border-[var(--thread)] font-bold shadow-xs'
                      : isPast
                        ? 'bg-[#14120f] text-[var(--forensic-green)] border border-[#2e2a22] hover:border-[#4a4438]'
                        : 'bg-[#12100d] text-[#8a8070] border border-[#28241d] hover:text-[#ede6d8]'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                    isCurrent 
                      ? 'bg-[var(--thread)] text-[#ede6d8]' 
                      : isPast 
                        ? 'bg-[rgba(72,169,117,0.2)] text-[var(--forensic-green)] border border-[var(--forensic-green)]' 
                        : 'bg-[#24201a] text-[#8a8070]'
                  }`}>
                    {isPast ? '✓' : idx + 1}
                  </span>
                  <span>{st.id.toUpperCase()}</span>
                </button>
              );
            })}
          </div>

          <span className="font-mono text-xs text-[#8a8070] hidden sm:inline">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Main Step Headline */}
          <div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm font-mono text-[11px] font-bold uppercase tracking-wider mb-2 border ${currentStep.badgeColor}`}>
              <Compass className="w-3.5 h-3.5" />
              <span>{currentStep.badge}</span>
            </div>
            
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#ede6d8] leading-tight">
              {currentStep.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#8a8070] font-sans mt-1">
              {currentStep.subtitle}
            </p>
          </div>

          {/* 2-Column Split: Highlights & Interactive Code Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* Left: 3 Core Highlights (7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              <span className="text-[11px] font-mono uppercase font-bold text-[#8a8070] tracking-wider block">
                Key Operational Capabilities:
              </span>

              <div className="space-y-2.5">
                {currentStep.coreHighlights.map((hl, hIdx) => {
                  const Icon = hl.icon;
                  return (
                    <div
                      key={hIdx}
                      className="bg-[#181410] border border-[#2e2a22] hover:border-[#4a4438] p-3 rounded-sm transition-all flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-sm bg-[#12100d] border border-[#3a352c] flex items-center justify-center text-[var(--slate)] shrink-0 mt-0.5">
                        <Icon className="w-4 h-4 text-[var(--slate)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <h4 className="font-display font-semibold text-xs sm:text-sm text-[#ede6d8] truncate">
                            {hl.title}
                          </h4>
                          {hl.tag && (
                            <span className="font-mono text-[9.5px] px-1.5 py-0.2 rounded bg-[#100e0c] border border-[#3a352c] text-[#b9af9c] shrink-0">
                              {hl.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#b9af9c] leading-relaxed">
                          {hl.detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Forensic Secret Tip Box */}
              <div className="p-3 bg-[#1c1813] border border-[#3a352c] rounded-sm text-xs text-[#ede6d8] flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-[var(--stamp)] shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed text-[#b9af9c]">
                  {currentStep.forensicSecretTip}
                </div>
              </div>
            </div>

            {/* Right: Simulated Console Execution Output (5 cols) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="bg-[#100e0c] border border-[#3a352c] rounded-sm p-3.5 font-mono text-xs shadow-inner">
                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#24201a] text-[11px] text-[#8a8070]">
                  <span className="flex items-center gap-1.5 text-[#ede6d8] font-bold">
                    <Terminal className="w-3.5 h-3.5 text-[var(--thread)]" />
                    <span>{currentStep.codePreviewTitle}</span>
                  </span>
                  <span className="text-[10px] text-[var(--forensic-green)] font-bold">LIVE TELEMETRY</span>
                </div>

                <pre className="text-[11.5px] leading-relaxed text-[#b9af9c] whitespace-pre-wrap overflow-x-auto selection:bg-[var(--thread)]">
                  {currentStep.codePreviewSnippet}
                </pre>
              </div>

              {/* Quick Jump Action Card */}
              {currentStep.quickAction && (
                <div className="bg-[#181410] border border-[#3a352c] rounded-sm p-3 space-y-2">
                  <span className="text-[10.5px] font-mono text-[#8a8070] uppercase font-bold block">
                    Try this feature right now:
                  </span>
                  
                  <button
                    onClick={currentStep.quickAction.onClick}
                    className="w-full btn-primary text-xs font-semibold py-2 px-3 flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <span>{currentStep.quickAction.label}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {currentStep.quickAction.secondaryAction && currentStep.quickAction.secondaryLabel && (
                    <button
                      onClick={currentStep.quickAction.secondaryAction}
                      className="w-full btn-secondary text-xs font-medium py-1.5 px-3 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>{currentStep.quickAction.secondaryLabel}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Clearance Level Guide Strip (Enclave Role-Based Summary) */}
          <div className="bg-[#100e0c] border border-[#2e2a22] rounded-sm p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--stamp)] mt-1 shrink-0" />
              <div>
                <strong className="text-[var(--stamp)] font-mono text-[11px] block">GOLD (ADMIN)</strong>
                <span className="text-[#8a8070] text-[11px]">API credentials, team management, and organization settings.</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--slate)] mt-1 shrink-0" />
              <div>
                <strong className="text-[var(--slate)] font-mono text-[11px] block">STEEL (ANALYST)</strong>
                <span className="text-[#8a8070] text-[11px]">Header decomposition, hop tracing, and dossier exports.</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-[#ede6d8] mt-1 shrink-0" />
              <div>
                <strong className="text-[#ede6d8] font-mono text-[11px] block">SILVER (AUDITOR)</strong>
                <span className="text-[#8a8070] text-[11px]">Read-only audits with automatic recipient PII masking.</span>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Bottom Footer Navigation */}
        <div className="bg-[#100e0c] px-5 py-3 border-t border-[#3a352c] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          
          {/* Don't show again checkbox */}
          <label className="flex items-center gap-2 text-xs text-[#8a8070] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-[#3a352c] bg-[#1a1712] text-[var(--thread)] focus:ring-0 cursor-pointer"
            />
            <span>Don&apos;t show this walkthrough automatically on login</span>
          </label>

          {/* Stepper buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {currentStepIndex > 0 && (
              <button
                onClick={() => setCurrentStepIndex(prev => prev - 1)}
                className="btn-secondary text-xs font-semibold py-1.5 px-3.5 flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
            )}

            {currentStepIndex < steps.length - 1 ? (
              <button
                onClick={() => setCurrentStepIndex(prev => prev + 1)}
                className="btn-primary text-xs font-semibold py-1.5 px-4 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Next Feature</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleClose}
                className="btn-primary text-xs font-semibold py-1.5 px-5 flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-[var(--thread)] to-[var(--stamp)] text-white"
              >
                <span>Complete Walkthrough &amp; Enter SOC</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

      </motion.div>
    </div>
  );
}
