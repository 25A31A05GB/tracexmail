import React, { useState } from 'react';
import { X, Download, Copy, Check, Shield, FileCode, CheckCircle2 } from 'lucide-react';
import { EmailAnalysis } from '../types';
import { generateStix21Bundle, generateOpenIocXml } from '../utils/stixExport';

interface StixExportModalProps {
  analysis: EmailAnalysis;
  onClose: () => void;
}

export function StixExportModal({ analysis, onClose }: StixExportModalProps) {
  const [format, setFormat] = useState<'stix21' | 'openioc'>('stix21');
  const [copied, setCopied] = useState(false);

  const stixBundle = generateStix21Bundle(analysis);
  const openIocXml = generateOpenIocXml(analysis);

  const activeContent = format === 'stix21'
    ? JSON.stringify(stixBundle, null, 2)
    : openIocXml;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownload = () => {
    const filename = format === 'stix21'
      ? `TraceXMail-STIX2.1-${analysis.id || 'export'}.json`
      : `TraceXMail-OpenIOC-${analysis.id || 'export'}.xml`;
    const mimeType = format === 'stix21' ? 'application/json' : 'application/xml';

    const blob = new Blob([activeContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-[#14110D] border border-[#3A3228] rounded-xl max-w-3xl w-full p-6 text-xs text-[#EDE6DC] font-sans shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2B241E] pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#D3A039]/20 border border-[#D3A039]/50 flex items-center justify-center text-[#D3A039]">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#EDE6DC] font-mono uppercase tracking-wide flex items-center gap-2">
                <span>Threat Intel Exporter</span>
                <span className="px-2 py-0.5 rounded bg-[#D3A039]/20 text-[#D3A039] text-[10px] border border-[#D3A039]/40">
                  OASIS STIX 2.1 &amp; OpenIOC
                </span>
              </h3>
              <p className="text-[11px] text-[#9C9186]">
                Export standardized Indicators of Compromise (IOCs) formatted for SIEM/SOAR ingestion (Splunk, Sentinel, Cortex).
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

        {/* Format Selector Bar */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <button
              onClick={() => setFormat('stix21')}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                format === 'stix21'
                  ? 'bg-[#D3A039] text-black font-bold shadow-sm'
                  : 'bg-[#1D1712] text-[#9C9186] hover:text-[#EDE6DC] border border-[#2B241E]'
              }`}
            >
              OASIS STIX 2.1 (JSON Bundle)
            </button>
            <button
              onClick={() => setFormat('openioc')}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                format === 'openioc'
                  ? 'bg-[#D3A039] text-black font-bold shadow-sm'
                  : 'bg-[#1D1712] text-[#9C9186] hover:text-[#EDE6DC] border border-[#2B241E]'
              }`}
            >
              Mandiant OpenIOC (XML)
            </button>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded bg-[#1D1712] hover:bg-[#2B241E] border border-[#2B241E] text-[#EDE6DC] text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#D3A039]" />}
              <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded bg-[#D3A039] hover:bg-[#b8892d] text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {format === 'stix21' ? '.JSON' : '.XML'}</span>
            </button>
          </div>
        </div>

        {/* Code Content Preview */}
        <div className="flex-1 min-h-[300px] rounded bg-[#0E0B09] border border-[#2B241E] p-3 overflow-auto font-mono text-[11px] leading-relaxed text-[#EDE6DC] select-all">
          <pre>{activeContent}</pre>
        </div>
      </div>
    </div>
  );
}
