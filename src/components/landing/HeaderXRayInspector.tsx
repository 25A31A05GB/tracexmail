import React, { useState } from 'react';
import { 
  FileCode, 
  HelpCircle, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Search, 
  Eye, 
  Info,
  CornerDownRight,
  Terminal
} from 'lucide-react';

interface HeaderLine {
  id: string;
  field: string;
  rawText: string;
  risk: 'CRITICAL' | 'SUSPICIOUS' | 'SAFE';
  whatItMeans: string;
  attackerTrick: string;
  forensicExtraction: string;
}

const HEADER_LINES: HeaderLine[] = [
  {
    id: 'from',
    field: 'From: (Display Name vs Address)',
    rawText: 'From: "Chief Executive Officer" <ceo@yourcompany.com>',
    risk: 'CRITICAL',
    whatItMeans: 'The user-facing display name and claimed address rendered by client email apps (Outlook, Apple Mail, Gmail).',
    attackerTrick: 'Attackers freely type any name or executive title they want in quotation marks. Many mobile email apps ONLY show the quotation display name, hiding the true sender domain.',
    forensicExtraction: 'TraceXMail strips the display name and checks the envelope Return-Path and SMTP AUTH session, exposing that this email was actually transmitted by an offshore bulletproof server.'
  },
  {
    id: 'received',
    field: 'Received: (Multi-Hop Transport)',
    rawText: 'Received: from origin-vps.evil-cloud.bg (185.220.101.42) by relay04.net with ESMTP;',
    risk: 'CRITICAL',
    whatItMeans: 'Automated relay stamps added sequentially by every internet mail server that forwards or handles the message.',
    attackerTrick: 'Sophisticated spoofers often inject fake "Received:" headers at the bottom of the raw text pretending to originate from legitimate servers like "google.com" or "microsoft.com".',
    forensicExtraction: 'TraceXMail traces the chain chronologically from top-to-bottom and bottom-to-top, calculating timestamp deltas (delta-t) and verifying reverse DNS PTR records to discard forged client headers.'
  },
  {
    id: 'auth_results',
    field: 'Authentication-Results: (SPF / DKIM / DMARC)',
    rawText: 'Authentication-Results: mx.yourcompany.com; spf=fail; dkim=fail; dmarc=fail action=reject;',
    risk: 'CRITICAL',
    whatItMeans: 'The official verdict stamped by the recipient mail server after evaluating cryptographic DNS records.',
    attackerTrick: 'Attackers rely on loose domain configurations where companies have DMARC set to "p=none" (monitoring only), allowing spoofed emails to slip straight into inboxes without being rejected.',
    forensicExtraction: 'TraceXMail independently re-queries live DNS TXT records, evaluates selector keys, and grades domain alignment on a strict zero-trust scale.'
  },
  {
    id: 'return_path',
    field: 'Return-Path: (Envelope Bounce Address)',
    rawText: 'Return-Path: <bounces+38910@bulletproof-relay.bg>',
    risk: 'SUSPICIOUS',
    whatItMeans: 'The actual SMTP MAIL FROM envelope address where bounce notices (NDRs) are routed if delivery fails.',
    attackerTrick: 'The Return-Path is hidden from regular users in almost all email apps. Attackers use it to route bouncebacks to their command-and-control server while displaying a reputable company in From.',
    forensicExtraction: 'TraceXMail highlights the Return-Path immediately beside the From address, revealing the 100% domain mismatch to the user in plain English.'
  },
  {
    id: 'message_id',
    field: 'Message-ID: (Global Unique Identifier)',
    rawText: 'Message-ID: <20260905141822.894191.evil-vps.bg@evil-cloud.bg>',
    risk: 'SUSPICIOUS',
    whatItMeans: 'A globally unique string created by the originating mail software to reference this specific message instance.',
    attackerTrick: 'Mass phishing kits and spam bots often use predictable Message-ID patterns or disclose internal hostnames of malicious VPS servers.',
    forensicExtraction: 'TraceXMail extracts the domain suffix of the Message-ID and cross-references it with known phishing infrastructure and malicious IP clusters.'
  }
];

