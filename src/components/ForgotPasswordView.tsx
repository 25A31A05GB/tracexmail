import React, { useState, FormEvent } from 'react';
import { supabase, isSupabaseConfigured, getResetPasswordRedirectUrl, logSupabaseAuthEvent } from '../lib/supabase';
import { 
  Loader2, 
  AlertCircle, 
  ArrowLeft, 
  CheckCircle2, 
  KeyRound, 
  Mail, 
  ShieldCheck, 
  Lock, 
  Send,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { OtpVerificationModal } from './OtpVerificationModal';
import { ResetPasswordView } from './ResetPasswordView';

interface ForgotPasswordViewProps {
  onBackToLogin: () => void;
  onBackToIntro?: () => void;
  onSuccess?: () => void;
}

export function ForgotPasswordView({ onBackToLogin, onBackToIntro, onSuccess }: ForgotPasswordViewProps) {
  const [step, setStep] = useState<'request' | 'sent' | 'otp' | 'new-password'>('request');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showConfigGuide, setShowConfigGuide] = useState(false);
  const [resending, setResending] = useState(false);

  const handleBack = onBackToLogin || onBackToIntro;

  const handleSendResetEmail = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid work email address.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const redirectUrl = getResetPasswordRedirectUrl();
      logSupabaseAuthEvent('ResetPasswordRequest:Start', { email: email.trim(), redirectUrl });

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: redirectUrl
        });

        if (error) {
          logSupabaseAuthEvent('ResetPasswordRequest:Error', error, 'error');
          // If rate limited or error, surface helpful explanation
          throw error;
        }
        logSupabaseAuthEvent('ResetPasswordRequest:Success');
      } else {
        // Fallback API if Supabase client not directly active
        await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), redirectTo: redirectUrl })
        });
      }

      setSuccessMsg(`A secure recovery link has been dispatched to ${email.trim()}.`);
      setStep('sent');
    } catch (err: any) {
      console.warn('[ForgotPassword] Supabase reset request notice:', err);
      setErrorMsg(err.message || 'Unable to process recovery request. Please verify your email or use One-Time Password verification.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setErrorMsg(null);
    try {
      const redirectUrl = getResetPasswordRedirectUrl();
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: redirectUrl
        });
        if (error) throw error;
      }
      setSuccessMsg(`New recovery link dispatched to ${email.trim()}.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend recovery email.');
    } finally {
      setResending(false);
    }
  };

  const handleOtpVerified = (data: any) => {
    if (data.resetToken) {
      setResetToken(data.resetToken);
    }
    setStep('new-password');
  };

  if (step === 'new-password') {
    return (
      <ResetPasswordView
        resetToken={resetToken}
        userEmail={email.trim()}
        onSuccess={() => {
          if (onSuccess) {
            onSuccess();
          } else {
            onBackToLogin();
          }
        }}
        onBackToLogin={onBackToLogin}
      />
    );
  }

  if (step === 'otp') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ink)] bg-[radial-gradient(ellipse_900px_500px_at_50%_-10%,rgba(178,58,46,0.08),transparent_60%)] p-4 text-[var(--paper)] font-sans select-text relative overflow-y-auto">
        <div className="w-full max-w-[460px] bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-8 relative z-10">
          <OtpVerificationModal
            email={email.trim()}
            type="recovery"
            title="Account Recovery Code"
            subtitle={`Enter the 6-digit one-time password dispatched to ${email.trim()} to authorize your password change.`}
            onVerified={handleOtpVerified}
            onBack={() => setStep('request')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ink)] bg-[radial-gradient(ellipse_900px_500px_at_50%_-10%,rgba(178,58,46,0.08),transparent_60%)] p-4 text-[var(--paper)] font-sans select-text relative overflow-y-auto">
      <div className="w-full max-w-[460px] bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-8 relative z-10">
        
        {/* Top Header */}
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
            <span>SUPABASE AUTH RECOVERY</span>
          </div>
        </div>

        {step === 'sent' ? (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-[rgba(72,169,117,0.15)] border border-[var(--forensic-green)] text-[var(--forensic-green)] flex items-center justify-center mx-auto mb-2">
                <Mail className="w-7 h-7" />
              </div>
              <h2 className="font-display font-bold text-xl text-[var(--paper)]">
                Check Your Email Inbox
              </h2>
              <p className="text-xs text-[var(--paper-dim)] leading-relaxed">
                We sent a password reset link to <span className="font-mono text-[var(--stamp)] font-semibold">{email.trim()}</span> using the Supabase <span className="font-mono">resetPasswordForEmail</span> service.
              </p>
            </div>

            {successMsg && (
              <div className="p-3 rounded-[2px] bg-[rgba(72,169,117,0.12)] border border-[var(--forensic-green)] text-[var(--paper)] text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[var(--forensic-green)]" />
                <div className="leading-relaxed font-sans">{successMsg}</div>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-[2px] bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-[var(--rose-300)] text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--thread)]" />
                <div className="leading-relaxed font-sans">{errorMsg}</div>
              </div>
            )}

            <div className="p-3.5 rounded-[2px] bg-[var(--ink)] border border-[var(--line)] text-xs font-sans space-y-2">
              <div className="font-semibold text-[var(--paper)] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[var(--forensic-green)]" />
                <span>Next Step:</span>
              </div>
              <p className="text-[var(--paper-dim)] leading-relaxed text-[11.5px]">
                Click the confirmation button or link in the email. You will be redirected securely back to TraceXMail to choose a new password.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="w-full py-2.5 px-4 bg-[var(--ink-2)] border border-[var(--line)] hover:border-[var(--paper-dim)] text-[var(--paper)] font-semibold text-xs rounded-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[var(--slate)] ${resending ? 'animate-spin' : ''}`} />
                <span>{resending ? 'Resending Link…' : 'Resend Recovery Email'}</span>
              </button>

              <button
                type="button"
                onClick={() => setStep('otp')}
                className="w-full py-2 px-3 text-xs text-[var(--stamp)] hover:underline flex items-center justify-center gap-1.5 cursor-pointer bg-transparent border-0"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Prefer 6-Digit One-Time Password? Verify with OTP →</span>
              </button>
            </div>

            <div className="pt-3 border-t border-[var(--line)] text-center">
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-xs text-[var(--slate)] hover:text-[var(--paper)] hover:underline cursor-pointer bg-transparent border-0"
              >
                ← Back to Sign In
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Brand Header */}
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-5 h-5 rounded-full border-[1.5px] border-[var(--thread)] relative shrink-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[var(--thread)]" />
              </div>
              <span className="font-display font-bold text-xl text-[var(--paper)] tracking-tight">
                Forgot Your Password?
              </span>
            </div>

            <div className="text-[var(--paper-dim)] text-[13.5px] mb-5">
              Enter your verified email to receive a password reset link from Supabase Auth or verify instantly with an OTP.
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-[2px] bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-[var(--rose-300)] text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--thread)]" />
                <div className="leading-relaxed font-sans">{errorMsg}</div>
              </div>
            )}

            <form onSubmit={handleSendResetEmail} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs text-[var(--paper-dim)] font-medium font-mono uppercase tracking-wider" htmlFor="recovery-email">
                  Work Email Address *
                </label>
                <div className="relative">
                  <input
                    id="recovery-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="analyst@defense.corp"
                    disabled={loading}
                    className="w-full bg-[var(--ink)] border border-[var(--line)] focus:border-[var(--stamp)] focus:outline-hidden rounded-[2px] px-3.5 py-2.5 pl-9 text-xs font-mono text-[var(--paper)] placeholder-[var(--paper-dim)]/40 transition-colors disabled:opacity-50"
                  />
                  <Mail className="w-3.5 h-3.5 text-[var(--paper-dim)] absolute left-3 top-3" />
                </div>
              </div>

              {/* Primary Action: Send Supabase Password Reset Email */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[var(--stamp)] text-[var(--ink)] font-bold text-xs tracking-wider uppercase rounded-sm hover:brightness-110 active:brightness-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Reset Link…</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Reset Email Link →</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-3 my-2 text-xs text-[var(--line)]">
                <div className="flex-1 h-px bg-[var(--line)]" />
                <span className="font-sans text-[11px] text-[var(--paper-dim)] font-medium">or instant verification</span>
                <div className="flex-1 h-px bg-[var(--line)]" />
              </div>

              {/* Secondary Option: Instant OTP code */}
              <button
                type="button"
                onClick={() => {
                  if (!email) {
                    setErrorMsg('Please enter your work email first.');
                    return;
                  }
                  setStep('otp');
                }}
                className="w-full py-2 px-3 text-xs font-semibold text-[var(--paper-dim)] border border-[var(--line)] rounded-sm hover:text-[var(--paper)] hover:border-[var(--paper-dim)] transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-[var(--slate)]" />
                <span>Verify with 6-Digit One-Time Password</span>
              </button>
            </form>

            {/* Supabase Email Template Configuration helper */}
            <div className="mt-5 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setShowConfigGuide(!showConfigGuide)}
                className="w-full flex items-center justify-between text-[11px] font-mono text-[var(--paper-dim)] hover:text-[var(--paper)] py-1 bg-transparent border-0 cursor-pointer"
              >
                <span className="flex items-center gap-1">
                  <HelpCircle className="w-3 h-3 text-[var(--slate)]" />
                  <span>Supabase Email Template Configuration</span>
                </span>
                {showConfigGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showConfigGuide && (
                <div className="mt-2 p-3 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[11px] font-mono text-[var(--paper-dim)] space-y-2">
                  <div className="text-[var(--stamp)] font-semibold">Supabase Dashboard &gt; Auth &gt; Email Templates:</div>
                  <div className="p-2 bg-[var(--ink-2)] rounded-[2px] text-[10.5px] leading-relaxed text-[var(--paper)] select-all overflow-x-auto">
                    <code>&lt;a href=&quot;&#123;&#123; .ConfirmationURL &#125;&#125;&quot;&gt;Reset TraceXMail Password&lt;/a&gt;</code>
                  </div>
                  <p className="text-[10px] text-[var(--paper-muted)]">
                    Supabase replaces <code className="text-[var(--slate)]">&#123;&#123; .ConfirmationURL &#125;&#125;</code> with the secure recovery token and redirects back to the configured <code className="text-[var(--slate)]">redirectTo</code> URL (`/#reset-password`).
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3.5 border-t border-[var(--line)] flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-[var(--slate)] hover:text-[var(--paper)] hover:underline cursor-pointer transition-colors bg-transparent border-0 p-0"
              >
                ← Remember your password?
              </button>
              <span className="text-[11px] text-[var(--paper-dim)] font-mono flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--forensic-green)]" />
                <span>Supabase Enclave</span>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
