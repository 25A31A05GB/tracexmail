import React from 'react';
import { Lock } from 'lucide-react';

interface LockedGateProps {
  onSignIn: () => void;
  onRequestAccess?: () => void;
}

export function LockedGate({ onSignIn, onRequestAccess }: LockedGateProps) {
  return (
    <div className="relative min-h-screen w-screen bg-[#0b0d12] text-[#e7ebf1] overflow-hidden select-none font-sans">
      {/* Blurred background mockup shell - strictly static and non-interactive */}
      <div 
        className="pointer-events-none select-none filter blur-[7px] brightness-50 saturate-60 scale-[1.02] flex min-h-screen w-full"
        aria-hidden="true"
      >
        {/* Mock Static Sidebar */}
        <aside className="w-52 bg-[#0d0f15] border-r border-[#232833] p-5 flex flex-col shrink-0">
          <div className="flex items-center gap-2 mb-6 px-1">
            <div className="w-4.5 h-4.5 rounded-full border-[1.5px] border-[#c25a4a] relative">
              <div className="absolute inset-1 rounded-full bg-[#c25a4a]" />
            </div>
            <span className="font-serif font-semibold text-[15px] text-[#e7ebf1]">TraceXMail</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-[#171b24] text-[#e7ebf1] text-[13.5px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5b8dd6]" />
              Dashboard
            </div>
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[#7d8794] text-[13.5px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4f5763]" />
              Cases
            </div>
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[#7d8794] text-[13.5px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4f5763]" />
              Campaigns
            </div>
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[#7d8794] text-[13.5px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4f5763]" />
              Alerts
            </div>
          </div>
        </aside>

        {/* Mock Static Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0b0d12]">
          <div className="h-14 border-b border-[#232833] flex items-center justify-between px-6">
            <span className="text-[15px] font-semibold text-[#e7ebf1]">Dashboard</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10.5px] px-2 py-0.5 rounded bg-[#232833] text-[#7d8794]">CLEARANCE REQUIRED</span>
              <div className="w-7 h-7 rounded-full bg-[#171b24]" />
            </div>
          </div>
          <div className="p-7 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="bg-[#12151c] border border-[#232833] rounded-lg p-4">
                <div className="text-[10.5px] text-[#4f5763] uppercase tracking-wider font-mono">Open Cases</div>
                <div className="font-mono text-2xl text-[#e7ebf1] mt-1">14</div>
              </div>
              <div className="bg-[#12151c] border border-[#232833] rounded-lg p-4">
                <div className="text-[10.5px] text-[#4f5763] uppercase tracking-wider font-mono">Threat Clusters</div>
                <div className="font-mono text-2xl text-[#e7ebf1] mt-1">3</div>
              </div>
              <div className="bg-[#12151c] border border-[#232833] rounded-lg p-4">
                <div className="text-[10.5px] text-[#4f5763] uppercase tracking-wider font-mono">Avg. Threat Score</div>
                <div className="font-mono text-2xl text-[#5b8dd6] mt-1">71</div>
              </div>
            </div>
            <div className="bg-[#12151c] border border-[#232833] rounded-lg overflow-hidden">
              <div className="grid grid-cols-5 gap-3.5 p-3.5 border-b border-[#232833] text-[10.5px] font-mono text-[#4f5763] uppercase">
                <div>Case</div>
                <div>Subject</div>
                <div>Severity</div>
                <div>Score</div>
                <div>Action</div>
              </div>
              <div className="grid grid-cols-5 gap-3.5 p-3.5 border-b border-[#1a1e27] text-xs text-[#7d8794]">
                <div className="font-mono text-[#5b8dd6]">CASE-2291</div>
                <div>Urgent: Updated Direct Deposit Routing</div>
                <div><span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#c25a4a]/20 text-[#c25a4a]">CRITICAL</span></div>
                <div>94</div>
                <div className="text-[#4f5763]">Restricted</div>
              </div>
              <div className="grid grid-cols-5 gap-3.5 p-3.5 text-xs text-[#7d8794]">
                <div className="font-mono text-[#5b8dd6]">CASE-2288</div>
                <div>Action Required: Verify Office 365 Password</div>
                <div><span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#c9a227]/20 text-[#c9a227]">HIGH</span></div>
                <div>86</div>
                <div className="text-[#4f5763]">Restricted</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Centered Locked Overlay Card */}
      <div className="absolute inset-0 flex items-center justify-center bg-[#05060a]/65 p-4 z-50">
        <div className="bg-[#12151c] border border-[#232833] rounded-xl p-9 md:p-11 max-w-[420px] w-full text-center shadow-[0_40px_90px_rgba(0,0,0,0.7)] backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          {/* Custom Lock Icon matching design */}
          <div className="w-12 h-12 mx-auto mb-5 relative flex items-center justify-center">
            <div className="w-10 h-8 bg-[#c25a4a] rounded-md absolute bottom-0 flex items-center justify-center shadow-lg shadow-[#c25a4a]/20">
              <div className="w-1.5 h-2.5 bg-[#0b0d12] rounded-full" />
            </div>
            <div className="w-6 h-6 border-4 border-[#c25a4a] border-b-0 rounded-t-full absolute top-0" />
          </div>

          {/* Stamp */}
          <div className="inline-block font-mono text-[11px] font-semibold text-[#c25a4a] border-[1.5px] border-[#c25a4a] rounded px-2.5 py-0.5 mb-5 rotate-[-3deg] tracking-wider">
            ACCESS: DENIED
          </div>

          {/* Headline */}
          <h2 className="font-serif font-semibold text-xl md:text-[22px] text-[#e7ebf1] mb-2.5 tracking-tight">
            This workspace is restricted
          </h2>

          {/* Body */}
          <p className="text-[#7d8794] text-[13.5px] leading-relaxed mb-6 font-normal">
            No preview, no cached data, no guest access. Every case, evidence file, and report requires a signed-in, authorized account — there&apos;s no partial view for anyone who isn&apos;t.
          </p>

          {/* Primary Action Button */}
          <button
            onClick={onSignIn}
            className="w-full bg-[#5b8dd6] hover:bg-[#6f9ade] active:bg-[#4d7ec6] text-[#0b0d12] font-semibold py-3 px-5 rounded-lg text-sm transition-all shadow-md hover:shadow-lg hover:shadow-[#5b8dd6]/20 cursor-pointer"
          >
            Sign in to continue
          </button>

          {onRequestAccess && (
            <button
              onClick={onRequestAccess}
              className="w-full mt-3 bg-transparent hover:bg-[#171b24] text-[#7d8794] hover:text-[#e7ebf1] border border-[#232833] py-2.5 px-4 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              Request access for your organization
            </button>
          )}

          <div className="mt-5 text-[11px] font-mono text-[#4f5763]">
            MIL-STD / NIST 800-86 RESTRICTED ENCLAVE
          </div>
        </div>
      </div>
    </div>
  );
}
