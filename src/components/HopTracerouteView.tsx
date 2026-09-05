import { useState } from 'react';
import { 
  Network, 
  ArrowRight, 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  Server, 
  Globe, 
  Activity, 
  AlertTriangle,
  Layers,
  Copy,
  Check,
  Workflow
} from 'lucide-react';
import { EmailAnalysis, EmailHop } from '../types';
import { NetworkFlowDiagram } from './NetworkFlowDiagram';

interface HopTracerouteProps {
  analysis: EmailAnalysis;
  onSelectHop?: (hop: EmailHop) => void;
}

export function HopTracerouteView({ analysis }: HopTracerouteProps) {
  const [selectedHopIndex, setSelectedHopIndex] = useState<number>(0);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'flow'>('flow');

  if (!analysis) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#14120f] text-[#8a8070]">
        <Network className="w-10 h-10 text-[#7fa3ba] mb-3" />
        <h3 className="text-base font-bold text-[#ede6d8]">No Analysis Selected</h3>
        <p className="text-xs text-[#8a8070] mt-1">Please select an analysis to inspect hop route telemetry.</p>
      </div>
    );
  }

  const hops = Array.isArray(analysis.hops) ? analysis.hops : [];
  const activeHop = hops[selectedHopIndex] || hops[0] || {} as EmailHop;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div id="hops-view" className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto bg-[#14120f]">
      {/* Top Banner */}
      <div className="bg-[#1a1712] border border-[#3a352c] rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-semibold text-white">
              SMTP Relay Hop Traceroute Analysis
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Visualizing chronologically extracted envelope hops from original client submission to final corporate MX delivery.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-900 border border-slate-700 p-0.5 rounded-lg">
            <button
              onClick={() => setViewMode('flow')}
              className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === 'flow' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>Topology Graph</span>
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === 'timeline' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Hop Cards</span>
            </button>
          </div>

          <div className="bg-slate-900/80 border border-slate-700 px-3 py-1.5 rounded text-xs font-mono text-slate-300">
            Total Hops: <strong className="text-blue-400 font-bold">{hops.length}</strong>
          </div>
          <div className="bg-slate-900/80 border border-slate-700 px-3 py-1.5 rounded text-xs font-mono text-slate-300">
            Relay Span:{' '}
            <strong className="text-emerald-400 font-bold">
              {hops.reduce((acc, h) => acc + (h.delaySec || 0), 0)}s
            </strong>
          </div>
        </div>
      </div>

      {/* Interactive Graph View */}
      {viewMode === 'flow' && (
        <div className="bg-[#1a1712] border border-[#3a352c] rounded-lg p-4 shadow-sm flex flex-col min-h-[460px]">
          <div className="flex items-center justify-between mb-3 text-xs text-slate-400 font-sans">
            <span>Interactive Node Directed Acyclic Graph (DAG) — Pan, Zoom, and Drag</span>
            <span className="text-blue-400 font-semibold">TraceXMail Topology Engine</span>
          </div>
          <div className="h-[440px] w-full">
            <NetworkFlowDiagram analysis={analysis} />
          </div>
        </div>
      )}

      {/* Hop Timeline Strip */}
      {viewMode === 'timeline' && (
        <div className="bg-[#1a1712] border border-[#3a352c] rounded-lg p-5 shadow-sm">
          <div className="text-xs text-slate-400 uppercase font-semibold mb-4 tracking-wider">
            Chronological Relay Path
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
            {hops.map((hop, idx) => {
              const isSelected = selectedHopIndex === idx;
              const isOrigin = hop.isOrigin;
              const isDestination = idx === hops.length - 1;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedHopIndex(idx)}
                  className={`p-4 rounded-lg border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500 shadow-md shadow-blue-900/20 ring-1 ring-blue-500'
                      : 'bg-slate-900/60 border-slate-700 hover:border-slate-600 hover:bg-slate-900/90'
                  }`}
                >
                  {/* Hop Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                          isOrigin
                            ? 'bg-rose-600 text-white'
                            : isDestination
                            ? 'bg-emerald-600 text-white'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        {hop.hopNumber}
                      </span>
                      <span className="text-xs font-semibold text-slate-200">
                        {isOrigin ? 'Origin Sender' : isDestination ? 'Destination MX' : `Relay Hop ${hop.hopNumber}`}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{hop.timestamp}</span>
                  </div>

                  {/* IP & Host */}
                  <div className="space-y-1 my-3">
                    <div className="text-xs font-mono text-blue-400 font-medium truncate">
                      {hop.fromIp || '127.0.0.1'}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate" title={hop.fromHost}>
                      {hop.fromHost || hop.byHost}
                    </div>
                  </div>

                  {/* Geo Location Pill */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] font-mono">
                    <span className="text-slate-300 flex items-center gap-1">
                      <Globe className="w-3 h-3 text-slate-400" />
                      {hop.city}, {hop.countryCode}
                    </span>
                    <span className="text-slate-400">+{hop.delaySec}s delay</span>
                  </div>

                  {/* Tor Exit Node Badge */}
                  {(hop.isTorExitNode || hop.is_tor) && (
                    <div className="mt-2 text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded font-mono font-bold text-center flex items-center justify-center gap-1">
                      <span>🧅</span> <span>CONFIRMED TOR EXIT NODE</span>
                    </div>
                  )}

                  {/* Malicious Tag if Origin is Blacklisted */}
                  {hop.abuseScore && hop.abuseScore > 50 && !(hop.isTorExitNode || hop.is_tor) && (
                    <div className="mt-2 text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded font-mono font-bold text-center">
                      ABUSE SCORE: {hop.abuseScore}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Hop Detailed Inspector */}
      {activeHop && (
        <div className="bg-[#1a1712] border border-[#3a352c] rounded-lg p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-mono font-bold">
                #{activeHop.hopNumber}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">
                  Hop #{activeHop.hopNumber} Forensics: {activeHop.fromIp}
                </h4>
                <p className="text-xs text-slate-400 font-mono">
                  {activeHop.asn} — {activeHop.org}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(JSON.stringify(activeHop, null, 2))}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded text-xs font-mono flex items-center gap-1.5 cursor-pointer"
              >
                {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText ? 'Copied JSON' : 'Copy Hop Data'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* IP Address */}
            <div className="bg-slate-900/70 p-3.5 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold font-mono">IP Address</div>
              <div className="text-sm font-mono font-bold text-blue-400 mt-1">{activeHop.fromIp}</div>
              <div className="text-[10px] text-slate-400 font-mono mt-1 flex items-center gap-1.5 flex-wrap">
                <span>{activeHop.isOrigin ? 'Origin Envelope Sender' : 'Relay Agent'}</span>
                {(activeHop.isTorExitNode || activeHop.is_tor) && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    TOR EXIT
                  </span>
                )}
              </div>
            </div>

            {/* Reverse DNS */}
            <div className="bg-slate-900/70 p-3.5 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold font-mono">Reverse PTR DNS</div>
              <div className="text-xs font-mono font-medium text-slate-200 mt-1 truncate" title={activeHop.reverseDns}>
                {activeHop.reverseDns || 'No PTR Record'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-1">Forward-Confirmed Check: PASS</div>
            </div>

            {/* ASN & Organization */}
            <div className="bg-slate-900/70 p-3.5 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold font-mono">Autonomous System</div>
              <div className="text-xs font-mono font-bold text-slate-200 mt-1">{activeHop.asn || 'Unknown'}</div>
              <div className="text-[10px] text-slate-400 truncate mt-1">{activeHop.org || 'Unknown'}</div>
            </div>

            {/* Geolocation & Resolution Method */}
            <div className="bg-slate-900/70 p-3.5 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold font-mono">Origin Geolocation</div>
              <div className="text-xs font-mono font-bold text-slate-200 mt-1 truncate">
                {activeHop.city ? `${activeHop.city}, ` : ''}{activeHop.country || 'Unknown'}
              </div>
              <div className="text-[10px] text-blue-400 font-mono mt-1 truncate" title={activeHop.lookupMethod || 'MaxMind GeoLite2 Offline'}>
                {activeHop.lookupMethod || 'MaxMind GeoLite2 Offline'}
              </div>
            </div>

            {/* Abuse / Reputation */}
            <div className="bg-slate-900/70 p-3.5 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold font-mono">Threat Reputation</div>
              <div
                className={`text-sm font-mono font-bold mt-1 ${
                  (activeHop.isTorExitNode || activeHop.is_tor)
                    ? 'text-rose-400'
                    : activeHop.abuseScore && activeHop.abuseScore > 50
                    ? 'text-rose-500'
                    : 'text-emerald-400'
                }`}
              >
                {(activeHop.isTorExitNode || activeHop.is_tor)
                  ? 'Tor Exit Node (High Risk)'
                  : activeHop.abuseScore
                  ? `${activeHop.abuseScore}% Risk Score`
                  : '0% Clean'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-1">
                {(activeHop.isTorExitNode || activeHop.is_tor)
                  ? 'Official Tor Directory'
                  : activeHop.isBlacklisted
                  ? 'Flagged on 3 DNSBLs'
                  : 'No Blacklists'}
              </div>
            </div>
          </div>

          {/* Detailed Hop Header String */}
          <div className="bg-slate-900/90 p-4 rounded-lg border border-slate-800 font-mono text-xs text-slate-300">
            <div className="text-[10px] text-slate-400 uppercase font-semibold mb-2">
              Parsed Received Header String
            </div>
            <code className="text-slate-300 break-all leading-relaxed block">
              Received: from {activeHop.fromHost} ({activeHop.fromIp}) by {activeHop.byHost} with {activeHop.protocol}; {activeHop.timestamp}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}
