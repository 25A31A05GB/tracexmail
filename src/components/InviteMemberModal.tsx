import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  UserPlus, 
  Shield, 
  Check, 
  Copy, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Building2,
  Calendar,
  Send
} from 'lucide-react';
import { UserRole } from '../hooks/useSession';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteCreated?: (invite: any) => void;
}

export function InviteMemberModal({ isOpen, onClose, onInviteCreated }: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('analyst');
  const [department, setDepartment] = useState('Incident Response SOC');
  const [expiresInDays, setExpiresInDays] = useState<number>(7);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<{ invite: any; inviteUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter the invitee work email.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          fullName: fullName.trim() || undefined,
          role,
          department,
          expiresInDays
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to generate invitation.');
        setLoading(false);
        return;
      }

      setCreatedInvite({
        invite: data.invite,
        inviteUrl: data.inviteUrl || `${window.location.origin}/#invite=${data.invite.token}`
      });

      if (onInviteCreated) {
        onInviteCreated(data.invite);
      }
    } catch (err: any) {
      console.error('[InviteMember] Error creating invite:', err);
      setErrorMsg(err.message || 'An error occurred while creating invitation.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!createdInvite?.inviteUrl) return;
    navigator.clipboard.writeText(createdInvite.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setEmail('');
    setFullName('');
    setRole('analyst');
    setCreatedInvite(null);
    setErrorMsg(null);
    setCopied(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-text">
      <div className="relative w-full max-w-md bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-[var(--paper)]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[rgba(201,162,39,0.15)] border border-[var(--stamp)] text-[var(--stamp)] flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-[var(--paper)]">
                Invite Team Member
              </h3>
              <p className="text-[11px] text-[var(--paper-dim)]">
                Grant authorized clearance to your SOC organization
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[var(--paper-dim)] hover:text-[var(--paper)] p-1 rounded-sm cursor-pointer bg-transparent border-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-[2px] bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-[var(--rose-300)] text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--thread)]" />
            <div className="leading-relaxed font-sans">{errorMsg}</div>
          </div>
        )}

        {createdInvite ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-[2px] bg-[rgba(72,169,117,0.15)] border border-[var(--forensic-green)] text-xs space-y-2">
              <div className="flex items-center gap-2 text-[var(--forensic-green)] font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Invitation Issued Successfully</span>
              </div>
              <p className="text-[var(--paper-dim)] leading-relaxed">
                An invitation token has been generated for <strong className="text-[var(--paper)] font-mono">{createdInvite.invite.email}</strong> with role <strong className="text-[var(--stamp)] uppercase">{createdInvite.invite.role}</strong>.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] uppercase tracking-wider">
                Direct Invitation Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdInvite.inviteUrl}
                  className="flex-1 text-xs font-mono py-2 px-3 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="py-2 px-3 bg-[var(--stamp)] text-[var(--ink)] text-xs font-bold rounded-sm flex items-center gap-1.5 cursor-pointer hover:brightness-110"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-2 text-xs font-semibold text-[var(--paper-dim)] border border-[var(--line)] rounded-sm hover:text-[var(--paper)] hover:border-[var(--paper-dim)] cursor-pointer"
              >
                Invite Another
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 text-xs font-bold text-[var(--ink)] bg-[var(--paper)] rounded-sm hover:bg-white cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1 uppercase tracking-wider">
                Invitee Work Email *
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="analyst@enterprise.sec"
                  className="w-full text-xs font-mono py-2 px-3 pl-8 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] placeholder:text-[var(--paper-dim)]/40 focus:outline-none focus:border-[var(--stamp)]"
                />
                <Mail className="w-3.5 h-3.5 text-[var(--paper-dim)] absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1 uppercase tracking-wider">
                Full Name (Optional)
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Marcus Vance"
                className="w-full text-xs font-mono py-2 px-3 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] placeholder:text-[var(--paper-dim)]/40 focus:outline-none focus:border-[var(--stamp)]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1.5 uppercase tracking-wider">
                Assigned Role
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('analyst')}
                  className={`p-2 rounded-[2px] border text-center text-xs font-mono cursor-pointer transition-all ${
                    role === 'analyst'
                      ? 'border-[var(--slate)] bg-[rgba(127,163,186,0.2)] text-[var(--slate)] font-bold'
                      : 'border-[var(--line)] text-[var(--paper-dim)] hover:text-[var(--paper)]'
                  }`}
                >
                  Analyst (L1/L2)
                </button>
                <button
                  type="button"
                  onClick={() => setRole('read_only')}
                  className={`p-2 rounded-[2px] border text-center text-xs font-mono cursor-pointer transition-all ${
                    role === 'read_only'
                      ? 'border-[var(--paper-dim)] bg-[rgba(237,230,216,0.1)] text-[var(--paper)] font-bold'
                      : 'border-[var(--line)] text-[var(--paper-dim)] hover:text-[var(--paper)]'
                  }`}
                >
                  Auditor
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`p-2 rounded-[2px] border text-center text-xs font-mono cursor-pointer transition-all ${
                    role === 'admin'
                      ? 'border-[var(--stamp)] bg-[rgba(201,162,39,0.2)] text-[var(--stamp)] font-bold'
                      : 'border-[var(--line)] text-[var(--paper-dim)] hover:text-[var(--paper)]'
                  }`}
                >
                  Admin
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1 uppercase tracking-wider">
                  Department / Unit
                </label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full text-xs font-mono py-2 px-2 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] focus:outline-none focus:border-[var(--stamp)]"
                >
                  <option value="Incident Response SOC">Incident Response</option>
                  <option value="Email Threat Defense">Threat Defense</option>
                  <option value="Forensic Investigation">Forensics Unit</option>
                  <option value="Security Compliance & Audit">Compliance & Audit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1 uppercase tracking-wider">
                  Link Expiry
                </label>
                <select
                  value={expiresInDays}
                  onChange={e => setExpiresInDays(Number(e.target.value))}
                  className="w-full text-xs font-mono py-2 px-2 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] focus:outline-none focus:border-[var(--stamp)]"
                >
                  <option value={1}>24 Hours</option>
                  <option value={7}>7 Days</option>
                  <option value={14}>14 Days</option>
                  <option value={30}>30 Days</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 text-xs font-semibold text-[var(--paper-dim)] border border-[var(--line)] rounded-sm hover:text-[var(--paper)] hover:border-[var(--paper-dim)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !email}
                className="flex-1 py-2.5 px-4 bg-[var(--stamp)] text-[var(--ink)] font-bold text-xs tracking-wider uppercase rounded-sm hover:brightness-110 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending…</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Invite</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
