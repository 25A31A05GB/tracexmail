import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  MapPin, 
  Server, 
  Lock, 
  Fingerprint, 
  ExternalLink,
  ArrowRight,
  FileSearch,
  CheckCircle2,
  XCircle,
  Hash
} from 'lucide-react';
import { SAMPLE_ANALYSES } from '../../data/samples';
import { EmailAnalysis } from '../../types';

interface ForensicEvidenceDossierProps {
  onExploreCase?: (index: number) => void;
  className?: string;
}

export const ForensicEvidenceDossier: React.FC<ForensicEvidenceDossierProps> = ({
  onExploreCase,
  className = ''
}) => {
  const [activeCaseIndex, setActiveCaseIndex] = useState<number>(0);
  const currentCase = SAMPLE_ANALYSES[activeCaseIndex] || SAMPLE_ANALYSES[0];

  const cases = [
    {
      id: 'nazario-01',
      index: 0,
      label: 'PayPal Phish (Tor)',
      caseNo: 'XM-2291',
      severity: 'CRITICAL',
      score: 94,
      originIp: '185.220.101.5',
      originGeo: 'Sofia, Bulgaria (Tor Exit Node)',
      originAsn: 'AS200548 ZettaHost',
      spfStatus: 'softfail',
      dkimStatus: 'none',
      dmarcStatus: 'fail (p=reject)',
      fromHeader: 'PayPal Security <service@paypal.com>',
      actualSender: 'bounce@paypal-security-update.com',
      findingTitle: 'Typosquat Domain & Identity Masquerade',
      findingSummary: 'Header from-address was spoofed. Inbound SMTP connection originated from a known Tor relay.',
      evidenceHash: 'sha256:88f2b7a1e0...c814b9',
      verdictText: 'PHISHING CONFIRMED'
    },
    {
      id: 'bec-02',
      index: 1,
      label: 'CEO BEC Fraud',
      caseNo: 'XM-2288',
      severity: 'CRITICAL',
      score: 96,
      originIp: '194.26.29.112',
      originGeo: 'Chisinau, Moldova (Bulletproof)',
      originAsn: 'AS57523 AlexHost',
      spfStatus: 'softfail',
      dkimStatus: 'invalid rsa',
      dmarcStatus: 'fail (p=quarantine)',
      fromHeader: 'Richard Vance <ceo@vance-holdings.com>',
      actualSender: 'exec@vance-holdings-portal.cc',
      findingTitle: 'Executive Impersonation & Trojan Payload',
      findingSummary: 'Double-extension attachment (WIRE_INVOICE.PDF.EXE) harboring AsyncRAT binary executable.',
      evidenceHash: 'sha256:4e9e1f28b3...7f21a4',
      verdictText: 'MALWARE / BEC ATTACK'
    },
    {
      id: 'github-03',
      index: 2,
      label: 'GitHub Valid Notice',
      caseNo: 'XM-2281',
      severity: 'CLEAN',
      score: 4,
      originIp: '192.30.252.204',
      originGeo: 'San Francisco, US (GitHub MX)',
      originAsn: 'AS36459 GitHub CIDR',
      spfStatus: 'pass',
      dkimStatus: 'pass (2048-bit)',
      dmarcStatus: 'pass (aligned)',
      fromHeader: 'GitHub <support@github.com>',
      actualSender: 'support@github.com',
      findingTitle: 'Cryptographic Identity Confirmed',
      findingSummary: 'Legitimate personal access token alert. Verified with authentic 2048-bit RSA signature.',
      evidenceHash: 'sha256:1a9f02c4b8...e88102',
      verdictText: 'AUTHENTIC MAIL'
    }
  ];

  const activeDossier = cases[activeCaseIndex] || cases[0];
  const isMalicious = activeDossier.score >= 70;

  const handleSelectCase = (idx: number) => {
    setActiveCaseIndex(idx);
  };

  const handleOpenConsole = () => {
    if (onExploreCase) {
      onExploreCase(activeCaseIndex);
    }
  };

  return (
    <div className={`w-full rounded-md border border-[#3a352c] bg-[#16130f] shadow-2xl overflow-hidden ${className}`}>
      
      {/* Dossier Header Bar */}
      <div className="bg-[#1b1712] border-b border-[#3a352c] p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#b23a2e] shrink-0 animate-pulse" />
          <div className="font-['IBM_Plex_Mono',monospace] text-[12px] text-[#ede6d8] font-bold tracking-wide">
            FORENSIC DOSSIER // CASE-{activeDossier.caseNo}
          </div>
          <span className="text-[#645c4e] hidden sm:inline">•</span>
          <span className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#8e8574] hidden sm:inline">
            EVIDENCE CHAIN
          </span>
        </div>

        {/* Severity Badge & Threat Meter */}
        <div className="flex items-center gap-2">
          <span className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#8e8574]">
            THREAT:
          </span>
          <span
            className={`font-['IBM_Plex_Mono',monospace] text-[11.5px] px-2.5 py-0.5 rounded font-bold ${
              isMalicious
                ? 'bg-[#b23a2e]/20 text-[#ff8d7d] border border-[#b23a2e]/40'
                : 'bg-[#22c55e]/20 text-[#4ade80] border border-[#22c55e]/40'
            }`}
          >
            {activeDossier.score}/100 {activeDossier.severity}
          </span>
        </div>
      </div>

      {/* Case Presets Quick Selector */}
      <div className="bg-[#13110d] px-3.5 py-2 border-b border-[#2d2820] flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        <span className="font-['IBM_Plex_Mono',monospace] text-[10.5px] text-[#8e8574] shrink-0 uppercase tracking-wider">
          Inspect Case:
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {cases.map((c, idx) => (
            <button
              key={c.id}
              onClick={() => handleSelectCase(idx)}
              className={`px-2.5 py-1 rounded text-[11px] font-['IBM_Plex_Mono',monospace] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCaseIndex === idx
                  ? 'bg-[#b23a2e] text-[#ede6d8] font-bold shadow-sm'
                  : 'bg-[#1c1813] text-[#b9af9c] hover:text-[#ede6d8] border border-[#3a352c]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${c.score > 50 ? 'bg-[#ff8d7d]' : 'bg-[#4ade80]'}`} />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Evidence Grid - Clean, non-overlapping cards */}
      <div className="p-4 sm:p-5 space-y-3.5">
        
        {/* Row 1: Origin Telemetry & Cryptographic Gate */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          
          {/* Card 1: Origin Hop */}
          <div 
            onClick={handleOpenConsole}
            className="p-3.5 rounded bg-[#1c1813] border border-[#342e25] hover:border-[#b9af9c] transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-[11px] font-['IBM_Plex_Mono',monospace] text-[#8e8574] mb-1.5">
              <span className="flex items-center gap-1.5 font-bold text-[#ede6d8]">
                <MapPin className="w-3.5 h-3.5 text-[#b23a2e]" />
                <span>HOP 1 // UNTRUSTED ORIGIN</span>
              </span>
              <span className="text-[#b23a2e] font-bold">ANOMALOUS</span>
            </div>
            <div className="font-['IBM_Plex_Mono',monospace] text-[13px] font-semibold text-[#ede6d8] group-hover:text-[#ff8d7d] transition-colors">
              {activeDossier.originIp}
            </div>
            <div className="text-[12px] text-[#b9af9c] mt-0.5 leading-snug">
              {activeDossier.originGeo}
            </div>
            <div className="font-['IBM_Plex_Mono',monospace] text-[10.5px] text-[#7a7162] mt-1.5 pt-1.5 border-t border-[#2d2820]">
              {activeDossier.originAsn}
            </div>
          </div>

          {/* Card 2: Cryptographic Authentication Gate */}
          <div 
            onClick={handleOpenConsole}
            className="p-3.5 rounded bg-[#1c1813] border border-[#342e25] hover:border-[#b9af9c] transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-[11px] font-['IBM_Plex_Mono',monospace] text-[#8e8574] mb-1.5">
              <span className="flex items-center gap-1.5 font-bold text-[#ede6d8]">
                <Lock className="w-3.5 h-3.5 text-[#c9a227]" />
                <span>AUTHENTICATION GATE</span>
              </span>
              <span className={`font-bold ${isMalicious ? 'text-[#ff8d7d]' : 'text-[#4ade80]'}`}>
                {isMalicious ? 'FAILED' : 'VERIFIED'}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-1.5 text-center mt-2 font-['IBM_Plex_Mono',monospace] text-[10.5px]">
              <div className="p-1.5 rounded bg-[#14110d] border border-[#2d2820]">
                <div className="text-[#8e8574] text-[9.5px]">SPF</div>
                <div className={`font-bold uppercase ${activeDossier.spfStatus === 'pass' ? 'text-[#4ade80]' : 'text-[#ff8d7d]'}`}>
                  {activeDossier.spfStatus}
                </div>
              </div>

              <div className="p-1.5 rounded bg-[#14110d] border border-[#2d2820]">
                <div className="text-[#8e8574] text-[9.5px]">DKIM</div>
                <div className={`font-bold uppercase ${activeDossier.dkimStatus.includes('pass') ? 'text-[#4ade80]' : 'text-[#ff8d7d]'}`}>
                  {activeDossier.dkimStatus.split(' ')[0]}
                </div>
              </div>

              <div className="p-1.5 rounded bg-[#14110d] border border-[#2d2820]">
                <div className="text-[#8e8574] text-[9.5px]">DMARC</div>
                <div className={`font-bold uppercase ${activeDossier.dmarcStatus.includes('pass') ? 'text-[#4ade80]' : 'text-[#ff8d7d]'}`}>
                  {activeDossier.dmarcStatus.split(' ')[0]}
                </div>
              </div>
            </div>
            
            <div className="text-[11px] text-[#8e8574] mt-2 truncate">
              Policy: {activeDossier.dmarcStatus}
            </div>
          </div>

        </div>

        {/* Row 2: Identity Masquerade & Payload Analysis */}
        <div className="p-3.5 rounded bg-[#1c1813] border border-[#342e25] space-y-2">
          <div className="flex items-center justify-between text-[11px] font-['IBM_Plex_Mono',monospace]">
            <span className="text-[#c9a227] font-semibold flex items-center gap-1">
              <Fingerprint className="w-3.5 h-3.5" />
              <span>{activeDossier.findingTitle}</span>
            </span>
            <span className="text-[#8e8574]">RFC5322 Inconsistency</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px] font-['IBM_Plex_Mono',monospace] bg-[#14110d] p-2.5 rounded border border-[#2d2820]">
            <div>
              <div className="text-[#8e8574] text-[10px] uppercase">Header From:</div>
              <div className="text-[#ede6d8] truncate font-medium">{activeDossier.fromHeader}</div>
            </div>
            <div>
              <div className="text-[#8e8574] text-[10px] uppercase">Actual Envelope Return-Path:</div>
              <div className={`truncate font-medium ${isMalicious ? 'text-[#ff8d7d]' : 'text-[#4ade80]'}`}>
                {activeDossier.actualSender}
              </div>
            </div>
          </div>

          <p className="text-[12.5px] text-[#b9af9c] leading-relaxed m-0 pt-1">
            {activeDossier.findingSummary}
          </p>
        </div>

        {/* Row 3: Official Forensic Seal & Action Footer */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#2d2820]">
          
          <div className="flex items-center gap-2 text-[11px] font-['IBM_Plex_Mono',monospace] text-[#8e8574]">
            <Hash className="w-3.5 h-3.5 text-[#c9a227]" />
            <span className="truncate max-w-[200px]">{activeDossier.evidenceHash}</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <div className={`px-2.5 py-1 rounded-[2px] font-['IBM_Plex_Mono',monospace] text-[11px] font-bold tracking-wider uppercase flex items-center gap-1.5 ${
              isMalicious
                ? 'bg-[#b23a2e]/25 text-[#ff8d7d] border border-[#b23a2e]/60'
                : 'bg-[#22c55e]/25 text-[#4ade80] border border-[#22c55e]/60'
            }`}>
              {isMalicious ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{activeDossier.verdictText}</span>
            </div>

            <button
              onClick={handleOpenConsole}
              className="px-3 py-1.5 rounded-[3px] bg-[#ede6d8] hover:bg-white text-[#14120f] text-[11.5px] font-['IBM_Plex_Mono',monospace] font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow"
            >
              <span>Inspect Raw RFC822</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
