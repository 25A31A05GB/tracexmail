import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Terminal, 
  UserCheck, 
  HelpCircle, 
  ArrowRight, 
  Sparkles, 
  Globe, 
  Lock, 
  Cpu, 
  FileSearch,
  Eye,
  Check,
  ChevronRight,
  Info
} from 'lucide-react';
import { SAMPLE_ANALYSES } from '../../data/samples';
import { EmailAnalysis } from '../../types';

interface HumanExplainerInteractiveProps {
  onOpenConsole?: () => void;
  onSelectCase?: (analysis: EmailAnalysis) => void;
}

interface JargonTerm {
  term: string;
  simpleName: string;
  analogy: string;
  icon: string;
}

const JARGON_DECODER: JargonTerm[] = [
  {
    term: 'SPF',
    simpleName: 'The Sender\'s Digital ID Card',
    analogy: 'Like checking if the mail carrier actually works for the company on the envelope. If the sender IP is not on the company\'s authorized list, it fails.',
    icon: '🪪'
  },
  {
    term: 'DKIM',
    simpleName: 'Tamper-Proof Wax Seal',
    analogy: 'A cryptographic signature stamped on the email. If an attacker modifies even a single letter in transit, the seal is broken and alarm bells ring.',
    icon: '📜'
  },
  {
    term: 'DMARC',
    simpleName: 'Shred-If-Fake Instructions',
    analogy: 'The company\'s published policy telling email providers: "If someone sends mail claiming to be us without our ID or Seal, block or delete it immediately."',
    icon: '🛡️'
  },
  {
    term: 'Tor Exit Node',
    simpleName: 'Masked Disguise Server',
    analogy: 'The sender routed their connection through encrypted anonymous relays across different countries so you can\'t easily see their real location.',
    icon: '🎭'
  },
  {
    term: 'Lookalike Domain',
    simpleName: 'Counterfeit Twin Website',
    analogy: 'A domain registered by scammers that looks nearly identical at first glance (e.g. "paypal-security-check.com" instead of the real "paypal.com").',
    icon: '🪞'
  }
];

