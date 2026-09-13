import React, { useState, useEffect, FormEvent } from 'react';
import { supabase, isSupabaseConfigured, logSupabaseAuthEvent } from '../lib/supabase';
import { 
  Loader2, 
  AlertCircle, 
  ArrowLeft, 
  CheckCircle2, 
  KeyRound, 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  Sparkles,
  Check,
  X,
  ShieldAlert
} from 'lucide-react';

interface ResetPasswordViewProps {
  onSuccess: () => void;
  onBackToLogin: () => void;
  resetToken?: string | null;
  userEmail?: string | null;
}

export function ResetPasswordView({ 
  onSuccess, 
  onBackToLogin, 
  resetToken: initialResetToken, 
  userEmail: initialUserEmail 
}: ResetPasswordViewProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeUserEmail, setActiveUserEmail] = useState<string | null>(initialUserEmail || null);
  const [recoverySessionDetected, setRecoverySessionDetected] = useState(false);

  // Check if Supabase has an active recovery session or current user
  useEffect(() => {
    let isMounted = true;
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!isMounted) return;
        if (session?.user) {
          setRecoverySessionDetected(true);
          if (session.user.email) {
            setActiveUserEmail(session.user.email);
          }
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (!isMounted) return;
        if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) {
          setRecoverySessionDetected(true);
          if (session?.user?.email) {
            setActiveUserEmail(session.user.email);
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
  const hasMinLength = newPassword.length >= 8;
  const hasStrongLength = newPassword.length >= 12;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const strengthScore = [
    hasMinLength,
    hasStrongLength,
    hasUppercase && hasLowercase,
    hasNumber,
    hasSpecial
  ].filter(Boolean).length;

  const getStrengthLabel = () => {
    if (!newPassword) return { text: 'None', color: 'text-[var(--paper-dim)]' };
    if (strengthScore <= 2) return { text: 'Weak', color: 'text-[var(--thread)]' };
    if (strengthScore <= 4) return { text: 'Good', color: 'text-[var(--stamp)]' };
    return { text: 'Strong Enclave Tier', color: 'text-[var(--forensic-green)]' };
  };

  const handleGenerateStrong = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+=-';
    let generated = '';
    for (let i = 0; i < 16; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowPassword(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      setErrorMsg('Please enter your new master password.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg('Password policy requires at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify and try again.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. If Supabase is active, update the user password via Supabase Auth
      if (isSupabaseConfigured && supabase) {
        logSupabaseAuthEvent('UpdatePassword:Start', { email: activeUserEmail });
        const { error } = await supabase.auth.updateUser({
          password: newPassword
        });

        if (error) {
          logSupabaseAuthEvent('UpdatePassword:Error', error, 'error');
          // If Supabase session is missing or expired, attempt fallback via OTP token if present
          if (initialResetToken && activeUserEmail) {
            const fallbackRes = await fetch('/api/auth/reset-password-with-otp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: activeUserEmail,
                resetToken: initialResetToken,
                newPassword
              })
            });
            if (fallbackRes.ok) {
              setSuccess(true);
              setLoading(false);
              return;
            }
          }
          throw error;
        }

        logSupabaseAuthEvent('UpdatePassword:Success');
        setSuccess(true);
        setLoading(false);
        return;
      }

      // 2. Server API fallback using OTP token
      if (initialResetToken && activeUserEmail) {
        const res = await fetch('/api/auth/reset-password-with-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: activeUserEmail,
            resetToken: initialResetToken,
            newPassword
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to update password');
        }

        setSuccess(true);
      } else {
        throw new Error('Authentication session for password recovery is missing. Please request a new reset link.');
      }
    } catch (err: any) {
      console.error('[ResetPasswordView] Password update error:', err);
      setErrorMsg(err.message || 'Failed to update password. Your recovery link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ink)] bg-[radial-gradient(ellipse_900px_500px_at_50%_-10%,rgba(72,169,117,0.1),transparent_60%)] p-4 text-[var(--paper)] font-sans select-text">
        <div className="w-full max-w-[460px] bg-[var(--ink-2)] border border-[var(--forensic-green)] rounded-sm p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.8)] text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-[rgba(72,169,117,0.18)] border border-[var(--forensic-green)] text-[var(--forensic-green)] flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--paper)]">
              Password Successfully Updated
            </h2>
            <p className="text-xs sm:text-sm text-[var(--paper-dim)] leading-relaxed">
              Your master cryptographic password has been updated. You can now use your new credentials to access TraceXMail.
            </p>
          </div>

          <div className="p-3 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-xs font-mono text-[var(--paper-dim)] flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--forensic-green)]" />
            <span>ENCLAVE CREDENTIALS SYNCHRONIZED</span>
          </div>

          <button
            type="button"
            onClick={onSuccess}
            className="w-full py-3 px-4 bg-[var(--stamp)] text-[var(--ink)] font-bold text-xs tracking-wider uppercase rounded-sm hover:brightness-110 active:brightness-95 cursor-pointer shadow-lg flex items-center justify-center gap-2"
          >
            <span>Proceed to Workspace →</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ink)] bg-[radial-gradient(ellipse_900px_500px_at_50%_-10%,rgba(178,58,46,0.08),transparent_60%)] p-4 text-[var(--paper)] font-sans select-text relative overflow-y-auto">
      <div className="w-full max-w-[460px] bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-8 relative z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 mb-4">
          <button
            type="button"
            onClick={onBackToLogin}
            className="text-[var(--paper-dim)] hover:text-[var(--paper)] text-xs flex items-center gap-1.5 transition-colors cursor-pointer bg-transparent border-0 p-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[var(--thread)]" />
            <span>Cancel</span>
          </button>

          <div className="font-mono text-[10.5px] text-[var(--forensic-green)] uppercase tracking-wider flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>RECOVERY CLEARANCE</span>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1 mb-5">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-5 h-5 rounded-full border-[1.5px] border-[var(--thread)] relative shrink-0 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-[var(--thread)]" />
            </div>
            <span className="font-display font-bold text-xl text-[var(--paper)] tracking-tight">
              Set New Master Password
            </span>
          </div>
          <p className="text-xs text-[var(--paper-dim)]">
            {activeUserEmail ? (
              <>Resetting security credentials for <span className="font-mono text-[var(--stamp)] font-semibold">{activeUserEmail}</span></>
            ) : (
              'Enter and confirm your new secure master password.'
            )}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-[2px] bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-[var(--rose-300)] text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--thread)]" />
            <div className="leading-relaxed font-sans">{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono font-medium text-[var(--paper-dim)] uppercase tracking-wider">
                New Password *
              </label>
              <button
                type="button"
                onClick={handleGenerateStrong}
                className="text-[10px] font-mono text-[var(--slate)] hover:underline cursor-pointer bg-transparent border-0 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto-Generate</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full text-xs font-mono py-2.5 px-3 pr-9 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] focus:outline-none focus:border-[var(--stamp)] focus:ring-1 focus:ring-[var(--stamp)] transition-all"
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

          {/* Strength Bar */}
          {newPassword && (
            <div className="space-y-1.5 p-2.5 bg-[var(--ink)] border border-[var(--line)] rounded-sm">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-[var(--paper-dim)]">Password Strength:</span>
                <span className={`font-semibold ${getStrengthLabel().color}`}>{getStrengthLabel().text}</span>
              </div>
              <div className="grid grid-cols-5 gap-1 h-1.5">
                {[1, 2, 3, 4, 5].map(step => (
                  <div
                    key={step}
                    className={`h-full rounded-[1px] transition-all ${
                      strengthScore >= step
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
          )}

          {/* Confirm Password Input */}
          <div>
            <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1.5 uppercase tracking-wider">
              Confirm New Password *
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full text-xs font-mono py-2.5 px-3 pr-9 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] focus:outline-none focus:border-[var(--stamp)] focus:ring-1 focus:ring-[var(--stamp)] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2.5 top-2.5 text-[var(--paper-dim)] hover:text-[var(--paper)] bg-transparent border-0 cursor-pointer p-0"
              >
                {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-[var(--paper-dim)]" />}
              </button>
            </div>
          </div>

          {/* Requirements Checklist */}
          <div className="p-3 bg-[var(--ink)] border border-[var(--line)] rounded-sm space-y-1 text-[11px] font-mono text-[var(--paper-dim)]">
            <div className="flex items-center gap-1.5">
              {hasMinLength ? <Check className="w-3 h-3 text-[var(--forensic-green)]" /> : <X className="w-3 h-3 text-[var(--paper-dim)]" />}
              <span className={hasMinLength ? 'text-[var(--paper)]' : ''}>At least 8 characters (12+ recommended)</span>
            </div>
            <div className="flex items-center gap-1.5">
              {hasUppercase && hasLowercase ? <Check className="w-3 h-3 text-[var(--forensic-green)]" /> : <X className="w-3 h-3 text-[var(--paper-dim)]" />}
              <span className={hasUppercase && hasLowercase ? 'text-[var(--paper)]' : ''}>Uppercase &amp; lowercase letters</span>
            </div>
            <div className="flex items-center gap-1.5">
              {hasNumber || hasSpecial ? <Check className="w-3 h-3 text-[var(--forensic-green)]" /> : <X className="w-3 h-3 text-[var(--paper-dim)]" />}
              <span className={hasNumber || hasSpecial ? 'text-[var(--paper)]' : ''}>Includes number or symbol</span>
            </div>
            <div className="flex items-center gap-1.5">
              {passwordsMatch ? <Check className="w-3 h-3 text-[var(--forensic-green)]" /> : <X className="w-3 h-3 text-[var(--paper-dim)]" />}
              <span className={passwordsMatch ? 'text-[var(--paper)]' : ''}>Passwords match exactly</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !hasMinLength || !passwordsMatch}
            className="w-full mt-2 py-2.5 px-4 bg-[var(--stamp)] text-[var(--ink)] font-bold text-xs tracking-wider uppercase rounded-sm hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Updating Enclave Credentials…</span>
              </>
            ) : (
              <span>Save New Password &amp; Unlock →</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
