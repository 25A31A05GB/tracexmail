import React, { useEffect, useState, FormEvent } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft, ShieldCheck, Lock, KeyRound, Mail } from 'lucide-react';
import { UserRole, AccountType } from '../hooks/useSession';

interface MagicLinkVerifyViewProps {
  onBackToLogin: () => void;
  onBackToIntro?: () => void;
  onSuccess?: () => void;
  onRequestNewLink?: (email?: string) => void;
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

export function MagicLinkVerifyView({
  onBackToLogin,
  onBackToIntro,
  onSuccess,
  onRequestNewLink,
  onSelectRoleLogin
}: MagicLinkVerifyViewProps) {
  const [status, setStatus] = useState<'confirm' | 'verifying' | 'code-fallback' | 'success' | 'error'>('confirm');
  const [statusMsg, setStatusMsg] = useState('Please confirm to sign in to your account.');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [magicToken, setMagicToken] = useState<string>('');
  const [manualCode, setManualCode] = useState<string>('');
  const [submittingCode, setSubmittingCode] = useState<boolean>(false);
  const [isRecovery, setIsRecovery] = useState<boolean>(false);

  useEffect(() => {
    // 1. Extract params from both query string and hash on mount
    const searchParams = new URLSearchParams(window.location.search);
    let hashQuery = '';
    if (window.location.hash.includes('?')) {
      hashQuery = window.location.hash.split('?')[1] || '';
    } else if (window.location.hash.startsWith('#')) {
      hashQuery = window.location.hash.substring(1);
    }
    const hashParams = new URLSearchParams(hashQuery);

    const token = searchParams.get('token') || hashParams.get('token') || searchParams.get('magic_token') || hashParams.get('magic_token');
    const emailParam = searchParams.get('email') || hashParams.get('email');
    const code = searchParams.get('code') || hashParams.get('code');
    const typeParam = searchParams.get('type') || hashParams.get('type');

    if (token) setMagicToken(token);
    if (emailParam) setUserEmail(emailParam);
    if (code) setManualCode(code);
    if (typeParam === 'recovery' || hashQuery.includes('type=recovery') || window.location.search.includes('type=recovery')) {
      setIsRecovery(true);
    }

    // Security rule 9: Remove tokens from the URL after reading them
    if (window.location.search || window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const handleConfirmSignIn = async () => {
    setStatus('verifying');
    setStatusMsg('Verifying your sign-in request…');
    setErrorMsg(null);

    try {
      if (!magicToken) {
        throw new Error('Verification link is missing or expired. Please request a new sign-in link.');
      }

      // Security rule 4: POST to consume the token (blocks prefetching crawlers)
      const res = await apiFetch('/api/auth/magic-link/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: magicToken, email: userEmail || undefined })
      });

      const resData = await res.json().catch(() => ({}));

      if (!res.ok) {
        // If cookie is missing or mismatch (different device / browser), show fallback code screen
        if (res.status === 403 || resData.code === 'ERR_DEVICE_MISMATCH' || resData.code === 'ERR_COOKIE_MISSING') {
          setStatus('code-fallback');
          setStatusMsg('For your security on this device, please enter the 6-digit code from your email.');
          return;
        }
        throw new Error(resData.error || 'Sign in link verification failed.');
      }

      if (resData.type === 'recovery' || isRecovery) {
        setStatusMsg('Password reset authorized. Directing to password reset…');
        setStatus('success');
        window.location.hash = `#reset-password?token=${resData.resetToken || magicToken}&email=${encodeURIComponent(resData.email || userEmail || '')}`;
        return;
      }

      // Success
      setStatus('success');
      setStatusMsg('Signed in successfully.');

      if (onSelectRoleLogin && resData.user) {
        onSelectRoleLogin(resData.user.role || 'analyst', {
          token: resData.token,
          userId: resData.user.id,
          email: resData.user.email,
          fullName: resData.user.fullName || resData.user.email.split('@')[0],
          orgName: resData.user.organizationId || 'Acme Cyber Defense SOC',
          accountType: resData.user.accountType || 'organization',
          isEmailVerified: true
        });
      } else if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('[MagicLinkVerify] Verification error:', err);
      setStatus('error');
      setErrorMsg(err.message || 'Verification link is invalid or has expired. Please request a new one.');
    }
  };

  const handleVerifyOtpFallback = async (e: FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    setSubmittingCode(true);
    setErrorMsg(null);

    try {
      const cleanCode = manualCode.trim().replace(/\D/g, '');
      const res = await apiFetch('/api/auth/magic-link/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: magicToken || undefined,
          email: userEmail || undefined,
          code: cleanCode
        })
      });

      const resData = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(resData.error || 'Invalid or expired verification code.');
      }

      if (resData.type === 'recovery' || isRecovery) {
        setStatusMsg('Password reset authorized. Directing to password reset…');
        setStatus('success');
        window.location.hash = `#reset-password?token=${resData.resetToken || magicToken}&code=${cleanCode}&email=${encodeURIComponent(resData.email || userEmail || '')}`;
        return;
      }

      setStatus('success');
      setStatusMsg('Signed in successfully.');

      if (onSelectRoleLogin && resData.user) {
        onSelectRoleLogin(resData.user.role || 'analyst', {
          token: resData.token,
          userId: resData.user.id,
          email: resData.user.email,
          fullName: resData.user.fullName || resData.user.email.split('@')[0],
          orgName: resData.user.organizationId || 'Acme Cyber Defense SOC',
          accountType: resData.user.accountType || 'organization',
          isEmailVerified: true
        });
      } else if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('[MagicLinkVerify] Fallback code error:', err);
      setErrorMsg(err.message || 'Invalid or expired verification code.');
    } finally {
      setSubmittingCode(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ink)] bg-[radial-gradient(ellipse_900px_500px_at_50%_-10%,rgba(178,58,46,0.08),transparent_60%)] p-4 text-[var(--paper)] font-sans select-text relative overflow-y-auto">
      <div className="w-full max-w-[480px] bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-8 relative z-10">
        
