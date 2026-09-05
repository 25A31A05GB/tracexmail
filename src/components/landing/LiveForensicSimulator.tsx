import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  MapPin, 
  Server, 
  ArrowRight, 
  Cpu, 
  Lock, 
  Zap, 
  Activity, 
  FileCode, 
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Eye,
  CornerDownRight,
  Terminal
} from 'lucide-react';
import { EmailAnalysis } from '../../types';

interface LiveForensicSimulatorProps {
  onOpenTrace?: () => void;
  onOpenConsole?: () => void;
  onSelectCase?: (analysis: EmailAnalysis) => void;
}

interface Scenario {
  id: string;
  name: string;
  category: string;
  tag: string;
  threatLevel: 'CRITICAL' | 'SUSPICIOUS' | 'SAFE' | 'CAUTION';
  threatScore: number;
  subject: string;
  fakeSender: string;
  realSender: string;
  originLocation: string;
  originIp: string;
  asn: string;
  spf: 'FAIL' | 'PASS' | 'SOFTFAIL' | 'NONE';
  dkim: 'FAIL' | 'PASS' | 'NONE';
  dmarc: 'FAIL' | 'PASS';
  hops: Array<{
    hopNum: number;
    server: string;
    ip: string;
    location: string;
    delay: string;
    isSuspect: boolean;
    type: string;
  }>;
  forensicFinding: string;
  rawHeaderSnippet: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'SCENARIO-1',
    name: 'Executive Wire Fraud',
    category: 'CEO Spoofing (BEC)',
    tag: 'HIGH IMPACT WIRE FRAUD',
    threatLevel: 'CRITICAL',
    threatScore: 96,
    subject: 'URGENT: Confidential Wire Transfer - Acquisition Escrow',
    fakeSender: 'ceo@yourcompany.com (CEO Direct)',
    realSender: 'attacker-box@bulletproof-relay.bg',
    originLocation: 'Sofia, Bulgaria',
    originIp: '185.220.101.42',
    asn: 'AS200548 (Offshore VPS Relay)',
    spf: 'FAIL',
    dkim: 'FAIL',
    dmarc: 'FAIL',
    hops: [
      { hopNum: 1, server: 'origin-vps.evil-cloud.bg', ip: '185.220.101.42', location: 'Sofia, BG', delay: '0.0s', isSuspect: true, type: 'Origin Injector' },
      { hopNum: 2, server: 'relay-node04.anonymizer.is', ip: '194.156.98.12', location: 'Reykjavik, IS', delay: '+1.4s', isSuspect: true, type: 'VPN Proxy' },
      { hopNum: 3, server: 'mail-out.shared-gateway.net', ip: '84.17.44.19', location: 'Frankfurt, DE', delay: '+0.8s', isSuspect: false, type: 'MTA Gateway' },
      { hopNum: 4, server: 'mx.yourcompany.com', ip: '104.244.42.1', location: 'New York, US', delay: '+0.3s', isSuspect: false, type: 'Target MX' }
    ],
    forensicFinding: 'Display name impersonates corporate CEO, but cryptographic envelope origins originate in Bulgaria on an unlisted offshore relay. SPF and DKIM completely fail company DMARC enforcement policy.',
    rawHeaderSnippet: `From: "Chief Executive Officer" <ceo@yourcompany.com>
Return-Path: <spoof-relay@bulletproof-relay.bg>
Received: from origin-vps.evil-cloud.bg (185.220.101.42)
  by relay-node04.anonymizer.is with ESMTP; 05 Sep 2026 14:18:22
Authentication-Results: mx.yourcompany.com;
  spf=fail (sender IP 185.220.101.42 is not permitted)
  dkim=fail (no valid key found for yourcompany.com)
  dmarc=fail (action=reject; header.from=yourcompany.com)`
  },
  {
    id: 'SCENARIO-2',
    name: 'Microsoft 365 Credential Harvest',
    category: 'Account Takeover Phishing',
    tag: 'LOOKALIKE PHISHING',
    threatLevel: 'CRITICAL',
    threatScore: 92,
    subject: 'Action Required: Your Microsoft 365 Session Token Expired',
    fakeSender: 'security@microsoft-authsupport.com',
    realSender: 'phish@server89.cloudns.cc',
    originLocation: 'Frankfurt, Germany',
    originIp: '45.142.214.77',
    asn: 'AS44050 (Bulletproof Hosting)',
    spf: 'FAIL',
    dkim: 'NONE',
    dmarc: 'FAIL',
    hops: [
      { hopNum: 1, server: 'phish-builder.cloudns.cc', ip: '45.142.214.77', location: 'Frankfurt, DE', delay: '0.0s', isSuspect: true, type: 'Phish Server' },
      { hopNum: 2, server: 'mta-pool.relayhost.nl', ip: '185.107.56.23', location: 'Amsterdam, NL', delay: '+0.9s', isSuspect: true, type: 'Open Relay' },
      { hopNum: 3, server: 'mail-filter-inbound.sec.com', ip: '52.96.11.20', location: 'Dublin, IE', delay: '+0.5s', isSuspect: false, type: 'Sec Gateway' },
      { hopNum: 4, server: 'inbox.enterprise.org', ip: '13.107.6.152', location: 'London, UK', delay: '+0.2s', isSuspect: false, type: 'Mailbox' }
    ],
    forensicFinding: 'Homoglyph domain "microsoft-authsupport.com" registered 48 hours ago. Link redirects to an Evilginx reverse-proxy stealing MFA session tokens.',
    rawHeaderSnippet: `From: "Microsoft Security Team" <security@microsoft-authsupport.com>
Return-Path: <bounce@server89.cloudns.cc>
Received: from phish-builder.cloudns.cc ([45.142.214.77])
  by mta-pool.relayhost.nl with ESMTP; 05 Sep 2026 13:45:10
X-Domain-Age: 2 days (High Risk Newly Registered Domain)
Authentication-Results: inbox.enterprise.org;
  spf=fail (IP 45.142.214.77 unauthorized)
  dkim=none (unsigned email body)`
  },
  {
    id: 'SCENARIO-3',
    name: 'DocuSign Ghost Attachment',
    category: 'Malware & Trojan Dropper',
    tag: 'MALICIOUS PAYLOAD',
    threatLevel: 'SUSPICIOUS',
    threatScore: 84,
    subject: 'Completed: DocuSign Invoice_Q3_994182.pdf.exe',
    fakeSender: 'docusign-notification@docusign-docs-sign.net',
    realSender: 'compromised-cpanel@hoster-us.org',
    originLocation: 'Amsterdam, Netherlands',
    originIp: '194.26.29.110',
    asn: 'AS60781 (Compromised Webhost)',
    spf: 'PASS',
    dkim: 'FAIL',
    dmarc: 'FAIL',
    hops: [
      { hopNum: 1, server: 'cpanel.compromised-site.com', ip: '194.26.29.110', location: 'Amsterdam, NL', delay: '0.0s', isSuspect: true, type: 'Compromised Host' },
      { hopNum: 2, server: 'postfix.outbound-smtp.net', ip: '109.236.81.4', location: 'Zurich, CH', delay: '+1.1s', isSuspect: false, type: 'SMTP Relay' },
      { hopNum: 3, server: 'mx-filter.targetcorp.com', ip: '34.218.112.55', location: 'Oregon, US', delay: '+0.4s', isSuspect: false, type: 'Dest Gateway' }
    ],
    forensicFinding: 'Compromised CPanel hosting server hijacked to send fake DocuSign notices. Double-extension attachment (.pdf.exe) contains Stealer malware payload.',
    rawHeaderSnippet: `From: "DocuSign Electronic System" <docusign-notification@docusign-docs-sign.net>
Subject: Completed: DocuSign Invoice_Q3_994182.pdf.exe
Content-Type: application/octet-stream; name="Invoice_Q3_994182.pdf.exe"
Authentication-Results: targetcorp.com;
  spf=pass (smtp.mailfrom=compromised-cpanel@hoster-us.org)
  dkim=fail (body hash did not verify against docusign.com)`
  },
  {
    id: 'SCENARIO-4',
    name: 'Legitimate Stripe Receipt',
    category: 'Authentic Cryptographic Transaction',
    tag: 'AUTHENTIC & SAFE',
    threatLevel: 'SAFE',
    threatScore: 4,
    subject: 'Receipt #2094-1184 for TraceXMail Pro Subscription',
    fakeSender: 'support@stripe.com (Verified)',
    realSender: 'receipts@stripe.com',
    originLocation: 'San Francisco, CA, USA',
    originIp: '54.240.8.21',
    asn: 'AS16509 (Amazon SES / Stripe Inc)',
    spf: 'PASS',
    dkim: 'PASS',
    dmarc: 'PASS',
    hops: [
      { hopNum: 1, server: 'a8-21.smtp-out.amazonses.com', ip: '54.240.8.21', location: 'Seattle, US', delay: '0.0s', isSuspect: false, type: 'Authorized SES' },
      { hopNum: 2, server: 'inbound-smtp.google.com', ip: '142.250.102.26', location: 'Mountain View, US', delay: '+0.2s', isSuspect: false, type: 'Google MX' }
    ],
    forensicFinding: 'Strict cryptographic alignment verified. 2048-bit RSA DKIM signature valid, SPF authorized by Stripe Inc DNS, DMARC 100% aligned with strict reject policy.',
    rawHeaderSnippet: `From: Stripe <receipts@stripe.com>
DKIM-Signature: v=1; a=rsa-sha256; d=stripe.com; s=s1;
  h=from:to:subject:date:message-id; bh=jN7X2y4...=;
Authentication-Results: mx.google.com;
  dkim=pass (signature 2048-bit verified) header.i=@stripe.com;
  spf=pass (google.com: domain of receipts@stripe.com designates 54.240.8.21)
  dmarc=pass (p=reject sp=reject dis=none) header.from=stripe.com`
  }
];

