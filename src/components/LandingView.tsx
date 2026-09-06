import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { SAMPLE_ANALYSES } from '../data/samples';
import { EmailAnalysis } from '../types';

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
    <div className="w-full min-h-screen bg-[#14120f] text-[#ede6d8] font-['IBM_Plex_Sans',-apple-system,BlinkMacSystemFont,sans-serif] text-[16px] leading-[1.6] antialiased selection:bg-[#b23a2e] selection:text-[#ede6d8] relative">
      
      <div id="top" />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#14120f] border-b border-[#3a352c]">
        <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-[22px] h-[22px] border-[1.5px] border-[#b23a2e] rounded-full relative shrink-0">
              <div className="absolute inset-[5px] rounded-full bg-[#b23a2e]" />
            </div>
            <span className="font-['Fraunces',serif] text-[18px] sm:text-[19px] font-semibold text-[#ede6d8]">
              TraceXMail
            </span>
            <span className="hidden sm:inline-block font-['IBM_Plex_Mono',monospace] text-[11px] text-[#b9af9c] tracking-wide ml-1">
              CASE-XM-01
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-8 text-[14.5px]">
            <button onClick={() => scrollToSection('pipeline')} className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors bg-transparent border-none cursor-pointer">
              How it works
            </button>
            <button onClick={() => scrollToSection('product')} className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors bg-transparent border-none cursor-pointer">
              Product
            </button>
            <button onClick={() => scrollToSection('exhibits')} className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors bg-transparent border-none cursor-pointer">
              Under the hood
            </button>
            <button onClick={() => scrollToSection('roles')} className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors bg-transparent border-none cursor-pointer">
              For your team
            </button>
            <button onClick={() => scrollToSection('team')} className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors bg-transparent border-none cursor-pointer">
              Team
            </button>
            <button onClick={() => scrollToSection('pricing')} className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors bg-transparent border-none cursor-pointer">
              Pricing
            </button>
            <button onClick={() => scrollToSection('faq')} className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors bg-transparent border-none cursor-pointer">
              FAQ
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={onOpenConsole}
              className="text-[#b9af9c] hover:text-[#ede6d8] text-[13.5px] sm:text-[14.5px] px-2 py-1 bg-transparent border-none cursor-pointer transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={onRequestAccess || onOpenConsole}
              className="hidden sm:inline-block bg-[#ede6d8] hover:bg-white text-[#14120f] px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-[3px] text-[13px] sm:text-[14px] font-semibold transition-colors cursor-pointer"
            >
              Request access
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
          <div className="lg:hidden bg-[#1a1712] border-b border-[#3a352c] px-4 py-4 flex flex-col gap-2">
            <button
              onClick={() => { scrollToSection('pipeline'); setMobileMenuOpen(false); }}
              className="text-left text-[#ede6d8] py-2 px-3 rounded hover:bg-[#26221b] text-[14.5px] font-medium"
            >
              How it works
            </button>
            <button
              onClick={() => { scrollToSection('product'); setMobileMenuOpen(false); }}
              className="text-left text-[#ede6d8] py-2 px-3 rounded hover:bg-[#26221b] text-[14.5px] font-medium"
            >
              Product
            </button>
            <button
              onClick={() => { scrollToSection('exhibits'); setMobileMenuOpen(false); }}
              className="text-left text-[#ede6d8] py-2 px-3 rounded hover:bg-[#26221b] text-[14.5px] font-medium"
            >
              Under the hood
            </button>
            <button
              onClick={() => { scrollToSection('roles'); setMobileMenuOpen(false); }}
              className="text-left text-[#ede6d8] py-2 px-3 rounded hover:bg-[#26221b] text-[14.5px] font-medium"
            >
              For your team
            </button>
            <button
              onClick={() => { scrollToSection('team'); setMobileMenuOpen(false); }}
              className="text-left text-[#ede6d8] py-2 px-3 rounded hover:bg-[#26221b] text-[14.5px] font-medium"
            >
              Team
            </button>
            <button
              onClick={() => { scrollToSection('pricing'); setMobileMenuOpen(false); }}
              className="text-left text-[#ede6d8] py-2 px-3 rounded hover:bg-[#26221b] text-[14.5px] font-medium"
            >
              Pricing
            </button>
            <button
              onClick={() => { scrollToSection('faq'); setMobileMenuOpen(false); }}
              className="text-left text-[#ede6d8] py-2 px-3 rounded hover:bg-[#26221b] text-[14.5px] font-medium"
            >
              FAQ
            </button>
            <div className="pt-3 border-t border-[#3a352c] flex flex-col gap-2">
              <button
                onClick={() => { (onRequestAccess || onOpenConsole)(); setMobileMenuOpen(false); }}
                className="w-full bg-[#b23a2e] text-[#ede6d8] py-2.5 rounded font-semibold text-[14px] text-center cursor-pointer"
              >
                Request access
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="py-12 sm:py-16 lg:py-24 border-b border-[#3a352c] relative bg-[radial-gradient(ellipse_700px_380px_at_78%_8%,rgba(178,58,46,0.07),transparent_60%),#14120f]">
        <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center relative z-10">
          <div>
            <h1 className="font-['Fraunces',serif] text-[28px] xs:text-[34px] sm:text-[44px] lg:text-[50px] font-medium leading-[1.12] text-[#ede6d8] tracking-tight max-w-xl">
              Every phishing email leaves a trail. We follow it to the source.
            </h1>
            <p className="mt-4 sm:mt-6 max-w-lg text-[#b9af9c] text-[15px] sm:text-[16.5px] leading-relaxed">
              TraceXMail reconstructs an email's real path: headers, authentication, hops, and infrastructure, turned into evidence your SOC can act on and defend in front of whoever asks how you know.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-3.5 mt-6 sm:mt-8">
              <button
                onClick={onRequestAccess || onOpenConsole}
                className="w-full sm:w-auto text-center bg-[#b23a2e] hover:bg-[#c94a3d] text-[#ede6d8] px-6 py-3 sm:py-3.5 rounded-[3px] font-semibold text-[14.5px] sm:text-[15px] border border-[#b23a2e] transition-all transform hover:-translate-y-0.5 cursor-pointer shadow-lg"
              >
                Request access
              </button>
              <button
                onClick={() => scrollToSection('pipeline')}
                className="w-full sm:w-auto text-center px-6 py-3 sm:py-3.5 rounded-[3px] font-medium text-[14.5px] sm:text-[15px] border border-[#3a352c] text-[#ede6d8] hover:border-[#b9af9c] hover:bg-[#1d1a15] transition-all cursor-pointer"
              >
                Walk through a trace
              </button>
            </div>

            <div className="mt-6 sm:mt-8 text-[13px] sm:text-[13.5px] text-[#b9af9c] max-w-md border-l-2 border-[#3a352c] pl-3.5">
              Built for security teams who need to prove what happened, not guess at it.
            </div>

            <div className="flex flex-wrap gap-2 mt-5 sm:mt-6">
              <span className="font-['IBM_Plex_Mono',monospace] text-[10px] sm:text-[11px] text-[#b9af9c] border border-[#3a352c] px-2 sm:px-2.5 py-1 rounded-[3px] break-normal">
                Real SPF/DKIM/DMARC verification
              </span>
              <span className="font-['IBM_Plex_Mono',monospace] text-[10px] sm:text-[11px] text-[#b9af9c] border border-[#3a352c] px-2 sm:px-2.5 py-1 rounded-[3px] break-normal">
                MaxMind GeoLite2 attribution
              </span>
              <span className="font-['IBM_Plex_Mono',monospace] text-[10px] sm:text-[11px] text-[#b9af9c] border border-[#3a352c] px-2 sm:px-2.5 py-1 rounded-[3px] break-normal">
                SHA-256 evidence hashing
              </span>
            </div>
          </div>

          {/* Evidence Board Visual (Responsive Cork + Pinned Cards) */}
          <div className="w-full max-w-[500px] mx-auto relative h-[380px] sm:h-[440px] rounded-[6px] border border-[#3d2f1f] bg-[repeating-radial-gradient(circle_at_12%_18%,rgba(0,0,0,0.10)_0px,rgba(0,0,0,0.10)_1px,transparent_2px,transparent_34px),repeating-radial-gradient(circle_at_70%_62%,rgba(0,0,0,0.08)_0px,rgba(0,0,0,0.08)_1px,transparent_2px,transparent_41px),linear-gradient(155deg,#2e2318,#241b12_55%,#1d1610)] shadow-[inset_0_0_60px_rgba(0,0,0,0.55),0_40px_90px_-30px_rgba(0,0,0,0.7)] select-none overflow-hidden">
            {/* SVG Connecting Thread Paths */}
            <svg className="absolute inset-0 w-full h-full drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] pointer-events-none" viewBox="0 0 400 440">
              <path
                d="M 60 106 C 120 78, 155 66, 196 76 C 246 88, 274 138, 306 186"
                fill="none"
                stroke="#b23a2e"
                strokeWidth="1.5"
                opacity="0.92"
                strokeDasharray="600"
                className="animate-[draw_1.9s_cubic-bezier(.3,.7,.3,1)_forwards]"
              />
              <path
                d="M 196 76 C 205 148, 196 200, 232 224"
                fill="none"
                stroke="#b23a2e"
                strokeWidth="1.5"
                opacity="0.92"
                strokeDasharray="600"
                className="animate-[draw_1.9s_cubic-bezier(.3,.7,.3,1)_forwards_0.15s]"
              />
              <path
                d="M 306 186 C 256 236, 200 268, 116 300"
                fill="none"
                stroke="#b23a2e"
                strokeWidth="1.5"
                opacity="0.92"
                strokeDasharray="600"
                className="animate-[draw_1.9s_cubic-bezier(.3,.7,.3,1)_forwards_0.3s]"
              />
            </svg>

            {/* Card 1: Tor Exit Node */}
            <div className="absolute top-[12%] left-[22%] -translate-x-1/2 -rotate-4 shadow-xl z-10 transition-transform hover:scale-105 hover:z-30 cursor-pointer" onClick={() => handleCaseClick(0)}>
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full z-20 bg-[radial-gradient(circle_at_32%_28%,#ff8d7d_0%,#b23a2e_48%,#7a2e26_100%)] shadow-[0_1px_1px_rgba(255,255,255,0.35)_inset,0_3px_4px_rgba(0,0,0,0.55)]" />
              <div className="w-[136px] sm:w-[155px] md:w-[165px] bg-[linear-gradient(180deg,#f2ecdf,#e7dfcd)] border border-black/20 rounded-[2px] p-2 sm:p-2.5 md:p-3 text-[#211d17]">
                <div className="font-['IBM_Plex_Mono',monospace] text-[10px] sm:text-[11.5px] font-medium text-[#2a2620]">185.220.101.5</div>
                <div className="font-['IBM_Plex_Mono',monospace] text-[9px] sm:text-[10px] text-[#7a2e26] mt-0.5 sm:mt-1 tracking-wider font-semibold">TOR EXIT NODE</div>
                <div className="h-1.5 rounded-[1px] bg-black/10 mt-1.5 sm:mt-2 overflow-hidden">
                  <div className="h-full bg-[#b23a2e] w-[92%]" />
                </div>
              </div>
            </div>

            {/* Card 2: SPF Softfail */}
            <div className="absolute top-[6%] left-[64%] sm:left-[60%] -translate-x-1/2 rotate-3 shadow-xl z-10 transition-transform hover:scale-105 hover:z-30 cursor-pointer" onClick={() => handleCaseClick(1)}>
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full z-20 bg-[radial-gradient(circle_at_32%_28%,#ff8d7d_0%,#b23a2e_48%,#7a2e26_100%)] shadow-[0_1px_1px_rgba(255,255,255,0.35)_inset,0_3px_4px_rgba(0,0,0,0.55)]" />
              <div className="w-[136px] sm:w-[155px] md:w-[165px] bg-[linear-gradient(180deg,#f2ecdf,#e7dfcd)] border border-black/20 rounded-[2px] p-2 sm:p-2.5 md:p-3 text-[#211d17]">
                <div className="font-['IBM_Plex_Mono',monospace] text-[10px] sm:text-[11.5px] font-medium text-[#2a2620]">SPF · SOFTFAIL</div>
                <div className="font-['IBM_Plex_Mono',monospace] text-[9px] sm:text-[10px] text-[#7a2e26] mt-0.5 sm:mt-1 tracking-wider font-semibold truncate">UNAUTHORIZED SENDER</div>
                <div className="h-1.5 rounded-[1px] bg-black/10 mt-1.5 sm:mt-2 overflow-hidden">
                  <div className="h-full bg-[#b23a2e] w-[70%]" />
                </div>
              </div>
            </div>

            {/* Card 3: ASN Bulgaria */}
            <div className="absolute top-[36%] left-[72%] sm:left-[76%] -translate-x-1/2 -rotate-2 shadow-xl z-10 transition-transform hover:scale-105 hover:z-30 cursor-pointer" onClick={() => handleCaseClick(2)}>
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full z-20 bg-[radial-gradient(circle_at_32%_28%,#ff8d7d_0%,#b23a2e_48%,#7a2e26_100%)] shadow-[0_1px_1px_rgba(255,255,255,0.35)_inset,0_3px_4px_rgba(0,0,0,0.55)]" />
              <div className="w-[136px] sm:w-[155px] md:w-[165px] bg-[linear-gradient(180deg,#f2ecdf,#e7dfcd)] border border-black/20 rounded-[2px] p-2 sm:p-2.5 md:p-3 text-[#211d17]">
                <div className="font-['IBM_Plex_Mono',monospace] text-[10px] sm:text-[11.5px] font-medium text-[#2a2620]">AS200548</div>
                <div className="font-['IBM_Plex_Mono',monospace] text-[9px] sm:text-[10px] text-[#7a2e26] mt-0.5 sm:mt-1 tracking-wider font-semibold truncate">BULGARIA · ZETTAHOST</div>
                <div className="h-1.5 rounded-[1px] bg-black/10 mt-1.5 sm:mt-2 overflow-hidden">
                  <div className="h-full bg-[#b23a2e] w-[55%]" />
                </div>
              </div>
            </div>

            {/* Card 4: Typosquat Domain */}
            <div className="absolute top-[60%] left-[28%] sm:left-[32%] -translate-x-1/2 rotate-[2.5deg] shadow-xl z-10 transition-transform hover:scale-105 hover:z-30 cursor-pointer" onClick={() => handleCaseClick(0)}>
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full z-20 bg-[radial-gradient(circle_at_32%_28%,#ff8d7d_0%,#b23a2e_48%,#7a2e26_100%)] shadow-[0_1px_1px_rgba(255,255,255,0.35)_inset,0_3px_4px_rgba(0,0,0,0.55)]" />
              <div className="w-[136px] sm:w-[155px] md:w-[165px] bg-[linear-gradient(180deg,#f2ecdf,#e7dfcd)] border border-black/20 rounded-[2px] p-2 sm:p-2.5 md:p-3 text-[#211d17]">
                <div className="font-['IBM_Plex_Mono',monospace] text-[9.5px] sm:text-[10.5px] font-medium text-[#2a2620] truncate">paypal-secure-update.com</div>
                <div className="font-['IBM_Plex_Mono',monospace] text-[9px] sm:text-[10px] text-[#7a2e26] mt-0.5 sm:mt-1 tracking-wider font-semibold">TYPOSQUAT DOMAIN</div>
                <div className="h-1.5 rounded-[1px] bg-black/10 mt-1.5 sm:mt-2 overflow-hidden">
                  <div className="h-full bg-[#b23a2e] w-[88%]" />
                </div>
              </div>
            </div>

            {/* Stamp Overlay */}
            <div className="absolute bottom-3 right-3 sm:bottom-6 sm:right-6 w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full flex items-center justify-center text-center font-['IBM_Plex_Mono',monospace] text-[10px] sm:text-[11px] md:text-[12px] font-bold tracking-wider text-[#b23a2e] bg-[radial-gradient(circle,transparent_58%,rgba(178,58,46,0.10)_60%,transparent_62%)] shadow-[0_0_0_2px_#b23a2e,0_0_0_4px_transparent,0_0_0_5.5px_rgba(178,58,46,0.35)] -rotate-12 transform hover:rotate-0 transition-transform">
              VERDICT<br />PHISHING<br />CONFIRMED
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-16 border-b border-[#3a352c]">
        <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-['Fraunces',serif] text-[26px] sm:text-[32px] font-medium text-[#ede6d8]">
              The gap attackers count on
            </h2>
            <p className="text-[#b9af9c] mt-4 text-[15px] leading-relaxed max-w-[42ch]">
              Spoofing a display name takes an attacker seconds. Proving where an email actually came from, and whether that display name was ever telling the truth, is the part that takes an analyst time nobody has during an active incident.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3.5 p-4 bg-[#1d1a15] border border-[#3a352c] rounded-[4px]">
              <span className="font-['IBM_Plex_Mono',monospace] text-[10.5px] px-2 py-0.5 rounded bg-[#b23a2e]/15 text-[#b23a2e] shrink-0 mt-0.5 font-bold">
                WITHOUT TRACING
              </span>
              <p className="m-0 text-[14px] text-[#b9af9c] leading-relaxed">
                A "CEO" wire request looks legitimate until someone manually checks headers, if anyone does at all.
              </p>
            </div>

            <div className="flex items-start gap-3.5 p-4 bg-[#1d1a15] border border-[#3a352c] rounded-[4px]">
              <span className="font-['IBM_Plex_Mono',monospace] text-[10.5px] px-2 py-0.5 rounded bg-[#c9a227]/15 text-[#c9a227] shrink-0 mt-0.5 font-bold">
                WITH TRACEXMAIL
              </span>
              <p className="m-0 text-[14px] text-[#b9af9c] leading-relaxed">
                The same email is decomposed, authenticated, and geolocated automatically, with the evidence to back up the verdict.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Proof Band */}
      <section className="py-10 border-b border-[#3a352c] bg-[#1d1a15] text-center">
        <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-[#b9af9c] text-[14.5px] max-w-[60ch] mx-auto m-0 leading-relaxed">
            Trained and validated against the <strong className="text-[#ede6d8] font-semibold">Nazario Phishing Corpus</strong> and the <strong className="text-[#ede6d8] font-semibold">Enron Email Corpus</strong>: real attacks and real legitimate mail, not synthetic examples.
          </p>
        </div>
      </section>

      {/* 6-Stage Pipeline Section */}
      <section id="pipeline" className="py-20 border-b border-[#3a352c]">
        <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[640px] mb-12">
            <h2 className="font-['Fraunces',serif] text-[28px] sm:text-[34px] font-medium text-[#ede6d8]">
              From inbox to verdict
            </h2>
            <p className="text-[#b9af9c] mt-3 text-[15.5px] max-w-[52ch]">
              Six stages, run on every email in the same order every time, so two analysts looking at the same message reach the same conclusion.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8 relative">
            <div className="relative pr-4">
              <div className="w-[38px] h-[38px] rounded-full bg-[#14120f] border-[1.5px] border-[#b23a2e] text-[#b23a2e] font-['IBM_Plex_Mono',monospace] text-[13px] font-bold flex items-center justify-center mb-4 z-10 relative">
                1
              </div>
              <h3 className="font-['IBM_Plex_Sans',sans-serif] font-semibold text-[15.5px] text-[#ede6d8] mb-2">
                Ingest
              </h3>
              <p className="text-[#b9af9c] text-[13.8px] leading-relaxed m-0">
                An email arrives, uploaded directly or synced live from a connected Gmail inbox.
              </p>
            </div>

            <div className="relative pr-4">
              <div className="w-[38px] h-[38px] rounded-full bg-[#14120f] border-[1.5px] border-[#b23a2e] text-[#b23a2e] font-['IBM_Plex_Mono',monospace] text-[13px] font-bold flex items-center justify-center mb-4 z-10 relative">
                2
              </div>
              <h3 className="font-['IBM_Plex_Sans',sans-serif] font-semibold text-[15.5px] text-[#ede6d8] mb-2">
                Header forensics
              </h3>
              <p className="text-[#b9af9c] text-[13.8px] leading-relaxed m-0">
                Received chains, Message-ID, and Return-Path are parsed and checked for tampering.
              </p>
            </div>

            <div className="relative pr-4">
              <div className="w-[38px] h-[38px] rounded-full bg-[#14120f] border-[1.5px] border-[#b23a2e] text-[#b23a2e] font-['IBM_Plex_Mono',monospace] text-[13px] font-bold flex items-center justify-center mb-4 z-10 relative">
                3
              </div>
              <h3 className="font-['IBM_Plex_Sans',sans-serif] font-semibold text-[15.5px] text-[#ede6d8] mb-2">
                Authentication
              </h3>
              <p className="text-[#b9af9c] text-[13.8px] leading-relaxed m-0">
                SPF, DKIM, DMARC, and ARC verified live against DNS, never assumed.
              </p>
            </div>

            <div className="relative pr-4">
              <div className="w-[38px] h-[38px] rounded-full bg-[#14120f] border-[1.5px] border-[#b23a2e] text-[#b23a2e] font-['IBM_Plex_Mono',monospace] text-[13px] font-bold flex items-center justify-center mb-4 z-10 relative">
                4
              </div>
              <h3 className="font-['IBM_Plex_Sans',sans-serif] font-semibold text-[15.5px] text-[#ede6d8] mb-2">
                Origin &amp; geolocation
              </h3>
              <p className="text-[#b9af9c] text-[13.8px] leading-relaxed m-0">
                The real sending host and its place on the map, with untrusted hops excluded rather than guessed.
              </p>
            </div>

            <div className="relative pr-4">
              <div className="w-[38px] h-[38px] rounded-full bg-[#14120f] border-[1.5px] border-[#b23a2e] text-[#b23a2e] font-['IBM_Plex_Mono',monospace] text-[13px] font-bold flex items-center justify-center mb-4 z-10 relative">
                5
              </div>
              <h3 className="font-['IBM_Plex_Sans',sans-serif] font-semibold text-[15.5px] text-[#ede6d8] mb-2">
                Correlation
              </h3>
              <p className="text-[#b9af9c] text-[13.8px] leading-relaxed m-0">
                Matched against other cases to surface a campaign, not just one message.
              </p>
            </div>

            <div className="relative pr-4">
              <div className="w-[38px] h-[38px] rounded-full bg-[#14120f] border-[1.5px] border-[#b23a2e] text-[#b23a2e] font-['IBM_Plex_Mono',monospace] text-[13px] font-bold flex items-center justify-center mb-4 z-10 relative">
                6
              </div>
              <h3 className="font-['IBM_Plex_Sans',sans-serif] font-semibold text-[15.5px] text-[#ede6d8] mb-2">
                Verdict
              </h3>
              <p className="text-[#b9af9c] text-[13.8px] leading-relaxed m-0">
                A forensic report with evidence IDs behind it, ready to hand to anyone who asks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Section / Interactive Mockup */}
      <section id="product" className="py-20 border-b border-[#3a352c]">
        <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[640px] mb-12">
            <h2 className="font-['Fraunces',serif] text-[28px] sm:text-[34px] font-medium text-[#ede6d8]">
              What your analysts actually open
            </h2>
            <p className="text-[#b9af9c] mt-3 text-[15.5px] max-w-[52ch]">
              The board on the left is the idea. This is the tool: the same cases, the same evidence, laid out for someone working a queue, not admiring a metaphor.
            </p>
          </div>

          <div className="rounded-[8px] overflow-hidden shadow-[0_50px_100px_-40px_rgba(0,0,0,0.8),0_0_0_1px_#3a352c]">
            <div className="bg-[#0b0d12] px-3.5 py-2.5 flex items-center gap-4 border-b border-[#1c2028]">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2a2f38]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#2a2f38]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#2a2f38]" />
              </div>
              <div className="flex-1 bg-[#151920] rounded-[5px] px-3 py-1 font-['IBM_Plex_Mono',monospace] text-[12px] text-[#5b6470]">
                app.tracexmail.io/cases/case-2291
              </div>
            </div>

            <div className="bg-[#0f1219] flex min-h-[380px]">
              <div className="w-14 bg-[#0b0d12] border-r border-[#1c2028] hidden sm:flex flex-col items-center py-4 gap-5">
                <i className="w-4.5 h-4.5 rounded-[5px] bg-[#3b5b78]" />
                <i className="w-4.5 h-4.5 rounded-[5px] bg-[#232833]" />
                <i className="w-4.5 h-4.5 rounded-[5px] bg-[#232833]" />
                <i className="w-4.5 h-4.5 rounded-[5px] bg-[#232833]" />
              </div>

              <div className="flex-1 p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5">
                  <div className="bg-[#151a22] border border-[#1f2632] rounded-[6px] p-3.5">
                    <div className="text-[10.5px] text-[#5b6470] uppercase tracking-wider font-semibold">
                      Open cases
                    </div>
                    <div className="font-['IBM_Plex_Mono',monospace] text-[20px] text-[#e8836f] mt-1 font-bold">
                      14
                    </div>
                  </div>
                  <div className="bg-[#151a22] border border-[#1f2632] rounded-[6px] p-3.5">
                    <div className="text-[10.5px] text-[#5b6470] uppercase tracking-wider font-semibold">
                      Threat clusters
                    </div>
                    <div className="font-['IBM_Plex_Mono',monospace] text-[20px] text-[#e7ebf1] mt-1 font-bold">
                      3
                    </div>
                  </div>
                  <div className="bg-[#151a22] border border-[#1f2632] rounded-[6px] p-3.5">
                    <div className="text-[10.5px] text-[#5b6470] uppercase tracking-wider font-semibold">
                      Avg. threat score
                    </div>
                    <div className="font-['IBM_Plex_Mono',monospace] text-[20px] text-[#7fb2e8] mt-1 font-bold">
                      71
                    </div>
                  </div>
                </div>

                <div className="border border-[#232833] rounded-[6px] overflow-hidden bg-[#12151c]">
                  <div className="grid grid-cols-12 gap-2 sm:gap-3 px-3 sm:px-3.5 py-2.5 text-[10.5px] uppercase tracking-wider text-[#5b6470] font-semibold border-b border-[#232833] bg-[#0f1219]">
                    <div className="col-span-3 sm:col-span-2">Case</div>
                    <div className="col-span-6 sm:col-span-7">Subject</div>
                    <div className="col-span-3 sm:col-span-2">Severity</div>
                    <div className="hidden sm:block sm:col-span-1 text-right">Score</div>
                  </div>

                  {/* Row 1 */}
                  <div
                    onClick={() => handleCaseClick(0)}
                    className="grid grid-cols-12 gap-2 sm:gap-3 px-3 sm:px-3.5 py-3 text-[12px] sm:text-[12.5px] items-center border-b border-[#1a1f28] hover:bg-[#1a1e27] cursor-pointer transition-colors min-w-0"
                  >
                    <div className="col-span-3 sm:col-span-2 font-['IBM_Plex_Mono',monospace] text-[#7fb2e8] text-[11px] sm:text-[11.5px] font-bold">
                      CASE-2291
                    </div>
                    <div className="col-span-6 sm:col-span-7 text-[#c7cdd6] truncate font-medium min-w-0">
                      Urgent: Updated Direct Deposit Routing
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <span className="font-['IBM_Plex_Mono',monospace] text-[9.5px] sm:text-[10px] px-2 py-0.5 rounded bg-[#e8836f]/15 text-[#e8836f] font-bold">
                        CRITICAL
                      </span>
                    </div>
                    <div className="hidden sm:block sm:col-span-1 font-['IBM_Plex_Mono',monospace] text-[#9aa3af] text-right font-bold">
                      94
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div
                    onClick={() => handleCaseClick(1)}
                    className="grid grid-cols-12 gap-2 sm:gap-3 px-3 sm:px-3.5 py-3 text-[12px] sm:text-[12.5px] items-center border-b border-[#1a1f28] hover:bg-[#1a1e27] cursor-pointer transition-colors min-w-0"
                  >
                    <div className="col-span-3 sm:col-span-2 font-['IBM_Plex_Mono',monospace] text-[#7fb2e8] text-[11px] sm:text-[11.5px] font-bold">
                      CASE-2288
                    </div>
                    <div className="col-span-6 sm:col-span-7 text-[#c7cdd6] truncate font-medium min-w-0">
                      Action Required: Verify Office 365 Password
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <span className="font-['IBM_Plex_Mono',monospace] text-[9.5px] sm:text-[10px] px-2 py-0.5 rounded bg-[#e6b678]/15 text-[#e6b678] font-bold">
                        HIGH
                      </span>
                    </div>
                    <div className="hidden sm:block sm:col-span-1 font-['IBM_Plex_Mono',monospace] text-[#9aa3af] text-right font-bold">
                      86
                    </div>
                  </div>

                  {/* Row 3 */}
                  <div
                    onClick={() => handleCaseClick(2)}
                    className="grid grid-cols-12 gap-2 sm:gap-3 px-3 sm:px-3.5 py-3 text-[12px] sm:text-[12.5px] items-center hover:bg-[#1a1e27] cursor-pointer transition-colors min-w-0"
                  >
                    <div className="col-span-3 sm:col-span-2 font-['IBM_Plex_Mono',monospace] text-[#7fb2e8] text-[11px] sm:text-[11.5px] font-bold">
                      CASE-2281
                    </div>
                    <div className="col-span-6 sm:col-span-7 text-[#c7cdd6] truncate font-medium min-w-0">
                      Your document is waiting for signature
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <span className="font-['IBM_Plex_Mono',monospace] text-[9.5px] sm:text-[10px] px-2 py-0.5 rounded bg-[#7fb2e8]/15 text-[#7fb2e8] font-bold">
                        MEDIUM
                      </span>
                    </div>
                    <div className="hidden sm:block sm:col-span-1 font-['IBM_Plex_Mono',monospace] text-[#9aa3af] text-right font-bold">
                      62
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 text-[#b9af9c] text-[13.8px] leading-relaxed">
            Every row links back to the same evidence chain (headers, DNS results, hop-by-hop geolocation) that an analyst can open, not a score they have to trust blind.
          </p>
        </div>
      </section>

      {/* Exhibits Section */}
      <section id="exhibits" className="py-20 border-b border-[#3a352c]">
        <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[640px] mb-12">
            <h2 className="font-['Fraunces',serif] text-[28px] sm:text-[34px] font-medium text-[#ede6d8]">
              What's actually doing the work
            </h2>
            <p className="text-[#b9af9c] mt-3 text-[15.5px] max-w-[52ch]">
              Four systems most email tools skip, because they're the difference between a plausible guess and evidence that holds up.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Exhibit A */}
            <div className="bg-[linear-gradient(180deg,#1d1a15,#1a1712)] border border-[#3a352c] rounded-[2px] p-7 relative shadow-[0_18px_34px_-18px_rgba(0,0,0,0.6)] transform -rotate-1 hover:rotate-0 hover:-translate-y-1 transition-all">
              <span className="absolute -top-2.5 left-6 bg-[#c9a227] text-[#14120f] font-['IBM_Plex_Mono',monospace] text-[10.5px] font-bold px-2 py-0.5 rounded-[2px] shadow-md">
                EXHIBIT A
              </span>
              <h3 className="font-['Fraunces',serif] text-[18px] font-semibold text-[#ede6d8] mt-2 mb-3">
                Evidence Vault
              </h3>
              <p className="text-[#b9af9c] text-[14.3px] leading-relaxed m-0">
                Every finding is hashed and timestamped the moment it's produced. Nothing in a report can be quietly edited after the fact. A changed field means a new record, not an overwrite.
              </p>
            </div>

            {/* Exhibit B */}
            <div className="bg-[linear-gradient(180deg,#1d1a15,#1a1712)] border border-[#3a352c] rounded-[2px] p-7 relative shadow-[0_18px_34px_-18px_rgba(0,0,0,0.6)] transform rotate-1 hover:rotate-0 hover:-translate-y-1 transition-all md:mt-4">
              <span className="absolute -top-2.5 left-6 bg-[#c9a227] text-[#14120f] font-['IBM_Plex_Mono',monospace] text-[10.5px] font-bold px-2 py-0.5 rounded-[2px] shadow-md">
                EXHIBIT B
              </span>
              <h3 className="font-['Fraunces',serif] text-[18px] font-semibold text-[#ede6d8] mt-2 mb-3">
                Trust-boundary origin engine
              </h3>
              <p className="text-[#b9af9c] text-[14.3px] leading-relaxed m-0">
                The earliest IP in a header isn't always the attacker's. TraceXMail knows which hops to trust before it names a source.
              </p>
            </div>

            {/* Exhibit C */}
            <div className="bg-[linear-gradient(180deg,#1d1a15,#1a1712)] border border-[#3a352c] rounded-[2px] p-7 relative shadow-[0_18px_34px_-18px_rgba(0,0,0,0.6)] transform rotate-[0.5deg] hover:rotate-0 hover:-translate-y-1 transition-all">
              <span className="absolute -top-2.5 left-6 bg-[#c9a227] text-[#14120f] font-['IBM_Plex_Mono',monospace] text-[10.5px] font-bold px-2 py-0.5 rounded-[2px] shadow-md">
                EXHIBIT C
              </span>
              <h3 className="font-['Fraunces',serif] text-[18px] font-semibold text-[#ede6d8] mt-2 mb-3">
                Attribution engine
              </h3>
              <p className="text-[#b9af9c] text-[14.3px] leading-relaxed m-0">
                Every verdict comes with the evidence behind it, labeled as a fact, a finding, or a hypothesis, and never blurred together into one confident-sounding line.
              </p>
            </div>

            {/* Exhibit D */}
            <div className="bg-[linear-gradient(180deg,#1d1a15,#1a1712)] border border-[#3a352c] rounded-[2px] p-7 relative shadow-[0_18px_34px_-18px_rgba(0,0,0,0.6)] transform -rotate-[0.5deg] hover:rotate-0 hover:-translate-y-1 transition-all md:mt-2">
              <span className="absolute -top-2.5 left-6 bg-[#c9a227] text-[#14120f] font-['IBM_Plex_Mono',monospace] text-[10.5px] font-bold px-2 py-0.5 rounded-[2px] shadow-md">
                EXHIBIT D
              </span>
              <h3 className="font-['Fraunces',serif] text-[18px] font-semibold text-[#ede6d8] mt-2 mb-3">
                Campaign correlation
              </h3>
              <p className="text-[#b9af9c] text-[14.3px] leading-relaxed m-0">
                One email rarely stands alone. Shared infrastructure and timing surface the wider campaign, tiered by how strong the link really is.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Honesty Callout */}
      <section className="py-20 bg-[#26221b] border-b border-[#3a352c]">
        <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center gap-8 sm:gap-12">
          <div className="w-28 h-28 sm:w-36 sm:h-36 md:w-[152px] md:h-[152px] rounded-full text-[#c9a227] flex items-center justify-center text-center font-['IBM_Plex_Mono',monospace] text-[11px] sm:text-[12.5px] md:text-[13.5px] font-bold leading-tight p-2.5 rotate-6 shrink-0 shadow-[0_0_0_2px_#c9a227,0_0_0_5px_rgba(201,162,39,0.30)]">
            UNKNOWN<br />IS A VALID<br />RESULT
          </div>

          <div>
            <h2 className="font-['Fraunces',serif] text-[24px] sm:text-[30px] font-medium text-[#ede6d8] mb-4 max-w-[18ch]">
              We'd rather tell you we don't know.
            </h2>
            <p className="text-[#b9af9c] text-[16px] leading-relaxed m-0 max-w-[56ch]">
              When the evidence doesn't support a verdict, TraceXMail says so, instead of manufacturing confidence your team would have to defend later in front of a client or a regulator without the evidence to back it up.
            </p>
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section id="roles" className="py-20 border-b border-[#3a352c]">
        <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[640px] mb-12">
            <h2 className="font-['Fraunces',serif] text-[28px] sm:text-[34px] font-medium text-[#ede6d8]">
              Built around who's actually looking at it
            </h2>
            <p className="text-[#b9af9c] mt-3 text-[15.5px] max-w-[52ch]">
              Access matches the job. Nobody sees more than they need, and nobody with real work to do is left waiting on a request.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Admin */}
            <div className="bg-[#1d1a15] border border-[#3a352c] rounded-[2px] p-6 hover:bg-[#221e17] transition-colors">
              <div className="font-['IBM_Plex_Mono',monospace] text-[11.5px] text-[#b9af9c] mb-2.5 flex items-center gap-2 font-bold">
                <span className="w-2 h-2 rounded-full bg-[#b23a2e]" />
                CLEARANCE · ADMIN
              </div>
              <h3 className="font-['IBM_Plex_Sans',sans-serif] font-semibold text-[16.5px] text-[#ede6d8] mb-2">
                Admin
              </h3>
              <p className="text-[#b9af9c] text-[14px] leading-relaxed m-0">
                Manages the organization, invites the team, and sets who can see unmasked evidence.
              </p>
            </div>

            {/* Analyst */}
            <div className="bg-[#1d1a15] border border-[#3a352c] rounded-[2px] p-6 hover:bg-[#221e17] transition-colors">
              <div className="font-['IBM_Plex_Mono',monospace] text-[11.5px] text-[#b9af9c] mb-2.5 flex items-center gap-2 font-bold">
                <span className="w-2 h-2 rounded-full bg-[#7fa3ba]" />
                CLEARANCE · ANALYST
              </div>
              <h3 className="font-['IBM_Plex_Sans',sans-serif] font-semibold text-[16.5px] text-[#ede6d8] mb-2">
                Analyst
              </h3>
              <p className="text-[#b9af9c] text-[14px] leading-relaxed m-0">
                Uploads, investigates, and closes cases: the full working view, evidence and all.
              </p>
            </div>

            {/* Read-Only */}
            <div className="bg-[#1d1a15] border border-[#3a352c] rounded-[2px] p-6 hover:bg-[#221e17] transition-colors">
              <div className="font-['IBM_Plex_Mono',monospace] text-[11.5px] text-[#b9af9c] mb-2.5 flex items-center gap-2 font-bold">
                <span className="w-2 h-2 rounded-full bg-[#b9af9c]" />
                CLEARANCE · READ-ONLY
              </div>
              <h3 className="font-['IBM_Plex_Sans',sans-serif] font-semibold text-[16.5px] text-[#ede6d8] mb-2">
                Auditor
              </h3>
              <p className="text-[#b9af9c] text-[14px] leading-relaxed m-0">
                Sees the same cases with personal data masked by default, and can't alter what's on file.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section id="team" className="py-20 border-b border-[#3a352c]">
        <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[640px] mb-12">
            <h2 className="font-['Fraunces',serif] text-[28px] sm:text-[34px] font-medium text-[#ede6d8]">
              The people behind the case file
            </h2>
            <p className="text-[#b9af9c] mt-3 text-[15.5px] max-w-[52ch]">
              Six of us, each owning one piece of the pipeline, from raw header parsing to the console an analyst actually opens.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Agent 01 */}
            <div className="bg-[linear-gradient(180deg,#f2ecdf,#e7dfcd)] border border-black/15 rounded-[2px] p-[18px] text-[#211d17] shadow-md">
              <div className="bg-[#14120f] text-[#b9af9c] font-['IBM_Plex_Mono',monospace] text-[10.5px] font-semibold px-2 py-0.5 rounded-[2px] inline-block mb-3">
                AGENT-01
              </div>
              <h3 className="font-['Fraunces',serif] font-semibold text-[17px] text-[#211d17] m-0 mb-2">
                Jayaram Sappa
              </h3>
              <div className="flex items-center gap-2 text-[13px] text-[#4a453b]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#b23a2e] shrink-0" />
                <span>System Design &amp; Backend Engineering</span>
              </div>
            </div>

            {/* Agent 02 */}
            <div className="bg-[linear-gradient(180deg,#f2ecdf,#e7dfcd)] border border-black/15 rounded-[2px] p-[18px] text-[#211d17] shadow-md">
              <div className="bg-[#14120f] text-[#b9af9c] font-['IBM_Plex_Mono',monospace] text-[10.5px] font-semibold px-2 py-0.5 rounded-[2px] inline-block mb-3">
                AGENT-02
              </div>
              <h3 className="font-['Fraunces',serif] font-semibold text-[17px] text-[#211d17] m-0 mb-2">
                Vennela Obilisetti
              </h3>
              <div className="flex items-center gap-2 text-[13px] text-[#4a453b]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c9a227] shrink-0" />
                <span>Threat Intelligence</span>
              </div>
            </div>

            {/* Agent 03 */}
            <div className="bg-[linear-gradient(180deg,#f2ecdf,#e7dfcd)] border border-black/15 rounded-[2px] p-[18px] text-[#211d17] shadow-md">
              <div className="bg-[#14120f] text-[#b9af9c] font-['IBM_Plex_Mono',monospace] text-[10.5px] font-semibold px-2 py-0.5 rounded-[2px] inline-block mb-3">
                AGENT-03
              </div>
              <h3 className="font-['Fraunces',serif] font-semibold text-[17px] text-[#211d17] m-0 mb-2">
                Katari Pavan Sai Krishna
              </h3>
              <div className="flex items-center gap-2 text-[13px] text-[#4a453b]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7fa3ba] shrink-0" />
                <span>ML Training</span>
              </div>
            </div>

            {/* Agent 04 */}
            <div className="bg-[linear-gradient(180deg,#f2ecdf,#e7dfcd)] border border-black/15 rounded-[2px] p-[18px] text-[#211d17] shadow-md">
              <div className="bg-[#14120f] text-[#b9af9c] font-['IBM_Plex_Mono',monospace] text-[10.5px] font-semibold px-2 py-0.5 rounded-[2px] inline-block mb-3">
                AGENT-04
              </div>
              <h3 className="font-['Fraunces',serif] font-semibold text-[17px] text-[#211d17] m-0 mb-2">
                Eeli Hema Venkata Lalitha
              </h3>
              <div className="flex items-center gap-2 text-[13px] text-[#4a453b]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#b23a2e] shrink-0" />
                <span>Forensics</span>
              </div>
            </div>

            {/* Agent 05 */}
            <div className="bg-[linear-gradient(180deg,#f2ecdf,#e7dfcd)] border border-black/15 rounded-[2px] p-[18px] text-[#211d17] shadow-md">
              <div className="bg-[#14120f] text-[#b9af9c] font-['IBM_Plex_Mono',monospace] text-[10.5px] font-semibold px-2 py-0.5 rounded-[2px] inline-block mb-3">
                AGENT-05
              </div>
              <h3 className="font-['Fraunces',serif] font-semibold text-[17px] text-[#211d17] m-0 mb-2">
                Sairam Saladi
              </h3>
              <div className="flex items-center gap-2 text-[13px] text-[#4a453b]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c9a227] shrink-0" />
                <span>Database Integration</span>
              </div>
            </div>

            {/* Agent 06 */}
            <div className="bg-[linear-gradient(180deg,#f2ecdf,#e7dfcd)] border border-black/15 rounded-[2px] p-[18px] text-[#211d17] shadow-md">
              <div className="bg-[#14120f] text-[#b9af9c] font-['IBM_Plex_Mono',monospace] text-[10.5px] font-semibold px-2 py-0.5 rounded-[2px] inline-block mb-3">
                AGENT-06
              </div>
              <h3 className="font-['Fraunces',serif] font-semibold text-[17px] text-[#211d17] m-0 mb-2">
                Penugonda Mounika
              </h3>
              <div className="flex items-center gap-2 text-[13px] text-[#4a453b]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7fa3ba] shrink-0" />
                <span>Frontend Engineering</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why We Built This Section */}
      <section className="py-20 border-b border-[#3a352c]">
        <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[640px] mb-12">
            <h2 className="font-['Fraunces',serif] text-[28px] sm:text-[34px] font-medium text-[#ede6d8]">
              Why we built this
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#1d1a15] border border-[#3a352c] rounded-[4px] p-6">
              <p className="text-[#b9af9c] text-[15px] leading-relaxed mb-4 m-0 italic">
                "Building TraceXMail required constructing a deterministic forensic pipeline that verifies raw RFC822 headers, live SPF/DKIM/DMARC records, and BGP/ASN telemetry without relying on black-box heuristics."
              </p>
              <div className="font-['IBM_Plex_Mono',monospace] text-[12px] text-[#7fa3ba]">
                Jayaram Sappa, System Design &amp; Backend Engineering
              </div>
            </div>

            <div className="bg-[#1d1a15] border border-[#3a352c] rounded-[4px] p-6">
              <p className="text-[#b9af9c] text-[15px] leading-relaxed mb-4 m-0 italic">
                "Threat intelligence is only actionable when it identifies origin infrastructure and campaign clusters rather than just flagging domain age."
              </p>
              <div className="font-['IBM_Plex_Mono',monospace] text-[12px] text-[#7fa3ba]">
                Vennela Obilisetti, Threat Intelligence
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 border-b border-[#3a352c]">
        <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[640px] mb-12">
            <h2 className="font-['Fraunces',serif] text-[28px] sm:text-[34px] font-medium text-[#ede6d8]">
              Pricing
            </h2>
            <p className="text-[#b9af9c] mt-3 text-[15.5px] max-w-[52ch]">
              We're in pilot with a small number of security teams right now, so this reflects that stage, not a finished commercial plan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pilot Access */}
            <div className="bg-[#1d1a15] border-2 border-[#b23a2e] rounded-[4px] p-7 flex flex-col justify-between">
              <div>
                <div className="font-['IBM_Plex_Mono',monospace] text-[12px] text-[#b9af9c] mb-2 font-bold">
                  PILOT ACCESS
                </div>
                <div className="font-['Fraunces',serif] text-[32px] text-[#ede6d8] mb-1 font-semibold">
                  Free
                </div>
                <div className="text-[#b9af9c] text-[13.5px] mb-5">
                  For security teams evaluating TraceXMail during the pilot phase
                </div>

                <ul className="list-none p-0 m-0 mb-6 space-y-2.5">
                  <li className="text-[#b9af9c] text-[14px] pl-5 relative before:content-[''] before:absolute before:left-0 before:top-[7px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-[#7fa3ba]">
                    Full analyst console, no feature gating
                  </li>
                  <li className="text-[#b9af9c] text-[14px] pl-5 relative before:content-[''] before:absolute before:left-0 before:top-[7px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-[#7fa3ba]">
                    Unlimited case uploads during the pilot window
                  </li>
                  <li className="text-[#b9af9c] text-[14px] pl-5 relative before:content-[''] before:absolute before:left-0 before:top-[7px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-[#7fa3ba]">
                    A direct line to the team building it
                  </li>
                </ul>
              </div>

              <button
                onClick={onRequestAccess || onOpenConsole}
                className="w-full bg-[#b23a2e] hover:bg-[#c94a3d] text-[#ede6d8] py-3 px-6 rounded-[3px] font-semibold text-[15px] border border-[#b23a2e] transition-colors cursor-pointer text-center"
              >
                Request pilot access
              </button>
            </div>

            {/* Enterprise */}
            <div className="bg-[#1d1a15] border border-[#3a352c] rounded-[4px] p-7 flex flex-col justify-between">
              <div>
                <div className="font-['IBM_Plex_Mono',monospace] text-[12px] text-[#b9af9c] mb-2 font-bold">
                  ENTERPRISE
                </div>
                <div className="font-['Fraunces',serif] text-[32px] text-[#ede6d8] mb-1 font-semibold">
                  Let's talk
                </div>
                <div className="text-[#b9af9c] text-[13.5px] mb-5">
                  For organizations needing custom deployment, SLAs, or on-prem hosting
                </div>

                <ul className="list-none p-0 m-0 mb-6 space-y-2.5">
                  <li className="text-[#b9af9c] text-[14px] pl-5 relative before:content-[''] before:absolute before:left-0 before:top-[7px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-[#7fa3ba]">
                    Dedicated onboarding
                  </li>
                  <li className="text-[#b9af9c] text-[14px] pl-5 relative before:content-[''] before:absolute before:left-0 before:top-[7px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-[#7fa3ba]">
                    Custom retention and compliance terms
                  </li>
                  <li className="text-[#b9af9c] text-[14px] pl-5 relative before:content-[''] before:absolute before:left-0 before:top-[7px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-[#7fa3ba]">
                    Priority support
                  </li>
                </ul>
              </div>

              <button
                onClick={onRequestAccess || onOpenConsole}
                className="w-full bg-transparent hover:bg-[#221e17] text-[#ede6d8] py-3 px-6 rounded-[3px] font-medium text-[15px] border border-[#3a352c] hover:border-[#b9af9c] transition-colors cursor-pointer text-center"
              >
                Talk to us
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 border-b border-[#3a352c]">
        <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[640px] mb-8">
            <h2 className="font-['Fraunces',serif] text-[28px] sm:text-[34px] font-medium text-[#ede6d8]">
              Questions we get asked
            </h2>
          </div>

          <div className="max-w-[760px] flex flex-col">
            {/* FAQ 1 */}
            <div className="border-b border-[#3a352c] py-5">
              <button
                onClick={() => toggleFaq(0)}
                className="w-full text-left font-semibold text-[15px] text-[#ede6d8] flex justify-between items-center gap-4 bg-transparent border-none cursor-pointer p-0"
              >
                <span>Do you store the contents of the emails I upload?</span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[#b9af9c] text-[18px]">
                  {activeFaq === 0 ? '−' : '+'}
                </span>
              </button>
              {activeFaq === 0 && (
                <p className="text-[#b9af9c] text-[14px] mt-3 m-0 max-w-[64ch] leading-relaxed">
                  Every case is scoped to your organization through row-level security in Postgres, and each finding is hashed and timestamped the moment it's produced, so it can't be silently altered later.
                </p>
              )}
            </div>

            {/* FAQ 2 */}
            <div className="border-b border-[#3a352c] py-5">
              <button
                onClick={() => toggleFaq(1)}
                className="w-full text-left font-semibold text-[15px] text-[#ede6d8] flex justify-between items-center gap-4 bg-transparent border-none cursor-pointer p-0"
              >
                <span>Which authentication standards does TraceXMail check?</span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[#b9af9c] text-[18px]">
                  {activeFaq === 1 ? '−' : '+'}
                </span>
              </button>
              {activeFaq === 1 && (
                <p className="text-[#b9af9c] text-[14px] mt-3 m-0 max-w-[64ch] leading-relaxed">
                  SPF, DKIM, DMARC, and ARC, verified live against DNS rather than assumed from the headers alone.
                </p>
              )}
            </div>

            {/* FAQ 3 */}
            <div className="border-b border-[#3a352c] py-5">
              <button
                onClick={() => toggleFaq(2)}
                className="w-full text-left font-semibold text-[15px] text-[#ede6d8] flex justify-between items-center gap-4 bg-transparent border-none cursor-pointer p-0"
              >
                <span>What file formats can I upload?</span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[#b9af9c] text-[18px]">
                  {activeFaq === 2 ? '−' : '+'}
                </span>
              </button>
              {activeFaq === 2 && (
                <p className="text-[#b9af9c] text-[14px] mt-3 m-0 max-w-[64ch] leading-relaxed">
                  Standard RFC 822 email files: .eml, .msg, and .txt, either pasted as raw headers or uploaded directly.
                </p>
              )}
            </div>

            {/* FAQ 4 */}
            <div className="border-b border-[#3a352c] py-5">
              <button
                onClick={() => toggleFaq(3)}
                className="w-full text-left font-semibold text-[15px] text-[#ede6d8] flex justify-between items-center gap-4 bg-transparent border-none cursor-pointer p-0"
              >
                <span>Do I need a security background to use this?</span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[#b9af9c] text-[18px]">
                  {activeFaq === 3 ? '−' : '+'}
                </span>
              </button>
              {activeFaq === 3 && (
                <p className="text-[#b9af9c] text-[14px] mt-3 m-0 max-w-[64ch] leading-relaxed">
                  No. The interface has a simplified overview for a first read of any case, and a full analyst console one click away for anyone who wants the underlying evidence.
                </p>
              )}
            </div>

            {/* FAQ 5 */}
            <div className="border-b border-[#3a352c] py-5">
              <button
                onClick={() => toggleFaq(4)}
                className="w-full text-left font-semibold text-[15px] text-[#ede6d8] flex justify-between items-center gap-4 bg-transparent border-none cursor-pointer p-0"
              >
                <span>Who is this built for right now?</span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[#b9af9c] text-[18px]">
                  {activeFaq === 4 ? '−' : '+'}
                </span>
              </button>
              {activeFaq === 4 && (
                <p className="text-[#b9af9c] text-[14px] mt-3 m-0 max-w-[64ch] leading-relaxed">
                  We're a student team building TraceXMail for Smart India Hackathon problem statement 26106, currently piloting it with a small number of security teams.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-24">
        <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-['Fraunces',serif] text-[28px] sm:text-[36px] lg:text-[40px] font-medium text-[#ede6d8] max-w-[16ch]">
            Stop guessing where a threat came from.
          </h2>
          <p className="text-[#b9af9c] my-4 text-[16px] max-w-[48ch]">
            Request access and bring your team's next suspicious email. We'll trace it with you.
          </p>
          <div className="flex flex-wrap items-center gap-3.5 mt-8">
            <button
              onClick={onRequestAccess || onOpenConsole}
              className="bg-[#b23a2e] hover:bg-[#c94a3d] text-[#ede6d8] px-6 py-3.5 rounded-[3px] font-semibold text-[15px] border border-[#b23a2e] transition-colors cursor-pointer"
            >
              Request access
            </button>
            <button
              onClick={onRequestAccess || onOpenConsole}
              className="px-6 py-3.5 rounded-[3px] font-medium text-[15px] border border-[#3a352c] text-[#ede6d8] hover:border-[#b9af9c] hover:bg-[#1d1a15] transition-colors cursor-pointer"
            >
              Talk to us first
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#3a352c] py-9">
        <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-[13.5px] text-[#b9af9c]">
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 rounded-full border border-[#b23a2e] relative shrink-0">
              <div className="absolute inset-[3px] rounded-full bg-[#b23a2e]" />
            </div>
            <span>TraceXMail, email forensic intelligence</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="mailto:support@tracexmail.io" className="text-[#b9af9c] hover:text-[#ede6d8] transition-colors no-underline">
              Contact us
            </a>
            <div className="font-['IBM_Plex_Mono',monospace] text-[11px] border border-[#3a352c] px-2.5 py-1 rounded-[2px]">
              CASE STATUS: OPEN
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
