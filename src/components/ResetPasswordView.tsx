import React, { useState, useEffect, FormEvent } from 'react';
import { supabase, isSupabaseConfigured, logSupabaseAuthEvent } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { 
  Loader2, 
  AlertCircle, 
  ArrowLeft, 
  CheckCircle2, 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  Check, 
  X, 
  KeyRound,
  Mail
} from 'lucide-react';

interface ResetPasswordViewProps {
  onSuccess: () => void;
  onBackToLogin: () => void;
  onRequestResetLink?: () => void;
  resetToken?: string | null;
  userEmail?: string | null;
  defaultEmail?: string | null;
  onSelectRoleLogin?: (role: any, options: any) => void;
}

export function ResetPasswordView({ 
  onSuccess, 
  onBackToLogin, 
  onRequestResetLink,
  resetToken: initialResetToken, 
  userEmail: initialUserEmail,
  defaultEmail,
  onSelectRoleLogin
}: ResetPasswordViewProps) {
  const [emailInput, setEmailInput] = useState<string>(() => {
    if (initialUserEmail) return initialUserEmail;
    if (defaultEmail) return defaultEmail;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlEmail = params.get('email');
      if (urlEmail) return urlEmail;
      const hash = window.location.hash.replace(/^#\/?/, '').replace(/^reset-password\??/, '');
      const hashParams = new URLSearchParams(hash);
      const hashEmail = hashParams.get('email');
      if (hashEmail) return hashEmail;
    }
    return '';
  });

  const [currentResetToken, setCurrentResetToken] = useState<string | null>(initialResetToken || null);
  const [fallbackCode, setFallbackCode] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [recoverySessionDetected, setRecoverySessionDetected] = useState(false);
  const [issuedSession, setIssuedSession] = useState<{ token: string; user: any } | null>(null);

  // Sync initial reset token or email if props change
  useEffect(() => {
    if (initialResetToken) {
      setCurrentResetToken(initialResetToken);
    }
    if (initialUserEmail && !emailInput) {
      setEmailInput(initialUserEmail);
    }
  }, [initialResetToken, initialUserEmail]);

  // Read URL parameters once on mount and sanitize URL via history.replaceState
  useEffect(() => {
    let isMounted = true;

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash.replace(/^#\/?/, '').replace(/^reset-password\??/, '');
      const hashParams = new URLSearchParams(hash);
      
      const foundToken = params.get('token') || params.get('resetToken') || hashParams.get('token') || hashParams.get('resetToken');
      if (foundToken && isMounted) {
        setCurrentResetToken(foundToken);
      }

      const foundCode = params.get('code') || hashParams.get('code') || params.get('otp') || hashParams.get('otp');
      if (foundCode && isMounted) {
        setFallbackCode(foundCode);
      }

      const foundEmail = params.get('email') || hashParams.get('email');
      if (foundEmail && isMounted && !emailInput) {
        setEmailInput(foundEmail);
      }

      // Security rule 9: Remove tokens/codes from URL after reading
      if (window.location.search || window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      // If PKCE query code is present, exchange for Supabase session
      const code = params.get('code') || hashParams.get('code');
      if (code && isSupabaseConfigured && supabase) {
        (supabase.auth as any).exchangeCodeForSession?.(code).then(({ data, error }: any) => {
          if (!isMounted) return;
          if (!error && data?.session) {
            setRecoverySessionDetected(true);
            if (data.session.user?.email) {
              setEmailInput(data.session.user.email);
            }
          }
        }).catch((err: any) => console.warn('[ResetPasswordView] Code exchange note:', err));
      }

      // If hash contains access_token and refresh_token
      const accessToken = hashParams.get('access_token') || params.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || params.get('refresh_token');
      if (accessToken && refreshToken && isSupabaseConfigured && supabase) {
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ data, error }) => {
            if (!isMounted) return;
            if (!error && data?.session) {
              setRecoverySessionDetected(true);
              if (data.session.user?.email) {
                setEmailInput(data.session.user.email);
              }
            }
          })
          .catch(err => console.warn('[ResetPasswordView] setSession note:', err));
      }
    }

    // 2. Check Supabase active session
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!isMounted) return;
        if (session?.user) {
          setRecoverySessionDetected(true);
          if (session.user.email && !emailInput) {
            setEmailInput(session.user.email);
          }
        }
      }).catch(err => console.warn('[ResetPasswordView] getSession note:', err));

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (!isMounted) return;
        if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) {
          setRecoverySessionDetected(true);
          if (session?.user?.email && !emailInput) {
            setEmailInput(session.user.email);
          }
        }
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    }
  }, []);

  // Password requirements calculation
  const hasMinLength = newPassword.length >= 12;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const isNotEmail = !emailInput || newPassword.toLowerCase() !== emailInput.toLowerCase();
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const strengthScore = [
    newPassword.length >= 8,
    hasMinLength,
    hasUppercase && hasLowercase,
    hasNumber,
    hasSpecial
  ].filter(Boolean).length;

  const getStrengthLabel = () => {
    if (!newPassword) return { text: 'Empty', color: 'text-[var(--paper-dim)]' };
    if (strengthScore <= 2) return { text: 'Weak', color: 'text-[var(--thread)]' };
    if (strengthScore <= 4) return { text: 'Good', color: 'text-[var(--stamp)]' };
    return { text: 'Strong', color: 'text-[var(--forensic-green)]' };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const targetEmail = emailInput.trim().toLowerCase();
    if (!targetEmail) {
      setErrorMsg('Please enter your account email address.');
      return;
    }

    if (!newPassword) {
      setErrorMsg('Please enter your new password.');
      return;
    }

    if (newPassword.length < 12) {
      setErrorMsg('Password policy requires at least 12 characters.');
      return;
    }

    if (newPassword.toLowerCase() === targetEmail) {
      setErrorMsg('Password cannot be your email address.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify and try again.');
      return;
    }

    setLoading(true);

    try {
      let supabaseUpdated = false;
      let sessionToken: string | null = null;

      // 1. Attempt Supabase password update if active session is present
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            sessionToken = session.access_token || null;
            logSupabaseAuthEvent('UpdatePassword:Start', { email: targetEmail });
            const { error: sbError } = await supabase.auth.updateUser({
              password: newPassword
            });
            if (!sbError) {
              supabaseUpdated = true;
              logSupabaseAuthEvent('UpdatePassword:Success');
            }
          }
        } catch (sbErr) {
          console.warn('[ResetPasswordView] Supabase session check note:', sbErr);
        }
      }

      // 2. Synchronize password with server authoritative endpoint
      const res = await apiFetch('/api/auth/reset-password-with-token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {})
        },
        body: JSON.stringify({
          email: targetEmail,
          resetToken: currentResetToken || undefined,
          code: fallbackCode || undefined,
          newPassword
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (!supabaseUpdated) {
          if (data.code === 'INVALID_RESET_AUTHORIZATION') {
            setErrorMsg('Your reset link has expired or is invalid. Please request a new password reset link.');
          } else {
            setErrorMsg(data.error || 'Failed to update password. Please request a new reset link.');
          }
          setLoading(false);
          return;
        }
      }

      if (data.token && data.user) {
        setIssuedSession({ token: data.token, user: data.user });
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('[ResetPasswordView] Password update error:', err);
      setErrorMsg(err.message || 'An unexpected error occurred while resetting your password.');
    } finally {
      setLoading(false);
    }
  };

  const handleProceed = () => {
    if (issuedSession && onSelectRoleLogin) {
      onSelectRoleLogin(issuedSession.user.role || 'analyst', {
        token: issuedSession.token,
        userId: issuedSession.user.id,
        email: issuedSession.user.email,
        fullName: issuedSession.user.fullName || issuedSession.user.email.split('@')[0],
        orgName: issuedSession.user.organizationId || 'Acme Cyber Defense SOC',
        accountType: 'organization',
        isEmailVerified: true
      });
    } else {
      onSuccess();
    }
  };

  // 1. Success state
  if (success) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ink)] bg-[radial-gradient(ellipse_900px_500px_at_50%_-10%,rgba(72,169,117,0.1),transparent_60%)] p-4 text-[var(--paper)] font-sans select-text">
        <div className="w-full max-w-[460px] bg-[var(--ink-2)] border border-[var(--forensic-green)] rounded-sm p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.8)] text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-[rgba(72,169,117,0.18)] border border-[var(--forensic-green)] text-[var(--forensic-green)] flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--paper)]">
              Password Updated
            </h2>
            <p className="text-xs sm:text-sm text-[var(--paper-dim)] leading-relaxed">
              Your password has been successfully updated for <span className="font-mono text-[var(--stamp)] font-semibold">{emailInput}</span>. All earlier sessions have been revoked.
            </p>
          </div>

          <div className="p-3 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-xs font-mono text-[var(--paper-dim)] flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--forensic-green)]" />
            <span>CREDENTIALS SECURED</span>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={handleProceed}
              className="w-full py-3 px-4 bg-[var(--stamp)] text-[var(--ink)] font-bold text-xs tracking-wider uppercase rounded-sm hover:brightness-110 active:brightness-95 cursor-pointer shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              <span>Sign In to Workspace →</span>
            </button>

            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full py-2.5 px-4 bg-transparent border border-[var(--line)] text-[var(--paper-dim)] hover:text-[var(--paper)] hover:border-[var(--stamp)] font-mono text-xs uppercase tracking-wider rounded-sm cursor-pointer transition-colors"
            >
              Return to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isAuthorizedToReset = Boolean(recoverySessionDetected || currentResetToken || fallbackCode);

  // 2. If no token or recovery session detected, require requesting a link
  if (!isAuthorizedToReset) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ink)] bg-[radial-gradient(ellipse_900px_500px_at_50%_-10%,rgba(178,58,46,0.08),transparent_60%)] p-4 text-[var(--paper)] font-sans select-text relative overflow-y-auto">
        <div className="w-full max-w-[480px] bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-8 relative z-10">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 mb-5">
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-[var(--paper-dim)] hover:text-[var(--paper)] text-xs flex items-center gap-1.5 transition-colors cursor-pointer bg-transparent border-0 p-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[var(--thread)]" />
              <span>Back to Sign In</span>
            </button>
            <span className="font-mono text-[10.5px] text-[var(--stamp)] uppercase tracking-wider">
              PASSWORD RESET
            </span>
          </div>

          <div className="text-center space-y-3 mb-6">
            <div className="w-14 h-14 rounded-full bg-[rgba(201,162,39,0.12)] border border-[var(--stamp)] text-[var(--stamp)] flex items-center justify-center mx-auto mb-2">
              <Mail className="w-7 h-7" />
            </div>
            <h2 className="font-display font-bold text-xl text-[var(--paper)]">
              Password Reset Link Required
            </h2>
            <p className="text-xs text-[var(--paper-dim)] leading-relaxed">
              To choose a new password, you need a valid reset link sent to your email address.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={onRequestResetLink || onBackToLogin}
              className="w-full py-2.5 px-4 bg-[var(--stamp)] hover:brightness-110 active:brightness-95 text-[var(--ink)] font-bold text-xs uppercase tracking-wider rounded-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Request Password Reset Link →</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authorized to reset: Set New Password Form
  const strengthInfo = getStrengthLabel();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ink)] bg-[radial-gradient(ellipse_900px_500px_at_50%_-10%,rgba(178,58,46,0.08),transparent_60%)] p-4 text-[var(--paper)] font-sans select-text relative overflow-y-auto">
      <div className="w-full max-w-[500px] bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-8 relative z-10">
        
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 mb-5">
          <button
            type="button"
            onClick={onBackToLogin}
            className="text-[var(--paper-dim)] hover:text-[var(--paper)] text-xs flex items-center gap-1.5 transition-colors cursor-pointer bg-transparent border-0 p-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[var(--thread)]" />
            <span>Cancel</span>
          </button>
          <div className="font-mono text-[10.5px] text-[var(--stamp)] uppercase tracking-wider flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[var(--stamp)]" />
            <span>SECURE RESET</span>
          </div>
        </div>

        <div className="mb-6 space-y-1">
          <h2 className="font-display font-bold text-xl text-[var(--paper)] tracking-tight">
            Set New Password
          </h2>
          <p className="text-xs text-[var(--paper-dim)] leading-relaxed">
            Choose a strong password with at least 12 characters.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-[2px] bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-[var(--rose-300)] text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--thread)]" />
            <div className="leading-relaxed font-sans">{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs text-[var(--paper-dim)] font-medium font-mono uppercase tracking-wider" htmlFor="reset-email">
              Account Email *
            </label>
            <input
              id="reset-email"
              type="email"
              required
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              placeholder="analyst@defense.corp"
              className="w-full text-xs font-mono py-2.5 px-3 bg-[var(--ink)] border border-[var(--line)] rounded-xs text-[var(--paper)] focus:outline-none focus:border-[var(--stamp)]"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs text-[var(--paper-dim)] font-medium font-mono uppercase tracking-wider" htmlFor="new-password">
                New Password *
              </label>
              <span className={`text-[11px] font-mono font-semibold ${strengthInfo.color}`}>
                {strengthInfo.text}
              </span>
            </div>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={12}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 12 characters"
                className="w-full text-xs font-mono py-2.5 px-3 pr-10 bg-[var(--ink)] border border-[var(--line)] rounded-xs text-[var(--paper)] focus:outline-none focus:border-[var(--stamp)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--paper-dim)] hover:text-[var(--paper)] bg-transparent border-0 cursor-pointer p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Password strength progress bar */}
            <div className="grid grid-cols-5 gap-1 pt-1">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <div
                  key={lvl}
                  className={`h-1 rounded-xs transition-colors ${
                    strengthScore >= lvl
                      ? strengthScore <= 2
                        ? 'bg-[var(--thread)]'
                        : strengthScore <= 4
                        ? 'bg-[var(--stamp)]'
                        : 'bg-[var(--forensic-green)]'
                      : 'bg-[var(--line)]'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs text-[var(--paper-dim)] font-medium font-mono uppercase tracking-wider" htmlFor="confirm-password">
              Confirm Password *
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={12}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full text-xs font-mono py-2.5 px-3 pr-10 bg-[var(--ink)] border border-[var(--line)] rounded-xs text-[var(--paper)] focus:outline-none focus:border-[var(--stamp)]"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--paper-dim)] hover:text-[var(--paper)] bg-transparent border-0 cursor-pointer p-1"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Validation Checklist */}
          <div className="p-3 bg-[var(--ink)] border border-[var(--line)] rounded-xs space-y-1.5 text-[11px] font-mono">
            <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-[var(--forensic-green)]' : 'text-[var(--paper-dim)]'}`}>
              {hasMinLength ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
              <span>At least 12 characters</span>
            </div>
            <div className={`flex items-center gap-1.5 ${isNotEmail ? 'text-[var(--forensic-green)]' : 'text-[var(--thread)]'}`}>
              {isNotEmail ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
              <span>Cannot be your email address</span>
            </div>
            <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-[var(--forensic-green)]' : 'text-[var(--paper-dim)]'}`}>
              {passwordsMatch ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
              <span>Passwords match</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !hasMinLength || !passwordsMatch || !isNotEmail}
            className="w-full py-2.5 px-4 bg-[var(--stamp)] hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--ink)] font-bold text-xs uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Updating Password…</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Save New Password →</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
