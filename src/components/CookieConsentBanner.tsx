import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Cookie as CookieIcon, 
  ShieldCheck, 
  Lock, 
  Sliders, 
  Check, 
  X, 
  ExternalLink,
  ChevronRight,
  Database,
  Sparkles
} from 'lucide-react';

export interface CookiePreferences {
  essential: boolean; // Always true
  preferences: boolean; // UI layout, Persona, View mode
  analytics: boolean; // Always false / zero-telemetry
  acknowledgedAt: string;
}

const STORAGE_KEY = 'tracexmail_cookie_consent';

export function CookieConsentBanner({
  onNavigateToLegal
}: {
  onNavigateToLegal?: (type: 'privacy' | 'terms' | 'cookies') => void;
}) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState<boolean>(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    preferences: true,
    analytics: false,
    acknowledgedAt: ''
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        // Show after a brief delay so page loads smoothly
        const timer = setTimeout(() => setIsOpen(true), 1200);
        return () => clearTimeout(timer);
      } else {
        const parsed = JSON.parse(saved);
        setPreferences(parsed);
      }
    } catch {
      // Fallback
    }
  }, []);

  const savePreferences = (prefs: CookiePreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      setPreferences(prefs);
      setIsOpen(false);
      setIsCustomizeOpen(false);
    } catch {}
  };

  const handleAcceptAll = () => {
    savePreferences({
      essential: true,
      preferences: true,
      analytics: false,
      acknowledgedAt: new Date().toISOString()
    });
  };

  const handleAcceptEssentialOnly = () => {
    savePreferences({
      essential: true,
      preferences: false,
      analytics: false,
      acknowledgedAt: new Date().toISOString()
    });
  };

  const handleSaveCustom = () => {
    savePreferences({
      ...preferences,
      acknowledgedAt: new Date().toISOString()
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 260 }}
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-xl z-50 print:hidden"
        role="region"
        aria-label="Cookie & Privacy Consent"
      >
        <div className="bg-[#16130f]/95 backdrop-blur-xl border border-[#383024] rounded-xl shadow-2xl p-4 sm:p-5 text-[#ede6d8] space-y-3.5 relative overflow-hidden">
          {/* Subtle Cyber Accent Top Bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500/80 via-emerald-500/80 to-amber-500/80" />

          {/* Header Row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <CookieIcon className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold tracking-tight text-white font-['Fraunces',serif]">
                    Privacy &amp; Local Storage Transparency
                  </h3>
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-emerald-950/60 border border-emerald-700 text-emerald-300 font-bold">
                    Zero Trackers
                  </span>
                </div>
                <p className="text-[11px] font-mono text-[#8a8070]">
                  GDPR &bull; CCPA &bull; Google Limited Use Compliant
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="text-[#8a8070] hover:text-[#ede6d8] p-1 transition-colors cursor-pointer rounded"
              aria-label="Close cookie banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Description */}
          <p className="text-xs text-[#b9af9c] leading-relaxed">
            TraceXMail uses strictly essential client-side storage for secure session tokens, cryptographic PII masking preferences, and UI themes. We <strong className="text-white">never</strong> sell your data, use tracking cookies, or train public AI models on your emails.
          </p>

          {/* Granular Customization Drawer */}
          {isCustomizeOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="pt-2 pb-1 space-y-2.5 border-t border-[#2a241b]"
            >
              <div className="text-xs font-mono font-semibold text-white uppercase tracking-wider flex items-center justify-between">
                <span>Manage Storage Preferences</span>
                <span className="text-[10px] text-[#8a8070] font-normal">Stored Locally</span>
              </div>

              {/* 1. Essential Authentication */}
              <div className="p-2.5 rounded-lg bg-[#110f0c] border border-[#262118] flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Essential Authentication &amp; Security</span>
                    <span className="text-[9px] font-mono bg-emerald-950 border border-emerald-800 text-emerald-400 px-1 rounded">Required</span>
                  </div>
                  <p className="text-[11px] text-[#8a8070]">
                    Supabase JWT sessions, encrypted RBAC tokens, and CSRF protection.
                  </p>
                </div>
                <div className="shrink-0 font-mono text-xs text-emerald-400 font-bold">
                  Active
                </div>
              </div>

              {/* 2. Workspace & PII Masking Preferences */}
              <div className="p-2.5 rounded-lg bg-[#110f0c] border border-[#262118] flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    <span>UI Preferences &amp; PII Redaction Mode</span>
                  </div>
                  <p className="text-[11px] text-[#8a8070]">
                    Preserves analyst view density, theme, and automated forensic PII masking.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.preferences}
                  onChange={(e) => setPreferences({ ...preferences, preferences: e.target.checked })}
                  className="w-4 h-4 rounded border-[#383025] bg-[#1a1612] text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
              </div>

              {/* 3. Third-Party Analytics & Marketing (Disabled by Default) */}
              <div className="p-2.5 rounded-lg bg-[#110f0c] border border-[#262118] flex items-center justify-between gap-3 opacity-70">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#b9af9c]">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                    <span>Third-Party Trackers &amp; Marketing</span>
                    <span className="text-[9px] font-mono bg-[#1c1813] border border-[#332b20] text-[#8a8070] px-1 rounded">None Installed</span>
                  </div>
                  <p className="text-[11px] text-[#8a8070]">
                    TraceXMail employs zero advertising scripts, pixels, or profiling brokers.
                  </p>
                </div>
                <div className="shrink-0 font-mono text-xs text-[#8a8070]">
                  Off
                </div>
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <a
                href="/privacy"
                onClick={(e) => {
                  if (onNavigateToLegal) {
                    e.preventDefault();
                    onNavigateToLegal('privacy');
                  }
                }}
                className="text-[11px] font-mono text-[#8a8070] hover:text-amber-400 underline transition-colors"
              >
                Privacy Policy
              </a>
              <span className="text-[#3a3225]">&bull;</span>
              <a
                href="/cookies"
                onClick={(e) => {
                  if (onNavigateToLegal) {
                    e.preventDefault();
                    onNavigateToLegal('cookies');
                  }
                }}
                className="text-[11px] font-mono text-[#8a8070] hover:text-amber-400 underline transition-colors"
              >
                Cookie Details
              </a>
              <span className="text-[#3a3225]">&bull;</span>
              <a
                href="/terms"
                onClick={(e) => {
                  if (onNavigateToLegal) {
                    e.preventDefault();
                    onNavigateToLegal('terms');
                  }
                }}
                className="text-[11px] font-mono text-[#8a8070] hover:text-amber-400 underline transition-colors"
              >
                Terms
              </a>
            </div>

            <div className="flex items-center gap-2">
              {!isCustomizeOpen ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsCustomizeOpen(true)}
                    className="px-2.5 py-1.5 bg-[#1f1a14] hover:bg-[#28221a] text-xs font-mono text-[#b9af9c] hover:text-[#ede6d8] rounded border border-[#383025] transition-colors cursor-pointer"
                  >
                    Customize
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptEssentialOnly}
                    className="px-2.5 py-1.5 bg-[#1f1a14] hover:bg-[#28221a] text-xs font-mono text-[#b9af9c] hover:text-[#ede6d8] rounded border border-[#383025] transition-colors cursor-pointer"
                  >
                    Essential Only
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptAll}
                    className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-mono font-bold rounded transition-colors cursor-pointer shadow-md"
                  >
                    Accept All
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsCustomizeOpen(false)}
                    className="px-2.5 py-1.5 bg-[#1f1a14] hover:bg-[#28221a] text-xs font-mono text-[#b9af9c] rounded border border-[#383025] cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCustom}
                    className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-mono font-bold rounded transition-colors cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Choices</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
