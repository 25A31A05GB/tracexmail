import React, { useState, FormEvent } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Loader2, AlertCircle, ArrowLeft, CheckCircle2, ShieldAlert, Shield, Eye, User, Building2, MailCheck } from 'lucide-react';
import { UserRole, AccountType } from '../hooks/useSession';

interface SignupViewProps {
  onBackToLogin: () => void;
  onBackToIntro?: () => void;
  onSuccess?: () => void;
  onSelectRoleLogin?: (role: UserRole, options?: { email?: string; fullName?: string; orgName?: string; accountType?: AccountType; isEmailVerified?: boolean }) => void;
}

export function SignupView({ 
  onBackToLogin, 
  onBackToIntro,
  onSuccess,
  onSelectRoleLogin 
}: SignupViewProps) {
  const [accountType, setAccountType] = useState<AccountType>('personal');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('analyst');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleBack = onBackToIntro || onBackToLogin;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter your email and password.');
      return;
    }

    if (accountType === 'organization' && !orgName) {
      setErrorMsg('Please provide your organization name for Enterprise access.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const targetOrg = accountType === 'organization' ? (orgName.trim() || 'Enterprise Cyber SOC') : 'Personal Sandbox';
    const targetRole: UserRole = accountType === 'organization' ? (selectedRole || 'admin') : 'analyst';

    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim() || (accountType === 'personal' ? 'Forensic User' : 'Team Member'),
              org_name: targetOrg,
              organization_name: targetOrg,
              role: targetRole,
              account_type: accountType
            }
          }
        });

        if (error) {
          setErrorMsg(error.message || 'Account registration failed.');
          setLoading(false);
          return;
        }

        if (data.user) {
          const isConfirmed = Boolean(data.user.email_confirmed_at);
          setSuccessMsg(
            isConfirmed
              ? `Account ready for ${email}. Opening your workspace…`
              : `Account created! Verification link sent to ${email}. Logging you into workspace…`
          );
          if (onSuccess) {
            setTimeout(onSuccess, 900);
          }
          return;
        }
      }

      // Direct Access Provisioning with Enclave
      setSuccessMsg(`Access ready for ${email}. Opening ${accountType === 'organization' ? 'Organization' : 'Individual'} workspace…`);
      setTimeout(() => {
        if (onSelectRoleLogin) {
          onSelectRoleLogin(targetRole, {
            email: email.trim(),
            fullName: fullName.trim() || (accountType === 'personal' ? 'Forensic User' : 'Team Member'),
            orgName: targetOrg,
            accountType,
            isEmailVerified: true
          });
        } else if (onSuccess) {
          onSuccess();
        }
      }, 700);
    } catch (err: any) {
      console.error('[Signup] Registration error:', err);
      setErrorMsg(err.message || 'An unexpected error occurred during account creation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ink)] bg-[radial-gradient(ellipse_900px_500px_at_50%_-10%,rgba(178,58,46,0.08),transparent_60%)] p-4 text-[var(--paper)] font-sans select-text relative overflow-y-auto">
      <div className="w-full max-w-[490px] bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-8 relative z-10">
        <div className="flex items-center justify-between mb-4 border-b border-[var(--line)] pb-3">
          {handleBack && (
            <button
              onClick={handleBack}
              className="text-[var(--paper-dim)] hover:text-[var(--paper)] text-xs flex items-center gap-1.5 transition-colors cursor-pointer bg-transparent border-0 p-0"
              title="Return to Home"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[var(--thread)]" />
              <span>Back to Home</span>
            </button>
          )}

          <button
            onClick={onBackToLogin}
            className="text-xs text-[var(--slate)] hover:text-[var(--paper)] hover:underline cursor-pointer transition-colors bg-transparent border-0 p-0"
          >
            Have an account? Sign in →
          </button>
        </div>

        {/* Brand Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-5 h-5 rounded-full border-[1.5px] border-[var(--thread)] relative shrink-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[var(--thread)]" />
          </div>
          <span className="font-display font-bold text-xl text-[var(--paper)] tracking-tight">
            Create TraceXMail Account
          </span>
        </div>

        <div className="text-[var(--paper-dim)] text-[13.5px] mb-4">
          Choose your account tier to begin email forensics, DNS verification, and threat mitigation.
        </div>

        {/* Mode Selector: Individual vs Organization */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-[var(--paper)] mb-2 font-mono uppercase tracking-wider">
            Select Account Tier:
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setAccountType('personal');
                setSelectedRole('analyst');
              }}
              className={`p-3 rounded-[2px] border text-left transition-all cursor-pointer ${
                accountType === 'personal'
                  ? 'bg-[rgba(127,163,186,0.18)] border-[var(--slate)] shadow-xs'
                  : 'bg-[var(--ink)] border-[var(--line)] text-[var(--paper-dim)] hover:border-[var(--paper-muted)]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10.5px] font-bold text-[var(--slate)] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  INDIVIDUAL
                </span>
                <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-[var(--ink-2)] text-[var(--paper-dim)]">FREE</span>
              </div>
              <div className="text-xs font-semibold text-[var(--paper)]">Email Analysis Only</div>
              <div className="text-[10px] text-[var(--paper-dim)] mt-0.5 leading-snug">Ingest &amp; inspect single emails, hops, and headers.</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setAccountType('organization');
                setSelectedRole('admin');
              }}
              className={`p-3 rounded-[2px] border text-left transition-all cursor-pointer ${
                accountType === 'organization'
                  ? 'bg-[rgba(201,162,39,0.18)] border-[var(--stamp)] shadow-xs'
                  : 'bg-[var(--ink)] border-[var(--line)] text-[var(--paper-dim)] hover:border-[var(--paper-muted)]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10.5px] font-bold text-[var(--stamp)] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  ORGANIZATION
                </span>
                <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-[rgba(201,162,39,0.2)] text-[var(--stamp)] font-bold">FULL ACCESS</span>
              </div>
              <div className="text-xs font-semibold text-[var(--paper)]">Full Enterprise SOC</div>
              <div className="text-[10px] text-[var(--paper-dim)] mt-0.5 leading-snug">Create Employee IDs, Gmail Push &amp; Live Alerts.</div>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-[2px] bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-[var(--rose-300)] text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--thread)]" />
            <div className="leading-relaxed font-sans">{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3.5 rounded-[2px] bg-[rgba(72,169,117,0.15)] border border-[var(--forensic-green)] text-[var(--paper)] text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[var(--forensic-green)]" />
            <div className="leading-relaxed font-sans">{successMsg}</div>
          </div>
        )}

        {!successMsg && (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs text-[var(--paper-dim)] font-medium" htmlFor="signup-name">
                  Your Full Name
                </label>
                <input
                  id="signup-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  disabled={loading}
                  className="w-full bg-[var(--ink)] border border-[var(--line)] focus:border-[var(--slate)] focus:outline-hidden rounded-[2px] px-3.5 py-2 text-sm text-[var(--paper)] placeholder-[var(--paper-muted)] transition-colors disabled:opacity-50 font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-[var(--paper-dim)] font-medium" htmlFor="signup-org">
                  {accountType === 'organization' ? 'Company / Organization' : 'Workspace Name (Optional)'}
                </label>
                <input
                  id="signup-org"
                  type="text"
                  required={accountType === 'organization'}
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder={accountType === 'organization' ? 'Acme Cyber SOC' : 'Personal Lab'}
                  disabled={loading}
                  className="w-full bg-[var(--ink)] border border-[var(--line)] focus:border-[var(--slate)] focus:outline-hidden rounded-[2px] px-3.5 py-2 text-sm text-[var(--paper)] placeholder-[var(--paper-muted)] transition-colors disabled:opacity-50 font-sans"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-[var(--paper-dim)] font-medium" htmlFor="signup-email">
                {accountType === 'organization' ? 'Work Email (Official Domain)' : 'Personal or Work Email'}
              </label>
              <input
                id="signup-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                disabled={loading}
                className="w-full bg-[var(--ink)] border border-[var(--line)] focus:border-[var(--slate)] focus:outline-hidden rounded-[2px] px-3.5 py-2 text-sm text-[var(--paper)] placeholder-[var(--paper-muted)] transition-colors disabled:opacity-50 font-sans"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-[var(--paper-dim)] font-medium" htmlFor="signup-password">
                Password (min 6 characters)
              </label>
              <input
                id="signup-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={loading}
                className="w-full bg-[var(--ink)] border border-[var(--line)] focus:border-[var(--slate)] focus:outline-hidden rounded-[2px] px-3.5 py-2 text-sm text-[var(--paper)] placeholder-[var(--paper-muted)] transition-colors disabled:opacity-50 font-sans"
              />
            </div>

            {accountType === 'organization' && (
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs text-[var(--paper-dim)] font-medium">
                  Initial Administrative Role:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('admin')}
                    className={`p-2.5 rounded-[2px] border text-left transition-all cursor-pointer ${
                      selectedRole === 'admin'
                        ? 'bg-[rgba(201,162,39,0.18)] border-[var(--stamp)] text-[var(--paper)]'
                        : 'bg-[var(--ink)] border-[var(--line)] text-[var(--paper-dim)] hover:border-[var(--paper-muted)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-mono text-[10px] font-bold text-[var(--stamp)]">ORG ADMIN</span>
                      <ShieldAlert className="w-3.5 h-3.5 text-[var(--stamp)]" />
                    </div>
                    <div className="text-xs truncate font-semibold">Admin (Lead)</div>
                    <div className="text-[10px] text-[var(--paper-dim)] truncate">Can create employee credentials</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('analyst')}
                    className={`p-2.5 rounded-[2px] border text-left transition-all cursor-pointer ${
                      selectedRole === 'analyst'
                        ? 'bg-[rgba(127,163,186,0.18)] border-[var(--slate)] text-[var(--paper)]'
                        : 'bg-[var(--ink)] border-[var(--line)] text-[var(--paper-dim)] hover:border-[var(--paper-muted)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-mono text-[10px] font-bold text-[var(--slate)]">SOC ANALYST</span>
                      <Shield className="w-3.5 h-3.5 text-[var(--slate)]" />
                    </div>
                    <div className="text-xs truncate font-semibold">Forensic Analyst</div>
                    <div className="text-[10px] text-[var(--paper-dim)] truncate">Full triage &amp; campaigns</div>
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-3 text-center flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 py-2.5 font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--paper)]" />
                  <span>Setting up account…</span>
                </>
              ) : (
                <span>{accountType === 'organization' ? 'Create Organization & Open Console' : 'Sign Up for Email Analysis'}</span>
              )}
            </button>
          </form>
        )}

        <div className="mt-4 text-[11.5px] text-[var(--paper-muted)] text-center font-sans">
          Email verification enabled. Fast instant activation.
        </div>
      </div>
    </div>
  );
}

