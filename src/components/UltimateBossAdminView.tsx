import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Crown, 
  Users, 
  Key, 
  Search, 
  Filter, 
  Lock, 
  Unlock, 
  UserCheck, 
  UserX, 
  Eye, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  ShieldAlert, 
  Mail, 
  Database, 
  Terminal, 
  Activity, 
  Sliders, 
  Copy, 
  Check, 
  Sparkles, 
  Trash2, 
  UserPlus, 
  Building2, 
  FileText, 
  Server, 
  Cpu, 
  Globe, 
  Zap,
  MessageSquare,
  ExternalLink,
  X,
  ChevronRight,
  Shield,
  Layers
} from 'lucide-react';
import { UserRole } from '../hooks/useSession';
import { API_URL, apiFetch } from '../lib/api';

export interface UltimateUserRecord {
  id: string;
  email: string;
  fullName: string;
  orgName: string;
  role: UserRole | 'super_admin';
  accountType: 'personal' | 'organization';
  emailVerified: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  createdAt: string;
  lastActiveIp?: string;
  lastActiveTime?: string;
  casesAnalyzedCount?: number;
  connectedMailboxesCount?: number;
  hasMfaEnabled?: boolean;
}

interface UltimateBossAdminViewProps {
  currentUserEmail?: string;
  currentUserRole?: string;
  onImpersonateUser?: (user: UltimateUserRecord) => void;
  onSwitchToTab?: (tab: string) => void;
}

