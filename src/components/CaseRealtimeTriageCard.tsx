import React from 'react';
import { 
  Users, 
  ShieldAlert, 
  Tag, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  Radio, 
  Clock,
  UserCheck
} from 'lucide-react';
import { EmailAnalysis } from '../types';

interface CaseRealtimeTriageCardProps {
  analysis: EmailAnalysis;
  onNavigateToCases?: (caseId?: string) => void;
  className?: string;
}

export function CaseRealtimeTriageCard({
  analysis,
  onNavigateToCases,
  className = ''
}: CaseRealtimeTriageCardProps) {
  const caseId = analysis.id || analysis.evidenceId;
  const status = (analysis.status || 'OPEN').toUpperCase();
  const severity = (analysis.severity || 'HIGH').toUpperCase();
  const assignedUser = analysis.assigned_user || analysis.assignedUser;
  const verdict = analysis.analyst_verdict || analysis.analystVerdict;
  const notes = analysis.caseNotes || [];
  const primaryNote = analysis.analyst_notes || analysis.analystNotes;
  const tags = analysis.tags || [];
  const updatedAt = analysis.updated_at || analysis.updatedAt;

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'CLOSED':
        return 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300';
      case 'TRIAGED':
        return 'bg-amber-950/70 border-amber-500/60 text-amber-300';
      case 'ESCALATED':
        return 'bg-rose-950/70 border-rose-500/60 text-rose-300';
      case 'OPEN':
      case 'NEW':
      default:
        return 'bg-blue-950/70 border-blue-500/60 text-blue-300';
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-red-950/80 border-red-500 text-red-200';
      case 'HIGH':
        return 'bg-amber-950/80 border-amber-500 text-amber-200';
      case 'MEDIUM':
        return 'bg-yellow-950/80 border-yellow-500 text-yellow-200';
      case 'LOW':
      case 'INFO':
      default:
        return 'bg-slate-900 border-slate-600 text-slate-300';
    }
  };

  return (
    <div 
      id="case-realtime-triage-card"
      className={`rounded-xl border border-slate-700/80 bg-slate-900 p-4 font-sans select-text shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between border-b border-[#2A2D34] pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">
            SOC CASE TRIAGE &amp; TEAM COLLABORATION
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono font-medium">
          <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span>LIVE WEBSOCKET SYNC</span>
        </div>
      </div>

      {/* Primary Triage Telemetry */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <div className="p-2 rounded bg-[#161922] border border-[#2A2D34]">
          <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1">Status</div>
          <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border inline-block ${getStatusBadge(status)}`}>
            {status}
          </span>
        </div>

        <div className="p-2 rounded bg-[#161922] border border-[#2A2D34]">
          <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1">Severity</div>
          <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border inline-block ${getSeverityBadge(severity)}`}>
            {severity}
          </span>
        </div>

        <div className="p-2 rounded bg-[#161922] border border-[#2A2D34] col-span-2">
          <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1">Assigned Investigator</div>
          <div className="flex items-center gap-1.5 text-xs text-slate-200 font-medium">
            <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="truncate">{assignedUser || 'Unassigned (Available in Pool)'}</span>
          </div>
        </div>
      </div>

      {/* Analyst Verdict / Resolution Banner if present */}
      {verdict && (
        <div className="mb-3 p-2.5 rounded bg-blue-950/30 border border-blue-800/60 text-xs flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-blue-300 block">
              Analyst Disposition Verdict
            </span>
            <span className="text-slate-200 font-medium">{verdict}</span>
          </div>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="mb-3 flex items-center gap-1.5 flex-wrap">
          <Tag className="w-3 h-3 text-slate-400 shrink-0" />
          {tags.map((t, idx) => (
            <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Recent Notes Stream */}
      {(notes.length > 0 || primaryNote) && (
        <div className="space-y-2 mb-3">
          <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1">
            <FileText className="w-3 h-3 text-slate-400" />
            <span>Case Notes &amp; Analyst Findings</span>
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
            {notes.length > 0 ? (
              notes.map((n, idx) => (
                <div key={n.id || idx} className="p-2 rounded bg-[#11131a] border border-[#222530] text-xs">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span className="font-mono text-blue-300 font-semibold">{n.author_email || 'Forensic Analyst'}</span>
                    <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{n.body}</p>
                </div>
              ))
            ) : primaryNote ? (
              <div className="p-2 rounded bg-[#11131a] border border-[#222530] text-xs">
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                  <span className="font-mono text-blue-300 font-semibold">Triage Summary</span>
                  {updatedAt && <span>{new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
                <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{primaryNote}</p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Footer link to Cases Tab */}
      <div className="pt-2 border-t border-[#2A2D34]/80 flex items-center justify-between text-xs">
        <span className="text-[10px] text-slate-400 font-mono">
          {updatedAt ? `Last active: ${new Date(updatedAt).toLocaleTimeString()}` : 'Connected to live case ledger'}
        </span>
        {onNavigateToCases && (
          <button
            onClick={() => onNavigateToCases(caseId)}
            className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer text-xs"
          >
            <span>Manage in Cases</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
