import React, { useEffect } from 'react';
import { ShieldAlert, Clock, Lock, ArrowRight, Volume2, Shield } from 'lucide-react';

interface InactivityWarningModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  totalWarningSeconds: number;
  onExtendSession: () => void;
  onLockNow: () => void;
  complianceStandard?: string;
}

export function InactivityWarningModal({
  isOpen,
  secondsRemaining,
  totalWarningSeconds = 60,
  onExtendSession,
  onLockNow,
  complianceStandard = 'NIST SP 800-53 AC-11'
}: InactivityWarningModalProps) {
  if (!isOpen) return null;

  // Format mm:ss
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  // Percentage remaining in warning window
  const pct = Math.max(0, Math.min(100, (secondsRemaining / totalWarningSeconds) * 100));

  // Keyboard shortcut: pressing Space or Enter extends session
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onExtendSession();
      } else if (e.key === 'Escape') {
        onLockNow();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExtendSession, onLockNow]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="inactivity-title"
        className="w-full max-w-md bg-[#13110e] border-2 border-amber-500/80 rounded-lg shadow-[0_0_50px_rgba(245,158,11,0.25)] p-6 space-y-5 text-[#ede6d8] relative overflow-hidden"
      >
        {/* Top Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#252019]">
          <div 
            className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-red-500 transition-all duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Header with security badge */}
        <div className="flex items-start gap-3.5 pt-1">
          <div className="w-11 h-11 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400 animate-pulse">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                Security Compliance Warning
              </span>
              <span className="text-[10px] font-mono text-[#8a8070]">
                {complianceStandard}
              </span>
            </div>
            <h2 id="inactivity-title" className="text-lg font-bold font-display text-[#f4efe6] mt-1">
              Session Inactivity Auto-Lock
            </h2>
          </div>
        </div>

        {/* Warning text */}
        <p className="text-xs text-[#b9af9c] leading-relaxed">
          Your forensic workspace has been idle. To safeguard sensitive investigation dossiers, unredacted email headers, and evidentiary integrity, this session will automatically lock.
        </p>

        {/* Countdown Box */}
        <div className="bg-[#1a1612] border border-[#3a352c] rounded-md p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs text-[#d8cfbf]">
            <Clock className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
            <div>
              <div className="font-semibold text-xs">Auto-Locking In</div>
              <div className="text-[10px] text-[#8a8070]">Click anywhere or press Enter to stay active</div>
            </div>
          </div>
          <div className="text-3xl font-mono font-bold text-amber-400 tracking-wider bg-black/40 px-3 py-1 rounded border border-amber-500/30 shadow-inner">
            {timeFormatted}
          </div>
        </div>

        {/* Compliance footnote */}
        <div className="flex items-center gap-2 text-[10.5px] font-mono text-[#8a8070] bg-[#16130f] p-2 rounded border border-[#2d2820]">
          <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>NIST 800-53 AC-11: Mandatory unattended forensic session termination.</span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onLockNow}
            className="px-3.5 py-2 rounded text-xs font-mono text-[#9d9282] hover:text-[#ede6d8] hover:bg-[#25201a] border border-[#342e26] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock Now</span>
          </button>

          <button
            type="button"
            onClick={onExtendSession}
            autoFocus
            className="px-5 py-2.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
          >
            <span>Stay Active &amp; Extend Session</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
