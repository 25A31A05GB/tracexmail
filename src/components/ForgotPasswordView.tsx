import React, { useState, FormEvent } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Loader2, AlertCircle, ArrowLeft, CheckCircle2, KeyRound, Mail, ShieldCheck } from 'lucide-react';

interface ForgotPasswordViewProps {
  onBackToLogin: () => void;
  onBackToIntro?: () => void;
}

export function ForgotPasswordView({ onBackToLogin, onBackToIntro }: ForgotPasswordViewProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleBack = onBackToLogin || onBackToIntro;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter your account email address.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/#reset-password` : undefined
        });

        if (error) {
          setErrorMsg(error.message || 'Failed to send password reset email.');
          setLoading(false);
          return;
        }
      }

      // Successful password reset email dispatched
      setSuccessMsg(`Password reset instructions and verification link have been dispatched to ${email.trim()}. Please check your inbox and spam folders.`);
    } catch (err: any) {
      console.error('[ForgotPassword] Reset error:', err);
      setErrorMsg(err.message || 'An unexpected error occurred while requesting password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ink)] bg-[radial-gradient(ellipse_900px_500px_at_50%_-10%,rgba(178,58,46,0.08),transparent_60%)] p-4 text-[var(--paper)] font-sans select-text relative overflow-y-auto">
      <div className="w-full max-w-[460px] bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-8 relative z-10">
        
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
          Enter the work email associated with your TraceXMail account to receive secure recovery verification instructions.
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-[2px] bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-[var(--rose-300)] text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--thread)]" />
            <div className="leading-relaxed font-sans">{errorMsg}</div>
          </div>
        )}

        {successMsg ? (
          <div className="space-y-4">
            <div className="p-4 rounded-[2px] bg-[rgba(72,169,117,0.15)] border border-[var(--forensic-green)] text-[var(--paper)] text-xs flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-[var(--forensic-green)] mt-0.5" />
              <div className="space-y-2">
                <div className="font-semibold text-sm text-[var(--paper)]">Recovery Email Dispatched</div>
                <div className="leading-relaxed text-[var(--paper-dim)]">{successMsg}</div>
              </div>
            </div>

            <button
              onClick={onBackToLogin}
              className="btn-primary w-full text-center flex items-center justify-center gap-2 cursor-pointer py-2.5 font-semibold"
            >
              Return to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs text-[var(--paper-dim)] font-medium" htmlFor="reset-email">
                Registered Work Email
              </label>
              <div className="relative">
                <input
                  id="reset-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@company.com"
                  disabled={loading}
                  className="w-full bg-[var(--ink)] border border-[var(--line)] focus:border-[var(--slate)] focus:outline-hidden rounded-[2px] px-3.5 py-2 pl-9 text-sm text-[var(--paper)] placeholder-[var(--paper-muted)] transition-colors disabled:opacity-50 font-sans"
                />
                <Mail className="w-4 h-4 text-[var(--paper-muted)] absolute left-3 top-2.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-center flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 py-2.5 font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--paper)]" />
                  <span>Dispatching Reset Link…</span>
                </>
              ) : (
                <span>Send Password Reset Email</span>
              )}
            </button>
          </form>
        )}

        <div className="mt-5 pt-3.5 border-t border-[var(--line)] flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={onBackToLogin}
            className="text-[var(--slate)] hover:text-[var(--paper)] hover:underline cursor-pointer transition-colors bg-transparent border-0"
          >
            ← Remember your password?
          </button>
          <span className="text-[11px] text-[var(--paper-muted)] font-mono flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--slate)]" />
            256-bit Security
          </span>
        </div>
      </div>
    </div>
  );
}