export const HumanExplainerInteractive: React.FC<HumanExplainerInteractiveProps> = ({
  onOpenConsole,
  onSelectCase
}) => {
  const [selectedCaseIdx, setSelectedCaseIdx] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'human' | 'analyst'>('human');
  const [activeJargon, setActiveJargon] = useState<JargonTerm | null>(null);

  const cases = [
    {
      id: 'paypal',
      sampleIndex: 0,
      badge: 'URGENT SCAM',
      title: 'Fake PayPal Restriction Notice',
      senderDisplay: 'PayPal Security Team',
      senderEmail: 'security@paypal-account-security-update.com',
      realOrigin: 'Sofia, Bulgaria (Tor Exit Relay AS200548)',
      threatScore: 98,
      isMalicious: true,
      humanHeadline: 'Danger: Fraudulent Imposter Email',
      humanSummary: 'This email claims to be PayPal saying your account is suspended, but it actually came from an anonymous server in Bulgaria. It contains a fake link created to steal your login credentials.',
      threeAnswers: [
        {
          q: 'Who really sent it?',
          a: 'Not PayPal. Sent from an anonymous Tor server in Bulgaria using a fake copycat domain.',
          status: 'danger'
        },
        {
          q: 'What is it trying to steal?',
          a: 'Your PayPal username, password, and credit card by tricking you into a lookalike fake page.',
          status: 'danger'
        },
        {
          q: 'What should you do right now?',
          a: 'Do NOT click any links. Delete this email or report it to your IT / security team.',
          status: 'action'
        }
      ],
      analystHops: [
        { hop: 1, ip: '185.220.101.5', loc: 'Sofia, BG', asn: 'AS200548 (Tor Node)', status: 'MALICIOUS' },
        { hop: 2, ip: '194.26.29.112', loc: 'Chisinau, MD', asn: 'AS57523 (Bulletproof)', status: 'SUSPICIOUS' },
        { hop: 3, ip: '142.250.102.26', loc: 'Mountain View, US', asn: 'AS15169 (Google MX)', status: 'CLEAN' }
      ],
      analystAuth: {
        spf: 'FAIL (IP 185.220.101.5 unauthorized in spf.paypal.com)',
        dkim: 'FAIL (body hash mismatch / invalid RSA signature)',
        dmarc: 'FAIL (p=reject enforced by target policy)'
      }
    },
    {
      id: 'citibank',
      sampleIndex: 1,
      badge: 'MALWARE ATTACK',
      title: 'Fake $48,200 Wire Transfer Confirmation',
      senderDisplay: 'CitiBank Wire Clearing',
      senderEmail: 'wire-clearing@citibank-transfer-authorization.net',
      realOrigin: 'Chisinau, Moldova (AlexHost Bulletproof AS57523)',
      threatScore: 99,
      isMalicious: true,
      humanHeadline: 'Critical: Trojan Virus Attachment Disguised as PDF',
      humanSummary: 'An urgent fake bank wire notice that carries a hidden virus inside an attachment labeled "WireReceipt.pdf.exe". Opening it will install spyware on your computer.',
      threeAnswers: [
        {
          q: 'Who really sent it?',
          a: 'An offshore bulletproof hosting network in Eastern Europe, posing as CitiBank.',
          status: 'danger'
        },
        {
          q: 'What is it trying to do?',
          a: 'Trick you into downloading an invoice that infects your computer with an AsyncRAT remote access trojan.',
          status: 'danger'
        },
        {
          q: 'What should you do right now?',
          a: 'Do NOT download or open the attachment. Flag as malicious immediately.',
          status: 'action'
        }
      ],
      analystHops: [
        { hop: 1, ip: '194.26.29.112', loc: 'AlexHost, MD', asn: 'AS57523 (Bulletproof)', status: 'MALICIOUS' },
        { hop: 2, ip: '185.190.140.22', loc: 'Frankfurt, DE', asn: 'AS9009 (M247 Relay)', status: 'SUSPICIOUS' },
        { hop: 3, ip: '104.47.74.36', loc: 'Microsoft O365', asn: 'AS8075 (Inbound MX)', status: 'CLEAN' }
      ],
      analystAuth: {
        spf: 'SOFTFAIL (194.26.29.112 not included in citigroup.com)',
        dkim: 'NONE (No cryptographic signature present)',
        dmarc: 'FAIL (Domain alignment 0%)'
      }
    },
    {
      id: 'github',
      sampleIndex: 2,
      badge: 'VERIFIED AUTHENTIC',
      title: 'Legitimate GitHub Token Security Notice',
      senderDisplay: 'GitHub Security',
      senderEmail: 'notifications@github.com',
      realOrigin: 'San Francisco, USA (GitHub Authentic CIDR AS36459)',
      threatScore: 2,
      isMalicious: false,
      humanHeadline: 'Safe: Authenticated Legitimate Notification',
      humanSummary: 'This is a genuine security email directly from GitHub notifying you about an active token. All cryptographic signatures match GitHub\'s official servers perfectly.',
      threeAnswers: [
        {
          q: 'Who really sent it?',
          a: 'GitHub Inc. Verified via 2048-bit cryptographic RSA digital signature.',
          status: 'safe'
        },
        {
          q: 'Is it trying to trick you?',
          a: 'No. This is standard notification traffic with authentic destination links to github.com.',
          status: 'safe'
        },
        {
          q: 'What should you do?',
          a: 'Safe to read and archive. No action necessary unless you didn\'t generate the token.',
          status: 'safe'
        }
      ],
      analystHops: [
        { hop: 1, ip: '192.30.252.204', loc: 'San Francisco, US', asn: 'AS36459 (GitHub Core)', status: 'CLEAN' },
        { hop: 2, ip: '142.250.102.26', loc: 'Google MX Enclave', asn: 'AS15169', status: 'CLEAN' }
      ],
      analystAuth: {
        spf: 'PASS (192.30.252.204 matches _spf.github.com)',
        dkim: 'PASS (valid 2048-bit RSA header.i=@github.com)',
        dmarc: 'PASS (full alignment with github.com)'
      }
    }
  ];

  const currentCase = cases[selectedCaseIdx];

  const handleLaunchDeepInspection = () => {
    const sample = SAMPLE_ANALYSES[currentCase.sampleIndex] || SAMPLE_ANALYSES[0];
    if (onSelectCase) {
      onSelectCase(sample);
    }
    if (onOpenConsole) {
      onOpenConsole();
    }
  };

  return (
    <div className="w-full bg-[#110f0c] border border-[#3a352c] rounded-lg p-5 sm:p-7 shadow-2xl relative overflow-hidden">
      {/* Decorative ambient backdrop */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-500/5 via-transparent to-transparent pointer-events-none" />

      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#3a352c]/70 pb-5 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[2px] bg-[#c9a227]/10 border border-[#c9a227]/30 text-[#c9a227] font-mono text-[11px] mb-2 uppercase font-bold">
            <Sparkles className="w-3.5 h-3.5 text-[#c9a227]" />
            <span>Interactive Forensic Decrypter</span>
          </div>
          <h3 className="font-['Source_Serif_4',serif] text-2xl sm:text-3xl font-semibold text-[#ede6d8]">
            Complex Email Headers, Translated for Anyone
          </h3>
          <p className="text-[#b9af9c] text-sm mt-1 max-w-2xl">
            You don't need a cybersecurity degree to know if an email is safe. Switch between plain English and deep forensic traces below.
          </p>
        </div>

        {/* View Mode Toggle: Human vs Analyst */}
        <div className="flex items-center gap-1 p-1 bg-[#1a1712] border border-[#3a352c] rounded-md self-start md:self-center shadow-inner">
          <button
            onClick={() => setViewMode('human')}
            className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
              viewMode === 'human'
                ? 'bg-[#c9a227] text-[#14120f] shadow-sm font-bold'
                : 'text-[#9c9186] hover:text-[#ede6d8]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>👶 Plain English View</span>
          </button>
          <button
            onClick={() => setViewMode('analyst')}
            className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 font-mono ${
              viewMode === 'analyst'
                ? 'bg-[#2b241e] text-[#4ade80] border border-[#4ade80]/40 shadow-sm'
                : 'text-[#9c9186] hover:text-[#ede6d8]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>🛡️ SOC Analyst View</span>
          </button>
        </div>
      </div>

      {/* Case Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-xs font-mono text-[#8a8070] mr-2 hidden sm:inline">SELECT SAMPLE:</span>
        {cases.map((c, idx) => (
          <button
            key={c.id}
            onClick={() => setSelectedCaseIdx(idx)}
            className={`px-3.5 py-1.5 rounded text-xs transition-all cursor-pointer flex items-center gap-2 border ${
              selectedCaseIdx === idx
                ? 'bg-[#241f18] text-[#ede6d8] border-[#c9a227] shadow-[0_0_12px_rgba(201,162,39,0.2)] font-semibold'
                : 'bg-[#181511] text-[#9c9186] border-[#2e2820] hover:text-[#ede6d8] hover:border-[#3a352c]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${c.isMalicious ? 'bg-[#ef4444]' : 'bg-[#22c55e]'}`} />
            <span>{c.title}</span>
          </button>
        ))}
      </div>

      {/* Main Interactive Card Container with Spring Motion Scale & Dynamic Shadow */}
      <motion.div
        key={`${currentCase.id}-${viewMode}`}
        initial={{ opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 340, damping: 26 }}
        whileHover={{
          scale: 1.018,
          y: -3,
          boxShadow: currentCase.isMalicious 
            ? '0 24px 48px -12px rgba(178,58,46,0.25), 0 0 30px rgba(178,58,46,0.15)' 
            : '0 24px 48px -12px rgba(74,222,128,0.2), 0 0 30px rgba(74,222,128,0.1)',
          transition: { type: 'spring', stiffness: 400, damping: 25 }
        }}
        className={`rounded-lg border p-5 sm:p-7 relative transition-all duration-300 ${
          currentCase.isMalicious
            ? 'bg-gradient-to-br from-[#1f1614] via-[#171310] to-[#120f0c] border-[#b23a2e]/60 shadow-[0_12px_32px_rgba(0,0,0,0.5)]'
            : 'bg-gradient-to-br from-[#121f16] via-[#101912] to-[#0d140e] border-[#22c55e]/50 shadow-[0_12px_32px_rgba(0,0,0,0.5)]'
        }`}
      >
        {/* Rubber-Stamp Style Animated Verdict Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-[#3a352c]/50 pb-4">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 2.2, rotate: -15, opacity: 0 }}
              animate={{ scale: 1, rotate: currentCase.isMalicious ? -3 : 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 450, damping: 22 }}
              className={`px-3 py-1 rounded border-2 font-mono text-xs font-black tracking-wider uppercase flex items-center gap-1.5 shadow-lg ${
                currentCase.isMalicious
                  ? 'bg-rose-950/90 text-rose-300 border-rose-600 shadow-rose-950/50'
                  : 'bg-emerald-950/90 text-emerald-300 border-emerald-500 shadow-emerald-950/50'
              }`}
            >
              {currentCase.isMalicious ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              <span>{currentCase.badge}</span>
              <span className="opacity-80 font-normal">({currentCase.threatScore}/100)</span>
            </motion.div>
            <span className="text-xs font-mono text-[#8a8070] hidden md:inline">
              Origin: {currentCase.realOrigin}
            </span>
          </div>

          <button
            onClick={handleLaunchDeepInspection}
            className="text-xs font-mono text-[#c9a227] hover:text-[#f3cc52] flex items-center gap-1 cursor-pointer bg-transparent border-none transition-colors self-start sm:self-auto"
          >
            <span>Open in Full Analyst Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* BODY: Mode Switcher Rendering */}
        {viewMode === 'human' ? (
          /* HUMAN PLAIN ENGLISH VIEW */
          <div className="space-y-6">
            <div>
              <h4 className="font-['Source_Serif_4',serif] text-xl sm:text-2xl font-semibold text-[#ede6d8] mb-2">
                {currentCase.humanHeadline}
              </h4>
              <p className="text-[#d8cfc0] text-[15px] sm:text-[16px] leading-relaxed">
                {currentCase.humanSummary}
              </p>
            </div>

            {/* The 3 Core Answers Anyone Needs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
              {currentCase.threeAnswers.map((ans, i) => (
                <div 
                  key={i} 
                  className={`p-4 rounded-md border flex flex-col justify-between ${
                    ans.status === 'danger'
                      ? 'bg-[#291715]/70 border-rose-900/60 text-[#fca5a5]'
                      : ans.status === 'action'
                      ? 'bg-[#2b2014]/70 border-amber-800/60 text-[#fde68a]'
                      : 'bg-[#15271c]/70 border-emerald-900/60 text-[#86efac]'
                  }`}
                >
                  <div className="font-semibold text-xs tracking-wide uppercase flex items-center gap-1.5 mb-2 text-[#ede6d8]">
                    {ans.status === 'danger' ? (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : ans.status === 'action' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    <span>{ans.q}</span>
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-[#ede6d8]/90 font-sans">
                    {ans.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* SOC ANALYST FORENSIC VIEW */
          <div className="space-y-5 font-mono text-xs">
            {/* Header info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#14120f]/80 p-3.5 rounded border border-[#3a352c]/70">
              <div>
                <span className="text-[#8e8574]">FROM HEADER: </span>
                <span className="text-[#ede6d8] break-all">{currentCase.senderDisplay} &lt;{currentCase.senderEmail}&gt;</span>
              </div>
              <div>
                <span className="text-[#8e8574]">VERIFIED ORIGIN: </span>
                <span className={currentCase.isMalicious ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                  {currentCase.realOrigin}
                </span>
              </div>
            </div>

            {/* Cryptographic Auth Results */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-[#c9a227] uppercase tracking-wider">
                Cryptographic Authentication Proof
              </div>
              <div className="space-y-1.5">
                <div className="p-2 rounded bg-[#181511] border border-[#2e2820] flex items-center justify-between">
                  <span className="text-[#8e8574]">SPF:</span>
                  <span className={currentCase.analystAuth.spf.startsWith('PASS') ? 'text-emerald-400' : 'text-rose-400'}>
                    {currentCase.analystAuth.spf}
                  </span>
                </div>
                <div className="p-2 rounded bg-[#181511] border border-[#2e2820] flex items-center justify-between">
                  <span className="text-[#8e8574]">DKIM:</span>
                  <span className={currentCase.analystAuth.dkim.startsWith('PASS') ? 'text-emerald-400' : 'text-rose-400'}>
                    {currentCase.analystAuth.dkim}
                  </span>
                </div>
                <div className="p-2 rounded bg-[#181511] border border-[#2e2820] flex items-center justify-between">
                  <span className="text-[#8e8574]">DMARC:</span>
                  <span className={currentCase.analystAuth.dmarc.startsWith('PASS') ? 'text-emerald-400' : 'text-rose-400'}>
                    {currentCase.analystAuth.dmarc}
                  </span>
                </div>
              </div>
            </div>

            {/* Network Hops Table */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-[#c9a227] uppercase tracking-wider">
                Physical Server Relay Hops (Reverse Traceroute)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#3a352c] text-[#8a8070] text-[10px]">
                      <th className="py-1 px-2">HOP</th>
                      <th className="py-1 px-2">IP ADDRESS</th>
                      <th className="py-1 px-2">PHYSICAL LOCATION</th>
                      <th className="py-1 px-2">ROUTING ASN</th>
                      <th className="py-1 px-2">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a241c]">
                    {currentCase.analystHops.map((h) => (
                      <tr key={h.hop} className="hover:bg-[#1a1712]">
                        <td className="py-1.5 px-2 text-[#c9a227]">#{h.hop}</td>
                        <td className="py-1.5 px-2 text-[#ede6d8]">{h.ip}</td>
                        <td className="py-1.5 px-2 text-[#b9af9c]">{h.loc}</td>
                        <td className="py-1.5 px-2 text-[#8a8070]">{h.asn}</td>
                        <td className="py-1.5 px-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            h.status === 'MALICIOUS' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                            h.status === 'SUSPICIOUS' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                            'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          }`}>
                            {h.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Interactive Metaphor Jargon Decoder Bar */}
      <div className="mt-7 pt-5 border-t border-[#3a352c]/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-xs font-mono text-[#c9a227] font-semibold uppercase">
            <HelpCircle className="w-4 h-4 text-[#c9a227]" />
            <span>Interactive Jargon Decoder (Hover or Tap any term)</span>
          </div>
          <span className="text-[11px] font-mono text-[#8a8070]">
            Everyday analogies for technical email terms
          </span>
        </div>

        {/* Decoder Pills */}
        <div className="flex flex-wrap gap-2">
          {JARGON_DECODER.map((item) => (
            <button
              key={item.term}
              onClick={() => setActiveJargon(activeJargon?.term === item.term ? null : item)}
              onMouseEnter={() => setActiveJargon(item)}
              className={`px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer flex items-center gap-1.5 border ${
                activeJargon?.term === item.term
                  ? 'bg-[#c9a227] text-[#14120f] border-[#c9a227] font-bold shadow-md'
                  : 'bg-[#181511] text-[#ede6d8] border-[#3a352c] hover:border-[#c9a227]/60 hover:bg-[#221e18]'
              }`}
            >
              <span>{item.icon}</span>
              <span className="font-mono font-semibold">{item.term}</span>
              <span className="opacity-70 text-[11px] hidden sm:inline">({item.simpleName})</span>
            </button>
          ))}
        </div>

        {/* Expanded Jargon Explanation Drawer with Motion Spring */}
        <AnimatePresence>
          {activeJargon && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -6 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -6 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="mt-3.5 p-4 rounded-lg bg-[#1f1a14] border border-[#c9a227]/40 shadow-lg text-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-[#ede6d8] text-sm">
                    <span>{activeJargon.icon}</span>
                    <span className="font-mono text-[#c9a227]">{activeJargon.term}</span>
                    <span className="text-[#8a8070] font-normal">—</span>
                    <span className="text-[#ede6d8]">{activeJargon.simpleName}</span>
                  </div>
                  <p className="text-[#b9af9c] text-[13.5px] leading-relaxed font-sans pt-1">
                    {activeJargon.analogy}
                  </p>
                </div>
                <button
                  onClick={() => setActiveJargon(null)}
                  className="text-[#8a8070] hover:text-[#ede6d8] text-xs p-1 cursor-pointer bg-transparent border-none"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
