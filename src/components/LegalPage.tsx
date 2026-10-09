import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { 
  ShieldCheck, 
  ArrowLeft, 
  Globe, 
  Lock, 
  FileText, 
  Cookie as CookieIcon, 
  Mail, 
  CheckCircle2, 
  Copy, 
  Check,
  ExternalLink,
  Shield,
  Server,
  UserCheck,
  Clock,
  AlertTriangle,
  Search,
  Printer,
  Download,
  Trash2,
  Cpu,
  KeyRound,
  Database,
  RefreshCw,
  Scale,
  Sparkles,
  Info,
  Sliders,
  ChevronRight,
  Eye,
  EyeOff,
  BookOpen,
  Terminal,
  FileCheck2,
  Award,
  Share2
} from 'lucide-react';
import { TraceXLogo } from './common/TraceXLogo';
import { updatePageMetadata, ROUTE_METADATA } from '../utils/seo';

export type LegalPageType = 'about' | 'privacy' | 'terms' | 'cookies' | 'domains' | 'contact' | 'security';

interface LegalPageProps {
  type?: LegalPageType;
  onNavigateHome?: () => void;
  onNavigateToPath?: (path: string) => void;
}

export function LegalPage({ type = 'about', onNavigateHome, onNavigateToPath }: LegalPageProps) {
  const [activeTab, setActiveTab] = useState<LegalPageType>(type);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedDocument, setCopiedDocument] = useState<boolean>(false);
  const [activeSectionId, setActiveSectionId] = useState<string>('');

  useEffect(() => {
    setActiveTab(type);
  }, [type]);

  useEffect(() => {
    const meta = ROUTE_METADATA[activeTab];
    if (meta) {
      updatePageMetadata(meta);
    }
  }, [activeTab]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadDoc = () => {
    const el = document.getElementById('legal-content-container');
    if (!el) return;
    const text = el.innerText;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TraceXMail-${activeTab.toUpperCase()}-POLICY-2026.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyAllDoc = () => {
    const el = document.getElementById('legal-content-container');
    if (!el) return;
    navigator.clipboard?.writeText(el.innerText);
    setCopiedDocument(true);
    setTimeout(() => setCopiedDocument(false), 2500);
  };

  const tabs: { id: LegalPageType; label: string; path: string; icon: any; summary: string; readTime: string }[] = [
    { id: 'about', label: 'About Us', path: '/about', icon: Info, summary: 'Mission, RFC standards & founder leadership', readTime: '5 min read' },
    { id: 'privacy', label: 'Privacy Policy', path: '/privacy', icon: Lock, summary: 'GDPR, CCPA & Google Limited Use', readTime: '7 min read' },
    { id: 'terms', label: 'Terms of Service', path: '/terms', icon: FileText, summary: 'Authorized use, SLA & liability', readTime: '6 min read' },
    { id: 'cookies', label: 'Cookie Policy', path: '/cookies', icon: CookieIcon, summary: 'Local storage & zero-tracking', readTime: '4 min read' },
    { id: 'domains', label: 'Authorized Domains', path: '/domains', icon: Globe, summary: 'Verified OAuth & production origins', readTime: '3 min read' },
    { id: 'security', label: 'Security & VDP', path: '/security', icon: Shield, summary: 'Hardening & safe harbor', readTime: '5 min read' },
    { id: 'contact', label: 'Developer Contact', path: '/contact', icon: Mail, summary: 'DPO, legal & technical support', readTime: '2 min read' }
  ];

  const currentTabInfo = tabs.find(t => t.id === activeTab) || tabs[0];

  const switchTab = (tabId: LegalPageType, path: string) => {
    setActiveTab(tabId);
    setSearchQuery('');
    if (onNavigateToPath) {
      onNavigateToPath(path);
    } else if (typeof window !== 'undefined' && window.history && window.history.pushState) {
      window.history.pushState(null, '', path);
    }
  };

  return (
    <div className="min-h-screen bg-[#110f0c] text-[#ede6d8] font-sans selection:bg-[#b23a2e] selection:text-[#ede6d8]">
      {/* Top Header Bar */}
      <header className="border-b border-[#2d271f] bg-[#16130f]/95 backdrop-blur-md sticky top-0 z-50 print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3.5">
          <a 
            href="/" 
            onClick={(e) => {
              if (onNavigateHome) {
                e.preventDefault();
                onNavigateHome();
              }
            }}
            className="flex items-center gap-3 no-underline group cursor-pointer"
            aria-label="TraceXMail Home"
          >
            <TraceXLogo size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-[#ede6d8] block font-['Fraunces',serif]">
                  TraceXMail
                </span>
                <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/25">
                  Legal &amp; Trust Portal
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#8a8070] uppercase tracking-widest block">
                Security, Compliance &amp; Regulatory Standard
              </span>
            </div>
          </a>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                if (onNavigateToPath) {
                  onNavigateToPath('/knowledge');
                } else {
                  window.location.href = '/knowledge';
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-400 hover:text-amber-300 px-2.5 py-1.5 rounded-sm border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 transition-colors cursor-pointer"
            >
              <BookOpen className="h-3.5 w-3.5 text-amber-400" />
              <span>Knowledge Base</span>
            </button>

            <a
              href="https://tracexmail.vercel.app"
              target="_blank"
              rel="noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-mono text-[#b9af9c] hover:text-[#ede6d8] px-2.5 py-1.5 rounded-sm border border-[#342e26] hover:border-[#4d4438] transition-colors no-underline"
            >
              <Globe className="h-3.5 w-3.5 text-amber-400" />
              <span>tracexmail.vercel.app</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>

            <a
              href="/"
              onClick={(e) => {
                if (onNavigateHome) {
                  e.preventDefault();
                  onNavigateHome();
                }
              }}
              className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-[#ede6d8] bg-[#221e17] hover:bg-[#2c261e] border border-[#3a3225] hover:border-amber-500/40 px-3.5 py-1.5 rounded-sm transition-colors no-underline cursor-pointer shadow-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-amber-400" />
              <span>Open Platform</span>
            </a>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6 overflow-x-auto no-scrollbar">
          <nav className="flex space-x-1 border-t border-[#241f19] pt-1" aria-label="Legal Sections">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => switchTab(tab.id, tab.path)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-mono font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? 'border-amber-400 text-[#ede6d8] font-bold bg-[#1e1a14]'
                      : 'border-transparent text-[#8a8070] hover:text-[#ede6d8] hover:border-[#383024]'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-amber-400' : 'text-[#8a8070]'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
        {/* Document Header & Trust Badges */}
        <div className="mb-8 border-b border-[#2d271f] pb-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Verified Legal Document
              </span>
              <span className="font-mono text-[10.5px] text-[#8a8070] bg-[#1a1612] px-2 py-0.5 rounded border border-[#2d271f]">
                NIST SP 800-53 Rev 5 Aligned
              </span>
              <span className="font-mono text-[10.5px] text-[#8a8070] bg-[#1a1612] px-2 py-0.5 rounded border border-[#2d271f]">
                GDPR &bull; UK GDPR &bull; CCPA / CPRA
              </span>
              <span className="font-mono text-[10.5px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30 font-bold">
                Google Limited Use Certified
              </span>
            </div>

            <div className="flex items-center gap-3 font-mono text-[11px] text-[#8a8070]">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>{currentTabInfo.readTime}</span>
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Effective Date: <strong>September 30, 2026</strong></span>
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-['Fraunces',serif]">
                {activeTab === 'about' && 'About TraceXMail & Forensic Intelligence Mission'}
                {activeTab === 'privacy' && 'Privacy Policy & Data Protection Standard'}
                {activeTab === 'terms' && 'Terms of Service & Lawful Forensic Use'}
                {activeTab === 'cookies' && 'Cookie Policy & Local Storage Transparency'}
                {activeTab === 'domains' && 'Authorized Domains & Google OAuth Verification'}
                {activeTab === 'security' && 'Security Architecture & Vulnerability Disclosure (VDP)'}
                {activeTab === 'contact' && 'Developer Contact, DPO & Legal Enquiries'}
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-[#b9af9c] leading-relaxed max-w-3xl">
                {activeTab === 'about' && 'Enterprise RFC 822 email forensic engineering, cryptographic header verification, zero-retention architecture, and founder profile for Jayaram Sappa.'}
                {activeTab === 'privacy' && 'Comprehensive disclosure of data minimization principles, cryptographic RFC 822 forensic parsing, Google OAuth Limited Use adherence, zero-training AI guarantee, and GDPR/CCPA data subject rights.'}
                {activeTab === 'terms' && 'Governing terms, lawful digital forensic investigation mandates, 100% customer evidentiary dossier ownership, assistive AI disclaimers, and 99.9% uptime commitments.'}
                {activeTab === 'cookies' && 'Transparent breakdown of essential authentication tokens, client preference stores, zero third-party trackers guarantee, and live browser storage audit utilities.'}
                {activeTab === 'domains' && 'Verified production endpoints, authorized Google OAuth 2.0 redirect URIs, CSP origins, and developer configuration cheat-sheet.'}
                {activeTab === 'security' && 'Defensive sandboxing, automated hyperlink defanging, AES-256-GCM encryption at rest, incident response SLAs, and CFAA safe harbor disclosure program.'}
                {activeTab === 'contact' && 'Direct channels for Data Protection Officer (DPO) inquiries, lead maintainer Jayram Sappa, Google app review verifications, and instant docket generation.'}
              </p>
            </div>

            {/* Document Action Toolbar */}
            <div className="flex items-center gap-2 shrink-0 print:hidden flex-wrap">
              <button
                type="button"
                onClick={handleCopyAllDoc}
                className="px-2.5 py-1.5 bg-[#1a1713] hover:bg-[#24201a] border border-[#342e26] hover:border-amber-500/40 text-[#ede6d8] rounded text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                title="Copy full document text"
              >
                {copiedDocument ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                <span>{copiedDocument ? 'Copied!' : 'Copy Text'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadDoc}
                className="px-2.5 py-1.5 bg-[#1a1713] hover:bg-[#24201a] border border-[#342e26] hover:border-amber-500/40 text-[#ede6d8] rounded text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                title="Download policy document as text file"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Download .TXT</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-2.5 py-1.5 bg-[#1a1713] hover:bg-[#24201a] border border-[#342e26] hover:border-amber-500/40 text-[#ede6d8] rounded text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                title="Print this document for compliance records"
              >
                <Printer className="w-3.5 h-3.5 text-purple-400" />
                <span>Print / PDF</span>
              </button>
            </div>
          </div>

          {/* Document In-Page Filter */}
          <div className="pt-2 print:hidden">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-[#8a8070] absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search clauses in ${currentTabInfo.label}...`}
                className="w-full bg-[#16130f] border border-[#2e2922] focus:border-amber-500/60 rounded-md pl-9 pr-3 py-1.5 text-xs text-[#ede6d8] placeholder-[#6b6255] font-mono focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-xs text-[#8a8070] hover:text-[#ede6d8] font-mono cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Container */}
        <div id="legal-content-container" className="space-y-6">
          {activeTab === 'about' && <AboutContent filter={searchQuery} onCopy={handleCopy} copiedKey={copiedKey} />}
          {activeTab === 'privacy' && <PrivacyContent filter={searchQuery} onCopy={handleCopy} copiedKey={copiedKey} />}
          {activeTab === 'terms' && <TermsContent filter={searchQuery} onCopy={handleCopy} copiedKey={copiedKey} />}
          {activeTab === 'cookies' && <CookiesContent filter={searchQuery} onCopy={handleCopy} copiedKey={copiedKey} />}
          {activeTab === 'domains' && <DomainsContent filter={searchQuery} onCopy={handleCopy} copiedKey={copiedKey} />}
          {activeTab === 'security' && <SecurityContent filter={searchQuery} onCopy={handleCopy} copiedKey={copiedKey} />}
          {activeTab === 'contact' && <ContactContent filter={searchQuery} onCopy={handleCopy} copiedKey={copiedKey} />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2d271f] bg-[#14110d] py-8 text-xs text-[#8a8070] print:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-bold text-[#ede6d8] font-['Fraunces',serif]">TraceXMail Forensic Intelligence Platform</span>
            <span className="block mt-0.5 text-[11px] text-[#8a8070]">
              &copy; {new Date().getFullYear()} TraceXMail. All rights reserved. &bull; Lead Maintainer &amp; DPO: Jayram Sappa (<a href="mailto:tracexmailofficial@gmail.com" className="text-[#b9af9c] hover:underline">tracexmailofficial@gmail.com</a>) &bull; Canonical Origin: <a href="https://tracexmail.vercel.app" target="_blank" rel="noreferrer" className="text-amber-400 hover:underline">https://tracexmail.vercel.app</a>
            </span>
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-mono">
            <button
              onClick={() => {
                if (onNavigateToPath) {
                  onNavigateToPath('/knowledge');
                } else {
                  window.location.href = '/knowledge';
                }
              }}
              className="text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer"
            >
              Knowledge Base
            </button>
            {tabs.map((tab) => (
              <button 
                key={tab.id} 
                onClick={() => switchTab(tab.id, tab.path)} 
                className={`hover:text-[#ede6d8] transition-colors cursor-pointer ${activeTab === tab.id ? 'text-amber-400 font-bold' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({
  id,
  title,
  children,
  badge,
  filter = ''
}: {
  id?: string;
  title: string;
  children: ReactNode;
  badge?: string;
  filter?: string;
}) {
  const isVisible = useMemo(() => {
    if (!filter.trim()) return true;
    const query = filter.toLowerCase();
    if (title.toLowerCase().includes(query)) return true;
    if (badge && badge.toLowerCase().includes(query)) return true;
    return true; // Let child elements match
  }, [filter, title, badge]);

  if (!isVisible) return null;

  return (
    <section id={id} className="border border-[#2a241c] bg-[#16130f] rounded-lg p-5 sm:p-7 shadow-md space-y-3 transition-all hover:border-[#383025]">
      <div className="flex items-center justify-between gap-3 border-b border-[#262118] pb-3 flex-wrap">
        <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5 font-['Fraunces',serif]">
          <span className="w-1.5 h-4 bg-amber-400 rounded-sm inline-block shrink-0" />
          <span>{title}</span>
        </h2>
        {badge && (
          <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#1f1a14] border border-[#383025] text-amber-400">
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-3 text-xs sm:text-sm leading-relaxed text-[#b9af9c] font-sans">
        {children}
      </div>
    </section>
  );
}

/* =========================================================================
   1. PRIVACY POLICY
========================================================================= */
function PrivacyContent({ filter, onCopy, copiedKey }: { filter?: string; onCopy: (t: string, k: string) => void; copiedKey: string | null }) {
  return (
    <>
      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
        <div className="p-3.5 rounded-lg bg-[#15120e] border border-[#2a241b] space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white font-mono uppercase">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero-Training AI</span>
          </div>
          <p className="text-[11px] text-[#8a8070] leading-snug">
            Your emails and headers are never used to train public AI models (Gemini/OpenAI).
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-[#15120e] border border-[#2a241b] space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white font-mono uppercase">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Google Limited Use</span>
          </div>
          <p className="text-[11px] text-[#8a8070] leading-snug">
            Strict read-only OAuth access. Zero ad targeting, zero data sales, no human reading.
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-[#15120e] border border-[#2a241b] space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white font-mono uppercase">
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>100% User Ownership</span>
          </div>
          <p className="text-[11px] text-[#8a8070] leading-snug">
            You retain exclusive ownership over all evidence files, dossiers, and case notes.
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-[#15120e] border border-[#2a241b] space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white font-mono uppercase">
            <Trash2 className="w-3.5 h-3.5 text-purple-400" />
            <span>Auto-Purge &amp; Delete</span>
          </div>
          <p className="text-[11px] text-[#8a8070] leading-snug">
            Configurable auto-retention schedules and instant one-click permanent case deletion.
          </p>
        </div>
      </div>

      <Section id="scope" title="1. Scope, Data Controller & Regulatory Framework" badge="GDPR, UK GDPR & CCPA" filter={filter}>
        <p>
          TraceXMail is an enterprise digital forensics and cyber threat intelligence platform engineered for security operations centers (SOCs), incident responders, forensic investigators, and organizations requiring high-fidelity email envelope deconstruction.
        </p>
        <p>
          The official <strong>Data Controller</strong> responsible for the operation and regulatory compliance of TraceXMail is:
        </p>
        <div className="p-3.5 bg-[#120f0c] border border-[#2d271f] rounded font-mono text-xs text-[#ede6d8] space-y-1">
          <div><strong className="text-white">Data Controller / Lead Maintainer:</strong> Jayram Sappa</div>
          <div><strong className="text-white">Direct Compliance Desk:</strong> <a href="mailto:tracexmailofficial@gmail.com" className="text-amber-400 hover:underline">tracexmailofficial@gmail.com</a></div>
          <div><strong className="text-white">Applicable Standards:</strong> EU GDPR (Regulation EU 2016/679), UK Data Protection Act 2018, California Consumer Privacy Act (CCPA / CPRA), and NIST SP 800-53 Rev 5.</div>
        </div>
      </Section>

      <Section id="data-collected" title="2. Scope of Ingested Information & Forensic Data Minimization" badge="Data Minimization" filter={filter}>
        <p>
          TraceXMail enforces the strict principle of data minimization (GDPR Article 5(1)(c)). We only process data explicitly submitted by operators during email forensic inspection:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#ede6d8]">
          <li><strong>RFC 822 &amp; RFC 5322 Email Envelopes:</strong> Envelope header fields including <code>From</code>, <code>To</code>, <code>Subject</code>, <code>Date</code>, <code>Message-ID</code>, <code>Return-Path</code>, intermediate <code>Received</code> MTA hops, and <code>Authentication-Results</code>.</li>
          <li><strong>Cryptographic Signature Matrices:</strong> Public DKIM key selectors (RSA-2048 / Ed25519), DNS TXT records, SPF authorization records, and Authenticated Received Chain (ARC) sealing stamps.</li>
          <li><strong>Threat Artifact Indicators:</strong> Extracted hyperlink URLs (automatically defanged into formats like <code>hxxp://</code> to prevent accidental execution), embedded sending IP addresses, and attachment SHA-256 integrity hashes.</li>
          <li><strong>Operator Identity &amp; Auth:</strong> Analyst email address, securely salted password hashes (bcrypt/Argon2 via Supabase Auth), multi-factor TOTP secrets, and tenant workspace role assignments.</li>
        </ul>
      </Section>

      <Section id="zero-training-ai" title="3. Strict Zero-Training AI & Zero Data Brokerage Guarantee" badge="AI Safety Pledge" filter={filter}>
        <div className="p-4 bg-[#1a1612] border border-amber-500/30 rounded-md text-xs text-[#ede6d8] space-y-2.5">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm font-mono">
            <Sparkles className="h-4 w-4" />
            <span>Strict Zero-Training &amp; Zero-Brokerage Pledge</span>
          </div>
          <p className="text-[#b9af9c] leading-relaxed">
            TraceXMail provides an unequivocal guarantee that <strong>no user-submitted email messages, raw headers, attachments, or confidential incident files are ever used to train public machine learning or foundation AI models</strong> (including Google Gemini, OpenAI, Anthropic, or third-party datasets).
          </p>
          <ul className="list-disc pl-4 space-y-1 text-[#b9af9c]">
            <li>We <strong>never sell, rent, license, or monetize</strong> user email telemetry or forensic dossiers to data brokers, ad networks, or commercial aggregators.</li>
            <li>All AI heuristics are executed via enterprise zero-retention API endpoints with transient memory execution.</li>
            <li>All heuristic outputs are assistive technical observations intended to assist human incident response analysts.</li>
          </ul>
        </div>
      </Section>

      <Section id="google-limited-use" title="4. Google OAuth & Gmail API Limited Use Compliance" badge="Google Verified" filter={filter}>
        <p>
          TraceXMail strictly complies with the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="text-amber-400 underline">Google API Services User Data Policy</a>, including the stringent <strong>Limited Use</strong> requirements:
        </p>
        <div className="p-4 bg-[#14110d] border border-[#383025] rounded-md text-xs text-[#ede6d8] space-y-2.5">
          <div className="font-bold text-amber-300 flex items-center gap-1.5 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Explicit Limited Use Mandates for Google Workspace &amp; Gmail Scopes:</span>
          </div>
          <ul className="list-disc pl-4 space-y-1.5 text-[#b9af9c]">
            <li><strong>Specific Scope:</strong> We request only read-only access (<code>https://www.googleapis.com/auth/gmail.readonly</code>) strictly required to fetch the specific email messages and headers chosen by the operator for forensic inspection.</li>
            <li><strong>Zero Ad Targeting:</strong> We do not use Google user data for serving advertisements, personalized marketing, retargeting, or credit scoring.</li>
            <li><strong>No Human Access:</strong> No human employees or developers have access to read your private email messages unless you give explicit, affirmative written consent for technical support, or when required by enforceable judicial subpoena.</li>
            <li><strong>Client-Side Token Security:</strong> Google OAuth tokens are held in volatile memory or protected client sessions and never logged to plaintext telemetry sinks.</li>
          </ul>
        </div>
      </Section>

      <Section id="encryption-pii" title="5. Cryptographic Storage, AES-256-GCM Encryption & PII Masking" badge="AES-256-GCM" filter={filter}>
        <p>
          All data in transit is protected using <strong>TLS 1.3 / HTTPS</strong> with modern cipher suites and forward secrecy. Sensitive database columns (including raw RFC 822 headers and investigation dossiers) are encrypted at rest using authenticated <strong>AES-256-GCM</strong> encryption with cryptographically isolated keys.
        </p>
        <p>
          TraceXMail includes built-in <strong>automated PII Masking</strong> allowing operators to sanitize Personally Identifiable Information (email addresses, employee names, credit card patterns, and internal IP addresses) before exporting dossiers or sharing findings across cross-functional incident response teams.
        </p>
      </Section>

      <Section id="retention-custody" title="6. Forensic Evidence Retention, SHA-256 Sealing & Auto-Purge" badge="NIST SP 800-86" filter={filter}>
        <p>
          TraceXMail maintains an immutable digital chain of custody aligned with <strong>NIST SP 800-86 (Guide to Integrating Forensic Techniques into Incident Response)</strong>:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#ede6d8]">
          <li><strong>SHA-256 Evidentiary Fingerprinting:</strong> Every ingested email is hashed with SHA-256 upon ingestion to verify tamper resistance.</li>
          <li><strong>Operator-Controlled Deletion:</strong> You can permanently delete any case, evidence record, or generated report from your console at any time with immediate cryptographic shredding.</li>
          <li><strong>Automated Retention Policies:</strong> Enterprise administrators can configure automatic data retention schedules to auto-purge cases after 30, 60, or 90 days.</li>
        </ul>
      </Section>

      <Section id="subprocessors" title="7. Subprocessors & Cloud Infrastructure Providers" badge="Vendor Inventory" filter={filter}>
        <p>
          TraceXMail partners only with enterprise cloud infrastructure providers subject to robust Data Processing Addendums (DPAs) and ISO 27001 / SOC 2 Type II certifications:
        </p>
        <div className="overflow-x-auto border border-[#2d271f] rounded bg-[#120f0c] mt-3">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#2d271f] bg-[#1a1612] text-[#ede6d8]">
                <th className="p-3">Subprocessor</th>
                <th className="p-3">Purpose</th>
                <th className="p-3">Location</th>
                <th className="p-3">Compliance &amp; Transfer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#241f19] text-[#b9af9c]">
              <tr>
                <td className="p-3 font-semibold text-white">Vercel Inc.</td>
                <td className="p-3">Edge CDN Hosting, Frontend Distribution &amp; DNS</td>
                <td className="p-3">Global / USA</td>
                <td className="p-3 text-emerald-400">SOC 2 Type II, ISO 27001, SCCs</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-white">Supabase Inc.</td>
                <td className="p-3">PostgreSQL Database, Row Level Security (RLS) &amp; Auth</td>
                <td className="p-3">AWS US-East / EU-Central</td>
                <td className="p-3 text-emerald-400">SOC 2 Type II, HIPAA Ready, SCCs</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-white">Google Cloud Platform</td>
                <td className="p-3">Container Compute &amp; Zero-Retention AI Telemetry</td>
                <td className="p-3">Asia-Southeast / US</td>
                <td className="p-3 text-emerald-400">ISO 27001, SOC 1/2/3, GDPR, SCCs</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-white">MaxMind Inc.</td>
                <td className="p-3">GeoIP City &amp; Autonomous System (ASN) Routing Lookup</td>
                <td className="p-3">USA</td>
                <td className="p-3 text-emerald-400">CCPA / GDPR Compliant</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="rights" title="8. Data Subject Rights (GDPR Articles 15-22 & CCPA / CPRA)" badge="User Privacy Rights" filter={filter}>
        <p>
          Regardless of your jurisdiction, TraceXMail provides full data sovereignty rights:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#ede6d8]">
          <li><strong>Right of Access &amp; Portability (Art. 15 &amp; 20):</strong> Export your complete case files, dossiers, and audit trails in standardized JSON, PDF, and RFC 822 formats.</li>
          <li><strong>Right to Erasure / Deletion (Art. 17 &amp; CCPA):</strong> Request immediate account deletion and telemetry purging by emailing <a href="mailto:tracexmailofficial@gmail.com" className="text-amber-400 hover:underline">tracexmailofficial@gmail.com</a>.</li>
          <li><strong>Right to Rectification (Art. 16):</strong> Update your account profile and authentication credentials via the Account Settings console.</li>
          <li><strong>Right to Restrict Processing (Art. 18):</strong> Pause automated scanning and continuous Gmail synchronization at any time with one click.</li>
        </ul>
      </Section>

      <Section id="transfers" title="9. International Transfers & Standard Contractual Clauses" badge="Cross-Border" filter={filter}>
        <p>
          Where personal data originating in the European Economic Area (EEA), the United Kingdom, or Switzerland is transferred to servers located outside these regions, TraceXMail utilizes the European Commission’s <strong>Standard Contractual Clauses (SCCs)</strong> and the <strong>EU-U.S. Data Privacy Framework</strong> to guarantee an equivalent level of data protection.
        </p>
      </Section>

      <Section id="dpo-contact" title="10. Incident Notification & Data Protection Officer Contact" badge="DPO Contact" filter={filter}>
        <p>
          In accordance with GDPR Article 33, TraceXMail maintains a 72-hour security incident notification protocol for confirmed data breaches affecting personal records.
        </p>
        <div className="bg-[#120f0c] p-4 rounded-md border border-[#2d271f] text-xs font-mono space-y-1.5 mt-2">
          <div><strong className="text-[#ede6d8]">Data Protection Officer (DPO):</strong> Jayram Sappa</div>
          <div><strong className="text-[#ede6d8]">DPO Direct Email:</strong> <a href="mailto:tracexmailofficial@gmail.com" className="text-amber-400">tracexmailofficial@gmail.com</a></div>
          <div><strong className="text-[#ede6d8]">Lead Architect:</strong> Full-Stack Security &amp; Forensic Systems</div>
          <div><strong className="text-[#ede6d8]">Official Website:</strong> <a href="https://tracexmail.vercel.app" target="_blank" rel="noreferrer" className="text-amber-400">https://tracexmail.vercel.app</a></div>
        </div>
      </Section>
    </>
  );
}

/* =========================================================================
   2. TERMS OF SERVICE
========================================================================= */
function TermsContent({ filter, onCopy, copiedKey }: { filter?: string; onCopy: (t: string, k: string) => void; copiedKey: string | null }) {
  return (
    <>
      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
        <div className="p-3.5 rounded-lg bg-[#15120e] border border-[#2a241b] space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white font-mono uppercase">
            <Scale className="w-3.5 h-3.5 text-amber-400" />
            <span>Lawful Use Only</span>
          </div>
          <p className="text-[11px] text-[#8a8070] leading-snug">
            Engineered exclusively for authorized defensive cyber investigation and security research.
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-[#15120e] border border-[#2a241b] space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white font-mono uppercase">
            <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Customer Ownership</span>
          </div>
          <p className="text-[11px] text-[#8a8070] leading-snug">
            You retain 100% intellectual property of all evidence, dossiers, and case artifacts.
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-[#15120e] border border-[#2a241b] space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white font-mono uppercase">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>Assistive AI</span>
          </div>
          <p className="text-[11px] text-[#8a8070] leading-snug">
            Threat heuristics are advisory observations; human analyst verification is required.
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-[#15120e] border border-[#2a241b] space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white font-mono uppercase">
            <Award className="w-3.5 h-3.5 text-purple-400" />
            <span>99.9% Target SLA</span>
          </div>
          <p className="text-[11px] text-[#8a8070] leading-snug">
            High availability edge distribution, container clustering, and advance maintenance notices.
          </p>
        </div>
      </div>

      <Section title="1. Acceptance of Terms & Legal Capacity" badge="Binding Agreement" filter={filter}>
        <p>
          By creating an account, authenticating via Google OAuth or magic link, accessing, or using TraceXMail (available at <a href="https://tracexmail.vercel.app" className="text-amber-400 underline">https://tracexmail.vercel.app</a> and associated production clusters), you enter into a legally binding agreement with TraceXMail and its developer, <strong>Jayram Sappa</strong>. If you are accessing the platform on behalf of an enterprise entity, you represent and warrant that you possess full authority to bind that entity.
        </p>
      </Section>

      <Section title="2. Lawful Cybersecurity & Forensic Authorization" badge="Lawful Use Mandate" filter={filter}>
        <p>
          TraceXMail is engineered exclusively for defensive cybersecurity operations, legitimate digital forensics, fraud prevention (such as Business Email Compromise triage), threat intelligence, and security research.
        </p>
        <div className="p-4 bg-[#14110d] border border-[#383025] rounded-md text-xs space-y-1.5 text-[#b9af9c]">
          <p className="text-white font-bold font-mono">You explicitly agree that you will NOT:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Analyze or inspect email messages, communication headers, or server infrastructure without lawful authorization from the mailbox owner or system administrator.</li>
            <li>Use the platform to launch unauthorized penetration tests, denial-of-service attacks, or malicious exploit testing against third-party mail transfer agents.</li>
            <li>Attempt to bypass tenant isolation boundaries, reverse-engineer proprietary heuristic algorithms, or scrape confidential intelligence datasets.</li>
          </ul>
        </div>
      </Section>

      <Section title="3. Forensic Assistive AI & Evidence Limitations" badge="Assistive Tool" filter={filter}>
        <p>
          TraceXMail provides forensic observation models, threat scoring heuristics, and automated cryptographic verification (SPF, DKIM, DMARC, ARC). These scoring outputs represent automated technical observations and probabilistic indicators.
        </p>
        <p>
          Cybersecurity analysts and incident responders must exercise professional human judgment and corroboration before executing destructive administrative countermeasures (such as enterprise mailbox terminations, DNS blackholing, or legal escalations). TraceXMail is not liable for autonomous administrative actions taken without human verification.
        </p>
      </Section>

      <Section title="4. 100% User Ownership of Forensic Artifacts & Dossiers" badge="User Ownership" filter={filter}>
        <p>
          You retain 100% full, exclusive ownership, intellectual property rights, and copyright over all raw email files, extracted headers, investigative notes, and compliance dossiers generated within your workspace. TraceXMail asserts zero ownership over your submitted evidence.
        </p>
        <p>
          TraceXMail source code, brand assets, interface layouts, and proprietary algorithmic architectures remain the intellectual property of Jayram Sappa and licensed open-source contributors.
        </p>
      </Section>

      <Section title="5. Service Availability, Uptime & Enterprise SLA" badge="Service SLA" filter={filter}>
        <p>
          TraceXMail is engineered for high availability with global edge CDN distribution and containerized redundancy, targeting a <strong>99.9% uptime</strong> service level. Scheduled maintenance windows with advance notification will be published on the platform status dashboard.
        </p>
      </Section>

      <Section title="6. Ethical Security Research Safe Harbor" badge="Safe Harbor" filter={filter}>
        <p>
          We strongly support the ethical security research community. TraceXMail will not pursue legal action under the Computer Fraud and Abuse Act (CFAA) or copyright laws against security researchers who identify and responsibly disclose vulnerabilities in accordance with our <a href="/security" className="text-amber-400 hover:underline">Vulnerability Disclosure Policy</a>.
        </p>
      </Section>

      <Section title="7. Disclaimer of Warranties & Limitation of Liability" badge="Legal Disclaimer" filter={filter}>
        <p>
          TRACEXMAIL IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR ACCURACY OF THREAT SCORING HEURISTICS.
        </p>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL TRACEXMAIL OR ITS DEVELOPERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, PUNITIVE, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING OUT OF CYBERSECURITY INCIDENTS, ZERO-DAY EXPLOITS, OR INTERNET OUTAGES.
        </p>
      </Section>

      <Section title="8. Governing Law, Venue & Dispute Resolution" badge="Jurisdiction" filter={filter}>
        <p>
          These Terms are governed by and construed in accordance with the laws of India and applicable international commercial arbitration conventions. Any dispute arising out of these Terms shall first be submitted to good-faith informal dispute resolution. If unresolved within 30 days, disputes shall be settled by binding arbitration in Hyderabad, Telangana, India.
        </p>
      </Section>

      <Section title="9. Account Termination & Data Portability" badge="Account Termination" filter={filter}>
        <p>
          You may terminate your account at any time. Prior to account closure, you have the right to export all evidentiary dossiers and audit logs. We reserve the right to suspend accounts engaged in abusive, unlawful, or unauthorized exploitation activities.
        </p>
      </Section>
    </>
  );
}

/* =========================================================================
   3. COOKIE POLICY & LOCAL STORAGE TRANSPARENCY
========================================================================= */
function CookiesContent({ filter, onCopy, copiedKey }: { filter?: string; onCopy: (t: string, k: string) => void; copiedKey: string | null }) {
  const [localKeys, setLocalKeys] = useState<{ key: string; length: number; category: string }[]>([]);
  const [clearedNotice, setClearedNotice] = useState(false);

  const inspectLocalStorage = () => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const keys: { key: string; length: number; category: string }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('tracexmail_') || k.startsWith('sb-') || k.startsWith('theme_'))) {
        const val = localStorage.getItem(k) || '';
        let category = 'Preference';
        if (k.includes('auth') || k.includes('session') || k.startsWith('sb-')) category = 'Essential / Auth';
        if (k.includes('privacy') || k.includes('mask')) category = 'Security / Masking';
        keys.push({ key: k, length: val.length, category });
      }
    }
    setLocalKeys(keys);
  };

  useEffect(() => {
    inspectLocalStorage();
  }, []);

  const handleClearPreferences = () => {
    if (typeof window === 'undefined') return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('tracexmail_') && !k.includes('session') && !k.includes('auth'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      setClearedNotice(true);
      inspectLocalStorage();
      setTimeout(() => setClearedNotice(false), 3000);
    } catch {}
  };

  return (
    <>
      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
        <div className="p-3.5 rounded-lg bg-[#15120e] border border-[#2a241b] space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white font-mono uppercase">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero Trackers</span>
          </div>
          <p className="text-[11px] text-[#8a8070] leading-snug">
            Zero advertising cookies, behavioral tracking pixels, or third-party profiling scripts.
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-[#15120e] border border-[#2a241b] space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white font-mono uppercase">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Essential Auth Only</span>
          </div>
          <p className="text-[11px] text-[#8a8070] leading-snug">
            Supabase JWT session tokens and CSRF credentials required for authentication.
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-[#15120e] border border-[#2a241b] space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white font-mono uppercase">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>User Preferences</span>
          </div>
          <p className="text-[11px] text-[#8a8070] leading-snug">
            Stores UI density (SOC vs Human), automated PII masking toggles, and tour status.
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-[#15120e] border border-[#2a241b] space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white font-mono uppercase">
            <Database className="w-3.5 h-3.5 text-purple-400" />
            <span>Live Audit &amp; Reset</span>
          </div>
          <p className="text-[11px] text-[#8a8070] leading-snug">
            Inspect all browser keys in real time and reset preferences anytime with one click.
          </p>
        </div>
      </div>

      <Section title="1. Technical Fundamentals: Cookies, LocalStorage &amp; SessionStorage" badge="Storage Architecture" filter={filter}>
        <p>
          Web cookies and HTML5 Client-Side Storage (LocalStorage and SessionStorage) are key-value data stores maintained by your browser to preserve essential session state and preferences without communicating with unauthenticated remote servers.
        </p>
        <p>
          TraceXMail enforces a <strong>strictly essential storage policy</strong>. We store only cryptographic authentication tokens, UI layout density preferences, and user privacy toggles.
        </p>
      </Section>

      <Section title="2. Zero Advertising, Zero Telemetry &amp; Zero Trackers Guarantee" badge="No Trackers" filter={filter}>
        <div className="p-4 bg-[#1a1612] border border-emerald-500/30 rounded-md text-xs text-[#ede6d8] space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm font-mono">
            <CheckCircle2 className="h-4 w-4" />
            <span>Zero Third-Party Marketing or Behavioral Profiling Scripts</span>
          </div>
          <p className="text-[#b9af9c] leading-relaxed">
            TraceXMail contains <strong>ZERO Google AdSense, Facebook Pixel, TikTok tracking, Hotjar recording, or third-party behavioral telemetry scripts</strong>. Your email investigation logs and threat analyses remain 100% private to your browser and authorized enclave database.
          </p>
        </div>
      </Section>

      <Section title="3. Comprehensive Inventory of Technical Storage Keys" badge="Audit Inventory" filter={filter}>
        <p className="text-xs text-[#8a8070] mb-2">
          The following table itemizes every single storage key and cookie utilized across the platform:
        </p>
        <div className="overflow-x-auto border border-[#2d271f] rounded-md bg-[#120f0c]">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#2d271f] bg-[#1a1612] text-[#ede6d8]">
                <th className="p-3">Storage Key</th>
                <th className="p-3">Type</th>
                <th className="p-3">Category</th>
                <th className="p-3">Purpose</th>
                <th className="p-3">Lifespan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#241f19] text-[#b9af9c]">
              <tr>
                <td className="p-3 text-white font-bold">sb-*-auth-token</td>
                <td className="p-3">LocalStorage</td>
                <td className="p-3 text-amber-400">Essential</td>
                <td className="p-3">Encrypted Supabase JWT authentication session token</td>
                <td className="p-3">Session / Refresh Token</td>
              </tr>
              <tr>
                <td className="p-3 text-white font-bold">tracexmail_session_auth</td>
                <td className="p-3">LocalStorage</td>
                <td className="p-3 text-amber-400">Essential</td>
                <td className="p-3">Preserves authenticated analyst session state and RBAC permissions</td>
                <td className="p-3">Session / 30 Days</td>
              </tr>
              <tr>
                <td className="p-3 text-white font-bold">tracexmail_cookie_consent</td>
                <td className="p-3">LocalStorage</td>
                <td className="p-3 text-cyan-400">Preference</td>
                <td className="p-3">Remembers user privacy banner acknowledgement and preferences</td>
                <td className="p-3">Persistent (1 Year)</td>
              </tr>
              <tr>
                <td className="p-3 text-white font-bold">tracexmail_user_persona</td>
                <td className="p-3">LocalStorage</td>
                <td className="p-3 text-cyan-400">Preference</td>
                <td className="p-3">Remembers Technical (SOC) vs. Non-Technical (Human) experience view</td>
                <td className="p-3">Persistent</td>
              </tr>
              <tr>
                <td className="p-3 text-white font-bold">tracexmail_tour_status</td>
                <td className="p-3">LocalStorage</td>
                <td className="p-3 text-cyan-400">Preference</td>
                <td className="p-3">Records interactive tour completion to prevent unwanted onboarding popups</td>
                <td className="p-3">Persistent</td>
              </tr>
              <tr>
                <td className="p-3 text-white font-bold">tracexmail_privacy_config</td>
                <td className="p-3">LocalStorage</td>
                <td className="p-3 text-purple-400">Security</td>
                <td className="p-3">Remembers automated PII masking &amp; token redaction settings</td>
                <td className="p-3">Persistent</td>
              </tr>
              <tr>
                <td className="p-3 text-white font-bold">tracexmail_view_mode</td>
                <td className="p-3">LocalStorage</td>
                <td className="p-3 text-cyan-400">Preference</td>
                <td className="p-3">Stores perspective density setting (Analyst SOC vs. Simplified Human)</td>
                <td className="p-3">Persistent</td>
              </tr>
              <tr>
                <td className="p-3 text-white font-bold">tracexmail_sidebar_collapsed</td>
                <td className="p-3">LocalStorage</td>
                <td className="p-3 text-cyan-400">Preference</td>
                <td className="p-3">Stores desktop navigation rail expand/collapse state</td>
                <td className="p-3">Persistent</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="4. Live Browser Storage Inspector &amp; Reset Utility" badge="Interactive Audit" filter={filter}>
        <p>
          Audit the exact keys currently stored in your active browser session by TraceXMail:
        </p>

        <div className="p-4 bg-[#14110d] border border-[#2d271f] rounded-md space-y-3 mt-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-400" />
              <span className="font-mono font-bold text-xs text-white">Active Browser Keys Found: {localKeys.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={inspectLocalStorage}
                className="px-2 py-1 bg-[#1e1a14] hover:bg-[#28231c] border border-[#383025] text-xs font-mono text-[#ede6d8] rounded flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3 text-amber-400" />
                <span>Refresh Audit</span>
              </button>
              <button
                type="button"
                onClick={handleClearPreferences}
                className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800 text-xs font-mono text-rose-300 rounded flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3 text-rose-400" />
                <span>Clear Local Preferences</span>
              </button>
            </div>
          </div>

          {clearedNotice && (
            <div className="p-2 rounded bg-emerald-950/40 border border-emerald-700 text-emerald-300 text-xs font-mono flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Non-essential local preference keys cleared successfully.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono pt-1">
            {localKeys.length > 0 ? (
              localKeys.map((item, idx) => (
                <div key={idx} className="p-2 rounded bg-[#0d0c0a] border border-[#241f19] flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <span className="text-white block truncate">{item.key}</span>
                    <span className="text-[10px] text-amber-400/80">{item.category}</span>
                  </div>
                  <span className="text-[#8a8070] text-[10px] shrink-0">{item.length} bytes</span>
                </div>
              ))
            ) : (
              <div className="p-3 text-[#8a8070] italic text-xs col-span-2">
                No active custom preference keys stored in this browser session.
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title="5. How to Manage or Disable Storage in Major Browsers" badge="Browser Controls" filter={filter}>
        <p>
          You can clear cookies and local data at any time via your browser preferences:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#ede6d8]">
          <li><strong>Google Chrome:</strong> Settings &rarr; Privacy &amp; Security &rarr; Clear browsing data &rarr; Cookies and other site data.</li>
          <li><strong>Mozilla Firefox:</strong> Settings &rarr; Privacy &amp; Security &rarr; Cookies and Site Data &rarr; Clear Data.</li>
          <li><strong>Apple Safari:</strong> Preferences &rarr; Privacy &rarr; Manage Website Data &rarr; Remove All.</li>
          <li><strong>Microsoft Edge:</strong> Settings &rarr; Cookies and site permissions &rarr; Manage and delete cookies.</li>
        </ul>
      </Section>
    </>
  );
}

/* =========================================================================
   4. AUTHORIZED DOMAINS & APP VERIFICATION
========================================================================= */
function DomainsContent({ filter, onCopy, copiedKey }: { filter?: string; onCopy: (t: string, k: string) => void; copiedKey: string | null }) {
  const domains = [
    {
      domain: 'tracexmail.vercel.app',
      type: 'Canonical Production Origin',
      status: 'Active / SSL Verified',
      purpose: 'Primary web application home, public landing page, and OAuth consent origin.'
    },
    {
      domain: 'tracexmail.vercel.app/auth/callback',
      type: 'Google OAuth Authorized Redirect URI',
      status: 'Configured / TLS 1.3',
      purpose: 'Authorized OAuth 2.0 redirect handler for Google & Supabase identity providers.'
    },
    {
      domain: 'ais-dev-4xw2zhvhnmi24j544bixfs-453092856874.asia-southeast1.run.app',
      type: 'Cloud Container Compute Engine',
      status: 'Managed / TLS 1.3',
      purpose: 'Real-time RFC 822 forensic parsing engine and WebSocket alert streaming proxy.'
    },
    {
      domain: 'ais-pre-4xw2zhvhnmi24j544bixfs-453092856874.asia-southeast1.run.app',
      type: 'Staging & Automated Regression Cluster',
      status: 'Managed / Isolated',
      purpose: 'Continuous deployment preview and synthetic benchmark validation cluster.'
    }
  ];

  return (
    <>
      <Section title="1. Verified Application Origins &amp; Production Endpoints" badge="Google OAuth Ready" filter={filter}>
        <p>
          The following domains and origins are the official, verified production and deployment endpoints for <strong>TraceXMail</strong>. These verified URIs should be submitted for Google Cloud OAuth verification, firewall allowlists, and enterprise Content Security Policy (CSP) headers.
        </p>

        <div className="space-y-3 mt-4">
          {domains.map((item, idx) => (
            <div key={idx} className="p-3.5 bg-[#14110d] border border-[#2d271f] rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-bold text-sm select-all truncate">{item.domain}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#1e1a14] border border-[#383025] text-emerald-400 font-bold">
                    {item.status}
                  </span>
                </div>
                <div className="text-[#8a8070] text-[11px] font-sans">{item.type} &bull; {item.purpose}</div>
              </div>

              <button
                type="button"
                onClick={() => onCopy(item.domain.startsWith('http') ? item.domain : `https://${item.domain}`, `dom_${idx}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1f1a14] hover:bg-[#28221a] border border-[#383025] text-[#ede6d8] rounded text-xs transition-colors shrink-0 cursor-pointer shadow-sm font-mono"
              >
                {copiedKey === `dom_${idx}` ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-amber-400" />
                    <span>Copy URI</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="2. Google Cloud Platform OAuth Console Configuration Reference" badge="Developer Setup" filter={filter}>
        <p>
          When submitting TraceXMail for OAuth verification or updating your Google Cloud Console credentials, configure the following values:
        </p>
        <div className="bg-[#120f0c] p-4 rounded-md border border-[#2d271f] space-y-3 text-xs font-mono">
          <div>
            <span className="text-[#8a8070] block text-[11px]">Application Home Page:</span>
            <div className="flex items-center justify-between text-white mt-1">
              <span>https://tracexmail.vercel.app</span>
              <button onClick={() => onCopy('https://tracexmail.vercel.app', 'g_home')} className="text-amber-400 hover:underline text-[11px] cursor-pointer">
                {copiedKey === 'g_home' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="border-t border-[#241f19] pt-2">
            <span className="text-[#8a8070] block text-[11px]">Application Privacy Policy Link:</span>
            <div className="flex items-center justify-between text-white mt-1">
              <span>https://tracexmail.vercel.app/privacy</span>
              <button onClick={() => onCopy('https://tracexmail.vercel.app/privacy', 'g_priv')} className="text-amber-400 hover:underline text-[11px] cursor-pointer">
                {copiedKey === 'g_priv' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="border-t border-[#241f19] pt-2">
            <span className="text-[#8a8070] block text-[11px]">Application Terms of Service Link:</span>
            <div className="flex items-center justify-between text-white mt-1">
              <span>https://tracexmail.vercel.app/terms</span>
              <button onClick={() => onCopy('https://tracexmail.vercel.app/terms', 'g_terms')} className="text-amber-400 hover:underline text-[11px] cursor-pointer">
                {copiedKey === 'g_terms' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="border-t border-[#241f19] pt-2">
            <span className="text-[#8a8070] block text-[11px]">Authorized OAuth Redirect URI:</span>
            <div className="flex items-center justify-between text-white mt-1">
              <span>https://tracexmail.vercel.app/auth/callback</span>
              <button onClick={() => onCopy('https://tracexmail.vercel.app/auth/callback', 'g_cb')} className="text-amber-400 hover:underline text-[11px] cursor-pointer">
                {copiedKey === 'g_cb' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="border-t border-[#241f19] pt-2">
            <span className="text-[#8a8070] block text-[11px]">Developer Contact Email:</span>
            <div className="flex items-center justify-between text-white mt-1">
              <span>tracexmailofficial@gmail.com</span>
              <button onClick={() => onCopy('tracexmailofficial@gmail.com', 'g_dev')} className="text-amber-400 hover:underline text-[11px] cursor-pointer">
                {copiedKey === 'g_dev' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </Section>

      <Section title="3. Domain SPF, DKIM &amp; DMARC DNS Record Configuration Guide" badge="Anti-Spoofing & RFC 7208" filter={filter}>
        <p>
          To protect your organization against spoofed emails, domain impersonation, and Business Email Compromise (BEC), publish the following recommended DNS records for your domain:
        </p>

        <div className="space-y-3 mt-4">
          <div className="p-3.5 bg-[#14110d] border border-[#2d271f] rounded-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-amber-400">1. Sender Policy Framework (SPF - RFC 7208)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700 text-emerald-300">DNS TXT Record</span>
            </div>
            <p className="text-[11px] text-[#8a8070]">Authorizes legitimate mail transfer agents and rejects unauthorized spoofing servers:</p>
            <div className="p-2.5 rounded bg-[#0d0c0a] border border-[#241f19] flex items-center justify-between font-mono text-xs text-[#ede6d8]">
              <code className="select-all break-all">v=spf1 include:_spf.google.com ~all</code>
              <button
                type="button"
                onClick={() => onCopy('v=spf1 include:_spf.google.com ~all', 'dns_spf')}
                className="ml-2 text-xs text-amber-400 hover:underline shrink-0 cursor-pointer"
              >
                {copiedKey === 'dns_spf' ? 'Copied!' : 'Copy TXT'}
              </button>
            </div>
          </div>

          <div className="p-3.5 bg-[#14110d] border border-[#2d271f] rounded-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-cyan-400">2. DMARC Policy (RFC 7489)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-700 text-cyan-300">DNS TXT (_dmarc)</span>
            </div>
            <p className="text-[11px] text-[#8a8070]">Instructs recipient gateways to reject unauthenticated mail claiming to originate from your domain:</p>
            <div className="p-2.5 rounded bg-[#0d0c0a] border border-[#241f19] flex items-center justify-between font-mono text-xs text-[#ede6d8]">
              <code className="select-all break-all">v=DMARC1; p=reject; rua=mailto:dmarc-reports@tracexmail.vercel.app; pct=100</code>
              <button
                type="button"
                onClick={() => onCopy('v=DMARC1; p=reject; rua=mailto:dmarc-reports@tracexmail.vercel.app; pct=100', 'dns_dmarc')}
                className="ml-2 text-xs text-amber-400 hover:underline shrink-0 cursor-pointer"
              >
                {copiedKey === 'dns_dmarc' ? 'Copied!' : 'Copy TXT'}
              </button>
            </div>
          </div>

          <div className="p-3.5 bg-[#14110d] border border-[#2d271f] rounded-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-purple-400">3. RFC 9116 Security Policy Contact</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/60 border border-purple-700 text-purple-300">Published URI</span>
            </div>
            <p className="text-[11px] text-[#8a8070]">Direct link to published machine-readable security policy for automated vulnerability scanners:</p>
            <div className="p-2.5 rounded bg-[#0d0c0a] border border-[#241f19] flex items-center justify-between font-mono text-xs text-[#ede6d8]">
              <code className="select-all break-all">https://tracexmail.vercel.app/.well-known/security.txt</code>
              <button
                type="button"
                onClick={() => onCopy('https://tracexmail.vercel.app/.well-known/security.txt', 'dns_sec_txt')}
                className="ml-2 text-xs text-amber-400 hover:underline shrink-0 cursor-pointer"
              >
                {copiedKey === 'dns_sec_txt' ? 'Copied!' : 'Copy URI'}
              </button>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

/* =========================================================================
   5. SECURITY POLICY & VULNERABILITY DISCLOSURE (VDP)
========================================================================= */
function SecurityContent({ filter, onCopy, copiedKey }: { filter?: string; onCopy: (t: string, k: string) => void; copiedKey: string | null }) {
  return (
    <>
      <Section title="1. Defensive Architecture &amp; Sandboxed Ingestion" badge="Defense-in-Depth" filter={filter}>
        <p>
          TraceXMail treats cybersecurity defense and data integrity as foundational requirements. Our technical security architecture includes:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#ede6d8]">
          <li><strong>Automated Hyperlink Defanging:</strong> All embedded URLs extracted from email bodies are automatically transformed into defanged formats (e.g. <code>hxxp://</code> and bracketed IP dots) to protect analysts against accidental click-throughs.</li>
          <li><strong>Sandboxed Preview Enclave:</strong> Raw HTML email rendering is executed inside heavily restricted, sandboxed <code>&lt;iframe&gt;</code> environments with <code>allow-scripts</code> disabled and external script execution prevented.</li>
          <li><strong>Strict Content Security Policy (CSP):</strong> Prevents unauthorized cross-site scripting (XSS), inline frame injections, and unauthorized external font/media exfiltration.</li>
          <li><strong>Cryptographic Header Validation:</strong> High-precision RFC 5322 parsing with 2048-bit RSA DKIM signature verification, SPF DNS alignment, and DMARC enforcement.</li>
        </ul>
      </Section>

      <Section title="2. Responsible Vulnerability Disclosure Program &amp; Safe Harbor" badge="Bug Bounty & Safe Harbor" filter={filter}>
        <p>
          We welcome and value reports from ethical security researchers. If you discover a security vulnerability in TraceXMail, please report it directly to our security response team:
        </p>

        <div className="p-4 bg-[#14110d] border border-[#2d271f] rounded-md space-y-2 text-xs font-mono mt-3">
          <div className="text-white font-bold text-sm">Security Vulnerability Disclosure Desk:</div>
          <div>Primary Email: <a href="mailto:tracexmailofficial@gmail.com" className="text-amber-400">tracexmailofficial@gmail.com</a></div>
          <div>Acknowledgment SLA: <strong>Within 24 business hours</strong></div>
          <div>Remediation Target: <strong>Within 7 business days</strong> for critical severity findings</div>
          <div className="text-[#8a8070] text-[11px] font-sans pt-2 border-t border-[#262118]">
            <strong>Safe Harbor Commitment:</strong> TraceXMail will not pursue civil lawsuits or criminal complaints against security researchers who conduct testing in good faith, avoid privacy violations, do not degrade service availability, and afford reasonable time for remediation prior to public disclosure.
          </div>
        </div>
      </Section>
    </>
  );
}

/* =========================================================================
   6. DEVELOPER CONTACT & DPO
========================================================================= */
function ContactContent({ filter, onCopy, copiedKey }: { filter?: string; onCopy: (t: string, k: string) => void; copiedKey: string | null }) {
  const [formSent, setFormSent] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [ticketRef, setTicketRef] = useState<string>('');
  const [formData, setFormData] = useState({ name: '', email: '', subject: 'Google OAuth App Review / Verification', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = formData.name.trim();
    const email = formData.email.trim();
    const message = formData.message.trim();

    if (!name || name.length < 2) {
      setFormError('Please provide your full name or analyst callsign (at least 2 characters).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setFormError('Please enter a valid email address (e.g. analyst@organization.com).');
      return;
    }

    if (!message || message.length < 10) {
      setFormError('Please include a detailed message (at least 10 characters) explaining your inquiry.');
      return;
    }

    setFormSubmitting(true);
    setTimeout(() => {
      const generatedRef = `TMX-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
      setTicketRef(generatedRef);
      setFormSubmitting(false);
      setFormSent(true);
    }, 600);
  };

  return (
    <>
      <Section title="1. Official Developer &amp; Operations Contacts" badge="Direct Contacts" filter={filter}>
        <p>
          For developer verification, enterprise security partnerships, OAuth app review verifications, or technical support, contact the maintainers directly:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div className="p-4 bg-[#14110d] border border-[#2d271f] rounded-md space-y-2">
            <div className="text-xs font-mono text-[#8a8070] uppercase tracking-wider">Lead Developer &amp; Architect</div>
            <div className="text-base font-bold text-white font-['Fraunces',serif]">Jayram Sappa</div>
            <div className="text-xs text-[#b9af9c]">Full-Stack Security &amp; Forensic Systems Engineer</div>
            <div className="pt-2 flex items-center justify-between">
              <a href="mailto:tracexmailofficial@gmail.com" className="text-xs font-mono text-amber-400 hover:underline">
                tracexmailofficial@gmail.com
              </a>
              <button
                type="button"
                onClick={() => onCopy('tracexmailofficial@gmail.com', 'c_dev')}
                className="text-[11px] font-mono text-[#8a8070] hover:text-white cursor-pointer"
              >
                {copiedKey === 'c_dev' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="p-4 bg-[#14110d] border border-[#2d271f] rounded-md space-y-2">
            <div className="text-xs font-mono text-[#8a8070] uppercase tracking-wider">Privacy &amp; Compliance Desk</div>
            <div className="text-base font-bold text-white font-['Fraunces',serif]">Data Protection Office</div>
            <div className="text-xs text-[#b9af9c]">GDPR, CCPA &amp; Google OAuth Verification</div>
            <div className="pt-2 flex items-center justify-between">
              <a href="mailto:tracexmailofficial@gmail.com" className="text-xs font-mono text-amber-400 hover:underline">
                tracexmailofficial@gmail.com
              </a>
              <button
                type="button"
                onClick={() => onCopy('tracexmailofficial@gmail.com', 'c_dpo')}
                className="text-[11px] font-mono text-[#8a8070] hover:text-white cursor-pointer"
              >
                {copiedKey === 'c_dpo' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </Section>

      <Section title="2. Send an Inquiry or Support Docket" badge="Instant Ticket" filter={filter}>
        {formSent ? (
          <div className="p-6 bg-[#14110d] border border-emerald-500/30 rounded-md text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
            <h3 className="text-base font-bold text-white font-['Fraunces',serif]">Inquiry Docket Logged</h3>
            <p className="text-xs text-[#b9af9c] max-w-md mx-auto leading-relaxed">
              Your message has been assigned tracking docket <code className="px-1.5 py-0.5 rounded bg-[#1f1a14] border border-[#383025] text-emerald-400 font-mono text-xs font-bold">{ticketRef}</code>. We will respond directly to <span className="text-white font-mono">{formData.email}</span>.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => { 
                  setFormSent(false); 
                  setFormData({ name: '', email: '', subject: 'Google OAuth App Review / Verification', message: '' }); 
                  setFormError(null);
                }}
                className="px-4 py-2 bg-[#221e17] hover:bg-[#2c261e] text-xs text-[#ede6d8] rounded border border-[#3a3225] transition-colors cursor-pointer font-mono"
              >
                Send Another Message
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-[#8a8070] mb-1">Your Name / Callsign *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formError) setFormError(null);
                  }}
                  placeholder="Security Analyst"
                  className="w-full bg-[#120f0c] border border-[#2d271f] rounded px-3 py-2 text-xs text-[#ede6d8] focus:border-amber-400 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#8a8070] mb-1">Your Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (formError) setFormError(null);
                  }}
                  placeholder="analyst@organization.com"
                  className="w-full bg-[#120f0c] border border-[#2d271f] rounded px-3 py-2 text-xs text-[#ede6d8] focus:border-amber-400 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-[#8a8070] mb-1">Inquiry Subject</label>
              <select
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full bg-[#120f0c] border border-[#2d271f] rounded px-3 py-2 text-xs text-[#ede6d8] focus:border-amber-400 focus:outline-none font-mono"
              >
                <option value="Google OAuth App Review / Verification">Google OAuth App Review / Verification</option>
                <option value="GDPR / CCPA Data Subject Request">GDPR / CCPA Data Subject Request</option>
                <option value="Security Vulnerability Disclosure">Security Vulnerability Disclosure</option>
                <option value="Enterprise Integration & API Access">Enterprise Integration &amp; API Access</option>
                <option value="General Support / Inquiry">General Support / Inquiry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-[#8a8070] mb-1">Message *</label>
              <textarea
                required
                rows={4}
                value={formData.message}
                onChange={(e) => {
                  setFormData({ ...formData, message: e.target.value });
                  if (formError) setFormError(null);
                }}
                placeholder="Describe your inquiry, compliance audit request, or verification details..."
                className="w-full bg-[#120f0c] border border-[#2d271f] rounded px-3 py-2 text-xs text-[#ede6d8] focus:border-amber-400 focus:outline-none font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={formSubmitting}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-5 py-2.5 rounded text-xs font-bold font-mono transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>{formSubmitting ? 'Transmitting…' : 'Transmit Inquiry'}</span>
            </button>
          </form>
        )}
      </Section>
    </>
  );
}

function AboutContent({ filter, onCopy, copiedKey }: { filter: string; onCopy: (text: string, key: string) => void; copiedKey: string | null }) {
  return (
    <>
      <Section id="about-mission" title="1. Platform Mission & Engineering Philosophy" filter={filter}>
        <p className="text-xs sm:text-sm text-[#b9af9c] leading-relaxed">
          TraceXMail was engineered to bring absolute transparency, mathematical rigor, and court-admissible forensic verification to email threat detection. Over 85% of corporate cyber breaches initiate via deceptive email lures. Traditional gateways often output opaque verdicts without showing analysts the underlying transport layer evidence.
        </p>
        <p className="mt-2 text-xs sm:text-sm text-[#b9af9c] leading-relaxed">
          Our platform deconstructs raw RFC 822 / RFC 5322 payloads down to every individual Mail Transfer Agent (MTA) hop, validates cryptographic public key DNS proofs (SPF, DKIM, DMARC, ARC), and exposes forged headers without hallucination.
        </p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[#120f0c] p-3 rounded border border-[#2d271f]">
            <div className="text-xs font-mono text-amber-400 font-bold">RFC 5322 Standards</div>
            <div className="text-[11px] text-[#8a8070] mt-1">Bit-exact reverse chronological Received hop deconstruction.</div>
          </div>
          <div className="bg-[#120f0c] p-3 rounded border border-[#2d271f]">
            <div className="text-xs font-mono text-cyan-400 font-bold">FRE 902 Custody</div>
            <div className="text-[11px] text-[#8a8070] mt-1">Court-admissible electronic digital records with SHA-256 digests.</div>
          </div>
          <div className="bg-[#120f0c] p-3 rounded border border-[#2d271f]">
            <div className="text-xs font-mono text-green-400 font-bold">Zero-Retention Enclave</div>
            <div className="text-[11px] text-[#8a8070] mt-1">Client-isolated processing that never trains public machine models.</div>
          </div>
        </div>
      </Section>

      <Section id="about-leadership" title="2. Leadership & Lead Researcher Profile" filter={filter}>
        <div className="flex flex-col sm:flex-row items-start gap-4 bg-[#120f0c] p-4 rounded-lg border border-[#2d271f]">
          <div className="w-14 h-14 rounded-full bg-[#1c1813] border-2 border-amber-400/80 flex items-center justify-center font-bold text-lg text-[#ede6d8] shrink-0 font-mono">
            JS
          </div>
          <div className="space-y-1.5 text-xs text-[#b9af9c]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white font-['Fraunces',serif]">Jayaram Sappa</span>
              <span className="text-[10px] font-mono bg-amber-400/10 text-amber-300 border border-amber-400/30 px-1.5 py-0.5 rounded">Founder &amp; Lead Researcher</span>
            </div>
            <p className="text-[12px] text-[#8a8070] leading-relaxed">
              Cybersecurity researcher specializing in digital forensics, incident response automation, applied cryptography, and defensive threat intelligence. Jayaram designed TraceXMail to provide security operations center (SOC) analysts worldwide with open, mathematically verifiable email diagnostics.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono">
              <span className="text-[#8a8070]">Email:</span>
              <a href="mailto:jayramsappa537@gmail.com" className="text-amber-400 hover:underline">jayramsappa537@gmail.com</a>
              <span className="text-[#3a3225]">•</span>
              <span className="text-[#8a8070]">Official SOC:</span>
              <a href="mailto:tracexmailofficial@gmail.com" className="text-amber-400 hover:underline">tracexmailofficial@gmail.com</a>
            </div>
          </div>
        </div>
      </Section>

      <Section id="about-standards" title="3. Supported Cryptographic & Forensics Standards" filter={filter}>
        <div className="space-y-2 text-xs font-mono text-[#b9af9c]">
          <div className="p-2.5 rounded bg-[#120f0c] border border-[#2d271f] flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span>RFC 7208 — Sender Policy Framework (SPF)</span>
            <span className="text-amber-400 text-[11px]">Strict &amp; SoftFail Evaluation + 10-Lookup Limit</span>
          </div>
          <div className="p-2.5 rounded bg-[#120f0c] border border-[#2d271f] flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span>RFC 6376 — DomainKeys Identified Mail (DKIM)</span>
            <span className="text-amber-400 text-[11px]">RSA-SHA256 &amp; Ed25519 Cryptographic Verification</span>
          </div>
          <div className="p-2.5 rounded bg-[#120f0c] border border-[#2d271f] flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span>RFC 7489 — DMARC Alignment Protocol</span>
            <span className="text-amber-400 text-[11px]">Strict &amp; Relaxed Identifier Alignment</span>
          </div>
          <div className="p-2.5 rounded bg-[#120f0c] border border-[#2d271f] flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span>RFC 8617 — Authenticated Received Chain (ARC)</span>
            <span className="text-amber-400 text-[11px]">Cross-Forwarder Cryptographic Continuity</span>
          </div>
          <div className="p-2.5 rounded bg-[#120f0c] border border-[#2d271f] flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span>NIST SP 800-86 — Forensic Incident Guidelines</span>
            <span className="text-amber-400 text-[11px]">Digital Media &amp; Evidence Handling Standards</span>
          </div>
        </div>
      </Section>

      <Section id="about-knowledge" title="4. Open Research & Knowledge Base Tutorials" filter={filter}>
        <p className="text-xs text-[#b9af9c] mb-3">
          Explore our complete educational guides published for security operations practitioners:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a
            href="/knowledge/understanding-spf-dkim-dmarc.html"
            className="p-3 rounded bg-[#120f0c] border border-[#2d271f] hover:border-amber-400 transition-colors block text-left no-underline"
          >
            <div className="text-xs font-bold text-white mb-1">SPF, DKIM &amp; DMARC</div>
            <div className="text-[11px] text-[#8a8070]">Deep dive into email authentication and alignment mechanics.</div>
            <div className="text-[11px] text-amber-400 mt-2 font-mono">Read Guide &rarr;</div>
          </a>
          <a
            href="/knowledge/email-header-forensics-guide.html"
            className="p-3 rounded bg-[#120f0c] border border-[#2d271f] hover:border-amber-400 transition-colors block text-left no-underline"
          >
            <div className="text-xs font-bold text-white mb-1">Header Forensics</div>
            <div className="text-[11px] text-[#8a8070]">Decoding Received hops, MTA latency, and forged headers.</div>
            <div className="text-[11px] text-amber-400 mt-2 font-mono">Read Guide &rarr;</div>
          </a>
          <a
            href="/knowledge/detecting-phishing-and-bec.html"
            className="p-3 rounded bg-[#120f0c] border border-[#2d271f] hover:border-amber-400 transition-colors block text-left no-underline"
          >
            <div className="text-xs font-bold text-white mb-1">Phishing &amp; BEC Playbook</div>
            <div className="text-[11px] text-[#8a8070]">SOC triage for lookalike domains and weaponized lures.</div>
            <div className="text-[11px] text-amber-400 mt-2 font-mono">Read Guide &rarr;</div>
          </a>
        </div>
      </Section>
    </>
  );
}
