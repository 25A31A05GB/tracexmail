import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  MapPin, 
  Navigation, 
  ArrowRight, 
  ShieldCheck, 
  ShieldAlert, 
  Activity, 
  Database, 
  Server, 
  Clock, 
  Play, 
  Pause, 
  RotateCcw, 
  ExternalLink, 
  Check, 
  Copy, 
  Search, 
  Layers, 
  Sparkles, 
  AlertTriangle,
  Info,
  Maximize2,
  Lock,
  UserCheck,
  Cpu,
  Fingerprint,
  Radio,
  FileText
} from 'lucide-react';
import { EmailHop, RealSenderIpInfo } from '../types';
import { lookupMaxMindGeo, MAXMIND_COPYRIGHT, MAXMIND_LICENSE, MaxMindGeoResolution } from '../utils/maxmindService';

interface GeoTracerUtilityProps {
  hops: EmailHop[];
  originHop?: any;
  realSenderIp?: RealSenderIpInfo;
  className?: string;
}

// Earth radius in km for Haversine distance
function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function GeoTracerUtility({ hops = [], originHop, realSenderIp, className = '' }: GeoTracerUtilityProps) {
  // Active selected hop index (defaults to 0)
  const [activeHopIndex, setActiveHopIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Live MaxMind IP Lookup Sandbox
  const [sandboxIp, setSandboxIp] = useState<string>('');
  const [sandboxResult, setSandboxResult] = useState<MaxMindGeoResolution | null>(null);
  const [isSandboxSearching, setIsSandboxSearching] = useState<boolean>(false);

  // Normalize hops with MaxMind resolution fallback
  const enrichedHops = hops.map((hop, idx) => {
    const rawIp = hop.fromIp || '';
    const maxmindGeo = rawIp ? lookupMaxMindGeo(rawIp) : null;
    
    // Effective values prioritizing backend enriched properties then client-side MaxMind
    const effectiveLat = typeof hop.lat === 'number' ? hop.lat : maxmindGeo?.lat;
    const effectiveLng = typeof hop.lng === 'number' ? hop.lng : maxmindGeo?.lng;
    const effectiveCity = hop.city || maxmindGeo?.city || (hop.isPrivate ? 'Internal Subnet' : 'Unmapped City');
    const effectiveCountry = hop.country || maxmindGeo?.country || (hop.isPrivate ? 'RFC 1918 Private Network' : 'Unmapped Country');
    const effectiveCountryCode = hop.countryCode || maxmindGeo?.countryCode || (hop.isPrivate ? 'LAN' : 'UN');
    const effectiveAsn = hop.asn || maxmindGeo?.asn || (hop.isPrivate ? 'RFC 1918' : 'N/A');
    const effectiveOrg = hop.org || hop.isp || maxmindGeo?.org || maxmindGeo?.isp || (hop.isPrivate ? 'Corporate Intranet Segment' : 'Unknown Provider');

    const isTor = Boolean(hop.is_tor || hop.isTorExitNode || maxmindGeo?.isTor);
    const isVpn = Boolean(hop.is_vpn || hop.isProxyOrVpn || maxmindGeo?.isAnonymousProxy) && !isTor;
    const isCloud = Boolean(hop.is_cloud || hop.infra === 'hosting');

    return {
      ...hop,
      hopNumber: hop.hopNumber || idx + 1,
      lat: effectiveLat,
      lng: effectiveLng,
      city: effectiveCity,
      country: effectiveCountry,
      countryCode: effectiveCountryCode,
      asn: effectiveAsn,
      org: effectiveOrg,
      is_tor: isTor,
      is_vpn: isVpn,
      is_cloud: isCloud,
      geonameId: hop.geonameId || maxmindGeo?.geonameId,
      timeZone: hop.timeZone || maxmindGeo?.timeZone,
      accuracyRadius: hop.accuracyRadius || maxmindGeo?.accuracyRadius || 25,
      maxmindVerified: true
    };
  });

  // Calculate cumulative route distance
  let totalRouteDistanceKm = 0;
  for (let i = 1; i < enrichedHops.length; i++) {
    const prev = enrichedHops[i - 1];
    const curr = enrichedHops[i];
    if (
      typeof prev.lat === 'number' &&
      typeof prev.lng === 'number' &&
      typeof curr.lat === 'number' &&
      typeof curr.lng === 'number'
    ) {
      totalRouteDistanceKm += calculateHaversineKm(prev.lat, prev.lng, curr.lat, curr.lng);
    }
  }

  // Calculate cumulative transmission latency (seconds)
  const totalTransmissionDelaySec = enrichedHops.reduce((sum, h) => sum + (h.delaySec || 0), 0);

  // Internal vs External Hop Counts
  const internalHopCount = enrichedHops.filter(h => h.isPrivate || h.hopType === 'internal').length;
  const externalHopCount = enrichedHops.filter(h => !h.isPrivate && h.hopType !== 'internal').length;

  // Auto-play / Simulation loop
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && enrichedHops.length > 1) {
      timer = setInterval(() => {
        setActiveHopIndex((prev) => (prev + 1) % enrichedHops.length);
      }, 2200);
    }
    return () => clearInterval(timer);
  }, [isPlaying, enrichedHops.length]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleSandboxLookup = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!sandboxIp.trim()) return;
    setIsSandboxSearching(true);
    try {
      const res = lookupMaxMindGeo(sandboxIp.trim());
      setSandboxResult(res);
    } finally {
      setIsSandboxSearching(false);
    }
  };

  const activeHop = enrichedHops[activeHopIndex] || enrichedHops[0];

  return (
    <div id="geo-tracer-utility" className={`bg-[#181511] border border-[#3a352c] rounded-xl overflow-hidden shadow-xl ${className}`}>
      {/* Utility Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-[#211c15] via-[#1c1812] to-[#16130f] border-b border-[#3a352c] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
            <Navigation className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Geo-Tracer</span>
                <span className="text-slate-500 font-normal">|</span>
                <span className="text-sm font-medium text-slate-300">Origin Client & Relay Telemetry</span>
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                <Database className="w-3 h-3 text-blue-400" />
                MAXMIND GEOLITE2 API
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Demarcates real human sender client IP vs intermediate MTA mail relays, evaluating physical location and boundary traversal.
            </p>
          </div>
        </div>

        {/* Global Route Metrics Pills */}
        <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">Total Hops:</span>
            <span className="font-bold text-white">{enrichedHops.length}</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-cyan-800/60 text-cyan-300 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Internal:</span>
            <span className="font-bold text-cyan-300">{internalHopCount}</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-blue-800/60 text-blue-300 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">External:</span>
            <span className="font-bold text-blue-300">{externalHopCount}</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Total Distance:</span>
            <span className="font-bold text-emerald-300">{totalRouteDistanceKm.toLocaleString()} km</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Transit Delay:</span>
            <span className="font-bold text-amber-300">{totalTransmissionDelaySec.toFixed(1)}s</span>
          </div>
        </div>
      </div>

      {/* Origin Demarcation Hero Panel (Real Sender Client vs Mail Server) */}
      <div className="p-4 sm:p-5 bg-gradient-to-b from-[#1b1712] to-[#15120e] border-b border-[#3a352c]/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${realSenderIp?.resolved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
              <Fingerprint className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 flex-wrap">
                <span>Sender Client Demarcation</span>
                {realSenderIp?.resolved ? (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    AUTHENTICATED SENDER IP RECOVERED
                  </span>
                ) : realSenderIp?.privacyMaskingActive ? (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    WEBMAIL PRIVACY SHIELD ACTIVE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                    DIRECT SMTP RELAY EGRESS
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {realSenderIp?.resolved
                  ? `True originating client IP disclosed via ${realSenderIp.ipSource}.`
                  : realSenderIp?.privacyMaskingActive
                  ? realSenderIp.privacyProviderNotice
                  : 'No client device IP disclosed in headers; tracing begins at outbound network gateway.'}
              </p>
            </div>
          </div>

          {/* Client Software / User-Agent if detected */}
          {realSenderIp?.clientSoftware && (
            <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-2 self-start lg:self-auto">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-400">Mailer:</span>
              <span className="font-bold text-white truncate max-w-[200px]">{realSenderIp.clientSoftware}</span>
            </div>
          )}
        </div>

        {/* Real Sender IP Attributes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 font-mono text-xs">
          {/* IP Card */}
          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] uppercase text-slate-400 font-bold">Client IP Address</div>
            <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
              <span>{realSenderIp?.ip || enrichedHops[0]?.fromIp || 'Unresolved'}</span>
              {(realSenderIp?.ip || enrichedHops[0]?.fromIp) && (
                <button
                  type="button"
                  onClick={() => handleCopy(realSenderIp?.ip || enrichedHops[0]?.fromIp || '')}
                  className="text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                  title="Copy IP"
                >
                  {copiedText === (realSenderIp?.ip || enrichedHops[0]?.fromIp) ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5">
              {realSenderIp?.reverseDns || enrichedHops[0]?.reverseDns || 'No PTR Record'}
            </div>
          </div>

          {/* Physical Location */}
          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] uppercase text-slate-400 font-bold">Physical Location</div>
            <div className="text-sm font-bold text-rose-400 mt-1 flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>
                {realSenderIp?.city || enrichedHops[0]?.city || 'Unmapped City'}, {realSenderIp?.country || enrichedHops[0]?.country || 'Unknown'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {realSenderIp?.countryCode || enrichedHops[0]?.countryCode || 'UN'} • MaxMind Verified
            </div>
          </div>

          {/* Coordinates */}
          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] uppercase text-slate-400 font-bold">GPS Coordinates</div>
            <div className="text-sm font-bold text-cyan-400 mt-1 truncate">
              {typeof (realSenderIp?.lat ?? enrichedHops[0]?.lat) === 'number' &&
              typeof (realSenderIp?.lng ?? enrichedHops[0]?.lng) === 'number'
                ? `${(realSenderIp?.lat ?? enrichedHops[0]?.lat)!.toFixed(4)}°, ${(realSenderIp?.lng ?? enrichedHops[0]?.lng)!.toFixed(4)}°`
                : 'Private Subnet (No Public GPS)'}
            </div>
            {typeof (realSenderIp?.lat ?? enrichedHops[0]?.lat) === 'number' && (
              <a
                href={`https://www.google.com/maps?q=${realSenderIp?.lat ?? enrichedHops[0]?.lat},${realSenderIp?.lng ?? enrichedHops[0]?.lng}&z=10`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-blue-400 hover:underline flex items-center gap-1 mt-0.5 font-sans"
              >
                <span>View on Maps</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>

          {/* Carrier / Telecom ISP */}
          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] uppercase text-slate-400 font-bold">Telecom Carrier / ASN</div>
            <div className="text-sm font-bold text-slate-200 mt-1 truncate">
              {realSenderIp?.asn || enrichedHops[0]?.asn || 'AS Unknown'}
            </div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5">
              {realSenderIp?.org || enrichedHops[0]?.org || 'Unmapped Organization'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* Playback Simulation Toolbar & Stepper */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-950/70 border border-slate-800/80">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isPlaying 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isPlaying ? 'Pause Simulation' : 'Simulate Transmission Flow'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setActiveHopIndex(0);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-mono cursor-pointer transition-colors"
              title="Reset to Origin Hop"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Hop Stepper Navigation */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {enrichedHops.map((h, i) => {
              const isSelected = i === activeHopIndex;
              const isOrigin = i === 0 || h.isOrigin;
              const isLast = i === enrichedHops.length - 1;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setActiveHopIndex(i);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? isOrigin
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-900/40 ring-1 ring-rose-400'
                        : isLast
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40 ring-1 ring-emerald-400'
                        : 'bg-blue-600 text-white shadow-md shadow-blue-900/40 ring-1 ring-blue-400'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <span>#{h.hopNumber}</span>
                  <span className="text-[10px] opacity-80">
                    {isOrigin ? 'Origin' : isLast ? 'Ingress' : 'Relay'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Visual Hop Path Vector Graph */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Sequential Transmission Cards (Hop by Hop) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Chronological Transmission Relays</span>
              <span className="text-[11px] text-blue-400 font-normal">Click hop to inspect MaxMind record</span>
            </div>

            <div className="space-y-3">
              {enrichedHops.map((h, idx) => {
                const isSelected = idx === activeHopIndex;
                const isOrigin = idx === 0 || h.isOrigin;
                const isLast = idx === enrichedHops.length - 1;
                const prevHop = idx > 0 ? enrichedHops[idx - 1] : null;

                // Hop-to-hop distance
                let hopDistanceKm: number | null = null;
                if (
                  prevHop &&
                  typeof prevHop.lat === 'number' &&
                  typeof prevHop.lng === 'number' &&
                  typeof h.lat === 'number' &&
                  typeof h.lng === 'number'
                ) {
                  hopDistanceKm = calculateHaversineKm(prevHop.lat, prevHop.lng, h.lat, h.lng);
                }

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setIsPlaying(false);
                      setActiveHopIndex(idx);
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900/95 border-blue-500 shadow-lg shadow-blue-950/30 ring-1 ring-blue-500/50'
                        : 'bg-slate-950/60 hover:bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-2 mb-2 font-mono">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isOrigin
                              ? 'bg-rose-500 text-white'
                              : isLast
                              ? 'bg-emerald-500 text-white'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {h.hopNumber}
                        </span>

                        <span className="font-bold text-white text-xs">{h.fromIp || 'Private Gateway'}</span>

                        {/* Internal vs External Badge */}
                        {h.isPrivate || h.hopType === 'internal' ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-950/70 border border-cyan-700/60 text-cyan-300 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            INTERNAL (LAN)
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-950/70 border border-blue-700/60 text-blue-300 flex items-center gap-1">
                            <Globe className="w-2.5 h-2.5" />
                            EXTERNAL (PUBLIC)
                          </span>
                        )}

                        {/* Hop Role Badge */}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            h.hopRole === 'EXTERNAL_ORIGIN' || h.isPublicGateway
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : isOrigin
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : isLast
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {h.hopRole === 'EXTERNAL_ORIGIN' || h.isPublicGateway
                            ? '⚡ Trust Boundary Origin'
                            : isOrigin
                            ? 'Root Origin Sender'
                            : isLast
                            ? 'Enterprise Ingress MX'
                            : 'Intermediate Transit Relay'}
                        </span>

                        {h.is_tor && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            🧅 TOR
                          </span>
                        )}
                        {h.is_vpn && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            🛡️ VPN
                          </span>
                        )}
                        {h.is_cloud && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            ☁️ CLOUD
                          </span>
                        )}
                      </div>

                      {/* Hop Latency Delay */}
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>+{h.delaySec ?? 0}s delay</span>
                      </div>
                    </div>

                    {/* Geolocation & Network Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono pt-1">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span className="truncate">
                          {h.city ? `${h.city}, ` : ''}{h.country} ({h.countryCode})
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Server className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="truncate">{h.asn} • {h.org}</span>
                      </div>
                    </div>

                    {/* Transfer Vector & Distance to Next Hop */}
                    {hopDistanceKm !== null && (
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <ArrowRight className="w-3 h-3" />
                          <span>Transit Vector: {hopDistanceKm.toLocaleString()} km from previous hop</span>
                        </div>
                        {hopDistanceKm > 3000 && (h.delaySec ?? 0) < 1 && (
                          <span className="text-amber-400 flex items-center gap-1 text-[10px]">
                            <AlertTriangle className="w-3 h-3" />
                            Fast Long-Distance Transit
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Selected Hop MaxMind Inspection Card & Mini-Map Vector */}
          <div className="lg:col-span-5 space-y-4">
            <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>MaxMind GeoLite2 Live Inspection</span>
              <span className="text-[11px] text-emerald-400">Hop #{activeHop.hopNumber}</span>
            </div>

            {/* Tactical Hop Dossier */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3.5 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>{activeHop.fromIp}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(activeHop.fromIp || '')}
                        className="text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                        title="Copy IP"
                      >
                        {copiedText === activeHop.fromIp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-400 font-sans">{activeHop.reverseDns || 'No PTR Record'}</div>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                  {activeHop.countryCode}
                </span>
              </div>

              {/* MaxMind Attributes Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2 rounded bg-slate-950/70 border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase">City & Subdivision</div>
                  <div className="text-white font-bold truncate mt-0.5">{activeHop.city || 'Unresolved'}</div>
                </div>

                <div className="p-2 rounded bg-slate-950/70 border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase">Country & Continent</div>
                  <div className="text-white font-bold truncate mt-0.5">{activeHop.country}</div>
                </div>

                <div className="p-2 rounded bg-slate-950/70 border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase">Coordinates</div>
                  <div className="text-cyan-400 font-bold mt-0.5">
                    {typeof activeHop.lat === 'number' && typeof activeHop.lng === 'number'
                      ? `${activeHop.lat.toFixed(4)}°, ${activeHop.lng.toFixed(4)}°`
                      : 'Non-Routable LAN'}
                  </div>
                </div>

                <div className="p-2 rounded bg-slate-950/70 border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase">Accuracy Radius</div>
                  <div className="text-slate-300 font-bold mt-0.5">{activeHop.accuracyRadius || 25} km</div>
                </div>

                <div className="p-2 rounded bg-slate-950/70 border border-slate-800/80 col-span-2">
                  <div className="text-[10px] text-slate-500 uppercase">Autonomous System & Provider</div>
                  <div className="text-white font-bold truncate mt-0.5">{activeHop.asn} • {activeHop.org}</div>
                </div>

                <div className="p-2 rounded bg-slate-950/70 border border-slate-800/80 col-span-2 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Routing Scope & Boundary</div>
                    <div className="text-white font-bold mt-0.5">
                      {activeHop.isPrivate || activeHop.hopType === 'internal'
                        ? 'Internal Enterprise Intranet (RFC 1918)'
                        : 'Public Routable Internet (BGP Autonomous System)'}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    activeHop.isPrivate || activeHop.hopType === 'internal'
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                      : 'bg-blue-950 text-blue-300 border border-blue-800'
                  }`}>
                    {activeHop.isPrivate || activeHop.hopType === 'internal' ? 'LAN SCOPE' : 'WAN SCOPE'}
                  </span>
                </div>
              </div>

              {/* Direct Google Maps Geolocation Link */}
              {typeof activeHop.lat === 'number' && typeof activeHop.lng === 'number' && (
                <div className="pt-2">
                  <a
                    href={`https://www.google.com/maps?q=${activeHop.lat},${activeHop.lng}&z=10`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white border border-slate-700 flex items-center justify-center gap-1.5 transition-colors text-xs font-semibold"
                  >
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    <span>View Coordinates on Google Maps</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                </div>
              )}

              {/* MaxMind Attribution */}
              <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 space-y-0.5">
                <div>{MAXMIND_COPYRIGHT}</div>
                <div className="truncate">{MAXMIND_LICENSE}</div>
              </div>
            </div>

            {/* Custom IP MaxMind Sandbox Tester */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-white">Live MaxMind IP Sandbox</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Verify any arbitrary IP against the MaxMind GeoLite2 engine on-demand:
              </p>

              <form onSubmit={handleSandboxLookup} className="flex gap-2 font-mono text-xs">
                <input
                  type="text"
                  value={sandboxIp}
                  onChange={(e) => setSandboxIp(e.target.value)}
                  placeholder="e.g. 185.220.101.5 or 8.8.8.8"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={isSandboxSearching}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer transition-colors"
                >
                  Lookup
                </button>
              </form>

              {sandboxResult && (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between text-white font-bold">
                    <span>{sandboxResult.city || 'Unmapped City'}, {sandboxResult.country || 'Unknown'}</span>
                    <span className="text-[10px] text-slate-400">{sandboxResult.countryCode}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {sandboxResult.asn ? `${sandboxResult.asn} • ${sandboxResult.org}` : 'Non-routable IP'}
                  </div>
                  {typeof sandboxResult.lat === 'number' && (
                    <div className="text-[11px] text-cyan-400">
                      Coordinates: {sandboxResult.lat.toFixed(4)}°, {sandboxResult.lng?.toFixed(4)}°
                    </div>
                  )}
                  {sandboxResult.isTor && (
                    <div className="text-[10px] text-rose-400 font-bold">⚠️ Confirmed Tor Exit Node</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