export function LiveForensicSimulator({
  onOpenTrace,
  onOpenConsole,
  onSelectCase
}: LiveForensicSimulatorProps) {
  const [activeScenarioIndex, setActiveScenarioIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'visual' | 'headers' | 'hops'>('visual');
  const [scanProgress, setScanProgress] = useState(100);
  const [isScanning, setIsScanning] = useState(false);
  const [activeHopHover, setActiveHopHover] = useState<number | null>(null);

  const current = SCENARIOS[activeScenarioIndex];

  // Trigger simulated scan animation on scenario change
  const handleSelectScenario = (idx: number) => {
    if (idx === activeScenarioIndex) return;
    setIsScanning(true);
    setScanProgress(15);
    setActiveScenarioIndex(idx);

    const t1 = setTimeout(() => setScanProgress(60), 120);
    const t2 = setTimeout(() => setScanProgress(90), 240);
    const t3 = setTimeout(() => {
      setScanProgress(100);
      setIsScanning(false);
    }, 380);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  };

  const getThreatColor = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return { text: 'text-[var(--rose-400)]', bg: 'bg-[rgba(178,58,46,0.18)]', border: 'border-[var(--thread)]', hex: '#b23a2e' };
      case 'SUSPICIOUS':
        return { text: 'text-[var(--stamp)]', bg: 'bg-[rgba(201,162,39,0.18)]', border: 'border-[var(--stamp)]', hex: '#c9a227' };
      case 'CAUTION':
        return { text: 'text-[var(--slate)]', bg: 'bg-[rgba(127,163,186,0.18)]', border: 'border-[var(--slate)]', hex: '#7fa3ba' };
      default:
        return { text: 'text-[var(--forensic-green)]', bg: 'bg-[rgba(72,169,117,0.18)]', border: 'border-[var(--forensic-green)]', hex: '#48a975' };
    }
  };

  const colors = getThreatColor(current.threatLevel);

  return (
    <div className="w-full bg-[#16130f] border border-[#3a352c] rounded-md shadow-2xl overflow-hidden font-sans">
      {/* Top Console Bar */}
      <div className="bg-[#100e0c] px-4 py-3 border-b border-[#3a352c] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--thread)] inline-block animate-pulse" />
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--stamp)] inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--forensic-green)] inline-block" />
          </div>
          <span className="font-mono text-xs font-bold text-[var(--paper)] uppercase tracking-wider pl-2 border-l border-[#3a352c]">
            Interactive Forensic Header Deconstruction Engine
          </span>
        </div>

        {/* Live Simulator Status Badge */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="px-2 py-0.5 rounded-sm bg-[rgba(127,163,186,0.12)] border border-[rgba(127,163,186,0.3)] text-[var(--slate)] flex items-center gap-1">
            <Activity className="w-3 h-3 animate-pulse" />
            <span>Telemetry: Active</span>
          </span>
          <span className="text-[var(--paper-muted)] hidden sm:inline">RFC822 Parser v4.8</span>
        </div>
      </div>

      {/* Scenario Selector Tabs */}
      <div className="bg-[#1c1813] border-b border-[#3a352c] px-3 py-2 flex items-center gap-2 overflow-x-auto">
        <span className="text-[11px] font-mono text-[var(--paper-muted)] uppercase tracking-wide px-2 shrink-0 font-semibold">
          Select Threat Scenario:
        </span>
        <div className="flex items-center gap-1.5 min-w-max">
          {SCENARIOS.map((scen, idx) => {
            const isSelected = idx === activeScenarioIndex;
            return (
              <button
                key={scen.id}
                onClick={() => handleSelectScenario(idx)}
                className={`px-3 py-1.5 rounded-[3px] text-xs font-medium font-sans flex items-center gap-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#2b251d] text-[var(--paper)] border border-[var(--thread)] shadow-sm font-semibold'
                    : 'bg-[#14120f] text-[var(--paper-dim)] hover:text-[var(--paper)] border border-[#3a352c] hover:border-[#574f42]'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  scen.threatLevel === 'CRITICAL' ? 'bg-[var(--rose-400)]' :
                  scen.threatLevel === 'SUSPICIOUS' ? 'bg-[var(--stamp)]' : 'bg-[var(--forensic-green)]'
                }`} />
                <span>{scen.name}</span>
                {isSelected && (
                  <span className="text-[10px] font-mono font-bold text-[var(--thread)] ml-1">ACTIVE</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Scan Telemetry Progress Bar */}
      <div className="w-full bg-[#100e0c] h-1 relative overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-[var(--thread)] via-[var(--stamp)] to-[var(--slate)] transition-all duration-300"
          style={{ width: `${scanProgress}%` }}
        />
      </div>

      {/* Main Interactive Workspace Grid */}
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Email Dissection & Hop Telemetry (7 cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          
          {/* Header Metadata Breakdown Card */}
          <div className="bg-[#1f1b15] border border-[#3a352c] rounded-sm p-4 relative overflow-hidden">
            {/* Stamp Overlay */}
            <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-[3px] border ${colors.border} ${colors.bg} ${colors.text} font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md`}>
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{current.threatLevel} ({current.threatScore}/100)</span>
            </div>

            <div className="text-[10.5px] font-mono text-[var(--paper-muted)] uppercase tracking-wider mb-1">
              Case Inspection ID: {current.id} • {current.category}
            </div>
            
            <h3 className="font-display text-base font-bold text-[var(--paper)] pr-24 leading-snug">
              {current.subject}
            </h3>

            {/* From vs Real Origin Comparison Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#3a352c] text-xs">
              <div className="bg-[#16130f] p-2.5 rounded-[3px] border border-[#3a352c]">
                <div className="flex items-center justify-between text-[11px] text-[var(--paper-muted)] mb-0.5">
                  <span>Claimed Display Sender</span>
                  <span className="text-[var(--rose-400)] font-mono text-[10px]">Header From</span>
                </div>
                <div className="font-mono text-[12.5px] text-[var(--rose-400)] font-medium truncate" title={current.fakeSender}>
                  {current.fakeSender}
                </div>
              </div>

              <div className="bg-[#16130f] p-2.5 rounded-[3px] border border-[#3a352c]">
                <div className="flex items-center justify-between text-[11px] text-[var(--paper-muted)] mb-0.5">
                  <span>Cryptographic Origin</span>
                  <span className="text-[var(--stamp)] font-mono text-[10px]">Return-Path</span>
                </div>
                <div className="font-mono text-[12.5px] text-[var(--paper)] font-medium truncate" title={current.realSender}>
                  {current.realSender}
                </div>
              </div>
            </div>

            {/* Origin Server & ASN Pill Row */}
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 text-xs font-mono text-[var(--paper-dim)]">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#16130f] border border-[#3a352c]">
                <MapPin className="w-3 h-3 text-[var(--thread)]" />
                <span>Origin: <strong className="text-[var(--paper)]">{current.originLocation}</strong></span>
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#16130f] border border-[#3a352c]">
                <Server className="w-3 h-3 text-[var(--slate)]" />
                <span>IP: <strong className="text-[var(--paper)]">{current.originIp}</strong></span>
              </span>
              <span className="px-2 py-0.5 rounded bg-[#16130f] border border-[#3a352c] text-[10.5px]">
                {current.asn}
              </span>
            </div>
          </div>

          {/* Sub-Tabs (Visual Hop Route vs Raw Headers vs Finding) */}
          <div className="flex border-b border-[#3a352c] gap-2 pt-1">
            <button
              onClick={() => setActiveTab('visual')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'visual'
                  ? 'border-[var(--thread)] text-[var(--paper)]'
                  : 'border-transparent text-[var(--paper-dim)] hover:text-[var(--paper)]'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-[var(--thread)]" />
              <span>Multi-Hop Relay Tracer ({current.hops.length} Hops)</span>
            </button>
            <button
              onClick={() => setActiveTab('headers')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'headers'
                  ? 'border-[var(--thread)] text-[var(--paper)]'
                  : 'border-transparent text-[var(--paper-dim)] hover:text-[var(--paper)]'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-[var(--slate)]" />
              <span>Raw RFC822 Evidence</span>
            </button>
          </div>

          {/* Tab 1: Visual Interactive Hop Route */}
          {activeTab === 'visual' && (
            <div className="bg-[#14120f] border border-[#3a352c] rounded-sm p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-[var(--paper-muted)] font-mono pb-2 border-b border-[#28241d]">
                <span>Hop Transmission Chronology (Earliest to Latest)</span>
                <span className="text-[var(--stamp)]">Red = Suspect Injector</span>
              </div>

              {/* Hop Step-by-Step Flow */}
              <div className="space-y-2">
                {current.hops.map((hop, hIdx) => {
                  const isHovered = activeHopHover === hIdx;
                  return (
                    <div
                      key={hop.hopNum}
                      onMouseEnter={() => setActiveHopHover(hIdx)}
                      onMouseLeave={() => setActiveHopHover(null)}
                      className={`p-2.5 rounded-[3px] border transition-all text-xs font-sans flex items-center justify-between gap-3 ${
                        hop.isSuspect
                          ? 'bg-[rgba(178,58,46,0.1)] border-[rgba(178,58,46,0.4)] hover:border-[var(--thread)]'
                          : 'bg-[#1b1712] border-[#2e2a22] hover:border-[var(--slate)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-6 h-6 rounded-full font-mono text-[11px] font-bold flex items-center justify-center shrink-0 ${
                          hop.isSuspect 
                            ? 'bg-[var(--thread)] text-[var(--paper)]' 
                            : 'bg-[#28241d] text-[var(--slate)] border border-[#3a352c]'
                        }`}>
                          {hop.hopNum}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[var(--paper)] truncate">
                              {hop.server}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#100e0c] border border-[#3a352c] text-[var(--paper-dim)] shrink-0">
                              {hop.type}
                            </span>
                          </div>
                          <div className="text-[11px] text-[var(--paper-dim)] font-mono truncate">
                            IP: <span className="text-[var(--paper)]">{hop.ip}</span> • Location: {hop.location}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-mono text-[var(--paper-muted)] block">
                          Delay: {hop.delay}
                        </span>
                        {hop.isSuspect ? (
                          <span className="text-[10px] font-mono font-bold text-[var(--rose-400)] uppercase">
                            MALICIOUS INJECT
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-[var(--forensic-green)] uppercase">
                            VERIFIED MTA
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Forensic Hop Insight Callout */}
              <div className="p-3 bg-[#1b1712] border border-[#3a352c] rounded-[3px] text-xs text-[var(--paper-dim)] flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-[var(--stamp)] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[var(--paper)] font-sans">Hop De-Anonymization: </strong>
                  TraceXMail traces through proxy hops and anonymizing VPNs, locating Hop #1 ({current.originLocation}) as the unmasked injection point.
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Raw RFC822 Evidence with Syntax Highlights */}
          {activeTab === 'headers' && (
            <div className="bg-[#100e0c] border border-[#3a352c] rounded-sm p-3 relative font-mono text-[11.5px] leading-relaxed text-[var(--paper-dim)] max-h-64 overflow-y-auto">
              <div className="absolute top-2 right-2 text-[10px] uppercase font-bold text-[var(--stamp)] px-2 py-0.5 rounded bg-[#1c1813] border border-[#3a352c]">
                RFC822 Raw Stream
              </div>
              <pre className="whitespace-pre-wrap font-mono text-[11.5px] text-[var(--paper)] selection:bg-[var(--thread)]">
                {current.rawHeaderSnippet}
              </pre>
            </div>
          )}
        </div>

        {/* Right Column: Cryptographic Auth Verdict & Actions (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          
          {/* Cryptographic Key Attestation Panel */}
          <div className="bg-[#1f1b15] border border-[#3a352c] rounded-sm p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#3a352c] pb-2">
              <span className="text-xs font-mono font-bold text-[var(--paper)] uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[var(--slate)]" />
                Cryptographic Attestation
              </span>
              <span className="text-[10px] font-mono text-[var(--paper-muted)]">DNS TXT / RSA Keys</span>
            </div>

            {/* 3 Major Auth Pillars (SPF, DKIM, DMARC) */}
            <div className="grid grid-cols-3 gap-2">
              {/* SPF Box */}
              <div className={`p-2.5 rounded-[3px] border text-center ${
                current.spf === 'PASS' 
                  ? 'bg-[rgba(72,169,117,0.12)] border-[rgba(72,169,117,0.35)]' 
                  : 'bg-[rgba(178,58,46,0.15)] border-[rgba(178,58,46,0.4)]'
              }`}>
                <div className="text-[10px] font-mono font-semibold text-[var(--paper-muted)]">SPF</div>
                <div className={`font-mono text-sm font-bold mt-0.5 ${
                  current.spf === 'PASS' ? 'text-[var(--forensic-green)]' : 'text-[var(--rose-400)]'
                }`}>
                  {current.spf}
                </div>
                <div className="text-[9.5px] text-[var(--paper-dim)] font-mono mt-0.5">
                  {current.spf === 'PASS' ? 'IP Listed' : 'IP Unlisted'}
                </div>
              </div>

              {/* DKIM Box */}
              <div className={`p-2.5 rounded-[3px] border text-center ${
                current.dkim === 'PASS' 
                  ? 'bg-[rgba(72,169,117,0.12)] border-[rgba(72,169,117,0.35)]' 
                  : 'bg-[rgba(178,58,46,0.15)] border-[rgba(178,58,46,0.4)]'
              }`}>
                <div className="text-[10px] font-mono font-semibold text-[var(--paper-muted)]">DKIM</div>
                <div className={`font-mono text-sm font-bold mt-0.5 ${
                  current.dkim === 'PASS' ? 'text-[var(--forensic-green)]' : 'text-[var(--rose-400)]'
                }`}>
                  {current.dkim}
                </div>
                <div className="text-[9.5px] text-[var(--paper-dim)] font-mono mt-0.5">
                  {current.dkim === 'PASS' ? '2048-bit Valid' : 'No Valid Sig'}
                </div>
              </div>

              {/* DMARC Box */}
              <div className={`p-2.5 rounded-[3px] border text-center ${
                current.dmarc === 'PASS' 
                  ? 'bg-[rgba(72,169,117,0.12)] border-[rgba(72,169,117,0.35)]' 
                  : 'bg-[rgba(178,58,46,0.15)] border-[rgba(178,58,46,0.4)]'
              }`}>
                <div className="text-[10px] font-mono font-semibold text-[var(--paper-muted)]">DMARC</div>
                <div className={`font-mono text-sm font-bold mt-0.5 ${
                  current.dmarc === 'PASS' ? 'text-[var(--forensic-green)]' : 'text-[var(--rose-400)]'
                }`}>
                  {current.dmarc}
                </div>
                <div className="text-[9.5px] text-[var(--paper-dim)] font-mono mt-0.5">
                  {current.dmarc === 'PASS' ? 'Aligned (p=none)' : 'Reject Policy'}
                </div>
              </div>
            </div>

            {/* Forensic Finding Summary */}
            <div className="bg-[#14120f] p-3 rounded-[3px] border border-[#3a352c] text-xs font-sans text-[var(--paper-dim)] leading-relaxed">
              <div className="text-[10px] font-mono font-bold text-[var(--stamp)] uppercase mb-1 flex items-center gap-1">
                <Terminal className="w-3 h-3" />
                <span>Forensic Intelligence Finding</span>
              </div>
              <p className="text-[var(--paper)] text-xs">
                {current.forensicFinding}
              </p>
            </div>
          </div>

          {/* Bottom Action Stamp & Direct Verification Button */}
          <div className="bg-[#1a1712] border-2 border-[#3a352c] rounded-sm p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10.5px] font-mono uppercase font-bold text-[var(--paper-muted)] block">
                  Interactive Simulator Output
                </span>
                <span className={`font-display font-extrabold text-lg leading-tight ${colors.text}`}>
                  {current.threatLevel === 'SAFE' ? 'VERIFIED AUTHENTIC' : 'THREAT CONFIRMED'}
                </span>
              </div>

              <div className="font-mono text-right">
                <span className="text-[10px] text-[var(--paper-muted)] block">Calculated Risk</span>
                <span className={`text-base font-bold ${colors.text}`}>
                  {current.threatScore} / 100
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#3a352c] flex flex-col sm:flex-row items-center gap-2.5">
              <button
                onClick={onOpenConsole}
                className="w-full btn-primary text-xs sm:text-sm font-semibold py-2.5 px-4 flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <span>Run This Case in Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onOpenTrace}
                className="w-full sm:w-auto btn-secondary text-xs sm:text-sm font-medium py-2.5 px-3 flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <span>Full Map</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
