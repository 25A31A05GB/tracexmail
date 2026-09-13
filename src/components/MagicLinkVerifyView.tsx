import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft, Mail, ShieldCheck, RefreshCw, Lock } from 'lucide-react';
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
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [statusMsg, setStatusMsg] = useState('Verifying secure magic link…');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function processMagicLink() {
      try {
        // 1. Extract params from both query string and hash
        const searchParams = new URLSearchParams(window.location.search);
        
        // Parse hash params if hash contains query format like #magic-link?token=... or #access_token=...
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
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const typeParam = searchParams.get('type') || hashParams.get('type');

        if (emailParam) {
          setUserEmail(emailParam);
        }

        // Case A: Supabase PKCE authorization code
        if (code && isSupabaseConfigured && supabase) {
          setStatusMsg('Exchanging cryptographic verification token…');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.warn('[MagicLink] Supabase code exchange warning:', error.message);
          } else if (data.session && isMounted) {
            handleSessionSuccess(data.session.user);
            return;
          }
        }

        // Case B: Supabase access token in hash
        if (accessToken && isSupabaseConfigured && supabase) {
          setStatusMsg('Validating cryptographic credentials…');
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ''
          });
          if (!error && data.session && isMounted) {
            handleSessionSuccess(data.session.user);
            return;
          }
        }

        // Case C: Native Enclave / Server-side magic link token
        if (token) {
          setStatusMsg('Validating single-use cryptographic enclave link…');
          const res = await fetch('/api/auth/magic-link/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, email: emailParam })
          });

          const resData = await res.json();

          if (!res.ok) {
            throw new Error(resData.error || 'Magic link verification failed.');
          }

          if (isMounted) {
            if (resData.type === 'recovery') {
              setStatusMsg('Recovery clearance verified. Directing to Master Password reset…');
              setStatus('success');
              setTimeout(() => {
                window.location.hash = `#reset-password?token=${resData.resetToken || token}&email=${encodeURIComponent(resData.email || emailParam || '')}`;
              }, 1200);
              return;
            }

            // Normal sign-in or sign-up verification
            setStatus('success');
            setStatusMsg('Identity authenticated. Unlocking security enclave…');

            setTimeout(() => {
              if (onSelectRoleLogin && resData.user) {
                onSelectRoleLogin(resData.user.role || 'analyst', {
                  token: resData.token,
                  userId: resData.user.id,
                  email: resData.user.email,
                  fullName: resData.user.fullName,
                  orgName: resData.user.organizationId || 'Acme Cyber Defense SOC',
                  accountType: resData.user.accountType || 'organization',
                  isEmailVerified: true
                });
              } else if (onSuccess) {
                onSuccess();
              }
            }, 1400);
            return;
          }
        }

        // Case D: Active Supabase session already established in browser
        if (isSupabaseConfigured && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && isMounted) {
            handleSessionSuccess(session.user);
            return;
          }
        }

        // If neither token nor session found
        if (isMounted) {
          setStatus('error');
          setErrorMsg('No valid verification token found. The link may be incomplete or invalid.');
        }
      } catch (err: any) {
        console.error('[MagicLink] Verification exception:', err);
        if (isMounted) {
          setStatus('error');
          setErrorMsg(err.message || 'The magic verification link has expired or has already been used.');
        }
      }
    }

    processMagicLink();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSessionSuccess = (user: any) => {
    setStatus('success');
    setStatusMsg('Identity authenticated. Launching forensic workspace…');
    setTimeout(() => {
      if (onSelectRoleLogin) {
        onSelectRoleLogin((user.user_metadata?.role as UserRole) || 'analyst', {
          token: `sb_${user.id}`,
          userId: user.id,
          email: user.email || '',
          fullName: user.user_metadata?.full_name || user.email?.split('@')[0],
          orgName: user.user_metadata?.org_name || 'Acme Cyber Defense SOC',
          accountType: (user.user_metadata?.account_type as AccountType) || 'organization',
          isEmailVerified: true
        });
      } else if (onSuccess) {
        onSuccess();
      }
    }, 1200);
  };

  const handleResendLink = async () => {
    if (!userEmail) {
      if (onRequestNewLink) {
        onRequestNewLink();
      } else {
        onBackToLogin();
      }
      return;
    }

    setResending(true);
    setResendStatus(null);
    try {
      const res = await fetch('/api/auth/magic-link/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail.trim(),
          type: 'signin',
          redirectTo: window.location.origin
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch new magic link.');

      setResendStatus(`Fresh magic link dispatched to ${userEmail.trim()}. Please check your inbox.`);
    } catch (err: any) {
      setResendStatus(err.message || 'Error requesting new magic link.');
    } finally {
      setResending(false);
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
            <Lock className="w-3 h-3 text-[var(--forensic-green)]" />
            <span>Enclave Verification</span>
          </div>
        </div>

        {/* State: Verifying */}
        {status === 'verifying' && (
          <div className="py-8 text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-[var(--line)]" />
              <div className="absolute inset-0 rounded-full border-2 border-t-[var(--stamp)] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              <ShieldCheck className="w-7 h-7 text-[var(--stamp)]" />
            </div>

            <div className="space-y-1.5">
              <h2 className="font-display font-bold text-lg text-[var(--paper)]">
                Authenticating Magic Link
              </h2>
              <p className="text-xs text-[var(--paper-dim)] font-mono">
                {statusMsg}
              </p>
            </div>

            <div className="p-3 rounded-[2px] bg-[var(--ink)] border border-[var(--line)] text-left text-[11.5px] text-[var(--paper-muted)] font-mono space-y-1">
              <div className="flex items-center gap-1.5 text-[var(--paper-dim)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--forensic-green)] animate-pulse" />
                <span>Zero-Password Cryptographic Verification</span>
              </div>
              <p className="text-[10.5px] text-[var(--paper-muted)] leading-relaxed">
                Single-use nonce validation in progress against the TraceXMail security enclave.
              </p>
            </div>
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
                Access Clearance Confirmed
              </h2>
              <p className="text-xs text-[var(--forensic-green)] font-mono">
                {statusMsg}
              </p>
            </div>

            <div className="p-3 rounded-[2px] bg-[rgba(72,169,117,0.08)] border border-[var(--forensic-green)] text-xs text-[var(--paper)] font-mono flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--forensic-green)]" />
              <span>Redirecting to Security Operations Center…</span>
            </div>
          </div>
        )}

        {/* State: Error */}
        {status === 'error' && (
          <div className="py-4 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-[var(--thread)] flex items-center justify-center mx-auto mb-1">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h2 className="font-display font-bold text-lg text-[var(--paper)]">
                Magic Link Invalid or Expired
              </h2>
              <p className="text-xs text-[var(--paper-dim)] leading-relaxed">
                {errorMsg || 'This magic link has expired or has already been used for security.'}
              </p>
            </div>

            <div className="p-3 rounded-[2px] bg-[rgba(178,58,46,0.08)] border border-[var(--thread)] text-xs text-[var(--paper)] font-sans leading-relaxed">
              Magic links are single-use tokens valid for 15 minutes to protect your account. You can easily request a fresh magic link to be sent to your email.
            </div>

            {resendStatus && (
              <div className="p-3 rounded-[2px] bg-[rgba(72,169,117,0.12)] border border-[var(--forensic-green)] text-xs text-[var(--paper)] font-mono flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[var(--forensic-green)] shrink-0" />
                <span>{resendStatus}</span>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              {userEmail ? (
                <button
                  type="button"
                  onClick={handleResendLink}
                  disabled={resending}
                  className="w-full py-2.5 px-4 bg-[var(--ink)] border border-[var(--stamp)] text-[var(--stamp)] hover:bg-[var(--ink-3)] font-semibold text-xs rounded-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                  <span>{resending ? 'Sending Link…' : `Request Fresh Magic Link for ${userEmail}`}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="w-full py-2.5 px-4 bg-[var(--stamp)] text-[var(--ink)] font-semibold text-xs rounded-sm hover:opacity-95 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  <span>Request Magic Link from Sign In</span>
                </button>
              )}

              <button
                type="button"
                onClick={onBackToLogin}
                className="w-full py-2 px-3 text-xs text-[var(--paper-dim)] hover:text-[var(--paper)] flex items-center justify-center gap-1.5 cursor-pointer bg-transparent border-0"
              >
                <span>Sign In with Password Instead →</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
