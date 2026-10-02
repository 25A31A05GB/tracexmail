import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  WifiOff, 
  Wifi, 
  RefreshCw, 
  Database, 
  ShieldCheck, 
  X, 
  ChevronRight, 
  Cpu, 
  Info,
  CheckCircle2,
  HardDrive
} from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

interface ForensicOfflineModeBannerProps {
  onOpenLocalSamples?: () => void;
  className?: string;
}

export function ForensicOfflineModeBanner({
  onOpenLocalSamples,
  className = ''
}: ForensicOfflineModeBannerProps) {
  const { 
    isOnline, 
    offlineSince, 
    wasOffline, 
    isReconnecting, 
    checkConnection 
  } = useOnlineStatus();

  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Time elapsed in offline state
  const timeOfflineFormatted = React.useMemo(() => {
    if (!offlineSince) return '';
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - offlineSince.getTime()) / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    return `${diffMin}m ago`;
  }, [offlineSince]);

  return (
    <div className={`pointer-events-none fixed top-3 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 ${className}`}>
      <AnimatePresence>
        {/* Case A: Active Offline Mode */}
        {!isOnline && !isDismissed && (
          <motion.div
            initial={{ y: -40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -40, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="pointer-events-auto rounded-xl border border-amber-500/40 bg-[#16130f]/95 p-3.5 sm:p-4 text-[#ede6d8] shadow-[0_12px_40px_rgba(0,0,0,0.85)] backdrop-blur-xl relative overflow-hidden font-sans"
            role="alert"
            aria-live="assertive"
          >
            {/* Top Accent Gradient Bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 animate-pulse" />

            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5">
                  <WifiOff className="w-5 h-5 text-amber-400 animate-pulse" />
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <span>Offline Forensic Mode Active</span>
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600/60 text-amber-300 font-bold flex items-center gap-1">
                      <HardDrive className="w-3 h-3" />
                      <span>Service Worker Enclave</span>
                    </span>
                    {timeOfflineFormatted && (
                      <span className="text-[10px] font-mono text-[#8a8070]">
                        ({timeOfflineFormatted})
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#b9af9c] leading-relaxed">
                    Network connectivity is unavailable. TraceXMail has engaged offline asset caching. <strong className="text-[#ede6d8]">Local RFC 822 parser, attack pattern engine, and evidence dossier generator remain fully operational.</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1 rounded text-[#8a8070] hover:text-[#ede6d8] transition-colors cursor-pointer"
                  title="Toggle details"
                  aria-label="Toggle offline capability details"
                >
                  <Info className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsDismissed(true)}
                  className="p-1 rounded text-[#8a8070] hover:text-[#ede6d8] transition-colors cursor-pointer"
                  aria-label="Dismiss offline banner"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expandable Offline Capability Details */}
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 pt-3 border-t border-[#2e271f] space-y-2 text-xs"
              >
                <div className="font-mono text-[11px] text-amber-400 font-bold uppercase tracking-wider">
                  Available Offline Capabilities:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px] text-[#8e8574]">
                  <div className="flex items-center gap-1.5 p-1.5 rounded bg-[#100e0b] border border-[#262118]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Local RFC 822 Envelope Parsing</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 rounded bg-[#100e0b] border border-[#262118]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Hop Traceroute &amp; Timing Matrix</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 rounded bg-[#100e0b] border border-[#262118]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Cryptographic Evidence Export</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 rounded bg-[#100e0b] border border-[#262118]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Autonomous Enclave Storage</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Action Bar */}
            <div className="mt-3 pt-2.5 border-t border-[#2a241b] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px] font-mono text-[#8a8070]">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Zero Data Loss Guarantee</span>
              </div>

              <div className="flex items-center gap-2">
                {onOpenLocalSamples && (
                  <button
                    type="button"
                    onClick={onOpenLocalSamples}
                    className="px-2.5 py-1 rounded bg-[#1e1a14] hover:bg-[#28221a] border border-[#383025] text-xs font-mono text-[#ede6d8] transition-colors cursor-pointer"
                  >
                    Inspect Cached Corpus
                  </button>
                )}

                <button
                  type="button"
                  onClick={checkConnection}
                  disabled={isReconnecting}
                  className="px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 hover:text-amber-200 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isReconnecting ? 'animate-spin' : ''}`} />
                  <span>{isReconnecting ? 'Testing Network…' : 'Reconnect'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Case B: Online Re-established Toast */}
        {wasOffline && isOnline && (
          <motion.div
            initial={{ y: -30, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -30, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="pointer-events-auto rounded-xl border border-emerald-500/50 bg-[#0d1611]/95 p-3 text-[#ede6d8] shadow-[0_12px_40px_rgba(0,0,0,0.85)] backdrop-blur-xl relative overflow-hidden font-sans flex items-center justify-between gap-3"
            role="status"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <Wifi className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <span>Network Re-established</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-700 text-emerald-300">
                    Live Sync
                  </span>
                </div>
                <div className="text-[11px] text-[#8e8574]">
                  Cloud SOC intelligence feeds and real-time WebSocket streams synchronized.
                </div>
              </div>
            </div>

            <span className="text-xs font-mono text-emerald-400 font-bold px-2 py-1 rounded bg-emerald-950/60 border border-emerald-800 shrink-0">
              ONLINE
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
