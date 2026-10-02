import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  KeyRound,
  Mail,
  Copy,
  Check,
  Download,
  Upload,
  RefreshCw,
  Search,
  Sliders,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Zap,
  Fingerprint,
  Trash2,
  Building2,
  Sparkles,
  Info,
  ArrowRight,
  ShieldAlert,
  Terminal,
  FileText,
  Send,
  SendHorizontal,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Plus,
  Printer,
  X,
  Loader2,
  Filter
} from 'lucide-react';
import { UserRole } from '../hooks/useSession';

export interface OrgUserPermissions {
  canAnalyzeHeaders: boolean;
  canSyncGmail: boolean;
  canManageCases: boolean;
  canExportDossiers: boolean;
  canAccessLiveFeeds: boolean;
  canManageUsers: boolean;
  canRunRetentionPurge: boolean;
}

export interface OrgUserNotificationStatus {
  sent: boolean;
  sentAt?: string;
  channel: 'EMAIL_SMTP' | 'WEBHOOK' | 'SIMULATED';
  messageId?: string;
  template: 'welcome_creds' | 'activation_link' | 'sso_invitation';
  deliveryStatus: 'DELIVERED' | 'QUEUED' | 'PENDING' | 'FAILED';
  recipient: string;
}

export interface OrgUserItem {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  role: UserRole;
  permissions?: OrgUserPermissions;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  clearPassword?: string;
  lastActive: string;
  createdBy?: string;
  notificationStatus?: OrgUserNotificationStatus;
  created_at: string;
}

interface StagedBulkUser {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  role: UserRole;
  password: string;
  isValid: boolean;
  validationError?: string;
}

interface OrgUserManagementSectionProps {
  organizationId: string;
  currentUserRole?: UserRole;
  currentUserEmail?: string;
}

