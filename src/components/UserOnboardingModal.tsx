import React, { useState } from 'react';
import { 
  Shield, 
  Terminal, 
  User, 
  CheckCircle2, 
  Sparkles, 
  Mail, 
  Search, 
  Building2, 
  GraduationCap, 
  ArrowRight,
  SlidersHorizontal,
  FileText,
  Lock,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export type UserPersona = 'technical' | 'non_technical';

export interface OnboardingAnswers {
  useCaseReason: string;
  customReason?: string;
  persona: UserPersona;
  completedAt: string;
}

interface UserOnboardingModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onComplete: (answers: OnboardingAnswers) => void;
  initialPersona?: UserPersona;
  initialReason?: string;
  canDismiss?: boolean;
}

const USE_CASE_OPTIONS = [
  {
    id: 'soc_ir',
    label: 'Incident Response & SOC Analysis',
    desc: 'Investigating phishing alerts, malicious email headers, hops, and threat infrastructure.',
    icon: Shield,
    badge: 'Security Operations'
  },
  {
    id: 'personal_inbox',
    label: 'Personal & Business Inbox Protection',
    desc: 'Checking if suspicious emails received in my inbox are safe before opening links or attachments.',
    icon: Mail,
    badge: 'Email Safety'
  },
  {
    id: 'fraud_bec',
    label: 'Phishing & BEC Fraud Investigation',
    desc: 'Detecting wire transfer fraud, CEO impersonation, executive spoofing, and payroll theft.',
    icon: Search,
    badge: 'Fraud Prevention'
  },
  {
    id: 'education_research',
    label: 'Cybersecurity Education & Research',
    desc: 'Learning email forensics, malware triage, header protocols (SPF/DKIM/DMARC), and threat hunting.',
    icon: GraduationCap,
    badge: 'Training / Academic'
  },
  {
    id: 'compliance_audit',
    label: 'Enterprise Mail Compliance & Auditing',
    desc: 'Auditing mail flow hygiene, chain-of-custody tokens, and supplier communication integrity.',
    icon: Building2,
    badge: 'Compliance & Audit'
  },
  {
    id: 'other',
    label: 'Other Security Need',
    desc: 'Custom security inspection or general email verification requirements.',
    icon: Sparkles,
    badge: 'General'
  }
];

