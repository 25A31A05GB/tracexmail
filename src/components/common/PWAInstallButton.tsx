import React, { useState } from 'react';
import { Download, Check, X, Shield, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'compact' | 'full' | 'subtle';
}

export function PWAInstallButton({
  className = '',
  variant = 'compact'
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState<boolean>(false);
  const [installSuccess, setInstallSuccess] = useState<boolean>(false);

  // If already running in standalone mode, do not render
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    const success = await install();
    if (success) {
      setInstallSuccess(true);
      setTimeout(() => setInstallSuccess(false), 4000);
    }
  };

  if (isInstallable) {
    if (variant === 'full') {
      return (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 border border-amber-500/50 hover:border-amber-400 text-amber-300 rounded text-xs font-mono font-semibold transition-all cursor-pointer shadow-md active:scale-98 ${className}`}
          title="Install TraceXMail as a standalone desktop/mobile app"
        >
          {installSuccess ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Installed Successfully!</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4 text-amber-400" />
              <span>Install Offline SOC App</span>
            </>
          )}
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleInstallClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#1c1813] hover:bg-[#252019] border border-amber-500/40 hover:border-amber-400 text-amber-300 rounded text-[11px] font-mono transition-colors cursor-pointer ${className}`}
        title="Install TraceXMail PWA"
      >
        <Download className="w-3.5 h-3.5 text-amber-400" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#1c1813] hover:bg-[#252019] border border-[#383025] hover:border-amber-500/40 text-[#b9af9c] hover:text-[#ede6d8] rounded text-[11px] font-mono transition-colors cursor-pointer ${className}`}
          title="Install on iOS Home Screen"
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-400" />
          <span>Add to iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-xl bg-[#16130f] border border-[#383024] p-5 shadow-2xl text-[#ede6d8] space-y-4">
              <div className="flex items-center justify-between border-b border-[#2d271f] pb-3">
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>Install on iPhone / iPad</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded text-[#8a8070] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-[#b9af9c] space-y-2.5 leading-relaxed font-sans">
                <p>To install TraceXMail for offline forensics on your iOS device:</p>
                <ol className="list-decimal pl-4 space-y-1.5 font-mono text-[11px] text-[#ede6d8]">
                  <li>Tap the <strong>Share</strong> button in the Safari toolbar (square with upward arrow).</li>
                  <li>Scroll down and select <strong>Add to Home Screen</strong>.</li>
                  <li>Tap <strong>Add</strong> in the top-right corner.</li>
                </ol>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 bg-[#221e17] hover:bg-[#2c261e] border border-[#3a3225] text-xs font-mono font-semibold rounded text-[#ede6d8] cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
