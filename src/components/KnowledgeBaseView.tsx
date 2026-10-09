import React, { useState } from 'react';
import { 
  BookOpen, 
  ArrowLeft, 
  Search, 
  ExternalLink, 
  ShieldCheck, 
  Lock, 
  Terminal, 
  FileText, 
  Cpu, 
  CheckCircle2, 
  Clock, 
  Share2, 
  Copy, 
  Check, 
  Layers, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { TraceXLogo } from './common/TraceXLogo';

interface KnowledgeBaseArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  readTime: string;
  summary: string;
  rfcReferences: string[];
  htmlPath: string;
  keyPoints: string[];
}

const ARTICLES: KnowledgeBaseArticle[] = [
  {
    id: 'spf-dkim-dmarc',
    slug: 'understanding-spf-dkim-dmarc',
    title: 'Understanding Email Authentication: SPF, DKIM, and DMARC Deep Dive',
    category: 'Cryptographic Protocols',
    readTime: '8 min read',
    summary: 'A definitive engineering reference detailing Sender Policy Framework (RFC 7208), DomainKeys Identified Mail (RFC 6376), and DMARC (RFC 7489) identifier alignment mechanics, DNS records, and evaluation flows.',
    rfcReferences: ['RFC 7208', 'RFC 6376', 'RFC 7489', 'RFC 8617 (ARC)'],
    htmlPath: '/knowledge/understanding-spf-dkim-dmarc.html',
    keyPoints: [
      'SPF checks the connecting MTA IP against the Return-Path (Mail From) domain DNS TXT record.',
      'DKIM signs header blocks and body hashes with RSA/Ed25519 private keys verified via DNS public keys.',
      'DMARC requires either SPF or DKIM to pass AND align with the RFC 5322 From domain in Strict (s=s) or Relaxed (r=r) mode.',
      'ARC preserves cryptographic authentication hops across intermediate mailing lists and enterprise forwarders.'
    ]
  },
  {
    id: 'header-forensics',
    slug: 'email-header-forensics-guide',
    title: 'The Definitive Guide to Email Header Forensics & Hop Traceroutes',
    category: 'Forensic Analysis',
    readTime: '10 min read',
    summary: 'How to decode RFC 5322 Received headers chronologically from bottom to top, identify injected forged hops, compute network MTA transfer latencies, and expose spoofed Message-IDs.',
    rfcReferences: ['RFC 5322', 'RFC 2821', 'RFC 3834', 'NIST SP 800-86'],
    htmlPath: '/knowledge/email-header-forensics-guide.html',
    keyPoints: [
      'Received headers prepend from bottom (origin client / submission) to top (final recipient MX gateway).',
      'The bottom-most trustworthy Received header is where origin forensic analysis begins.',
      'Negative or anomalous timestamps between MTA hops expose timezone mismatches or synthesized headers.',
      'Autonomous System Numbers (ASN) and reverse PTR lookups reveal commercial bulletproof relays.'
    ]
  },
  {
    id: 'phishing-bec',
    slug: 'detecting-phishing-and-bec',
    title: 'Detecting Advanced Phishing & Business Email Compromise (BEC): SOC Playbook',
    category: 'Threat Intelligence',
    readTime: '12 min read',
    summary: 'A step-by-step SOC Tier 1/2 playbook for dissecting high-risk Business Email Compromise (BEC), Internationalized Domain Name (IDN) homoglyph spoofing, and weaponized hyperlink evasions.',
    rfcReferences: ['MITRE ATT&CK T1566', 'MITRE ATT&CK T1586', 'RFC 5890 (IDNA)'],
    htmlPath: '/knowledge/detecting-phishing-and-bec.html',
    keyPoints: [
      'Executive display name spoofing frequently pairs an authentic VIP name with a disparate free webmail or spoofed domain.',
      'Cousin domain punycode (xn--) exploits visually identical Cyrillic/Greek characters to deceive victims.',
      'Defanged URL detonation in sandbox prevents zero-day drive-by downloads and token theft.',
      'Evidentiary SHA-256 chain of custody ensures forensic dossiers remain admissible in formal proceedings.'
    ]
  }
];

interface KnowledgeBaseViewProps {
  onNavigateHome?: () => void;
  onNavigateToPath?: (path: string) => void;
}

