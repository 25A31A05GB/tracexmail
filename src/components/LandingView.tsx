import React, { useState } from 'react';
import {
  Menu,
  X,
  Terminal,
  ArrowUpRight,
  Layers,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Upload,
  Zap,
  Route,
  ShieldCheck,
  Sparkles,
  Mail,
  Server,
  Network,
  Shield,
  Lock,
  Activity,
  Box,
  Eye,
  FileSearch,
  ExternalLink,
  Users,
  Compass,
  AlertTriangle,
  Scale,
  FileText,
  Binary,
  Fingerprint,
  Globe,
  Cpu,
  AlertOctagon
} from 'lucide-react';
import { SAMPLE_ANALYSES } from '../data/samples';
import { EmailAnalysis } from '../types';
import { TraceXLogo } from './common/TraceXLogo';
import { HeroEvidenceBoard } from './landing/HeroEvidenceBoard';
import { LiveDynamicTelemetryRibbon } from './landing/LiveDynamicTelemetryRibbon';

interface LandingViewProps {
  onOpenConsole: () => void;
  onOpenTrace: () => void;
  onRequestAccess?: () => void;
  onSelectCase?: (analysis: EmailAnalysis) => void;
}

export function LandingView({
  onOpenConsole,
  onOpenTrace,
  onRequestAccess,
  onSelectCase
}: LandingViewProps) {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const sampleCases = [
    {
      id: 'sample-0',
      index: 0,
      name: SAMPLE_ANALYSES[0]?.name || 'Nazario Phish: PayPal Urgent Restriction',
      corpus: 'Nazario Corpus',
      verdict: SAMPLE_ANALYSES[0]?.verdict || 'MALICIOUS PHISH',
      threatScore: SAMPLE_ANALYSES[0]?.riskScore ?? 98,
      subject: SAMPLE_ANALYSES[0]?.headers?.subject || '[URGENT] Your PayPal Account Has Been Temporarily Restricted',
      signals: [
        'SPF softfail + Tor exit node origin (185.220.101.5, Sofia, Bulgaria)',
        'DMARC p=reject fail with lookalike domain paypal-account-security-update.com',
      ],
      originHint: 'Tor Relay • AS200548',
    },
    {
      id: 'sample-1',
      index: 1,
      name: SAMPLE_ANALYSES[1]?.name || 'Nazario Phish: CitiBank Wire Transfer Authorization',
      corpus: 'Nazario Corpus',
      verdict: SAMPLE_ANALYSES[1]?.verdict || 'MALICIOUS PHISH',
      threatScore: SAMPLE_ANALYSES[1]?.riskScore ?? 99,
      subject: SAMPLE_ANALYSES[1]?.headers?.subject || 'Action Required: Pending Wire Transfer of $48,200.00 Ref #CT-88902',
      signals: [
        'SPF softfail with bulletproof relay origin (194.26.29.112, AlexHost Moldova)',
        'Disguised .pdf.exe attachment harboring AsyncRAT binary executable payload',
      ],
      originHint: 'AlexHost • AS57523',
    },
    {
      id: 'sample-2',
      index: 2,
      name: SAMPLE_ANALYSES[2]?.name || 'Legitimate: GitHub Security Alert',
      corpus: 'Enterprise Traffic',
      verdict: SAMPLE_ANALYSES[2]?.verdict || 'LEGITIMATE',
      threatScore: SAMPLE_ANALYSES[2]?.riskScore ?? 2,
      subject: SAMPLE_ANALYSES[2]?.headers?.subject || '[GitHub] A personal access token has been generated on your account',
      signals: [
        'Cryptographic SPF Pass (192.30.252.204) + valid 2048-bit RSA DKIM Pass',
        'Full DMARC alignment verified against authentic GitHub CIDR block',
      ],
      originHint: 'GitHub CIDR • AS36459',
    },
  ];

  const teamMembers = [
    {
      agentId: 'AGENT-01',
      name: 'Jayaram Sappa',
      role: 'System Design & Backend Engineering',
      dotColor: 'bg-[#b23a2e]',
    },
    {
      agentId: 'AGENT-02',
      name: 'Vennela Obilisetti',
      role: 'Threat Intelligence',
      dotColor: 'bg-[#c9a227]',
    },
    {
      agentId: 'AGENT-03',
      name: 'Katari Pavan Sai Krishna',
      role: 'Machine Learning',
      dotColor: 'bg-[#60a5fa]',
    },
    {
      agentId: 'AGENT-04',
      name: 'Eeli Hema Venkata Lalitha',
      role: 'Digital Forensics',
      dotColor: 'bg-[#b23a2e]',
    },
    {
      agentId: 'AGENT-05',
      name: 'Sairam Saladi',
      role: 'Database Integration',
      dotColor: 'bg-[#c9a227]',
    },
    {
      agentId: 'AGENT-06',
      name: 'Penugonda Mounika',
      role: 'Frontend Engineering',
      dotColor: 'bg-[#60a5fa]',
    }
  ];

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCaseClick = (index: number) => {
    const sample = SAMPLE_ANALYSES[index] || SAMPLE_ANALYSES[0];
    if (onSelectCase) {
      onSelectCase(sample);
    }
    onOpenConsole();
  };

  const toggleFaq = (index: number) => {
    setActiveFaq(prev => (prev === index ? null : index));
  };

  return (
    <div className="w-full min-h-screen bg-[#14120f] text-[#ede6d8] font-['IBM_Plex_Sans',sans-serif] text-[16px] leading-[1.6] antialiased selection:bg-[#b23a2e] selection:text-[#ede6d8] relative pb-20 sm:pb-0">
      
      {/* Top Header Navigation */}
      <nav className="sticky top-0 z-50 bg-[#14120f]/95 backdrop-blur-md border-b border-[#3a352c]">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TraceXLogo size="sm" onClick={onOpenConsole} title="TraceXMail Forensic Core" />
            <span className="font-['Fraunces',serif] text-[18px] sm:text-[20px] font-semibold text-[#ede6d8]">
              TraceXMail
            </span>
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] bg-[#1f1a14] border border-[#3a352c] text-[11px] font-['IBM_Plex_Mono',monospace] text-[#c9a227]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
              <span>CASE-XM-01</span>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <div className="hidden lg:flex items-center gap-6 text-[13.5px]">
            <button onClick={() => scrollToSection('telemetry-feed')} className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors bg-transparent border-none cursor-pointer">
              Live Feed
            </button>
            <button onClick={() => scrollToSection('challenges-solution')} className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors bg-transparent border-none cursor-pointer">
              Why TraceXMail
            </button>
            <button onClick={() => scrollToSection('corpus-proof')} className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors bg-transparent border-none cursor-pointer">
              Corpus Proof
            </button>
            <button onClick={() => scrollToSection('workstation')} className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors bg-transparent border-none cursor-pointer">
              Workstation
            </button>
            <button onClick={() => scrollToSection('exhibits')} className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors bg-transparent border-none cursor-pointer">
              Engineering
            </button>
            <button onClick={() => scrollToSection('team')} className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors bg-transparent border-none cursor-pointer">
              Team
            </button>
            <button onClick={() => scrollToSection('faq')} className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors bg-transparent border-none cursor-pointer">
              FAQ
            </button>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <button
              onClick={onOpenConsole}
              className="text-[#b9af9c] hover:text-[#ede6d8] text-[13.5px] px-2 py-1 bg-transparent border-none cursor-pointer transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={onOpenConsole}
              className="bg-[#b23a2e] hover:bg-[#c94a3d] text-[#ede6d8] px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-[3px] text-[13px] sm:text-[14px] font-semibold transition-all cursor-pointer shadow-sm flex items-center gap-1.5 active:scale-[0.98]"
            >
              <span>Open Console (Free)</span>
              <ArrowRight className="w-3.5 h-3.5 hidden sm:inline" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-[#b9af9c] hover:text-[#ede6d8] hover:bg-[#1d1a15] rounded-[3px] transition-colors cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#1a1712] border-b border-[#3a352c] px-4 py-3 flex flex-col gap-2">
            <button
              onClick={() => { scrollToSection('telemetry-feed'); setMobileMenuOpen(false); }}
              className="text-left text-[#ede6d8] py-2 px-3 rounded hover:bg-[#26221b] text-[14.5px]"
            >
              Live Telemetry Feed
            </button>
            <button
              onClick={() => { scrollToSection('challenges-solution'); setMobileMenuOpen(false); }}
              className="text-left text-[#ede6d8] py-2 px-3 rounded hover:bg-[#26221b] text-[14.5px]"
            >
              Why TraceXMail (Challenges &amp; Solution)
            </button>
            <button
              onClick={() => { scrollToSection('corpus-proof'); setMobileMenuOpen(false); }}
              className="text-left text-[#ede6d8] py-2 px-3 rounded hover:bg-[#26221b] text-[14.5px]"
            >
              Corpus Proof
            </button>
            <button
              onClick={() => { scrollToSection('workstation'); setMobileMenuOpen(false); }}
              className="text-left text-[#ede6d8] py-2 px-3 rounded hover:bg-[#26221b] text-[14.5px]"
            >
              Analyst Workstation
            </button>
            <button
              onClick={() => { scrollToSection('exhibits'); setMobileMenuOpen(false); }}
              className="text-left text-[#ede6d8] py-2 px-3 rounded hover:bg-[#26221b] text-[14.5px]"
            >
              Core Engineering
            </button>
            <button
              onClick={() => { scrollToSection('team'); setMobileMenuOpen(false); }}
              className="text-left text-[#ede6d8] py-2 px-3 rounded hover:bg-[#26221b] text-[14.5px]"
            >
              Team &amp; Creators
            </button>
            <button
              onClick={() => { scrollToSection('faq'); setMobileMenuOpen(false); }}
              className="text-left text-[#ede6d8] py-2 px-3 rounded hover:bg-[#26221b] text-[14.5px]"
            >
              FAQ
            </button>
            <div className="pt-2 border-t border-[#3a352c]">
              <button
                onClick={() => { onOpenConsole(); setMobileMenuOpen(false); }}
                className="w-full bg-[#b23a2e] text-[#ede6d8] py-2.5 rounded font-semibold text-[14px] text-center cursor-pointer"
              >
                Launch Forensic Console
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="py-12 sm:py-16 border-b border-[#3a352c] relative bg-[radial-gradient(ellipse_700px_380px_at_80%_10%,rgba(178,58,46,0.1),transparent_65%),#14120f]">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center relative z-10">
          
          <div className="lg:col-span-6 space-y-4 sm:space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[3px] bg-[#1f1a14] border border-[#3d2f1f] text-[12px] font-['IBM_Plex_Mono',monospace] text-[#c9a227]">
              <TraceXLogo size="xs" />
              <span>TraceXMail Forensic Core v2.4</span>
            </div>

            <h1 className="font-['Source_Serif_4',serif] font-semibold text-[30px] xs:text-[36px] sm:text-[44px] leading-[1.15] text-[#ede6d8] tracking-tight">
              Every phishing email leaves a trail. We follow it to the source.
            </h1>
            
            <p className="text-[#b9af9c] text-[15px] sm:text-[16.5px] leading-relaxed">
              TraceXMail reconstructs an email's real path: headers, authentication, hops, and infrastructure, turned into evidence your SOC can act on and defend in front of whoever asks how you know.
            </p>

            <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-3 pt-2">
              <button
                onClick={onOpenConsole}
                className="text-center bg-[#b23a2e] hover:bg-[#c94a3d] text-[#ede6d8] px-6 py-3.5 rounded-[3px] font-semibold text-[15px] border border-[#b23a2e] transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2 group"
              >
                <span>Analyze Email Now Free</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => scrollToSection('corpus-proof')}
                className="text-center px-5 py-3.5 rounded-[3px] font-medium text-[15px] border border-[#3a352c] text-[#ede6d8] hover:border-[#b9af9c] hover:bg-[#1d1a15] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Route className="w-4 h-4 text-[#c9a227]" />
                <span>Inspect Corpus Proof</span>
              </button>
            </div>
          </div>

          {/* Hero Visual Area: Highlighted Evidence Board */}
          <div className="lg:col-span-6 w-full space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[3px] bg-[#1a1712] border border-[#b23a2e]/40 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#b23a2e] animate-pulse" />
                <span className="text-[11px] font-['IBM_Plex_Mono',monospace] text-[#ff8d7d] uppercase tracking-wider font-semibold">
                  PRIMARY FORENSIC DOSSIER • EVIDENCE BOARD
                </span>
              </div>
              <span className="text-[11px] font-['IBM_Plex_Mono',monospace] text-[#8e8574] hidden sm:inline">
                AUTHENTIC RECONSTRUCTION
              </span>
            </div>

            <div className="relative rounded-[6px] p-1 bg-gradient-to-b from-[#3a352c] via-[#241f18] to-[#1a1712] shadow-2xl border border-[#b23a2e]/40">
              <HeroEvidenceBoard
                onExploreCase={handleCaseClick}
                onOpenConsole={onOpenConsole}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Real-Time Live Telemetry Ribbon Section */}
      <section id="telemetry-feed" className="py-6 border-b border-[#3a352c] bg-[#181511]">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
          <LiveDynamicTelemetryRibbon
            onSelectCase={onSelectCase}
            onOpenConsole={onOpenConsole}
          />
        </div>
      </section>



      {/* Dedicated Section: Attack Vector Taxonomy, Forensic Countermeasures & Architectural Differences */}
      <section id="challenges-solution" className="py-16 sm:py-24 border-b border-[#3a352c] bg-[#171410]">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header */}
          <div className="max-w-4xl mb-12">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[2px] bg-[#c9a227]/10 border border-[#c9a227]/30 text-[#c9a227] font-['IBM_Plex_Mono',monospace] text-[11px] mb-2.5 uppercase font-bold">
              SECURITY CHALLENGES &amp; OUR SOLUTIONS
            </div>
            <h2 className="font-['Source_Serif_4',serif] font-semibold text-[28px] sm:text-[38px] text-[#ede6d8] leading-tight">
              Why Regular Spam Filters Fail &amp; How TraceXMail Solves It
            </h2>
            <p className="text-[#b9af9c] mt-3 text-[16px] leading-relaxed font-sans">
              Traditional filters only scan basic words and links. TraceXMail follows the email's physical server route, validates real digital signatures, and delivers verifiable proof.
            </p>
          </div>

          {/* Part 2: Forensic Architecture Comparison Matrix */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]" />
              <h3 className="font-['Source_Serif_4',serif] font-semibold text-[20px] sm:text-[22px] text-[#ede6d8]">
                How TraceXMail Compares to Other Security Tools
              </h3>
            </div>

            <div className="overflow-x-auto border border-[#3a352c] rounded-[4px] bg-[#1d1a15]">
              <table className="w-full text-left text-[13.5px] border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-[#3a352c] bg-[#14120f] font-mono text-[11px] text-[#8e8574] uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">Security Feature</th>
                    <th className="py-3 px-4 font-semibold">Standard Email Filters</th>
                    <th className="py-3 px-4 font-semibold">Basic Antivirus Scanners</th>
                    <th className="py-3 px-4 font-semibold text-[#c9a227] bg-[#241f17]">TraceXMail Forensic Core</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3a352c]/60">
                  <tr className="hover:bg-[#221e18] transition-colors">
                    <td className="py-3.5 px-4 font-medium text-[#ede6d8]">How it detects threats</td>
                    <td className="py-3.5 px-4 text-[#b9af9c]">Keywords and basic spam words</td>
                    <td className="py-3.5 px-4 text-[#b9af9c]">Known virus signatures only</td>
                    <td className="py-3.5 px-4 text-[#4ade80] font-semibold bg-[#241f17]/40">Physical server hops + cryptographic key verification</td>
                  </tr>
                  <tr className="hover:bg-[#221e18] transition-colors">
                    <td className="py-3.5 px-4 font-medium text-[#ede6d8]">Finding true sender</td>
                    <td className="py-3.5 px-4 text-[#b9af9c]">Trusts the display name on the screen</td>
                    <td className="py-3.5 px-4 text-[#b9af9c]">Scans links inside email body</td>
                    <td className="py-3.5 px-4 text-[#4ade80] font-semibold bg-[#241f17]/40">Traces backward from your server to pinpoint real origin IP</td>
                  </tr>
                  <tr className="hover:bg-[#221e18] transition-colors">
                    <td className="py-3.5 px-4 font-medium text-[#ede6d8]">Verifying legitimacy</td>
                    <td className="py-3.5 px-4 text-[#b9af9c]">Basic Pass/Fail checkbox</td>
                    <td className="py-3.5 px-4 text-[#b9af9c]">None (ignores email routing)</td>
                    <td className="py-3.5 px-4 text-[#4ade80] font-semibold bg-[#241f17]/40">Full cryptographic match (SPF, DKIM, DMARC &amp; ARC)</td>
                  </tr>
                  <tr className="hover:bg-[#221e18] transition-colors">
                    <td className="py-3.5 px-4 font-medium text-[#ede6d8]">Evidence for reports &amp; law</td>
                    <td className="py-3.5 px-4 text-[#b9af9c]">Temporary logs deleted in 30 days</td>
                    <td className="py-3.5 px-4 text-[#b9af9c]">Uploads files to public websites</td>
                    <td className="py-3.5 px-4 text-[#4ade80] font-semibold bg-[#241f17]/40">Permanent tamper-proof SHA-256 legal evidence dossier</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </section>


      {/* Corpus Proof & Detection Output */}
      <section id="corpus-proof" className="py-16 sm:py-20 border-b border-[#3a352c] bg-[#171410]">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[2px] bg-[#3a352c]/50 text-[#c9a227] font-['IBM_Plex_Mono',monospace] text-[11px] mb-2 uppercase">
                Corpus Proof &amp; Detection Output
              </div>
              <h2 className="font-['Fraunces',serif] text-[26px] sm:text-[34px] font-medium text-[#ede6d8]">
                See it work on a real sample
              </h2>
              <p className="text-[#b9af9c] mt-2 text-[15px] max-w-[65ch]">
                Real detection outputs produced by TraceXMail from historical attack corpora and authentic inbound mail. Not invented marketing copy. Click any sample to inspect the complete forensic chain in the analyst console.
              </p>
            </div>
            <button
              onClick={() => handleCaseClick(0)}
              className="bg-[#b23a2e] hover:bg-[#c94a3d] text-[#ede6d8] px-4 py-2 rounded-[3px] text-[13.5px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>Launch primary sample (Nazario #01)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sampleCases.map((c) => {
              const isMalicious = c.threatScore >= 70;
              return (
                <div
                  key={c.id}
                  onClick={() => handleCaseClick(c.index)}
                  className="bg-[#1d1a15] border border-[#3a352c] rounded-[4px] p-5 sm:p-6 flex flex-col justify-between hover:border-[#b9af9c] hover:bg-[#221e18] transition-all cursor-pointer group shadow-md"
                >
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between gap-2 border-b border-[#3a352c]/70 pb-2.5">
                      <span className="font-['IBM_Plex_Mono',monospace] text-[10.5px] text-[#b9af9c] tracking-wider uppercase font-semibold">
                        {c.corpus}
                      </span>
                      <span
                        className={`font-['IBM_Plex_Mono',monospace] text-[10.5px] px-2 py-0.5 rounded-[2px] border font-bold ${
                          isMalicious
                            ? 'bg-[#b23a2e]/15 text-[#b23a2e] border-[#b23a2e]/40'
                            : 'bg-[#2e7a4a]/20 text-[#4ade80] border-[#2e7a4a]/40'
                        }`}
                      >
                        {c.verdict}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-['Fraunces',serif] text-[24px] font-semibold text-[#ede6d8]">
                          {c.threatScore}
                        </span>
                        <span className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#b9af9c]">
                          / 100 THREAT SCORE
                        </span>
                      </div>
                      <h3 className="font-['Fraunces',serif] text-[16.5px] font-medium text-[#ede6d8] group-hover:text-white transition-colors leading-snug">
                        {c.name}
                      </h3>
                      <p className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#b9af9c] mt-1 truncate">
                        Subject: {c.subject}
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-[#3a352c]/50">
                      <div className="text-[11px] font-mono text-[#8e8574] uppercase">Detected Forensic Signals:</div>
                      {c.signals.map((sig, sIdx) => (
                        <div
                          key={sIdx}
                          className="flex items-start gap-2 text-[12px] text-[#ede6d8] leading-snug"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${isMalicious ? 'bg-[#b23a2e]' : 'bg-[#22c55e]'}`} />
                          <span>{sig}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-[#3a352c]/70 flex items-center justify-between text-[11.5px] font-['IBM_Plex_Mono',monospace]">
                    <span className="text-[#8e8574] truncate max-w-[170px]">
                      {c.originHint}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#b9af9c] group-hover:text-[#ede6d8] transition-colors">
                      Inspect case
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>



      {/* What Your Analysts Actually Open (Workstation Mockup) */}
      <section id="workstation" className="py-16 sm:py-20 border-b border-[#3a352c] bg-[#14120f]">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[700px] mb-8">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[2px] bg-[#3a352c]/50 text-[#c9a227] font-['IBM_Plex_Mono',monospace] text-[11px] mb-2 uppercase">
              Production Workstation
            </div>
            <h2 className="font-['Fraunces',serif] text-[28px] sm:text-[34px] font-medium text-[#ede6d8]">
              What your analysts actually open
            </h2>
            <p className="text-[#b9af9c] mt-2 text-[15px]">
              The board on the left is the idea. This is the tool: the same cases, the same evidence, laid out for someone working a queue, not admiring a metaphor.
            </p>
          </div>

          <div className="bg-[#1a1712] border border-[#3a352c] rounded-[4px] overflow-hidden shadow-2xl">
            <div className="bg-[#100e0c] px-4 py-2.5 border-b border-[#3a352c] flex items-center justify-between text-xs font-mono text-[#8e8574]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#b23a2e]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#c9a227]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
                <span className="ml-2 text-[#ede6d8]">app.tracexmail.io/cases/case-2291</span>
              </div>
              <div className="flex items-center gap-4">
                <span>Open cases: <strong className="text-[#ede6d8]">14</strong></span>
                <span>Threat clusters: <strong className="text-[#ede6d8]">3</strong></span>
                <span>Avg. threat score: <strong className="text-[#ede6d8]">71</strong></span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#3a352c] text-[#8e8574] bg-[#14120f]">
                    <th className="py-2.5 px-4">Case</th>
                    <th className="py-2.5 px-4">Subject</th>
                    <th className="py-2.5 px-4">Severity</th>
                    <th className="py-2.5 px-4">Score</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3a352c]/50 text-[#ede6d8]">
                  <tr className="hover:bg-[#221e18] cursor-pointer" onClick={() => handleCaseClick(0)}>
                    <td className="py-3 px-4 font-bold text-[#c9a227]">CASE-2291</td>
                    <td className="py-3 px-4 truncate max-w-[280px]">Urgent: Updated Direct Deposit Routing Form Ref #DD-901</td>
                    <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-[2px] bg-[#b23a2e]/20 text-[#ff8d7d] border border-[#b23a2e]/40 font-bold">CRITICAL</span></td>
                    <td className="py-3 px-4 text-[#ff8d7d] font-bold">94</td>
                    <td className="py-3 px-4 text-right text-[#b9af9c] hover:text-[#ede6d8]">Inspect →</td>
                  </tr>
                  <tr className="hover:bg-[#221e18] cursor-pointer" onClick={() => handleCaseClick(1)}>
                    <td className="py-3 px-4 font-bold text-[#c9a227]">CASE-2288</td>
                    <td className="py-3 px-4 truncate max-w-[280px]">Action Required: Verify Office 365 Password Expiration</td>
                    <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-[2px] bg-[#b23a2e]/20 text-[#ff8d7d] border border-[#b23a2e]/40 font-bold">HIGH</span></td>
                    <td className="py-3 px-4 text-[#ff8d7d] font-bold">86</td>
                    <td className="py-3 px-4 text-right text-[#b9af9c] hover:text-[#ede6d8]">Inspect →</td>
                  </tr>
                  <tr className="hover:bg-[#221e18] cursor-pointer" onClick={() => handleCaseClick(2)}>
                    <td className="py-3 px-4 font-bold text-[#c9a227]">CASE-2281</td>
                    <td className="py-3 px-4 truncate max-w-[280px]">Your document is waiting for signature via DocuSign Portal</td>
                    <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-[2px] bg-[#c9a227]/20 text-[#ffd55c] border border-[#c9a227]/40 font-bold">MEDIUM</span></td>
                    <td className="py-3 px-4 text-[#ffd55c] font-bold">62</td>
                    <td className="py-3 px-4 text-right text-[#b9af9c] hover:text-[#ede6d8]">Inspect →</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-[#14120f] border-t border-[#3a352c] text-xs text-[#8e8574] flex justify-between items-center">
              <span>Every row links back to the same evidence chain (headers, DNS results, hop-by-hop geolocation) that an analyst can open, not a score they have to trust blind.</span>
              <button onClick={onOpenConsole} className="text-[#ede6d8] hover:text-[#c9a227] font-semibold">Open Live Console</button>
            </div>
          </div>
        </div>
      </section>

      {/* What's Actually Doing the Work: Exhibits A-D */}
      <section id="exhibits" className="py-16 sm:py-20 border-b border-[#3a352c] bg-[#171410]">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[700px] mb-12">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[2px] bg-[#3a352c]/50 text-[#c9a227] font-['IBM_Plex_Mono',monospace] text-[11px] mb-2 uppercase">
              Core Engineering
            </div>
            <h2 className="font-['Source_Serif_4',serif] font-semibold text-[28px] sm:text-[36px] text-[#ede6d8]">
              Four Pillars of the Forensic Reconstruction Engine
            </h2>
            <p className="text-[#b9af9c] mt-2 text-[15px] leading-relaxed">
              Deterministic architectures engineered for court-admissible audit trails, immutable cryptographic ledgers, and RFC-compliant hop isolation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#1d1a15] border border-[#3a352c] rounded-[4px] p-6 space-y-3">
              <span className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#c9a227] font-bold">EXHIBIT A</span>
              <h3 className="font-['Source_Serif_4',serif] font-semibold text-[18px] text-[#ede6d8]">Cryptographic Evidence Vault</h3>
              <p className="text-[#b9af9c] text-[14px] leading-relaxed">
                Every forensic finding is hashed via SHA-256 and timestamped the moment analysis executes. Immutability guarantees prevent post-hoc report tampering.
              </p>
            </div>

            <div className="bg-[#1d1a15] border border-[#3a352c] rounded-[4px] p-6 space-y-3">
              <span className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#c9a227] font-bold">EXHIBIT B</span>
              <h3 className="font-['Source_Serif_4',serif] font-semibold text-[18px] text-[#ede6d8]">Trust-Boundary Origin Resolver</h3>
              <p className="text-[#b9af9c] text-[14px] leading-relaxed">
                Reconstructs transmission backwards from verified destination MTAs, isolating untrusted perimeter hops while discarding attacker-forged Received headers.
              </p>
            </div>

            <div className="bg-[#1d1a15] border border-[#3a352c] rounded-[4px] p-6 space-y-3">
              <span className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#c9a227] font-bold">EXHIBIT C</span>
              <h3 className="font-['Source_Serif_4',serif] font-semibold text-[18px] text-[#ede6d8]">NIST-Aligned Attribution Classifier</h3>
              <p className="text-[#b9af9c] text-[14px] leading-relaxed">
                Strict epistemological categorization separates verified forensic Facts, contextual Findings, and threat actor Hypotheses into distinct audit tiers.
              </p>
            </div>

            <div className="bg-[#1d1a15] border border-[#3a352c] rounded-[4px] p-6 space-y-3">
              <span className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#c9a227] font-bold">EXHIBIT D</span>
              <h3 className="font-['Source_Serif_4',serif] font-semibold text-[18px] text-[#ede6d8]">Cross-Vector Campaign Correlation</h3>
              <p className="text-[#b9af9c] text-[14px] leading-relaxed">
                Correlates concurrent phishing waves sharing bulletproof autonomous systems, identical DKIM selectors, and matching payload entropy profiles.
              </p>
            </div>
          </div>
        </div>
      </section>



      {/* UNKNOWN IS A VALID RESULT - CENTERED EDITORIAL STATEMENT */}
      <section className="py-20 sm:py-24 border-b border-[#3a352c] bg-[#14120f]">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto flex flex-col items-center text-center space-y-7">
            
            {/* Centered Circular Badge */}
            <div className="flex items-center justify-center">
              <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-full border-[3px] border-[#c9a227] p-1.5 flex items-center justify-center shadow-[0_0_35px_rgba(201,162,39,0.15)] bg-[#171410]">
                <div className="w-full h-full rounded-full border border-[#c9a227]/40 bg-[#12100d] flex flex-col items-center justify-center text-center p-4">
                  <span className="font-['IBM_Plex_Mono',monospace] text-[13px] sm:text-[14px] font-bold text-[#c9a227] tracking-wider leading-[1.35] uppercase">
                    UNKNOWN<br />
                    IS A VALID<br />
                    RESULT
                  </span>
                </div>
              </div>
            </div>

            {/* Centered Copy */}
            <div className="space-y-3.5 max-w-[720px] flex flex-col items-center">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[2px] bg-[#c9a227]/10 border border-[#c9a227]/30 text-[#c9a227] font-['IBM_Plex_Mono',monospace] text-[11px] uppercase font-bold tracking-wider">
                Epistemological Rigor
              </div>
              <h2 className="font-['Source_Serif_4',serif] font-semibold text-[28px] sm:text-[36px] lg:text-[40px] text-[#ede6d8] leading-[1.18]">
                Deterministic Integrity: We Refuse Manufactured Confidence
              </h2>
              <p className="text-[#b9af9c] text-[15px] sm:text-[16.5px] leading-relaxed max-w-[680px]">
                When cryptographic signatures or network telemetry are inconclusive, TraceXMail declares &quot;Inconclusive / Unknown&quot; rather than hallucinating statistical probabilities that crumble under regulatory deposition or adversarial scrutiny.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Role-Based Clearance */}
      <section className="py-16 border-b border-[#3a352c] bg-[#171410]">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[650px] mb-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[2px] bg-[#3a352c]/50 text-[#c9a227] font-['IBM_Plex_Mono',monospace] text-[11px] mb-2 uppercase">
              Access Governance
            </div>
            <h2 className="font-['Source_Serif_4',serif] font-semibold text-[26px] sm:text-[32px] text-[#ede6d8]">
              Role-Based Access Control &amp; Privacy Safeguards
            </h2>
            <p className="text-[#b9af9c] mt-2 text-[15px]">
              Tiered operational clearances enforce strict separation of duties, ensuring PII redaction and read-only audit integrity across SOC echelons.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#1d1a15] border border-[#3a352c] rounded-[4px] p-6 space-y-2">
              <span className="text-xs font-mono text-[#c9a227]">CLEARANCE · ADMIN</span>
              <h3 className="font-['Source_Serif_4',serif] font-semibold text-[18px] text-[#ede6d8]">Admin</h3>
              <p className="text-[#b9af9c] text-[14px]">
                Manages organizational certificates, user provisioning, and authorization policies for unmasked forensic raw header inspection.
              </p>
            </div>

            <div className="bg-[#1d1a15] border border-[#3a352c] rounded-[4px] p-6 space-y-2">
              <span className="text-xs font-mono text-[#22c55e]">CLEARANCE · ANALYST</span>
              <h3 className="font-['Source_Serif_4',serif] font-semibold text-[18px] text-[#ede6d8]">Analyst</h3>
              <p className="text-[#b9af9c] text-[14px]">
                Full investigative telemetry access: executes reverse hop reconstruction, validates DMARC matrix, and generates forensic dossiers.
              </p>
            </div>

            <div className="bg-[#1d1a15] border border-[#3a352c] rounded-[4px] p-6 space-y-2">
              <span className="text-xs font-mono text-[#7fb2e8]">CLEARANCE · READ-ONLY</span>
              <h3 className="font-['Source_Serif_4',serif] font-semibold text-[18px] text-[#ede6d8]">Auditor</h3>
              <p className="text-[#b9af9c] text-[14px]">
                Enforces compliance review with automated PII masking, RFC verification logs, and immutable SHA-256 chain of custody reports.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Engineering & Research Team - REDESIGNED */}
      <section id="team" className="py-16 sm:py-20 border-b border-[#3a352c] bg-[#14120f]">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[700px] mb-12">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[2px] bg-[#3a352c]/50 text-[#c9a227] font-['IBM_Plex_Mono',monospace] text-[11px] mb-2 uppercase">
              Core Engineering &amp; Research
            </div>
            <h2 className="font-['Source_Serif_4',serif] font-semibold text-[28px] sm:text-[34px] text-[#ede6d8]">
              Forensic Core Engineering &amp; Threat Intelligence Research
            </h2>
            <p className="text-[#b9af9c] mt-2 text-[15px]">
              Specialized research engineers dedicated to deterministic email attribution, RFC verification protocols, and high-fidelity threat intelligence.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamMembers.map((member, mIdx) => (
              <div
                key={mIdx}
                className="bg-[#1d1a15] border border-[#3a352c] rounded-[4px] p-6 space-y-3 hover:border-[#b9af9c] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#c9a227] font-bold">
                    {member.agentId}
                  </span>
                  <span className={`w-2.5 h-2.5 rounded-full ${member.dotColor}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-[17px] text-[#ede6d8]">{member.name}</h3>
                  <div className="text-[13px] text-[#c9a227] font-mono mt-0.5">{member.role}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Why We Built This Quote Cards */}
          <div className="mt-12 pt-8 border-t border-[#3a352c] space-y-6">
            <h3 className="text-xs font-mono text-[#8e8574] uppercase tracking-wider font-semibold">
              Why we built this
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#1a1712] p-6 rounded-[4px] border-l-2 border-[#b23a2e] space-y-3">
                <p className="text-[#ede6d8] italic text-[14.5px] leading-relaxed font-serif">
                  &quot;Building TraceXMail required constructing a deterministic forensic pipeline that verifies raw RFC822 headers, live SPF/DKIM/DMARC records, and BGP/ASN telemetry without relying on black-box heuristics.&quot;
                </p>
                <footer className="text-xs font-mono text-[#22c55e] uppercase">
                  — JAYARAM SAPPA · SYSTEM DESIGN &amp; BACKEND ENGINEERING
                </footer>
              </div>

              <div className="bg-[#1a1712] p-6 rounded-[4px] border-l-2 border-[#c9a227] space-y-3">
                <p className="text-[#ede6d8] italic text-[14.5px] leading-relaxed font-serif">
                  &quot;Threat intelligence is only actionable when it identifies origin infrastructure and campaign clusters rather than just flagging domain age.&quot;
                </p>
                <footer className="text-xs font-mono text-[#22c55e] uppercase">
                  — VENNELA OBILISETTI · THREAT INTELLIGENCE &amp; DETECTION
                </footer>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Deployment / Pricing Section - CENTERED */}
      <section id="pricing" className="py-16 sm:py-20 border-b border-[#3a352c] bg-[#171410]">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-12 flex flex-col items-center">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[2px] bg-[#3a352c]/50 text-[#c9a227] font-['IBM_Plex_Mono',monospace] text-[11px] mb-2.5 uppercase font-bold tracking-wider">
              Operational Deployment
            </div>
            <h2 className="font-['Source_Serif_4',serif] font-semibold text-[28px] sm:text-[36px] text-[#ede6d8]">
              Deployment Tiers &amp; SOC Access
            </h2>
            <p className="text-[#b9af9c] mt-2.5 text-[15px] max-w-[580px] leading-relaxed">
              Active pilot deployments available for SOC response units, security incident responders, and digital forensics laboratories.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-[850px] mx-auto">
            <div className="bg-[#1d1a15] border border-[#b23a2e] rounded-[4px] p-6 sm:p-8 space-y-5 text-left">
              <div>
                <span className="text-xs font-mono text-[#ff8d7d] font-bold">PILOT ACCESS</span>
                <div className="font-['Source_Serif_4',serif] font-semibold text-[30px] sm:text-[32px] text-[#ede6d8] mt-1">No Cost Evaluation</div>
                <p className="text-[#b9af9c] text-sm mt-1">For security teams evaluating TraceXMail during the pilot phase</p>
              </div>
              <ul className="space-y-2.5 text-sm text-[#ede6d8]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0" />
                  <span>Full analyst console, no feature gating</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0" />
                  <span>Unlimited case uploads during the pilot window</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0" />
                  <span>A direct line to the team building it</span>
                </li>
              </ul>
              <button
                onClick={onOpenConsole}
                className="w-full bg-[#b23a2e] hover:bg-[#c94a3d] text-[#ede6d8] py-3 rounded-[3px] font-semibold text-sm transition-colors cursor-pointer"
              >
                Request pilot access
              </button>
            </div>

            <div className="bg-[#1d1a15] border border-[#3a352c] rounded-[4px] p-6 sm:p-8 space-y-5 text-left">
              <div>
                <span className="text-xs font-mono text-[#c9a227] font-bold">ENTERPRISE</span>
                <div className="font-['Source_Serif_4',serif] font-semibold text-[30px] sm:text-[32px] text-[#ede6d8] mt-1">Custom Ingress &amp; SLAs</div>
                <p className="text-[#b9af9c] text-sm mt-1">For organizations needing custom deployment, SLAs, or on-prem hosting</p>
              </div>
              <ul className="space-y-2.5 text-sm text-[#ede6d8]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0" />
                  <span>Dedicated onboarding</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0" />
                  <span>Custom retention and compliance terms</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0" />
                  <span>Priority support</span>
                </li>
              </ul>
              <button
                onClick={onRequestAccess || onOpenConsole}
                className="w-full border border-[#3a352c] hover:border-[#b9af9c] text-[#ede6d8] py-3 rounded-[3px] font-semibold text-sm transition-colors cursor-pointer"
              >
                Talk to us
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section - CENTERED */}
      <section id="faq" className="py-16 sm:py-20 border-b border-[#3a352c] bg-[#14120f]">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-12 flex flex-col items-center">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[2px] bg-[#c9a227]/10 border border-[#c9a227]/30 text-[#c9a227] font-['IBM_Plex_Mono',monospace] text-[11px] mb-2.5 uppercase font-bold tracking-wider">
              Technical Documentation &amp; FAQ
            </div>
            <h2 className="font-['Source_Serif_4',serif] font-semibold text-[28px] sm:text-[36px] text-[#ede6d8]">
              Forensic Architecture &amp; Protocol Verification FAQ
            </h2>
            <p className="text-[#b9af9c] mt-2.5 text-[15px] max-w-[620px] leading-relaxed">
              Technical specifications on socket verification, cryptographic validation matrices, and zero-retention privacy architecture.
            </p>
          </div>

          <div className="max-w-[850px] mx-auto divide-y divide-[#3a352c]">
            <div className="py-4">
              <button
                onClick={() => toggleFaq(0)}
                className="w-full text-left font-semibold text-[16px] text-[#ede6d8] flex justify-between items-center gap-4 bg-transparent border-none cursor-pointer p-0 hover:text-[#c9a227] transition-colors"
              >
                <span>How does TraceXMail tell if an email is really from who it says it is?</span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[#c9a227] text-[18px]">
                  {activeFaq === 0 ? '−' : '+'}
                </span>
              </button>
              {activeFaq === 0 && (
                <div className="text-[#b9af9c] text-[14.5px] mt-3 space-y-2 leading-relaxed">
                  <p>
                    Think of an email like a postal package. Anyone can write &quot;From: CEO&quot; on the outside label with a marker pen. Traditional email apps just read the marker pen writing.
                  </p>
                  <p>
                    TraceXMail instead inspects the actual digital wax seals (cryptographic signatures like SPF and DKIM) and tracks the physical post offices (server hops) the package passed through. If the wax seal was forged or the package originated from an unauthorized server in another country, we catch it instantly.
                  </p>
                </div>
              )}
            </div>

            <div className="py-4">
              <button
                onClick={() => toggleFaq(1)}
                className="w-full text-left font-semibold text-[16px] text-[#ede6d8] flex justify-between items-center gap-4 bg-transparent border-none cursor-pointer p-0 hover:text-[#c9a227] transition-colors"
              >
                <span>Do I need to be a cybersecurity expert to understand the results?</span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[#c9a227] text-[18px]">
                  {activeFaq === 1 ? '−' : '+'}
                </span>
              </button>
              {activeFaq === 1 && (
                <div className="text-[#b9af9c] text-[14.5px] mt-3 space-y-2 leading-relaxed">
                  <p>
                    Not at all. When you analyze an email, TraceXMail gives you a crystal-clear, plain-English summary right at the top (e.g., <em>&quot;Dangerous: Sender claims to be PayPal, but was sent through an anonymous Tor relay in Bulgaria&quot;</em>) alongside an interactive 3D map of the route.
                  </p>
                  <p>
                    If your IT team, auditor, or law enforcement needs deep technical proofs (raw server logs, RFC headers, or SHA-256 evidence seals), everything is available in one click.
                  </p>
                </div>
              )}
            </div>

            <div className="py-4">
              <button
                onClick={() => toggleFaq(2)}
                className="w-full text-left font-semibold text-[16px] text-[#ede6d8] flex justify-between items-center gap-4 bg-transparent border-none cursor-pointer p-0 hover:text-[#c9a227] transition-colors"
              >
                <span>Is my email data kept private and confidential?</span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[#c9a227] text-[18px]">
                  {activeFaq === 2 ? '−' : '+'}
                </span>
              </button>
              {activeFaq === 2 && (
                <div className="text-[#b9af9c] text-[14.5px] mt-3 space-y-2 leading-relaxed">
                  <p>
                    Yes, 100%. Unlike online virus scanners that upload your emails to public search databases, TraceXMail processes your email headers securely in temporary memory.
                  </p>
                  <p>
                    Your emails are never shared publicly or used to train third-party models. You retain complete custody of your forensic evidence.
                  </p>
                </div>
              )}
            </div>

            <div className="py-4">
              <button
                onClick={() => toggleFaq(3)}
                className="w-full text-left font-semibold text-[16px] text-[#ede6d8] flex justify-between items-center gap-4 bg-transparent border-none cursor-pointer p-0 hover:text-[#c9a227] transition-colors"
              >
                <span>Why is TraceXMail better than regular spam filters or antivirus?</span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[#c9a227] text-[18px]">
                  {activeFaq === 3 ? '−' : '+'}
                </span>
              </button>
              {activeFaq === 3 && (
                <div className="text-[#b9af9c] text-[14.5px] mt-3 space-y-2 leading-relaxed">
                  <p>
                    Regular spam filters only look for known suspicious words or malicious links. Clever hackers bypass them by sending clean text that pretends to be a boss or supplier requesting an urgent wire transfer.
                  </p>
                  <p>
                    TraceXMail doesn&apos;t just read the words—it validates the physical infrastructure behind the email, uncovering hidden proxy servers, Tor relays, and lookalike domain tricks that spam filters miss entirely.
                  </p>
                </div>
              )}
            </div>

            <div className="py-4">
              <button
                onClick={() => toggleFaq(4)}
                className="w-full text-left font-semibold text-[16px] text-[#ede6d8] flex justify-between items-center gap-4 bg-transparent border-none cursor-pointer p-0 hover:text-[#c9a227] transition-colors"
              >
                <span>How can I test an email right now?</span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[#c9a227] text-[18px]">
                  {activeFaq === 4 ? '−' : '+'}
                </span>
              </button>
              {activeFaq === 4 && (
                <div className="text-[#b9af9c] text-[14.5px] mt-3 space-y-2 leading-relaxed">
                  <p>
                    You can click &quot;Open Console&quot; anywhere on this page to immediately test with real preloaded phishing cases (like Tor-based PayPal fraud or BEC attacks), or drag and drop your own <code>.eml</code>, <code>.msg</code>, or raw email text to get an instant breakdown.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-20 bg-[radial-gradient(ellipse_800px_400px_at_50%_100%,rgba(178,58,46,0.12),transparent_70%)]">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-['Fraunces',serif] text-[28px] sm:text-[38px] lg:text-[42px] font-medium text-[#ede6d8] max-w-[22ch]">
            Stop guessing where an email threat came from.
          </h2>
          <p className="text-[#b9af9c] my-4 text-[16px] max-w-[56ch] leading-relaxed">
            Drop your raw .eml file or paste email headers into the console. TraceXMail will reconstruct the cryptographic route, verify BGP hops, and generate forensic evidence in seconds.
          </p>
          <div className="flex flex-wrap items-center gap-3.5 mt-8">
            <button
              onClick={onOpenConsole}
              className="bg-[#b23a2e] hover:bg-[#c94a3d] text-[#ede6d8] px-6 py-3.5 rounded-[3px] font-semibold text-[15px] border border-[#b23a2e] transition-all transform hover:-translate-y-0.5 cursor-pointer shadow-lg flex items-center gap-2 group"
            >
              <span>Analyze Email Free in Console</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => scrollToSection('corpus-proof')}
              className="px-6 py-3.5 rounded-[3px] font-medium text-[15px] border border-[#3a352c] text-[#ede6d8] hover:border-[#b9af9c] hover:bg-[#1d1a15] transition-all cursor-pointer flex items-center gap-2"
            >
              <Route className="w-4 h-4 text-[#c9a227]" />
              <span>Explore Evidence Dossiers</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="landing-footer" className="border-t border-[#3a352c] bg-[#100e0c]/90 backdrop-blur-sm py-10">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6 text-[13.5px] text-[#b9af9c]">
          <div className="flex items-center gap-2.5">
            <TraceXLogo size="xs" />
            <span className="font-medium tracking-tight text-[#ede6d8]">TraceXMail</span>
            <span className="text-[#6e6659] hidden sm:inline">•</span>
            <span className="text-[#8a8070] text-xs">Email Forensic Intelligence Platform</span>
          </div>

          <nav aria-label="Legal and Platform Verification" className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs font-mono">
            <a
              id="footer-link-privacy"
              href="/privacy"
              className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors underline underline-offset-4 decoration-[#3a352c] hover:decoration-[#ede6d8]"
            >
              Privacy Policy
            </a>
            <a
              id="footer-link-terms"
              href="/terms"
              className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors underline underline-offset-4 decoration-[#3a352c] hover:decoration-[#ede6d8]"
            >
              Terms of Service
            </a>
            <a
              id="footer-link-cookies"
              href="/cookies"
              className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors underline underline-offset-4 decoration-[#3a352c] hover:decoration-[#ede6d8]"
            >
              Cookie Policy
            </a>
            <a
              id="footer-link-domains"
              href="/domains"
              className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors underline underline-offset-4 decoration-[#3a352c] hover:decoration-[#ede6d8]"
            >
              Authorized Domains
            </a>
            <a
              id="footer-link-contact"
              href="/contact"
              className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors underline underline-offset-4 decoration-[#3a352c] hover:decoration-[#ede6d8]"
            >
              Developer Contact
            </a>
            <div className="font-['IBM_Plex_Mono',monospace] text-[11px] border border-[#3a352c] px-2.5 py-0.5 rounded-[2px] text-[#22c55e] bg-[#22c55e]/10 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
              <span>VERIFIED DOMAIN</span>
            </div>
          </nav>
        </div>
      </footer>

      {/* Mobile Persistent Bottom CTA Bar */}
      <aside
        aria-label="Mobile Quick Access"
        className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-[#14120f]/95 backdrop-blur-md border-t border-[#3a352c] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_24px_rgba(0,0,0,0.6)]"
      >
        <div className="w-full mx-auto px-1">
          <button
            onClick={onOpenConsole}
            className="w-full bg-[#b23a2e] hover:bg-[#c94a3d] text-[#ede6d8] py-3 px-4 rounded-[3px] font-semibold text-[14.5px] border border-[#b23a2e] shadow-lg text-center cursor-pointer transition-colors active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <span>Analyze Email Free in Console</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </aside>

    </div>
  );
}
