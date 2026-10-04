import React, { useState } from 'react';
import { ShieldCheck, ExternalLink, CheckCircle2, FileText, Video, AlertTriangle, Copy, Check, Lock, Globe, Mail, ChevronRight, X } from 'lucide-react';

export interface GoogleVerificationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  appUrl?: string;
}

export function GoogleVerificationGuideModal({
  isOpen,
  onClose,
  userEmail = 'jayramsappa537@gmail.com',
  appUrl = window.location.origin
}: GoogleVerificationGuideModalProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const justificationReadonly = "TraceXMail requires read-only access to inbound email headers (RFC-822) and body structures to perform real-time forensic phishing detection, domain authentication checks (SPF/DKIM/DMARC), and origin IP geolocation.";
  const justificationModify = "TraceXMail requires modify permission to apply the 'TraceXMail-Quarantine' system label to suspicious messages and attach automated SOC incident reports directly inside the email thread for administrative triage.";

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#12100d] border border-[#383126] max-w-3xl w-full max-h-[90vh] rounded-2xl shadow-2xl flex flex-col text-[#ede6d8] font-sans overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-[#2b251e] bg-[#181410] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-display text-white flex items-center gap-2">
                <span>Google OAuth Verification Guide</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                  Remove "Unverified App" Warning
                </span>
              </h2>
              <p className="text-xs text-[#a89d8d] mt-0.5">
                Official step-by-step submission guide for Google Cloud Trust &amp; Safety Review
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#221c17] hover:bg-[#2e2620] text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-[#c6d7e8] leading-relaxed">
          
          {/* Quick Notice Banner */}
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-amber-300 text-xs">Immediate Workaround while waiting for verification:</div>
              <p className="text-[11.5px] text-amber-200/90 leading-relaxed">
                You can instantly bypass the "Unverified App" warning for your team by adding their email addresses as <b>Test Users</b> in Google Cloud Console (&rarr; OAuth Consent Screen &rarr; Test Users &rarr; Add <code className="text-amber-300 font-mono">{userEmail}</code>).
              </p>
            </div>
          </div>

          {/* STEP 1 */}
          <div className="space-y-3 p-4 bg-[#181410] border border-[#2e271f] rounded-xl">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center font-mono text-xs">1</span>
              <span>Configure Google Cloud OAuth Consent Screen</span>
            </div>
            <p>
              Navigate to the <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline font-semibold inline-flex items-center gap-1">Google Cloud Console &rarr; OAuth Consent Screen <ExternalLink className="w-3 h-3" /></a> and complete the following fields:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px] bg-[#0f0d0a] p-3 rounded-lg border border-[#221c17]">
              <div><span className="text-[#8a8070]">User Type:</span> <strong className="text-emerald-400">External</strong></div>
              <div><span className="text-[#8a8070]">App Name:</span> <strong className="text-white">TraceXMail SOC</strong></div>
              <div><span className="text-[#8a8070]">Support Email:</span> <strong className="text-amber-300">{userEmail}</strong></div>
              <div><span className="text-[#8a8070]">App Domain:</span> <strong className="text-cyan-300">{appUrl}</strong></div>
            </div>
          </div>

          {/* STEP 2 */}
          <div className="space-y-3 p-4 bg-[#181410] border border-[#2e271f] rounded-xl">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center font-mono text-xs">2</span>
              <span>Add Requested Scopes &amp; Provide Justifications</span>
            </div>
            <p>
              Under the <b>Scopes</b> tab, add the following scopes and copy the pre-written justifications required by Google reviewers:
            </p>
            
            <div className="space-y-2.5 font-mono text-[11px]">
              {/* Scope 1 */}
              <div className="p-3 bg-[#0f0d0a] rounded-lg border border-[#221c17] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-rose-300 font-bold">https://www.googleapis.com/auth/gmail.readonly</span>
                  <button
                    onClick={() => copyToClipboard(justificationReadonly, 1)}
                    className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedIndex === 1 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedIndex === 1 ? 'Copied Justification' : 'Copy Justification'}</span>
                  </button>
                </div>
                <p className="text-slate-300 font-sans text-[11px] leading-relaxed italic">{justificationReadonly}</p>
              </div>

              {/* Scope 2 */}
              <div className="p-3 bg-[#0f0d0a] rounded-lg border border-[#221c17] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-rose-300 font-bold">https://www.googleapis.com/auth/gmail.modify</span>
                  <button
                    onClick={() => copyToClipboard(justificationModify, 2)}
                    className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedIndex === 2 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedIndex === 2 ? 'Copied Justification' : 'Copy Justification'}</span>
                  </button>
                </div>
                <p className="text-slate-300 font-sans text-[11px] leading-relaxed italic">{justificationModify}</p>
              </div>
            </div>
          </div>

          {/* STEP 3 */}
          <div className="space-y-3 p-4 bg-[#181410] border border-[#2e271f] rounded-xl">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center font-mono text-xs">3</span>
              <span>Required Verification Documents &amp; Demo Video</span>
            </div>
            <ul className="space-y-2 text-[11.5px] list-disc list-inside">
              <li>
                <b>Privacy Policy &amp; Terms of Service Links:</b> Hosted on your public HTTPS domain clearly disclosing how Google user data is protected and not sold.
              </li>
              <li>
                <b>YouTube Demo Video (Mandatory):</b> Create an unlisted 1-2 minute YouTube video showing:
                <ol className="list-decimal list-inside ml-4 mt-1 space-y-0.5 text-[#a89d8d]">
                  <li>The OAuth client ID clearly visible in the browser address bar.</li>
                  <li>Clicking "Sign in with Google" / "Connect Gmail Account".</li>
                  <li>How TraceXMail displays the forensic headers and quarantines suspicious emails.</li>
                </ol>
              </li>
            </ul>
          </div>

          {/* STEP 4 */}
          <div className="space-y-3 p-4 bg-[#181410] border border-[#2e271f] rounded-xl">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center font-mono text-xs">4</span>
              <span>Submit for Verification</span>
            </div>
            <p>
              Click <b>Submit for Verification</b> at the bottom of the Google Cloud Console page. Google's Trust &amp; Safety team typically reviews and verifies the application within <b>3 to 7 business days</b>, completely removing the "Unverified App" warning for all users.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2b251e] bg-[#181410] flex items-center justify-between shrink-0">
          <a
            href="https://console.cloud.google.com/apis/credentials/consent"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <span>Open Google Cloud Console</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#221c17] hover:bg-[#2e2620] text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close Guide
          </button>
        </div>

      </div>
    </div>
  );
}
