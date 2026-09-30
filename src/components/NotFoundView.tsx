import React, { useEffect } from 'react';
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
  Route
} from 'lucide-react';
import { TraceXLogo } from './common/TraceXLogo';
import { updatePageMetadata, ROUTE_METADATA } from '../utils/seo';

interface NotFoundViewProps {
  pathname?: string;
  onNavigateHome?: () => void;
}

export function NotFoundView({ pathname = typeof window !== 'undefined' ? window.location.pathname : '', onNavigateHome }: NotFoundViewProps) {
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    updatePageMetadata(ROUTE_METADATA['404']);
  }, []);

  const handleGoHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
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

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full max-w-md">
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

        {/* Quick Nav Directory */}
        <div className="mt-12 pt-8 border-t border-[#2a241c] w-full max-w-2xl">
          <div className="text-xs font-mono text-[#8a8070] uppercase tracking-wider mb-4 font-semibold">
            Authorized Navigation Destinations
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
            <a
              href="/"
              className="p-2.5 rounded bg-[#181511] hover:bg-[#221e17] border border-[#2d2820] hover:border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8] transition-colors flex items-center gap-2 no-underline"
            >
              <Terminal className="w-3.5 h-3.5 text-[#c9a227] shrink-0" />
              <span className="truncate">Home / Console</span>
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
              href="/contact"
              className="p-2.5 rounded bg-[#181511] hover:bg-[#221e17] border border-[#2d2820] hover:border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8] transition-colors flex items-center gap-2 no-underline"
            >
              <Globe className="w-3.5 h-3.5 text-[#ff8d7d] shrink-0" />
              <span className="truncate">Contact Support</span>
            </a>
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
            <a href="/privacy" className="text-[#8a8070] hover:text-[#ede6d8] transition-colors no-underline">Privacy</a>
            <span>•</span>
            <a href="/terms" className="text-[#8a8070] hover:text-[#ede6d8] transition-colors no-underline">Terms</a>
            <span>•</span>
            <a href="/security" className="text-[#8a8070] hover:text-[#ede6d8] transition-colors no-underline">Security</a>
            <span>•</span>
            <a href="mailto:jayramsappa537@gmail.com" className="text-[#e87063] hover:underline no-underline">jayramsappa537@gmail.com</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
