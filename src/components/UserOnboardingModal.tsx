import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Terminal, 
  User, 
  CheckCircle2, 
  Sparkles, 
  Mail, 
  Search, 
  Building2, 
  GraduationCap, 
  ArrowRight,
  HelpCircle,
  X,
  Zap,
  Eye,
  FileCode2,
  ListChecks,
  Compass
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

const CONCISE_GOAL_QUIZ = [
  {
    id: 'personal_inbox',
    label: 'Check My Own Suspicious Emails',
    tag: 'Quick Safety Check',
    desc: 'Instantly verify if an email in your inbox has fake links or hidden scams.',
    icon: Mail,
    practicalExample: 'Practical: Upload email file → Get instant "SAFE" or "SCAM" status.'
  },
  {
    id: 'soc_ir',
    label: 'SOC & Incident Response Triage',
    tag: 'Cyber Forensics',
    desc: 'Examine raw headers, SPF/DKIM/DMARC records, and relay server hops.',
    icon: ShieldCheck,
    practicalExample: 'Practical: Deconstruct RFC822 headers & trace origin IP routes.'
  },
  {
    id: 'fraud_bec',
    label: 'BEC Wire Fraud & Executive Spoofing',
    tag: 'Fraud Defense',
    desc: 'Catch fake CFO/CEO requests, fraudulent bank changes, and urgent payroll traps.',
    icon: Search,
    practicalExample: 'Practical: Unmask display-name mismatches vs true Return-Path.'
  },
  {
    id: 'education_research',
    label: 'Learn Cyber & Header Forensics',
    tag: 'Training',
    desc: 'Understand how email security protocols work with real hands-on cases.',
    icon: GraduationCap,
    practicalExample: 'Practical: Interactive case walkthroughs & header decoding.'
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
    initialPersona || 'non_technical'
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
          // background sync fallback
        }
      }
    } finally {
      setSaving(false);
      onComplete(answers);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#12100d] border border-[#2b251d] rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] p-5 sm:p-7 text-[#ede6dc] font-sans my-6">
        
        {/* Concise Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#29231a]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-400/15 border border-amber-400/30 font-mono text-[10px] font-bold uppercase text-amber-400">
                Quick Setup Quiz
              </span>
              <span className="text-xs text-slate-400 font-mono">2 Questions • Takes 10 sec</span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-white">
              Welcome! What brings you to TraceXMail?
            </h2>
          </div>

          {canDismiss && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1f1a14] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="space-y-5 pt-4">
          
          {/* Question 1: What is your primary goal? */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-xs font-mono font-bold flex items-center justify-center">
                1
              </span>
              What is your primary goal today?
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CONCISE_GOAL_QUIZ.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedReason === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedReason(opt.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#1e1913] border-amber-400 ring-1 ring-amber-400/50 shadow-md'
                        : 'bg-[#16130f] border-[#29231a] hover:border-[#3d3428] hover:bg-[#1a1611]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-amber-400/20 text-amber-400' : 'bg-[#262018] text-slate-400'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-white leading-tight">
                          {opt.label}
                        </span>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug mt-1">
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question 2: Technical vs Non-Technical Interface */}
          <div className="space-y-2.5 pt-1">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-xs font-mono font-bold flex items-center justify-center">
                2
              </span>
              Which interface style do you prefer?
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              {/* Non-Technical Card */}
              <button
                type="button"
                onClick={() => setSelectedPersona('non_technical')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedPersona === 'non_technical'
                    ? 'bg-[#1e1913] border-amber-400 ring-1 ring-amber-400/50 shadow-md'
                    : 'bg-[#16130f] border-[#29231a] hover:border-[#3d3428] hover:bg-[#1a1611]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-400/20 text-amber-400">
                        <User className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-white">
                        Simple / Non-Technical Mode
                      </span>
                    </div>
                    {selectedPersona === 'non_technical' && (
                      <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    <strong>Practical View:</strong> Shows a clear <em>"Is this email safe?"</em> verdict, plain English breakdown, and 1-click action buttons.
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-[#29231a] text-[10px] text-amber-400 font-mono">
                  ✓ Plain English • Safety Cards • No Jargon
                </div>
              </button>

              {/* Technical Card */}
              <button
                type="button"
                onClick={() => setSelectedPersona('technical')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedPersona === 'technical'
                    ? 'bg-[#151c28] border-blue-400 ring-1 ring-blue-400/50 shadow-md'
                    : 'bg-[#16130f] border-[#29231a] hover:border-[#3d3428] hover:bg-[#1a1611]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                        <Terminal className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-white">
                        Technical SOC Console
                      </span>
                    </div>
                    {selectedPersona === 'technical' && (
                      <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    <strong>Practical View:</strong> Full forensic console with raw RFC822 headers, IP hop traceroute, SPF/DKIM keys, and threat graphs.
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-[#29231a] text-[10px] text-blue-400 font-mono">
                  ✓ Raw RFC822 • IP Hop Maps • Forensic Hashes
                </div>
              </button>

            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-[#29231a] flex items-center justify-between gap-3">
          <span className="text-[10px] text-slate-400 font-mono">
            Mode can be toggled anytime in header
          </span>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-60 ml-auto"
          >
            <span>{saving ? 'Setting up...' : 'Start Using TraceXMail'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
