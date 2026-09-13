import React, { useState, useEffect, FormEvent } from 'react';
import { supabase, isSupabaseConfigured, logSupabaseAuthEvent } from '../lib/supabase';
import { 
  Loader2, 
  AlertCircle, 
  ArrowLeft, 
  CheckCircle2, 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  Sparkles,
  Check,
  X,
  Mail,
  Send,
  HelpCircle
} from 'lucide-react';

interface ResetPasswordViewProps {
  onSuccess: () => void;
  onBackToLogin: () => void;
  onRequestResetLink?: () => void;
  resetToken?: string | null;
  userEmail?: string | null;
  onSelectRoleLogin?: (role: any, options: any) => void;
}

export function ResetPasswordView({ 
  onSuccess, 
  onBackToLogin, 
  onRequestResetLink,
  resetToken: initialResetToken, 
  userEmail: initialUserEmail,
  onSelectRoleLogin
}: ResetPasswordViewProps) {
  const [emailInput, setEmailInput] = useState<string>(() => {
    if (initialUserEmail) return initialUserEmail;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlEmail = params.get('email');
      if (urlEmail) return urlEmail;
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#\/?/, '').replace(/^reset-password\??/, ''));
      const hashEmail = hashParams.get('email');
      if (hashEmail) return hashEmail;
    }
    return '';
  });

  const [currentResetToken, setCurrentResetToken] = useState<string | null>(initialResetToken || null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [recoverySessionDetected, setRecoverySessionDetected] = useState(false);
  const [issuedSession, setIssuedSession] = useState<{ token: string; user: any } | null>(null);
  const [manualTokenMode, setManualTokenMode] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');

  // Check URL parameters and active Supabase recovery session
  useEffect(() => {
    let isMounted = true;

    // 1. Check URL parameters for tokens, code or hashes
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash.replace(/^#\/?/, '').replace(/^reset-password\??/, '');
      const hashParams = new URLSearchParams(hash);
      
      const foundToken = params.get('token') || params.get('resetToken') || hashParams.get('token') || hashParams.get('resetToken');
      if (foundToken && isMounted) {
        setCurrentResetToken(foundToken);
      }

      const foundEmail = params.get('email') || hashParams.get('email');
      if (foundEmail && isMounted && !emailInput) {
        setEmailInput(foundEmail);
      }

      // If PKCE query code is present, exchange for session
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
    setErrorMsg(null);

    const targetEmail = emailInput.trim();
    if (!targetEmail) {
      setErrorMsg('Please enter your account email address.');
      return;
    }

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

    try {
      let supabaseUpdated = false;
      let sessionToken: string | null = null;

      // 1. Attempt Supabase password update if Supabase is active
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
            } else {
              logSupabaseAuthEvent('UpdatePassword:Note', sbError.message, 'warn');
              if (sbError.message.includes('Auth session missing')) {
                // Session is not set in Supabase client
              }
            }
          }
        } catch (sbErr) {
          console.warn('[ResetPasswordView] Supabase session check note:', sbErr);
        }
      }

      // 2. Synchronize password with server endpoint
      const activeToken = currentResetToken || manualTokenInput.trim() || undefined;
      const res = await fetch('/api/auth/reset-password-with-otp', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {})
        },
        body: JSON.stringify({
          email: targetEmail,
          resetToken: activeToken,
          newPassword
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (!supabaseUpdated) {
          if (data.code === 'INVALID_RESET_AUTHORIZATION') {
            setErrorMsg('Your password reset link is invalid or has expired. Please request a new recovery link sent to your email.');
          } else {
            setErrorMsg(data.error || 'Failed to update master password. Please verify your email or request a new reset link.');
          }
          setLoading(false);
          return;
        }
      }

      // Cache issued session if provided
      if (data.token && data.user) {
        setIssuedSession({ token: data.token, user: data.user });
        try {
          localStorage.setItem('tracexmail_enclave_session', JSON.stringify({
            token: data.token,
            user: data.user,
            profile: {
              id: data.user.id,
              organization_id: data.user.organizationId || 'org_acme_soc_01',
              role: data.user.role || 'analyst',
              full_name: data.user.fullName || targetEmail.split('@')[0],
              email: targetEmail,
              account_type: 'organization',
              email_verified: true,
              created_at: new Date().toISOString()
            }
          }));
        } catch (e) {
          console.warn('[ResetPasswordView] Session caching notice:', e);
        }
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('[ResetPasswordView] Password update error:', err);
      const msg = err.message || '';
      if (msg.includes('Auth session missing')) {
        setErrorMsg('Recovery session missing or expired. Please click the reset link in your email, or request a new recovery email.');
      } else {
        setErrorMsg(err.message || 'An unexpected error occurred while resetting your master password.');
      }
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
              Password Successfully Updated
            </h2>
            <p className="text-xs sm:text-sm text-[var(--paper-dim)] leading-relaxed">
              Your master cryptographic password has been securely updated for <span className="font-mono text-[var(--stamp)] font-semibold">{emailInput}</span>.
            </p>
          </div>

          <div className="p-3 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-xs font-mono text-[var(--paper-dim)] flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--forensic-green)]" />
            <span>ENCLAVE CREDENTIALS SYNCHRONIZED</span>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={handleProceed}
              className="w-full py-3 px-4 bg-[var(--stamp)] text-[var(--ink)] font-bold text-xs tracking-wider uppercase rounded-sm hover:brightness-110 active:brightness-95 cursor-pointer shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              <span>Proceed to Workspace →</span>
            </button>

            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full py-2.5 px-4 bg-transparent border border-[var(--line)] text-[var(--paper-dim)] hover:text-[var(--paper)] hover:border-[var(--stamp)] font-mono text-xs uppercase tracking-wider rounded-sm cursor-pointer transition-colors"
            >
              Sign In to Enclave
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isAuthorizedToReset = recoverySessionDetected || currentResetToken || manualTokenInput.trim().length > 0;

  // 2. Recovery Link Required state (when accessed without email link tokens)
  if (!isAuthorizedToReset && !manualTokenMode) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ink)] bg-[radial-gradient(ellipse_900px_500px_at_50%_-10%,rgba(178,58,46,0.08),transparent_60%)] p-4 text-[var(--paper)] font-sans select-text relative overflow-y-auto">
        <div className="w-full max-w-[460px] bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-8 relative z-10">
          
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 mb-5">
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-[var(--paper-dim)] hover:text-[var(--paper)] text-xs flex items-center gap-1.5 transition-colors cursor-pointer bg-transparent border-0 p-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[var(--thread)]" />
              <span>Back to Sign In</span>
            </button>

            <div className="font-mono text-[10.5px] text-[var(--stamp)] uppercase tracking-wider flex items-center gap-1">
              <Lock className="w-3 h-3 text-[var(--stamp)]" />
              <span>LINK VERIFICATION REQUIRED</span>
            </div>
          </div>

          <div className="text-center space-y-3 mb-6">
            <div className="w-14 h-14 rounded-full bg-[rgba(201,162,39,0.12)] border border-[var(--stamp)] text-[var(--stamp)] flex items-center justify-center mx-auto mb-2">
              <Mail className="w-7 h-7" />
            </div>

            <h2 className="font-display font-bold text-xl text-[var(--paper)]">
              Password Reset Link Required
            </h2>

            <p className="text-xs text-[var(--paper-dim)] leading-relaxed">
              To change your master password, please click the secure recovery link sent to your work email. TraceXMail strictly verifies ownership through single-use email links.
            </p>
          </div>

          <div className="p-3.5 rounded-[2px] bg-[var(--ink)] border border-[var(--line)] text-xs font-sans space-y-2 mb-6">
            <div className="font-semibold text-[var(--paper)] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[var(--forensic-green)]" />
              <span>Security Protocol</span>
            </div>
            <p className="text-[var(--paper-dim)] leading-relaxed text-[11.5px]">
              If you already requested a password reset, open your email client and click the reset button. The link will automatically authorize this session.
            </p>
          </div>

          <div className="space-y-2.5">
            {onRequestResetLink ? (
              <button
                type="button"
                onClick={onRequestResetLink}
                className="w-full py-2.5 px-4 bg-[var(--stamp)] text-[var(--ink)] font-bold text-xs tracking-wider uppercase rounded-sm hover:brightness-110 active:brightness-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Request Recovery Email Link →</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onBackToLogin}
                className="w-full py-2.5 px-4 bg-[var(--stamp)] text-[var(--ink)] font-bold text-xs tracking-wider uppercase rounded-sm hover:brightness-110 active:brightness-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <span>Go to Password Recovery Form →</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setManualTokenMode(true)}
              className="w-full py-2 px-3 text-xs text-[var(--paper-dim)] hover:text-[var(--paper)] flex items-center justify-center gap-1.5 cursor-pointer bg-transparent border-0 font-mono"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[var(--slate)]" />
              <span>Have a recovery token? Enter manually</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Main New Password Form
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
            <span>
              {recoverySessionDetected
                ? 'EMAIL LINK VERIFIED'
                : currentResetToken
                ? 'TOKEN VERIFIED'
                : 'RECOVERY CLEARANCE'}
            </span>
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
            Establish your new cryptographic master password.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-[2px] bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-[var(--rose-300)] text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--thread)]" />
            <div className="leading-relaxed font-sans">{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Account Email Input */}
          <div>
            <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1.5 uppercase tracking-wider">
              Work / Account Email *
            </label>
            <input
              type="email"
              required
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              placeholder="analyst@acmedefense.sec"
              className="w-full text-xs font-mono py-2.5 px-3 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] focus:outline-none focus:border-[var(--stamp)] focus:ring-1 focus:ring-[var(--stamp)] transition-all"
            />
          </div>

          {/* Manual Token Input if toggled */}
          {manualTokenMode && !currentResetToken && (
            <div>
              <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1.5 uppercase tracking-wider">
                Recovery Token
              </label>
              <input
                type="text"
                value={manualTokenInput}
                onChange={e => setManualTokenInput(e.target.value)}
                placeholder="Paste token from email link"
                className="w-full text-xs font-mono py-2 px-3 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] focus:outline-none focus:border-[var(--stamp)]"
              />
            </div>
          )}

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
            disabled={loading || !hasMinLength || !passwordsMatch || !emailInput}
            className="w-full mt-2 py-2.5 px-4 bg-[var(--stamp)] text-[var(--ink)] font-bold text-xs tracking-wider uppercase rounded-sm hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Updating Master Password…</span>
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
