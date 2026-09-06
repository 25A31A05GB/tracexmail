import React, { useState } from 'react';
import { Shield, Lock, Mail, User, AlertCircle, CheckCircle2, X, LogIn, UserPlus, Building2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { initializeSession, SessionUser, signOutUser } from '../lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: SessionUser | null;
}

export function AuthModal({ isOpen, onClose, currentUser = null }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'analyst' | 'admin' | 'read_only'>('analyst');
  const [organizationId, setOrganizationId] = useState('org_acme_soc_01');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

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
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            data: {
              full_name: fullName.trim() || undefined,
              role,
              organization_id: organizationId.trim() || 'org_acme_soc_01'
            }
          }
        });

        if (signUpError) {
          throw signUpError;
        }

        if (authData.user) {
          // Attempt to insert profile record
          try {
            await supabase.from('profiles').upsert([
              {
                id: authData.user.id,
                email: email.trim(),
                role,
                organization_id: organizationId.trim() || 'org_acme_soc_01',
                full_name: fullName.trim() || null
              }
            ]);
          } catch (profileErr) {
            console.warn('Profile upsert notice:', profileErr);
          }
        }

        setSuccessMessage('Account created successfully! Check your email if email confirmation is required, or sign in now.');
        await initializeSession();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        // Sign In
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim()
        });

        if (signInError) {
          throw signInError;
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
                {currentUser ? 'Forensic Identity & Access' : mode === 'signin' ? 'SOC Analyst Sign In' : 'Register SOC Account'}
              </h3>
              <p className="text-xs text-slate-400">
                Supabase Auth • Multi-Tenant RBAC &amp; Tenant Isolation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Active Session Card if User is logged in */}
          {currentUser ? (
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
