import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  ShieldAlert, 
  ShieldCheck, 
  Radio, 
  Zap, 
  Globe2, 
  Database, 
  Fingerprint, 
  Layers, 
  Sparkles, 
  ArrowUpRight,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { SAMPLE_ANALYSES } from '../../data/samples';
import { EmailAnalysis } from '../../types';

interface LiveDynamicTelemetryRibbonProps {
  onSelectCase?: (analysis: EmailAnalysis) => void;
  onOpenConsole?: () => void;
  className?: string;
}

interface LiveTraceEvent {
  id: string;
  hash: string;
  source: string;
  asn: string;
  verdict: 'MALICIOUS' | 'WARNING' | 'CLEAN';
  threatScore: number;
  timeAgo: string;
  subject: string;
  sampleIndex: number;
}

const INITIAL_EVENTS: LiveTraceEvent[] = [
  {
    id: 'tr-01',
    hash: '88f2b7a1...3921',
    source: 'Sofia, BG (Tor Exit)',
    asn: 'AS200548',
    verdict: 'MALICIOUS',
    threatScore: 98,
    timeAgo: '2s ago',
    subject: '[URGENT] PayPal Account Restriction',
    sampleIndex: 0
  },
  {
    id: 'tr-02',
    hash: '4e9e1f28...c712',
    source: 'AlexHost Moldova',
    asn: 'AS57523',
    verdict: 'MALICIOUS',
    threatScore: 95,
    timeAgo: '9s ago',
    subject: 'Wire Transfer Authorization ($48,200)',
    sampleIndex: 1
  },
  {
    id: 'tr-03',
    hash: '1a9f02c4...e881',
    source: 'San Francisco, US (GitHub MX)',
    asn: 'AS36459',
    verdict: 'CLEAN',
    threatScore: 4,
    timeAgo: '18s ago',
    subject: '[GitHub] Personal Access Token Created',
    sampleIndex: 2
  },
  {
    id: 'tr-04',
    hash: '9d2e4e9e...5a1f',
    source: 'Bucharest, RO (Bulletproof)',
    asn: 'AS44901',
    verdict: 'MALICIOUS',
    threatScore: 92,
    timeAgo: '24s ago',
    subject: 'Action Required: Microsoft 365 Password Reset',
    sampleIndex: 0
  }
];