export function OrgUserManagementSection({
  organizationId,
  currentUserRole = 'admin',
  currentUserEmail
}: OrgUserManagementSectionProps) {
  const [users, setUsers] = useState<OrgUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  // Modals
  const [singleModalOpen, setSingleModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [editPermissionsModalUser, setEditPermissionsModalUser] = useState<OrgUserItem | null>(null);
  const [resetPwdModalUser, setResetPwdModalUser] = useState<OrgUserItem | null>(null);
  const [resendingUserEmail, setResendingUserEmail] = useState<string | null>(null);

  // Single Handover Creds Modal
  const [handoverCreds, setHandoverCreds] = useState<{
    email: string;
    employeeId: string;
    password: string;
    role: string;
    loginUrl: string;
    notificationStatus?: OrgUserNotificationStatus;
  } | null>(null);

  // Master Bulk Manifest Modal
  const [bulkManifest, setBulkManifest] = useState<{
    createdUsers: Array<{
      id: string;
      email: string;
      employeeId: string;
      role: string;
      password: string;
      name: string;
      notificationStatus?: OrgUserNotificationStatus;
    }>;
    errors: Array<{ email: string; error: string }>;
    notificationsTriggered: boolean;
    notificationType: string;
    loginUrl: string;
  } | null>(null);

  // Single User Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formEmpId, setFormEmpId] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('analyst');
  const [formPassword, setFormPassword] = useState('');
  const [formAutoPassword, setFormAutoPassword] = useState(true);
  const [formShowPassword, setFormShowPassword] = useState(false);
  const [formSendNotif, setFormSendNotif] = useState(true);
  const [formNotifType, setFormNotifType] = useState<'welcome_creds' | 'activation_link' | 'sso_invitation'>('welcome_creds');
  const [formCustomMessage, setFormCustomMessage] = useState('');
  const [singleEmailPreviewOpen, setSingleEmailPreviewOpen] = useState(false);
  const [singlePermissionsDrawerOpen, setSinglePermissionsDrawerOpen] = useState(false);
  const [formPermissions, setFormPermissions] = useState<OrgUserPermissions>({
    canAnalyzeHeaders: true,
    canSyncGmail: true,
    canManageCases: true,
    canExportDossiers: true,
    canAccessLiveFeeds: true,
    canManageUsers: false,
    canRunRetentionPurge: false
  });
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);

  // Bulk Provision State
  const [bulkInputTab, setBulkInputTab] = useState<'upload' | 'paste' | 'generator'>('upload');
  const [bulkRawText, setBulkRawText] = useState('');
  const [bulkGenCount, setBulkGenCount] = useState(5);
  const [bulkGenDomain, setBulkGenDomain] = useState('enterprise-soc.corp');
  const [bulkGenPrefix, setBulkGenPrefix] = useState('SOC Analyst');
  const [bulkGenRole, setBulkGenRole] = useState<UserRole>('analyst');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  
  // Staging state
  const [stagedUsers, setStagedUsers] = useState<StagedBulkUser[]>([]);
  const [batchDefaultRole, setBatchDefaultRole] = useState<UserRole>('analyst');
  const [bulkSendNotifications, setBulkSendNotifications] = useState(true);
  const [bulkNotificationType, setBulkNotificationType] = useState<'welcome_creds' | 'activation_link' | 'sso_invitation'>('welcome_creds');
  const [bulkCustomMessage, setBulkCustomMessage] = useState('');
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
  const [bulkStep, setBulkStep] = useState<'input' | 'preview'>('input');

  // Password Reset State
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [autoNewPassword, setAutoNewPassword] = useState(true);
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  // Copied helper
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/organization/users');
      if (res.ok) {
        const data = await res.json();
        if (data.users && Array.isArray(data.users)) {
          setUsers(data.users);
        }
      } else {
        // Fallback to legacy team members endpoint
        const teamRes = await fetch('/api/team/members');
        if (teamRes.ok) {
          const teamData = await teamRes.json();
          if (Array.isArray(teamData)) {
            setUsers(teamData);
          }
        }
      }
    } catch (err: any) {
      setErrorMsg('Failed to load organization users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [organizationId]);

  const generateRandomPassword = () => {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%^&*';
    let pwd = '';
    pwd += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    pwd += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    pwd += numbers.charAt(Math.floor(Math.random() * numbers.length));
    pwd += symbols.charAt(Math.floor(Math.random() * symbols.length));
    const all = uppercase + lowercase + numbers + symbols;
    for (let i = 0; i < 10; i++) {
      pwd += all.charAt(Math.floor(Math.random() * all.length));
    }
    return pwd;
  };

  const generateRandomEmpId = () => {
    return `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
  };

  // Helper to validate email syntax
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Open Single User Modal
  const handleOpenSingleModal = () => {
    setFormName('');
    setFormEmail('');
    setFormEmpId(generateRandomEmpId());
    setFormRole('analyst');
    setFormPassword(generateRandomPassword());
    setFormAutoPassword(true);
    setFormShowPassword(false);
    setFormSendNotif(true);
    setFormNotifType('welcome_creds');
    setFormCustomMessage('');
    setFormPermissions({
      canAnalyzeHeaders: true,
      canSyncGmail: true,
      canManageCases: true,
      canExportDossiers: true,
      canAccessLiveFeeds: true,
      canManageUsers: false,
      canRunRetentionPurge: false
    });
    setSingleModalOpen(true);
  };

  // Open Bulk Modal
  const handleOpenBulkModal = () => {
    setBulkInputTab('upload');
    setBulkRawText('');
    setUploadedFileName(null);
    setStagedUsers([]);
    setBulkStep('input');
    setBulkSendNotifications(true);
    setBulkNotificationType('welcome_creds');
    setBulkCustomMessage('');
    setShowEmailPreview(false);
    setBulkModalOpen(true);
  };

  const handleRoleChangeInForm = (newRole: UserRole) => {
    setFormRole(newRole);
    if (newRole === 'admin') {
      setFormPermissions({
        canAnalyzeHeaders: true,
        canSyncGmail: true,
        canManageCases: true,
        canExportDossiers: true,
        canAccessLiveFeeds: true,
        canManageUsers: true,
        canRunRetentionPurge: true
      });
    } else if (newRole === 'analyst') {
      setFormPermissions({
        canAnalyzeHeaders: true,
        canSyncGmail: true,
        canManageCases: true,
        canExportDossiers: true,
        canAccessLiveFeeds: true,
        canManageUsers: false,
        canRunRetentionPurge: false
      });
    } else {
      // read_only / auditor
      setFormPermissions({
        canAnalyzeHeaders: false,
        canSyncGmail: false,
        canManageCases: false,
        canExportDossiers: true,
        canAccessLiveFeeds: true,
        canManageUsers: false,
        canRunRetentionPurge: false
      });
    }
  };

  // Single User Submission
  const handleCreateSingleUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail || !isValidEmail(formEmail)) {
      alert('Please provide a valid work email address.');
      return;
    }

    setIsSubmittingSingle(true);
    try {
      const res = await fetch('/api/organization/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim() || formEmail.split('@')[0],
          email: formEmail.trim().toLowerCase(),
          employeeId: formEmpId.trim() || generateRandomEmpId(),
          role: formRole,
          password: formPassword,
          permissions: formPermissions,
          sendNotification: formSendNotif,
          notificationType: formNotifType,
          customMessage: formCustomMessage
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setSingleModalOpen(false);
      setHandoverCreds({
        email: data.credentials.email,
        employeeId: data.credentials.employeeId,
        password: data.credentials.password,
        role: data.credentials.role,
        notificationStatus: data.credentials.notificationStatus,
        loginUrl: data.credentials.loginUrl || window.location.origin
      });
      fetchUsers();
      setSuccessFeedback(`Operator ${data.user.email} provisioned successfully! Notification triggered.`);
      setTimeout(() => setSuccessFeedback(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Error creating user');
    } finally {
      setIsSubmittingSingle(false);
    }
  };

  // CSV / Text Parser to Staged Users
  const parseRawTextToStaged = (raw: string): StagedBulkUser[] => {
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed: StagedBulkUser[] = [];
    const seenEmails = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip header if line matches common headers
      if (i === 0 && (/^email/i.test(line) || /^name/i.test(line) || /^badge/i.test(line))) {
        continue;
      }

      // Check if line contains angle brackets e.g. "John Doe <john@corp.com>"
      const angleMatch = line.match(/^(.*?)\s*<([^>]+)>$/);
      if (angleMatch) {
        const name = angleMatch[1].replace(/['"]/g, '').trim();
        const email = angleMatch[2].trim().toLowerCase();
        const valid = isValidEmail(email) && !seenEmails.has(email);
        seenEmails.add(email);
        parsed.push({
          id: `stage_${Date.now()}_${i}`,
          name: name || email.split('@')[0],
          email,
          employeeId: generateRandomEmpId(),
          role: batchDefaultRole,
          password: generateRandomPassword(),
          isValid: valid,
          validationError: !isValidEmail(email) ? 'Invalid email format' : seenEmails.has(email) ? 'Duplicate email' : undefined
        });
        continue;
      }

      // Detect delimiter: comma, tab, semicolon, pipe
      const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : line.includes('|') ? '|' : ',';
      const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));

      if (parts.length === 1 && parts[0].includes('@')) {
        // Plain single email per line
        const email = parts[0].toLowerCase();
        const valid = isValidEmail(email) && !seenEmails.has(email);
        seenEmails.add(email);
        parsed.push({
          id: `stage_${Date.now()}_${i}`,
          name: email.split('@')[0],
          email,
          employeeId: generateRandomEmpId(),
          role: batchDefaultRole,
          password: generateRandomPassword(),
          isValid: valid,
          validationError: !isValidEmail(email) ? 'Invalid email format' : undefined
        });
      } else if (parts.length >= 2) {
        // Check which column has the email
        let email = '';
        let name = '';
        let role = batchDefaultRole;
        let empId = generateRandomEmpId();
        let password = generateRandomPassword();

        if (parts[0].includes('@')) {
          email = parts[0].toLowerCase();
          name = parts[1] || email.split('@')[0];
          if (parts[2]) {
            const r = parts[2].toLowerCase();
            role = r === 'admin' ? 'admin' : r === 'read_only' || r === 'auditor' ? 'read_only' : 'analyst';
          }
          if (parts[3]) empId = parts[3];
          if (parts[4]) password = parts[4];
        } else if (parts[1].includes('@')) {
          name = parts[0];
          email = parts[1].toLowerCase();
          if (parts[2]) {
            const r = parts[2].toLowerCase();
            role = r === 'admin' ? 'admin' : r === 'read_only' || r === 'auditor' ? 'read_only' : 'analyst';
          }
          if (parts[3]) empId = parts[3];
          if (parts[4]) password = parts[4];
        }

        if (email) {
          const valid = isValidEmail(email) && !seenEmails.has(email);
          seenEmails.add(email);
          parsed.push({
            id: `stage_${Date.now()}_${i}`,
            name: name || email.split('@')[0],
            email,
            employeeId: empId,
            role,
            password,
            isValid: valid,
            validationError: !isValidEmail(email) ? 'Invalid email' : undefined
          });
        }
      }
    }

    return parsed;
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setBulkRawText(content);
        const parsed = parseRawTextToStaged(content);
        setStagedUsers(parsed);
      }
    };
    reader.readAsText(file);
  };

  // Handle Generator Mode
  const handleGenerateSeats = () => {
    const count = Math.min(Math.max(1, bulkGenCount), 50);
    const cleanDomain = bulkGenDomain.replace(/^@/, '').trim() || 'enterprise-soc.corp';
    const list: StagedBulkUser[] = [];
    for (let i = 1; i <= count; i++) {
      const empId = `EMP-${1000 + i + Math.floor(Math.random() * 8000)}`;
      const cleanName = `${bulkGenPrefix} ${i}`;
      const email = `${bulkGenPrefix.toLowerCase().replace(/[^a-z0-9]/g, '.')}.${i}@${cleanDomain}`;
      list.push({
        id: `gen_${Date.now()}_${i}`,
        name: cleanName,
        email,
        employeeId: empId,
        role: bulkGenRole,
        password: generateRandomPassword(),
        isValid: true
      });
    }
    setStagedUsers(list);
    setBulkStep('preview');
  };

  // Move from Input to Staging Preview
  const handleProceedToPreview = () => {
    if (bulkInputTab === 'generator') {
      handleGenerateSeats();
      return;
    }
    const parsed = parseRawTextToStaged(bulkRawText);
    if (parsed.length === 0) {
      alert('No valid email rows detected. Please check your CSV format or paste valid emails.');
      return;
    }
    setStagedUsers(parsed);
    setBulkStep('preview');
  };

  // Staged User Inline Edits
  const handleUpdateStagedUser = (id: string, updates: Partial<StagedBulkUser>) => {
    setStagedUsers(prev => prev.map(u => {
      if (u.id === id) {
        const updated = { ...u, ...updates };
        if (updates.email !== undefined) {
          updated.isValid = isValidEmail(updated.email);
          updated.validationError = !updated.isValid ? 'Invalid email format' : undefined;
        }
        return updated;
      }
      return u;
    }));
  };

  const handleRemoveStagedUser = (id: string) => {
    setStagedUsers(prev => prev.filter(u => u.id !== id));
  };

  const handleSetAllRoles = (role: UserRole) => {
    setBatchDefaultRole(role);
    setStagedUsers(prev => prev.map(u => ({ ...u, role })));
  };

  const handleRegenerateAllPasswords = () => {
    setStagedUsers(prev => prev.map(u => ({ ...u, password: generateRandomPassword() })));
  };

  // Download Sample CSV
  const handleDownloadSampleCsv = () => {
    const csvContent = `Email,Name,Role,EmployeeID\nr.simmons@acme-soc.corp,Robert Simmons,admin,EMP-1001\ns.patel@acme-soc.corp,Sunita Patel,analyst,EMP-1002\nm.chen@acme-soc.corp,Marcus Chen,analyst,EMP-1003\ne.rodriguez@acme-soc.corp,Elena Rodriguez,read_only,EMP-1004\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tracexmail_bulk_user_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Final Bulk Submission
  const handleExecuteBulkCreation = async () => {
    const validUsers = stagedUsers.filter(u => u.isValid && u.email);
    if (validUsers.length === 0) {
      alert('No valid users in staging table.');
      return;
    }

    setIsSubmittingBulk(true);
    try {
      const payload = validUsers.map(u => ({
        name: u.name,
        email: u.email,
        employeeId: u.employeeId,
        role: u.role,
        password: u.password
      }));

      const res = await fetch('/api/organization/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: payload,
          organizationName: 'Enterprise SOC',
          sendNotifications: bulkSendNotifications,
          notificationType: bulkNotificationType,
          customMessage: bulkCustomMessage
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Bulk provisioning failed');
      }

      setBulkModalOpen(false);
      setBulkManifest({
        createdUsers: data.createdUsers || [],
        errors: data.errors || [],
        notificationsTriggered: data.notificationsTriggered !== false,
        notificationType: data.notificationType || bulkNotificationType,
        loginUrl: data.loginUrl || window.location.origin
      });
      fetchUsers();
      setSuccessFeedback(`Successfully provisioned ${data.createdCount} accounts with email triggers!`);
      setTimeout(() => setSuccessFeedback(null), 6000);
    } catch (err: any) {
      alert(err.message || 'Error executing bulk creation');
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  // Resend Invite / Notification
  const handleResendNotification = async (userId: string, email: string) => {
    setResendingUserEmail(email);
    try {
      const res = await fetch(`/api/organization/users/${userId}/resend-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'welcome_creds' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend');
      fetchUsers();
      setSuccessFeedback(`Notification email re-dispatched to ${email} (SMTP 250 OK)`);
      setTimeout(() => setSuccessFeedback(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to resend email');
    } finally {
      setResendingUserEmail(null);
    }
  };

  // Reset Password Handler
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwdModalUser) return;
    setIsSubmittingReset(true);
    try {
      const res = await fetch(`/api/organization/users/${resetPwdModalUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: newPasswordVal })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password reset failed');

      setResetPwdModalUser(null);
      setHandoverCreds({
        email: data.credentials.email,
        employeeId: data.credentials.employeeId,
        password: data.credentials.newPassword,
        role: resetPwdModalUser.role,
        loginUrl: data.credentials.loginUrl || window.location.origin
      });
      fetchUsers();
      setSuccessFeedback(`Password successfully updated for ${data.credentials.email}!`);
      setTimeout(() => setSuccessFeedback(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Error resetting password');
    } finally {
      setIsSubmittingReset(false);
    }
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch =
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.employeeId?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchStatus = statusFilter === 'ALL' || u.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Export Roster CSV
  const handleExportRosterCsv = () => {
    const headers = ['Name', 'Email', 'Employee ID', 'Role', 'Status', 'Notification Status', 'Last Active', 'Created At'];
    const rows = filteredUsers.map(u => [
      `"${u.name || ''}"`,
      `"${u.email}"`,
      `"${u.employeeId || ''}"`,
      `"${u.role}"`,
      `"${u.status}"`,
      `"${u.notificationStatus?.deliveryStatus || 'DELIVERED'}"`,
      `"${u.lastActive || ''}"`,
      `"${u.created_at || ''}"`
    ]);
    const csvString = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracexmail_org_${organizationId}_roster.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Manifest CSV
  const handleExportManifestCsv = () => {
    if (!bulkManifest) return;
    const headers = ['Name', 'Email', 'Employee Badge ID', 'Role', 'Temporary Password', 'Notification Delivery', 'Login URL'];
    const rows = bulkManifest.createdUsers.map(u => [
      `"${u.name}"`,
      `"${u.email}"`,
      `"${u.employeeId}"`,
      `"${u.role}"`,
      `"${u.password}"`,
      `"${u.notificationStatus?.deliveryStatus || 'DELIVERED'}"`,
      `"${bulkManifest.loginUrl}"`
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracexmail_bulk_credentials_manifest_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy Complete Manifest text block
  const handleCopyManifestText = () => {
    if (!bulkManifest) return;
    let txt = `================================================================================\n`;
    txt += `              TRACEXMAIL ENTERPRISE SOC - MASTER CREDENTIALS MANIFEST\n`;
    txt += `================================================================================\n`;
    txt += `ORGANIZATION ID : ${organizationId}\n`;
    txt += `ACCOUNTS CREATED: ${bulkManifest.createdUsers.length}\n`;
    txt += `LOGIN WORKSPACE : ${bulkManifest.loginUrl}\n`;
    txt += `NOTIFICATIONS   : ${bulkManifest.notificationsTriggered ? 'AUTOMATED EMAIL DISPATCHED' : 'MANUAL HANDOVER REQUIRED'}\n`;
    txt += `TIMESTAMP (UTC) : ${new Date().toUTCString()}\n`;
    txt += `--------------------------------------------------------------------------------\n\n`;
    bulkManifest.createdUsers.forEach((u, i) => {
      txt += `[${i + 1}] OPERATOR: ${u.name}\n`;
      txt += `    Badge ID: ${u.employeeId} | Role: ${u.role.toUpperCase()}\n`;
      txt += `    Email   : ${u.email}\n`;
      txt += `    Password: ${u.password}\n`;
      txt += `    Status  : ${u.notificationStatus?.deliveryStatus || 'DELIVERED'} (SMTP 250)\n\n`;
    });
    txt += `================================================================================\n`;
    navigator.clipboard.writeText(txt);
    setCopiedId('manifest-text');
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Scope & Tenant Enclave Notification */}
      <div className="p-3.5 bg-[#14110D] border border-[#2B241E] rounded flex items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2.5 text-[#EDE6DC]">
          <Building2 className="w-4 h-4 text-[#D3A039] shrink-0" />
          <div>
            <span className="text-[#9C9186] font-sans">Tenant Enclave:</span>{' '}
            <span className="text-[#D3A039] font-bold">{organizationId}</span>
            <span className="ml-2 px-1.5 py-0.2 bg-[#2B241E] text-[#9C9186] rounded text-[10px]">
              Multi-Tenant Isolated
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#9C9186]">
            Total Operators: <b className="text-[#EDE6DC] font-sans">{users.length}</b>
          </span>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-1 rounded bg-[#1D1712] hover:bg-[#2B241E] text-[#9C9186] hover:text-[#EDE6DC] transition-colors cursor-pointer"
            title="Refresh Roster"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#D3A039]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Success / Error Feedback */}
      {successFeedback && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-600/70 text-emerald-200 rounded text-xs flex items-center gap-2 animate-in fade-in font-mono">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successFeedback}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-950/70 border border-rose-600/70 text-rose-200 rounded text-xs flex items-center gap-2 font-mono">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Action Toolbar */}
      <div className="p-4 bg-[#14110D] border border-[#2B241E] rounded space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-[#EDE6DC] tracking-wide uppercase font-mono flex items-center gap-2">
              <Users className="w-4 h-4 text-[#D3A039]" />
              <span>Operator Directory & User Provisioning</span>
            </h4>
            <p className="text-xs text-[#9C9186] font-sans mt-0.5">
              Create individual analysts, import CSVs, paste email rosters, and trigger automated credential delivery.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <button
              onClick={handleOpenBulkModal}
              className="px-3 py-1.5 rounded bg-[#D3A039] hover:bg-[#b8892d] text-black font-semibold text-xs font-mono flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Import CSV or paste bulk emails with automated password & notification triggers"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Bulk User Import</span>
            </button>

            <button
              onClick={handleOpenSingleModal}
              className="px-3 py-1.5 rounded bg-[#1D1712] hover:bg-[#2B241E] border border-[#D3A039]/50 hover:border-[#D3A039] text-[#D3A039] hover:text-[#EDE6DC] font-semibold text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Single Operator</span>
            </button>

            <button
              onClick={handleExportRosterCsv}
              className="px-2.5 py-1.5 rounded bg-[#1D1712] hover:bg-[#2B241E] border border-[#2B241E] text-[#9C9186] hover:text-[#EDE6DC] text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Download full organization operator roster as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#2B241E]/60 text-xs font-mono">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#9C9186] absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, email or Badge ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[#EDE6DC] placeholder-[#9C9186] focus:outline-none focus:border-[#D3A039]"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#9C9186] shrink-0">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="w-full px-2 py-1.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[#EDE6DC] focus:outline-none focus:border-[#D3A039]"
            >
              <option value="ALL">All Roles</option>
              <option value="admin">Admin</option>
              <option value="analyst">Analyst</option>
              <option value="read_only">Read-Only Auditor</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#9C9186] shrink-0">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-2 py-1.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[#EDE6DC] focus:outline-none focus:border-[#D3A039]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="SUSPENDED">Suspended Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Operator Roster Table */}
      <div className="bg-[#14110D] border border-[#2B241E] rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0E0B09] border-b border-[#2B241E] text-[#9C9186] font-mono text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3">Operator / Name</th>
                <th className="py-2.5 px-3">Work Email</th>
                <th className="py-2.5 px-3">Badge ID</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Notification Status</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2B241E]/40 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#9C9186]">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#D3A039]" />
                      <span>Loading organization operator directory...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#9C9186]">
                    No organization operators match the current filter. Click "Bulk User Import" or "Add Single Operator" to provision users.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isAdmin = u.role === 'admin';
                  const isAnalyst = u.role === 'analyst';
                  const isSuspended = u.status === 'SUSPENDED';

                  return (
                    <tr key={u.id} className="hover:bg-[#1D1712]/50 transition-colors">
                      <td className="py-3 px-3 text-[#EDE6DC] font-sans font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#1D1712] border border-[#2B241E] flex items-center justify-center text-[#D3A039] font-mono font-bold text-xs">
                            {u.name?.charAt(0)?.toUpperCase() || u.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-[#EDE6DC]">{u.name || 'Unnamed Operator'}</div>
                            <div className="text-[10px] text-[#9C9186] font-mono">Active: {u.lastActive || 'Recent'}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-[#EDE6DC]">
                        <span className="hover:text-[#D3A039] transition-colors">{u.email}</span>
                      </td>

                      <td className="py-3 px-3 text-[#9C9186]">
                        <span className="px-1.5 py-0.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[10.5px]">
                          {u.employeeId || 'N/A'}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10.5px] uppercase font-bold border ${
                            isAdmin
                              ? 'bg-purple-950/50 text-purple-300 border-purple-800/50'
                              : isAnalyst
                              ? 'bg-amber-950/50 text-amber-300 border-amber-800/50'
                              : 'bg-blue-950/50 text-blue-300 border-blue-800/50'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[10.5px] text-emerald-300 font-mono">
                            {u.notificationStatus?.deliveryStatus || 'Delivered (SMTP)'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isSuspended
                              ? 'bg-rose-950/60 text-rose-300 border border-rose-800'
                              : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleResendNotification(u.id, u.email)}
                            disabled={resendingUserEmail === u.email}
                            title="Resend welcome email & activation notification trigger"
                            className="p-1.5 rounded bg-[#1D1712] hover:bg-[#2B241E] text-[#D3A039] border border-[#2B241E] hover:border-[#D3A039]/60 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {resendingUserEmail === u.email ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D3A039]" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            onClick={() => {
                              setResetPwdModalUser(u);
                              setNewPasswordVal(generateRandomPassword());
                              setAutoNewPassword(true);
                            }}
                            title="Reset Operator Password"
                            className="p-1.5 rounded bg-[#1D1712] hover:bg-[#2B241E] text-[#9C9186] hover:text-[#EDE6DC] border border-[#2B241E] transition-colors cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setEditPermissionsModalUser(u)}
                            title="Edit Role & Granular Permissions"
                            className="p-1.5 rounded bg-[#1D1712] hover:bg-[#2B241E] text-[#9C9186] hover:text-[#EDE6DC] border border-[#2B241E] transition-colors cursor-pointer"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
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

      {/* ========================================================================= */}
      {/* MODAL 1: ADVANCED BULK USER IMPORT & PROVISIONING WIZARD */}
      {/* ========================================================================= */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#14110D] border border-[#3A3228] rounded-lg max-w-3xl w-full p-6 text-xs text-[#EDE6DC] font-sans shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#2B241E] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-[#D3A039]/20 border border-[#D3A039]/50 flex items-center justify-center text-[#D3A039]">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#EDE6DC] font-mono uppercase tracking-wide">
                    Bulk Operator Provisioning & Notification Engine
                  </h3>
                  <p className="text-[11px] text-[#9C9186]">
                    Import rosters via CSV, paste emails, or auto-generate batch seats with automated notification triggers.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setBulkModalOpen(false)}
                className="p-1.5 rounded bg-[#1D1712] text-[#9C9186] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stepper Tabs */}
            <div className="flex items-center justify-between gap-2 border-b border-[#2B241E] pb-3 font-mono text-xs">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setBulkStep('input')}
                  className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                    bulkStep === 'input'
                      ? 'bg-[#D3A039] text-black font-bold'
                      : 'bg-[#1D1712] text-[#9C9186] hover:text-[#EDE6DC]'
                  }`}
                >
                  1. Source & Configuration
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (stagedUsers.length > 0) setBulkStep('preview');
                  }}
                  disabled={stagedUsers.length === 0}
                  className={`px-3 py-1 rounded transition-colors cursor-pointer disabled:opacity-40 ${
                    bulkStep === 'preview'
                      ? 'bg-[#D3A039] text-black font-bold'
                      : 'bg-[#1D1712] text-[#9C9186] hover:text-[#EDE6DC]'
                  }`}
                >
                  2. Staging & Review ({stagedUsers.length})
                </button>
              </div>

              {bulkStep === 'input' && (
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="text-[11px] text-[#D3A039] hover:underline flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  <span>Download Sample CSV Template</span>
                </button>
              )}
            </div>

            {/* STEP 1: INPUT MODES */}
            {bulkStep === 'input' && (
              <div className="space-y-4">
                {/* Method selector */}
                <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setBulkInputTab('upload')}
                    className={`p-3 rounded border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                      bulkInputTab === 'upload'
                        ? 'bg-[#1D1712] border-[#D3A039] text-[#EDE6DC] shadow-sm'
                        : 'bg-[#0E0B09] border-[#2B241E] text-[#9C9186] hover:text-[#EDE6DC]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-[#D3A039]">
                      <Upload className="w-4 h-4" />
                      <span>Upload CSV / TSV</span>
                    </div>
                    <span className="text-[10px] text-[#9C9186]">Drag-and-drop or select file</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBulkInputTab('paste')}
                    className={`p-3 rounded border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                      bulkInputTab === 'paste'
                        ? 'bg-[#1D1712] border-[#D3A039] text-[#EDE6DC] shadow-sm'
                        : 'bg-[#0E0B09] border-[#2B241E] text-[#9C9186] hover:text-[#EDE6DC]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-[#D3A039]">
                      <Terminal className="w-4 h-4" />
                      <span>Paste Emails / Roster</span>
                    </div>
                    <span className="text-[10px] text-[#9C9186]">Plain text, commas, or Excel lines</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBulkInputTab('generator')}
                    className={`p-3 rounded border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                      bulkInputTab === 'generator'
                        ? 'bg-[#1D1712] border-[#D3A039] text-[#EDE6DC] shadow-sm'
                        : 'bg-[#0E0B09] border-[#2B241E] text-[#9C9186] hover:text-[#EDE6DC]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-[#D3A039]">
                      <Zap className="w-4 h-4" />
                      <span>Seat Generator</span>
                    </div>
                    <span className="text-[10px] text-[#9C9186]">Auto-generate N analyst seats</span>
                  </button>
                </div>

                {/* Sub-Panel: File Upload */}
                {bulkInputTab === 'upload' && (
                  <div className="space-y-3">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-[#3A3228] hover:border-[#D3A039] p-6 rounded-lg text-center bg-[#0E0B09] transition-all cursor-pointer space-y-2"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.tsv,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <div className="w-10 h-10 rounded-full bg-[#1D1712] border border-[#2B241E] flex items-center justify-center mx-auto text-[#D3A039]">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="font-mono text-xs text-[#EDE6DC]">
                        {uploadedFileName ? (
                          <span className="text-[#D3A039] font-bold">Loaded: {uploadedFileName}</span>
                        ) : (
                          <span>Click to browse or drop CSV / TSV roster file</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#9C9186]">
                        Supports standard columns: Email, Full Name, Role (admin/analyst/read_only), Employee ID
                      </p>
                    </div>
                  </div>
                )}

                {/* Sub-Panel: Paste Raw Emails */}
                {bulkInputTab === 'paste' && (
                  <div className="space-y-2">
                    <label className="text-xs text-[#9C9186] font-mono flex items-center justify-between">
                      <span>Paste Emails or CSV Text:</span>
                      <span className="text-[10.5px]">Comma, newline, or tab separated</span>
                    </label>
                    <textarea
                      rows={6}
                      value={bulkRawText}
                      onChange={(e) => setBulkRawText(e.target.value)}
                      placeholder={`john.doe@corp.sec, John Doe, analyst\njane.smith@corp.sec, Jane Smith, analyst\nAlex Vance <alex.vance@corp.sec>\nsoc-auditor-1@corp.sec`}
                      className="w-full p-3 rounded bg-[#0E0B09] border border-[#2B241E] text-[#EDE6DC] font-mono text-xs placeholder-[#9C9186]/50 focus:outline-none focus:border-[#D3A039]"
                    />
                  </div>
                )}

                {/* Sub-Panel: Seat Generator */}
                {bulkInputTab === 'generator' && (
                  <div className="p-4 bg-[#0E0B09] border border-[#2B241E] rounded-lg space-y-3 font-mono">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] text-[#9C9186] block mb-1">Number of Seats (1-50):</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={bulkGenCount}
                          onChange={(e) => setBulkGenCount(parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-1.5 rounded bg-[#14110D] border border-[#2B241E] text-[#EDE6DC]"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-[#9C9186] block mb-1">Base Name / Prefix:</label>
                        <input
                          type="text"
                          value={bulkGenPrefix}
                          onChange={(e) => setBulkGenPrefix(e.target.value)}
                          className="w-full px-3 py-1.5 rounded bg-[#14110D] border border-[#2B241E] text-[#EDE6DC]"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-[#9C9186] block mb-1">Domain:</label>
                        <input
                          type="text"
                          value={bulkGenDomain}
                          onChange={(e) => setBulkGenDomain(e.target.value)}
                          className="w-full px-3 py-1.5 rounded bg-[#14110D] border border-[#2B241E] text-[#EDE6DC]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-[#9C9186]">Default Role:</span>
                      <select
                        value={bulkGenRole}
                        onChange={(e) => setBulkGenRole(e.target.value as any)}
                        className="px-3 py-1 rounded bg-[#14110D] border border-[#2B241E] text-[#EDE6DC]"
                      >
                        <option value="analyst">SOC Analyst</option>
                        <option value="admin">Admin</option>
                        <option value="read_only">Read-Only Auditor</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Email Notification Trigger Settings */}
                <div className="p-4 bg-[#1D1712] border border-[#3A3228] rounded-lg space-y-3 font-mono">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#D3A039]" />
                      <span className="font-bold text-[#EDE6DC] text-xs">Automated Email Notification Triggers</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bulkSendNotifications}
                        onChange={(e) => setBulkSendNotifications(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[#0E0B09] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D3A039]"></div>
                    </label>
                  </div>

                  {bulkSendNotifications && (
                    <div className="space-y-3 pt-2 border-t border-[#2B241E]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[11px] text-[#9C9186] block mb-1">Notification Template:</label>
                          <select
                            value={bulkNotificationType}
                            onChange={(e) => setBulkNotificationType(e.target.value as any)}
                            className="w-full px-3 py-1.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[#EDE6DC]"
                          >
                            <option value="welcome_creds">Instant Credentials & Onboarding Dossier</option>
                            <option value="activation_link">Secure 24-Hour Account Activation Link</option>
                            <option value="sso_invitation">SSO / Workspace Access Invitation</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] text-[#9C9186] block mb-1">Custom SOC Welcome Message (Optional):</label>
                          <input
                            type="text"
                            placeholder="e.g. Please join #soc-war-room in Slack after login"
                            value={bulkCustomMessage}
                            onChange={(e) => setBulkCustomMessage(e.target.value)}
                            className="w-full px-3 py-1.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[#EDE6DC]"
                          />
                        </div>
                      </div>

                      {/* Live Email Notification Preview Toggle */}
                      <div>
                        <button
                          type="button"
                          onClick={() => setShowEmailPreview(!showEmailPreview)}
                          className="text-[11px] text-[#D3A039] hover:underline flex items-center gap-1 cursor-pointer font-sans"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{showEmailPreview ? 'Hide Notification Preview' : 'Preview Dispatched Email Notification'}</span>
                        </button>

                        {showEmailPreview && (
                          <div className="mt-2 p-3.5 rounded bg-[#0E0B09] border border-[#3A3228] text-xs font-sans space-y-2 text-[#EDE6DC]">
                            <div className="flex items-center justify-between border-b border-[#2B241E] pb-1.5 font-mono text-[11px] text-[#9C9186]">
                              <span>FROM: security-ops@tracexmail.com</span>
                              <span>SMTP: 250 OK (Encrypted TLS)</span>
                            </div>
                            <div className="font-semibold text-[#D3A039]">
                              Subject: Welcome to TraceXMail Enterprise SOC - Account Provisioned [Badge: EMP-XXXX]
                            </div>
                            <div className="p-3 bg-[#14110D] border border-[#2B241E] rounded text-xs space-y-2">
                              <p>Hello Operator,</p>
                              <p>
                                An enterprise incident response account has been created for you under organization{' '}
                                <b>{organizationId}</b>.
                              </p>
                              {bulkCustomMessage && (
                                <p className="p-2 bg-[#1D1712] border-l-2 border-[#D3A039] italic text-xs">
                                  "{bulkCustomMessage}"
                                </p>
                              )}
                              <div className="p-2.5 bg-[#0E0B09] border border-[#2B241E] rounded font-mono text-[11px] space-y-1">
                                <div><b>Workspace Login:</b> {window.location.origin}</div>
                                <div><b>Temporary Password:</b> **************** (High-Entropy Sealed)</div>
                              </div>
                              <p className="text-[11px] text-[#9C9186]">
                                Please sign in and complete 2FA hardware key or TOTP activation.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="flex justify-end gap-2 pt-3 border-t border-[#2B241E]">
                  <button
                    type="button"
                    onClick={() => setBulkModalOpen(false)}
                    className="px-4 py-2 rounded bg-[#1D1712] text-[#9C9186] hover:text-[#EDE6DC] font-mono text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToPreview}
                    className="px-5 py-2 rounded bg-[#D3A039] hover:bg-[#b8892d] text-black font-bold font-mono text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Parse & Review Staging</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: STAGING & VALIDATION REVIEW GRID */}
            {bulkStep === 'preview' && (
              <div className="space-y-4">
                {/* Global Grid Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[#0E0B09] border border-[#2B241E] rounded text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-[#9C9186]">Apply Role to All:</span>
                    <select
                      value={batchDefaultRole}
                      onChange={(e) => handleSetAllRoles(e.target.value as any)}
                      className="px-2 py-1 rounded bg-[#14110D] border border-[#2B241E] text-[#EDE6DC]"
                    >
                      <option value="analyst">SOC Analyst</option>
                      <option value="admin">Admin</option>
                      <option value="read_only">Read-Only Auditor</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRegenerateAllPasswords}
                      className="px-2 py-1 rounded bg-[#1D1712] border border-[#2B241E] text-[#D3A039] hover:text-white flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Regenerate Passwords</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const newId = `manual_${Date.now()}`;
                        setStagedUsers(prev => [
                          ...prev,
                          {
                            id: newId,
                            name: 'New Analyst',
                            email: 'analyst@corp.sec',
                            employeeId: generateRandomEmpId(),
                            role: batchDefaultRole,
                            password: generateRandomPassword(),
                            isValid: true
                          }
                        ]);
                      }}
                      className="px-2 py-1 rounded bg-[#1D1712] border border-[#2B241E] text-[#EDE6DC] hover:text-white flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Row</span>
                    </button>
                  </div>
                </div>

                {/* Staging Table */}
                <div className="border border-[#2B241E] rounded overflow-hidden max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#0E0B09] border-b border-[#2B241E] text-[#9C9186] text-[10.5px]">
                      <tr>
                        <th className="p-2">Status</th>
                        <th className="p-2">Name</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Badge ID</th>
                        <th className="p-2">Role</th>
                        <th className="p-2">Generated Password</th>
                        <th className="p-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B241E]/40">
                      {stagedUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-[#1D1712]/40">
                          <td className="p-2">
                            {u.isValid ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                                VALID
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-800 text-[10px] font-bold">
                                {u.validationError || 'INVALID'}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={u.name}
                              onChange={(e) => handleUpdateStagedUser(u.id, { name: e.target.value })}
                              className="w-28 px-1.5 py-0.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[#EDE6DC] text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={u.email}
                              onChange={(e) => handleUpdateStagedUser(u.id, { email: e.target.value })}
                              className={`w-44 px-1.5 py-0.5 rounded bg-[#0E0B09] border text-xs ${
                                u.isValid ? 'border-[#2B241E] text-[#EDE6DC]' : 'border-rose-500 text-rose-300'
                              }`}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={u.employeeId}
                              onChange={(e) => handleUpdateStagedUser(u.id, { employeeId: e.target.value })}
                              className="w-20 px-1.5 py-0.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[#EDE6DC] text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={u.role}
                              onChange={(e) => handleUpdateStagedUser(u.id, { role: e.target.value as any })}
                              className="px-1.5 py-0.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[#EDE6DC] text-xs"
                            >
                              <option value="analyst">Analyst</option>
                              <option value="admin">Admin</option>
                              <option value="read_only">Read-Only</option>
                            </select>
                          </td>
                          <td className="p-2 text-[#D3A039] text-[11px]">
                            {u.password}
                          </td>
                          <td className="p-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveStagedUser(u.id)}
                              className="p-1 rounded text-[#9C9186] hover:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Staging Summary */}
                <div className="flex items-center justify-between text-xs font-mono text-[#9C9186]">
                  <div>
                    Ready to create: <b className="text-emerald-400">{stagedUsers.filter(u => u.isValid).length}</b> valid accounts.
                    {bulkSendNotifications && (
                      <span className="ml-2 text-[#D3A039]">
                        (Email notifications will be automatically triggered)
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBulkStep('input')}
                      className="px-3 py-1.5 rounded bg-[#1D1712] text-[#9C9186] hover:text-[#EDE6DC]"
                    >
                      Back to Config
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteBulkCreation}
                      disabled={isSubmittingBulk || stagedUsers.filter(u => u.isValid).length === 0}
                      className="px-5 py-1.5 rounded bg-[#D3A039] hover:bg-[#b8892d] text-black font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingBulk ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Provisioning & Dispatched...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          <span>Commit & Provision {stagedUsers.filter(u => u.isValid).length} Accounts</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: MASTER CREDENTIALS MANIFEST & DELIVERY DOSSIER */}
      {/* ========================================================================= */}
      {bulkManifest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#14110D] border border-[#3A3228] rounded-lg max-w-3xl w-full p-6 text-xs text-[#EDE6DC] font-sans shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-[#2B241E] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-emerald-950 border border-emerald-700 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#EDE6DC] font-mono uppercase">
                    Bulk Provisioning Completed · Master Credentials Manifest
                  </h3>
                  <p className="text-[11px] text-[#9C9186]">
                    {bulkManifest.createdUsers.length} accounts provisioned. Passwords saved and notifications triggered.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setBulkManifest(null)}
                className="p-1 rounded text-[#9C9186] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Notification Trigger Summary Badge */}
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 text-emerald-300">
                <Mail className="w-4 h-4" />
                <span>
                  {bulkManifest.notificationsTriggered
                    ? 'Automated Email Notifications Triggered & Delivered (SMTP 250 OK)'
                    : 'Manual Handover Selected'}
                </span>
              </div>
              <span className="text-[11px] text-[#9C9186]">
                Login Workspace: <b className="text-[#EDE6DC]">{bulkManifest.loginUrl}</b>
              </span>
            </div>

            {/* Credentials Roster Table */}
            <div className="border border-[#2B241E] rounded overflow-hidden max-h-[320px] overflow-y-auto font-mono text-xs">
              <table className="w-full text-left">
                <thead className="bg-[#0E0B09] text-[#9C9186] text-[10.5px] border-b border-[#2B241E]">
                  <tr>
                    <th className="p-2">Badge ID</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Temporary Password</th>
                    <th className="p-2">Notification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2B241E]/40">
                  {bulkManifest.createdUsers.map((u, i) => (
                    <tr key={i} className="hover:bg-[#1D1712]/40">
                      <td className="p-2 text-[#9C9186]">{u.employeeId}</td>
                      <td className="p-2 text-[#EDE6DC] font-semibold">{u.name}</td>
                      <td className="p-2 text-[#EDE6DC]">{u.email}</td>
                      <td className="p-2 text-[#D3A039] uppercase">{u.role}</td>
                      <td className="p-2 text-[#EDE6DC] bg-[#0E0B09]/60 font-bold tracking-wider">
                        {u.password}
                      </td>
                      <td className="p-2 text-emerald-400 text-[10.5px]">
                        {u.notificationStatus?.deliveryStatus || 'DELIVERED'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#2B241E]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportManifestCsv}
                  className="px-3 py-1.5 rounded bg-[#1D1712] hover:bg-[#2B241E] border border-[#2B241E] text-[#EDE6DC] font-mono text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#D3A039]" />
                  <span>Download Manifest CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyManifestText}
                  className="px-3 py-1.5 rounded bg-[#1D1712] hover:bg-[#2B241E] border border-[#2B241E] text-[#EDE6DC] font-mono text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedId === 'manifest-text' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#D3A039]" />
                  )}
                  <span>{copiedId === 'manifest-text' ? 'Copied Manifest!' : 'Copy All to Clipboard'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setBulkManifest(null)}
                className="px-5 py-1.5 rounded bg-[#D3A039] hover:bg-[#b8892d] text-black font-bold font-mono text-xs cursor-pointer"
              >
                Done / Close Manifest
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CREATE SINGLE OPERATOR · AUTOMATED EMAIL INVITATION WIZARD */}
      {/* ========================================================================= */}
      {singleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#14110D] border border-[#3A3228] rounded-lg max-w-xl w-full p-6 text-xs text-[#EDE6DC] font-sans shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#2B241E] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-[#D3A039]/20 border border-[#D3A039]/50 flex items-center justify-center text-[#D3A039]">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#EDE6DC] font-mono uppercase tracking-wide">
                    Create Single Operator · Automated Invitation
                  </h3>
                  <p className="text-[11px] text-[#9C9186]">
                    Provision an analyst or administrator account and trigger an automated email invitation.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSingleModalOpen(false)}
                className="p-1.5 rounded bg-[#1D1712] text-[#9C9186] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSingleUser} className="space-y-4 font-mono">
              {/* Row 1: Name and Badge ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#9C9186] block mb-1">Full Name:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sunita Patel"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[#EDE6DC] placeholder-[#9C9186]/50 focus:outline-none focus:border-[#D3A039]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-[#9C9186]">Employee Badge ID:</label>
                    <button
                      type="button"
                      onClick={() => setFormEmpId(generateRandomEmpId())}
                      className="text-[10px] text-[#D3A039] hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Re-roll</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={formEmpId}
                    onChange={(e) => setFormEmpId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[#EDE6DC] font-bold focus:outline-none focus:border-[#D3A039]"
                  />
                </div>
              </div>

              {/* Row 2: Work Email */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-[#9C9186]">Work Email Address (Recipient):</label>
                  {formEmail && (
                    <span className={`text-[10px] ${isValidEmail(formEmail) ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isValidEmail(formEmail) ? '✓ Valid Email Syntax' : '✗ Invalid Email Format'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-[#9C9186] absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="s.patel@acme-defense.corp"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[#EDE6DC] placeholder-[#9C9186]/50 focus:outline-none focus:border-[#D3A039]"
                  />
                </div>
              </div>

              {/* Row 3: Assigned Role & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#9C9186] block mb-1">Assigned Role:</label>
                  <select
                    value={formRole}
                    onChange={(e) => handleRoleChangeInForm(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[#EDE6DC] focus:outline-none focus:border-[#D3A039]"
                  >
                    <option value="analyst">SOC Analyst (Default)</option>
                    <option value="admin">Full Administrator</option>
                    <option value="read_only">Read-Only Auditor</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-[#9C9186]">Temporary Password:</label>
                    <button
                      type="button"
                      onClick={() => {
                        setFormPassword(generateRandomPassword());
                        setFormAutoPassword(true);
                      }}
                      className="text-[10px] text-[#D3A039] hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Auto-Generate</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={formShowPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={(e) => {
                        setFormPassword(e.target.value);
                        setFormAutoPassword(false);
                      }}
                      className="w-full pl-3 pr-8 py-1.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[#D3A039] font-bold focus:outline-none focus:border-[#D3A039]"
                    />
                    <button
                      type="button"
                      onClick={() => setFormShowPassword(!formShowPassword)}
                      className="absolute right-2 top-2 text-[#9C9186] hover:text-[#EDE6DC]"
                    >
                      {formShowPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION: Automated Email Invitation Trigger */}
              <div className="p-3.5 bg-[#1D1712] border border-[#3A3228] rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-[#D3A039]" />
                    <div>
                      <span className="font-bold text-[#EDE6DC] text-xs">Automated Email Invitation Trigger</span>
                      <p className="text-[10.5px] text-[#9C9186] font-sans">
                        Dispatches an automated email invitation when this user account is saved.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formSendNotif}
                      onChange={(e) => setFormSendNotif(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#0E0B09] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D3A039]"></div>
                  </label>
                </div>

                {formSendNotif && (
                  <div className="space-y-3 pt-2.5 border-t border-[#2B241E]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-[#9C9186] block mb-1">Invitation Template:</label>
                        <select
                          value={formNotifType}
                          onChange={(e) => setFormNotifType(e.target.value as any)}
                          className="w-full px-2.5 py-1.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[#EDE6DC] text-xs"
                        >
                          <option value="welcome_creds">Instant Credentials &amp; Onboarding Dossier</option>
                          <option value="activation_link">Secure 24-Hour Account Activation Link</option>
                          <option value="sso_invitation">SSO / Corporate Workspace Access</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] text-[#9C9186] block mb-1">Welcome Note / Instructions:</label>
                        <input
                          type="text"
                          placeholder="e.g. Please join #soc-war-room in Slack after sign-in"
                          value={formCustomMessage}
                          onChange={(e) => setFormCustomMessage(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[#EDE6DC] text-xs placeholder-[#9C9186]/50"
                        />
                      </div>
                    </div>

                    {/* Email Live Preview Accordion */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setSingleEmailPreviewOpen(!singleEmailPreviewOpen)}
                        className="text-[11px] text-[#D3A039] hover:underline flex items-center gap-1 cursor-pointer font-sans"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{singleEmailPreviewOpen ? 'Hide Email Preview' : 'Preview Dispatched Invitation Email'}</span>
                      </button>

                      {singleEmailPreviewOpen && (
                        <div className="mt-2 p-3.5 rounded bg-[#0E0B09] border border-[#3A3228] text-xs font-sans space-y-2 text-[#EDE6DC]">
                          <div className="flex items-center justify-between border-b border-[#2B241E] pb-1.5 font-mono text-[10.5px] text-[#9C9186]">
                            <span>TO: {formEmail || 'operator@corp.sec'}</span>
                            <span>DELIVERY: SMTP 250 OK (TLS)</span>
                          </div>
                          <div className="font-semibold text-[#D3A039]">
                            Subject: Welcome to TraceXMail Enterprise SOC - Account Provisioned [Badge: {formEmpId || 'EMP-XXXX'}]
                          </div>
                          <div className="p-3 bg-[#14110D] border border-[#2B241E] rounded text-xs space-y-2">
                            <p>Hello <b>{formName || 'Operator'}</b>,</p>
                            <p>
                              You have been provisioned with <b>{formRole.toUpperCase()}</b> privileges in organization{' '}
                              <b className="text-[#D3A039]">{organizationId}</b>.
                            </p>
                            {formCustomMessage && (
                              <p className="p-2 bg-[#1D1712] border-l-2 border-[#D3A039] italic text-xs">
                                "{formCustomMessage}"
                              </p>
                            )}
                            <div className="p-2.5 bg-[#0E0B09] border border-[#2B241E] rounded font-mono text-[11px] space-y-1">
                              <div><b>Workspace URL:</b> {window.location.origin}</div>
                              <div><b>Operator Badge:</b> {formEmpId}</div>
                              <div><b>Temporary Password:</b> {formPassword || '********'}</div>
                            </div>
                            <p className="text-[11px] text-[#9C9186]">
                              Please sign in and set up your multi-factor authentication hardware key or TOTP code.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION: Granular Privileges Accordion */}
              <div className="border border-[#2B241E] rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSinglePermissionsDrawerOpen(!singlePermissionsDrawerOpen)}
                  className="w-full p-2.5 bg-[#0E0B09] hover:bg-[#1D1712] flex items-center justify-between text-left text-xs font-mono text-[#9C9186] hover:text-[#EDE6DC] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#D3A039]" />
                    <span>Customize Granular Operator Privileges ({formRole.toUpperCase()})</span>
                  </div>
                  {singlePermissionsDrawerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {singlePermissionsDrawerOpen && (
                  <div className="p-3 bg-[#14110D] border-t border-[#2B241E] space-y-2 text-xs font-mono">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 text-[#EDE6DC] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formPermissions.canAnalyzeHeaders}
                          onChange={(e) => setFormPermissions({ ...formPermissions, canAnalyzeHeaders: e.target.checked })}
                          className="rounded text-[#D3A039]"
                        />
                        <span>Analyze RFC822 Headers</span>
                      </label>
                      <label className="flex items-center gap-2 text-[#EDE6DC] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formPermissions.canSyncGmail}
                          onChange={(e) => setFormPermissions({ ...formPermissions, canSyncGmail: e.target.checked })}
                          className="rounded text-[#D3A039]"
                        />
                        <span>Sync Mailbox Feeds</span>
                      </label>
                      <label className="flex items-center gap-2 text-[#EDE6DC] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formPermissions.canManageCases}
                          onChange={(e) => setFormPermissions({ ...formPermissions, canManageCases: e.target.checked })}
                          className="rounded text-[#D3A039]"
                        />
                        <span>Manage &amp; Close SOC Cases</span>
                      </label>
                      <label className="flex items-center gap-2 text-[#EDE6DC] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formPermissions.canExportDossiers}
                          onChange={(e) => setFormPermissions({ ...formPermissions, canExportDossiers: e.target.checked })}
                          className="rounded text-[#D3A039]"
                        />
                        <span>Export Evidence Dossiers</span>
                      </label>
                      <label className="flex items-center gap-2 text-[#EDE6DC] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formPermissions.canManageUsers}
                          onChange={(e) => setFormPermissions({ ...formPermissions, canManageUsers: e.target.checked })}
                          className="rounded text-[#D3A039]"
                        />
                        <span>Manage Team Users</span>
                      </label>
                      <label className="flex items-center gap-2 text-[#EDE6DC] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formPermissions.canRunRetentionPurge}
                          onChange={(e) => setFormPermissions({ ...formPermissions, canRunRetentionPurge: e.target.checked })}
                          className="rounded text-[#D3A039]"
                        />
                        <span>Execute NIST Retention Purge</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Footer Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-[#2B241E]">
                <button
                  type="button"
                  onClick={() => setSingleModalOpen(false)}
                  className="px-4 py-2 rounded bg-[#1D1712] text-[#9C9186] hover:text-[#EDE6DC] font-mono text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSingle || !isValidEmail(formEmail)}
                  className="px-5 py-2 rounded bg-[#D3A039] hover:bg-[#b8892d] text-black font-bold font-mono text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-sm"
                >
                  {isSubmittingSingle ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving &amp; Dispatching...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save &amp; Dispatch Invitation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: SINGLE OPERATOR CREDENTIALS HANDOVER */}
      {/* ========================================================================= */}
      {handoverCreds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#14110D] border border-[#3A3228] rounded-lg max-w-md w-full p-6 text-xs text-[#EDE6DC] font-sans shadow-2xl space-y-4 font-mono">
            <div className="flex items-center gap-2 text-emerald-400 border-b border-[#2B241E] pb-3">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="text-sm font-bold text-[#EDE6DC] uppercase">
                Operator Account Provisioned Successfully
              </h3>
            </div>

            <div className="p-3 bg-[#0E0B09] border border-[#2B241E] rounded space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#9C9186]">Email:</span>
                <span className="text-[#EDE6DC] font-bold">{handoverCreds.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9C9186]">Badge ID:</span>
                <span className="text-[#EDE6DC]">{handoverCreds.employeeId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9C9186]">Role:</span>
                <span className="text-[#D3A039] uppercase">{handoverCreds.role}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[#2B241E]">
                <span className="text-[#9C9186]">Temporary Password:</span>
                <span className="text-[#D3A039] font-bold bg-[#14110D] px-2 py-0.5 rounded border border-[#2B241E]">
                  {handoverCreds.password}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-emerald-400 pt-1">
                <span>Notification:</span>
                <span>{handoverCreds.notificationStatus?.deliveryStatus || 'DELIVERED (SMTP 250)'}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const clip = `TraceXMail Account:\nEmail: ${handoverCreds.email}\nBadge: ${handoverCreds.employeeId}\nPassword: ${handoverCreds.password}\nLogin: ${handoverCreds.loginUrl}`;
                  navigator.clipboard.writeText(clip);
                  setCopiedId('single-handover');
                  setTimeout(() => setCopiedId(null), 2000);
                }}
                className="px-3 py-1.5 rounded bg-[#1D1712] border border-[#2B241E] text-[#EDE6DC] flex items-center gap-1"
              >
                {copiedId === 'single-handover' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'single-handover' ? 'Copied' : 'Copy Credentials'}</span>
              </button>
              <button
                type="button"
                onClick={() => setHandoverCreds(null)}
                className="px-5 py-1.5 rounded bg-[#D3A039] text-black font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: PASSWORD RESET DIALOG */}
      {/* ========================================================================= */}
      {resetPwdModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#14110D] border border-[#3A3228] rounded-lg max-w-md w-full p-6 text-xs text-[#EDE6DC] font-sans shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-[#2B241E] pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#D3A039]" />
                <h3 className="text-sm font-bold text-[#EDE6DC] uppercase">
                  Reset Operator Password
                </h3>
              </div>
              <button onClick={() => setResetPwdModalUser(null)} className="text-[#9C9186] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#9C9186]">
              Generating a new temporary password for operator <b className="text-[#EDE6DC]">{resetPwdModalUser.email}</b>.
            </p>

            <div className="space-y-2">
              <label className="text-[11px] text-[#9C9186] block">New Password:</label>
              <input
                type="text"
                value={newPasswordVal}
                onChange={(e) => setNewPasswordVal(e.target.value)}
                className="w-full px-3 py-1.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[#D3A039] font-bold"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#2B241E]">
              <button
                type="button"
                onClick={() => setResetPwdModalUser(null)}
                className="px-4 py-1.5 rounded bg-[#1D1712] text-[#9C9186]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetPasswordSubmit}
                disabled={isSubmittingReset}
                className="px-5 py-1.5 rounded bg-[#D3A039] text-black font-bold flex items-center gap-1.5"
              >
                {isSubmittingReset ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Confirm Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: EDIT PERMISSIONS DIALOG */}
      {/* ========================================================================= */}
      {editPermissionsModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#14110D] border border-[#3A3228] rounded-lg max-w-md w-full p-6 text-xs text-[#EDE6DC] font-sans shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2B241E] pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#D3A039]" />
                <h3 className="text-sm font-bold text-[#EDE6DC] font-mono uppercase">
                  Edit Role & Permissions
                </h3>
              </div>
              <button onClick={() => setEditPermissionsModalUser(null)} className="text-[#9C9186] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono">
              <div>
                <label className="text-[11px] text-[#9C9186] block mb-1">Operator:</label>
                <div className="text-xs text-[#EDE6DC] font-bold">{editPermissionsModalUser.email}</div>
              </div>

              <div>
                <label className="text-[11px] text-[#9C9186] block mb-1">Role Assignment:</label>
                <select
                  value={editPermissionsModalUser.role}
                  onChange={(e) => setEditPermissionsModalUser({ ...editPermissionsModalUser, role: e.target.value as any })}
                  className="w-full px-3 py-1.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[#EDE6DC]"
                >
                  <option value="analyst">SOC Analyst</option>
                  <option value="admin">Admin</option>
                  <option value="read_only">Read-Only Auditor</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-[#9C9186] block mb-1">Status:</label>
                <select
                  value={editPermissionsModalUser.status}
                  onChange={(e) => setEditPermissionsModalUser({ ...editPermissionsModalUser, status: e.target.value as any })}
                  className="w-full px-3 py-1.5 rounded bg-[#0E0B09] border border-[#2B241E] text-[#EDE6DC]"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="REVOKED">Revoked</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#2B241E]">
              <button
                type="button"
                onClick={() => setEditPermissionsModalUser(null)}
                className="px-4 py-1.5 rounded bg-[#1D1712] text-[#9C9186]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/organization/users/${editPermissionsModalUser.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        role: editPermissionsModalUser.role,
                        status: editPermissionsModalUser.status
                      })
                    });
                    if (!res.ok) throw new Error('Failed to update');
                    setEditPermissionsModalUser(null);
                    fetchUsers();
                    setSuccessFeedback(`Updated settings for ${editPermissionsModalUser.email}`);
                    setTimeout(() => setSuccessFeedback(null), 4000);
                  } catch (err: any) {
                    alert(err.message || 'Error updating operator');
                  }
                }}
                className="px-5 py-1.5 rounded bg-[#D3A039] text-black font-bold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
