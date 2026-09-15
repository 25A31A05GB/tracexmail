import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  Terminal, 
  MapPin, 
  Lock, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  Upload, 
  Eye, 
  Zap, 
  Sparkles,
  Play,
  FileCode2,
  Compass,
  MousePointerClick
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
  title: string;
  subtitle: string;
  practicalWhatIsIt: string;
  practicalHowToUse: string;
  highlights: {
    feature: string;
    actionableDetail: string;
    icon: any;
  }[];
  primaryAction: {
    label: string;
    icon: any;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
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

  if (!isOpen) return null;

  const steps: WalkthroughStep[] = [
    {
      id: 'ingestion',
      stepNumber: 1,
      badge: 'PRACTICAL STEP 1 • HOW TO INGEST',
      title: 'Analyze Email Files & Paste Headers',
      subtitle: 'Upload any .EML file or paste email text for instant forensic breakdown.',
      practicalWhatIsIt: 'The Ingestion Pipeline turns suspicious emails into verified security reports in seconds without storing your data.',
      practicalHowToUse: 'Click "+ New Analysis" in the top bar → Drag and drop an email file or paste header text → Watch real-time execution.',
      highlights: [
        {
          feature: '.EML & .MSG Drag & Drop',
          actionableDetail: 'Upload email files directly from Outlook, Gmail, or Apple Mail.',
          icon: Upload
        },
        {
          feature: 'Paste Raw Headers',
          actionableDetail: 'Paste email headers to trace origin IPs and SPF/DKIM keys.',
          icon: FileCode2
        },
        {
          feature: '100% Zero-Retention',
          actionableDetail: 'Analyzed entirely in memory with no third-party data tracking.',
          icon: Lock
        }
      ],
      primaryAction: {
        label: 'Try Demo Email File',
        icon: Play,
        onClick: () => {
          if (onSelectAnalysis) onSelectAnalysis(SAMPLE_ANALYSES[0]);
          if (onNavigateToTab) onNavigateToTab('overview');
          onClose();
        }
      },
      secondaryAction: {
        label: 'Open Header Ingestion View',
        onClick: () => {
          if (onNavigateToTab) onNavigateToTab('ingest');
          onClose();
        }
      }
    },
    {
      id: 'overview',
      stepNumber: 2,
      badge: 'PRACTICAL STEP 2 • HOW TO READ VERDICTS',
      title: 'Read Plain English & Technical Verdicts',
      subtitle: 'Know instantly if an email is safe or dangerous before clicking links.',
      practicalWhatIsIt: 'The Case Dossier converts complex mail headers into clear safety cards for non-technical users and full forensic logs for analysts.',
      practicalHowToUse: 'Look at the Threat Score (0-100) and Plain English summary card. Switch between Simple and Technical view in the top header anytime.',
      highlights: [
        {
          feature: 'Plain-English Safety Card',
          actionableDetail: 'Answers "Is this safe?" with clear red/green indicators.',
          icon: ShieldCheck
        },
        {
          feature: 'Spoofed Header Detection',
          actionableDetail: 'Exposes when attackers pretend to be CEOs or bank reps.',
          icon: Eye
        },
        {
          feature: '1-Click Quarantine Actions',
          actionableDetail: 'Generate incident reports or isolate malicious messages.',
          icon: Zap
        }
      ],
      primaryAction: {
        label: 'View Wire Fraud Case File',
        icon: ArrowRight,
        onClick: () => {
          if (onSelectAnalysis) onSelectAnalysis(SAMPLE_ANALYSES[0]);
          if (onNavigateToTab) onNavigateToTab('overview');
          onClose();
        }
      }
    },
    {
      id: 'traceroute',
      stepNumber: 3,
      badge: 'PRACTICAL STEP 3 • HOW TO TRACE ROUTE',
      title: 'Trace Origin Server Hops & GeoIP',
      subtitle: 'See exactly where an email originated on a global interactive map.',
      practicalWhatIsIt: 'Hop Traceroute analyzes every intermediate mail server (MTA) an email passed through from sender to inbox.',
      practicalHowToUse: 'Open "Hop Traceroute" (Hops) in the sidebar to see the origin country, ISP, and suspect intermediate relay servers.',
      highlights: [
        {
          feature: 'Origin IP Geolocation',
          actionableDetail: 'Pinpoints the exact country and server network that sent the email.',
          icon: MapPin
        },
        {
          feature: 'Relay Server Chain',
          actionableDetail: 'Flags suspicious offshore relays or unauthorized sending IPs.',
          icon: ShieldAlert
        }
      ],
      primaryAction: {
        label: 'Open Hop Traceroute View',
        icon: ArrowRight,
        onClick: () => {
          if (onNavigateToTab) onNavigateToTab('hops');
          onClose();
        }
      }
    },
    {
      id: 'dashboard',
      stepNumber: 4,
      badge: 'PRACTICAL STEP 4 • HOW TO MONITOR',
      title: 'SOC Dashboard & Active Threat Feeds',
      subtitle: 'Monitor organizational incidents and real-time security stats.',
      practicalWhatIsIt: 'The Dashboard displays overall security statistics, active threat campaigns, and live incident updates.',
      practicalHowToUse: 'Use the Dashboard to review threat trends, filter cases by severity, and switch between logged-in accounts.',
      highlights: [
        {
          feature: 'Live Incident Statistics',
          actionableDetail: 'Tracks total analyzed emails, phishing attempts, and clean messages.',
          icon: Activity
        },
        {
          feature: 'User-Specific Isolation',
          actionableDetail: 'Each logged-in account views its own private security records.',
          icon: Shield
        }
      ],
      primaryAction: {
        label: 'Explore SOC Dashboard',
        icon: ArrowRight,
        onClick: () => {
          if (onNavigateToTab) onNavigateToTab('dashboard');
          onClose();
        }
      }
    }
  ];

  const currentStep = steps[currentStepIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-2xl bg-[#12100d] border border-[#2b251d] rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] p-5 sm:p-7 text-[#ede6dc] font-sans my-6">
        
        {/* Top Navigation & Close Header */}
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#29231a]">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/40 text-amber-400 font-mono text-[10px] font-bold uppercase tracking-wider">
              {currentStep.badge}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {currentStepIndex + 1} of {steps.length}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1f1a14] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Body */}
        <div className="space-y-5 pt-4">
          
          <div>
            <h3 className="font-display font-bold text-lg sm:text-xl text-white">
              {currentStep.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
              {currentStep.subtitle}
            </p>
          </div>

          {/* Practical "What It Is" & "How To Use" Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#1a1510] border border-amber-400/30 text-xs space-y-1">
              <span className="text-[10px] font-mono uppercase text-amber-400 font-bold block">
                💡 WHAT IT IS
              </span>
              <p className="text-slate-200 leading-relaxed font-sans">
                {currentStep.practicalWhatIsIt}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#151c28] border border-blue-400/30 text-xs space-y-1">
              <span className="text-[10px] font-mono uppercase text-blue-400 font-bold block">
                🛠️ HOW TO USE IT PRACTICALLY
              </span>
              <p className="text-slate-200 leading-relaxed font-sans">
                {currentStep.practicalHowToUse}
              </p>
            </div>
          </div>

          {/* Highlights List */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              Key Practical Features:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {currentStep.highlights.map((h, i) => {
                const Icon = h.icon;
                return (
                  <div key={i} className="p-2.5 rounded-lg bg-[#16130f] border border-[#29231a] text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{h.feature}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      {h.actionableDetail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer Navigation Controls */}
        <div className="mt-7 pt-4 border-t border-[#29231a] flex items-center justify-between gap-3">
          <button
            onClick={() => setCurrentStepIndex(prev => Math.max(0, prev - 1))}
            disabled={currentStepIndex === 0}
            className="px-3.5 py-2 rounded-xl border border-[#29231a] bg-[#16130f] text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            {currentStep.secondaryAction && (
              <button
                onClick={currentStep.secondaryAction.onClick}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#1f1a14] transition-colors cursor-pointer hidden sm:block"
              >
                {currentStep.secondaryAction.label}
              </button>
            )}

            <button
              onClick={currentStep.primaryAction.onClick}
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <span>{currentStep.primaryAction.label}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {currentStepIndex < steps.length - 1 && (
              <button
                onClick={() => setCurrentStepIndex(prev => Math.min(steps.length - 1, prev + 1))}
                className="px-3 py-2 rounded-xl bg-[#262018] hover:bg-[#332b20] border border-[#3d3428] text-amber-400 text-xs font-bold transition-all cursor-pointer"
              >
                Next Step
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
