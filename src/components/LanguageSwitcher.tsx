import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { SUPPORTED_LOCALES, changeAppLanguage } from '../i18n';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLang = i18n.language || 'en';
  const currentLocale = SUPPORTED_LOCALES.find((l) => l.code === currentLang) || SUPPORTED_LOCALES[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] bg-[#1a1712] hover:bg-[#252019] border border-[#3a352c] text-[#c9bfae] hover:text-[#ede6d8] text-xs font-mono transition-colors cursor-pointer"
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Switch Interface Language"
      >
        <Globe className="w-3.5 h-3.5 text-[#c9a227]" />
        <span className="hidden sm:inline font-sans">{currentLocale.label}</span>
        <span className="sm:hidden uppercase">{currentLocale.code}</span>
        <ChevronDown className="w-3 h-3 text-[#8a8070]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-48 rounded-[3px] bg-[#14120f] border border-[#3a352c] shadow-2xl z-50 py-1 font-mono text-xs animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#8a8070] border-b border-[#242019]">
            Select Language
          </div>
          {SUPPORTED_LOCALES.map((locale) => {
            const isSelected = locale.code === currentLang;
            return (
              <button
                key={locale.code}
                type="button"
                onClick={() => {
                  changeAppLanguage(locale.code);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#c9a227]/15 text-[#e0a82e] font-semibold'
                    : 'text-[#c9bfae] hover:bg-[#1f1b15] hover:text-[#ede6d8]'
                }`}
              >
                <span className="font-sans text-[12px]">{locale.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#e0a82e]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
