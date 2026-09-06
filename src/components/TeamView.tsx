import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  UserPlus, 
  Key, 
  Mail, 
  CheckCircle2, 
  Lock, 
  Trash2, 
  RefreshCw, 
  KeyRound, 
  Copy, 
  Eye, 
  EyeOff, 
  Sparkles, 
  ShieldAlert,
  Building2,
  Check
} from 'lucide-react';
import { UserRole } from '../hooks/useSession';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  employeeId?: string;
  role: UserRole;
  status: 'ACTIVE' | 'PENDING' | 'REVOKED';
  lastActive: string;
}

interface ProvisionedCreds {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: UserRole;
  tempPassword: string;
}

export function TeamView() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [provisionModalOpen, setProvisionModalOpen] = useState(false);
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employeePassword, setEmployeePassword] = useState('');
  const [employeeRole, setEmployeeRole] = useState<UserRole>('analyst');
  const [showPassword, setShowPassword] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<ProvisionedCreds | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const generateSecurePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setEmployeePassword(pwd);
  };

  const generateEmpId = () => {
    const id = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
    setEmployeeId(id);
  };

  const handleOpenProvisionModal = () => {
    generateEmpId();
    generateSecurePassword();
    setEmployeeName('');
    setEmployeeEmail('');
    setEmployeeRole('analyst');
    setCreatedCreds(null);
    setCopied(false);
    setProvisionModalOpen(true);
  };

  const fetchTeamRoster = async () => {
    try {
      setLoading(true);
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const members: TeamMember[] = data.map((p: any) => ({
            id: p.id,
            name: p.full_name || p.email?.split('@')[0] || 'Security Analyst',
            email: p.email || 'analyst@defense.sec',
            employeeId: p.employee_id || `EMP-${p.id.substring(0, 4).toUpperCase()}`,
            role: (p.role as UserRole) || 'analyst',
            status: 'ACTIVE',
            lastActive: p.updated_at ? new Date(p.updated_at).toLocaleDateString() : 'Active'
          }));
          setTeam(members);
          setLoading(false);
          return;
        }
      }

      const res = await fetch('/api/team/members');
      if (res.ok) {
        const data = await res.json();
        setTeam(data);
      }
    } catch (err) {
      console.warn('[TeamView] Error fetching roster:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamRoster();
  }, []);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeEmail || !employeePassword) return;

    try {
      setIsSubmitting(true);
      setFeedbackMsg(null);

      const res = await fetch('/api/team/create-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: employeeName || employeeEmail.split('@')[0],
          email: employeeEmail.trim(),
          password: employeePassword,
          role: employeeRole,
          employeeId: employeeId || `EMP-${Math.floor(1000 + Math.random() * 9000)}`
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.employee) {
          setCreatedCreds(data.employee);
          setTeam(prev => [
            {
              id: data.employee.id,
              name: data.employee.name,
              email: data.employee.email,
              employeeId: data.employee.employeeId,
              role: data.employee.role,
              status: 'ACTIVE',
              lastActive: 'Just Provisioned'
            },
            ...prev.filter(m => m.email !== data.employee.email)
          ]);
          setFeedbackMsg(`Employee account created for ${data.employee.email}. Credentials are ready to share.`);
        }
      } else {
        const errData = await res.json();
        setFeedbackMsg(errData.error || 'Failed to create employee account.');
      }
    } catch (err: any) {
      console.error('[TeamView] Create employee failed:', err);
      setFeedbackMsg(err.message || 'Error creating employee account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdCreds) return;
    const text = `TraceXMail Access Credentials\n----------------------------\nEmployee ID: ${createdCreds.employeeId}\nName: ${createdCreds.name}\nEmail: ${createdCreds.email}\nPassword: ${createdCreds.tempPassword}\nRole: ${createdCreds.role.toUpperCase()}\nLogin URL: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      const res = await fetch(`/api/team/invite/${inviteId}`, { method: 'DELETE' });
      if (res.ok) {
        setTeam(prev => prev.filter(m => m.id !== inviteId));
      }
    } catch (err) {
      console.error('[TeamView] Revoke failed:', err);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[var(--ink)] text-[var(--paper)] space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--line)] pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[var(--slate)]" />
            <h2 className="font-serif font-semibold text-xl text-[var(--paper)]">
              Organization Employees &amp; Access Control
            </h2>
            <span className="font-mono text-[10.5px] px-2 py-0.5 rounded bg-[rgba(201,162,39,0.18)] text-[var(--stamp)] border border-[var(--stamp)] font-bold">
              ORGANIZATION FULL ACCESS
            </span>
          </div>
          <p className="text-xs text-[var(--paper-dim)] mt-1">
            Create employee IDs, generate temporary/permanent credentials, and grant RBAC clearances directly to the database.
          </p>
        </div>

        <button
          onClick={handleOpenProvisionModal}
          className="btn-primary flex items-center gap-2 text-xs font-semibold px-4 py-2 cursor-pointer shadow-md"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Create Employee ID &amp; Password</span>
        </button>
      </div>

      {feedbackMsg && (
        <div className="p-3.5 rounded-[2px] bg-[rgba(72,169,117,0.15)] border border-[var(--forensic-green)] text-xs text-[var(--paper)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--forensic-green)] shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button 
            onClick={() => setFeedbackMsg(null)}
            className="text-[var(--paper-dim)] hover:text-[var(--paper)] text-xs bg-transparent border-0 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Role Breakdown Description */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-[rgba(201,162,39,0.2)] text-[var(--stamp)]">
              ORG ADMIN
            </span>
            <ShieldAlert className="w-4 h-4 text-[var(--stamp)]" />
          </div>
          <p className="text-xs text-[var(--paper-dim)] mt-2 leading-relaxed">
            Full root privileges. Can create employee accounts, set IDs and passwords, configure organization settings, and manage incident cases.
          </p>
        </div>

        <div className="bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-[rgba(127,163,186,0.2)] text-[var(--slate)]">
              ANALYST
            </span>
            <Shield className="w-4 h-4 text-[var(--slate)]" />
          </div>
          <p className="text-xs text-[var(--paper-dim)] mt-2 leading-relaxed">
            Operational forensics. Ingest emails, examine threat hops and raw headers, open/edit cases, tag IOCs, and access live threat feeds.
          </p>
        </div>

        <div className="bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-[rgba(237,230,216,0.1)] text-[var(--paper-dim)]">
              READ-ONLY AUDITOR
            </span>
            <Lock className="w-4 h-4 text-[var(--paper-dim)]" />
          </div>
          <p className="text-xs text-[var(--paper-dim)] mt-2 leading-relaxed">
            Compliance and legal audit oversight. PII masked with black-bar redaction by default. Read-only view across organization evidence logs.
          </p>
        </div>
      </div>

      {/* Team Roster Table */}
      <div className="bg-[var(--ink-2)] border border-[var(--line)] rounded-sm overflow-hidden">
        <div className="p-4 border-b border-[var(--line)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-[var(--paper)]">Active Organization Employees &amp; Staff</h3>
            <span className="text-[11px] font-mono px-2 py-0.2 rounded bg-[var(--ink)] text-[var(--paper-dim)] border border-[var(--line)]">
              {team.length} accounts
            </span>
          </div>
          <button
            onClick={fetchTeamRoster}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-[var(--paper-dim)] hover:text-[var(--paper)] transition-colors cursor-pointer px-2.5 py-1 rounded-[2px] bg-[var(--ink)] border border-[var(--line)]"
            title="Refresh Roster from Database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Roster</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--ink)] text-[var(--paper-muted)] font-mono uppercase text-[10.5px] border-b border-[var(--line)]">
              <tr>
                <th className="p-3">Employee Name</th>
                <th className="p-3">Employee ID</th>
                <th className="p-3">Work Email</th>
                <th className="p-3">Clearance Tier</th>
                <th className="p-3">Database Status</th>
                <th className="p-3">Activity</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] text-[var(--paper-dim)]">
              {team.map((mem) => (
                <tr key={mem.id} className="hover:bg-[rgba(237,230,216,0.03)]">
                  <td className="p-3 font-medium text-[var(--paper)] flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-[var(--ink)] border border-[var(--line)] text-[10px] font-mono flex items-center justify-center text-[var(--paper-dim)]">
                      {mem.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <span>{mem.name}</span>
                  </td>
                  <td className="p-3 font-mono text-[var(--slate)] font-bold">
                    {mem.employeeId || `EMP-${mem.id.substring(0, 4).toUpperCase()}`}
                  </td>
                  <td className="p-3 font-mono text-[var(--paper)]">{mem.email}</td>
                  <td className="p-3">
                    <span className={`font-mono text-[10px] px-2 py-0.5 rounded font-medium ${
                      mem.role === 'admin' 
                        ? 'bg-[rgba(201,162,39,0.2)] text-[var(--stamp)] border border-[var(--stamp)]/40' 
                        : mem.role === 'analyst' 
                          ? 'bg-[rgba(127,163,186,0.2)] text-[var(--slate)] border border-[var(--slate)]/40' 
                          : 'bg-[rgba(237,230,216,0.1)] text-[var(--paper-dim)] border border-[var(--line)]'
                    }`}>
                      {mem.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                      mem.status === 'ACTIVE' 
                        ? 'text-[var(--forensic-green)] bg-[rgba(72,169,117,0.15)]' 
                        : 'text-[var(--stamp)] bg-[rgba(201,162,39,0.15)]'
                    }`}>
                      {mem.status}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-[var(--paper-muted)]">{mem.lastActive}</td>
                  <td className="p-3 text-right">
                    {mem.status === 'PENDING' ? (
                      <button
                        onClick={() => handleRevokeInvite(mem.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-[var(--thread)] hover:underline cursor-pointer bg-transparent border-0"
                        title="Revoke Invitation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Revoke</span>
                      </button>
                    ) : (
                      <span className="text-[10px] font-mono text-[var(--forensic-green)]">● Active</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Direct Provision Employee Modal */}
      {provisionModalOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-6 max-w-lg w-full space-y-4 shadow-[0_25px_60px_rgba(0,0,0,0.8)] text-[var(--paper)]">
            
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[2px] bg-[rgba(201,162,39,0.15)] border border-[var(--stamp)] flex items-center justify-center text-[var(--stamp)]">
                  <KeyRound className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-[var(--paper)]">Create Employee ID &amp; Password</h3>
                  <div className="text-[10.5px] font-mono text-[var(--stamp)] uppercase">Direct Database Provisioning</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProvisionModalOpen(false)}
                className="text-[var(--paper-dim)] hover:text-[var(--paper)] text-sm bg-transparent border-0 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {createdCreds ? (
              <div className="space-y-4">
                <div className="p-4 rounded-[2px] bg-[rgba(72,169,117,0.15)] border border-[var(--forensic-green)] text-xs space-y-3">
                  <div className="flex items-center gap-2 text-[var(--forensic-green)] font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Employee Account Provisioned to Database!</span>
                  </div>
                  <p className="text-[var(--paper-dim)] leading-relaxed">
                    The credentials have been written to the database. The employee can now immediately log in on the TraceXMail login page with these details.
                  </p>

                  <div className="p-3 rounded-[2px] bg-[var(--ink)] border border-[var(--line)] font-mono space-y-1.5 text-xs text-[var(--paper)]">
                    <div className="flex justify-between">
                      <span className="text-[var(--paper-dim)]">Employee ID:</span>
                      <span className="text-[var(--slate)] font-bold">{createdCreds.employeeId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--paper-dim)]">Full Name:</span>
                      <span>{createdCreds.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--paper-dim)]">Work Email:</span>
                      <span className="text-[var(--stamp)]">{createdCreds.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--paper-dim)]">Password:</span>
                      <span className="text-[var(--paper)] font-bold bg-[var(--ink-2)] px-1.5 py-0.5 rounded-[2px]">{createdCreds.tempPassword}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--paper-dim)]">Clearance Role:</span>
                      <span className="uppercase">{createdCreds.role}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCredentials}
                    className="btn-primary flex-1 flex items-center justify-center gap-2 text-xs py-2.5 cursor-pointer font-semibold"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-[var(--forensic-green)]" />
                        <span>Credentials Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy All Employee Credentials</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCreatedCreds(null);
                      generateEmpId();
                      generateSecurePassword();
                      setEmployeeName('');
                      setEmployeeEmail('');
                    }}
                    className="btn-secondary text-xs py-2.5 px-3 cursor-pointer"
                  >
                    + Add Another
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateEmployee} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs text-[var(--paper-dim)] font-medium">Employee Name</label>
                    <input
                      type="text"
                      required
                      value={employeeName}
                      onChange={(e) => setEmployeeName(e.target.value)}
                      placeholder="e.g. David Miller"
                      className="w-full bg-[var(--ink)] border border-[var(--line)] rounded-[2px] px-3 py-2 text-xs text-[var(--paper)] focus:border-[var(--slate)] focus:outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs text-[var(--paper-dim)] font-medium">Employee ID</label>
                      <button
                        type="button"
                        onClick={generateEmpId}
                        className="text-[10px] text-[var(--slate)] hover:underline cursor-pointer bg-transparent border-0"
                      >
                        Regen
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      placeholder="EMP-8241"
                      className="w-full bg-[var(--ink)] border border-[var(--line)] font-mono rounded-[2px] px-3 py-2 text-xs text-[var(--slate)] font-bold focus:border-[var(--slate)] focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs text-[var(--paper-dim)] font-medium">Work Email Address</label>
                  <input
                    type="email"
                    required
                    value={employeeEmail}
                    onChange={(e) => setEmployeeEmail(e.target.value)}
                    placeholder="d.miller@company.com"
                    className="w-full bg-[var(--ink)] border border-[var(--line)] rounded-[2px] px-3 py-2 text-xs text-[var(--paper)] focus:border-[var(--slate)] focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs text-[var(--paper-dim)] font-medium">Assigned Password</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={generateSecurePassword}
                        className="text-[10px] text-[var(--slate)] hover:underline cursor-pointer bg-transparent border-0 flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Generate Strong</span>
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={employeePassword}
                      onChange={(e) => setEmployeePassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[var(--ink)] border border-[var(--line)] font-mono rounded-[2px] px-3 py-2 pr-9 text-xs text-[var(--paper)] focus:border-[var(--slate)] focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2 text-[var(--paper-muted)] hover:text-[var(--paper)] bg-transparent border-0 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs text-[var(--paper-dim)] font-medium">Clearance Role</label>
                  <select
                    value={employeeRole}
                    onChange={(e) => setEmployeeRole(e.target.value as UserRole)}
                    className="w-full bg-[var(--ink)] border border-[var(--line)] rounded-[2px] px-3 py-2 text-xs text-[var(--paper)] focus:border-[var(--slate)] focus:outline-hidden font-sans"
                  >
                    <option value="analyst">Forensic Analyst (Full Investigation, Hops &amp; Cases)</option>
                    <option value="admin">Organization Admin (Full Privileges &amp; Team Management)</option>
                    <option value="read_only">Read-Only Auditor (PII Redacted &amp; Audit Logs)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
                  <button
                    type="button"
                    onClick={() => setProvisionModalOpen(false)}
                    className="btn-secondary text-xs px-3.5 py-2 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary text-xs px-4 py-2 cursor-pointer font-semibold flex items-center gap-1.5"
                  >
                    {isSubmitting ? 'Creating in Database…' : 'Provision Employee Account'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
