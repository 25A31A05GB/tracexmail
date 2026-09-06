import React, { useState, FormEvent } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Loader2, AlertCircle, ArrowLeft, Shield, UserCheck, KeyRound, ShieldAlert, Eye, Lock } from 'lucide-react';
import { UserRole } from '../hooks/useSession';

interface LoginViewProps {
  onBackToGate?: () => void;
  onBackToIntro?: () => void;
  onRequestAccess?: () => void;
  onSuccess?: () => void;
  onSelectRoleLogin?: (role: UserRole, options?: { email?: string; fullName?: string; orgName?: string }) => void;
}

export function LoginView({ 
  onBackToGate, 
  onBackToIntro,
  onRequestAccess, 
  onSuccess,
  onSelectRoleLogin 
}: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleBack = onBackToIntro || onBackToGate;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both your work email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (error) {
          setErrorMsg(error.message || 'Sign in failed. Please verify your email and password.');
          setLoading(false);
          return;
        }

        if (data.session) {
          if (onSuccess) onSuccess();
          return;
        }
      }

      // Role determination based on email or default analyst
      let determinedRole: UserRole = 'analyst';
      const lowerEmail = email.toLowerCase();
      if (lowerEmail.includes('admin') || lowerEmail.includes('lead') || lowerEmail.includes('commander')) {
        determinedRole = 'admin';
      } else if (lowerEmail.includes('audit') || lowerEmail.includes('readonly') || lowerEmail.includes('guest')) {
        determinedRole = 'read_only';
      }

      if (onSelectRoleLogin) {
        onSelectRoleLogin(determinedRole, {
          email: email.trim(),
          fullName: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          orgName: 'Security Team'
        });
      } else if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('[Login] Authentication error:', err);
      setErrorMsg(err.message || 'An unexpected error occurred during sign in.');
      setLoading(false);
    }
  };

  const handleQuickRole = (role: UserRole, roleName: string, roleEmail: string) => {
    if (onSelectRoleLogin) {
      onSelectRoleLogin(role, {
        email: roleEmail,
        fullName: roleName,
        orgName: 'Acme Security Team'
      });
    } else if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ink)] bg-[radial-gradient(ellipse_900px_500px_at_50%_-10%,rgba(178,58,46,0.08),transparent_60%)] p-4 text-[var(--paper)] font-sans select-text relative overflow-y-auto">
      <div className="w-full max-w-[460px] bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-8 relative z-10">
        
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

          <div className="font-mono text-[10.5px] text-[var(--stamp)] uppercase tracking-wider ml-auto flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--stamp)]" />
            <span>SECURE LOGIN</span>
          </div>
        </div>

        {/* Brand Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-5 h-5 rounded-full border-[1.5px] border-[var(--thread)] relative shrink-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[var(--thread)]" />
          </div>
          <span className="font-display font-bold text-xl text-[var(--paper)] tracking-tight">
            TraceXMail Sign In
          </span>
        </div>

        <div className="text-[var(--paper-dim)] text-[13.5px] mb-5">
          Sign in to inspect suspicious emails, view route maps, and export safety reports.
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-[2px] bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-[var(--rose-300)] text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--thread)]" />
            <div className="leading-relaxed font-sans">{errorMsg}</div>
          </div>
        )}

        {/* 1-Click Fast Role Sign In */}
        <div className="mb-5 p-3.5 rounded-[2px] bg-[var(--ink)] border border-[var(--line)]">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-sans font-semibold text-[var(--paper-dim)] flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[var(--slate)]" />
              1-Click Instant Demo Login:
            </span>
            <span className="text-[10px] font-mono text-[var(--forensic-green)] flex items-center gap-1 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--forensic-green)]" />
              Ready
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickRole('admin', 'Alex Vance', 'admin@tracexmail.sec')}
              className="p-2.5 rounded-[2px] border border-[rgba(201,162,39,0.35)] bg-[rgba(201,162,39,0.08)] hover:bg-[rgba(201,162,39,0.18)] hover:border-[var(--stamp)] text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] font-bold text-[var(--stamp)]">ADMIN</span>
                <ShieldAlert className="w-3 h-3 text-[var(--stamp)] opacity-80 group-hover:opacity-100" />
              </div>
              <div className="text-[11px] text-[var(--paper)] truncate font-semibold">Admin</div>
              <div className="text-[9.5px] text-[var(--paper-dim)] truncate">All controls</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickRole('analyst', 'Sarah Chen', 'analyst@tracexmail.sec')}
              className="p-2.5 rounded-[2px] border border-[rgba(127,163,186,0.35)] bg-[rgba(127,163,186,0.08)] hover:bg-[rgba(127,163,186,0.18)] hover:border-[var(--slate)] text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] font-bold text-[var(--slate)]">ANALYST</span>
                <Shield className="w-3 h-3 text-[var(--slate)] opacity-80 group-hover:opacity-100" />
              </div>
              <div className="text-[11px] text-[var(--paper)] truncate font-semibold">Analyst</div>
              <div className="text-[9.5px] text-[var(--paper-dim)] truncate">Full analysis</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickRole('read_only', 'Marcus Reed', 'auditor@tracexmail.sec')}
              className="p-2.5 rounded-[2px] border border-[var(--line)] bg-[var(--ink-2)] hover:bg-[rgba(237,230,216,0.08)] hover:border-[var(--paper-dim)] text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] font-bold text-[var(--paper-dim)]">AUDITOR</span>
                <Eye className="w-3 h-3 text-[var(--paper-dim)] opacity-80 group-hover:opacity-100" />
              </div>
              <div className="text-[11px] text-[var(--paper)] truncate font-semibold">Auditor</div>
              <div className="text-[9.5px] text-[var(--paper-dim)] truncate">Privacy view</div>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 my-3 text-xs text-[var(--line)]">
          <div className="flex-1 h-px bg-[var(--line)]" />
          <span className="font-sans text-[11px] text-[var(--paper-muted)] font-medium">or enter your work email</span>
          <div className="flex-1 h-px bg-[var(--line)]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1">
            <label className="block text-xs text-[var(--paper-dim)] font-medium" htmlFor="login-email">
              Work email
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              disabled={loading}
              className="w-full bg-[var(--ink)] border border-[var(--line)] focus:border-[var(--slate)] focus:outline-hidden rounded-[2px] px-3.5 py-2 text-sm text-[var(--paper)] placeholder-[var(--paper-muted)] transition-colors disabled:opacity-50 font-sans"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs text-[var(--paper-dim)] font-medium" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              disabled={loading}
              className="w-full bg-[var(--ink)] border border-[var(--line)] focus:border-[var(--slate)] focus:outline-hidden rounded-[2px] px-3.5 py-2 text-sm text-[var(--paper)] placeholder-[var(--paper-muted)] transition-colors disabled:opacity-50 font-sans"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2 text-center flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 py-2.5 font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[var(--paper)]" />
                <span>Checking Credentials…</span>
              </>
            ) : (
              <span>Sign In to TraceXMail</span>
            )}
          </button>
        </form>

        {onRequestAccess && (
          <div className="mt-4 pt-3.5 border-t border-[var(--line)] text-center">
            <button
              type="button"
              onClick={onRequestAccess}
              className="text-xs text-[var(--slate)] hover:text-[var(--paper)] hover:underline cursor-pointer transition-colors bg-transparent border-0"
            >
              Don&apos;t have an account? Create one now →
            </button>
          </div>
        )}

        <div className="mt-4 text-[11.5px] text-[var(--paper-muted)] text-center font-sans">
          Protected with end-to-end encryption &amp; privacy controls
        </div>
      </div>
    </div>
  );
}