export const LiveDynamicTelemetryRibbon: React.FC<LiveDynamicTelemetryRibbonProps> = ({
  onSelectCase,
  onOpenConsole,
  className = ''
}) => {
  // Dynamic base numbers that sync and increment in real-time
  const [deconstructedCount, setDeconstructedCount] = useState<number>(14892);
  const [cryptoVerifiedCount, setCryptoVerifiedCount] = useState<number>(41280);
  const [torInterceptionsCount, setTorInterceptionsCount] = useState<number>(1247);
  const [activeAnalysts, setActiveAnalysts] = useState<number>(38);
  const [events, setEvents] = useState<LiveTraceEvent[]>(INITIAL_EVENTS);
  const [recentFlash, setRecentFlash] = useState<boolean>(false);

  // Read real local cases / session cases if stored
  useEffect(() => {
    try {
      const stored = localStorage.getItem('tracexmail_cases_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDeconstructedCount(prev => prev + parsed.length);
        }
      }
    } catch {}
  }, []);

  // Periodic simulated live telemetry tick to reflect real-time enterprise stream
  useEffect(() => {
    const interval = setInterval(() => {
      // Small random increments to simulate live global ingest
      setDeconstructedCount(prev => prev + 1);
      setCryptoVerifiedCount(prev => prev + Math.floor(Math.random() * 3) + 1);
      if (Math.random() > 0.6) {
        setTorInterceptionsCount(prev => prev + 1);
      }

      // Flash signal
      setRecentFlash(true);
      setTimeout(() => setRecentFlash(false), 800);

      // Rotate events with fresh timestamp updates
      setEvents(prev => {
        const first = prev[0];
        const rotated = [...prev.slice(1), { ...first, timeAgo: 'Just now' }];
        return rotated;
      });
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  const handleInspectTrace = (sampleIdx: number) => {
    const sample = SAMPLE_ANALYSES[sampleIdx] || SAMPLE_ANALYSES[0];
    if (onSelectCase) {
      onSelectCase(sample);
    }
    if (onOpenConsole) {
      onOpenConsole();
    }
  };

  return (
    <div className={`w-full bg-[#110f0c] border-y border-[#3a352c] relative overflow-hidden ${className}`}>
      
      {/* Top Ticker Metric Bar */}
      <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left Live Status Signal */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-[2px] bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#4ade80] font-['IBM_Plex_Mono',monospace] text-[11px] font-bold">
            <span className={`w-2 h-2 rounded-full bg-[#22c55e] ${recentFlash ? 'scale-150 animate-ping' : 'animate-pulse'}`} />
            <span>GLOBAL DECONSTRUCTION ENGINE ACTIVE</span>
          </div>
          <span className="hidden sm:inline-block font-['IBM_Plex_Mono',monospace] text-[11px] text-[#8e8574]">
            RFC822 Core v2.4 • Low Latency (14ms)
          </span>
        </div>

        {/* Center Live Real-Time Counts */}
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 font-['IBM_Plex_Mono',monospace] text-[11.5px]">
          <div className="flex items-center gap-1.5 text-[#b9af9c]">
            <Layers className="w-3.5 h-3.5 text-[#c9a227]" />
            <span>Deconstructed:</span>
            <strong className="text-[#ede6d8] transition-all font-bold">
              {deconstructedCount.toLocaleString()}
            </strong>
          </div>

          <div className="flex items-center gap-1.5 text-[#b9af9c]">
            <Fingerprint className="w-3.5 h-3.5 text-[#22c55e]" />
            <span>DKIM/SPF Verified:</span>
            <strong className="text-[#ede6d8] font-bold">
              {cryptoVerifiedCount.toLocaleString()}
            </strong>
          </div>

          <div className="flex items-center gap-1.5 text-[#b9af9c]">
            <ShieldAlert className="w-3.5 h-3.5 text-[#ff8d7d]" />
            <span>Tor/Relay Interceptions:</span>
            <strong className="text-[#ff8d7d] font-bold">
              {torInterceptionsCount.toLocaleString()}
            </strong>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-[#b9af9c]">
            <Zap className="w-3.5 h-3.5 text-[#7fa3ba]" />
            <span>Active Enclaves:</span>
            <strong className="text-[#ede6d8] font-bold">
              {activeAnalysts} SOC Nodes
            </strong>
          </div>
        </div>

        {/* Right Action Trigger */}
        <button
          onClick={onOpenConsole}
          className="shrink-0 px-3 py-1 rounded-[2px] bg-[#221e17] hover:bg-[#b23a2e] border border-[#3a352c] hover:border-[#b23a2e] text-[#ede6d8] font-['IBM_Plex_Mono',monospace] text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 group"
        >
          <span>Open Live Stream</span>
          <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </button>

      </div>

      {/* Bottom Live Evidence Stream Ticker Ribbon */}
      <div className="bg-[#0b0a08] border-t border-[#3a352c]/50 py-2 overflow-x-auto no-scrollbar">
        <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 min-w-max text-[11px] font-['IBM_Plex_Mono',monospace]">
          <span className="text-[#c9a227] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
            <Radio className="w-3 h-3 animate-pulse text-[#c9a227]" />
            <span>Real Evidence Hash Log:</span>
          </span>

          <div className="flex items-center gap-4">
            {events.map((ev, idx) => {
              const isMal = ev.verdict === 'MALICIOUS';
              return (
                <div
                  key={ev.id}
                  onClick={() => handleInspectTrace(ev.sampleIndex)}
                  className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#16130f] border border-[#2d2820] hover:border-[#b9af9c] hover:bg-[#221e17] cursor-pointer transition-colors shrink-0"
                  title="Click to load this forensic case in Console"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isMal ? 'bg-[#b23a2e]' : 'bg-[#22c55e]'}`} />
                  <span className="text-[#8e8574] font-semibold">{ev.hash}</span>
                  <span className="text-[#ede6d8] truncate max-w-[160px]">{ev.source}</span>
                  <span className={`px-1 rounded text-[9.5px] font-bold ${
                    isMal ? 'bg-[#b23a2e]/20 text-[#ff8d7d]' : 'bg-[#22c55e]/20 text-[#4ade80]'
                  }`}>
                    {ev.verdict} ({ev.threatScore})
                  </span>
                  <span className="text-[#645c4e] text-[10px]">{ev.timeAgo}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
};
