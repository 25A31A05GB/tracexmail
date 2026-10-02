import React, { useState } from 'react';
import { X, QrCode, ShieldAlert, AlertTriangle, CheckCircle2, Copy, Check, ExternalLink } from 'lucide-react';
import { EmailAnalysis } from '../types';
import { scanQuishingArtifacts, QuishingScanResult } from '../utils/quishingScanner';

interface QuishingInspectorModalProps {
  analysis?: EmailAnalysis | null;
  onClose: () => void;
}

export function QuishingInspectorModal({ analysis, onClose }: QuishingInspectorModalProps) {
  const result: QuishingScanResult = scanQuishingArtifacts(analysis);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-[#14110D] border border-[#3A3228] rounded-xl max-w-2xl w-full p-6 text-xs text-[#EDE6DC] font-sans shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2B241E] pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-amber-950/50 border border-amber-800/50 flex items-center justify-center text-amber-400">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#EDE6DC] font-mono uppercase tracking-wide flex items-center gap-2">
                <span>Quishing &amp; QR Phishing Optical Decoder</span>
                <span className={`px-2 py-0.5 rounded text-[10px] border ${
                  result.hasQrCode
                    ? 'bg-rose-950/60 text-rose-300 border-rose-800/50'
                    : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                }`}>
                  {result.hasQrCode ? `${result.detectedCount} QR Payload(s) Detected` : 'No QR Threats'}
                </span>
              </h3>
              <p className="text-[11px] text-[#9C9186]">
                Optical scanner extracting 2D matrix payloads from email image attachments &amp; inline HTML lures.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded bg-[#1D1712] text-[#9C9186] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3 overflow-y-auto flex-1 font-mono text-xs pr-1">
          <div className={`p-3 rounded-lg border ${
            result.hasQrCode ? 'bg-rose-950/30 border-rose-800/50 text-rose-200' : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
          }`}>
            <div className="flex items-center gap-2 font-bold mb-1 font-sans">
              {result.hasQrCode ? <ShieldAlert className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              <span>{result.hasQrCode ? 'Quishing Threat Detected' : 'Clean Optical Signature'}</span>
            </div>
            <p className="text-[11px] leading-relaxed font-sans">{result.summary}</p>
          </div>

          {result.qrPayloads.length > 0 ? (
            <div className="space-y-3 pt-2">
              <div className="text-[11px] text-[#9C9186] uppercase tracking-wider font-bold">
                Decoded Optical Redirect Payloads
              </div>
              {result.qrPayloads.map((qr, i) => (
                <div key={i} className="p-3.5 rounded-lg bg-[#0E0B09] border border-[#2B241E] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-700">
                      RISK: {qr.riskLevel}
                    </span>
                    <button
                      onClick={() => handleCopy(qr.decodedUrl)}
                      className="text-[#D3A039] hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      {copiedUrl === qr.decodedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedUrl === qr.decodedUrl ? 'Copied' : 'Copy Payload'}</span>
                    </button>
                  </div>

                  <div className="p-2 rounded bg-[#17130F] border border-[#2B241E] break-all font-mono text-xs text-[#EDE6DC]">
                    <span className="text-[#9C9186] text-[10px] block">Defanged Target URL:</span>
                    <b className="text-rose-400">{qr.defangedUrl}</b>
                  </div>

                  <p className="text-[11px] text-[#9C9186] font-sans">
                    {qr.suspiciousReason}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-[#9C9186] border border-[#2B241E] rounded-lg bg-[#0E0B09] font-sans">
              <QrCode className="w-8 h-8 text-[#9C9186]/40 mx-auto mb-2" />
              <p className="font-semibold text-xs text-[#EDE6DC]">Zero Quishing Indicators Found</p>
              <p className="text-[11px] text-[#9C9186] mt-1">
                Inbound message has no optical QR barcodes or evasive QR call-to-actions targeting mobile devices.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#2B241E] pt-3 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#D3A039] hover:bg-[#b8892d] text-black font-bold font-mono text-xs cursor-pointer"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
}
