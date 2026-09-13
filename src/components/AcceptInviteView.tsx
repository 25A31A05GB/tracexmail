import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowLeft, 
  Key, 
  UserCheck, 
  Lock, 
  Eye, 
  EyeOff 
} from 'lucide-react';
import { UserRole } from '../hooks/useSession';

interface AcceptInviteViewProps {
  token: string;
  onSuccess: (userData: any) => void;
  onBackToLogin: () => void;
}

export function AcceptInviteView({ token, onSuccess, onBackToLogin }: AcceptInviteViewProps) {
  const [inviteData, setInviteData] = useState<any | null>(null);
  const [verifying, setVerifying] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function verifyInviteToken() {
      if (!token) {
        setInviteError('No invitation token provided.');
        setVerifying(false);
        return;
      }

      try {
        setVerifying(true);
        const res = await fetch(`/api/auth/invites/verify/${encodeURIComponent(token)}`);
        const data = await res.json();

        if (isMounted) {
          if (res.ok && data.valid && data.invite) {
            setInviteData(data.invite);
            setFullName(data.invite.full_name || '');
          } else {
            setInviteError(data.error || 'Invitation token is invalid or has expired.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setInviteError(err.message || 'Unable to verify invitation.');
        }
      } finally {
        if (isMounted) {
          setVerifying(false);
        }
      }
    }

    verifyInviteToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setFormError('Please enter a password.');
      return;
    }

    if (password.length < 12) {
      setFormError('Security Policy: Master password must be at least 12 characters in length.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/auth/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          fullName: fullName.trim(),
          password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Failed to accept invitation.');
        setSubmitting(false);
        return;
      }

      setSuccessMsg(`Welcome to ${inviteData?.organization_name || 'the team'}! Finalizing workspace…`);
      setTimeout(() => {
        onSuccess(data);
      }, 700);
    } catch (err: any) {
      setFormError(err.message || 'Error completing account setup.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ink)] bg-[radial-gradient(ellipse_900px_500px_at_50%_-10%,rgba(178,58,46,0.08),transparent_60%)] p-4 text-[var(--paper)] font-sans select-text relative overflow-y-auto">
      <div className="w-full max-w-[490px] bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-8 relative z-10">
        
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4 border-b border-[var(--line)] pb-3">
          <button
            type="button"
            onClick={onBackToLogin}
            className="text-[var(--paper-dim)] hover:text-[var(--paper)] text-xs flex items-center gap-1.5 transition-colors cursor-pointer bg-transparent border-0 p-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[var(--thread)]" />
            <span>Back to Sign In</span>
          </button>

          <div className="font-mono text-[10.5px] text-[var(--stamp)] uppercase tracking-wider flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-[var(--stamp)]" />
            <span>ORGANIZATION INVITATION</span>
          </div>
        </div>

        {verifying ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--stamp)]" />
            <span className="font-mono text-xs tracking-wider text-[var(--paper-dim)]">
              VERIFYING INVITATION TOKEN…
            </span>
          </div>
        ) : inviteError ? (
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 rounded-full bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-[var(--thread)] flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-[var(--paper)]">
                Invitation Invalid or Expired
              </h3>
              <p className="text-xs text-[var(--paper-dim)] mt-1.5 leading-relaxed max-w-sm mx-auto">
                {inviteError}
              </p>
            </div>
            <button
              type="button"
              onClick={onBackToLogin}
              className="mt-4 py-2.5 px-6 bg-[var(--paper)] text-[var(--ink)] font-bold text-xs rounded-sm hover:bg-white cursor-pointer"
            >
              Return to Sign In
            </button>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-5 h-5 rounded-full border-[1.5px] border-[var(--thread)] relative shrink-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[var(--thread)]" />
              </div>
              <span className="font-display font-bold text-xl text-[var(--paper)] tracking-tight">
                Join {inviteData.organization_name}
              </span>
            </div>

            <div className="text-[var(--paper-dim)] text-[13px] mb-4">
              You have been invited to join the forensic team as an authorized <strong className="text-[var(--stamp)] uppercase font-mono">{inviteData.role}</strong>.
            </div>

            {/* Invite Details Card */}
            <div className="p-3 bg-[var(--ink)] border border-[var(--line)] rounded-[2px] mb-4 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-[var(--paper-dim)]">Invitee Email:</span>
                <span className="text-[var(--paper)] font-bold">{inviteData.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--paper-dim)]">Department:</span>
                <span className="text-[var(--slate)]">{inviteData.department || 'SOC Security Unit'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--paper-dim)]">Invited By:</span>
                <span className="text-[var(--paper-dim)]">{inviteData.invited_by}</span>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-[2px] bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-[var(--rose-300)] text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--thread)]" />
                <div className="leading-relaxed font-sans">{formError}</div>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 rounded-[2px] bg-[rgba(72,169,117,0.15)] border border-[var(--forensic-green)] text-[var(--paper)] text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[var(--forensic-green)]" />
                <div className="leading-relaxed font-sans">{successMsg}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Elena Rostova"
                  className="w-full text-xs font-mono py-2 px-3 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] placeholder:text-[var(--paper-dim)]/40 focus:outline-none focus:border-[var(--stamp)]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-mono font-medium text-[var(--paper-dim)] uppercase tracking-wider">
                    Set Master Password *
                  </label>
                  <span className="text-[10px] font-mono text-[var(--paper-dim)]">Min 12 characters</span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={12}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full text-xs font-mono py-2 px-3 pr-8 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] placeholder:text-[var(--paper-dim)]/40 focus:outline-none focus:border-[var(--stamp)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-[var(--paper-dim)] hover:text-[var(--paper)] bg-transparent border-0 cursor-pointer p-0"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-[var(--paper-dim)]" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1 uppercase tracking-wider">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={12}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full text-xs font-mono py-2 px-3 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] placeholder:text-[var(--paper-dim)]/40 focus:outline-none focus:border-[var(--stamp)]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-2.5 px-4 bg-[var(--stamp)] text-[var(--ink)] font-bold text-xs tracking-wider uppercase rounded-sm hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Activating Clearance…</span>
                  </>
                ) : (
                  <span>Accept Invite & Sign In</span>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
