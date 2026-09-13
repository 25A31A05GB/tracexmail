import React, { useState, FormEvent } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  Loader2, 
  AlertCircle, 
  ArrowLeft, 
  CheckCircle2, 
  KeyRound, 
  Mail, 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  Sparkles,
  Send
} from 'lucide-react';
import { OtpVerificationModal } from './OtpVerificationModal';

interface ForgotPasswordViewProps {
  onBackToLogin: () => void;
  onBackToIntro?: () => void;
}

export function ForgotPasswordView({ onBackToLogin, onBackToIntro }: ForgotPasswordViewProps) {
  const [step, setStep] = useState<'request' | 'otp' | 'new-password' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleBack = onBackToLogin || onBackToIntro;

  const handleStartOtpRecovery = (e: FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter your account email address.');
      return;
    }
    setErrorMsg(null);
    setStep('otp');
  };

  const handleOtpVerified = (data: any) => {
    if (data.resetToken) {
      setResetToken(data.resetToken);
    }
    setStep('new-password');
  };

  const handleSendEmailLink = async () => {
    if (!email) {
      setErrorMsg('Please enter your registered email address first.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/#reset-password` : undefined
        });
      } else {
        await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() })
        });
      }

      setSuccessMsg(`If an account exists for ${email.trim()}, password recovery instructions and a secure reset link have been dispatched.`);
    } catch (err: any) {
      console.warn('[ForgotPassword] Reset link error:', err);
      setSuccessMsg(`If an account exists for ${email.trim()}, password recovery instructions have been dispatched.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      setErrorMsg('Please enter your new password.');
      return;
    }

    if (newPassword.length < 12) {
      setErrorMsg('Security Policy: New password must be at least 12 characters in length.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please check and re-enter.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/reset-password-with-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          resetToken,
          newPassword
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to update password.');
        setLoading(false);
        return;
      }

      setStep('done');
    } catch (err: any) {
      console.error('[ForgotPassword] Password update error:', err);
      setErrorMsg(err.message || 'An error occurred while resetting password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ink)] bg-[radial-gradient(ellipse_900px_500px_at_50%_-10%,rgba(178,58,46,0.08),transparent_60%)] p-4 text-[var(--paper)] font-sans select-text relative overflow-y-auto">
      <div className="w-full max-w-[460px] bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-8 relative z-10">
        
        {step === 'otp' ? (
          <OtpVerificationModal
            email={email.trim()}
            type="recovery"
            title="Account Recovery Code"
            subtitle={`Enter the 6-digit one-time password dispatched to ${email.trim()} to authorize password change.`}
            onVerified={handleOtpVerified}
            onBack={() => setStep('request')}
          />
        ) : step === 'new-password' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <button
                type="button"
                onClick={() => setStep('request')}
                className="text-[var(--paper-dim)] hover:text-[var(--paper)] text-xs flex items-center gap-1.5 transition-colors cursor-pointer bg-transparent border-0 p-0"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[var(--thread)]" />
                <span>Cancel</span>
              </button>
              <span className="font-mono text-[10.5px] text-[var(--forensic-green)] uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>IDENTITY VERIFIED</span>
              </span>
            </div>

            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-[rgba(72,169,117,0.15)] border border-[var(--forensic-green)] text-[var(--forensic-green)] flex items-center justify-center mx-auto mb-2">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-[var(--paper)]">
                Create New Master Password
              </h3>
              <p className="text-xs text-[var(--paper-dim)]">
                Authorized recovery for <span className="font-mono text-[var(--paper)] font-semibold">{email}</span>
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-[2px] bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-[var(--rose-300)] text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--thread)]" />
                <div className="leading-relaxed font-sans">{errorMsg}</div>
              </div>
            )}

            <form onSubmit={handleSetNewPassword} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-mono font-medium text-[var(--paper-dim)] uppercase tracking-wider">
                    New Master Password *
                  </label>
                  <span className="text-[10px] font-mono text-[var(--paper-dim)]">Min 12 chars</span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={12}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full text-xs font-mono py-2 px-3 pr-8 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] focus:outline-none focus:border-[var(--stamp)]"
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
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={12}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full text-xs font-mono py-2 px-3 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] focus:outline-none focus:border-[var(--stamp)]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 bg-[var(--stamp)] text-[var(--ink)] font-bold text-xs tracking-wider uppercase rounded-sm hover:brightness-110 active:brightness-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating Password…</span>
                  </>
                ) : (
                  <span>Update Password & Complete</span>
                )}
              </button>
            </form>
          </div>
        ) : step === 'done' ? (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-[rgba(72,169,117,0.15)] border border-[var(--forensic-green)] text-[var(--forensic-green)] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-bold text-lg text-[var(--paper)]">
                Password Successfully Reset
              </h3>
              <p className="text-xs text-[var(--paper-dim)] leading-relaxed">
                Your master security credentials have been updated and synchronized with the cryptographic enclave.
              </p>
            </div>
            <button
              onClick={onBackToLogin}
              className="w-full py-2.5 px-4 bg-[var(--stamp)] text-[var(--ink)] font-bold text-xs tracking-wider uppercase rounded-sm hover:brightness-110 cursor-pointer"
            >
              Sign In with New Password
            </button>
          </div>
        ) : (
          <>
            {/* Top bar with back button */}
            <div className="flex items-center justify-between mb-5 border-b border-[var(--line)] pb-3">
              <button
                onClick={handleBack}
                className="text-[var(--paper-dim)] hover:text-[var(--paper)] text-xs flex items-center gap-1.5 transition-colors cursor-pointer bg-transparent border-0 p-0"
                title="Return to Sign In"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[var(--thread)]" />
                <span>Back to Sign In</span>
              </button>

              <div className="font-mono text-[10.5px] text-[var(--stamp)] uppercase tracking-wider ml-auto flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-[var(--stamp)]" />
                <span>ACCOUNT RECOVERY</span>
              </div>
            </div>

            {/* Brand Header */}
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-5 h-5 rounded-full border-[1.5px] border-[var(--thread)] relative shrink-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[var(--thread)]" />
              </div>
              <span className="font-display font-bold text-xl text-[var(--paper)] tracking-tight">
                Reset Password
              </span>
            </div>

            <div className="text-[var(--paper-dim)] text-[13.5px] mb-5">
              Enter your registered work email to verify via a 6-digit One-Time Password or receive a secure reset link.
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

            <form onSubmit={handleStartOtpRecovery} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs text-[var(--paper-dim)] font-medium font-mono uppercase tracking-wider" htmlFor="reset-email">
                  Registered Work Email *
                </label>
                <div className="relative">
                  <input
                    id="reset-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="analyst@defense.corp"
                    disabled={loading}
                    className="w-full bg-[var(--ink)] border border-[var(--line)] focus:border-[var(--stamp)] focus:outline-hidden rounded-[2px] px-3.5 py-2 pl-9 text-xs font-mono text-[var(--paper)] placeholder-[var(--paper-dim)]/40 transition-colors disabled:opacity-50"
                  />
                  <Mail className="w-3.5 h-3.5 text-[var(--paper-dim)] absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Primary: Instant OTP verification */}
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-[var(--stamp)] text-[var(--ink)] font-bold text-xs tracking-wider uppercase rounded-sm hover:brightness-110 active:brightness-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Verify with One-Time Password →</span>
              </button>

              {/* Secondary: Email reset link */}
              <div className="flex items-center gap-3 my-2 text-xs text-[var(--line)]">
                <div className="flex-1 h-px bg-[var(--line)]" />
                <span className="font-sans text-[11px] text-[var(--paper-dim)] font-medium">or</span>
                <div className="flex-1 h-px bg-[var(--line)]" />
              </div>

              <button
                type="button"
                onClick={handleSendEmailLink}
                disabled={loading || !email}
                className="w-full py-2 px-3 text-xs font-semibold text-[var(--paper-dim)] border border-[var(--line)] rounded-sm hover:text-[var(--paper)] hover:border-[var(--paper-dim)] transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Dispatching…</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3 text-[var(--slate)]" />
                    <span>Send Password Reset Email Link</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-3.5 border-t border-[var(--line)] flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-[var(--slate)] hover:text-[var(--paper)] hover:underline cursor-pointer transition-colors bg-transparent border-0"
              >
                ← Remember your password?
              </button>
              <span className="text-[11px] text-[var(--paper-dim)] font-mono flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--slate)]" />
                <span>256-bit Enclave</span>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
