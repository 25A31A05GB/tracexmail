import React, { useState, FormEvent } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { GoogleAuthButton } from './GoogleAuthButton';
import { Loader2, AlertCircle, ArrowLeft, Lock, MailCheck, Send } from 'lucide-react';
import { UserRole, AccountType } from '../hooks/useSession';

interface LoginViewProps {
  onBackToGate?: () => void;
  onBackToIntro?: () => void;
  onRequestAccess?: () => void;
  onForgotPassword?: () => void;
  onSuccess?: () => void;
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

  const handleBack = onBackToIntro || onBackToGate;

  const handleResendVerification = async () => {
    if (!email) return;
    setResending(true);
    setResendStatus(null);
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: email.trim(),
          options: {
            emailRedirectTo: window.location.origin
          }
        });
        if (error) {
          setResendStatus('Failed to resend: ' + error.message);
        } else {
          setResendStatus('Verification link dispatched to ' + email.trim() + '. Please check your inbox.');
        }
      } else {
        await fetch('/api/auth/resend-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), redirectTo: window.location.origin })
        });
        setResendStatus('Verification link dispatched to ' + email.trim() + '. Please check your inbox.');
      }
    } catch (err: any) {
      setResendStatus(err.message || 'Error sending verification link.');
    } finally {
      setResending(false);
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

      // Strict check on server response
      if (!resData.token || !resData.user?.id) {
        setErrorMsg('Authentication Error: Server failed to issue a valid authentication session.');
        setLoading(false);
        return;
      }

      if (!resData.user.emailVerified) {
        setVerificationPending(true);
        setErrorMsg('Strict Access Control: Email verification is required before access is unlocked. Please click the confirmation link sent to your email.');
        setLoading(false);
        return;
      }

      if (onSelectRoleLogin) {
        onSelectRoleLogin(resData.user.role || 'analyst', {
          token: resData.token,
          userId: resData.user.id,
          email: resData.user.email,
          fullName: resData.user.fullName || resData.user.email.split('@')[0],
          orgName: resData.user.organizationId || 'Acme Cyber Defense SOC',
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

          <div className="font-mono text-[11px] text-[var(--paper-dim)] flex items-center gap-1.5 ml-auto">
            <Lock className="w-3 h-3 text-[var(--forensic-green)]" />
            <span>Secure Sign In</span>
          </div>
        </div>

        {/* Brand Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-5 h-5 rounded-full border-[1.5px] border-[var(--thread)] relative shrink-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[var(--thread)]" />
          </div>
          <span className="font-display font-bold text-xl text-[var(--paper)] tracking-tight">
            Sign In to TraceXMail
          </span>
        </div>

        <div className="text-[var(--paper-dim)] text-[13.5px] mb-5">
          Access email threat analysis, route tracing, and investigation reports.
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
          <span className="font-sans text-[11px] text-[var(--paper-muted)] font-medium">enter your account credentials</span>
          <div className="flex-1 h-px bg-[var(--line)]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1.5 uppercase tracking-wider">
              Work Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="analyst@enterprise.corp"
              className="w-full text-xs font-mono py-2.5 px-3 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] placeholder:text-[var(--paper-dim)]/40 focus:outline-none focus:border-[var(--stamp)] focus:ring-1 focus:ring-[var(--stamp)] transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono font-medium text-[var(--paper-dim)] uppercase tracking-wider">
                Password
              </label>
              {onForgotPassword && (
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-[11px] text-[var(--slate)] hover:text-[var(--paper)] hover:underline cursor-pointer transition-colors bg-transparent border-0 p-0"
                >
                  Forgot Password?
                </button>
              )}
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full text-xs font-mono py-2.5 px-3 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] placeholder:text-[var(--paper-dim)]/40 focus:outline-none focus:border-[var(--stamp)] focus:ring-1 focus:ring-[var(--stamp)] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-[var(--thread)] text-[var(--paper)] font-semibold text-xs tracking-wider uppercase rounded-sm hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Authenticating…</span>
              </>
            ) : (
              <span>Sign In to Workspace</span>
            )}
          </button>
        </form>

        {/* Footer links */}
        <div className="mt-5 pt-4 border-t border-[var(--line)] flex items-center justify-between text-xs text-[var(--paper-dim)]">
          <span>Need an account?</span>
          {onRequestAccess ? (
            <button
              onClick={onRequestAccess}
              className="text-[var(--slate)] hover:text-[var(--paper)] font-medium hover:underline cursor-pointer transition-colors bg-transparent border-0 p-0"
            >
              Register for Access →
            </button>
          ) : (
            <span className="font-mono text-[11px] text-[var(--paper-muted)]">Contact Administrator</span>
          )}
        </div>
      </div>
    </div>
  );
}
