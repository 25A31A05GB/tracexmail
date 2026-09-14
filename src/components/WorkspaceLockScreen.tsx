import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  ShieldCheck, 
  ShieldAlert, 
  KeyRound, 
  LogOut, 
  ArrowRight, 
  Loader2, 
  Eye, 
  EyeOff, 
  Clock, 
  FileLock2, 
  AlertTriangle,
  Fingerprint
} from 'lucide-react';
import { UserRole } from '../hooks/useSession';
import { EmailAnalysis } from '../types';

interface WorkspaceLockScreenProps {
  userEmail?: string;
  userRole?: UserRole;
  userLabel?: string;
  organizationName?: string;
  currentAnalysis?: EmailAnalysis | null;
  lockedAt?: string | null;
  lockReason?: 'inactivity' | 'manual' | 'policy';
  onUnlock: (password?: string, quickUnlock?: boolean) => Promise<boolean>;
  onSignOut: () => void;
  unlockError?: string | null;
  unlocking?: boolean;
}

export function WorkspaceLockScreen({
  userEmail = 'analyst@enterprise.corp',
  userRole = 'analyst',
  userLabel = 'SA',
  organizationName = 'Acme Cyber Defense SOC',
  currentAnalysis,
  lockedAt,
  lockReason = 'inactivity',
  onUnlock,
  onSignOut,
  unlockError,
  unlocking = false
}: WorkspaceLockScreenProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [elapsedLockedSecs, setElapsedLockedSecs] = useState<number>(0);

  // Live timer for elapsed locked time
  useEffect(() => {
    const startTime = lockedAt ? new Date(lockedAt).getTime() : Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsedLockedSecs(Math.max(0, Math.floor((now - startTime) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [lockedAt]);

  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!password.trim()) {
      setLocalError('Please enter your operator password to resume session.');
      return;
    }

    const success = await onUnlock(password.trim(), false);
    if (!success) {
      setPassword('');
    }
  };

  const handleQuickUnlock = async () => {
    setLocalError(null);
    await onUnlock(undefined, true);
  };

  const errorToDisplay = unlockError || localError;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#07080b] text-[#ede6d8] p-4 select-none overflow-y-auto">
      {/* Background cryptographic grid & noise overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#d3a039_1px,transparent_1px)] [background-size:16px_16px]" />
      
      <div className="w-full max-w-lg bg-[#110f0c] border border-[#3a352c] rounded-lg shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Compliance Header Banner */}
        <div className="bg-[#18140f] border-b border-[#2d2820] px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-[10px] font-mono tracking-wider uppercase text-red-400 font-bold">
              MIL-STD / NIST 800-53 AC-11 SECURED
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#8a8070]">
            <Clock className="w-3 h-3 text-amber-500" />
            <span>Locked for: {formatElapsed(elapsedLockedSecs)}</span>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Lock Icon & Title */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 border-2 border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(245,158,11,0.15)]">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold font-display tracking-wide text-[#f4efe6]">
              Forensic Enclave Locked
            </h1>
            <p className="text-xs text-[#9d9282] max-w-sm mx-auto leading-relaxed">
              {lockReason === 'inactivity'
                ? 'Session automatically secured after idle period to prevent unauthorized access to sensitive forensic evidence.'
                : lockReason === 'manual'
                ? 'Workspace manually secured by operator. Evidence buffer is protected.'
                : 'Workspace access locked per organization security policy.'}
            </p>
          </div>

          {/* Active Operator Identity Card */}
          <div className="bg-[#16130f] border border-[#2d2820] rounded-md p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded bg-amber-500/20 border border-amber-500/30 flex items-center justify-center font-bold text-xs text-amber-300 shrink-0">
                {userLabel.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#f4efe6] truncate">
                  {userEmail}
                </div>
                <div className="text-[10px] font-mono text-[#8a8070] truncate">
                  {organizationName}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 pl-2">
              <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                userRole === 'admin'
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              }`}>
                {userRole === 'admin' ? 'Admin Gold' : 'Analyst Steel'}
              </span>
            </div>
          </div>

          {/* Masked Active Case Notice */}
          {currentAnalysis && (
            <div className="bg-[#181410] border border-[#3a352c] rounded p-2.5 flex items-center gap-2.5 text-xs text-[#b9af9c]">
              <FileLock2 className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono text-[#8a8070] uppercase">
                  Active Investigation Buffered:
                </div>
                <div className="font-semibold text-[11px] text-[#ede6d8] truncate">
                  {currentAnalysis.subject || currentAnalysis.id || 'Email Forensic Dossier'} (Encrypted)
                </div>
              </div>
              <span title="Chain-of-custody preserved" className="shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </span>
            </div>
          )}

          {/* Unlock Form */}
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="unlock-password" className="text-xs font-mono text-[#b9af9c] flex items-center justify-between">
                <span>Enter Operator Password:</span>
                <span className="text-[10px] text-[#8a8070]">Re-authentication required</span>
              </label>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8a8070]">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="unlock-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (localError) setLocalError(null);
                  }}
                  autoFocus
                  disabled={unlocking}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-[#0b0d12] border border-[#3a352c] focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500 rounded text-xs text-[#ede6d8] placeholder-[#575146] font-mono tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8a8070] hover:text-[#ede6d8] cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorToDisplay && (
              <div className="p-2.5 bg-red-950/40 border border-red-800/80 rounded text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span className="text-[11px] leading-tight">{errorToDisplay}</span>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                type="submit"
                disabled={unlocking}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold text-xs font-mono rounded transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {unlocking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Unlock Forensic Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Quick Unlock Session Token Revalidation */}
              <button
                type="button"
                onClick={handleQuickUnlock}
                disabled={unlocking}
                className="w-full py-2 bg-[#1a1612] hover:bg-[#25201a] border border-[#342e26] text-xs font-mono text-[#d8cfbf] rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Fingerprint className="w-3.5 h-3.5 text-amber-400" />
                <span>Quick Revalidate Active Session</span>
              </button>
            </div>
          </form>

          {/* Footer with Sign Out */}
          <div className="pt-3 border-t border-[#2d2820] flex items-center justify-between text-xs">
            <span className="text-[10px] font-mono text-[#8a8070]">
              Not your session?
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="text-[#8a8070] hover:text-red-400 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              <span>Sign Out / Switch Operator</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
