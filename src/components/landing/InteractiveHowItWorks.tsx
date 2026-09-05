import React, { useState } from 'react';
import { 
  FileText, 
  Lock, 
  MapPin, 
  ShieldCheck, 
  Cpu, 
  ArrowRight, 
  CheckCircle2, 
  Terminal, 
  Zap, 
  Eye, 
  Network, 
  Fingerprint,
  Layers,
  Database
} from 'lucide-react';

interface StageDetail {
  step: number;
  title: string;
  tagline: string;
  badge: string;
  summary: string;
  technicalSteps: string[];
  liveOutputSnippet: {
    label: string;
    code: string;
  };
  metrics: { label: string; value: string }[];
}

const STAGES: StageDetail[] = [
  {
    step: 1,
    title: 'RFC822 Header Ingestion & Hex Decomposition',
    tagline: 'Stripping superficial display names down to RFC5322 boundaries.',
    badge: 'STAGE 1 • INGESTION',
    summary: 'When an email arrives, attackers frequently alter the outer display text to read "Security Support" or "CEO Office". TraceXMail bypasses the user-facing interface, parsing the raw MIME body structure, extracting Message-IDs, date-time envelopes, and every embedded Received: transport header.',
    technicalSteps: [
      'Parse RFC5322 and RFC2045/RFC2046 MIME boundaries in real time.',
      'Deconstruct Received headers chronologically from bottom-to-top.',
      'Extract envelope Return-Path vs From: header discrepancy markers.',
      'Extract SHA-256 body hash (bh=) for cryptographic alignment.'
    ],
    liveOutputSnippet: {
      label: 'RFC822 Parsing Telemetry',
      code: `[MIME_DECOMPOSE] Extracting headers...
[FOUND] Message-ID: <20260905.141822.8941@evil-vps.bg>
[ENVELOPE] Return-Path: <spoof@bulletproof-relay.bg>
[DISPLAY]  From: "CEO Direct" <ceo@yourcompany.com>
[DISCREPANCY DETECTED] Display/Envelope Mismatch: 100% Risk`
    },
    metrics: [
      { label: 'Parse Latency', value: '1.4ms' },
      { label: 'MIME Formats', value: 'EML, MSG, TXT' },
      { label: 'Privacy Mode', value: '100% Local / Zero-Retention' }
    ]
  },
  {
    step: 2,
    title: 'Cryptographic Key Attestation (SPF, DKIM, DMARC, ARC)',
    tagline: 'Validating public RSA/Ed25519 keys and DMARC enforcement policies.',
    badge: 'STAGE 2 • CRYPTO AUDIT',
    summary: 'Email cannot be forged if modern cryptographic protocols are verified. TraceXMail queries live authoritative DNS TXT records, checks SPF sender IP authorizations, validates 2048-bit RSA DKIM signatures, and calculates strict DMARC alignment (p=reject or p=quarantine).',
    technicalSteps: [
      'Query authoritative DNS name servers for domain SPF TXT records.',
      'Fetch public selector key (_domainkey) and verify RSA/Ed25519 signature.',
      'Calculate identifier alignment between RFC5322.From and DKIM/SPF domain.',
      'Inspect ARC (Authenticated Received Chain) seals for intermediary mailing lists.'
    ],
    liveOutputSnippet: {
      label: 'Cryptographic Attestation Log',
      code: `[DNS_QUERY] Querying TXT for yourcompany.com...
[SPF_EVAL]  IP 185.220.101.42 NOT IN spf:yourcompany.com -> FAIL
[DKIM_EVAL] Signature header.d=evil-cloud.bg != from:yourcompany.com -> UNALIGNED
[DMARC]     Enforcement Policy: p=reject -> ACTION: REJECT/FLAG
[VERDICT]   Cryptographic Spoofing Confirmed (Grade F)`
    },
    metrics: [
      { label: 'RSA Key Sizes', value: '1024, 2048, 4096-bit' },
      { label: 'Protocol Coverage', value: 'SPF, DKIM, DMARC, ARC, BIMI' },
      { label: 'DNS Verification', value: 'Recursive DNSSEC' }
    ]
  },
  {
    step: 3,
    title: 'Multi-Hop BGP Reverse Traceroute & Geolocation',
    tagline: 'De-anonymizing VPN proxies, Tor nodes, and bulletproof relays.',
    badge: 'STAGE 3 • HOP TRACKER',
    summary: 'Every Mail Transfer Agent (MTA) that handles a message stamps its IP address and timestamp into the Received header. TraceXMail reverses this chain backwards through time, measuring inter-hop network delays, detecting injected fake headers, and mapping the true origin IP to its physical country and Autonomous System (ASN).',
    technicalSteps: [
      'Calculate transmission latency (delta-t) between consecutive relay nodes.',
      'Cross-reference IP coordinates with MaxMind City databases & BGP tables.',
      'Flag high-risk ASNs known for hosting phishing kits and malware droppers.',
      'Filter out forged headers injected by rogue client mailers.'
    ],
    liveOutputSnippet: {
      label: 'Hop Chronology & Geo Trace',
      code: `[HOP 01] 185.220.101.42 (Sofia, Bulgaria | AS200548) -> INJECTOR [0.0s]
[HOP 02] 194.156.98.12  (Reykjavik, Iceland | AS49981) -> RELAY (+1.4s)
[HOP 03] 84.17.44.19    (Frankfurt, Germany | AS13335)  -> MTA   (+0.8s)
[HOP 04] 104.244.42.1   (New York, USA | Target MX)     -> FINAL (+0.3s)
[ANOMALY] Inter-hop transit delay spike: Potential Anonymizer Proxy`
    },
    metrics: [
      { label: 'Geo Accuracy', value: 'City / ASN Level' },
      { label: 'Hop Resolution', value: 'Sub-second Timestamps' },
      { label: 'Map Engine', value: 'Interactive Leaflet / D3' }
    ]
  },
  {
    step: 4,
    title: 'Court-Admissible Dossier & Tamper-Proof Chain-of-Custody',
    tagline: 'Generating clean, legally defensible incident reports with SHA-256 seals.',
    badge: 'STAGE 4 • VERDICT & PDF',
    summary: 'Once analysis completes, TraceXMail seals the raw evidence with a cryptographic SHA-256 fingerprint. You receive a human-readable threat verdict, complete incident timeline, and one-click PDF forensic dossier formatted for IT helpdesks, HR executives, cyber insurance, or law enforcement.',
    technicalSteps: [
      'Generate deterministic SHA-256 cryptographic evidence digest.',
      'Sanitize personal recipient names and emails (PII Masking Mode).',
      'Compute overall composite Threat Score (0 to 100).',
      'Export multi-page printable PDF report with forensic exhibits.'
    ],
    liveOutputSnippet: {
      label: 'Chain of Custody Record',
      code: `[SHA-256] e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
[CUSTODY] Timestamp: 2026-09-05T14:31:00Z | Operator: SEC-OPS-09
[VERDICT] THREAT CONFIRMED (Risk Score: 96/100)
[ACTION]  Quarantine Email, Block Sender IP 185.220.101.42, Alert IT Helpdesk
[STATUS]  Court-Admissible Evidence Locked & Sealed`
    },
    metrics: [
      { label: 'Export Formats', value: 'PDF, JSON, RFC822 Raw' },
      { label: 'Integrity Seal', value: 'SHA-256 Hash' },
      { label: 'Compliance', value: 'GDPR / HIPAA Ready' }
    ]
  }
];

