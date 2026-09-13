import React, { useState, FormEvent } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { GoogleAuthButton } from './GoogleAuthButton';
import { Loader2, AlertCircle, ArrowLeft, CheckCircle2, ShieldAlert, Shield, Eye, User, Building2, MailCheck } from 'lucide-react';
import { UserRole, AccountType } from '../hooks/useSession';

interface SignupViewProps {
  onBackToLogin: () => void;
  onBackToIntro?: () => void;
  onSuccess?: () => void;
  onSelectRoleLogin?: (role: UserRole, options: {
    token: string;
    userId: string;
    email: string;
    fullName?: string;
    orgName?: string;
    accountType?: AccountType;
    isEmailVerified: boolean;
  }) => void;
}

export function SignupView({ 
  onBackToLogin, 
  onBackToIntro,
  onSuccess,
  onSelectRoleLogin: _onSelectRoleLogin 
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

    if (password.length < 12) {
      setErrorMsg('Security Policy: Password must be at least 12 characters in length.');
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
          const errMsg = error.message.toLowerCase();
          if (errMsg.includes('pwned') || errMsg.includes('compromised') || errMsg.includes('breach') || errMsg.includes('leaked')) {
            setErrorMsg('Security Notice: This password has appeared in known public data breaches. Please choose a different, strong password.');
            setLoading(false);
            return;
          }
          if (errMsg.includes('already registered') || errMsg.includes('already exists') || errMsg.includes('user already in use')) {
            // Anti-enumeration: return identical confirmation prompt
            setSuccessMsg(`Verification link dispatched. Please check your inbox at ${email.trim()} to confirm your account.`);
            setLoading(false);
            return;
          }
          setErrorMsg(error.message || 'Account registration failed.');
          setLoading(false);
          return;
        }

        if (data.user) {
          const isConfirmed = Boolean(data.user.email_confirmed_at && data.session);
          if (isConfirmed) {
            setSuccessMsg(`Account ready for ${email}. Opening your workspace…`);
            if (onSuccess) {
              setTimeout(onSuccess, 900);
            }
          } else {
            setSuccessMsg(`Account created! Please check your email at ${email} to confirm your account before signing in.`);
          }
          return;
        }
      } else {
        // Supabase is not configured client-side: refuse fake access creation
        setErrorMsg('Account creation is not available: authentication service not configured.');
      }
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
          Register to authenticate your organization, retain forensic custody, and investigate email threats.
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-[2px] bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-[var(--rose-300)] text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--thread)]" />
            <div className="leading-relaxed font-sans">{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-[2px] bg-[rgba(72,169,117,0.15)] border border-[var(--forensic-green)] text-[var(--paper)] text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[var(--forensic-green)]" />
            <div className="leading-relaxed font-sans">{successMsg}</div>
          </div>
        )}

        {/* Supabase Google OAuth Action */}
        <div className="mb-3.5">
          <GoogleAuthButton
            id="google-signup-btn"
            mode="signup"
            variant="primary"
            onSuccess={() => {
              if (onSuccess) onSuccess();
            }}
            onError={(err) => setErrorMsg(err)}
          />
        </div>

        <div className="flex items-center gap-3 my-3 text-xs text-[var(--line)]">
          <div className="flex-1 h-px bg-[var(--line)]" />
          <span className="font-sans text-[11px] text-[var(--paper-muted)] font-medium">or register with work credentials</span>
          <div className="flex-1 h-px bg-[var(--line)]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Account Mode Selector */}
          <div>
            <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1.5 uppercase tracking-wider">
              Account Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccountType('personal')}
                className={`p-2.5 rounded-[2px] border text-left transition-all cursor-pointer ${
                  accountType === 'personal'
                    ? 'border-[var(--stamp)] bg-[rgba(201,162,39,0.12)] text-[var(--paper)]'
                    : 'border-[var(--line)] bg-[var(--ink)] text-[var(--paper-dim)] hover:border-[var(--paper-dim)]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs mb-0.5">
                  <User className="w-3.5 h-3.5 text-[var(--stamp)]" />
                  <span>Personal</span>
                </div>
                <div className="text-[10px] opacity-80">Sandbox analyst account</div>
              </button>

              <button
                type="button"
                onClick={() => setAccountType('organization')}
                className={`p-2.5 rounded-[2px] border text-left transition-all cursor-pointer ${
                  accountType === 'organization'
                    ? 'border-[var(--stamp)] bg-[rgba(201,162,39,0.12)] text-[var(--paper)]'
                    : 'border-[var(--line)] bg-[var(--ink)] text-[var(--paper-dim)] hover:border-[var(--paper-dim)]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs mb-0.5">
                  <Building2 className="w-3.5 h-3.5 text-[var(--stamp)]" />
                  <span>Organization</span>
                </div>
                <div className="text-[10px] opacity-80">Enterprise SOC team</div>
              </button>
            </div>
          </div>

          {accountType === 'organization' && (
            <div className="p-3 bg-[var(--ink)] border border-[var(--line)] rounded-[2px] space-y-3">
              <div>
                <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1 uppercase tracking-wider">
                  Organization / Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Cyber Defense Corp"
                  className="w-full text-xs font-mono py-2 px-3 bg-[var(--ink-2)] border border-[var(--line)] rounded-sm text-[var(--paper)] placeholder:text-[var(--paper-dim)]/40 focus:outline-none focus:border-[var(--stamp)]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1 uppercase tracking-wider">
                  Your SOC Role
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('admin')}
                    className={`p-1.5 text-center text-xs font-mono rounded-[2px] border cursor-pointer ${
                      selectedRole === 'admin'
                        ? 'border-[var(--stamp)] bg-[rgba(201,162,39,0.2)] text-[var(--stamp)] font-bold'
                        : 'border-[var(--line)] text-[var(--paper-dim)] hover:text-[var(--paper)]'
                    }`}
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('analyst')}
                    className={`p-1.5 text-center text-xs font-mono rounded-[2px] border cursor-pointer ${
                      selectedRole === 'analyst'
                        ? 'border-[var(--slate)] bg-[rgba(127,163,186,0.2)] text-[var(--slate)] font-bold'
                        : 'border-[var(--line)] text-[var(--paper-dim)] hover:text-[var(--paper)]'
                    }`}
                  >
                    Analyst
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('read_only')}
                    className={`p-1.5 text-center text-xs font-mono rounded-[2px] border cursor-pointer ${
                      selectedRole === 'read_only'
                        ? 'border-[var(--paper-dim)] bg-[rgba(237,230,216,0.1)] text-[var(--paper)] font-bold'
                        : 'border-[var(--line)] text-[var(--paper-dim)] hover:text-[var(--paper)]'
                    }`}
                  >
                    Auditor
                  </button>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1 uppercase tracking-wider">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Sarah Chen"
              className="w-full text-xs font-mono py-2 px-3 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] placeholder:text-[var(--paper-dim)]/40 focus:outline-none focus:border-[var(--stamp)]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1 uppercase tracking-wider">
              Work Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="s.chen@enterprise.corp"
              className="w-full text-xs font-mono py-2 px-3 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] placeholder:text-[var(--paper-dim)]/40 focus:outline-none focus:border-[var(--stamp)]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-mono font-medium text-[var(--paper-dim)] uppercase tracking-wider">
                Master Password *
              </label>
              <span className="text-[10px] font-mono text-[var(--paper-dim)]">Min 12 characters</span>
            </div>
            <input
              type="password"
              required
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••••••"
              className="w-full text-xs font-mono py-2 px-3 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] placeholder:text-[var(--paper-dim)]/40 focus:outline-none focus:border-[var(--stamp)]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-[var(--stamp)] text-[var(--ink)] font-bold text-xs tracking-wider uppercase rounded-sm hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Creating Account…</span>
              </>
            ) : (
              <span>Create Account</span>
            )}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-[var(--line)] text-center text-xs text-[var(--paper-dim)]">
          Already have clearance?{' '}
          <button
            onClick={onBackToLogin}
            className="text-[var(--stamp)] hover:underline font-semibold cursor-pointer bg-transparent border-0 p-0"
          >
            Sign in here
          </button>
        </div>
      </div>
    </div>
  );
}
