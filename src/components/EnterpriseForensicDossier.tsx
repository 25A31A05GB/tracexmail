import React, { useState } from 'react';
import { 
  Eye, 
  Users, 
  Crosshair, 
  Zap, 
  Scale, 
  Maximize2, 
  ShieldCheck, 
  Sparkles,
  FileCheck2,
  ChevronDown,
  ChevronUp,
  Mail
} from 'lucide-react';
import { EmailAnalysis } from '../types';
import { SafeEmailSandbox } from './SafeEmailSandbox';
import { BlastRadiusMatrix } from './BlastRadiusMatrix';
import { MitreAttackDossier } from './MitreAttackDossier';
import { SoarPlaybookConsole } from './SoarPlaybookConsole';
import { LegalCustodyCertificate } from './LegalCustodyCertificate';
import { GmailSecurityDefenseHub } from './GmailSecurityDefenseHub';

interface EnterpriseForensicDossierProps {
  analysis: EmailAnalysis;
  onOpenReportModal?: () => void;
  className?: string;
}

export function EnterpriseForensicDossier({
  analysis,
  onOpenReportModal,
  className = ''
}: EnterpriseForensicDossierProps) {
  const [activeTab, setActiveTab] = useState<'sandbox' | 'blast_radius' | 'mitre' | 'soar' | 'custody' | 'gmail_hub'>('sandbox');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [hideUserAccount, setHideUserAccount] = useState<boolean>(false);

  return (
    <div 
      id="enterprise-forensic-dossier" 
      className={`rounded-2xl border-2 border-indigo-500/30 bg-[#0a0d14] overflow-hidden shadow-2xl transition-all ${className}`}
    >
      {/* Dossier Header Bar */}
      <div className="bg-[#121624] px-5 py-3.5 border-b border-indigo-500/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                Enterprise Incident Dossier &amp; Sandbox Telemetry
              </span>
              <span className="px-2 py-0.2 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                PRO-TIER FORENSICS
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Live detonation sandbox, organizational blast radius, MITRE ATT&amp;CK correlation, and automated SOAR execution.
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          {/* Mailbox Logged-in User Account Privacy Toggle */}
          <button
            type="button"
            onClick={() => setHideUserAccount(!hideUserAccount)}
            className={`px-2.5 py-1.5 rounded-lg border font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              hideUserAccount
                ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
            title="Mailbox Privacy Option: Toggle hiding logged-in user account from evidence card"
          >
            <span className="text-slate-400">Mailbox:</span>
            <span>{hideUserAccount ? 'Logged-in Account Hidden' : 'Logged-in Account Visible'}</span>
          </button>

          {onOpenReportModal && (
            <button
              type="button"
              onClick={onOpenReportModal}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              title="Open full-screen comprehensive incident report"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Full Screen Report</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand Enterprise Dossier' : 'Collapse Enterprise Dossier'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Sub-Tab Navigation Bar */}
          <div className="bg-[#0e121e] px-4 pt-2 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('sandbox')}
              className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-mono font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'sandbox'
                  ? 'border-rose-500 text-rose-300 bg-rose-950/20 rounded-t'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-rose-400" />
              <span>Safe Email Sandbox</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('blast_radius')}
              className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-mono font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'blast_radius'
                  ? 'border-indigo-400 text-indigo-300 bg-indigo-950/20 rounded-t'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Blast Radius &amp; Telemetry</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('mitre')}
              className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-mono font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'mitre'
                  ? 'border-red-400 text-red-300 bg-red-950/20 rounded-t'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5 text-red-400" />
              <span>MITRE ATT&amp;CK Matrix</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('soar')}
              className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-mono font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'soar'
                  ? 'border-amber-400 text-amber-300 bg-amber-950/20 rounded-t'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>1-Click SOAR Playbook</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('custody')}
              className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-mono font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'custody'
                  ? 'border-teal-400 text-teal-300 bg-teal-950/20 rounded-t'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-teal-400" />
              <span>FRE 902 Certificate</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('gmail_hub')}
              className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-mono font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'gmail_hub'
                  ? 'border-indigo-400 text-indigo-300 bg-indigo-950/20 rounded-t'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mail className="w-3.5 h-3.5 text-indigo-400" />
              <span>Gmail Defense &amp; Hunting</span>
            </button>
          </div>

          {/* Tab Content Display */}
          <div className="p-4 md:p-6 bg-[#0a0d14]">
            {activeTab === 'sandbox' && (
              <SafeEmailSandbox analysis={analysis} />
            )}

            {activeTab === 'blast_radius' && (
              <BlastRadiusMatrix analysis={analysis} />
            )}

            {activeTab === 'mitre' && (
              <MitreAttackDossier analysis={analysis} />
            )}

            {activeTab === 'soar' && (
              <SoarPlaybookConsole analysis={analysis} />
            )}

            {activeTab === 'custody' && (
              <LegalCustodyCertificate analysis={analysis} hideLoggedInUserMailbox={hideUserAccount} />
            )}

            {activeTab === 'gmail_hub' && (
              <GmailSecurityDefenseHub analysis={analysis} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
