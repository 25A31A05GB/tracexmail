import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  Clock, 
  FileText, 
  Trash2, 
  RefreshCw, 
  AlertTriangle,
  Lock, 
  Unlock,
  Key,
  Users,
  EyeOff,
  Eye,
  CheckCircle2,
  XCircle,
  Shield,
  UserCheck,
  Sliders,
  Sparkles,
  Send,
  Copy,
  Check,
  ArrowRight,
  Info,
  Search,
  HelpCircle,
  Terminal,
  Zap,
  Fingerprint,
  Mail,
  ShieldAlert,
  Database
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserRole } from '../hooks/useSession';
import { OrgUserManagementSection } from './OrgUserManagementSection';
import { 
  PrivacyConfig, 
  DEFAULT_PRIVACY_CONFIG, 
  loadPrivacyConfig, 
  savePrivacyConfig,
  maskEmail,
  maskIp,
  maskText,
  MaskingMode,
  RetentionPolicy
} from '../utils/privacyCompliance';

interface OrganizationViewProps {
  organizationId: string;
  role?: UserRole;
  accountType?: 'personal' | 'organization';
  onSwitchRole?: (newRole: UserRole) => void;
}

interface TeamMemberItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'PENDING' | 'REVOKED';
  lastActive: string;
}

export function OrganizationView({ 
  organizationId, 
  role = 'admin', 
  accountType = 'organization',
  onSwitchRole 
}: OrganizationViewProps) {
  // Navigation tabs within Organization Enclave
  const [activeSection, setActiveSection] = useState<'rbac' | 'pii' | 'team' | 'retention' | 'audit'>('rbac');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [auditFilter, setAuditFilter] = useState('');
  const [logError, setLogError] = useState<string | null>(null);

  // Retention State
  const [runningRetention, setRunningRetention] = useState(false);
  const [retentionDays, setRetentionDays] = useState<number>(90);
  const [retentionMode, setRetentionMode] = useState<'anonymize' | 'purge'>('anonymize');
  const [retentionResult, setRetentionResult] = useState<any | null>(null);

  // Team & Role Management State
  const [teamMembers, setTeamMembers] = useState<TeamMemberItem[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [roleUpdateFeedback, setRoleUpdateFeedback] = useState<string | null>(null);

  // PII Masking Live Tester State
  const [privacyConfig, setPrivacyConfig] = useState<PrivacyConfig>(loadPrivacyConfig());
  const [testSampleText, setTestSampleText] = useState<string>(
    `Incident Lead: John Doe <john.doe@enterprise-target.corp>\nPhone: +1 (555) 234-5678 | SSN: 123-45-6789\nConnecting from Internal Workstation IP: 10.0.14.88 (Gateway: 192.168.1.1)\nSuspicious Outbound Relay: 198.51.100.42 (relay.unauthorized-hacker.com)\nUrgent: Please wire payment to Corporate Account # 4532-8891-2309-8812.`
  );
  const [selectedMaskingMode, setSelectedMaskingMode] = useState<MaskingMode>('pseudonymized');

  // Fetch verified audit logs
  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    setLogError(null);
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && data && data.length > 0) {
          setAuditLogs(data);
          setLoadingLogs(false);
          return;
        }
      }

      const res = await apiClient.get('/compliance/audit-logs?limit=50');
      if (res.data?.entries) {
        setAuditLogs(res.data.entries);
      } else if (Array.isArray(res.data)) {
        setAuditLogs(res.data);
      }
    } catch (err: any) {
      console.warn('[OrganizationView] Audit log fetch failed:', err);
      setLogError(err.response?.data?.error || err.message || 'Failed to load audit logs.');
    } finally {
      setLoadingLogs(false);
    }
  };

  // Fetch team roster
  const fetchTeamMembers = async () => {
    setLoadingTeam(true);
    try {
      const res = await fetch('/api/team/members');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTeamMembers(data);
        }
      }
    } catch (err) {
      console.warn('[OrganizationView] Team fetch warning:', err);
    } finally {
      setLoadingTeam(false);
    }
  };

  // Inline role update for team member
  const handleUpdateRole = async (memberId: string, newRole: UserRole) => {
    if (role !== 'admin') {
      alert('Only administrators with ROOT clearance can modify member roles.');
      return;
    }

    try {
      setUpdatingMemberId(memberId);
      setRoleUpdateFeedback(null);
      const res = await apiClient.patch(`/team/members/${memberId}/role`, { role: newRole });
      setRoleUpdateFeedback(`Role updated to ${newRole.toUpperCase()} for ${memberId}`);
      // Refresh roster
      fetchTeamMembers();
      fetchAuditLogs();
      setTimeout(() => setRoleUpdateFeedback(null), 3500);
    } catch (err: any) {
      alert(`Role assignment error: ${err.response?.data?.error || err.message}`);
    } finally {
      setUpdatingMemberId(null);
    }
  };

  // Execute retention cleanup
  const handleRunRetention = async () => {
    if (role !== 'admin') {
      alert('Only administrators with ROOT clearance can execute retention purges.');
      return;
    }

    if (!confirm(`Execute compliance retention cleanup (${retentionDays} days, mode: ${retentionMode})? This will permanently enforce data minimization per NIST SP 800-86.`)) {
      return;
    }

    setRunningRetention(true);
    setRetentionResult(null);
    try {
      const res = await apiClient.post('/compliance/retention/run', {
        retention_days: retentionDays,
        mode: retentionMode
      });
      setRetentionResult(res.data);
      fetchAuditLogs();
    } catch (err: any) {
      alert(`Retention execution error: ${err.response?.data?.error || err.message}`);
    } finally {
      setRunningRetention(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
    fetchTeamMembers();
  }, [organizationId]);

  // Compute live masked preview from test sample
  const computeMaskedOutput = (text: string, mode: MaskingMode) => {
    return maskText(text, mode);
  };

  const filteredAuditLogs = auditLogs.filter(log => {
    if (!auditFilter) return true;
    const term = auditFilter.toLowerCase();
    return (
      (log.action || '').toLowerCase().includes(term) ||
      (log.user_email || '').toLowerCase().includes(term) ||
      (log.resource_type || '').toLowerCase().includes(term) ||
      (log.status || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-[#0b0d12] text-[#e7ebf1] space-y-6 select-text">
      
      {/* Top Header & Tenant Identity Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#232833] pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <Building2 className="w-5 h-5 text-[#c9a227]" />
            <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#ede6d8]">
              TraceXMail Cyber Defense SOC
            </h2>
            <span className="font-mono text-[10.5px] px-2 py-0.5 rounded bg-[#c9a227]/20 text-[#c9a227] border border-[#c9a227]/40 font-bold">
              TENANT: {organizationId || 'org_acme_soc_01'}
            </span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800">
              NIST SP 800-86 ENCLAVE
            </span>
          </div>
          <p className="text-xs text-[#8a8070] mt-1.5 leading-relaxed max-w-2xl">
            Enterprise Organization Command: Role-Based Access Control (RBAC), team privilege delegation, automated PII de-identification, and tamper-evident audit trails.
          </p>
        </div>

        {/* Current Active Clearance & Interactive Role Simulator */}
        <div className="flex items-center gap-2.5 bg-[#14120f] border border-[#3a352c] rounded-lg p-2.5 shrink-0">
          <div className="text-right">
            <div className="text-[10px] font-mono text-[#8a8070] uppercase">Active Session Clearance</div>
            <div className="flex items-center gap-1.5 justify-end">
              <span className={`w-2 h-2 rounded-full ${
                role === 'admin' ? 'bg-amber-400' : role === 'analyst' ? 'bg-cyan-400' : 'bg-purple-400'
              } animate-pulse`} />
              <span className={`font-mono text-xs font-bold ${
                role === 'admin' ? 'text-amber-400' : role === 'analyst' ? 'text-cyan-300' : 'text-purple-300'
              }`}>
                {role === 'admin' ? 'ADMIN (ROOT)' : role === 'analyst' ? 'LEAD ANALYST' : 'AUDITOR (READ-ONLY)'}
              </span>
            </div>
          </div>

          {onSwitchRole && (
            <div className="border-l border-[#3a352c] pl-2.5 flex flex-col gap-1">
              <span className="text-[9px] font-mono text-[#8a8070]">Simulate Clearance:</span>
              <div className="flex items-center gap-1">
                {(['admin', 'analyst', 'read_only'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => onSwitchRole(r)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all cursor-pointer ${
                      role === r 
                        ? 'bg-amber-500 text-black font-bold shadow-xs' 
                        : 'bg-[#221e17] text-[#8a8070] hover:text-[#ede6d8] border border-[#3a352c]'
                    }`}
                    title={`Switch active session clearance to ${r}`}
                  >
                    {r === 'admin' ? 'Adm' : r === 'analyst' ? 'Ana' : 'Aud'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Role Feedback Banner */}
      {roleUpdateFeedback && (
        <div className="p-3 rounded-md bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{roleUpdateFeedback}</span>
        </div>
      )}

      {/* Navigation Sections Bar */}
      <div className="flex items-center gap-2 border-b border-[#232833] pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSection('rbac')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer shrink-0 ${
            activeSection === 'rbac'
              ? 'bg-[#c9a227] text-black shadow-md'
              : 'bg-[#16130f] text-[#8a8070] hover:text-[#ede6d8] border border-[#3a352c]'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>RBAC Matrix &amp; Permissions</span>
        </button>

        <button
          onClick={() => setActiveSection('team')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer shrink-0 ${
            activeSection === 'team'
              ? 'bg-[#c9a227] text-black shadow-md'
              : 'bg-[#16130f] text-[#8a8070] hover:text-[#ede6d8] border border-[#3a352c]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Team Roster &amp; Role Delegation</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/30 font-bold">{teamMembers.length}</span>
        </button>

        <button
          onClick={() => setActiveSection('pii')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer shrink-0 ${
            activeSection === 'pii'
              ? 'bg-[#c9a227] text-black shadow-md'
              : 'bg-[#16130f] text-[#8a8070] hover:text-[#ede6d8] border border-[#3a352c]'
          }`}
        >
          <EyeOff className="w-3.5 h-3.5" />
          <span>PII Masking &amp; Data Minimization</span>
        </button>

        <button
          onClick={() => setActiveSection('retention')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer shrink-0 ${
            activeSection === 'retention'
              ? 'bg-[#c9a227] text-black shadow-md'
              : 'bg-[#16130f] text-[#8a8070] hover:text-[#ede6d8] border border-[#3a352c]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>NIST Retention Policies</span>
        </button>

        <button
          onClick={() => setActiveSection('audit')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer shrink-0 ${
            activeSection === 'audit'
              ? 'bg-[#c9a227] text-black shadow-md'
              : 'bg-[#16130f] text-[#8a8070] hover:text-[#ede6d8] border border-[#3a352c]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Audit Logs ({auditLogs.length})</span>
        </button>
      </div>

      {/* SECTION 1: RBAC CAPABILITY MATRIX */}
      {activeSection === 'rbac' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Executive Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#14120f] border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-amber-400">SOC Administrator</span>
                <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                  ROOT
                </span>
              </div>
              <p className="text-xs text-[#b9af9c] leading-relaxed">
                Full governance over tenant configuration, employee credentials, policy enforcement, data retention purges, and cryptographic key management.
              </p>
              <div className="text-[11px] font-mono text-[#8a8070] pt-1">
                Clearance: Full R/W + Security Purge
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#14120f] border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-cyan-400">SOC Lead Analyst</span>
                <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                  OPERATIONAL
                </span>
              </div>
              <p className="text-xs text-[#b9af9c] leading-relaxed">
                Conducts full forensic mail deconstruction, routing trace inspection, Gmail API synchronization, IOC tagging, and PDF/Markdown case exports.
              </p>
              <div className="text-[11px] font-mono text-[#8a8070] pt-1">
                Clearance: Case R/W • No Tenant Purge
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#14120f] border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-purple-400">Compliance Auditor</span>
                <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                  READ-ONLY
                </span>
              </div>
              <p className="text-xs text-[#b9af9c] leading-relaxed">
                Regulatory oversight and chain-of-custody verification. Accesses immutable audit trails, SHA-256 seals, and compliance reports with non-destructive access.
              </p>
              <div className="text-[11px] font-mono text-[#8a8070] pt-1">
                Clearance: Read-Only Audit • Non-Mutating
              </div>
            </div>
          </div>

          {/* Granular Permissions Matrix Table */}
          <div className="bg-[#14120f] border border-[#3a352c] rounded-xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-[#3a352c] bg-[#1a1712] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#c9a227]" />
                <h3 className="font-serif font-bold text-sm text-[#ede6d8]">
                  Granular SOC Role-Based Access Control (RBAC) Matrix
                </h3>
              </div>
              <span className="text-[10px] font-mono text-[#8a8070]">
                DEFENSE-IN-DEPTH ENFORCEMENT
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#110f0c] text-[#8a8070] font-mono uppercase text-[10px] border-b border-[#3a352c]">
                  <tr>
                    <th className="p-3.5">Security Capability / Action</th>
                    <th className="p-3.5 text-center text-amber-400">SOC Administrator</th>
                    <th className="p-3.5 text-center text-cyan-400">Lead Analyst</th>
                    <th className="p-3.5 text-center text-purple-400">Compliance Auditor</th>
                    <th className="p-3.5">Enforcement Layer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262119] text-[#b9af9c]">
                  <tr className="hover:bg-[#1a1712]/50">
                    <td className="p-3.5 font-medium text-[#ede6d8]">
                      <div>Upload &amp; Deconstruct Raw RFC822 Emails</div>
                      <div className="text-[11px] text-[#8a8070]">Extract headers, hop traces, MIME attachments, and IOCs</div>
                    </td>
                    <td className="p-3.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="p-3.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="p-3.5 text-center"><Lock className="w-4 h-4 text-[#8a8070] mx-auto" /></td>
                    <td className="p-3.5 font-mono text-[10.5px] text-[#c9a227]">API Gate &amp; requireAuth</td>
                  </tr>

                  <tr className="hover:bg-[#1a1712]/50">
                    <td className="p-3.5 font-medium text-[#ede6d8]">
                      <div>Live Gmail API Integration &amp; Quarantine Triage</div>
                      <div className="text-[11px] text-[#8a8070]">Connect OAuth, sync mailboxes, inspect quarantined threads</div>
                    </td>
                    <td className="p-3.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="p-3.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="p-3.5 text-center"><Lock className="w-4 h-4 text-[#8a8070] mx-auto" /></td>
                    <td className="p-3.5 font-mono text-[10.5px] text-[#c9a227]">OAuth Scopes &amp; RBAC</td>
                  </tr>

                  <tr className="hover:bg-[#1a1712]/50">
                    <td className="p-3.5 font-medium text-[#ede6d8]">
                      <div>Convert Live CISA &amp; OpenPhish Threat Feeds into Cases</div>
                      <div className="text-[11px] text-[#8a8070]">Zero-hour exploit &amp; phishing campaign triage into incident tracker</div>
                    </td>
                    <td className="p-3.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="p-3.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="p-3.5 text-center"><Lock className="w-4 h-4 text-[#8a8070] mx-auto" /></td>
                    <td className="p-3.5 font-mono text-[10.5px] text-[#c9a227]">POST /threat-feeds/convert</td>
                  </tr>

                  <tr className="hover:bg-[#1a1712]/50">
                    <td className="p-3.5 font-medium text-[#ede6d8]">
                      <div>Export Cryptographic Evidence Dossiers (PDF &amp; Markdown)</div>
                      <div className="text-[11px] text-[#8a8070]">Generate chain-of-custody sealed reports with SHA-256 signatures</div>
                    </td>
                    <td className="p-3.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="p-3.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="p-3.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="p-3.5 font-mono text-[10.5px] text-[#c9a227]">Dossier Engine (All Roles)</td>
                  </tr>

                  <tr className="hover:bg-[#1a1712]/50">
                    <td className="p-3.5 font-medium text-[#ede6d8]">
                      <div>Delete or Close Forensic Cases</div>
                      <div className="text-[11px] text-[#8a8070]">Permanent removal or formal resolution of security incident files</div>
                    </td>
                    <td className="p-3.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="p-3.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="p-3.5 text-center"><Lock className="w-4 h-4 text-rose-500/70 mx-auto" /></td>
                    <td className="p-3.5 font-mono text-[10.5px] text-[#c9a227]">requireRole(['admin', 'analyst'])</td>
                  </tr>

                  <tr className="hover:bg-[#1a1712]/50">
                    <td className="p-3.5 font-medium text-[#ede6d8]">
                      <div>Team Provisioning &amp; Member Role Reassignment</div>
                      <div className="text-[11px] text-[#8a8070]">Promote, demote, or revoke access for SOC analysts and auditors</div>
                    </td>
                    <td className="p-3.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="p-3.5 text-center"><Lock className="w-4 h-4 text-rose-500/70 mx-auto" /></td>
                    <td className="p-3.5 text-center"><Lock className="w-4 h-4 text-rose-500/70 mx-auto" /></td>
                    <td className="p-3.5 font-mono text-[10.5px] text-[#c9a227]">requireRole(['admin'])</td>
                  </tr>

                  <tr className="hover:bg-[#1a1712]/50">
                    <td className="p-3.5 font-medium text-[#ede6d8]">
                      <div>Execute NIST SP 800-86 Retention Purge</div>
                      <div className="text-[11px] text-[#8a8070]">Hard purge of expired records older than 30, 90, or 365 days</div>
                    </td>
                    <td className="p-3.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="p-3.5 text-center"><Lock className="w-4 h-4 text-rose-500/70 mx-auto" /></td>
                    <td className="p-3.5 text-center"><Lock className="w-4 h-4 text-rose-500/70 mx-auto" /></td>
                    <td className="p-3.5 font-mono text-[10.5px] text-[#c9a227]">POST /retention/run (Admin)</td>
                  </tr>

                  <tr className="hover:bg-[#1a1712]/50">
                    <td className="p-3.5 font-medium text-[#ede6d8]">
                      <div>Inspect Immutable Audit Logs</div>
                      <div className="text-[11px] text-[#8a8070]">Audit trail of all logins, unmasks, retention purges, and role changes</div>
                    </td>
                    <td className="p-3.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="p-3.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="p-3.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="p-3.5 font-mono text-[10.5px] text-[#c9a227]">GET /compliance/audit-logs</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: TEAM ROSTER, BULK & SINGLE USER PROVISIONING */}
      {activeSection === 'team' && (
        <div className="space-y-4 animate-in fade-in">
          <OrgUserManagementSection
            organizationId={organizationId}
            currentUserRole={role}
          />
        </div>
      )}

      {/* SECTION 3: PII MASKING & DATA MINIMIZATION DEEP-DIVE */}
      {activeSection === 'pii' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Technical Architecture Deep-Dive */}
          <div className="p-5 rounded-xl bg-[#14120f] border border-[#3a352c] space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>TraceXMail PII Masking &amp; Data Minimization Standard</span>
            </div>

            <h3 className="font-serif font-bold text-lg text-[#ede6d8]">
              Automated Header &amp; Body De-Identification (NIST SP 800-86 / GDPR Art. 32 / ISO 27037)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#b9af9c] leading-relaxed">
              <div className="space-y-2 p-3.5 rounded-lg bg-[#1a1712] border border-[#2d2820]">
                <strong className="text-[#ede6d8] flex items-center gap-1.5">
                  <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>1. Client-Side Regex &amp; AST Tokenizer</span>
                </strong>
                <p>
                  Incoming RFC822 messages are pre-processed before rendering or export: sender/recipient personal names (<code className="text-amber-300">J***n D*e</code>), email usernames (<code className="text-amber-300">jo***n@corp.com</code>), Social Security Numbers (<code className="text-amber-300">***-**-6789</code>), credit card PANs, phone numbers, and internal RFC 1918 private IPs (<code className="text-amber-300">10.0.***.***</code>) are sanitized.
                </p>
              </div>

              <div className="space-y-2 p-3.5 rounded-lg bg-[#1a1712] border border-[#2d2820]">
                <strong className="text-[#ede6d8] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>2. Attacker Infrastructure Preservation</span>
                </strong>
                <p>
                  To prevent compromising threat intelligence attribution, <strong>external public IP addresses, Tor exit nodes, bulletproof hosting relays, and malicious typosquat domains are never masked</strong>. Investigators can safely trace attack flight paths without obscuring IOC evidence.
                </p>
              </div>

              <div className="space-y-2 p-3.5 rounded-lg bg-[#1a1712] border border-[#2d2820]">
                <strong className="text-[#ede6d8] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>3. AES-256-GCM Envelope Encryption</span>
                </strong>
                <p>
                  In the Postgres database tier, raw email bodies and tokens are encrypted at-rest using authenticated AES-256-GCM. Unencrypted plaintext never touches permanent storage volumes, mitigating SQL injection dumps and database operator exposure.
                </p>
              </div>

              <div className="space-y-2 p-3.5 rounded-lg bg-[#1a1712] border border-[#2d2820]">
                <strong className="text-[#ede6d8] flex items-center gap-1.5">
                  <Fingerprint className="w-3.5 h-3.5 text-purple-400" />
                  <span>4. Audited Temporary Unmasking</span>
                </strong>
                <p>
                  If an investigator requires unmasked legal evidence for court presentation, unmasking can only be unlocked with a documented operational justification. Every unmasking event writes an immutable entry into the compliance audit log.
                </p>
              </div>
            </div>
          </div>

          {/* Live Interactive PII Masking Tester */}
          <div className="p-5 rounded-xl bg-[#14120f] border border-[#3a352c] space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#c9a227]" />
                <h4 className="font-serif font-bold text-sm text-[#ede6d8]">
                  Interactive PII Masking Simulator
                </h4>
              </div>

              {/* Mode Selector */}
              <div className="flex items-center gap-1.5 bg-[#1a1712] border border-[#3a352c] p-1 rounded-lg">
                {(['pseudonymized', 'strict_redaction', 'anonymized'] as MaskingMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSelectedMaskingMode(mode)}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-all cursor-pointer ${
                      selectedMaskingMode === mode
                        ? 'bg-amber-400 text-black font-bold'
                        : 'text-[#8a8070] hover:text-[#ede6d8]'
                    }`}
                  >
                    {mode === 'pseudonymized' ? 'Pseudonymized' : mode === 'strict_redaction' ? 'Strict Redaction' : 'Anonymized'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Input Area */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-[#8a8070]">
                  <span>Raw Inbound Sample (contains PII):</span>
                  <button
                    onClick={() => setTestSampleText(`Subject: Wire Routing Approval\nFrom: Alice Vance <alice.vance@defense-vendor.corp>\nPhone: +1 415-992-1104 | Account: 4012-8899-2314\nInternal IP: 10.2.14.92 (Router 192.168.0.1)\nConnecting from offshore Tor node: 185.220.101.9`)}
                    className="text-amber-400 hover:underline cursor-pointer text-[10.5px]"
                  >
                    Load Sample 2
                  </button>
                </div>
                <textarea
                  value={testSampleText}
                  onChange={(e) => setTestSampleText(e.target.value)}
                  rows={7}
                  className="w-full p-3 rounded-lg bg-[#0d0b09] border border-[#3a352c] text-[#ede6d8] font-mono text-xs focus:outline-none focus:border-amber-400 resize-none leading-relaxed"
                  placeholder="Paste email headers or message content containing names, emails, IPs, or SSNs..."
                />
              </div>

              {/* Output Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-[#8a8070]">
                  <span className="text-emerald-400 font-bold">Sanitized Forensic View ({selectedMaskingMode}):</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                    PROTECTED
                  </span>
                </div>
                <div className="w-full p-3 rounded-lg bg-[#0d0b09] border border-emerald-900/40 text-emerald-200 font-mono text-xs overflow-y-auto max-h-[170px] whitespace-pre-wrap leading-relaxed shadow-inner">
                  {computeMaskedOutput(testSampleText, selectedMaskingMode)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: NIST RETENTION POLICIES */}
      {activeSection === 'retention' && (
        <div className="space-y-5 animate-in fade-in">
          <div className="p-5 rounded-xl bg-[#14120f] border border-[#3a352c] space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-serif font-bold text-base text-[#ede6d8]">
                  NIST SP 800-86 Evidence Retention &amp; Auto-Purge
                </h3>
                <p className="text-xs text-[#8a8070]">
                  Configure automatic retention windows. Cases and evidence records exceeding this window will be pruned or anonymized per organizational policy.
                </p>
              </div>

              {role === 'admin' && (
                <button
                  onClick={handleRunRetention}
                  disabled={runningRetention}
                  className="px-4 py-2 rounded-lg bg-[#b23a2e] hover:bg-[#c25a4a] text-white text-xs font-mono font-bold flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50 shadow-md"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{runningRetention ? 'Executing Purge…' : 'Execute Retention Cleanup Now'}</span>
                </button>
              )}
            </div>

            {retentionResult && (
              <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 font-mono space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Retention Execution Completed Successfully</span>
                </div>
                <div>Cutoff Timestamp: {retentionResult.retention_cutoff_date}</div>
                <div>Purged Cases: {retentionResult.purged_cases_count} | Anonymized Evidence Items: {retentionResult.anonymized_evidence_count}</div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-lg bg-[#1a1712] border border-[#2d2820] space-y-2">
                <div className="text-[10.5px] font-mono text-[#8a8070] uppercase">Retention Window</div>
                <select
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                  disabled={role !== 'admin'}
                  className="w-full bg-[#110f0c] border border-[#3a352c] rounded px-3 py-1.5 text-xs font-mono text-[#ede6d8] cursor-pointer focus:outline-none focus:border-amber-400"
                >
                  <option value={30}>30 Days (Strict Minimization)</option>
                  <option value={90}>90 Days (NIST SP 800-86 Recommended)</option>
                  <option value={365}>365 Days (Annual Regulatory Compliance)</option>
                </select>
              </div>

              <div className="p-4 rounded-lg bg-[#1a1712] border border-[#2d2820] space-y-2">
                <div className="text-[10.5px] font-mono text-[#8a8070] uppercase">Pruning Action</div>
                <select
                  value={retentionMode}
                  onChange={(e) => setRetentionMode(e.target.value as any)}
                  disabled={role !== 'admin'}
                  className="w-full bg-[#110f0c] border border-[#3a352c] rounded px-3 py-1.5 text-xs font-mono text-[#ede6d8] cursor-pointer focus:outline-none focus:border-amber-400"
                >
                  <option value="anonymize">Anonymize Payload (Keep Hashes)</option>
                  <option value="purge">Hard Delete (Complete Purge)</option>
                </select>
              </div>

              <div className="p-4 rounded-lg bg-[#1a1712] border border-[#2d2820] space-y-2">
                <div className="text-[10.5px] font-mono text-[#8a8070] uppercase">Evidence Preservation Seal</div>
                <div className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1.5 pt-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>SHA-256 Chain-of-Custody Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: IMMUTABLE AUDIT TRAIL */}
      {activeSection === 'audit' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-serif font-bold text-base text-[#ede6d8]">
                Immutable Compliance Audit Trail
              </h3>
              <p className="text-xs text-[#8a8070]">
                Cryptographically tracked log of all role updates, policy modifications, and operational events.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#8a8070] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter audit logs..."
                  value={auditFilter}
                  onChange={(e) => setAuditFilter(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-[#14120f] border border-[#3a352c] text-xs font-mono text-[#ede6d8] rounded-md focus:outline-none focus:border-amber-400 w-44"
                />
              </div>

              <button
                onClick={fetchAuditLogs}
                disabled={loadingLogs}
                className="px-2.5 py-1 rounded bg-[#1a1712] border border-[#3a352c] text-xs font-mono text-[#b9af9c] hover:text-[#ede6d8] flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className="bg-[#14120f] border border-[#3a352c] rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#110f0c] text-[#8a8070] font-mono uppercase text-[10px] border-b border-[#3a352c]">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Operator</th>
                    <th className="p-3">Resource</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262119] text-[#b9af9c]">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-[#8a8070]">
                        {loadingLogs ? 'Loading verified audit logs…' : 'No audit records match the current filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log: any, idx: number) => (
                      <tr key={log.id || idx} className="hover:bg-[#1a1712]/50">
                        <td className="p-3 font-mono text-[#8a8070] text-[11px] whitespace-nowrap">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : 'Recent'}
                        </td>
                        <td className="p-3 font-mono text-amber-300 font-bold">{log.action || 'SECURITY_EVENT'}</td>
                        <td className="p-3 font-mono text-[#ede6d8]">{log.user_email || log.user_id || 'system'}</td>
                        <td className="p-3 font-mono text-cyan-300">{log.resource_type || 'case'}</td>
                        <td className="p-3 font-mono text-[10px]">
                          <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                            {log.status || 'SUCCESS'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Official Legal & DPO Contact Footer */}
      <div className="p-4 rounded-xl bg-[#14120f] border border-[#2d2820] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#8a8070]">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Official Data Protection Officer (DPO) &amp; Compliance Desk:{' '}
            <a href="mailto:tracexmailofficial@gmail.com" className="text-amber-400 hover:underline font-mono">
              tracexmailofficial@gmail.com
            </a>
          </span>
        </div>
        <div className="font-mono text-[10.5px] text-[#6d6455]">
          ISO/IEC 27037 &bull; NIST SP 800-86
        </div>
      </div>

    </div>
  );
}