export function KnowledgeBaseView({ onNavigateHome, onNavigateToPath }: KnowledgeBaseViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const categories = ['All', 'Cryptographic Protocols', 'Forensic Analysis', 'Threat Intelligence'];

  const filteredArticles = ARTICLES.filter(art => {
    const matchesSearch = 
      art.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      art.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      art.rfcReferences.some(r => r.toLowerCase().includes(searchTerm.toLowerCase())) ||
      art.keyPoints.some(k => k.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || art.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCopyLink = (path: string, slug: string) => {
    const fullUrl = `${window.location.origin}${path}`;
    navigator.clipboard?.writeText(fullUrl);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  return (
    <div className="min-h-screen bg-[#110f0c] text-[#ede6d8] font-sans selection:bg-[#b23a2e] selection:text-[#ede6d8]">
      {/* Top Header */}
      <header className="border-b border-[#2d271f] bg-[#16130f]/95 backdrop-blur-md sticky top-0 z-50">
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
                  Knowledge Base
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#8a8070] uppercase tracking-widest block">
                RFC Protocols &amp; Forensics Field Guides
              </span>
            </div>
          </a>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                if (onNavigateToPath) {
                  onNavigateToPath('/about');
                } else if (onNavigateHome) {
                  onNavigateHome();
                }
              }}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono text-[#b9af9c] hover:text-[#ede6d8] px-2.5 py-1.5 rounded-sm border border-[#342e26] hover:border-[#4d4438] transition-colors cursor-pointer"
            >
              <span>About TraceXMail</span>
            </button>

            <button
              onClick={() => {
                if (onNavigateHome) onNavigateHome();
                else window.location.href = '/';
              }}
              className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-[#ede6d8] bg-[#221e17] hover:bg-[#2c261e] border border-[#3a3225] hover:border-amber-500/40 px-3.5 py-1.5 rounded-sm transition-colors cursor-pointer shadow-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-amber-400" />
              <span>Back to Console</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
        {/* Banner Section */}
        <div className="mb-8 border-b border-[#2d271f] pb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Peer-Reviewed Security Research
            </span>
            <span className="font-mono text-[10.5px] text-[#8a8070] bg-[#1a1612] px-2 py-0.5 rounded border border-[#2d271f]">
              RFC 5322 &bull; RFC 7208 &bull; RFC 6376 &bull; RFC 7489
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-['Fraunces',serif]">
            Email Forensics &amp; Threat Intelligence Knowledge Base
          </h1>
          <p className="mt-2 text-sm text-[#b9af9c] leading-relaxed max-w-3xl">
            In-depth guides, RFC specifications, and practitioner playbooks covering cryptographic email authentication,
            MTA hop traceroute forensics, and SOC Business Email Compromise (BEC) detection methods.
          </p>

          {/* Search and Filters */}
          <div className="mt-6 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative max-w-md w-full">
              <Search className="w-4 h-4 text-[#8a8070] absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search protocols, RFCs, phishing tactics..."
                className="w-full bg-[#16130f] border border-[#2e2922] focus:border-amber-500/60 rounded-md pl-9 pr-3 py-2 text-xs text-[#ede6d8] placeholder-[#6b6255] font-mono focus:outline-none transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-xs text-[#8a8070] hover:text-[#ede6d8] font-mono cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-mono rounded border transition-colors cursor-pointer whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-amber-400/10 border-amber-400 text-amber-300 font-bold'
                      : 'bg-[#181511] border-[#2e2922] text-[#8a8070] hover:text-[#ede6d8] hover:border-[#3d362c]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Articles List */}
        <div className="space-y-6">
          {filteredArticles.length === 0 ? (
            <div className="p-8 text-center bg-[#181511] border border-[#2e2922] rounded-lg">
              <p className="text-sm text-[#8a8070]">No knowledge base articles match your query.</p>
              <button
                onClick={() => { setSearchTerm(''); setSelectedCategory('All'); }}
                className="mt-3 text-xs text-amber-400 underline font-mono cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            filteredArticles.map((article) => (
              <article 
                key={article.id} 
                className="bg-[#16130f] border border-[#2a241c] hover:border-[#42392c] rounded-lg p-6 transition-all hover:bg-[#1a1713] group shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono px-2 py-0.5 bg-[#221d17] text-amber-400 border border-amber-400/20 rounded font-semibold">
                      {article.category}
                    </span>
                    <span className="text-[11px] font-mono text-[#8a8070] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {article.readTime}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyLink(article.htmlPath, article.slug)}
                      className="text-[11px] font-mono text-[#8a8070] hover:text-[#ede6d8] flex items-center gap-1 cursor-pointer bg-[#1e1a14] px-2 py-1 rounded border border-[#2e2922]"
                      title="Copy link to article"
                    >
                      {copiedSlug === article.slug ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Link Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Share</span>
                        </>
                      )}
                    </button>
                    <a
                      href={article.htmlPath}
                      className="text-[11px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 underline"
                    >
                      <span>Standalone HTML</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors mb-2">
                  <a href={article.htmlPath} className="no-underline text-inherit hover:underline">
                    {article.title}
                  </a>
                </h2>

                <p className="text-xs sm:text-sm text-[#b9af9c] leading-relaxed mb-4">
                  {article.summary}
                </p>

                {/* Key Points */}
                <div className="mb-4 bg-[#110f0c] p-3.5 rounded border border-[#241f19] space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#8a8070] block font-bold">
                    Key Architectural Takeaways:
                  </span>
                  <ul className="text-xs text-[#c7beaf] space-y-1 list-none pl-0 mb-0">
                    {article.keyPoints.map((pt, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Bottom Badges & Action */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#221e17]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {article.rfcReferences.map((rfc, i) => (
                      <span key={i} className="text-[10px] font-mono text-[#8a8070] bg-[#1a1612] px-2 py-0.5 rounded border border-[#2a241c]">
                        {rfc}
                      </span>
                    ))}
                  </div>

                  <a
                    href={article.htmlPath}
                    className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 hover:text-amber-300 no-underline"
                  >
                    <span>Read Complete Tutorial</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </a>
                </div>
              </article>
            ))
          )}
        </div>

        {/* Direct Link to Forensic Console */}
        <div className="mt-12 p-6 rounded-lg bg-gradient-to-r from-[#191510] to-[#221b14] border border-[#382f23] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white mb-1">
              Test These Forensic Techniques in Real Time
            </h3>
            <p className="text-xs text-[#b9af9c] max-w-xl">
              Upload raw RFC 822 email files (.eml) or paste raw email headers into the TraceXMail engine
              for automated SPF/DKIM/DMARC validation and interactive hop graph reconstruction.
            </p>
          </div>
          <button
            onClick={() => {
              if (onNavigateHome) onNavigateHome();
              else window.location.href = '/';
            }}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-[#14120f] font-bold font-mono text-xs rounded transition-colors cursor-pointer shrink-0"
          >
            Open Forensic Console &rarr;
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2d271f] bg-[#14110d] py-8 text-xs text-[#8a8070]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-bold text-[#ede6d8] font-['Fraunces',serif]">TraceXMail Forensic Intelligence Platform</span>
            <span className="block mt-0.5 text-[11px] text-[#8a8070]">
              &copy; {new Date().getFullYear()} TraceXMail. Research lead: Jayram Sappa (<a href="mailto:jayramsappa537@gmail.com" className="text-[#b9af9c] hover:underline">jayramsappa537@gmail.com</a>) &bull; Canonical: <a href="https://tracexmail.vercel.app" target="_blank" rel="noreferrer" className="text-amber-400 hover:underline">https://tracexmail.vercel.app</a>
            </span>
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-mono">
            <button 
              onClick={() => onNavigateToPath ? onNavigateToPath('/about') : window.location.href = '/about'} 
              className="hover:text-[#ede6d8] transition-colors cursor-pointer"
            >
              About
            </button>
            <button 
              onClick={() => onNavigateToPath ? onNavigateToPath('/privacy') : window.location.href = '/privacy'} 
              className="hover:text-[#ede6d8] transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <button 
              onClick={() => onNavigateToPath ? onNavigateToPath('/terms') : window.location.href = '/terms'} 
              className="hover:text-[#ede6d8] transition-colors cursor-pointer"
            >
              Terms of Service
            </button>
            <button 
              onClick={() => onNavigateToPath ? onNavigateToPath('/security') : window.location.href = '/security'} 
              className="hover:text-[#ede6d8] transition-colors cursor-pointer"
            >
              Security
            </button>
            <button 
              onClick={() => onNavigateToPath ? onNavigateToPath('/contact') : window.location.href = '/contact'} 
              className="hover:text-[#ede6d8] transition-colors cursor-pointer"
            >
              Contact
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