export function UserOnboardingModal({
  isOpen,
  onClose,
  onComplete,
  initialPersona,
  initialReason,
  canDismiss = true
}: UserOnboardingModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>(
    initialReason || 'personal_inbox'
  );
  const [customReasonText, setCustomReasonText] = useState<string>('');
  const [selectedPersona, setSelectedPersona] = useState<UserPersona>(
    initialPersona || 'technical'
  );
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    const answers: OnboardingAnswers = {
      useCaseReason: selectedReason,
      customReason: selectedReason === 'other' ? customReasonText : undefined,
      persona: selectedPersona,
      completedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem('tracexmail_user_persona', selectedPersona);
      localStorage.setItem('tracexmail_use_reason', selectedReason);
      if (selectedReason === 'other' && customReasonText) {
        localStorage.setItem('tracexmail_custom_reason', customReasonText);
      }
      localStorage.setItem('tracexmail_onboarding_completed', 'true');

      // Best effort async profile metadata update in Supabase
      if (supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.auth.updateUser({
              data: {
                user_persona: selectedPersona,
                use_case_reason: selectedReason,
                onboarding_completed: true,
                onboarding_at: new Date().toISOString()
              }
            }).catch(() => null);
          }
        } catch {
          // ignore background sync errors
        }
      }
    } finally {
      setSaving(false);
      onComplete(answers);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#14110E] border border-[#2B241E] rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] p-6 sm:p-8 text-[#EDE6DC] font-sans my-8">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-[#2B241E]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D3A039] animate-pulse"></span>
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#D3A039]">
                TraceXMail Workspace Setup
              </span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#EDE6DC]">
              Tailor Your Experience
            </h2>
            <p className="text-xs sm:text-sm text-[#9C9186]">
              Help us personalize your message analysis and forensic workspace interface.
            </p>
          </div>

          {canDismiss && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#9C9186] hover:text-[#EDE6DC] hover:bg-[#1D1712] transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="space-y-6 pt-5">
          {/* Question 1: Why are you using TraceXMail? */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-semibold text-[#EDE6DC] flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#D3A039]/20 text-[#D3A039] text-xs font-mono font-bold flex items-center justify-center">
                  1
                </span>
                Why are you using TraceXMail?
              </label>
              <span className="text-[11px] text-[#9C9186] font-mono">Select primary goal</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {USE_CASE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedReason === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedReason(opt.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#1D1712] border-[#D3A039] shadow-[0_0_15px_rgba(211,160,57,0.15)] ring-1 ring-[#D3A039]'
                        : 'bg-[#17130F] border-[#2B241E] hover:border-[#3E342B] hover:bg-[#1D1712]/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-[#D3A039]/20 text-[#D3A039]' : 'bg-[#2B241E] text-[#9C9186]'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-[#EDE6DC] leading-snug">
                          {opt.label}
                        </span>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-[#D3A039] shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#9C9186] leading-relaxed pl-8">
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            {selectedReason === 'other' && (
              <div className="pt-2 animate-in fade-in">
                <input
                  type="text"
                  value={customReasonText}
                  onChange={(e) => setCustomReasonText(e.target.value)}
                  placeholder="Please specify your use case..."
                  className="w-full bg-[#17130F] border border-[#2B241E] rounded-xl px-3.5 py-2.5 text-xs text-[#EDE6DC] placeholder-[#9C9186] focus:outline-none focus:border-[#D3A039]"
                />
              </div>
            )}
          </div>

          {/* Question 2: Are you Technical or Non-Technical? */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-semibold text-[#EDE6DC] flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#D3A039]/20 text-[#D3A039] text-xs font-mono font-bold flex items-center justify-center">
                  2
                </span>
                What is your technical background & preferred view?
              </label>
              <span className="text-[11px] text-[#9C9186] font-mono">You can switch anytime</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Technical Option */}
              <button
                type="button"
                onClick={() => setSelectedPersona('technical')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedPersona === 'technical'
                    ? 'bg-[#1D1712] border-blue-500/80 shadow-[0_0_20px_rgba(59,130,246,0.18)] ring-1 ring-blue-500/80'
                    : 'bg-[#17130F] border-[#2B241E] hover:border-[#3E342B] hover:bg-[#1D1712]/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                        <Terminal className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[#EDE6DC]">
                          Technical Analyst
                        </div>
                        <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider">
                          Full SOC & Forensics Console
                        </span>
                      </div>
                    </div>
                    {selectedPersona === 'technical' && (
                      <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />
                    )}
                  </div>

                  <p className="text-xs text-[#9C9186] leading-relaxed mt-2">
                    Access complete forensic analysis: RFC 822 raw headers, hop traceroute map, threat timeline, relationship graph, C4 feedback calibration, and forensic evidence tags.
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#2B241E] flex flex-wrap gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/60 text-blue-300 font-mono">
                    Deep Headers
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/60 text-blue-300 font-mono">
                    Hop Traceroute
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/60 text-blue-300 font-mono">
                    Evidence Tags
                  </span>
                </div>
              </button>

              {/* Non-Technical Option */}
              <button
                type="button"
                onClick={() => setSelectedPersona('non_technical')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedPersona === 'non_technical'
                    ? 'bg-[#1D1712] border-[#D3A039] shadow-[0_0_20px_rgba(211,160,57,0.18)] ring-1 ring-[#D3A039]'
                    : 'bg-[#17130F] border-[#2B241E] hover:border-[#3E342B] hover:bg-[#1D1712]/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-[#D3A039]/20 text-[#D3A039]">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[#EDE6DC]">
                          Non-Technical User
                        </div>
                        <span className="text-[10px] font-mono text-[#D3A039] uppercase tracking-wider">
                          Human-Readable Safety Card
                        </span>
                      </div>
                    </div>
                    {selectedPersona === 'non_technical' && (
                      <CheckCircle2 className="w-5 h-5 text-[#D3A039] shrink-0" />
                    )}
                  </div>

                  <p className="text-xs text-[#9C9186] leading-relaxed mt-2">
                    Shows the clean, plain-language evidence card design: clear "Is this email safe?" verdict, plain English findings, email snapshot, and one-click actions.
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#2B241E] flex flex-wrap gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300 font-mono">
                    Plain English
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300 font-mono">
                    Scam Verdict
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300 font-mono">
                    1-Click Actions
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-8 pt-5 border-t border-[#2B241E] flex items-center justify-between gap-3">
          <div className="text-[11px] text-[#9C9186] font-mono hidden sm:block">
            Mode can be changed anytime from the top header
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {canDismiss && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#9C9186] hover:text-[#EDE6DC] hover:bg-[#1D1712] transition-colors cursor-pointer"
              >
                Skip for now
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-[#D3A039] hover:bg-[#b8892d] text-[#241A05] text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-[#D3A039]/20 disabled:opacity-60"
            >
              <span>{saving ? 'Saving Preferences...' : 'Save & Launch TraceXMail'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
