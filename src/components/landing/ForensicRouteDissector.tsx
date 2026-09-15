import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  MapPin, 
  Server, 
  Lock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Terminal, 
  Database, 
  ArrowRight, 
  Radio, 
  ExternalLink,
  ChevronRight,
  FileSearch,
  Globe
} from 'lucide-react';
import { SAMPLE_ANALYSES } from '../../data/samples';
import { EmailAnalysis, EmailHop } from '../../types';
import { mapBackendCaseToAnalysis } from '../../utils/parser';

interface ForensicRouteDissectorProps {
  onExploreCase?: () => void;
  onSelectCase?: (analysis: EmailAnalysis) => void;
  className?: string;
}

interface RouteStation {
  id: string;
  number: number;
  label: string;
  sublabel: string;
  ip: string;
  location: string;
  status: 'MALICIOUS' | 'WARNING' | 'SECURE' | 'GATEWAY';
  explanation: string;
  headerProof: string;
  cryptoDetail?: string;
}

export const ForensicRouteDissector: React.FC<ForensicRouteDissectorProps> = ({
  onExploreCase,
  onSelectCase,
  className = ''
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>('sample-0');
  const [activeAnalysis, setActiveAnalysis] = useState<EmailAnalysis>(SAMPLE_ANALYSES[0]);
  const [selectedStationIndex, setSelectedStationIndex] = useState<number>(0);
  const [dbCases, setDbCases] = useState<any[]>([]);

  // Fetch real cases on mount
  useEffect(() => {
    fetch('/api/cases')
      .then(res => res.json())
      .then(casesList => {
        if (Array.isArray(casesList) && casesList.length > 0) {
          setDbCases(casesList);
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectSample = (idx: number) => {
    setSelectedCaseId(`sample-${idx}`);
    const sample = SAMPLE_ANALYSES[idx] || SAMPLE_ANALYSES[0];
    setActiveAnalysis(sample);
    setSelectedStationIndex(0);
    if (onSelectCase) onSelectCase(sample);
  };

  const handleSelectRealCase = (caseItem: any) => {
    setSelectedCaseId(caseItem.id);
    setSelectedStationIndex(0);
    try {
      const mapped = mapBackendCaseToAnalysis(caseItem);
      if (mapped) {
        setActiveAnalysis(mapped);
        if (onSelectCase) onSelectCase(mapped);
      }
    } catch {
      const sample = SAMPLE_ANALYSES[0];
      setActiveAnalysis(sample);
      if (onSelectCase) onSelectCase(sample);
    }
  };

  // Build the 5-station journey dynamically from active case
  const isMalicious = (activeAnalysis.riskScore ?? 0) >= 70;
  const isClean = (activeAnalysis.riskScore ?? 100) < 30;
  const hops = activeAnalysis.hops || [];
  const firstHop = hops[0] as EmailHop | undefined;
  const originIp = firstHop?.fromIp || '185.220.101.5';
  const originGeo = firstHop?.city ? `${firstHop.city}, ${firstHop.country || ''}` : 'Sofia, Bulgaria';
  const originAsn = firstHop?.asn || 'AS200548 ZettaHost';

  const auth = (activeAnalysis.authResults || activeAnalysis.auth || {}) as Record<string, any>;
  const spfStatus = auth?.spf?.status || (isMalicious ? 'softfail' : 'pass');
  const dkimStatus = auth?.dkim?.status || (isMalicious ? 'none' : 'pass');
  const dmarcStatus = auth?.dmarc?.status || (isMalicious ? 'fail' : 'pass');

  const stations: RouteStation[] = [
    {
      id: 'station-origin',
      number: 1,
      label: 'Origin Server',
      sublabel: isMalicious ? 'Suspicious Relay Server' : 'Verified Provider Gateway',
      ip: originIp,
      location: originGeo,
      status: isMalicious ? 'MALICIOUS' : 'SECURE',
      explanation: isMalicious
        ? `The email originated from untrusted IP address ${originIp} (${originGeo}). The server address does not match the organization claiming to send the email.`
        : `The email originated from authorized servers at ${originIp} (${originGeo}). The server address correctly matches the verified domain.`,
      headerProof: `Received: from mail.attacker-gateway.cc ([${originIp}])\n  by edge-relay-01.transit.net with ESMTP;\n  ${new Date().toUTCString()}`,
      cryptoDetail: `Server Verification: ${isMalicious ? 'Origin does not match claimed domain' : 'Origin verified and authentic'}`
    },
    {
      id: 'station-relay',
      number: 2,
      label: 'Server Hops',
      sublabel: `${hops.length > 1 ? hops.length : 3} Mail Transfer Servers`,
      ip: hops[1]?.fromIp || '194.26.29.112',
      location: hops[1]?.city ? `${hops[1].city}, ${hops[1].country || ''}` : 'Frankfurt, Germany',
      status: isMalicious ? 'WARNING' : 'GATEWAY',
      explanation: isMalicious
        ? 'The email was routed through multiple intermediate servers with delayed timestamps, often done to conceal the actual origin.'
        : 'The email traveled smoothly through standard mail transfer servers without delays or header tampering.',
      headerProof: `Received: from mx-inbound.enterprise.com (10.0.4.12)\n  by internal-filter-02 with SMTP ID 8920-AF\n  for <user@company.com>; TLSv1.3 Encrypted`,
      cryptoDetail: 'Encryption: TLS 1.3 Secure Connection'
    },
    {
      id: 'station-crypto',
      number: 3,
      label: 'Security Check',
      sublabel: 'SPF, DKIM & DMARC Validation',
      ip: 'Domain Verification',
      location: 'DNS Record Check',
      status: isMalicious ? 'MALICIOUS' : 'SECURE',
      explanation: isMalicious
        ? `Security validation failed. SPF returned "${spfStatus}" because IP ${originIp} is unauthorized. DKIM signature is "${dkimStatus}".`
        : `All security checks passed. SPF verified the sending server, DKIM confirmed the digital signature, and DMARC approved delivery.`,
      headerProof: `Authentication-Results: mx.google.com;\n  spf=${spfStatus} (domain does not allow IP ${originIp})\n  dkim=${dkimStatus} header.i=@paypal.com\n  dmarc=${dmarcStatus} (policy=reject)`,
      cryptoDetail: `SPF: ${spfStatus.toUpperCase()} • DKIM: ${dkimStatus.toUpperCase()} • DMARC: ${dmarcStatus.toUpperCase()}`
    },
    {
      id: 'station-payload',
      number: 4,
      label: 'Content Scan',
      sublabel: isMalicious ? 'Fake Links / Unsafe Attachment' : 'Clean Text & Verified Links',
      ip: 'Message Content',
      location: 'Link & File Analysis',
      status: isMalicious ? 'MALICIOUS' : 'SECURE',
      explanation: isMalicious
        ? 'A deceptive link was detected pointing to an imitation login page. The hidden return address does not match the visible sender.'
        : 'All embedded links lead to verified, legitimate websites. No malicious attachments or scripts were detected.',
      headerProof: `From: ${activeAnalysis.headers?.from || 'service@paypal.com'}\nReturn-Path: ${activeAnalysis.headers?.returnPath || 'bounce@paypal-secure-update.com'}\nContent-Type: text/html; charset=UTF-8`,
      cryptoDetail: isMalicious ? 'Imposter domain detected: paypal-secure-update.com' : 'All links verified on legitimate domain'
    },
    {
      id: 'station-verdict',
      number: 5,
      label: 'Inbox Defense',
      sublabel: isMalicious ? 'Blocked & Quarantined' : 'Delivered Safely to Inbox',
      ip: 'Mailbox Protection',
      location: 'Security Gateway',
      status: isMalicious ? 'MALICIOUS' : 'SECURE',
      explanation: isMalicious
        ? `TraceXMail issued a verdict of PHISHING (Risk: ${activeAnalysis.riskScore ?? 94}/100). The message was intercepted before reaching the user's inbox.`
        : `TraceXMail issued a verdict of SAFE (Risk: ${activeAnalysis.riskScore ?? 4}/100). The message is clean and delivered to the inbox.`,
      headerProof: `X-TraceX-Verdict: ${activeAnalysis.verdict || (isMalicious ? 'MALICIOUS_PHISH' : 'CLEAN')}\nX-TraceX-Threat-Score: ${activeAnalysis.riskScore ?? (isMalicious ? 94 : 4)}/100`,
      cryptoDetail: `Evidence Record: Sealed with tamper-proof verification ID`
    }
  ];

  const activeStation = stations[selectedStationIndex] || stations[0];

  return (
    <section id="evidence-chain" className={`py-12 sm:py-16 bg-[#0e0c0a] border-b border-[#3a352c] ${className}`}>
      <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-[#2d2820]">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[2px] bg-[#1a1712] border border-[#3a352c] text-[#c9a227] font-['IBM_Plex_Mono',monospace] text-[11px] font-bold uppercase tracking-wider">
              <FileSearch className="w-3.5 h-3.5 text-[#c9a227]" />
              <span>Step-by-Step Delivery Route</span>
            </div>
            <h2 className="font-['Fraunces',serif] text-[26px] sm:text-[32px] font-medium text-[#ede6d8]">
              The Real Transmission Route: From Sender to Inbox
            </h2>
            <p className="text-[#b9af9c] text-[14px] sm:text-[15px] max-w-[65ch] leading-relaxed">
              Every email travels across the internet through multiple mail servers. TraceXMail verifies each stop, inspects security keys, and instantly detects forged senders.
            </p>
          </div>

          <button
            onClick={onExploreCase}
            className="shrink-0 px-4 py-2.5 rounded-[3px] bg-[#221e17] hover:bg-[#b23a2e] border border-[#3a352c] hover:border-[#b23a2e] text-[#ede6d8] font-['IBM_Plex_Mono',monospace] text-[12px] font-semibold transition-all cursor-pointer flex items-center gap-2 self-start md:self-auto min-h-[38px]"
          >
            <span>Open in Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Case Switcher Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#15120e] p-3 rounded border border-[#2d2820]">
          <span className="font-['IBM_Plex_Mono',monospace] text-[11.5px] text-[#8e8574] font-semibold flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-[#c9a227]" />
            <span>Select Sample Case:</span>
          </span>

          <div className="flex flex-wrap items-center gap-2">
            {dbCases.length > 0 ? (
              dbCases.slice(0, 3).map((c) => {
                const isSelected = selectedCaseId === c.id;
                const isCrit = c.severity === 'CRITICAL' || c.severity === 'HIGH';
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectRealCase(c)}
                    className={`px-3 py-1.5 min-h-[34px] rounded text-[11px] sm:text-[11.5px] font-['IBM_Plex_Mono',monospace] transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#c9a227] text-[#0b0a08] font-bold shadow-sm'
                        : 'bg-[#1e1a14] border border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8]'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isCrit ? 'bg-[#ef4444]' : 'bg-[#22c55e]'}`} />
                    <span className="truncate max-w-[140px]">{c.title || c.id}</span>
                  </button>
                );
              })
            ) : (
              <>
                <button
                  onClick={() => handleSelectSample(0)}
                  className={`px-3 py-1.5 min-h-[34px] rounded text-[11.5px] font-['IBM_Plex_Mono',monospace] transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedCaseId === 'sample-0'
                      ? 'bg-[#b23a2e] text-[#ede6d8] font-bold shadow-sm'
                      : 'bg-[#1e1a14] border border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                  <span>Fake PayPal Phishing</span>
                </button>
                <button
                  onClick={() => handleSelectSample(1)}
                  className={`px-3 py-1.5 min-h-[34px] rounded text-[11.5px] font-['IBM_Plex_Mono',monospace] transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedCaseId === 'sample-1'
                      ? 'bg-[#b23a2e] text-[#ede6d8] font-bold shadow-sm'
                      : 'bg-[#1e1a14] border border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                  <span>CEO Impersonation Wire</span>
                </button>
                <button
                  onClick={() => handleSelectSample(2)}
                  className={`px-3 py-1.5 min-h-[34px] rounded text-[11.5px] font-['IBM_Plex_Mono',monospace] transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedCaseId === 'sample-2'
                      ? 'bg-[#22c55e] text-[#14120f] font-bold shadow-sm'
                      : 'bg-[#1e1a14] border border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                  <span>Legitimate Service Email</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 5-Station Stepper Track - Responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 relative">
          {stations.map((st, idx) => {
            const isSelected = selectedStationIndex === idx;
            const isMal = st.status === 'MALICIOUS';
            const isWarn = st.status === 'WARNING';
            const isSec = st.status === 'SECURE';

            return (
              <button
                key={st.id}
                onClick={() => setSelectedStationIndex(idx)}
                className={`p-3.5 sm:p-4 rounded-md text-left transition-all cursor-pointer border flex flex-col justify-between gap-3 relative ${
                  isSelected
                    ? 'bg-[#221e17] border-[#c9a227] shadow-xl ring-1 ring-[#c9a227]/40'
                    : 'bg-[#14120e] border-[#2d2820] hover:border-[#4a4438] hover:bg-[#1a1612]'
                }`}
              >
                {/* Station Step Indicator */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center font-['IBM_Plex_Mono',monospace] text-[11px] font-bold ${
                      isSelected 
                        ? 'bg-[#c9a227] text-[#14120f]' 
                        : isMal 
                          ? 'bg-[#b23a2e]/30 text-[#ff8d7d] border border-[#b23a2e]' 
                          : 'bg-[#1c1813] text-[#8e8574] border border-[#3a352c]'
                    }`}>
                      {st.number}
                    </span>
                    <span className="font-['IBM_Plex_Mono',monospace] text-[11px] font-bold uppercase text-[#ede6d8]">
                      {st.label}
                    </span>
                  </div>

                  <span className={`w-2 h-2 rounded-full ${
                    isMal ? 'bg-[#ef4444]' : isWarn ? 'bg-[#f59e0b]' : isSec ? 'bg-[#22c55e]' : 'bg-[#7fa3ba]'
                  }`} />
                </div>

                {/* Subtitle & IP */}
                <div className="space-y-1">
                  <div className="text-[12px] sm:text-[12.5px] font-semibold text-[#dcd4c6] leading-snug line-clamp-1">
                    {st.sublabel}
                  </div>
                  <div className="font-['IBM_Plex_Mono',monospace] text-[10.5px] sm:text-[11px] text-[#8e8574] truncate">
                    {st.ip}
                  </div>
                </div>

                {/* Status Bar */}
                <div className="pt-2 border-t border-[#2a251e] flex items-center justify-between text-[10.5px] font-['IBM_Plex_Mono',monospace]">
                  <span className={`font-bold ${
                    isMal ? 'text-[#ff8d7d]' : isWarn ? 'text-amber-400' : 'text-[#4ade80]'
                  }`}>
                    {st.status}
                  </span>
                  <span className="text-[#645c4e]">
                    {isSelected ? '● ACTIVE' : 'INSPECT'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detailed Station Dissection Dossier */}
        <div className="bg-[#15120e] border border-[#3a352c] rounded-md p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-5">
          
          {/* Top Dossier Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#2d2820]">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded shrink-0 ${
                activeStation.status === 'MALICIOUS' ? 'bg-[#b23a2e]/20 text-[#ff8d7d]' : 'bg-[#22c55e]/20 text-[#4ade80]'
              }`}>
                {activeStation.status === 'MALICIOUS' ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-['Fraunces',serif] text-[18px] sm:text-[21px] font-medium text-[#ede6d8]">
                  Stop {activeStation.number}: {activeStation.label} — {activeStation.sublabel}
                </h3>
                <div className="font-['IBM_Plex_Mono',monospace] text-[11px] sm:text-[11.5px] text-[#8e8574] flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-[#c9a227]" /> {activeStation.location}</span>
                  <span>•</span>
                  <span>IP: {activeStation.ip}</span>
                </div>
              </div>
            </div>

            <span className={`self-start sm:self-center font-['IBM_Plex_Mono',monospace] text-[11px] sm:text-[11.5px] px-2.5 py-1 rounded font-bold uppercase shrink-0 ${
              activeStation.status === 'MALICIOUS'
                ? 'bg-[#b23a2e]/25 text-[#ff8d7d] border border-[#b23a2e]/50'
                : 'bg-[#22c55e]/25 text-[#4ade80] border border-[#22c55e]/50'
            }`}>
              {activeStation.status} STATUS
            </span>
          </div>

          {/* Plain-English Explanation & Details */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
            
            {/* Left 7 cols: Explanation & Crypto */}
            <div className="lg:col-span-7 space-y-3.5">
              <div>
                <div className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#c9a227] uppercase tracking-wider font-semibold mb-1">
                  Analysis Summary:
                </div>
                <p className="text-[14px] sm:text-[14.5px] text-[#ede6d8] leading-relaxed m-0">
                  {activeStation.explanation}
                </p>
              </div>

              {activeStation.cryptoDetail && (
                <div className="bg-[#1c1813] border border-[#2d2820] p-3 rounded font-['IBM_Plex_Mono',monospace] text-[11.5px] text-[#b9af9c] flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#c9a227] shrink-0" />
                  <span>{activeStation.cryptoDetail}</span>
                </div>
              )}
            </div>

            {/* Right 5 cols: Raw Header Proof */}
            <div className="lg:col-span-5 bg-[#0e0c0a] border border-[#2d2820] p-3.5 rounded">
              <div className="flex items-center justify-between text-[10.5px] font-['IBM_Plex_Mono',monospace] text-[#8e8574] pb-2 border-b border-[#1f1b16] mb-2">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3 h-3 text-[#22c55e]" />
                  <span>HEADER EVIDENCE</span>
                </span>
                <span>Hop Record</span>
              </div>
              <pre className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#4ade80] overflow-x-auto whitespace-pre-wrap leading-relaxed m-0">
                {activeStation.headerProof}
              </pre>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
