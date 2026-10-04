import React, { useState, FormEvent } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { GoogleAuthButton } from './GoogleAuthButton';
import { TurnstileWidget } from './TurnstileWidget';
import { Loader2, AlertCircle, ArrowLeft, CheckCircle2, Shield, Eye, EyeOff, User, Building2, MailCheck, Send, RefreshCw, Mail, ShieldCheck } from 'lucide-react';
import { UserRole, AccountType } from '../hooks/useSession';

interface SignupViewProps {
  onBackToLogin: () => void;
  onBackToIntro?: () => void;
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

export function SignupView({ 
  onBackToLogin, 
  onBackToIntro,
  onSuccess,
  onSelectRoleLogin 
}: SignupViewProps) {
  const [step, setStep] = useState<'form' | 'verification-sent'>('form');
  const [accountType, setAccountType] = useState<AccountType>('personal');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('analyst');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userExistsError, setUserExistsError] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [directVerifyUrl, setDirectVerifyUrl] = useState<string | null>(null);

  const handleBack = onBackToIntro || onBackToLogin;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter your email and password.');
      return;
    }

    if (accountType === 'organization' && !orgName) {
      setErrorMsg('Please provide your organization name for Enterprise access.');
      return;
    }

    if (password.length < 12) {
      setErrorMsg('Security Policy: Password must be at least 12 characters in length.');
      return;
    }

    if (!agreedToTerms) {
      setErrorMsg('Mandatory: You must accept the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setUserExistsError(false);
    setSuccessMsg(null);
    setResendStatus(null);

    const cleanEmail = email.trim().toLowerCase();
    const assignedOrg = accountType === 'organization' ? (orgName.trim() || 'Acme Cyber Defense SOC') : 'Personal Sandbox';
    const assignedRole = accountType === 'organization' ? (selectedRole || 'admin') : 'analyst';
    const effectiveName = fullName.trim() || cleanEmail.split('@')[0];

    try {
      // 0. Pre-check if email already exists
      try {
        const checkRes = await apiFetch(`/api/auth/check-exists?email=${encodeURIComponent(cleanEmail)}`);
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.exists) {
            setUserExistsError(true);
            setErrorMsg(`An account with email address '${cleanEmail}' already exists. Please log in instead.`);
            setLoading(false);
            return;
          }
        }
      } catch (checkErr) {
        console.warn('[SignupView] Check-exists preflight notice:', checkErr);
      }

      const redirectUrl = window.location.origin;

      // 1. Register with Supabase if configured
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: effectiveName,
              org_name: assignedOrg,
              role: assignedRole,
              account_type: accountType
            }
          }
        });

        if (error) {
          const errMsg = error.message.toLowerCase();
          if (errMsg.includes('pwned') || errMsg.includes('compromised') || errMsg.includes('breach') || errMsg.includes('leaked')) {
            setErrorMsg('Security Warning: This password has appeared in a known public data breach. Please choose a different, unique passphrase.');
            setLoading(false);
            return;
          }
          if (errMsg.includes('already registered') || errMsg.includes('already exists') || errMsg.includes('user already in use')) {
            setUserExistsError(true);
            setErrorMsg(`An account with email address '${cleanEmail}' already exists. Please log in instead.`);
            setLoading(false);
            return;
          }
          console.warn('[SignupView] Supabase signUp notice:', error.message);
        } else {
          // If Supabase auto-confirmed session
          if (data.session && data.user?.email_confirmed_at) {
            if (onSelectRoleLogin) {
              onSelectRoleLogin(assignedRole, {
                token: data.session.access_token,
                userId: data.user.id,
                email: cleanEmail,
                fullName: effectiveName,
                orgName: assignedOrg,
                accountType,
                isEmailVerified: true
              });
              return;
            } else if (onSuccess) {
              onSuccess();
              return;
            }
          }
        }
      }

      // 2. Also register in local/enclave backend with Turnstile verification
      try {
        const regRes = await apiFetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password,
            fullName: effectiveName,
            orgName: assignedOrg,
            role: assignedRole,
            accountType,
            turnstileToken
          })
        });

        const regData = await regRes.json().catch(() => ({}));
        if (regRes.status === 409 || regData?.user_exists || regData?.code === 'USER_ALREADY_EXISTS') {
          setUserExistsError(true);
          setErrorMsg(`An account registered to '${cleanEmail}' already exists. Please log in instead.`);
          setLoading(false);
          return;
        } else if (!regRes.ok && regData?.error) {
          setErrorMsg(regData.error);
          setLoading(false);
          return;
        }
      } catch (srvErr) {
        console.warn('[SignupView] Backend registration notice:', srvErr);
      }

      // 3. Reliable server-side magic link dispatch (authoritative)
      const mlRes = await apiFetch('/api/auth/magic-link/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          type: 'signup',
          payload: {
            fullName: effectiveName,
            orgName: assignedOrg,
            role: assignedRole,
            accountType,
            password
          },
          redirectTo: window.location.origin,
          turnstileToken
        })
      });

      const mlData = await mlRes.json();
      if (!mlRes.ok) {
        throw new Error(mlData.error || 'Failed to dispatch verification email.');
      }

      if (mlData.magicLinkUrl || mlData.debugLink) {
        setDirectVerifyUrl(mlData.magicLinkUrl || mlData.debugLink);
      }

      // Transition to email verification link confirmation
      setStep('verification-sent');
    } catch (err: any) {
      console.error('[SignupView] Registration error:', err);
      setErrorMsg(err.message || 'An error occurred during registration. Please verify your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) return;
    setResending(true);
    setResendStatus(null);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const redirectUrl = window.location.origin;

      // 1. Supabase best-effort secondary attempts (safely wrapped)
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: {
            emailRedirectTo: redirectUrl
          }
        }).catch(err => console.warn('[SignupView] Supabase magic link resend notice:', err?.message));
        
        await supabase.auth.resend({
          type: 'signup',
          email: cleanEmail,
          options: {
            emailRedirectTo: redirectUrl
          }
        }).catch(err => console.warn('[SignupView] Resend error:', err?.message));
      }

      // 2. Authoritative reliable server dispatch
      const res = await apiFetch('/api/auth/magic-link/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          type: 'signup',
          redirectTo: redirectUrl,
          turnstileToken
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend verification email.');
      }

      setResendStatus(`Fresh verification magic link dispatched to ${cleanEmail}.`);
    } catch (err: any) {
      setResendStatus(err.message || 'Error resending verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ink)] bg-[radial-gradient(ellipse_900px_500px_at_50%_-10%,rgba(178,58,46,0.08),transparent_60%)] p-4 text-[var(--paper)] font-sans select-text relative overflow-y-auto">
      <div className="w-full max-w-[490px] bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-8 relative z-10">
        
        {step === 'verification-sent' ? (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-[rgba(72,169,117,0.15)] border border-[var(--forensic-green)] text-[var(--forensic-green)] flex items-center justify-center mx-auto mb-2 shadow-sm">
                <Mail className="w-7 h-7" />
              </div>
              <h2 className="font-display font-bold text-xl text-[var(--paper)]">
                Verify Your Email Address
              </h2>
              <p className="text-xs text-[var(--paper-dim)] leading-relaxed">
                We sent a secure verification link to <span className="font-mono text-[var(--stamp)] font-semibold">{email.trim()}</span>.
              </p>
            </div>

            <div className="p-3.5 rounded-[2px] bg-[var(--ink)] border border-[var(--line)] text-xs font-sans space-y-2.5">
              <div className="font-semibold text-[var(--paper)] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[var(--forensic-green)] shrink-0" />
                <span>One Click to Activate:</span>
              </div>
              <p className="text-[var(--paper-dim)] leading-relaxed text-[11.5px]">
                Click the confirmation link inside the email to verify your email and unlock full access to your TraceXMail forensic workspace.
              </p>
            </div>

            {resendStatus && (
              <div className="p-3 rounded-[2px] bg-[rgba(72,169,117,0.12)] border border-[var(--forensic-green)] text-[var(--paper)] text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[var(--forensic-green)]" />
                <div className="leading-relaxed font-sans">{resendStatus}</div>
              </div>
            )}

            {directVerifyUrl && (
              <a
                href={directVerifyUrl}
                className="w-full py-2.5 px-4 bg-[var(--stamp)] hover:brightness-110 active:brightness-95 text-[var(--ink)] font-bold text-xs rounded-sm transition-all flex items-center justify-center gap-2 text-center no-underline cursor-pointer shadow-md"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Activate & Access Forensic Workspace Now →</span>
              </a>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending}
                className="w-full py-2.5 px-4 bg-[var(--ink-2)] border border-[var(--line)] hover:border-[var(--paper-dim)] text-[var(--paper)] font-semibold text-xs rounded-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[var(--slate)] ${resending ? 'animate-spin' : ''}`} />
                <span>{resending ? 'Resending Link…' : 'Resend Verification Email'}</span>
              </button>

              <button
                type="button"
                onClick={onBackToLogin}
                className="w-full py-2 px-3 text-xs text-[var(--stamp)] hover:underline flex items-center justify-center gap-1.5 cursor-pointer bg-transparent border-0"
              >
                <span>Return to Sign In →</span>
              </button>
            </div>

            <div className="pt-2 text-center text-[10.5px] text-[var(--paper-muted)] font-mono">
              Didn't see it? Please check your Spam or Promotions folder.
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4 border-b border-[var(--line)] pb-3">
              {handleBack && (
                <button
                  onClick={handleBack}
                  className="text-[var(--paper-dim)] hover:text-[var(--paper)] text-xs flex items-center gap-1.5 transition-colors cursor-pointer bg-transparent border-0 p-0"
                  title="Return to Home"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-[var(--thread)]" />
                  <span>Back to Home</span>
                </button>
              )}

              <button
                onClick={onBackToLogin}
                className="text-xs text-[var(--slate)] hover:text-[var(--paper)] hover:underline cursor-pointer transition-colors bg-transparent border-0 p-0"
              >
                Have an account? Sign in →
              </button>
            </div>

            {/* Brand Header */}
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-5 h-5 rounded-full border-[1.5px] border-[var(--thread)] relative shrink-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[var(--thread)]" />
              </div>
              <span className="font-display font-bold text-xl text-[var(--paper)] tracking-tight">
                Create Your Account
              </span>
            </div>

            <div className="text-[var(--paper-dim)] text-[13.5px] mb-4">
              Start analyzing email security, verifying sender authenticity, and uncovering threats.
            </div>

            {userExistsError && (
              <div className="mb-4 p-4 rounded bg-[#1f1911] border border-amber-500/60 text-amber-200 text-xs space-y-3 shadow-md animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-amber-300 text-sm">Account Already Exists</div>
                    <p className="text-[#dcd1be] font-sans text-xs leading-relaxed">
                      An account registered to <span className="font-mono text-amber-300 font-semibold">{email}</span> already exists in our system. You do not need to register again.
                    </p>
                  </div>
                </div>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={onBackToLogin}
                    className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span>Proceed to Sign In →</span>
                  </button>
                </div>
              </div>
            )}

            {!userExistsError && errorMsg && (
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

            {/* Supabase Google OAuth Action */}
            <div className="mb-3.5">
              <GoogleAuthButton
                id="google-signup-btn"
                mode="signup"
                variant="primary"
                onSuccess={() => {
                  if (onSuccess) onSuccess();
                }}
                onError={(err) => setErrorMsg(err)}
              />
              <p className="text-[10.5px] text-[var(--paper-muted)] mt-1.5 text-center leading-relaxed font-sans">
                If Google shows <span className="text-[var(--paper)] font-medium">"Google hasn't verified this app"</span>: click <strong className="text-[var(--gold)]">Advanced</strong> &rarr; <strong className="text-[var(--gold)]">Go to TraceXMail</strong>.
              </p>
            </div>

            <div className="flex items-center gap-3 my-3 text-xs text-[var(--line)]">
              <div className="flex-1 h-px bg-[var(--line)]" />
              <span className="font-sans text-[11px] text-[var(--paper-muted)] font-medium">or register with work credentials</span>
              <div className="flex-1 h-px bg-[var(--line)]" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Account Mode Selector */}
              <div>
                <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1.5 uppercase tracking-wider">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccountType('personal')}
                    className={`p-2.5 rounded-[2px] border text-left transition-all cursor-pointer ${
                      accountType === 'personal'
                        ? 'border-[var(--stamp)] bg-[rgba(201,162,39,0.12)] text-[var(--paper)]'
                        : 'border-[var(--line)] bg-[var(--ink)] text-[var(--paper-dim)] hover:border-[var(--paper-dim)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs mb-0.5">
                      <User className="w-3.5 h-3.5 text-[var(--stamp)]" />
                      <span>Personal</span>
                    </div>
                    <div className="text-[10px] opacity-80">Sandbox analyst account</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccountType('organization')}
                    className={`p-2.5 rounded-[2px] border text-left transition-all cursor-pointer ${
                      accountType === 'organization'
                        ? 'border-[var(--stamp)] bg-[rgba(201,162,39,0.12)] text-[var(--paper)]'
                        : 'border-[var(--line)] bg-[var(--ink)] text-[var(--paper-dim)] hover:border-[var(--paper-dim)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs mb-0.5">
                      <Building2 className="w-3.5 h-3.5 text-[var(--stamp)]" />
                      <span>Organization</span>
                    </div>
                    <div className="text-[10px] opacity-80">Enterprise SOC team</div>
                  </button>
                </div>
              </div>

              {accountType === 'organization' && (
                <div className="p-3 bg-[var(--ink)] border border-[var(--line)] rounded-[2px] space-y-3">
                  <div>
                    <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1 uppercase tracking-wider">
                      Organization / Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Acme Cyber Defense Corp"
                      className="w-full text-xs font-mono py-2 px-3 bg-[var(--ink-2)] border border-[var(--line)] rounded-sm text-[var(--paper)] placeholder:text-[var(--paper-dim)]/40 focus:outline-none focus:border-[var(--stamp)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1 uppercase tracking-wider">
                      Your SOC Role
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedRole('admin')}
                        className={`p-1.5 text-center text-xs font-mono rounded-[2px] border cursor-pointer ${
                          selectedRole === 'admin'
                            ? 'border-[var(--stamp)] bg-[rgba(201,162,39,0.2)] text-[var(--stamp)] font-bold'
                            : 'border-[var(--line)] text-[var(--paper-dim)] hover:text-[var(--paper)]'
                        }`}
                      >
                        Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRole('analyst')}
                        className={`p-1.5 text-center text-xs font-mono rounded-[2px] border cursor-pointer ${
                          selectedRole === 'analyst'
                            ? 'border-[var(--slate)] bg-[rgba(127,163,186,0.2)] text-[var(--slate)] font-bold'
                            : 'border-[var(--line)] text-[var(--paper-dim)] hover:text-[var(--paper)]'
                        }`}
                      >
                        Analyst
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRole('read_only')}
                        className={`p-1.5 text-center text-xs font-mono rounded-[2px] border cursor-pointer ${
                          selectedRole === 'read_only'
                            ? 'border-[var(--paper-dim)] bg-[rgba(237,230,216,0.1)] text-[var(--paper)] font-bold'
                            : 'border-[var(--line)] text-[var(--paper-dim)] hover:text-[var(--paper)]'
                        }`}
                      >
                        Auditor
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Sarah Chen"
                  className="w-full text-xs font-mono py-2 px-3 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] placeholder:text-[var(--paper-dim)]/40 focus:outline-none focus:border-[var(--stamp)]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-[var(--paper-dim)] mb-1 uppercase tracking-wider">
                  Work Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="s.chen@enterprise.corp"
                  className="w-full text-xs font-mono py-2 px-3 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] placeholder:text-[var(--paper-dim)]/40 focus:outline-none focus:border-[var(--stamp)]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-mono font-medium text-[var(--paper-dim)] uppercase tracking-wider">
                    Master Password *
                  </label>
                  <span className="text-[10px] font-mono text-[var(--paper-dim)]">Min 12 characters</span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={12}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full text-xs font-mono py-2 px-3 pr-10 bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] placeholder:text-[var(--paper-dim)]/40 focus:outline-none focus:border-[var(--stamp)]"
                    aria-label="Master Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--paper-dim)] hover:text-[var(--paper)] focus:outline-none focus:ring-1 focus:ring-[var(--stamp)] rounded-xs bg-transparent border-0 cursor-pointer flex items-center justify-center transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-[var(--paper-dim)]" />
                    ) : (
                      <Eye className="w-4 h-4 text-[var(--paper-dim)]" />
                    )}
                  </button>
                </div>
              </div>

              {/* Explicit Mandatory Terms & Conditions Acceptance Checkbox */}
              <div className="p-3 rounded bg-[var(--ink)] border border-[var(--line)] space-y-2 mt-1">
                <label className="flex items-start gap-2.5 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    required
                    checked={agreedToTerms}
                    onChange={(e) => {
                      setAgreedToTerms(e.target.checked);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    className="mt-0.5 w-4 h-4 rounded-xs border-[var(--line)] bg-[#0d0b09] text-amber-500 focus:ring-1 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer shrink-0 accent-amber-500"
                  />
                  <div className="text-xs text-[var(--paper-dim)] group-hover:text-[var(--paper)] leading-relaxed font-sans">
                    <span className="font-semibold text-white">I agree to the Terms &amp; Policies *</span>
                    <p className="text-[11px] text-[#8a8070] mt-0.5 font-mono">
                      I have read and agree to TraceXMail&apos;s{' '}
                      <a 
                        href="/terms" 
                        target="_blank" 
                        rel="noreferrer" 
                        onClick={(e) => e.stopPropagation()} 
                        className="text-amber-400 hover:text-amber-300 underline font-semibold transition-colors"
                      >
                        Terms of Service
                      </a>
                      ,{' '}
                      <a 
                        href="/privacy" 
                        target="_blank" 
                        rel="noreferrer" 
                        onClick={(e) => e.stopPropagation()} 
                        className="text-amber-400 hover:text-amber-300 underline font-semibold transition-colors"
                      >
                        Privacy Policy
                      </a>
                      , and{' '}
                      <a 
                        href="/cookies" 
                        target="_blank" 
                        rel="noreferrer" 
                        onClick={(e) => e.stopPropagation()} 
                        className="text-amber-400 hover:text-amber-300 underline font-semibold transition-colors"
                      >
                        Cookie Policy
                      </a>
                      .
                    </p>
                  </div>
                </label>
              </div>

              {/* Cloudflare Turnstile Verification Widget */}
              <div className="pt-1">
                <TurnstileWidget
                  action="signup"
                  onVerify={(token) => {
                    setTurnstileToken(token);
                    if (errorMsg?.includes('challenge') || errorMsg?.includes('Turnstile') || errorMsg?.includes('verification')) {
                      setErrorMsg(null);
                    }
                  }}
                  onExpire={() => setTurnstileToken('')}
                  onError={(err) => console.warn('[Turnstile] Challenge error:', err)}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !agreedToTerms}
                className="w-full mt-2 py-2.5 px-4 bg-[var(--stamp)] text-[var(--ink)] font-bold text-xs tracking-wider uppercase rounded-sm hover:brightness-110 active:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating Account…</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Create Account & Send Verification Link →</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 pt-3 border-t border-[var(--line)] text-center text-xs text-[var(--paper-dim)]">
              Already have clearance?{' '}
              <button
                onClick={onBackToLogin}
                className="text-[var(--stamp)] hover:underline font-semibold cursor-pointer bg-transparent border-0 p-0"
              >
                Sign in here
              </button>
            </div>

            {/* Legal & Privacy Trust Notice */}
            <div className="mt-3 pt-3 border-t border-[var(--line)]/60 text-center">
              <p className="text-[11px] text-[var(--paper-dim)] font-mono leading-relaxed">
                By registering, you agree to TraceXMail&apos;s{' '}
                <a href="/terms" className="text-[var(--paper)] hover:text-amber-400 underline transition-colors">
                  Terms of Service
                </a>
                ,{' '}
                <a href="/privacy" className="text-[var(--paper)] hover:text-amber-400 underline transition-colors">
                  Privacy Policy
                </a>
                , and{' '}
                <a href="/cookies" className="text-[var(--paper)] hover:text-amber-400 underline transition-colors">
                  Cookie Policy
                </a>
                .
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