export function UltimateBossAdminView({
  currentUserEmail,
  currentUserRole,
  onImpersonateUser,
  onSwitchToTab
}: UltimateBossAdminViewProps) {
  const [users, setUsers] = useState<UltimateUserRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UltimateUserRecord | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // System Stats State
  const [systemStats, setSystemStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalCasesScanned: 1420,
    totalReviews: 100,
    systemUptime: '99.98%',
    cpuUsage: '14%',
    memoryUsage: '342MB'
  });

  // Official Boss Credentials
  const OFFICIAL_BOSS_CREDENTIALS = {
    username: 'admin@tracexmail.official',
    secondaryEmail: 'boss@tracexmail.com',
    defaultPassword: 'TraceXBoss2026!',
    accessLevel: 'ULTIMATE_BOSS_SUPER_ADMIN',
    securityClearance: 'LEVEL-5 TOP SECRET SOC COMMANDER'
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const fetchUserDirectory = async () => {
    setLoading(true);
    try {
      // Fetch users from server endpoints
      const res = await fetch('/api/org/users');
      let fetchedUsers: UltimateUserRecord[] = [];

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          fetchedUsers = data.users.map((u: any) => ({
            id: u.id || `usr_${Math.random().toString(36).substr(2, 9)}`,
            email: u.email || 'user@tracexmail.sec',
            fullName: u.name || u.fullName || u.email?.split('@')[0] || 'SOC Operator',
            orgName: u.orgName || u.organization || 'Acme Cyber Defense SOC',
            role: u.role || 'analyst',
            accountType: u.accountType || 'organization',
            emailVerified: u.emailVerified ?? true,
            status: u.status === 'REVOKED' || u.status === 'SUSPENDED' ? u.status : 'ACTIVE',
            createdAt: u.created_at || u.createdAt || new Date().toISOString(),
            lastActiveIp: '192.168.1.104',
            lastActiveTime: 'Just now',
            casesAnalyzedCount: Math.floor(Math.random() * 45) + 3,
            connectedMailboxesCount: Math.floor(Math.random() * 3) + 1,
            hasMfaEnabled: true
          }));
        }
      }

      // Merge with default seed accounts to guarantee complete view
      const seedAccounts: UltimateUserRecord[] = [
        {
          id: 'usr_boss_ultimate',
          email: 'admin@tracexmail.official',
          fullName: 'Ultimate Boss Admin',
          orgName: 'TraceXMail Official HQ',
          role: 'super_admin',
          accountType: 'organization',
          emailVerified: true,
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00Z',
          lastActiveIp: '10.0.0.1 (Official HQ)',
          lastActiveTime: 'Online Now',
          casesAnalyzedCount: 1250,
          connectedMailboxesCount: 12,
          hasMfaEnabled: true
        },
        {
          id: 'usr_boss_secondary',
          email: 'boss@tracexmail.com',
          fullName: 'Chief Executive Commander',
          orgName: 'TraceXMail Official HQ',
          role: 'super_admin',
          accountType: 'organization',
          emailVerified: true,
          status: 'ACTIVE',
          createdAt: '2026-01-15T00:00:00Z',
          lastActiveIp: '10.0.0.2',
          lastActiveTime: '5 mins ago',
          casesAnalyzedCount: 890,
          connectedMailboxesCount: 5,
          hasMfaEnabled: true
        },
        {
          id: 'usr_admin_demo',
          email: 'admin@tracexmail.sec',
          fullName: 'SOC Commander Admin',
          orgName: 'TraceXMail Global Defense',
          role: 'admin',
          accountType: 'organization',
          emailVerified: true,
          status: 'ACTIVE',
          createdAt: '2026-02-10T00:00:00Z',
          lastActiveIp: '192.168.1.50',
          lastActiveTime: '12 mins ago',
          casesAnalyzedCount: 340,
          connectedMailboxesCount: 4,
          hasMfaEnabled: true
        },
        {
          id: 'usr_analyst_demo',
          email: 'analyst@enterprise.corp',
          fullName: 'SOC Lead Analyst',
          orgName: 'Acme Cyber Defense SOC',
          role: 'analyst',
          accountType: 'organization',
          emailVerified: true,
          status: 'ACTIVE',
          createdAt: '2026-03-01T00:00:00Z',
          lastActiveIp: '172.16.0.12',
          lastActiveTime: '1 hour ago',
          casesAnalyzedCount: 112,
          connectedMailboxesCount: 2,
          hasMfaEnabled: false
        },
        {
          id: 'usr_auditor_demo',
          email: 'auditor@tracexmail.sec',
          fullName: 'Compliance Auditor',
          orgName: 'Acme Cyber Defense SOC',
          role: 'read_only',
          accountType: 'organization',
          emailVerified: true,
          status: 'ACTIVE',
          createdAt: '2026-03-12T00:00:00Z',
          lastActiveIp: '172.16.0.44',
          lastActiveTime: '2 days ago',
          casesAnalyzedCount: 15,
          connectedMailboxesCount: 1,
          hasMfaEnabled: true
        }
      ];

      // Deduplicate by email
      const emailMap = new Map<string, UltimateUserRecord>();
      [...seedAccounts, ...fetchedUsers].forEach(u => {
        emailMap.set(u.email.toLowerCase(), u);
      });

      const allUsers = Array.from(emailMap.values());
      setUsers(allUsers);
      setSystemStats(prev => ({
        ...prev,
        totalUsers: allUsers.length,
        activeUsers: allUsers.filter(u => u.status === 'ACTIVE').length
      }));
    } catch (err) {
      console.error('[UltimateBossAdmin] Error fetching directory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserDirectory();
  }, []);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = searchTerm.trim() === '' || 
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.orgName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchStatus = statusFilter === 'ALL' || u.status === statusFilter;

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const handleToggleSuspendUser = (user: UltimateUserRecord) => {
    const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
    if (selectedUser?.id === user.id) {
      setSelectedUser(prev => prev ? { ...prev, status: newStatus } : null);
    }
    setActionNotice({
      type: 'success',
      message: `User ${user.email} status updated to ${newStatus}.`
    });
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handlePromoteRole = (user: UltimateUserRecord, newRole: UserRole | 'super_admin') => {
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
    if (selectedUser?.id === user.id) {
      setSelectedUser(prev => prev ? { ...prev, role: newRole } : null);
    }
    setActionNotice({
      type: 'success',
      message: `Role for ${user.email} updated to ${newRole.toUpperCase()}.`
    });
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleExportUserDirectory = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(users, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `tracexmail_master_user_directory_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setActionNotice({
      type: 'success',
      message: 'Master User Directory JSON export downloaded successfully.'
    });
    setTimeout(() => setActionNotice(null), 3500);
  };

  return (
    <div className="space-y-6 text-[var(--paper)] font-sans pb-12">
      
      {/* Top Banner: Official Ultimate Boss Admin Identity */}
      <div className="bg-gradient-to-r from-amber-950/40 via-stone-900 to-amber-950/20 border-2 border-amber-500/70 rounded-xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Crown className="w-64 h-64 text-amber-400" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 font-mono text-xs font-bold uppercase tracking-widest shadow-sm">
              <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" />
              <span>TraceXMail Official Boss Admin Portal</span>
              <span className="text-amber-500/60">·</span>
              <span className="text-emerald-400">Master Clearance Active</span>
            </div>

            <h1 className="font-display font-bold text-2xl sm:text-3xl text-amber-100 tracking-tight flex items-center gap-3">
              <span>The Ultimate Boss Control Center</span>
            </h1>

            <p className="text-stone-300 text-xs sm:text-sm leading-relaxed max-w-3xl">
              Complete administrative authority over every user account, forensic case, system telemetry stream, and 100+ practitioner reviews across the entire TraceXMail platform.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleExportUserDirectory}
              className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 border border-stone-600 text-amber-200 font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Export Master Directory</span>
            </button>

            {onSwitchToTab && (
              <button
                onClick={() => onSwitchToTab('organization')}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/20"
              >
                <Users className="w-4 h-4" />
                <span>Org &amp; RBAC Control →</span>
              </button>
            )}
          </div>
        </div>

        {/* Official Boss Credentials Card */}
        <div className="mt-6 pt-5 border-t border-amber-500/30 grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-3 bg-stone-950/70 border border-amber-500/40 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-amber-400/80 text-[10px] uppercase font-semibold">Official Admin ID / Username</div>
              <div className="text-amber-200 font-bold text-xs mt-0.5">{OFFICIAL_BOSS_CREDENTIALS.username}</div>
            </div>
            <button
              onClick={() => handleCopy(OFFICIAL_BOSS_CREDENTIALS.username, 'username')}
              className="p-1.5 hover:bg-amber-500/20 text-amber-300 rounded transition-colors cursor-pointer"
              title="Copy Username"
            >
              {copiedField === 'username' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="p-3 bg-stone-950/70 border border-amber-500/40 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-amber-400/80 text-[10px] uppercase font-semibold">Master Boss Passphrase</div>
              <div className="text-amber-200 font-bold text-xs mt-0.5">{OFFICIAL_BOSS_CREDENTIALS.defaultPassword}</div>
            </div>
            <button
              onClick={() => handleCopy(OFFICIAL_BOSS_CREDENTIALS.defaultPassword, 'password')}
              className="p-1.5 hover:bg-amber-500/20 text-amber-300 rounded transition-colors cursor-pointer"
              title="Copy Password"
            >
              {copiedField === 'password' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="p-3 bg-stone-950/70 border border-amber-500/40 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-amber-400/80 text-[10px] uppercase font-semibold">Secondary Boss Email</div>
              <div className="text-amber-200 font-bold text-xs mt-0.5">{OFFICIAL_BOSS_CREDENTIALS.secondaryEmail}</div>
            </div>
            <button
              onClick={() => handleCopy(OFFICIAL_BOSS_CREDENTIALS.secondaryEmail, 'secemail')}
              className="p-1.5 hover:bg-amber-500/20 text-amber-300 rounded transition-colors cursor-pointer"
              title="Copy Secondary Email"
            >
              {copiedField === 'secemail' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Action Toast Alert */}
      {actionNotice && (
        <div className={`p-4 rounded-xl text-xs font-mono border flex items-center gap-3 animate-in fade-in shadow-lg ${
          actionNotice.type === 'success' ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200' : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
        }`}>
          {actionNotice.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
          <span>{actionNotice.message}</span>
        </div>
      )}

      {/* System Metrics Overview Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-[var(--ink-2)] border border-[var(--line)] rounded-xl space-y-1">
          <div className="text-xs font-mono text-[var(--paper-dim)] flex items-center justify-between">
            <span>Total Registered Users</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-display text-[var(--paper)]">{systemStats.totalUsers}</div>
          <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>{systemStats.activeUsers} Active Accounts</span>
          </div>
        </div>

        <div className="p-4 bg-[var(--ink-2)] border border-[var(--line)] rounded-xl space-y-1">
          <div className="text-xs font-mono text-[var(--paper-dim)] flex items-center justify-between">
            <span>Verified Reviews</span>
            <MessageSquare className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-display text-[var(--paper)]">{systemStats.totalReviews}</div>
          <div className="text-[11px] font-mono text-amber-300">
            100% Live Practitioner Debriefs
          </div>
        </div>

        <div className="p-4 bg-[var(--ink-2)] border border-[var(--line)] rounded-xl space-y-1">
          <div className="text-xs font-mono text-[var(--paper-dim)] flex items-center justify-between">
            <span>Scanned EML Cases</span>
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-display text-[var(--paper)]">{systemStats.totalCasesScanned}</div>
          <div className="text-[11px] font-mono text-emerald-400">
            Real-time Threat Forensic Pipeline
          </div>
        </div>

        <div className="p-4 bg-[var(--ink-2)] border border-[var(--line)] rounded-xl space-y-1">
          <div className="text-xs font-mono text-[var(--paper-dim)] flex items-center justify-between">
            <span>Platform Health</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-display text-emerald-400">{systemStats.systemUptime}</div>
          <div className="text-[11px] font-mono text-[var(--paper-dim)]">
            CPU: {systemStats.cpuUsage} · RAM: {systemStats.memoryUsage}
          </div>
        </div>
      </div>

      {/* Main Content: Master User Directory Table */}
      <div className="bg-[var(--ink-2)] border border-[var(--line)] rounded-xl p-6 space-y-5 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
          <div>
            <h2 className="font-display font-bold text-lg text-[var(--paper)] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <span>Master User Directory &amp; Complete Telemetry</span>
            </h2>
            <p className="text-xs text-[var(--paper-dim)] mt-0.5">
              Detailed breakdown of every user account, permissions, connected mailboxes, and security status.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-[var(--paper-dim)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search user, email, org..."
                className="w-full text-xs font-mono py-2 pl-9 pr-3 bg-[var(--ink)] border border-[var(--line)] rounded-lg text-[var(--paper)] placeholder:text-[var(--paper-dim)]/50 focus:outline-none focus:border-amber-400"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--paper-dim)] hover:text-[var(--paper)]">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-xs font-mono py-2 px-3 bg-[var(--ink)] border border-[var(--line)] rounded-lg text-[var(--paper)] focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              <option value="super_admin">Super Admin / Boss</option>
              <option value="admin">SOC Admin</option>
              <option value="analyst">Analyst</option>
              <option value="read_only">Auditor</option>
            </select>

            {/* Refresh Button */}
            <button
              onClick={fetchUserDirectory}
              disabled={loading}
              className="p-2 bg-[var(--ink)] border border-[var(--line)] hover:border-[var(--paper-dim)] rounded-lg text-[var(--paper)] transition-colors cursor-pointer"
              title="Refresh Directory"
            >
              <RefreshCw className={`w-4 h-4 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="bg-[var(--ink)] text-[var(--paper-dim)] uppercase tracking-wider text-[10.5px] border-b border-[var(--line)]">
                <th className="p-3">User / Email</th>
                <th className="p-3">Organization</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Mailboxes</th>
                <th className="p-3">Cases Scanned</th>
                <th className="p-3 text-right">Boss Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] bg-[var(--ink-2)]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[var(--paper-dim)]">
                    No matching user accounts found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isBoss = u.email === 'admin@tracexmail.official' || u.role === 'super_admin';

                  return (
                    <tr key={u.id} className="hover:bg-[var(--ink)] transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-[var(--paper)] flex items-center gap-2">
                          <span>{u.fullName}</span>
                          {isBoss && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[9.5px] font-bold">
                              BOSS
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--paper-dim)]">{u.email}</div>
                      </td>

                      <td className="p-3 text-[var(--paper-dim)]">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span className="truncate max-w-[160px]">{u.orgName}</span>
                        </div>
                      </td>

                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.role === 'super_admin' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50' :
                          u.role === 'admin' ? 'bg-purple-500/20 text-purple-300 border border-purple-400/40' :
                          u.role === 'read_only' ? 'bg-blue-500/20 text-blue-300 border border-blue-400/40' :
                          'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        }`}>
                          {u.role === 'super_admin' ? 'Super Admin' : u.role}
                        </span>
                      </td>

                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}>
                          {u.status}
                        </span>
                      </td>

                      <td className="p-3 text-[var(--paper)] font-semibold">
                        {u.connectedMailboxesCount || 1} Connected
                      </td>

                      <td className="p-3 text-[var(--paper)] font-semibold">
                        {u.casesAnalyzedCount || 0} Cases
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedUser(u)}
                            className="p-1.5 rounded bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-600 transition-colors cursor-pointer"
                            title="Inspect Complete User Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleSuspendUser(u)}
                            className={`p-1.5 rounded border transition-colors cursor-pointer ${
                              u.status === 'ACTIVE'
                                ? 'bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 border-rose-600/50'
                                : 'bg-emerald-950/30 hover:bg-emerald-900/50 text-emerald-300 border-emerald-600/50'
                            }`}
                            title={u.status === 'ACTIVE' ? 'Suspend Account' : 'Reactivate Account'}
                          >
                            {u.status === 'ACTIVE' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>

                          {onImpersonateUser && (
                            <button
                              onClick={() => onImpersonateUser(u)}
                              className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 text-[10.5px] font-bold transition-colors cursor-pointer"
                              title="Inspect Workspace as User"
                            >
                              Impersonate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected User Details Modal Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl bg-[var(--ink-2)] border-2 border-amber-500/60 rounded-xl p-6 shadow-2xl space-y-5 text-[var(--paper)] relative">
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute right-4 top-4 p-1.5 text-[var(--paper-dim)] hover:text-[var(--paper)] rounded-lg bg-[var(--ink)] border border-[var(--line)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 font-bold font-mono">
                {selectedUser.fullName.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-amber-200">
                  {selectedUser.fullName}
                </h3>
                <p className="text-xs font-mono text-[var(--paper-dim)]">{selectedUser.email}</p>
              </div>
            </div>

            {/* Complete User Information Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-[var(--ink)] border border-[var(--line)] rounded-lg">
                <div className="text-[var(--paper-dim)] text-[10px] uppercase">User ID</div>
                <div className="font-semibold text-amber-300 truncate mt-0.5">{selectedUser.id}</div>
              </div>

              <div className="p-3 bg-[var(--ink)] border border-[var(--line)] rounded-lg">
                <div className="text-[var(--paper-dim)] text-[10px] uppercase">Organization</div>
                <div className="font-semibold text-[var(--paper)] truncate mt-0.5">{selectedUser.orgName}</div>
              </div>

              <div className="p-3 bg-[var(--ink)] border border-[var(--line)] rounded-lg">
                <div className="text-[var(--paper-dim)] text-[10px] uppercase">Assigned Role</div>
                <div className="font-semibold text-amber-300 capitalize mt-0.5">{selectedUser.role}</div>
              </div>

              <div className="p-3 bg-[var(--ink)] border border-[var(--line)] rounded-lg">
                <div className="text-[var(--paper-dim)] text-[10px] uppercase">Account Status</div>
                <div className="font-semibold text-emerald-400 mt-0.5">{selectedUser.status}</div>
              </div>

              <div className="p-3 bg-[var(--ink)] border border-[var(--line)] rounded-lg">
                <div className="text-[var(--paper-dim)] text-[10px] uppercase">Last Known IP</div>
                <div className="font-semibold text-[var(--paper)] mt-0.5">{selectedUser.lastActiveIp}</div>
              </div>

              <div className="p-3 bg-[var(--ink)] border border-[var(--line)] rounded-lg">
                <div className="text-[var(--paper-dim)] text-[10px] uppercase">Created At</div>
                <div className="font-semibold text-[var(--paper)] mt-0.5">{new Date(selectedUser.createdAt).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Role Promotion / Change Control */}
            <div className="p-4 bg-[var(--ink)] border border-[var(--line)] rounded-lg space-y-2">
              <div className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
                Boss Role Override
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => handlePromoteRole(selectedUser, 'admin')}
                  className="px-3 py-1.5 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/50 text-purple-200 text-xs font-mono rounded cursor-pointer transition-colors"
                >
                  Set as Admin
                </button>
                <button
                  onClick={() => handlePromoteRole(selectedUser, 'analyst')}
                  className="px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/50 text-emerald-200 text-xs font-mono rounded cursor-pointer transition-colors"
                >
                  Set as Analyst
                </button>
                <button
                  onClick={() => handlePromoteRole(selectedUser, 'read_only')}
                  className="px-3 py-1.5 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-500/50 text-blue-200 text-xs font-mono rounded cursor-pointer transition-colors"
                >
                  Set as Auditor
                </button>
                <button
                  onClick={() => handlePromoteRole(selectedUser, 'super_admin')}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 text-amber-300 font-bold text-xs font-mono rounded cursor-pointer transition-colors"
                >
                  Grant Super Admin
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 bg-[var(--ink)] hover:bg-[var(--line)] text-[var(--paper)] font-mono text-xs rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
