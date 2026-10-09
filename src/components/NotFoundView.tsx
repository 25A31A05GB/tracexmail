import React, { useEffect, useState } from 'react';
import { 
  FileQuestion, 
  Home, 
  ArrowLeft, 
  ShieldAlert, 
  Search, 
  Mail, 
  Terminal, 
  Globe, 
  CheckCircle2,
  Lock,
  Route,
  ExternalLink,
  BookOpen,
  ShieldCheck,
  FileCode,
  Sparkles
} from 'lucide-react';
import { TraceXLogo } from './common/TraceXLogo';
import { updatePageMetadata, ROUTE_METADATA } from '../utils/seo';
import { trackPageView, trackEvent } from '../utils/analytics';

interface NotFoundViewProps {
  pathname?: string;
  onNavigateHome?: () => void;
}

export function NotFoundView({ pathname = typeof window !== 'undefined' ? window.location.pathname : '', onNavigateHome }: NotFoundViewProps) {
  const currentYear = new Date().getFullYear();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);

  useEffect(() => {
    updatePageMetadata(ROUTE_METADATA['404']);
    trackPageView('/404', '404 Docket Not Found | TraceXMail');
  }, []);

  const handleGoHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    trackEvent('404_search', 'Navigation', searchQuery);
    setSearchFeedback(`Redirecting query "${searchQuery}" to Forensic Analysis Console...`);
    setTimeout(() => {
      handleGoHome();
    }, 700);
  };

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[#14120f] text-[#ede6d8] font-sans flex flex-col justify-between selection:bg-[#b23a2e] selection:text-[#ede6d8]">
      
      {/* Top Header Navigation */}
      <header className="border-b border-[#3a352c] bg-[#1a1713]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-4">
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
              <span className="text-base font-semibold tracking-tight text-[#ede6d8] block">
                TraceXMail
              </span>
              <span className="text-[10px] font-mono text-[#8a8070] uppercase tracking-widest block">
                Forensic Intelligence
              </span>
            </div>
          </a>

          <div className="flex items-center gap-3">
            <a
              href="/"
              onClick={(e) => {
                if (onNavigateHome) {
                  e.preventDefault();
                  onNavigateHome();
                }
              }}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#ede6d8] bg-[#24201a] hover:bg-[#302b23] border border-[#3a352c] px-3.5 py-1.5 rounded-[3px] transition-colors no-underline cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-[#b23a2e]" />
              <span>Back to Console</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main 404 Body */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 md:py-16 text-center max-w-3xl mx-auto w-full">
        
        {/* Visual Forensic Indicator */}
        <div className="relative mb-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#1f1a14] border-2 border-[#b23a2e]/50 flex items-center justify-center text-[#e87063] shadow-[0_0_40px_rgba(178,58,46,0.2)] mx-auto animate-in zoom-in duration-300">
            <FileQuestion className="w-10 h-10 sm:w-12 sm:h-12 text-[#b23a2e]" />
          </div>
          <span className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-[2px] bg-[#2a1410] border border-[#b23a2e] text-[10px] font-mono font-bold text-[#ff8d7d]">
            HTTP 404
          </span>
        </div>

        {/* Status Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[2px] bg-[#1f1a14] border border-[#3d2f1f] text-[11.5px] font-mono text-[#c9a227] mb-4">
          <ShieldAlert className="w-3.5 h-3.5 text-[#b23a2e]" />
          <span>ROUTING ENCLAVE NOTICE: DOCKET NOT FOUND</span>
        </div>

        {/* Heading */}
        <h1 className="font-['Fraunces',serif] text-2xl sm:text-4xl lg:text-5xl font-semibold text-[#ede6d8] tracking-tight leading-tight max-w-[20ch]">
          Evidence Docket Relocated or Missing
        </h1>

        {/* Explanation */}
        <p className="mt-4 text-[#b9af9c] text-sm sm:text-base leading-relaxed max-w-xl">
          The requested path{' '}
          {pathname ? (
            <code className="px-1.5 py-0.5 rounded bg-[#1f1a14] border border-[#3a352c] text-[#ff8d7d] font-mono text-xs break-all">
              {pathname}
            </code>
          ) : (
            'URL'
          )}{' '}
          does not correspond to an active forensic case, analysis dossier, or compliance endpoint. It may have expired from temporary custody or was entered incorrectly.
        </p>

        {/* Search Bar for Quick Recovery */}
        <form onSubmit={handleSearchSubmit} className="mt-6 w-full max-w-md mx-auto">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-[#8a8070] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search docket, RFC 822 header, or security topic..."
              className="w-full bg-[#181511] border border-[#3a352c] focus:border-[#c9a227] text-xs font-mono text-[#ede6d8] pl-10 pr-20 py-2.5 rounded-[3px] outline-none transition-colors"
            />
            <button
              type="submit"
              className="absolute right-1 px-3 py-1.5 text-xs font-mono font-semibold bg-[#24201a] hover:bg-[#302b23] text-[#c9a227] border border-[#3a352c] rounded-[2px] cursor-pointer transition-colors"
            >
              Search
            </button>
          </div>
          {searchFeedback && (
            <p className="mt-2 text-xs font-mono text-[#c9a227] animate-pulse">{searchFeedback}</p>
          )}
        </form>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full max-w-md">
          <button
            type="button"
            onClick={handleGoHome}
            className="w-full sm:w-auto bg-[#b23a2e] hover:bg-[#c94a3d] text-[#ede6d8] px-6 py-3 rounded-[3px] font-semibold text-sm transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Home className="w-4 h-4" />
            <span>Return to Forensic Console</span>
          </button>

          <a
            href="/contact"
            className="w-full sm:w-auto px-5 py-3 rounded-[3px] font-medium text-sm border border-[#3a352c] text-[#ede6d8] hover:border-[#b9af9c] hover:bg-[#1d1a15] transition-all cursor-pointer flex items-center justify-center gap-2 no-underline"
          >
            <Mail className="w-4 h-4 text-[#c9a227]" />
            <span>Contact Security Team</span>
          </a>
        </div>

        {/* Quick Nav Directory & Link Building Hub */}
        <div className="mt-10 pt-8 border-t border-[#2a241c] w-full max-w-3xl text-left">
          <div className="text-xs font-mono text-[#8a8070] uppercase tracking-wider mb-4 font-semibold text-center sm:text-left">
            Authorized Forensic Modules &amp; Compliance Hub
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono mb-6">
            <a
              href="/"
              className="p-2.5 rounded bg-[#181511] hover:bg-[#221e17] border border-[#2d2820] hover:border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8] transition-colors flex items-center gap-2 no-underline"
            >
              <Terminal className="w-3.5 h-3.5 text-[#c9a227] shrink-0" />
              <span className="truncate">Home / Console</span>
            </a>

            <a
              href="/security"
              className="p-2.5 rounded bg-[#181511] hover:bg-[#221e17] border border-[#2d2820] hover:border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8] transition-colors flex items-center gap-2 no-underline"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
              <span className="truncate">Security Architecture</span>
            </a>

            <a
              href="/domains"
              className="p-2.5 rounded bg-[#181511] hover:bg-[#221e17] border border-[#2d2820] hover:border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8] transition-colors flex items-center gap-2 no-underline"
            >
              <FileCode className="w-3.5 h-3.5 text-[#fbbf24] shrink-0" />
              <span className="truncate">Domain &amp; SPF Setup</span>
            </a>

            <a
              href="/llms.txt"
              className="p-2.5 rounded bg-[#181511] hover:bg-[#221e17] border border-[#2d2820] hover:border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8] transition-colors flex items-center gap-2 no-underline"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#4ade80] shrink-0" />
              <span className="truncate">llms.txt Standard</span>
            </a>

            <a
              href="/privacy"
              className="p-2.5 rounded bg-[#181511] hover:bg-[#221e17] border border-[#2d2820] hover:border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8] transition-colors flex items-center gap-2 no-underline"
            >
              <Lock className="w-3.5 h-3.5 text-[#4ade80] shrink-0" />
              <span className="truncate">Privacy Policy</span>
            </a>

            <a
              href="/terms"
              className="p-2.5 rounded bg-[#181511] hover:bg-[#221e17] border border-[#2d2820] hover:border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8] transition-colors flex items-center gap-2 no-underline"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#7fa3ba] shrink-0" />
              <span className="truncate">Terms of Service</span>
            </a>

            <a
              href="/cookies"
              className="p-2.5 rounded bg-[#181511] hover:bg-[#221e17] border border-[#2d2820] hover:border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8] transition-colors flex items-center gap-2 no-underline"
            >
              <Route className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />
              <span className="truncate">Cookie Compliance</span>
            </a>

            <a
              href="/contact"
              className="p-2.5 rounded bg-[#181511] hover:bg-[#221e17] border border-[#2d2820] hover:border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8] transition-colors flex items-center gap-2 no-underline"
            >
              <Globe className="w-3.5 h-3.5 text-[#ff8d7d] shrink-0" />
              <span className="truncate">Contact Support</span>
            </a>
          </div>

          {/* Authoritative Security Standards & Link Building References */}
          <div className="p-3 rounded bg-[#120f0c] border border-[#262018] text-[11px] font-mono text-[#8a8070] space-y-1">
            <span className="font-semibold text-[#b9af9c] uppercase block tracking-wider text-[10px]">Authoritative Standards &amp; External References:</span>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
              <a href="https://attack.mitre.org/" target="_blank" rel="noopener noreferrer" className="hover:text-[#ede6d8] flex items-center gap-1 text-[#b9af9c] no-underline">
                <span>MITRE ATT&amp;CK Framework</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <a href="https://csrc.nist.gov/publications/detail/sp/800-86/final" target="_blank" rel="noopener noreferrer" className="hover:text-[#ede6d8] flex items-center gap-1 text-[#b9af9c] no-underline">
                <span>NIST SP 800-86 Guide</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <a href="https://www.rfc-editor.org/rfc/rfc5322" target="_blank" rel="noopener noreferrer" className="hover:text-[#ede6d8] flex items-center gap-1 text-[#b9af9c] no-underline">
                <span>IETF RFC 5322 Format</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <a href="https://www.rfc-editor.org/rfc/rfc7208" target="_blank" rel="noopener noreferrer" className="hover:text-[#ede6d8] flex items-center gap-1 text-[#b9af9c] no-underline">
                <span>RFC 7208 SPF Standard</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#3a352c] bg-[#100e0c]/90 py-6 text-xs text-[#8a8070]">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <TraceXLogo size="xs" />
            <span>&copy; {currentYear} TraceXMail Forensic Intelligence Platform. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <a href="/about" className="text-[#8a8070] hover:text-[#ede6d8] transition-colors no-underline">About</a>
            <span>•</span>
            <a href="/knowledge" className="text-[#8a8070] hover:text-[#ede6d8] transition-colors no-underline">Knowledge Base</a>
            <span>•</span>
            <a href="/privacy" className="text-[#8a8070] hover:text-[#ede6d8] transition-colors no-underline">Privacy</a>
            <span>•</span>
            <a href="/terms" className="text-[#8a8070] hover:text-[#ede6d8] transition-colors no-underline">Terms</a>
            <span>•</span>
            <a href="/security" className="text-[#8a8070] hover:text-[#ede6d8] transition-colors no-underline">Security</a>
            <span>•</span>
            <a href="mailto:tracexmailofficial@gmail.com" className="text-[#e87063] hover:underline no-underline">tracexmailofficial@gmail.com</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