export function HeaderXRayInspector() {
  const [selectedHeaderId, setSelectedHeaderId] = useState<string>('from');
  const activeHeader = HEADER_LINES.find(h => h.id === selectedHeaderId) || HEADER_LINES[0];

  return (
    <div className="w-full bg-[#181410] border border-[#3a352c] rounded-md p-5 sm:p-7 shadow-2xl space-y-6 font-sans">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#3a352c]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm bg-[rgba(201,162,39,0.15)] border border-[rgba(201,162,39,0.35)] text-[var(--stamp)] font-mono text-xs font-bold uppercase mb-2">
            <Eye className="w-3.5 h-3.5" />
            <span>Interactive Header X-Ray</span>
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-bold text-[var(--paper)]">
            How attackers manipulate raw email headers
          </h3>
          <p className="text-xs sm:text-sm text-[var(--paper-dim)] mt-1">
            Click any RFC822 header below to see how cybercriminals deceive inboxes and how TraceXMail exposes them.
          </p>
        </div>

        <span className="text-xs font-mono text-[var(--slate)] bg-[#100e0c] px-3 py-1.5 rounded-sm border border-[#2e2a22] shrink-0 self-start md:self-auto">
          RFC5322 Protocol Deep Dive
        </span>
      </div>

      {/* Main 2-Column Inspector Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Interactive Header Line Selector (5 cols) */}
        <div className="lg:col-span-5 space-y-2">
          <span className="text-[11px] font-mono text-[var(--paper-muted)] uppercase tracking-wider font-semibold block mb-1">
            Select a Header to Deconstruct:
          </span>
          {HEADER_LINES.map((h) => {
            const isSelected = h.id === selectedHeaderId;
            return (
              <button
                key={h.id}
                onClick={() => setSelectedHeaderId(h.id)}
                className={`w-full text-left p-3 rounded-sm border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#241e17] border-[var(--thread)] shadow-md'
                    : 'bg-[#12100d] border-[#2e2a22] hover:border-[#4a4438]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-[var(--paper)]">
                    {h.field.split(' ')[0]}
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-sm ${
                    h.risk === 'CRITICAL'
                      ? 'bg-[rgba(178,58,46,0.2)] text-[var(--rose-400)] border border-[rgba(178,58,46,0.35)]'
                      : 'bg-[rgba(201,162,39,0.2)] text-[var(--stamp)] border border-[rgba(201,162,39,0.35)]'
                  }`}>
                    {h.risk}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-[var(--paper-dim)] truncate">
                  {h.rawText}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Detailed Deep-Dive Forensic Card (7 cols) */}
        <div className="lg:col-span-7 bg-[#100e0c] border border-[#3a352c] rounded-sm p-5 space-y-4">
          
          {/* Header Code Raw Box */}
          <div className="bg-[#181410] border border-[#3a352c] rounded-sm p-3 font-mono text-xs text-[var(--paper)] relative">
            <span className="text-[10px] text-[var(--paper-muted)] uppercase font-bold block mb-1">
              Selected Header Line (Raw RFC822)
            </span>
            <div className="text-[var(--rose-400)] font-bold break-all">
              {activeHeader.rawText}
            </div>
          </div>

          {/* Explanation 1: What it Means */}
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold text-[var(--slate)] uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>Standard RFC Meaning</span>
            </span>
            <p className="text-xs sm:text-sm text-[var(--paper-dim)] leading-relaxed bg-[#14120f] p-3 rounded-[3px] border border-[#28241d]">
              {activeHeader.whatItMeans}
            </p>
          </div>

          {/* Explanation 2: Attacker Manipulation Trick */}
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold text-[var(--rose-400)] uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-[var(--rose-400)]" />
              <span>How Attackers Exploit It</span>
            </span>
            <p className="text-xs sm:text-sm text-[var(--paper)] leading-relaxed bg-[rgba(178,58,46,0.08)] p-3 rounded-[3px] border border-[rgba(178,58,46,0.3)]">
              {activeHeader.attackerTrick}
            </p>
          </div>

          {/* Explanation 3: TraceXMail Extraction Solution */}
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold text-[var(--forensic-green)] uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--forensic-green)]" />
              <span>How TraceXMail Unmasks It</span>
            </span>
            <p className="text-xs sm:text-sm text-[var(--paper-dim)] leading-relaxed bg-[rgba(72,169,117,0.08)] p-3 rounded-[3px] border border-[rgba(72,169,117,0.25)]">
              {activeHeader.forensicExtraction}
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