export function InteractiveHowItWorks() {
  const [activeStep, setActiveStep] = useState(1);
  const activeStage = STAGES.find(s => s.step === activeStep) || STAGES[0];

  return (
    <div className="w-full space-y-8 font-sans">
      
      {/* 4 Step Visual Progression Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {STAGES.map((st) => {
          const isCurrent = st.step === activeStep;
          return (
            <div
              key={st.step}
              onClick={() => setActiveStep(st.step)}
              className={`p-4 rounded-sm border transition-all cursor-pointer text-left flex flex-col justify-between relative overflow-hidden group ${
                isCurrent
                  ? 'bg-[#221e17] border-[var(--thread)] shadow-lg'
                  : 'bg-[#181410] border-[#3a352c] hover:border-[#574f42]'
              }`}
            >
              {isCurrent && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--thread)]" />
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-sm ${
                    isCurrent
                      ? 'bg-[rgba(178,58,46,0.2)] text-[var(--thread)] border border-[rgba(178,58,46,0.4)]'
                      : 'bg-[#100e0c] text-[var(--paper-muted)] border border-[#3a352c]'
                  }`}>
                    STEP 0{st.step}
                  </span>
                  {isCurrent && (
                    <span className="w-2 h-2 rounded-full bg-[var(--thread)] animate-ping" />
                  )}
                </div>

                <h4 className="font-display font-semibold text-sm sm:text-base text-[var(--paper)] mb-1 group-hover:text-[var(--paper)]">
                  {st.title.split('&')[0]}
                </h4>
                <p className="text-[var(--paper-dim)] text-xs line-clamp-2 leading-relaxed">
                  {st.tagline}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-[#2e2a22] flex items-center justify-between text-xs font-mono">
                <span className={isCurrent ? 'text-[var(--thread)] font-bold' : 'text-[var(--paper-muted)]'}>
                  {isCurrent ? 'Viewing Step Details' : 'Click to Inspect →'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Stage Deep-Dive Visualizer Board */}
      <div className="bg-[#181410] border border-[#3a352c] rounded-md p-5 sm:p-7 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Detailed Architectural Explanation (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm bg-[rgba(178,58,46,0.15)] border border-[rgba(178,58,46,0.35)] text-[var(--rose-400)] font-mono text-xs font-bold uppercase tracking-wider">
            <Cpu className="w-3.5 h-3.5" />
            <span>{activeStage.badge}</span>
          </div>

          <h3 className="font-display text-xl sm:text-2xl font-bold text-[var(--paper)] leading-snug">
            {activeStage.title}
          </h3>

          <p className="text-[var(--paper-dim)] text-sm sm:text-base leading-relaxed">
            {activeStage.summary}
          </p>

          {/* Technical Execution Checklist */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-mono font-bold text-[var(--stamp)] uppercase tracking-wider">
              Forensic Execution Checklist:
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {activeStage.technicalSteps.map((tech, tIdx) => (
                <div key={tIdx} className="flex items-start gap-2.5 text-xs text-[var(--paper)] bg-[#100e0c] p-2.5 rounded-[3px] border border-[#2e2a22]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--forensic-green)] shrink-0 mt-0.5" />
                  <span>{tech}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Key Metrics Pill Strip */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            {activeStage.metrics.map((m, mIdx) => (
              <div key={mIdx} className="bg-[#14120f] border border-[#3a352c] p-2.5 rounded-[3px] text-center">
                <span className="text-[10px] font-mono text-[var(--paper-muted)] block">{m.label}</span>
                <span className="text-xs font-mono font-bold text-[var(--paper)] block mt-0.5">{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Simulated Real-Time Console Output (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-3">
          <div className="bg-[#100e0c] border border-[#3a352c] rounded-sm p-4 relative font-mono text-xs shadow-inner">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#28241d] text-[11px] text-[var(--paper-muted)]">
              <span className="flex items-center gap-1.5 text-[var(--paper)] font-bold">
                <Terminal className="w-3.5 h-3.5 text-[var(--thread)]" />
                <span>{activeStage.liveOutputSnippet.label}</span>
              </span>
              <span className="text-[10px] text-[var(--forensic-green)] animate-pulse">LIVE VERIFIED</span>
            </div>

            <pre className="text-[11.5px] leading-relaxed text-[var(--paper-dim)] overflow-x-auto whitespace-pre-wrap selection:bg-[var(--thread)]">
              {activeStage.liveOutputSnippet.code}
            </pre>

            <div className="mt-3 pt-2 border-t border-[#28241d] flex items-center justify-between text-[10.5px] text-[var(--paper-muted)]">
              <span>RFC Compliance: 100%</span>
              <span className="text-[var(--slate)]">Deterministic Output</span>
            </div>
          </div>

          {/* Next Step Nav Hint */}
          <div className="p-3 bg-[#1f1b15] border border-[#3a352c] rounded-sm flex items-center justify-between text-xs">
            <span className="text-[var(--paper-dim)]">
              Step {activeStep} of {STAGES.length}
            </span>
            <button
              onClick={() => setActiveStep(prev => (prev % STAGES.length) + 1)}
              className="text-xs font-semibold text-[var(--paper)] hover:text-[var(--stamp)] flex items-center gap-1 cursor-pointer bg-transparent border-0"
            >
              <span>{activeStep === STAGES.length ? 'Restart Flow' : 'Next Forensic Step'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
