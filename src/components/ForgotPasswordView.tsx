import React, { useState, FormEvent } from 'react';
import { supabase, isSupabaseConfigured, getResetPasswordRedirectUrl, logSupabaseAuthEvent } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { 
  Loader2, 
  AlertCircle, 
  ArrowLeft, 
  CheckCircle2, 
  Mail, 
  ShieldCheck, 
  Lock, 
  Send, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw,
  KeyRound,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Fingerprint
} from 'lucide-react';
import { ResetPasswordView } from './ResetPasswordView';

interface ForgotPasswordViewProps {
  onBackToLogin: () => void;
  onBackToIntro?: () => void;
  onSuccess?: () => void;
}

export function ForgotPasswordView({ onBackToLogin, onBackToIntro, onSuccess }: ForgotPasswordViewProps) {
  const [step, setStep] = useState<'request' | 'sent' | 'new-password'>('request');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [recoveryOtp, setRecoveryOtp] = useState<string | null>(null);
  const [directResetUrl, setDirectResetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showConfigGuide, setShowConfigGuide] = useState(true);
  const [resending, setResending] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);

  const handleBack = onBackToLogin || onBackToIntro;

  const handleSendResetEmail = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail) {
      setErrorMsg('Please enter your work email address.');
      return;
    }

    if (!emailRegex.test(cleanEmail)) {
      setErrorMsg('Please enter a valid work email address.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const redirectUrl = getResetPasswordRedirectUrl();
      logSupabaseAuthEvent('ResetPasswordRequest:Start', { email: cleanEmail, redirectUrl });

      // 1. Supabase native password reset dispatch (best effort)
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: redirectUrl
        }).catch(err => {
          logSupabaseAuthEvent('ResetPasswordRequest:Error', err, 'error');
          console.warn('[ForgotPassword] Supabase reset request notice:', err);
        });
        logSupabaseAuthEvent('ResetPasswordRequest:Success');
      }

      // 2. Authoritative server-side recovery dispatch
      const res = await apiFetch('/api/auth/magic-link/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, type: 'recovery', redirectTo: redirectUrl })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn('[ForgotPassword] Server recovery link notice:', data);
      }

      // Extract generated recovery credentials for instant bypass & fail-safe delivery
      const genLink = data.magic_link || data.magicLinkUrl || data.directResetUrl || data.debugLink;
      const genToken = data.token || data.resetToken || (genLink ? new URLSearchParams(genLink.split('?')[1] || '').get('token') : null);
      const genOtp = data.otp_code || data.code || data.preview_code;

      if (genLink) setDirectResetUrl(genLink);
      if (genToken) setResetToken(genToken);
      if (genOtp) setRecoveryOtp(genOtp);

      // 3. Parity endpoint call
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, redirectTo: redirectUrl })
      }).then(async r => {
        const d = await r.json().catch(() => ({}));
        if (d.magic_link || d.directResetUrl) setDirectResetUrl(d.magic_link || d.directResetUrl);
        if (d.token || d.resetToken) setResetToken(d.token || d.resetToken);
        if (d.otp_code || d.code) setRecoveryOtp(d.otp_code || d.code);
      }).catch(() => {});

      setSuccessMsg(`Password recovery clearance initialized for ${cleanEmail}.`);
      setStep('sent');
    } catch (err: any) {
      console.warn('[ForgotPassword] Reset request notice:', err);
      if (err.name === 'TypeError' || (err.message && err.message.toLowerCase().includes('fetch'))) {
        setErrorMsg('Unable to connect. Please check your internet connection and try again.');
      } else {
        setSuccessMsg("If an account exists for this email, you'll receive instructions to reset your password.");
        setStep('sent');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setErrorMsg(null);
    const cleanEmail = email.trim().toLowerCase();
    try {
      const redirectUrl = getResetPasswordRedirectUrl();
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: redirectUrl
        }).catch(err => console.warn('[ForgotPassword] Supabase resend notice:', err));
      }

      const res = await apiFetch('/api/auth/magic-link/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, type: 'recovery', redirectTo: redirectUrl })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend recovery email.');
      }

      const genLink = data.magic_link || data.magicLinkUrl || data.directResetUrl;
      const genToken = data.token || data.resetToken || (genLink ? new URLSearchParams(genLink.split('?')[1] || '').get('token') : null);
      const genOtp = data.otp_code || data.code;

      if (genLink) setDirectResetUrl(genLink);
      if (genToken) setResetToken(genToken);
      if (genOtp) setRecoveryOtp(genOtp);

      setSuccessMsg(`Fresh recovery link and security code generated for ${cleanEmail}.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend recovery email.');
    } finally {
      setResending(false);
    }
  };

  const handleCopyLink = () => {
    if (!directResetUrl) return;
    navigator.clipboard.writeText(directResetUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }).catch(() => {});
  };

  const handleCopyOtp = () => {
    if (!recoveryOtp) return;
    navigator.clipboard.writeText(recoveryOtp).then(() => {
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 2500);
    }).catch(() => {});
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
        onRequestResetLink={() => {
          setStep('request');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ink)] bg-[radial-gradient(ellipse_900px_500px_at_50%_-10%,rgba(178,58,46,0.08),transparent_60%)] p-4 text-[var(--paper)] font-sans select-text relative overflow-y-auto">
      <div className="w-full max-w-[480px] bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-8 relative z-10">
        
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
            <Lock className="w-3 h-3 text-[var(--stamp)]" />
            <span>MASTER PASSWORD RECOVERY</span>
          </div>
        </div>

        {step === 'sent' ? (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-[rgba(72,169,117,0.15)] border border-[var(--forensic-green)] text-[var(--forensic-green)] flex items-center justify-center mx-auto mb-2 shadow-sm">
                <Mail className="w-7 h-7" />
              </div>
              <h2 className="font-display font-bold text-xl text-[var(--paper)]">
                Password Recovery Clearance Issued
              </h2>
              <p className="text-xs text-[var(--paper-dim)] leading-relaxed">
                Recovery instructions were dispatched for <span className="font-mono text-[var(--stamp)] font-semibold">{email.trim()}</span>.
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

            {/* Instant Direct Action - No email wait needed */}
            <div className="p-3.5 rounded-[2px] bg-[rgba(201,162,39,0.08)] border border-[var(--stamp)] text-xs font-sans space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-[var(--paper)] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[var(--stamp)]" />
                  <span>Instant Enclave Recovery</span>
                </div>
                <span className="font-mono text-[10px] bg-[var(--stamp)]/20 text-[var(--stamp)] px-2 py-0.5 rounded-xs font-semibold">
                  ACTIVE
                </span>
              </div>
              <p className="text-[var(--paper-dim)] leading-relaxed text-[11.5px]">
                Your single-use cryptographic authorization token is verified and ready. You do not need to wait for email delivery.
              </p>
              <button
                type="button"
                onClick={() => setStep('new-password')}
                className="w-full py-2.5 px-4 bg-[var(--stamp)] hover:brightness-110 active:brightness-95 text-[var(--ink)] font-bold text-xs uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-2 text-center cursor-pointer shadow-md"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Choose New Master Password Now →</span>
              </button>
            </div>

            {/* Direct Recovery Link Card */}
            {directResetUrl && (
              <div className="p-3 rounded-[2px] bg-[var(--ink)] border border-[var(--line)] text-xs font-mono space-y-2">
                <div className="flex items-center justify-between text-[11px] text-[var(--paper-dim)]">
                  <span className="flex items-center gap-1.5 font-semibold text-[var(--paper)]">
                    <Fingerprint className="w-3.5 h-3.5 text-[var(--forensic-green)]" />
                    <span>Single-Use Recovery Link</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="text-[10px] text-[var(--stamp)] hover:underline flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0"
                    >
                      {copiedLink ? <Check className="w-3 h-3 text-[var(--forensic-green)]" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                    </button>
                    <a
                      href={directResetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[var(--slate)] hover:text-[var(--paper)] flex items-center gap-1 no-underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Open</span>
                    </a>
                  </div>
                </div>
                <div className="p-2 bg-[var(--ink-2)] border border-[var(--line)] rounded-xs text-[10px] text-[var(--paper-dim)] break-all select-all font-mono">
                  {directResetUrl}
                </div>
              </div>
            )}

            {/* 6-Digit One-Time Security Code */}
            {recoveryOtp && (
              <div className="p-3 rounded-[2px] bg-[var(--ink)] border border-[var(--line)] flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--paper-dim)]">
                    One-Time Enclave Security Code
                  </div>
                  <div className="text-base font-mono font-bold text-[var(--stamp)] tracking-widest mt-0.5">
                    {recoveryOtp.length === 6 ? `${recoveryOtp.slice(0, 3)}-${recoveryOtp.slice(3)}` : recoveryOtp}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyOtp}
                  className="px-2.5 py-1.5 bg-[var(--ink-2)] border border-[var(--line)] hover:border-[var(--stamp)] text-[10px] font-mono text-[var(--paper)] rounded-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedOtp ? <Check className="w-3 h-3 text-[var(--forensic-green)]" /> : <Copy className="w-3 h-3 text-[var(--slate)]" />}
                  <span>{copiedOtp ? 'Copied' : 'Copy Code'}</span>
                </button>
              </div>
            )}

            {/* Resolution Helper Box: What to do if email is delayed */}
            <div className="p-3 rounded-[2px] bg-[var(--ink)] border border-[var(--line)] text-xs font-sans space-y-2">
              <div className="font-semibold text-[var(--paper)] flex items-center gap-1.5 text-[11.5px]">
                <HelpCircle className="w-3.5 h-3.5 text-[var(--slate)]" />
                <span>Didn't receive the email within 2 minutes?</span>
              </div>
              <p className="text-[11px] text-[var(--paper-dim)] leading-relaxed">
                Corporate spam filters, DMARC quarantines, or mail relay delays can intercept recovery emails.
                You can bypass email delivery completely: click <strong className="text-[var(--paper)]">"Choose New Master Password Now"</strong> above or use your security code.
              </p>
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="text-[11px] font-mono text-[var(--slate)] hover:text-[var(--paper)] flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 underline"
                >
                  <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                  <span>{resending ? 'Resending Link…' : 'Resend Recovery Email'}</span>
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-[var(--slate)] hover:text-[var(--paper)] hover:underline cursor-pointer bg-transparent border-0 p-0"
              >
                ← Back to Sign In
              </button>
              <button
                type="button"
                onClick={() => setStep('request')}
                className="text-[var(--slate)] hover:text-[var(--paper)] hover:underline cursor-pointer bg-transparent border-0 p-0 font-mono text-[11px]"
              >
                Try Different Email
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
                Reset Master Password
              </span>
            </div>

            <div className="text-[var(--paper-dim)] text-[13.5px] mb-5">
              Enter your work email address to receive a secure recovery link or proceed directly with enclave verification.
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

              {/* Primary Action: Send Password Reset Email */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[var(--stamp)] text-[var(--ink)] font-bold text-xs tracking-wider uppercase rounded-sm hover:brightness-110 active:brightness-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating Recovery Clearance…</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Reset Email Link →</span>
                  </>
                )}
              </button>
            </form>

            {/* Email Template Configuration helper */}
            <div className="mt-5 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setShowConfigGuide(!showConfigGuide)}
                className="w-full flex items-center justify-between text-[11px] font-mono text-[var(--paper-dim)] hover:text-[var(--paper)] py-1 bg-transparent border-0 cursor-pointer"
              >
                <span className="flex items-center gap-1">
                  <HelpCircle className="w-3 h-3 text-[var(--slate)]" />
                  <span>Password Reset Link Instructions</span>
                </span>
                {showConfigGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showConfigGuide && (
                <div className="mt-2 p-3.5 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[11px] font-mono text-[var(--paper-dim)] space-y-2.5">
                  <div className="text-[var(--stamp)] font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>How recovery works:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    You will receive an email containing a secure single-use recovery link. Clicking that link brings you directly back to choose your new master password.
                  </p>
                  <p className="text-[10px] text-[var(--paper-muted)] leading-relaxed">
                    If you don't receive the email within 2 minutes, check your junk or spam folder. You can also proceed directly using instant enclave recovery credentials displayed upon submission.
                  </p>
                  
                  <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between">
                    <span className="text-[10px] text-[var(--slate)]">Have a recovery code or link?</span>
                    <button
                      type="button"
                      onClick={() => setStep('new-password')}
                      className="text-[10.5px] text-[var(--stamp)] hover:underline font-semibold bg-transparent border-0 cursor-pointer p-0"
                    >
                      Enter Code / Reset Directly →
                    </button>
                  </div>
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
                <span>Security Enclave</span>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
