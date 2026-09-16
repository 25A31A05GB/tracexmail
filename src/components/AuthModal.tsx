import React, { useState } from 'react';
import { Shield, Lock, Mail, User, AlertCircle, CheckCircle2, X, LogIn, UserPlus, Building2, Loader2, MailCheck, ArrowRight } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { GoogleAuthButton } from './GoogleAuthButton';
import { initializeSession, SessionUser, signOutUser } from '../lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: SessionUser | null;
  initialMode?: 'signin' | 'signup';
}

export function AuthModal({ isOpen, onClose, currentUser = null, initialMode = 'signin' }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'analyst' | 'admin' | 'read_only'>('analyst');
  const [organizationId, setOrganizationId] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // MFA Challenge State
  const [mfaChallenge, setMfaChallenge] = useState<{ factorId: string; challengeId: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      if (initialMode) setMode(initialMode);
      setSubmitted(false);
      setMfaChallenge(null);
      setMfaCode('');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge || !mfaCode.trim() || !supabase) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaChallenge.factorId,
        challengeId: mfaChallenge.challengeId,
        code: mfaCode.trim()
      });

      if (error) {
        throw error;
      }

      setSuccessMessage('MFA verification successful (AAL2 authenticated).');
      await initializeSession();
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      console.error('[MFA Verify Error]', err);
      setErrorMessage(err.message || 'Invalid TOTP verification code. Please check your authenticator app.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOutUser();
      setSuccessMessage('Signed out successfully.');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 800);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.');
      return;
    }

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please provide both email and password.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        const customOrg = organizationId.trim();
        const fallbackOrg = 'org_' + email.trim().replace(/[^a-zA-Z0-9]/g, '_');
        const assignedOrg = (customOrg && customOrg !== 'org_acme_soc_01') ? customOrg : fallbackOrg;

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            data: {
              full_name: fullName.trim() || undefined,
              role,
              organization_id: assignedOrg
            }
          }
        });

        if (signUpError) {
          throw signUpError;
        }

        if (authData.user) {
          const finalOrg = (customOrg && customOrg !== 'org_acme_soc_01')
            ? customOrg
            : `org_${authData.user.id.replace(/[^a-zA-Z0-9]/g, '_')}`;

          // Attempt to insert profile record
          try {
            await supabase.from('profiles').upsert([
              {
                id: authData.user.id,
                email: email.trim(),
                role,
                organization_id: finalOrg,
                full_name: fullName.trim() || null
              }
            ]);
          } catch (profileErr) {
            console.warn('Profile upsert notice:', profileErr);
          }
        }

        setSuccessMessage('Account created successfully! Verification link or confirmation dispatched.');
        await initializeSession();
        setSubmitted(true);
      } else {
        // Sign In
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim()
        });

        if (signInError) {
          throw signInError;
        }

        // Real AAL Check for MFA
        const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (!aalError && aalData && aalData.nextLevel === 'aal2' && aalData.currentLevel === 'aal1') {
          const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
          if (!factorsError && factorsData?.totp && factorsData.totp.length > 0) {
            const factor = factorsData.totp[0];
            const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
              factorId: factor.id
            });

            if (!challengeError && challengeData) {
              setMfaChallenge({
                factorId: factor.id,
                challengeId: challengeData.id
              });
              setLoading(false);
              return;
            }
          }
        }

        setSuccessMessage('Signed in successfully.');
        await initializeSession();
        setTimeout(() => {
          onClose();
        }, 800);
      }
    } catch (err: any) {
      console.error('[Auth Error]', err);
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-[#1a1712] border border-[#3a352c] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-700/50 text-cyan-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                {submitted
                  ? 'Access Request Submitted'
                  : currentUser
                  ? 'Forensic Identity & Access'
                  : mode === 'signin'
                  ? 'SOC Analyst Sign In'
                  : 'Register SOC Account'}
              </h3>
              <p className="text-xs text-slate-400">
                {submitted
                  ? 'TraceXMail SOC Workspace Access'
                  : 'Supabase Auth • Multi-Tenant RBAC & Tenant Isolation'}
              </p>
            </div>
          </div>
          {!submitted && (
            <button
              onClick={() => {
                setSubmitted(false);
                onClose();
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {submitted ? (
            <div className="space-y-4 py-2">
              <div className="p-5 rounded-lg bg-emerald-950/30 border border-emerald-800/60 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-900/40 border border-emerald-500/50 text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                  <MailCheck className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-base font-semibold text-slate-100 font-display">
                    Account Registration &amp; Access Dispatched
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                    Your request has been registered in the SOC enclave directory. A confirmation email and security clearance verification link have been dispatched to:
                  </p>
                  <div className="inline-block px-3 py-1 rounded bg-[#0c0a08] border border-[#3a352c] font-mono text-cyan-300 text-xs font-medium mt-1">
                    {email || 'your corporate email'}
                  </div>
                </div>

                {/* Provisioned Attributes */}
                <div className="pt-2 text-left bg-slate-900/70 border border-slate-800 rounded p-3 text-[11px] font-mono space-y-1 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Requested Role:</span>
                    <span className="text-amber-400 uppercase font-bold">{role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tenant Org:</span>
                    <span className="text-slate-200">{organizationId || 'org_acme_soc_01'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Verification Link:</span>
                    <span className="text-emerald-400">Valid for 24h</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setMode('signin');
                  }}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Proceed to Sign In</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    onClose();
                  }}
                  className="py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : currentUser ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-800/60 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-medium text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Authenticated Active Session</span>
                </div>
                <div className="text-xs space-y-1 text-slate-300">
                  <div><span className="text-slate-500">Email:</span> <strong className="text-slate-200">{currentUser.email}</strong></div>
                  <div><span className="text-slate-500">Role:</span> <strong className="text-cyan-300 uppercase">{currentUser.role}</strong></div>
                  <div><span className="text-slate-500">Organization:</span> <strong className="text-slate-200">{currentUser.organizationId}</strong></div>
                  <div><span className="text-slate-500">Auth Method:</span> <strong className="text-slate-400">{currentUser.authMethod || 'Supabase JWT'}</strong></div>
                </div>
              </div>

              {successMessage && (
                <div className="p-3 text-xs bg-emerald-950/50 border border-emerald-600/60 rounded-lg text-emerald-300">
                  {successMessage}
                </div>
              )}
              {errorMessage && (
                <div className="p-3 text-xs bg-rose-950/50 border border-rose-600/60 rounded-lg text-rose-300">
                  {errorMessage}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={loading}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-rose-900/80 hover:bg-rose-800 border border-rose-700 text-rose-100 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
            </div>
          ) : mfaChallenge ? (
            <form onSubmit={handleMfaVerify} className="space-y-4">
              <div className="p-4 rounded-lg bg-cyan-950/40 border border-cyan-800/60 space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
                  <Shield className="w-4 h-4 shrink-0" />
                  <span>Two-Factor Authentication Required (AAL2)</span>
                </div>
                <p className="text-xs text-slate-300">
                  Please enter the 6-digit verification code from your authenticator app (Google Authenticator, 1Password, or Authy).
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 text-xs bg-rose-950/50 border border-rose-600/60 rounded-lg text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 text-xs bg-emerald-950/50 border border-emerald-600/60 rounded-lg text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  6-Digit Authenticator Code
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    autoFocus
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-center tracking-widest font-mono text-cyan-300 placeholder-slate-600 focus:outline-hidden focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMfaChallenge(null);
                    setMfaCode('');
                    setErrorMessage(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || mfaCode.length < 6}
                  className="flex-1 py-2 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                  <span>Verify TOTP Code</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {!isSupabaseConfigured && (
                <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-700/60 text-amber-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Supabase credentials are not set in <code>.env</code>. Requests will be authenticated with default SOC fallback credentials.
                  </span>
                </div>
              )}

              {/* Mode Switcher */}
              <div className="grid grid-cols-2 p-1 bg-slate-900/90 rounded-lg border border-slate-800 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => { setMode('signin'); setErrorMessage(null); }}
                  className={`py-1.5 rounded-md transition-all ${
                    mode === 'signin'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setErrorMessage(null); }}
                  className={`py-1.5 rounded-md transition-all ${
                    mode === 'signup'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Google OAuth Option */}
              <GoogleAuthButton
                id="modal-google-auth-btn"
                mode={mode === 'signup' ? 'signup' : 'continue'}
                variant="primary"
                onSuccess={async () => {
                  setSuccessMessage('Signed in with Google successfully.');
                  await initializeSession();
                  setTimeout(() => {
                    onClose();
                  }, 800);
                }}
                onError={(err) => setErrorMessage(err)}
              />

              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <div className="flex-1 h-px bg-slate-800" />
                <span>or continue with email</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              {errorMessage && (
                <div className="p-3 text-xs bg-rose-950/50 border border-rose-600/60 rounded-lg text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 text-xs bg-emerald-950/50 border border-emerald-600/60 rounded-lg text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Doe, Lead Analyst"
                      className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Corporate Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="analyst@acmedefense.sec"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
                  />
                </div>
              </div>

              {mode === 'signup' && (
                <>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Role</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as any)}
                        className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-cyan-500"
                      >
                        <option value="analyst">Analyst (Read/Write)</option>
                        <option value="admin">Admin (Full Control)</option>
                        <option value="read_only">Auditor (Read-Only)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Tenant Organization</label>
                      <div className="relative">
                        <Building2 className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          value={organizationId}
                          onChange={(e) => setOrganizationId(e.target.value)}
                          placeholder="org_acme_soc_01"
                          className="w-full pl-8 pr-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <span>Processing...</span>
                ) : mode === 'signin' ? (
                  <>
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In with Supabase</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Register Account</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
