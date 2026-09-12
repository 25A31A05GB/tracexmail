import React, { useState } from 'react';
import { Chrome, Loader2, ShieldCheck, AlertCircle, Sparkles, X } from 'lucide-react';
import { signInWithGoogleOAuth, signInWithGoogleDemoSession } from '../lib/supabaseGoogleAuth';
import { isSupabaseConfigured } from '../lib/supabase';

export interface GoogleAuthButtonProps {
  mode?: 'signin' | 'signup' | 'continue';
  variant?: 'primary' | 'secondary' | 'compact' | 'landing';
  onSuccess?: (user?: any) => void;
  onError?: (error: string) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
  showSupabaseBadge?: boolean;
}

export function GoogleAuthButton({
  mode = 'signin',
  variant = 'primary',
  onSuccess,
  onError,
  className = '',
  id = 'supabase-google-auth-btn',
  disabled = false,
  showSupabaseBadge = true
}: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const getLabel = () => {
    switch (mode) {
      case 'signup':
        return 'Sign up with Google';
      case 'continue':
        return 'Continue with Google';
      case 'signin':
      default:
        return 'Sign in with Google';
    }
  };

  const handleGoogleClick = async () => {
    if (disabled || loading) return;

    setLoading(true);
    try {
      const res = await signInWithGoogleOAuth();

      if (res.success) {
        if (onSuccess) {
          onSuccess(res.user);
        } else {
          // If no custom handler passed, refresh or redirect to home/dashboard
          window.location.reload();
        }
      } else if (res.notConfigured) {
        // Supabase environment variables not set
        setShowConfigModal(true);
        if (onError) {
          onError(res.error || 'Supabase credentials are not configured.');
        }
      } else {
        if (onError) {
          onError(res.error || 'Google authentication via Supabase failed.');
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'An unexpected error occurred during Google sign in.';
      if (onError) onError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = () => {
    const res = signInWithGoogleDemoSession();
    setShowConfigModal(false);
    if (res.success && onSuccess) {
      onSuccess(res.user);
    } else if (res.success) {
      window.location.reload();
    }
  };

  // Base styling depending on variant
  let buttonClasses = '';
  if (variant === 'landing') {
    buttonClasses = `h-11 px-5 rounded-[3px] bg-[#ede6d8] hover:bg-white text-[#14120f] font-sans font-semibold text-[14px] flex items-center justify-center gap-2.5 transition-all shadow-md hover:shadow-lg cursor-pointer border border-[#ede6d8] ${className}`;
  } else if (variant === 'compact') {
    buttonClasses = `py-1.5 px-3 rounded-[2px] bg-[#1a1712] hover:bg-[#221e17] border border-[#3a352c] hover:border-[#b9af9c] text-[#ede6d8] font-sans text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${className}`;
  } else if (variant === 'secondary') {
    buttonClasses = `w-full py-2.5 px-4 rounded-[2px] border border-[var(--line,#3a352c)] bg-[var(--ink-2,#1a1712)] hover:bg-[rgba(237,230,216,0.06)] hover:border-[var(--paper-dim,#b9af9c)] text-[var(--paper,#ede6d8)] text-xs font-sans font-medium flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-xs ${className}`;
  } else {
    // Primary prominent style
    buttonClasses = `w-full py-2.5 px-4 rounded-[3px] border border-[#3a352c] hover:border-[#ede6d8]/40 bg-[#1a1712] hover:bg-[#24201a] text-[#ede6d8] text-[13px] font-sans font-medium flex items-center justify-center gap-2.5 transition-all cursor-pointer group shadow-sm ${className}`;
  }

  return (
    <>
      <button
        id={id}
        type="button"
        onClick={handleGoogleClick}
        disabled={disabled || loading}
        className={`${buttonClasses} disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-[#c9a227]" />
            <span className="truncate">Connecting to Google via Supabase…</span>
          </>
        ) : (
          <>
            {/* Google Chrome Icon with official branded accent */}
            <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0">
              <Chrome className={`w-4 h-4 ${variant === 'landing' ? 'text-[#ea4335]' : 'text-[#ea4335] group-hover:scale-105 transition-transform'}`} />
            </div>
            
            <span className="truncate font-medium">{getLabel()}</span>

            {showSupabaseBadge && (
              <span className={`ml-auto font-mono text-[9px] px-1.5 py-0.5 rounded-[2px] uppercase tracking-wider shrink-0 ${
                variant === 'landing'
                  ? 'bg-[#14120f]/10 text-[#14120f] border border-[#14120f]/20 font-semibold'
                  : 'bg-[#221e17] text-[#c9a227] border border-[#3a352c]'
              }`}>
                Supabase Auth
              </span>
            )}
          </>
        )}
      </button>

      {/* Interactive Helper Modal if Supabase Environment is Not Yet Configured in Sandbox */}
      {showConfigModal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="supabase-config-dialog-title"
        >
          <div className="bg-[#16130f] border border-[#3a352c] max-w-md w-full rounded-[4px] p-5 shadow-2xl text-[#ede6d8] font-sans relative">
            <button
              onClick={() => setShowConfigModal(false)}
              className="absolute top-3.5 right-3.5 text-[#8a8070] hover:text-[#ede6d8] transition-colors p-1"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-md bg-[#c9a227]/15 border border-[#c9a227]/30 flex items-center justify-center text-[#c9a227]">
                <Chrome className="w-4 h-4 text-[#ea4335]" />
              </div>
              <div>
                <h3 id="supabase-config-dialog-title" className="font-display font-semibold text-base text-[#ede6d8]">
                  Supabase Google Authentication
                </h3>
                <span className="font-mono text-[10px] text-[#c9a227] uppercase tracking-wider">
                  OAuth Provider Setup
                </span>
              </div>
            </div>

            <p className="text-xs text-[#b9af9c] leading-relaxed mb-4">
              To authenticate against live Supabase accounts, your project environment requires standard Supabase credentials with the Google OAuth provider enabled:
            </p>

            <div className="bg-[#110f0c] border border-[#2e2a22] rounded-[3px] p-3 mb-4 font-mono text-[11px] text-[#b9af9c] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[#8a8070]">1. Environment:</span>
                <span className="text-[#c9a227]">VITE_SUPABASE_URL &amp; ANON_KEY</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8a8070]">2. Supabase Dashboard:</span>
                <span className="text-[#7fa3ba]">Auth &gt; Providers &gt; Google (Enabled)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8a8070]">3. Redirect URI:</span>
                <span className="text-emerald-400">/auth/callback</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleDemoSignIn}
                className="w-full py-2.5 px-3 rounded-[3px] bg-[#c9a227] hover:bg-[#d8b030] text-[#14120f] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Continue as Google Analyst (Enclave Demo)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="w-full py-2 px-3 rounded-[3px] bg-[#221e17] hover:bg-[#2c271f] text-[#ede6d8] border border-[#3a352c] text-xs transition-colors cursor-pointer"
              >
                Dismiss &amp; Enter Email / Password
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
