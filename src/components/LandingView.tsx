import React from 'react';
import { 
  Shield, 
  ArrowRight, 
  Activity, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle, 
  MapPin, 
  FileText, 
  Lock, 
  Users, 
  HelpCircle, 
  ChevronRight, 
  ExternalLink,
  Zap,
  Fingerprint,
  Layers,
  Search,
  Eye,
  Cpu,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { SAMPLE_ANALYSES } from '../data/samples';
import { EmailAnalysis } from '../types';
import { LiveForensicSimulator } from './landing/LiveForensicSimulator';
import { InteractiveHowItWorks } from './landing/InteractiveHowItWorks';
import { HeaderXRayInspector } from './landing/HeaderXRayInspector';

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
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -70; // Header offset
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const handleCaseRowClick = (caseIndex: number) => {
    const target = SAMPLE_ANALYSES[caseIndex] || SAMPLE_ANALYSES[0];
    if (onSelectCase) {
      onSelectCase(target);
    }
    onOpenConsole();
  };

  return (
    <div className="w-full min-h-screen bg-[var(--ink)] text-[var(--paper)] selection:bg-[var(--thread)] selection:text-[var(--paper)] font-sans antialiased overflow-x-hidden">
      
      {/* Top Sticky Navigation Bar */}
      <header className="sticky top-0 z-50 bg-[rgba(20,18,15,0.95)] backdrop-blur-md border-b border-[var(--line)] w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--thread)] relative shrink-0 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--thread)] animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold text-[var(--paper)] tracking-tight leading-none">
                TraceXMail
              </span>
              <span className="text-[11px] text-[var(--paper-dim)] font-sans font-medium tracking-wide">
                Email Forensic &amp; Origin De-Anonymizer
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            <button
              onClick={() => scrollToSection('simulator')}
              className="text-[var(--paper-dim)] hover:text-[var(--paper)] transition-colors cursor-pointer bg-transparent border-0 py-1"
            >
              Live Simulator
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="text-[var(--paper-dim)] hover:text-[var(--paper)] transition-colors cursor-pointer bg-transparent border-0 py-1"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('xray')}
              className="text-[var(--paper-dim)] hover:text-[var(--paper)] transition-colors cursor-pointer bg-transparent border-0 py-1"
            >
              Header X-Ray
            </button>
            <button
              onClick={() => scrollToSection('examples')}
              className="text-[var(--paper-dim)] hover:text-[var(--paper)] transition-colors cursor-pointer bg-transparent border-0 py-1"
            >
              Threat Cases
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="text-[var(--paper-dim)] hover:text-[var(--paper)] transition-colors cursor-pointer bg-transparent border-0 py-1"
            >
              Capabilities
            </button>
          </nav>

          {/* Right Nav CTAs */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              onClick={onOpenConsole}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[3px] text-xs sm:text-sm font-medium border border-[var(--line)] hover:border-[var(--paper-dim)] bg-[var(--ink-2)] text-[var(--paper)] transition-all cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-[var(--slate)]" />
              <span>SOC Console</span>
            </button>
            <button
              onClick={onRequestAccess || onOpenConsole}
              className="btn-primary py-1.5 px-3.5 text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <span>Analyze Email</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-14 sm:py-20 lg:py-24 border-b border-[var(--line)] bg-[radial-gradient(ellipse_800px_450px_at_50%_-10%,rgba(178,58,46,0.14),transparent_70%),var(--ink)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[rgba(178,58,46,0.12)] border border-[rgba(178,58,46,0.3)] text-[var(--rose-400)] text-xs font-semibold mb-6">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--rose-400)]" />
            <span>Cryptographic Email Source Verification • Zero-Trust Analysis</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl lg:text-[54px] font-bold tracking-tight text-[var(--paper)] leading-[1.12] max-w-4xl">
            Every email leaves digital footprints. <br className="hidden sm:inline" />
            <span className="text-[var(--rose-400)] underline decoration-[var(--thread)] decoration-2 underline-offset-8">
              We follow the thread down to the metal.
            </span>
          </h1>

          <p className="mt-5 text-[var(--paper-dim)] text-base sm:text-xl leading-relaxed max-w-2xl">
            Stop guessing. TraceXMail strips away deceptive display names, reconstructs the global multi-hop transmission path, and mathematically proves sender authenticity in milliseconds.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3.5 mt-9">
            <button
              onClick={onOpenConsole}
              className="btn-primary flex items-center justify-center gap-2 text-sm sm:text-base font-semibold py-3.5 px-7 shadow-xl cursor-pointer"
            >
              <span>Open Forensic Inspector</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => scrollToSection('simulator')}
              className="btn-secondary flex items-center justify-center gap-2 text-sm sm:text-base font-medium py-3.5 px-6 cursor-pointer"
            >
              <Activity className="w-4 h-4 text-[var(--stamp)]" />
              <span>Launch Live Simulator</span>
            </button>
          </div>

          {/* Proof Ticker / Quality Assurances */}
          <div className="mt-12 pt-6 border-t border-[var(--line)] w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-[var(--paper-dim)]">
            <div className="flex items-center justify-center gap-1.5 p-2 bg-[#181410] rounded border border-[#2e2a22]">
              <CheckCircle2 className="w-4 h-4 text-[var(--forensic-green)] shrink-0" />
              <span>100% Client-Side Privacy</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 p-2 bg-[#181410] rounded border border-[#2e2a22]">
              <CheckCircle2 className="w-4 h-4 text-[var(--forensic-green)] shrink-0" />
              <span>RFC5322 &amp; RFC6376 Strict</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 p-2 bg-[#181410] rounded border border-[#2e2a22]">
              <CheckCircle2 className="w-4 h-4 text-[var(--forensic-green)] shrink-0" />
              <span>Multi-Hop BGP Traceroute</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 p-2 bg-[#181410] rounded border border-[#2e2a22]">
              <CheckCircle2 className="w-4 h-4 text-[var(--forensic-green)] shrink-0" />
              <span>Court-Admissible SHA-256</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Live Forensic Simulator Section */}
      <section className="py-16 sm:py-20 border-b border-[var(--line)] bg-[#100e0c]" id="simulator">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="text-[var(--thread)] text-xs font-bold font-mono uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                <span>Real-Time Interactive Demonstration</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-[36px] text-[var(--paper)] font-bold tracking-tight">
                Inspect live threat campaigns right now
              </h2>
              <p className="text-[var(--paper-dim)] mt-2 text-sm sm:text-base max-w-xl">
                Switch between active real-world scenarios to see how TraceXMail unmasks executive wire fraud, credential harvesting, and malware droppers.
              </p>
            </div>

            <button
              onClick={onOpenConsole}
              className="btn-secondary self-start md:self-auto text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer"
            >
              <span>Analyze Your Own Email</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Simulator Component */}
          <LiveForensicSimulator
            onOpenConsole={onOpenConsole}
            onOpenTrace={onOpenTrace}
            onSelectCase={onSelectCase}
          />
        </div>
      </section>

      {/* Deep How It Works Architectural Pipeline */}
      <section className="py-16 sm:py-20 border-b border-[var(--line)] bg-[var(--ink)]" id="how-it-works">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10 text-left">
            <div className="text-[var(--slate)] text-xs font-bold font-mono uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              <span>Deterministic 4-Stage Engine</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-[36px] text-[var(--paper)] font-bold tracking-tight">
              How TraceXMail proves email authenticity
            </h2>
            <p className="text-[var(--paper-dim)] mt-3 text-sm sm:text-base">
              No black-box guesses. TraceXMail executes a rigorous, multi-layered forensic inspection directly against internet mail standards.
            </p>
          </div>

          <InteractiveHowItWorks />
        </div>
      </section>

      {/* Header X-Ray Inspector Section */}
      <section className="py-16 sm:py-20 border-b border-[var(--line)] bg-[#100e0c]" id="xray">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <HeaderXRayInspector />
        </div>
      </section>

      {/* Real-World Threat Preset Cases */}
      <section className="py-16 sm:py-20 border-b border-[var(--line)] bg-[var(--ink)]" id="examples">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
            <div>
              <div className="text-[var(--stamp)] text-xs font-bold font-mono uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Pre-Loaded Forensic Dossiers</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-[36px] text-[var(--paper)] font-bold tracking-tight">
                Case Files &amp; Attack Signatures
              </h2>
              <p className="text-[var(--paper-dim)] mt-2 text-sm sm:text-base max-w-xl">
                Click any case file below to instantly launch the full interactive forensic workspace and explore the hops, DNS records, and raw headers.
              </p>
            </div>

            <button
              onClick={onOpenConsole}
              className="btn-secondary self-start md:self-auto text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <span>Explore All Cases in App</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Case 1: Wire Fraud */}
            <div 
              onClick={() => handleCaseRowClick(0)}
              className="bg-[#1b1712] border border-[#3a352c] hover:border-[var(--thread)] rounded-sm p-5 cursor-pointer transition-all hover:-translate-y-1 group shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs text-[var(--paper-muted)] font-semibold">CASE-2291</span>
                  <span className="px-2 py-0.5 rounded bg-[rgba(178,58,46,0.18)] text-[var(--rose-400)] border border-[rgba(178,58,46,0.4)] text-[11px] font-bold font-mono">
                    CRITICAL WIRE FRAUD
                  </span>
                </div>
                <h3 className="font-display font-semibold text-base text-[var(--paper)] group-hover:text-[var(--rose-300)] transition-colors mb-2">
                  Urgent: Update Your Direct Deposit Bank Info
                </h3>
                <p className="text-[var(--paper-dim)] text-xs leading-relaxed mb-4">
                  Spoofed email claiming to be corporate payroll. Real origin points to an unlisted offshore relay in Bulgaria attempting to divert salary deposits.
                </p>
              </div>

              <div className="pt-3 border-t border-[#3a352c] flex items-center justify-between text-xs text-[var(--slate)] font-medium">
                <span>Origin: Sofia, Bulgaria (AS200548)</span>
                <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform text-[var(--thread)] font-bold">
                  Open Dossier →
                </span>
              </div>
            </div>

            {/* Case 2: Microsoft 365 Phishing */}
            <div 
              onClick={() => handleCaseRowClick(1)}
              className="bg-[#1b1712] border border-[#3a352c] hover:border-[var(--stamp)] rounded-sm p-5 cursor-pointer transition-all hover:-translate-y-1 group shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs text-[var(--paper-muted)] font-semibold">CASE-2288</span>
                  <span className="px-2 py-0.5 rounded bg-[rgba(201,162,39,0.18)] text-[var(--stamp)] border border-[rgba(201,162,39,0.4)] text-[11px] font-bold font-mono">
                    CREDENTIAL HARVEST
                  </span>
                </div>
                <h3 className="font-display font-semibold text-base text-[var(--paper)] group-hover:text-[var(--stamp)] transition-colors mb-2">
                  Microsoft 365: Verify Your Account Password
                </h3>
                <p className="text-[var(--paper-dim)] text-xs leading-relaxed mb-4">
                  Fake MFA security alert containing an Evilginx reverse-proxy link registered 48 hours ago to hijack corporate session tokens.
                </p>
              </div>

              <div className="pt-3 border-t border-[#3a352c] flex items-center justify-between text-xs text-[var(--slate)] font-medium">
                <span>Origin: Frankfurt, Germany (AS44050)</span>
                <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform text-[var(--stamp)] font-bold">
                  Open Dossier →
                </span>
              </div>
            </div>

            {/* Case 3: DocuSign Stealer */}
            <div 
              onClick={() => handleCaseRowClick(2)}
              className="bg-[#1b1712] border border-[#3a352c] hover:border-[var(--slate)] rounded-sm p-5 cursor-pointer transition-all hover:-translate-y-1 group shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs text-[var(--paper-muted)] font-semibold">CASE-2281</span>
                  <span className="px-2 py-0.5 rounded bg-[rgba(127,163,186,0.18)] text-[var(--slate)] border border-[rgba(127,163,186,0.4)] text-[11px] font-bold font-mono">
                    GHOST ATTACHMENT
                  </span>
                </div>
                <h3 className="font-display font-semibold text-base text-[var(--paper)] group-hover:text-[var(--slate)] transition-colors mb-2">
                  DocuSign: Important Document Ready to Sign
                </h3>
                <p className="text-[var(--paper-dim)] text-xs leading-relaxed mb-4">
                  Compromised cPanel server delivering double-extension malware payload (.pdf.exe) bypassing traditional antivirus filters.
                </p>
              </div>

              <div className="pt-3 border-t border-[#3a352c] flex items-center justify-between text-xs text-[var(--slate)] font-medium">
                <span>Origin: Amsterdam, Netherlands</span>
                <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform text-[var(--slate)] font-bold">
                  Open Dossier →
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features & Architecture Capabilities */}
      <section className="py-16 sm:py-20 border-b border-[var(--line)] bg-[#100e0c]" id="features">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12 text-left">
            <div className="text-[var(--slate)] text-xs font-bold font-mono uppercase tracking-wider mb-2">
              Engineering Architecture
            </div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-[36px] text-[var(--paper)] font-bold tracking-tight">
              Enterprise forensic depth with zero friction
            </h2>
            <p className="text-[var(--paper-dim)] mt-3 text-sm sm:text-base">
              Engineered for security analysts, incident responders, legal auditors, and proactive team leads.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-[#181410] border border-[#3a352c] rounded-sm p-6 hover:border-[var(--thread)] transition-colors">
              <div className="w-10 h-10 rounded bg-[rgba(178,58,46,0.15)] text-[var(--rose-400)] flex items-center justify-center mb-4 border border-[rgba(178,58,46,0.3)]">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="font-display font-semibold text-base text-[var(--paper)] mb-2">
                Header De-Masking
              </h3>
              <p className="text-[var(--paper-dim)] text-xs leading-relaxed">
                Expose hidden envelope Return-Paths and separate fake quotation display names from true SMTP transmission addresses.
              </p>
            </div>

            <div className="bg-[#181410] border border-[#3a352c] rounded-sm p-6 hover:border-[var(--slate)] transition-colors">
              <div className="w-10 h-10 rounded bg-[rgba(127,163,186,0.15)] text-[var(--slate)] flex items-center justify-center mb-4 border border-[rgba(127,163,186,0.3)]">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="font-display font-semibold text-base text-[var(--paper)] mb-2">
                Visual Relay Map
              </h3>
              <p className="text-[var(--paper-dim)] text-xs leading-relaxed">
                Trace email hops chronologically across countries and BGP autonomous systems with sub-second transit latency markers.
              </p>
            </div>

            <div className="bg-[#181410] border border-[#3a352c] rounded-sm p-6 hover:border-[var(--stamp)] transition-colors">
              <div className="w-10 h-10 rounded bg-[rgba(201,162,39,0.15)] text-[var(--stamp)] flex items-center justify-center mb-4 border border-[rgba(201,162,39,0.3)]">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-display font-semibold text-base text-[var(--paper)] mb-2">
                One-Click PDF Dossiers
              </h3>
              <p className="text-[var(--paper-dim)] text-xs leading-relaxed">
                Generate court-admissible forensic summary dossiers sealed with SHA-256 hashes ready for law enforcement and insurance.
              </p>
            </div>

            <div className="bg-[#181410] border border-[#3a352c] rounded-sm p-6 hover:border-[var(--forensic-green)] transition-colors">
              <div className="w-10 h-10 rounded bg-[rgba(72,169,117,0.15)] text-[var(--forensic-green)] flex items-center justify-center mb-4 border border-[rgba(72,169,117,0.3)]">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-display font-semibold text-base text-[var(--paper)] mb-2">
                GDPR &amp; PII Sanitization
              </h3>
              <p className="text-[var(--paper-dim)] text-xs leading-relaxed">
                Automatically redact recipient names, private email addresses, and confidential company domains with built-in PII masking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Transparent Forensic Honesty Callout */}
      <section className="py-14 bg-[#14120f] border-b border-[var(--line)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-2xl text-left">
            <h3 className="font-display font-bold text-xl sm:text-2xl text-[var(--paper)] mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5 text-[var(--stamp)]" />
              <span>We give you mathematical proof, not probabilistic guesses.</span>
            </h3>
            <p className="text-[var(--paper-dim)] text-sm sm:text-base leading-relaxed">
              If an email has missing, stripped, or unverifiable headers, TraceXMail clearly reports it as &quot;Inconclusive (No Valid Origin Trail)&quot; with concrete verification steps rather than guessing.
            </p>
          </div>
          <div className="shrink-0">
            <button
              onClick={onOpenConsole}
              className="btn-primary py-3 px-6 text-sm font-semibold cursor-pointer shadow-lg"
            >
              Launch SOC Inspector
            </button>
          </div>
        </div>
      </section>

      {/* Team Access & Clearance Levels */}
      <section className="py-16 sm:py-20 border-b border-[var(--line)] bg-[#100e0c]" id="team-roles">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12 text-left">
            <div className="text-[var(--slate)] text-xs font-bold font-mono uppercase tracking-wider mb-2">
              Role-Based Access Control
            </div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-[36px] text-[var(--paper)] font-bold tracking-tight">
              Designed for your entire security team
            </h2>
            <p className="text-[var(--paper-dim)] mt-3 text-sm sm:text-base">
              From administrative policy managers to SOC tier-1 analysts and privacy compliance auditors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Admin */}
            <div className="bg-[#181410] border border-[#3a352c] rounded-sm p-6 border-t-4 border-t-[var(--stamp)] flex flex-col justify-between">
              <div>
                <div className="font-mono text-xs font-bold text-[var(--stamp)] uppercase mb-2">
                  GOLD CLEARANCE
                </div>
                <h3 className="font-display font-semibold text-lg text-[var(--paper)] mb-2">
                  Administrator
                </h3>
                <p className="text-[var(--paper-dim)] text-xs leading-relaxed mb-4">
                  Full control over organization API credentials, workspace privacy configurations, and historical threat case audits.
                </p>
              </div>
              <button
                onClick={onOpenConsole}
                className="text-xs font-bold text-[var(--stamp)] hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
              >
                <span>Sign in as Admin →</span>
              </button>
            </div>

            {/* Analyst */}
            <div className="bg-[#181410] border border-[#3a352c] rounded-sm p-6 border-t-4 border-t-[var(--slate)] flex flex-col justify-between">
              <div>
                <div className="font-mono text-xs font-bold text-[var(--slate)] uppercase mb-2">
                  STEEL CLEARANCE
                </div>
                <h3 className="font-display font-semibold text-lg text-[var(--paper)] mb-2">
                  Security Analyst
                </h3>
                <p className="text-[var(--paper-dim)] text-xs leading-relaxed mb-4">
                  Ingest raw RFC822 files, inspect hop traceroutes, analyze IP reputations, and export incident dossiers.
                </p>
              </div>
              <button
                onClick={onOpenConsole}
                className="text-xs font-bold text-[var(--slate)] hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
              >
                <span>Sign in as Analyst →</span>
              </button>
            </div>

            {/* Auditor */}
            <div className="bg-[#181410] border border-[#3a352c] rounded-sm p-6 border-t-4 border-t-[var(--paper-dim)] flex flex-col justify-between">
              <div>
                <div className="font-mono text-xs font-bold text-[var(--paper-dim)] uppercase mb-2">
                  SILVER CLEARANCE
                </div>
                <h3 className="font-display font-semibold text-lg text-[var(--paper)] mb-2">
                  Privacy Auditor
                </h3>
                <p className="text-[var(--paper-dim)] text-xs leading-relaxed mb-4">
                  Review historical incident logs with automated recipient PII masking active for GDPR &amp; HIPAA audits.
                </p>
              </div>
              <button
                onClick={onOpenConsole}
                className="text-xs font-bold text-[var(--paper-dim)] hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
              >
                <span>Sign in as Auditor →</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-20 bg-[radial-gradient(ellipse_800px_400px_at_50%_0%,rgba(178,58,46,0.15),transparent_70%),var(--ink)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-12 h-12 rounded-full border-2 border-[var(--thread)] mx-auto flex items-center justify-center mb-6 bg-[rgba(178,58,46,0.1)]">
            <Shield className="w-6 h-6 text-[var(--thread)]" />
          </div>

          <h2 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-[var(--paper)] leading-tight">
            Never wonder if an email is genuine again.
          </h2>
          <p className="text-[var(--paper-dim)] my-4 max-w-xl mx-auto text-base sm:text-lg">
            Paste any suspicious headers or drag-and-drop an .eml file to get instant cryptographic certainty.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3.5 mt-8">
            <button
              onClick={onOpenConsole}
              className="btn-primary py-3.5 px-8 text-base font-semibold cursor-pointer shadow-xl flex items-center gap-2"
            >
              <span>Launch TraceXMail Inspector</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onRequestAccess || onOpenConsole}
              className="btn-secondary py-3.5 px-6 text-base font-medium cursor-pointer"
            >
              <span>Request Team Access</span>
            </button>
          </div>
        </div>
      </section>

      {/* Clean Footer */}
      <footer className="border-t border-[var(--line)] py-8 bg-[#100e0c]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-[var(--paper-dim)]">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border border-[var(--thread)] relative shrink-0 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--thread)]" />
            </div>
            <span>TraceXMail — High-Precision Email Forensic Intelligence</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => scrollToSection('simulator')}
              className="hover:text-[var(--paper)] transition-colors cursor-pointer bg-transparent border-0"
            >
              Simulator
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-[var(--paper)] transition-colors cursor-pointer bg-transparent border-0"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('xray')}
              className="hover:text-[var(--paper)] transition-colors cursor-pointer bg-transparent border-0"
            >
              Header X-Ray
            </button>
            <button
              onClick={onOpenConsole}
              className="text-[var(--slate)] hover:text-[var(--paper)] transition-colors cursor-pointer bg-transparent border-0 font-medium"
            >
              SOC Console
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}