        {/* Top bar */}
        <div className="flex items-center justify-between mb-5 border-b border-[var(--line)] pb-3">
          <button
            onClick={onBackToLogin}
            className="text-[var(--paper-dim)] hover:text-[var(--paper)] text-xs flex items-center gap-1.5 transition-colors cursor-pointer bg-transparent border-0 p-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[var(--thread)]" />
            <span>Return to Sign In</span>
          </button>

          <div className="font-mono text-[11px] text-[var(--paper-dim)] flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-[var(--stamp)]" />
            <span>SECURE SIGN IN</span>
          </div>
        </div>

        {/* State: Confirm (Requires explicit click before POST, blocking scanners) */}
        {status === 'confirm' && (
          <div className="py-4 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[rgba(201,162,39,0.12)] border border-[var(--stamp)] text-[var(--stamp)] flex items-center justify-center mx-auto shadow-sm">
              <Mail className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="font-display font-bold text-xl text-[var(--paper)]">
                Confirm Sign In
              </h2>
              <p className="text-xs text-[var(--paper-dim)] leading-relaxed">
                Click below to complete sign-in and open your workspace.
              </p>
              {userEmail && (
                <div className="inline-block px-3 py-1 bg-[var(--ink)] border border-[var(--line)] rounded-xs font-mono text-xs text-[var(--stamp)]">
                  {userEmail}
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-3 rounded-[2px] bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-[var(--rose-300)] text-xs flex items-start gap-2.5 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--thread)]" />
                <div className="leading-relaxed font-sans">{errorMsg}</div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={handleConfirmSignIn}
                className="w-full py-3 px-4 bg-[var(--stamp)] hover:brightness-110 active:brightness-95 text-[var(--ink)] font-bold text-xs uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Confirm Sign In →</span>
              </button>
            </div>
          </div>
        )}

        {/* State: Verifying */}
        {status === 'verifying' && (
          <div className="py-8 text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-[var(--stamp)] animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h2 className="font-display font-bold text-lg text-[var(--paper)]">
                Verifying Sign In
              </h2>
              <p className="text-xs text-[var(--paper-dim)] font-mono">
                {statusMsg}
              </p>
            </div>
          </div>
        )}

        {/* State: Code fallback (when cookie is missing on different device) */}
        {status === 'code-fallback' && (
          <div className="py-4 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-[rgba(201,162,39,0.12)] border border-[var(--stamp)] text-[var(--stamp)] flex items-center justify-center mx-auto mb-1">
                <KeyRound className="w-7 h-7" />
              </div>
              <h2 className="font-display font-bold text-lg text-[var(--paper)]">
                Enter Verification Code
              </h2>
              <p className="text-xs text-[var(--paper-dim)] leading-relaxed">
                You are accessing this link from a different browser or device. Please enter the 6-digit code from your email to complete sign in.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-[2px] bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-[var(--rose-300)] text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--thread)]" />
                <div className="leading-relaxed font-sans">{errorMsg}</div>
              </div>
            )}

            <form onSubmit={handleVerifyOtpFallback} className="space-y-3">
              <div>
                <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1 uppercase tracking-wider" htmlFor="otp-fallback-code">
                  6-Digit Verification Code
                </label>
                <input
                  id="otp-fallback-code"
                  type="text"
                  required
                  maxLength={6}
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  placeholder="123456"
                  className="w-full text-center text-lg tracking-widest font-mono py-2.5 px-3 bg-[var(--ink)] border border-[var(--line)] rounded-xs text-[var(--paper)] focus:outline-none focus:border-[var(--stamp)]"
                />
              </div>

              <button
                type="submit"
                disabled={submittingCode || manualCode.trim().length < 6}
                className="w-full py-2.5 px-4 bg-[var(--stamp)] hover:brightness-110 active:brightness-95 disabled:opacity-50 text-[var(--ink)] font-bold text-xs uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                {submittingCode ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying Code…</span>
                  </>
                ) : (
                  <span>Verify Code & Sign In →</span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* State: Success */}
        {status === 'success' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[rgba(72,169,117,0.15)] border border-[var(--forensic-green)] text-[var(--forensic-green)] flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h2 className="font-display font-bold text-lg text-[var(--paper)]">
                Authentication Confirmed
              </h2>
              <p className="text-xs text-[var(--paper-dim)]">
                {statusMsg}
              </p>
            </div>
          </div>
        )}

        {/* State: Error */}
        {status === 'error' && (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-[var(--rose-300)] flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h2 className="font-display font-bold text-lg text-[var(--paper)]">
                Verification Failed
              </h2>
              <p className="text-xs text-[var(--paper-dim)] leading-relaxed">
                {errorMsg || 'This link is invalid or has expired.'}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={onRequestNewLink ? () => onRequestNewLink(userEmail) : onBackToLogin}
                className="w-full py-2.5 px-4 bg-[var(--stamp)] hover:brightness-110 active:brightness-95 text-[var(--ink)] font-bold text-xs uppercase tracking-wider rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <span>Request New Sign In Link →</span>
              </button>

              <button
                type="button"
                onClick={onBackToLogin}
                className="w-full py-2 px-3 text-xs text-[var(--slate)] hover:text-[var(--paper)] transition-colors cursor-pointer bg-transparent border-0"
              >
                Return to sign in
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
