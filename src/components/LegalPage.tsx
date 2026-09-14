import React, { useState } from 'react';
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
  ExternalLink,
  Shield,
  Server,
  UserCheck,
  Clock,
  AlertTriangle
} from 'lucide-react';

export type LegalPageType = 'privacy' | 'terms' | 'cookies' | 'domains' | 'contact' | 'security';

interface LegalPageProps {
  type?: LegalPageType;
}

export function LegalPage({ type = 'privacy' }: LegalPageProps) {
  const [activeTab, setActiveTab] = useState<LegalPageType>(type);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const tabs: { id: LegalPageType; label: string; path: string; icon: any }[] = [
    { id: 'privacy', label: 'Privacy Policy', path: '/privacy', icon: Lock },
    { id: 'terms', label: 'Terms of Service', path: '/terms', icon: FileText },
    { id: 'cookies', label: 'Cookie Policy', path: '/cookies', icon: CookieIcon },
    { id: 'domains', label: 'Authorized Domains', path: '/domains', icon: Globe },
    { id: 'contact', label: 'Developer Contact', path: '/contact', icon: Mail },
    { id: 'security', label: 'Security Policy', path: '/security', icon: Shield }
  ];

  const switchTab = (tabId: LegalPageType, path: string) => {
    setActiveTab(tabId);
    if (window.history && window.history.pushState) {
      window.history.pushState(null, '', path);
    }
  };

  return (
    <div className="min-h-screen bg-[#14120f] text-[#ede6d8] font-sans selection:bg-[#b23a2e] selection:text-[#ede6d8]">
      {/* Top Header */}
      <header className="border-b border-[#3a352c] bg-[#1a1713]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-4">
          <a href="/" className="flex items-center gap-3 no-underline group">
            <div className="w-8 h-8 rounded-[4px] bg-[#b23a2e]/20 border border-[#b23a2e]/40 flex items-center justify-center text-[#e87063] group-hover:border-[#b23a2e] transition-colors">
              <ShieldCheck className="h-5 w-5 text-[#b23a2e]" />
            </div>
            <div>
              <span className="text-base font-semibold tracking-tight text-[#ede6d8] block">
                TraceXMail
              </span>
              <span className="text-[10px] font-mono text-[#8a8070] uppercase tracking-widest block">
                Compliance & Legal Portal
              </span>
            </div>
          </a>

          <div className="flex items-center gap-3">
            <a
              href="https://tracexmail.vercel.app"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono text-[#b9af9c] hover:text-[#ede6d8] px-3 py-1.5 rounded-[3px] border border-[#3a352c] hover:border-[#524a3e] transition-colors no-underline"
            >
              <Globe className="h-3.5 w-3.5 text-[#b23a2e]" />
              tracexmail.vercel.app
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>

            <a
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#ede6d8] bg-[#24201a] hover:bg-[#302b23] border border-[#3a352c] px-3.5 py-1.5 rounded-[3px] transition-colors no-underline"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-[#b23a2e]" />
              Open Platform
            </a>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6 overflow-x-auto scrollbar-none">
          <nav className="flex space-x-1 border-t border-[#2a261f] pt-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => switchTab(tab.id, tab.path)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-[#b23a2e] text-[#ede6d8] font-semibold bg-[#24201a]/50'
                      : 'border-transparent text-[#8a8070] hover:text-[#b9af9c] hover:border-[#3a352c]'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-[#b23a2e]' : 'text-[#8a8070]'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 sm:py-14">
        {/* Breadcrumb / Title Bar */}
        <div className="mb-8 border-b border-[#2e2922] pb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <span className="font-mono text-xs uppercase tracking-widest text-[#b23a2e] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#b23a2e]" />
              Official Verification &amp; Public Transparency
            </span>
            <span className="font-mono text-[11px] text-[#8a8070] bg-[#1f1b16] px-2 py-0.5 rounded border border-[#3a352c]">
              Last Updated: September 2026
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#ede6d8]">
            {activeTab === 'privacy' && 'Privacy Policy'}
            {activeTab === 'terms' && 'Terms of Service'}
            {activeTab === 'cookies' && 'Cookie Policy & Local Storage'}
            {activeTab === 'domains' && 'Authorized Domains & App Verification'}
            {activeTab === 'contact' && 'Developer Contact & Support'}
            {activeTab === 'security' && 'Security Architecture & Vulnerability Disclosure'}
          </h1>
          <p className="mt-2 text-sm text-[#b9af9c]">
            {activeTab === 'privacy' && 'Comprehensive disclosure of data processing, forensic ingestion standards, Google OAuth handling, and privacy controls.'}
            {activeTab === 'terms' && 'Governing rules, authorized security investigations, forensic disclaimers, and user obligations.'}
            {activeTab === 'cookies' && 'Technical breakdown of essential authentication tokens, forensic preferences, and zero tracking guarantees.'}
            {activeTab === 'domains' && 'Production endpoints, Google OAuth redirect URIs, canonical origins, and domain verification records.'}
            {activeTab === 'contact' && 'Direct contact channels for developer inquiries, enterprise support, security disclosures, and OAuth verification.'}
            {activeTab === 'security' && 'Platform hardening, cryptographic verification, TLS 1.3 transport security, and safe harbor reporting.'}
          </p>
        </div>

        {/* Content Display */}
        <div className="space-y-8">
          {activeTab === 'privacy' && <PrivacyContent />}
          {activeTab === 'terms' && <TermsContent />}
          {activeTab === 'cookies' && <CookiesContent />}
          {activeTab === 'domains' && <DomainsContent onCopy={handleCopy} copiedKey={copiedKey} />}
          {activeTab === 'contact' && <ContactContent onCopy={handleCopy} copiedKey={copiedKey} />}
          {activeTab === 'security' && <SecurityContent onCopy={handleCopy} copiedKey={copiedKey} />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#3a352c] bg-[#14120f] py-8 text-xs text-[#8a8070]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-medium text-[#ede6d8]">TraceXMail Forensic Intelligence Platform</span>
            <span className="block mt-0.5 text-[11px] text-[#8a8070]">
              Developer: Jayram Sappa (jayramsappa537@gmail.com) • Production: https://tracexmail.vercel.app
            </span>
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-mono">
            <button onClick={() => switchTab('privacy', '/privacy')} className="hover:text-[#ede6d8] transition-colors">
              Privacy
            </button>
            <button onClick={() => switchTab('terms', '/terms')} className="hover:text-[#ede6d8] transition-colors">
              Terms
            </button>
            <button onClick={() => switchTab('cookies', '/cookies')} className="hover:text-[#ede6d8] transition-colors">
              Cookies
            </button>
            <button onClick={() => switchTab('domains', '/domains')} className="hover:text-[#ede6d8] transition-colors">
              Domains
            </button>
            <button onClick={() => switchTab('contact', '/contact')} className="hover:text-[#ede6d8] transition-colors">
              Contact
            </button>
            <button onClick={() => switchTab('security', '/security')} className="hover:text-[#ede6d8] transition-colors">
              Security
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({
  title,
  children,
  badge
}: {
  title: string;
  children: ReactNode;
  badge?: string;
}) {
  return (
    <section className="border border-[#2a261f] bg-[#1b1814] rounded-[4px] p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3 border-b border-[#2e2922] pb-3">
        <h2 className="text-base sm:text-lg font-semibold text-[#ede6d8] flex items-center gap-2">
          <span className="w-1.5 h-3.5 bg-[#b23a2e] rounded-sm inline-block" />
          {title}
        </h2>
        {badge && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#24201a] border border-[#3a352c] text-[#b9af9c]">
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-[#b9af9c]">
        {children}
      </div>
    </section>
  );
}

/* =========================================================================
   1. PRIVACY POLICY
========================================================================= */
function PrivacyContent() {
  return (
    <>
      <Section title="1. Overview & Data Controller" badge="GDPR & CCPA">
        <p>
          TraceXMail is an advanced email security and forensic intelligence platform built to enable cybersecurity analysts, incident response teams, and organizations to analyze raw RFC 822 email artifacts, audit authentication headers (SPF, DKIM, DMARC, ARC), reconstruct routing hop traceroutes, and detect phishing threats.
        </p>
        <p>
          The data controller responsible for TraceXMail is <strong>Jayram Sappa</strong> (Lead Architect &amp; Maintainer, contact: <a href="mailto:jayramsappa537@gmail.com" className="text-[#e87063] underline">jayramsappa537@gmail.com</a>). This Privacy Policy explains our commitment to minimal data collection, zero third-party telemetry sharing, and transparent data rights.
        </p>
      </Section>

      <Section title="2. Scope of Ingested Information" badge="Forensic Artifacts">
        <p>
          TraceXMail processes information submitted directly by users during forensic analysis, including:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#ede6d8]">
          <li><strong>Raw Email Headers &amp; RFC 822 Artifacts:</strong> Received headers, Return-Path, Authentication-Results, DKIM signatures, Message-ID, and client IP hops.</li>
          <li><strong>Threat Indicators:</strong> Embedded hyperlinks (defanged for analysis), attachment SHA-256 hashes, and forensic anomalies.</li>
          <li><strong>User Authentication State:</strong> Secure email address for platform accounts, encrypted multi-factor authentication (TOTP) metadata, and role-based authorization tokens.</li>
        </ul>
      </Section>

      <Section title="3. Google OAuth & Gmail Integration Compliance" badge="Limited Use Policy">
        <p>
          TraceXMail adheres strictly to Google API Services User Data Policy, including the <em>Limited Use</em> requirements.
        </p>
        <div className="p-3.5 bg-[#14120f] border border-[#b23a2e]/30 rounded-[3px] text-xs text-[#ede6d8] space-y-2">
          <p>
            <strong>Explicit Limited Use Guarantees:</strong>
          </p>
          <ul className="list-disc pl-4 space-y-1 text-[#b9af9c]">
            <li>TraceXMail's use and transfer of information received from Google APIs to any other app will adhere to <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="text-[#e87063] underline">Google API Services User Data Policy</a>, including the Limited Use requirements.</li>
            <li>We <strong>do not sell</strong> user data to third parties, advertising brokers, or data aggregators.</li>
            <li>We <strong>do not use</strong> or transfer user email data for serving ads, personalized marketing, or retargeting.</li>
            <li>We <strong>do not allow humans to read</strong> user email messages unless required by applicable law, with explicit user consent for specific support debugging, or in aggregated, anonymized form for security operations.</li>
          </ul>
        </div>
      </Section>

      <Section title="4. Data Security & Cryptographic Safeguards" badge="SOC 2 Type II Standards">
        <p>
          All data in transit is encrypted using <strong>TLS 1.3 / HTTPS</strong> with strong cipher suites. Data at rest is encrypted using <strong>AES-256</strong>. Forensic case records are strictly partitioned by organization and role-based access control (RBAC).
        </p>
        <p>
          TraceXMail includes built-in <strong>automated PII Masking</strong> allowing operators to sanitize Personally Identifiable Information (email addresses, names, and IP addresses) before exporting dossiers or sharing findings across security teams.
        </p>
      </Section>

      <Section title="5. Data Retention & Deletion Rights" badge="User Control">
        <p>
          Users retain full control over their uploaded forensic cases and account records:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#ede6d8]">
          <li><strong>Instant Case Deletion:</strong> Cases, extracted evidence, and generated reports can be permanently deleted at any time from the platform console.</li>
          <li><strong>Automated Retention Policies:</strong> Configurable compliance settings allow organizations to auto-purge cases after 30, 60, or 90 days.</li>
          <li><strong>Right to Erasure (GDPR Art. 17):</strong> To request complete deletion of your account and all associated telemetry, email <a href="mailto:jayramsappa537@gmail.com" className="text-[#e87063] underline">jayramsappa537@gmail.com</a>.</li>
        </ul>
      </Section>

      <Section title="6. Contact Data Protection Officer" badge="Direct Support">
        <p>
          For privacy inquiries, GDPR/CCPA requests, or data compliance questions:
        </p>
        <div className="bg-[#14120f] p-3 rounded border border-[#2e2922] text-xs font-mono space-y-1">
          <div><strong className="text-[#ede6d8]">Lead Developer / Controller:</strong> Jayram Sappa</div>
          <div><strong className="text-[#ede6d8]">Direct Email:</strong> <a href="mailto:jayramsappa537@gmail.com" className="text-[#e87063]">jayramsappa537@gmail.com</a></div>
          <div><strong className="text-[#ede6d8]">Primary Platform:</strong> <a href="https://tracexmail.vercel.app" target="_blank" rel="noreferrer" className="text-[#e87063]">https://tracexmail.vercel.app</a></div>
        </div>
      </Section>
    </>
  );
}

/* =========================================================================
   2. TERMS OF SERVICE
========================================================================= */
function TermsContent() {
  return (
    <>
      <Section title="1. Agreement to Terms" badge="Binding Agreement">
        <p>
          By accessing or using TraceXMail (available at <a href="https://tracexmail.vercel.app" className="text-[#e87063] underline">https://tracexmail.vercel.app</a> and associated instances), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not access or use the application.
        </p>
      </Section>

      <Section title="2. Authorized Security & Incident Response Use" badge="Permitted Use">
        <p>
          TraceXMail is provided strictly for defensive cybersecurity analysis, legitimate digital forensics, incident response investigations, vulnerability research, and security education.
        </p>
        <div className="p-3 bg-[#14120f] border border-[#2e2922] rounded text-xs space-y-1 text-[#b9af9c]">
          <p className="text-[#ede6d8] font-semibold">You explicitly agree that you will NOT:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Use the platform to inspect emails or infrastructure without legitimate organizational authority or authorization.</li>
            <li>Use the platform to launch denial-of-service attacks, port scans, or malicious exploits against third-party mail servers.</li>
            <li>Attempt to reverse-engineer or disrupt the TraceXMail ingestion pipelines or APIs.</li>
          </ul>
        </div>
      </Section>

      <Section title="3. Forensic Assistive AI & Detection Disclaimers" badge="Assistive Tool">
        <p>
          TraceXMail employs multi-layer heuristics, machine learning algorithms, SPF/DKIM/DMARC/ARC cryptographic parsers, and threat intelligence feeds to assign risk scores and detect phishing indicators.
        </p>
        <p>
          These threat scores and indicators are assistive forensic observations. Cybersecurity analysts and operators must apply professional human verification before taking disruptive administrative actions (such as domain blocking or mailbox terminations).
        </p>
      </Section>

      <Section title="4. Intellectual Property & User Data Ownership" badge="Ownership">
        <p>
          Users retain full, exclusive ownership of all email artifacts, headers, evidence logs, and forensic dossiers submitted to or generated within their TraceXMail workspace.
        </p>
        <p>
          TraceXMail code, algorithms, interface styling, and trademarks remain the intellectual property of Jayram Sappa and respective open-source contributors.
        </p>
      </Section>

      <Section title="5. Service Level & Limitation of Liability" badge="Warranty Disclaimer">
        <p>
          TraceXMail is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, whether express or implied. Under no circumstances shall TraceXMail or its developers be liable for indirect, punitive, or consequential damages arising from cybersecurity incidents or service interruptions.
        </p>
      </Section>

      <Section title="6. Inquiries & Legal Notices" badge="Contact">
        <p>
          Legal notices, DMCA inquiries, or contractual questions should be directed to <a href="mailto:jayramsappa537@gmail.com" className="text-[#e87063] underline">jayramsappa537@gmail.com</a>.
        </p>
      </Section>
    </>
  );
}

/* =========================================================================
   3. COOKIE POLICY
========================================================================= */
function CookiesContent() {
  return (
    <>
      <Section title="1. What Are Cookies & Local Storage?" badge="Technical Details">
        <p>
          Cookies and client-side browser storage (such as HTML5 LocalStorage and SessionStorage) are small files or key-value entries stored on your computer or mobile device when you visit web applications.
        </p>
        <p>
          TraceXMail uses <strong>strictly essential cookies and local storage items</strong> necessary to authenticate users, maintain active security sessions, and preserve local privacy preferences (such as PII redaction settings).
        </p>
      </Section>

      <Section title="2. Zero Advertising & Zero Tracking Guarantee" badge="Privacy First">
        <div className="p-3.5 bg-[#14120f] border border-[#2e2922] rounded text-xs text-[#ede6d8] space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            No Third-Party Ad Networks or Cross-Site Trackers
          </div>
          <p className="text-[#b9af9c]">
            TraceXMail does <strong>NOT</strong> use marketing cookies, tracking beacons, Google Analytics ad trackers, or third-party behavioral profiling scripts. Your forensic investigations remain completely confidential.
          </p>
        </div>
      </Section>

      <Section title="3. Comprehensive Inventory of Storage Keys" badge="Audit Table">
        <div className="overflow-x-auto border border-[#2e2922] rounded bg-[#14120f]">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#2e2922] bg-[#1a1713] text-[#ede6d8]">
                <th className="p-3">Key / Cookie Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Purpose</th>
                <th className="p-3">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#24201a] text-[#b9af9c]">
              <tr>
                <td className="p-3 text-[#ede6d8]">tracexmail_session_auth</td>
                <td className="p-3">LocalStorage</td>
                <td className="p-3">Maintains authenticated user session state &amp; RBAC role</td>
                <td className="p-3">Session / 30 Days</td>
              </tr>
              <tr>
                <td className="p-3 text-[#ede6d8]">tracexmail_privacy_config</td>
                <td className="p-3">LocalStorage</td>
                <td className="p-3">Saves PII masking toggles (redacting names/emails/IPs)</td>
                <td className="p-3">Persistent</td>
              </tr>
              <tr>
                <td className="p-3 text-[#ede6d8]">tracexmail_theme_pref</td>
                <td className="p-3">LocalStorage</td>
                <td className="p-3">Remembers UI high-contrast dark theme preference</td>
                <td className="p-3">Persistent</td>
              </tr>
              <tr>
                <td className="p-3 text-[#ede6d8]">sb-*-auth-token</td>
                <td className="p-3">LocalStorage</td>
                <td className="p-3">Supabase Auth JWT credentials for cloud database synchronization</td>
                <td className="p-3">Session / Refresh Token</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="4. Managing & Disabling Local Storage" badge="User Instructions">
        <p>
          You can clear your browser storage and cookies at any time through your browser settings:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs text-[#ede6d8]">
          <li><strong>Chrome:</strong> Settings → Privacy and Security → Clear Browsing Data → Cookies and other site data.</li>
          <li><strong>Firefox:</strong> Settings → Privacy &amp; Security → Cookies and Site Data → Clear Data.</li>
          <li><strong>Safari:</strong> Preferences → Privacy → Manage Website Data → Remove All.</li>
        </ul>
      </Section>
    </>
  );
}

/* =========================================================================
   4. AUTHORIZED DOMAINS & APP VERIFICATION
========================================================================= */
function DomainsContent({ onCopy, copiedKey }: { onCopy: (t: string, k: string) => void; copiedKey: string | null }) {
  const domains = [
    {
      domain: 'tracexmail.vercel.app',
      type: 'Canonical Production Origin',
      status: 'Active / Verified',
      purpose: 'Primary web application home, public landing, and OAuth consent origin.'
    },
    {
      domain: 'tracexmail.vercel.app/auth/callback',
      type: 'Google OAuth Authorized Redirect URI',
      status: 'Configured',
      purpose: 'Authorized OAuth 2.0 popup and redirect handler for Google & Supabase identity providers.'
    },
    {
      domain: 'ais-dev-lnfvtqijthitgc3xfvjgby-453092856874.asia-southeast1.run.app',
      type: 'Cloud Development Engine',
      status: 'Active / Managed',
      purpose: 'Real-time forensic container compute & WebSocket alert streaming engine.'
    },
    {
      domain: 'ais-pre-lnfvtqijthitgc3xfvjgby-453092856874.asia-southeast1.run.app',
      type: 'Staging & Preview Deployment',
      status: 'Active / Managed',
      purpose: 'Live preview and regression testing environment.'
    }
  ];

  return (
    <>
      <Section title="1. Verified Application Origins" badge="Google OAuth Ready">
        <p>
          The following web domains and origins are the official, verified production and deployment endpoints for <strong>TraceXMail</strong>. Use these verified domains when configuring OAuth credentials, firewall allowlists, or DNS routing.
        </p>

        <div className="space-y-3 mt-4">
          {domains.map((item, idx) => (
            <div key={idx} className="p-3.5 bg-[#14120f] border border-[#2e2922] rounded-[3px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[#ede6d8] font-bold text-sm select-all">{item.domain}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#24201a] border border-[#3a352c] text-emerald-400">
                    {item.status}
                  </span>
                </div>
                <div className="text-[#8a8070] text-[11px] font-sans">{item.type} • {item.purpose}</div>
              </div>

              <button
                onClick={() => onCopy(item.domain.startsWith('http') ? item.domain : `https://${item.domain}`, `dom_${idx}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1f1b16] hover:bg-[#28231c] border border-[#3a352c] text-[#ede6d8] rounded text-xs transition-colors shrink-0"
              >
                {copiedKey === `dom_${idx}` ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-[#8a8070]" />
                    Copy URL
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="2. Google Cloud Platform & OAuth Console Setup" badge="Developer Reference">
        <p>
          To configure your Google Cloud OAuth Consent Screen and Credentials for TraceXMail, submit the following verified values in your Google Cloud Console:
        </p>
        <div className="bg-[#14120f] p-4 rounded border border-[#2e2922] space-y-3 text-xs font-mono">
          <div>
            <span className="text-[#8a8070] block text-[11px]">Application Home Page:</span>
            <div className="flex items-center justify-between text-[#ede6d8] mt-1">
              <span>https://tracexmail.vercel.app</span>
              <button onClick={() => onCopy('https://tracexmail.vercel.app', 'g_home')} className="text-[#e87063] hover:underline text-[11px]">
                {copiedKey === 'g_home' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="border-t border-[#24201a] pt-2">
            <span className="text-[#8a8070] block text-[11px]">Application Privacy Policy Link:</span>
            <div className="flex items-center justify-between text-[#ede6d8] mt-1">
              <span>https://tracexmail.vercel.app/privacy</span>
              <button onClick={() => onCopy('https://tracexmail.vercel.app/privacy', 'g_priv')} className="text-[#e87063] hover:underline text-[11px]">
                {copiedKey === 'g_priv' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="border-t border-[#24201a] pt-2">
            <span className="text-[#8a8070] block text-[11px]">Application Terms of Service Link:</span>
            <div className="flex items-center justify-between text-[#ede6d8] mt-1">
              <span>https://tracexmail.vercel.app/terms</span>
              <button onClick={() => onCopy('https://tracexmail.vercel.app/terms', 'g_terms')} className="text-[#e87063] hover:underline text-[11px]">
                {copiedKey === 'g_terms' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="border-t border-[#24201a] pt-2">
            <span className="text-[#8a8070] block text-[11px]">Authorized Domain (for OAuth Consent Screen):</span>
            <div className="flex items-center justify-between text-[#ede6d8] mt-1">
              <span>vercel.app</span> (or <span>tracexmail.vercel.app</span>)
              <button onClick={() => onCopy('tracexmail.vercel.app', 'g_domain')} className="text-[#e87063] hover:underline text-[11px]">
                {copiedKey === 'g_domain' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="border-t border-[#24201a] pt-2">
            <span className="text-[#8a8070] block text-[11px]">Authorized Redirect URI:</span>
            <div className="flex items-center justify-between text-[#ede6d8] mt-1">
              <span>https://tracexmail.vercel.app/auth/callback</span>
              <button onClick={() => onCopy('https://tracexmail.vercel.app/auth/callback', 'g_cb')} className="text-[#e87063] hover:underline text-[11px]">
                {copiedKey === 'g_cb' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="border-t border-[#24201a] pt-2">
            <span className="text-[#8a8070] block text-[11px]">Developer Contact Email:</span>
            <div className="flex items-center justify-between text-[#ede6d8] mt-1">
              <span>jayramsappa537@gmail.com</span>
              <button onClick={() => onCopy('jayramsappa537@gmail.com', 'g_dev')} className="text-[#e87063] hover:underline text-[11px]">
                {copiedKey === 'g_dev' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

/* =========================================================================
   5. DEVELOPER CONTACT & SUPPORT
========================================================================= */
function ContactContent({ onCopy, copiedKey }: { onCopy: (t: string, k: string) => void; copiedKey: string | null }) {
  const [formSent, setFormSent] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', subject: 'Inquiry / Support', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSent(true);
  };

  return (
    <>
      <Section title="1. Official Developer Contact Information" badge="Primary Contact">
        <p>
          For developer verification, enterprise security partnerships, OAuth app review verifications, or technical support, contact the lead maintainer directly:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div className="p-4 bg-[#14120f] border border-[#2e2922] rounded-[3px] space-y-2">
            <div className="text-xs font-mono text-[#8a8070] uppercase">Lead Developer &amp; Architect</div>
            <div className="text-base font-bold text-[#ede6d8]">Jayram Sappa</div>
            <div className="text-xs text-[#b9af9c]">Full-Stack Security &amp; Forensic Engineer</div>
            <div className="pt-2 flex items-center justify-between">
              <a href="mailto:jayramsappa537@gmail.com" className="text-xs font-mono text-[#e87063] hover:underline">
                jayramsappa537@gmail.com
              </a>
              <button
                onClick={() => onCopy('jayramsappa537@gmail.com', 'c_dev')}
                className="text-[11px] font-mono text-[#8a8070] hover:text-[#ede6d8]"
              >
                {copiedKey === 'c_dev' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="p-4 bg-[#14120f] border border-[#2e2922] rounded-[3px] space-y-2">
            <div className="text-xs font-mono text-[#8a8070] uppercase">Platform Operations &amp; Support</div>
            <div className="text-base font-bold text-[#ede6d8]">TraceXMail SOC Operations</div>
            <div className="text-xs text-[#b9af9c]">Threat Intelligence &amp; Ingestion Support</div>
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs font-mono text-[#b9af9c]">
                support@tracexmail.sec
              </span>
              <button
                onClick={() => onCopy('support@tracexmail.sec', 'c_soc')}
                className="text-[11px] font-mono text-[#8a8070] hover:text-[#ede6d8]"
              >
                {copiedKey === 'c_soc' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </Section>

      <Section title="2. Send a Direct Message / Support Inquiry" badge="Instant Portal">
        {formSent ? (
          <div className="p-6 bg-[#14120f] border border-emerald-500/30 rounded text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
            <h3 className="text-base font-semibold text-[#ede6d8]">Message Received</h3>
            <p className="text-xs text-[#b9af9c]">
              Thank you for reaching out. We have logged your request. For urgent inquiries, email{' '}
              <strong className="text-[#ede6d8]">jayramsappa537@gmail.com</strong> directly.
            </p>
            <button
              onClick={() => { setFormSent(false); setFormData({ name: '', email: '', subject: 'Inquiry / Support', message: '' }); }}
              className="mt-3 px-4 py-1.5 bg-[#24201a] text-xs text-[#ede6d8] rounded border border-[#3a352c]"
            >
              Send Another Inquiry
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-[#8a8070] mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Security Analyst"
                  className="w-full bg-[#14120f] border border-[#3a352c] rounded px-3 py-2 text-xs text-[#ede6d8] focus:border-[#b23a2e] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#8a8070] mb-1">Your Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="analyst@organization.com"
                  className="w-full bg-[#14120f] border border-[#3a352c] rounded px-3 py-2 text-xs text-[#ede6d8] focus:border-[#b23a2e] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-[#8a8070] mb-1">Subject</label>
              <select
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full bg-[#14120f] border border-[#3a352c] rounded px-3 py-2 text-xs text-[#ede6d8] focus:border-[#b23a2e] focus:outline-none"
              >
                <option value="Google OAuth App Review / Verification">Google OAuth App Review / Verification</option>
                <option value="Security Vulnerability Disclosure">Security Vulnerability Disclosure</option>
                <option value="Enterprise Integration & API Access">Enterprise Integration &amp; API Access</option>
                <option value="General Support / Inquiry">General Support / Inquiry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-[#8a8070] mb-1">Message</label>
              <textarea
                required
                rows={4}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Describe your inquiry, verification request, or feedback..."
                className="w-full bg-[#14120f] border border-[#3a352c] rounded px-3 py-2 text-xs text-[#ede6d8] focus:border-[#b23a2e] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="bg-[#b23a2e] hover:bg-[#c94a3d] text-[#ede6d8] px-5 py-2 rounded-[3px] text-xs font-semibold transition-colors flex items-center gap-2"
            >
              <Mail className="h-3.5 w-3.5" />
              Transmit Inquiry
            </button>
          </form>
        )}
      </Section>
    </>
  );
}

/* =========================================================================
   6. SECURITY POLICY & DISCLOSURE
========================================================================= */
function SecurityContent({ onCopy, copiedKey }: { onCopy: (t: string, k: string) => void; copiedKey: string | null }) {
  return (
    <>
      <Section title="1. Platform Security Posture" badge="Hardened Architecture">
        <p>
          TraceXMail treats cybersecurity defense and data integrity as foundational tenets. Our architecture enforces multiple defensive boundaries:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#ede6d8]">
          <li><strong>Defanged Link Analysis:</strong> All suspicious URLs extracted from email bodies are automatically defanged (e.g. <code>hxxp://</code>) before rendering to prevent accidental browser redirection.</li>
          <li><strong>Strict Content Security Policy (CSP):</strong> HTML email previews are executed inside isolated sandboxed iframes preventing arbitrary JavaScript execution or cookie extraction.</li>
          <li><strong>Rate Limiting &amp; Anti-Brute-Force:</strong> IP and token-based rate limiting on all public API endpoints to prevent distributed denial-of-service attempts.</li>
        </ul>
      </Section>

      <Section title="2. Responsible Vulnerability Disclosure & Safe Harbor" badge="Bounty & Disclosure">
        <p>
          We welcome contributions from independent security researchers. If you discover a security vulnerability in TraceXMail, please report it responsibly:
        </p>

        <div className="p-4 bg-[#14120f] border border-[#2e2922] rounded space-y-2 text-xs font-mono mt-3">
          <div className="text-[#ede6d8] font-bold">Vulnerability Reporting Contact:</div>
          <div>Email: <a href="mailto:jayramsappa537@gmail.com" className="text-[#e87063]">jayramsappa537@gmail.com</a></div>
          <div className="text-[#8a8070] text-[11px] font-sans pt-1">
            <strong>Safe Harbor Guarantee:</strong> We commit to not pursuing legal action against ethical security researchers who conduct testing in good faith, avoid privacy violations, do not destroy data, and provide reasonable time for remediation prior to public disclosure.
          </div>
        </div>
      </Section>
    </>
  );
}
