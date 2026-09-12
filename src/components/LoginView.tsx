import React, { useState, FormEvent } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { GoogleAuthButton } from './GoogleAuthButton';
import { Loader2, AlertCircle, ArrowLeft, Shield, UserCheck, KeyRound, ShieldAlert, Eye, Lock, MailCheck, Send } from 'lucide-react';
import { UserRole, AccountType } from '../hooks/useSession';

interface LoginViewProps {
  onBackToGate?: () => void;
  onBackToIntro?: () => void;
  onRequestAccess?: () => void;
  onForgotPassword?: () => void;
  onSuccess?: () => void;
  onSelectRoleLogin?: (role: UserRole, options?: { email?: string; fullName?: string; orgName?: string; accountType?: AccountType; isEmailVerified?: boolean }) => void;
}

export function LoginView({ 
  onBackToGate, 
  onBackToIntro,
  onRequestAccess, 
  onForgotPassword,
  onSuccess,
  onSelectRoleLogin 
}: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [verificationPending, setVerificationPending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  // MFA state
  const [mfaChallenge, setMfaChallenge] = useState<{ factorId: string; challengeId: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);

  const handleBack = onBackToIntro || onBackToGate;

  const handleResendVerification = async () => {
    if (!email) return;
    setResending(true);
    setResendStatus(null);
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: email.trim()
        });
        if (error) {
          setResendStatus('Failed to resend: ' + error.message);
        } else {
          setResendStatus('Verification link dispatched to ' + email.trim() + '. Please check your inbox.');
        }
      } else {
        setResendStatus('Verification link dispatched to ' + email.trim() + '.');
      }
    } catch (err: any) {
      setResendStatus(err.message || 'Error sending verification link.');
    } finally {
      setResending(false);
    }
  };

  const handleVerifyMfa = async (e: FormEvent) => {
    e.preventDefault();
    if (!totpCode || totpCode.trim().length < 6 || !mfaChallenge) {
      setErrorMsg('Please enter your 6-digit authenticator security code.');
      return;
    }
    setMfaVerifying(true);
    setErrorMsg(null);
    try {
      if (supabase) {
        const { error } = await supabase.auth.mfa.verify({
          factorId: mfaChallenge.factorId,
          challengeId: mfaChallenge.challengeId,
          code: totpCode.trim()
        });
        if (error) {
          setErrorMsg('Invalid or expired MFA code. Please check your authenticator app and try again.');
          setMfaVerifying(false);
          return;
        }
      }
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'MFA verification failed.');
    } finally {
      setMfaVerifying(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both your work email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setVerificationPending(false);
    setResendStatus(null);
    setMfaChallenge(null);

    try {
      // 1. Primary: Supabase Auth
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('email not confirmed') || msg.includes('unverified') || msg.includes('not verified')) {
            setVerificationPending(true);
            setErrorMsg('Strict Access Control: Email verification is required before access is unlocked. Please click the confirmation link sent to your email.');
            setLoading(false);
            return;
          }
          // Generic non-enumerating error message
          setErrorMsg('Authentication Failed: Invalid email or password. Access is strictly denied.');
          setLoading(false);
          return;
        }

        if (data.session) {
          // Check if email confirmed
          if (!data.user?.email_confirmed_at && data.user?.app_metadata?.provider === 'email') {
            setVerificationPending(true);
            setErrorMsg('Access Restricted: Email verification pending. Please verify your email before logging in.');
            setLoading(false);
            return;
          }

          // Check if user requires MFA challenge
          try {
            const { data: aalData, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            if (aalErr) {
              console.warn('[LoginView] Supabase getAuthenticatorAssuranceLevel notice:', aalErr.message);
            }
            if (aalData && aalData.currentLevel === 'aal1' && aalData.nextLevel === 'aal2') {
              console.log('[LoginView] User requires AAL2 MFA verification. Fetching factors...');
              const { data: factorsData, error: factorsErr } = await supabase.auth.mfa.listFactors();
              if (factorsErr) {
                console.warn('[LoginView] /auth/v1/factors listFactors notice during login:', factorsErr.message, factorsErr);
              }
              const totpFactor = factorsData?.totp?.find((f: any) => f.status === 'verified');
              if (totpFactor) {
                const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
                  factorId: totpFactor.id
                });
                if (!challengeError && challengeData) {
                  setMfaChallenge({
                    factorId: totpFactor.id,
                    challengeId: challengeData.id
                  });
                  setLoading(false);
                  return;
                }
              }
            }
          } catch (mfaErr) {
            console.warn('[LoginView] MFA challenge check notice:', mfaErr);
          }

          if (onSuccess) onSuccess();
          return;
        }
      }

      // 2. Fallback: Authenticate via hardened server endpoint /api/auth/login
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const resData = await res.json();
      if (!res.ok) {
        setErrorMsg(resData.error || 'Authentication Failed: Invalid email or password.');
        setLoading(false);
        return;
      }

      if (onSelectRoleLogin && resData.user) {
        onSelectRoleLogin(resData.user.role || 'analyst', {
          email: resData.user.email,
          fullName: resData.user.fullName || resData.user.email.split('@')[0],
          orgName: 'Acme Cyber Defense SOC',
          accountType: 'organization',
          isEmailVerified: resData.user.emailVerified
        });
      } else if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('[Login] Authentication error:', err);
      setErrorMsg('Authentication Failed: Invalid email or password.');
      setLoading(false);
    }
  };

  const handleQuickRole = (role: UserRole, roleName: string, roleEmail: string, accType: AccountType = 'organization') => {
    if (onSelectRoleLogin) {
      onSelectRoleLogin(role, {
        email: roleEmail,
        fullName: roleName,
        orgName: accType === 'personal' ? 'Personal Sandbox' : 'Acme Security Team',
        accountType: accType,
        isEmailVerified: true
      });
    } else if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ink)] bg-[radial-gradient(ellipse_900px_500px_at_50%_-10%,rgba(178,58,46,0.08),transparent_60%)] p-4 text-[var(--paper)] font-sans select-text relative overflow-y-auto">
      <div className="w-full max-w-[470px] bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-8 relative z-10">
        
        {/* Top bar with back button */}
        <div className="flex items-center justify-between mb-5 border-b border-[var(--line)] pb-3">
          {handleBack && (
            <button
              onClick={handleBack}
              className="text-[var(--paper-dim)] hover:text-[var(--paper)] text-xs flex items-center gap-1.5 transition-colors cursor-pointer bg-transparent border-0 p-0"
              title="Return to Home Page"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[var(--thread)]" />
              <span>Back to Home</span>
            </button>
          )}

          <div className="font-mono text-[10.5px] text-[var(--stamp)] uppercase tracking-wider ml-auto flex items-center gap-1">
            <Lock className="w-3 h-3 text-[var(--stamp)]" />
            <span>STRICT AUTHENTICATION</span>
          </div>
        </div>

        {/* Brand Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-5 h-5 rounded-full border-[1.5px] border-[var(--thread)] relative shrink-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[var(--thread)]" />
          </div>
          <span className="font-display font-bold text-xl text-[var(--paper)] tracking-tight">
            TraceXMail Sign In
          </span>
        </div>

        <div className="text-[var(--paper-dim)] text-[13.5px] mb-5">
          Sign in to inspect suspicious emails, view route maps, and access your forensic cases.
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-[2px] bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-[var(--rose-300)] text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--thread)]" />
            <div className="leading-relaxed font-sans flex-1">
              <div>{errorMsg}</div>
              {verificationPending && (
                <div className="mt-2 pt-2 border-t border-[rgba(178,58,46,0.3)] flex items-center justify-between">
                  <span className="text-[11px] text-[var(--paper-dim)]">Haven&apos;t received the email?</span>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resending}
                    className="text-[11px] font-mono text-[var(--stamp)] hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0"
                  >
                    <Send className="w-3 h-3" />
                    <span>{resending ? 'Sending…' : 'Resend Link'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {resendStatus && (
          <div className="mb-4 p-3 rounded-[2px] bg-[rgba(72,169,117,0.15)] border border-[var(--forensic-green)] text-[var(--paper)] text-xs flex items-start gap-2.5">
            <MailCheck className="w-4 h-4 shrink-0 mt-0.5 text-[var(--forensic-green)]" />
            <div className="leading-relaxed font-sans">{resendStatus}</div>
          </div>
        )}

        {/* 1-Click Fast Role Sign In */}
        <div className="mb-5 p-3.5 rounded-[2px] bg-[var(--ink)] border border-[var(--line)]">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-sans font-semibold text-[var(--paper-dim)] flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[var(--slate)]" />
              1-Click Instant Demo Login:
            </span>
            <span className="text-[10px] font-mono text-[var(--forensic-green)] flex items-center gap-1 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--forensic-green)]" />
              Enclave Active
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickRole('admin', 'Alex Vance (SOC Lead)', 'admin@tracexmail.sec', 'organization')}
              className="p-2.5 rounded-[2px] border border-[rgba(201,162,39,0.35)] bg-[rgba(201,162,39,0.08)] hover:bg-[rgba(201,162,39,0.18)] hover:border-[var(--stamp)] text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] font-bold text-[var(--stamp)]">ORG ADMIN</span>
                <ShieldAlert className="w-3 h-3 text-[var(--stamp)] opacity-80 group-hover:opacity-100" />
              </div>
              <div className="text-[11px] text-[var(--paper)] truncate font-semibold">Full Access</div>
              <div className="text-[9.5px] text-[var(--paper-dim)] truncate">+ Employees</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickRole('analyst', 'Sarah Chen', 'analyst@tracexmail.sec', 'organization')}
              className="p-2.5 rounded-[2px] border border-[rgba(127,163,186,0.35)] bg-[rgba(127,163,186,0.08)] hover:bg-[rgba(127,163,186,0.18)] hover:border-[var(--slate)] text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] font-bold text-[var(--slate)]">ANALYST</span>
                <Shield className="w-3 h-3 text-[var(--slate)] opacity-80 group-hover:opacity-100" />
              </div>
              <div className="text-[11px] text-[var(--paper)] truncate font-semibold">Analyst</div>
              <div className="text-[9.5px] text-[var(--paper-dim)] truncate">Full analysis</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickRole('read_only', 'Marcus Reed', 'auditor@tracexmail.sec', 'organization')}
              className="p-2.5 rounded-[2px] border border-[var(--line)] bg-[var(--ink-2)] hover:bg-[rgba(237,230,216,0.08)] hover:border-[var(--paper-dim)] text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] font-bold text-[var(--paper-dim)]">AUDITOR</span>
                <Eye className="w-3 h-3 text-[var(--paper-dim)] opacity-80 group-hover:opacity-100" />
              </div>
              <div className="text-[11px] text-[var(--paper)] truncate font-semibold">Auditor</div>
              <div className="text-[9.5px] text-[var(--paper-dim)] truncate">Privacy view</div>
            </button>
          </div>
        </div>

        {/* Supabase Google OAuth Action */}
        <div className="mb-3.5">
          <GoogleAuthButton
            id="google-signin-btn"
            mode="continue"
            variant="primary"
            onSuccess={() => {
              if (onSuccess) onSuccess();
            }}
            onError={(err) => setErrorMsg(err)}
          />
        </div>

        <div className="flex items-center gap-3 my-3 text-xs text-[var(--line)]">
          <div className="flex-1 h-px bg-[var(--line)]" />
          <span className="font-sans text-[11px] text-[var(--paper-muted)] font-medium">or enter your account credentials</span>
          <div className="flex-1 h-px bg-[var(--line)]" />
        </div>

        {mfaChallenge ? (
          <form onSubmit={handleVerifyMfa} className="space-y-4">
            <div className="p-3 bg-[rgba(201,162,39,0.12)] border border-[var(--stamp)] rounded-[2px] text-xs text-[var(--paper)]">
              <div className="font-semibold text-[var(--stamp)] flex items-center gap-1.5 mb-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Multi-Factor Authentication (MFA) Required</span>
              </div>
              <p className="text-[var(--paper-dim)] leading-relaxed">
                Enter the 6-digit verification code from your authenticator app (e.g. Google Authenticator) to complete sign-in.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-[var(--paper-dim)] font-medium" htmlFor="totp-code">
                Security Code
              </label>
              <input
                id="totp-code"
                type="text"
                required
                maxLength={6}
                autoFocus
                autoComplete="one-time-code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                disabled={mfaVerifying}
                className="w-full bg-[var(--ink)] border border-[var(--line)] focus:border-[var(--stamp)] focus:outline-hidden rounded-[2px] px-3.5 py-2 text-center text-lg tracking-widest font-mono text-[var(--paper)] placeholder-[var(--paper-muted)] transition-colors disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={mfaVerifying || totpCode.trim().length < 6}
              className="btn-primary w-full mt-2 text-center flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 py-2.5 font-semibold"
            >
              {mfaVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--paper)]" />
                  <span>Verifying Code…</span>
                </>
              ) : (
                <span>Verify &amp; Continue</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setMfaChallenge(null); setTotpCode(''); }}
              className="w-full text-center text-xs text-[var(--paper-dim)] hover:text-[var(--paper)] transition-colors py-1 cursor-pointer bg-transparent border-0"
            >
              ← Cancel &amp; back to sign-in
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="block text-xs text-[var(--paper-dim)] font-medium" htmlFor="login-email">
                Work or Personal Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com or employee@domain.com"
                disabled={loading}
                className="w-full bg-[var(--ink)] border border-[var(--line)] focus:border-[var(--slate)] focus:outline-hidden rounded-[2px] px-3.5 py-2 text-sm text-[var(--paper)] placeholder-[var(--paper-muted)] transition-colors disabled:opacity-50 font-sans"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs text-[var(--paper-dim)] font-medium" htmlFor="login-password">
                  Password
                </label>
                {onForgotPassword && (
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-[11.5px] text-[var(--slate)] hover:text-[var(--paper)] hover:underline cursor-pointer transition-colors bg-transparent border-0"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={loading}
                className="w-full bg-[var(--ink)] border border-[var(--line)] focus:border-[var(--slate)] focus:outline-hidden rounded-[2px] px-3.5 py-2 text-sm text-[var(--paper)] placeholder-[var(--paper-muted)] transition-colors disabled:opacity-50 font-sans"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 text-center flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 py-2.5 font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--paper)]" />
                  <span>Checking Credentials…</span>
                </>
              ) : (
                <span>Sign In to TraceXMail</span>
              )}
            </button>
          </form>
        )}

        {onRequestAccess && (
          <div className="mt-4 pt-3.5 border-t border-[var(--line)] text-center">
            <button
              type="button"
              onClick={onRequestAccess}
              className="text-xs text-[var(--slate)] hover:text-[var(--paper)] hover:underline cursor-pointer transition-colors bg-transparent border-0"
            >
              Don&apos;t have an account? Sign up now →
            </button>
          </div>
        )}

        <div className="mt-4 text-[11.5px] text-[var(--paper-muted)] text-center font-sans">
          Protected with end-to-end encryption &amp; email verification check
        </div>
      </div>
    </div>
  );
}

