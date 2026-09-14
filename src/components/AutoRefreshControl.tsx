import { useState, useRef, useEffect } from 'react';
import { RefreshCw, Clock, Check, ChevronDown, Play, Pause, Zap } from 'lucide-react';
import { useAutoSync } from '../hooks/useAutoSync';

const INTERVAL_PRESETS = [
  { label: '10s', value: 10 },
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '2m', value: 120 },
  { label: '5m', value: 300 },
];

interface AutoRefreshControlProps {
  onSyncCases?: () => void | Promise<void>;
}

export function AutoRefreshControl({ onSyncCases }: AutoRefreshControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    enabled,
    intervalSeconds,
    countdown,
    isSyncing,
    lastSyncTime,
    isGmailConnected,
    toggleEnabled,
    setPollingInterval,
    triggerSyncNow
  } = useAutoSync(onSyncCases);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const formatLastSync = (date: Date | null) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Header Pill Button */}
      <button
        type="button"
        id="btn-auto-refresh-toggle"
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer select-none ${
          enabled
            ? 'bg-[#191612] border-[#3e372b] hover:border-amber-500/50 text-[#ede6d8]'
            : 'bg-[#151310] border-[#2d2820] hover:border-[#3e372b] text-[#8a8070]'
        }`}
        title={`Auto-Sync: ${enabled ? `Active (${intervalSeconds}s interval)` : 'Paused'}. Click to configure.`}
        aria-expanded={isOpen}
      >
        <RefreshCw
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${
            isSyncing
              ? 'animate-spin text-amber-400'
              : enabled
              ? 'text-amber-400/90'
              : 'text-[#8a8070]'
          }`}
        />

        <div className="flex items-center gap-1">
          <span className="hidden sm:inline font-sans text-[11px] font-medium">
            {enabled ? 'Auto-Sync' : 'Sync Off'}
          </span>

          {enabled && (
            <span className="text-[10px] text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 rounded">
              {isSyncing ? '...' : `${countdown}s`}
            </span>
          )}
        </div>

        {enabled && (
          <span className="relative flex h-2 w-2 ml-0.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
        )}

        <ChevronDown className="w-3 h-3 text-[#8a8070] shrink-0" />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-[#171410] border border-[#3e372b] rounded-xl shadow-2xl p-3.5 z-50 text-xs text-[#ede6d8] animate-in fade-in zoom-in-95 duration-150 divide-y divide-[#2d2820]">
          {/* Header row with toggle */}
          <div className="pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${enabled ? 'bg-amber-500/20 text-amber-400' : 'bg-[#221e17] text-[#8a8070]'}`}>
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-xs text-[#ede6d8]">Live Background Sync</h4>
                <p className="text-[10.5px] text-[#8a8070]">Gmail &amp; Case Forensic Polling</p>
              </div>
            </div>

            {/* Switch Toggle */}
            <button
              type="button"
              id="switch-auto-sync"
              onClick={() => toggleEnabled()}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enabled ? 'bg-amber-500' : 'bg-[#2e2922]'
              }`}
              title={enabled ? 'Disable periodic background sync' : 'Enable periodic background sync'}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Polling Interval Selector */}
          <div className="py-3 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#8a8070] flex items-center gap-1 font-mono uppercase tracking-wider text-[10px]">
                <Clock className="w-3 h-3 text-[#b9af9c]" /> Polling Interval
              </span>
              <span className="font-mono text-amber-400 font-semibold">{intervalSeconds}s</span>
            </div>

            <div className="grid grid-cols-6 gap-1">
              {INTERVAL_PRESETS.map((preset) => {
                const isSelected = intervalSeconds === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setPollingInterval(preset.value)}
                    className={`py-1 text-center font-mono text-[10.5px] rounded transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                        : 'bg-[#201c16] border-[#342e26] text-[#8a8070] hover:text-[#ede6d8] hover:border-[#4d4439]'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status & Manual Action */}
          <div className="pt-3 space-y-2.5">
            <div className="flex items-center justify-between text-[10.5px] font-mono text-[#8a8070] bg-[#12100d] px-2.5 py-1.5 rounded-lg border border-[#2a251e]">
              <span>Last Synced:</span>
              <span className="text-[#b9af9c] font-medium">{formatLastSync(lastSyncTime)}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-sync-now"
                onClick={() => triggerSyncNow()}
                disabled={isSyncing}
                className="flex-1 py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-[#14120f] font-sans font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Synchronizing...' : 'Sync Now'}</span>
              </button>

              <button
                type="button"
                onClick={() => toggleEnabled()}
                className="p-1.5 rounded-lg bg-[#221e17] hover:bg-[#2c261e] border border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8] transition-colors cursor-pointer"
                title={enabled ? 'Pause Auto-Sync' : 'Resume Auto-Sync'}
              >
                {enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-amber-400" />}
              </button>
            </div>

            {isGmailConnected && (
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono pt-1">
                <Check className="w-3 h-3 shrink-0" />
                <span className="truncate">Gmail Live Ingestion Stream Connected</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
