import { useState } from 'react';
import { 
  ShieldAlert, 
  Target, 
  FileCheck2, 
  Search, 
  ArrowRight, 
  X, 
  CheckCircle2, 
  Sparkles,
  Lock,
  FileText
} from 'lucide-react';
import { UserRole } from '../hooks/useSession';
import { NavTab } from './Sidebar';

export interface ObjectiveSelection {
  id: 'incident_response' | 'executive_brief' | 'compliance_audit' | 'threat_hunting';
  title: string;
  description: string;
  recommendedRole: UserRole;
  defaultTab: NavTab;
  privacyMasking: boolean;
  featureHighlights: string[];
}

const OBJECTIVE_OPTIONS: ObjectiveSelection[] = [
  {
    id: 'incident_response',
    title: 'Incident Response & Phishing Triage',
    description: 'Ingest suspicious .eml files, inspect header forgery, perform hop traceroutes, and execute immediate quarantine.',
    recommendedRole: 'analyst',
    defaultTab: 'ingest',
    privacyMasking: false,
    featureHighlights: ['Email Ingestion Pipeline', 'Header & DKIM Verification', 'Quarantine Delivery Gate']
  },
  {
    id: 'executive_brief',
    title: 'Executive Threat Intelligence & Briefing',
    description: 'Review high-level risk scores, attack vector breakdowns, and export PDF dossier reports for leadership.',
    recommendedRole: 'admin',
    defaultTab: 'overview',
    privacyMasking: false,
    featureHighlights: ['Executive Risk Scores', 'AI Forensic Reasoning', 'High-DPI PDF/PNG Export']
  },
  {
    id: 'compliance_audit',
    title: 'Legal & Regulatory Compliance Audit',
    description: 'Audit email evidence with PII masking enabled, check SHA-256 custody hashes, and review GDPR/HIPAA compliance.',
    recommendedRole: 'read_only',
    defaultTab: 'overview',
    privacyMasking: true,
    featureHighlights: ['PII Masking & Anonymization', 'SHA-256 Ledger Audit', 'Compliance Mapping Matrix']
  },
  {
    id: 'threat_hunting',
    title: 'Threat Hunting & IOC Telemetry Analysis',
    description: 'Correlate domain intelligence, VirusTotal malware scans, IP geolocation maps, and relationship graphs.',
    recommendedRole: 'analyst',
    defaultTab: 'logs',
    privacyMasking: false,
    featureHighlights: ['IOC Reputation Engine', 'Geographic Route Map', 'Threat Relationship Graph']
  }
];

interface InvestigationObjectiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyObjective: (selection: ObjectiveSelection) => void;
  currentRole: UserRole;
}

export function InvestigationObjectiveModal({
  isOpen,
  onClose,
  onApplyObjective,
  currentRole
}: InvestigationObjectiveModalProps) {
  const [selectedId, setSelectedId] = useState<string>('incident_response');

  if (!isOpen) return null;

  const activeOption = OBJECTIVE_OPTIONS.find(o => o.id === selectedId) || OBJECTIVE_OPTIONS[0];

  const handleApply = () => {
    onApplyObjective(activeOption);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#181511] border border-[#3a352c] w-full max-w-2xl rounded-sm shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col font-sans text-[#ede6d8]">
        {/* Header */}
        <div className="p-5 border-b border-[#3a352c] flex items-center justify-between bg-[#13110e]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[rgba(201,162,39,0.15)] border border-[var(--stamp)] flex items-center justify-center text-[var(--stamp)] shrink-0 shadow-[0_0_12px_rgba(201,162,39,0.2)]">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-[#ede6d8] flex items-center gap-2">
                <span>Welcome to TraceXMail Enclave</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[rgba(201,162,39,0.2)] text-[var(--stamp)] border border-[var(--stamp)]">
                  SETUP WORKSPACE
                </span>
              </h2>
              <p className="text-xs text-[#8a8070] mt-0.5 font-sans">
                Tell us why you are inspecting this enclave today. We will tailor your view, role clearance, and toolings.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8a8070] hover:text-[#ede6d8] rounded hover:bg-[#221e17] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Options */}
        <div className="p-5 space-y-3 overflow-y-auto max-h-[60vh] bg-[#181511]">
          <div className="text-[11px] font-mono text-[#8a8070] uppercase tracking-wider font-semibold">
            Select Your Primary Investigation Objective:
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {OBJECTIVE_OPTIONS.map((opt) => {
              const isSelected = opt.id === selectedId;
              return (
                <div
                  key={opt.id}
                  onClick={() => setSelectedId(opt.id)}
                  className={`p-3.5 rounded-sm border transition-all cursor-pointer flex items-start gap-3.5 relative ${
                    isSelected
                      ? 'bg-[rgba(201,162,39,0.12)] border-[var(--stamp)] shadow-[0_0_15px_rgba(201,162,39,0.15)] text-[#ede6d8]'
                      : 'bg-[#1e1a14] border-[#3a352c] hover:border-[#8a8070] text-[#b9af9c]'
                  }`}
                >
                  <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'border-[var(--stamp)] bg-[var(--stamp)] text-[#13110e]'
                      : 'border-[#3a352c] bg-[#14120f]'
                  }`}>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`text-xs font-bold font-display ${isSelected ? 'text-[var(--stamp)]' : 'text-[#ede6d8]'}`}>
                        {opt.title}
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#14120f] border border-[#3a352c] text-[#8a8070]">
                        Role: <strong className="text-[#ede6d8] uppercase">{opt.recommendedRole}</strong>
                      </span>
                    </div>

                    <p className="text-[11.5px] text-[#8a8070] mt-1 font-sans leading-relaxed">
                      {opt.description}
                    </p>

                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {opt.featureHighlights.map((feat, idx) => (
                        <span key={idx} className="text-[10px] font-mono px-2 py-0.5 bg-[#14120f] border border-[#3a352c] rounded text-[#b9af9c]">
                          ✓ {feat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#3a352c] bg-[#13110e] flex items-center justify-between">
          <div className="text-[11px] font-mono text-[#8a8070]">
            Target Workspace: <span className="text-[var(--stamp)] font-bold uppercase">{activeOption.defaultTab}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded text-xs font-mono text-[#8a8070] hover:text-[#ede6d8] hover:bg-[#221e17] transition-colors cursor-pointer"
            >
              Skip
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-2 rounded text-xs font-mono font-bold bg-[var(--stamp)] hover:bg-[#d6af2f] text-[#13110e] transition-all cursor-pointer flex items-center gap-2 shadow-[0_0_12px_rgba(201,162,39,0.3)]"
            >
              <span>Apply &amp; Tailor Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
