import React, { useState, FormEvent } from 'react';
import { supabase, isSupabaseConfigured, getResetPasswordRedirectUrl, logSupabaseAuthEvent } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { 
  Loader2, 
  AlertCircle, 
  Mail, 
  Send, 
  ShieldCheck
} from 'lucide-react';
import { ResetPasswordView } from './ResetPasswordView';
import { CheckInboxScreen } from './common/CheckInboxScreen';

interface ForgotPasswordViewProps {
  onBackToLogin: () => void;
  onBackToIntro?: () => void;
  onSuccess?: () => void;
}

export function ForgotPasswordView({ onBackToLogin, onBackToIntro, onSuccess }: ForgotPasswordViewProps) {
  const [step, setStep] = useState<'request' | 'sent' | 'new-password'>('request');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

    try {
      const redirectUrl = getResetPasswordRedirectUrl();
      logSupabaseAuthEvent('ResetPasswordRequest:Start', { email: cleanEmail, redirectUrl });

      // 1. Supabase secondary attempt if configured
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: redirectUrl
          });
        } catch (err: any) {
          console.warn('[ForgotPassword] Supabase reset request note:', err?.message);
        }
      }

      // 2. Authoritative backend endpoint
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, redirectTo: redirectUrl })
      });

      // Advance to check inbox screen regardless of account existence (prevents email enumeration)
      setStep('sent');
    } catch (err: any) {
      console.warn('[ForgotPassword] Reset request note:', err);
      if (err.name === 'TypeError' || (err.message && err.message.toLowerCase().includes('fetch'))) {
        setErrorMsg('Unable to connect. Please check your internet connection and try again.');
      } else {
        // Enforce enumeration resistance
        setStep('sent');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    const redirectUrl = getResetPasswordRedirectUrl();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: redirectUrl });
      } catch (err: any) {
        console.warn('[ForgotPassword] Resend note:', err?.message);
      }
    }

    await apiFetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, redirectTo: redirectUrl })
    });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ink)] bg-[radial-gradient(ellipse_900px_500px_at_50%_-10%,rgba(178,58,46,0.08),transparent_60%)] p-4 text-[var(--paper)] font-sans select-text relative overflow-y-auto">
      <div className="w-full max-w-[480px] bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-8 relative z-10">
        {step === 'sent' ? (
          <CheckInboxScreen
            email={email}
            title="Check your inbox"
            description="If an account exists for this email, we sent instructions to reset your password."
            onResend={handleResend}
            onChangeEmail={() => {
              setStep('request');
              setErrorMsg(null);
            }}
            onBackToLogin={onBackToLogin}
          />
        ) : step === 'new-password' ? (
          <ResetPasswordView
            onBackToLogin={onBackToLogin}
            onSuccess={onSuccess}
            defaultEmail={email}
          />
        ) : (
          <>
            {/* Brand Header */}
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-5 h-5 rounded-full border-[1.5px] border-[var(--thread)] relative shrink-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[var(--thread)]" />
              </div>
              <h1 className="font-display font-bold text-xl text-[var(--paper)] tracking-tight m-0">
                Reset Password
              </h1>
            </div>

            <p className="text-[var(--paper-dim)] text-[13.5px] mb-5 leading-relaxed">
              Enter your work email address to receive password reset instructions.
            </p>

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
                    <span>Sending instructions…</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Reset Instructions →</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-3.5 border-t border-[var(--line)] flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-[var(--slate)] hover:text-[var(--paper)] hover:underline cursor-pointer transition-colors bg-transparent border-0 p-0"
              >
                ← Return to sign in
              </button>
              <span className="text-[11px] text-[var(--paper-dim)] font-mono flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--forensic-green)]" />
                <span>Protected</span>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
