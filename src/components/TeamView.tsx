import React, { useState, useEffect } from 'react';
import { Users, Shield, UserPlus, Key, Mail, CheckCircle2, Lock, Trash2, RefreshCw } from 'lucide-react';
import { UserRole } from '../hooks/useSession';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'PENDING' | 'REVOKED';
  lastActive: string;
}

export function TeamView() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('analyst');
  const [inviteName, setInviteName] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTeamRoster = async () => {
    try {
      setLoading(true);
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const members: TeamMember[] = data.map((p: any) => ({
            id: p.id,
            name: p.full_name || p.email?.split('@')[0] || 'Security Analyst',
            email: p.email || 'analyst@defense.sec',
            role: (p.role as UserRole) || 'analyst',
            status: 'ACTIVE',
            lastActive: p.updated_at ? new Date(p.updated_at).toLocaleDateString() : 'Just now'
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

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inviteName || inviteEmail.split('@')[0],
          email: inviteEmail.trim(),
          role: inviteRole
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.invitation) {
          setTeam(prev => [data.invitation, ...prev]);
        }
        setInviteSuccess(`Clearance credential invite dispatched to ${inviteEmail} with role: ${inviteRole.toUpperCase()}`);
        setInviteEmail('');
        setInviteName('');
        setTimeout(() => {
          setInviteSuccess(null);
          setInviteOpen(false);
        }, 2500);
      }
    } catch (err) {
      console.error('[TeamView] Invite failed:', err);
    } finally {
      setIsSubmitting(false);
    }
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
    <div className="flex-1 p-6 overflow-y-auto bg-[#0b0d12] text-[#e7ebf1] space-y-6">
      <div className="flex items-center justify-between border-b border-[#232833] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#5b8dd6]" />
            <h2 className="font-serif font-semibold text-xl text-[#e7ebf1]">
              Team &amp; Access Control Matrix
            </h2>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#c9a227]/20 text-[#c9a227] border border-[#c9a227]/40">
              ADMIN CLEARANCE REQUIRED
            </span>
          </div>
          <p className="text-xs text-[#7d8794] mt-1">
            Configure Role-Based Access Control (RBAC) tiers: Admin, Analyst, and Read-Only Auditor.
          </p>
        </div>

        <button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-2 bg-[#5b8dd6] hover:bg-[#6f9ade] text-xs font-semibold px-3.5 py-2 rounded-lg text-[#0b0d12] transition-all cursor-pointer shadow-md"
        >
          <UserPlus className="w-4 h-4" />
          <span>Provision Clearance</span>
        </button>
      </div>

      {inviteSuccess && (
        <div className="p-4 rounded-lg bg-[#5fae82]/15 border border-[#5fae82]/40 text-xs text-[#86efac] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#5fae82] shrink-0" />
          <span>{inviteSuccess}</span>
        </div>
      )}

      {/* Role Breakdown Description */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#12151c] border border-[#232833] rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-[#c9a227]/20 text-[#c9a227]">
              ADMIN
            </span>
            <Shield className="w-4 h-4 text-[#c9a227]" />
          </div>
          <p className="text-xs text-[#7d8794] mt-2 leading-relaxed">
            Full root privileges. Can manage organization credentials, provision RBAC tiers, trigger database retention purges, and access immutable audit logs.
          </p>
        </div>

        <div className="bg-[#12151c] border border-[#232833] rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-[#5b8dd6]/20 text-[#5b8dd6]">
              ANALYST
            </span>
            <Shield className="w-4 h-4 text-[#5b8dd6]" />
          </div>
          <p className="text-xs text-[#7d8794] mt-2 leading-relaxed">
            Operational forensics. Can ingest emails, open/edit cases, tag IOCs, train ML models, and dispatch campaign mitigation actions.
          </p>
        </div>

        <div className="bg-[#12151c] border border-[#232833] rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-[#7d8794]/20 text-[#7d8794]">
              READ-ONLY
            </span>
            <Lock className="w-4 h-4 text-[#7d8794]" />
          </div>
          <p className="text-xs text-[#7d8794] mt-2 leading-relaxed">
            Auditing &amp; oversight. Personal data masked with black-bar redaction by default. Cannot create, edit, close, or delete any cases or evidence.
          </p>
        </div>
      </div>

      {/* Team Roster Table */}
      <div className="bg-[#12151c] border border-[#232833] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#232833] flex items-center justify-between">
          <h3 className="font-semibold text-sm text-[#e7ebf1]">Active Organization Roster</h3>
          <button
            onClick={fetchTeamRoster}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-[#7d8794] hover:text-[#e7ebf1] transition-colors cursor-pointer px-2 py-1 rounded bg-[#171b24] border border-[#232833]"
            title="Refresh Roster from Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0f1219] text-[#4f5763] font-mono uppercase text-[10.5px] border-b border-[#232833]">
              <tr>
                <th className="p-3">Operator</th>
                <th className="p-3">Email Address</th>
                <th className="p-3">Clearance Tier</th>
                <th className="p-3">Status</th>
                <th className="p-3">Last Activity</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1e27] text-[#7d8794]">
              {team.map((mem) => (
                <tr key={mem.id} className="hover:bg-[#171b24]/50">
                  <td className="p-3 font-medium text-[#e7ebf1] flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-[#171b24] text-[10px] font-mono flex items-center justify-center text-[#b9af9c]">
                      {mem.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </div>
                    <span>{mem.name}</span>
                  </td>
                  <td className="p-3 font-mono text-[#b9af9c]">{mem.email}</td>
                  <td className="p-3">
                    <span className={`font-mono text-[10px] px-2 py-0.5 rounded font-medium ${
                      mem.role === 'admin' 
                        ? 'bg-[#c9a227]/20 text-[#c9a227]' 
                        : mem.role === 'analyst' 
                          ? 'bg-[#5b8dd6]/20 text-[#5b8dd6]' 
                          : 'bg-[#7d8794]/20 text-[#7d8794]'
                    }`}>
                      {mem.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                      mem.status === 'ACTIVE' 
                        ? 'text-[#5fae82] bg-[#5fae82]/10' 
                        : 'text-[#c9a227] bg-[#c9a227]/10'
                    }`}>
                      {mem.status}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-[#4f5763]">{mem.lastActive}</td>
                  <td className="p-3 text-right">
                    {mem.status === 'PENDING' && (
                      <button
                        onClick={() => handleRevokeInvite(mem.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-[#e06c75] hover:text-[#f87171] transition-colors cursor-pointer px-2 py-0.5 rounded hover:bg-[#e06c75]/10"
                        title="Revoke Invitation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Revoke</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {inviteOpen && (
        <div className="fixed inset-0 bg-[#05060a]/75 flex items-center justify-center p-4 z-50">
          <div className="bg-[#12151c] border border-[#232833] rounded-xl p-6 max-w-md w-full space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-semibold text-base text-[#e7ebf1]">Provision Security Clearance</h3>
            <form onSubmit={handleInvite} className="space-y-3.5">
              <div>
                <label className="block text-xs text-[#7d8794] mb-1">Operator Name</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Officer Alex Ray"
                  className="w-full bg-[#0b0d12] border border-[#232833] rounded-lg px-3 py-2 text-xs text-[#e7ebf1]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#7d8794] mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="a.ray@acmedefense.sec"
                  className="w-full bg-[#0b0d12] border border-[#232833] rounded-lg px-3 py-2 text-xs text-[#e7ebf1]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#7d8794] mb-1">Clearance Tier</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full bg-[#0b0d12] border border-[#232833] rounded-lg px-3 py-2 text-xs text-[#e7ebf1]"
                >
                  <option value="analyst">Analyst (Forensic Ingestion &amp; Triage)</option>
                  <option value="read_only">Read-Only (Compliance &amp; Legal Audit)</option>
                  <option value="admin">Admin (Root System Privileges)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-[#232833] text-xs text-[#7d8794] hover:text-[#e7ebf1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#5b8dd6] text-[#0b0d12] font-semibold text-xs hover:bg-[#6f9ade]"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
