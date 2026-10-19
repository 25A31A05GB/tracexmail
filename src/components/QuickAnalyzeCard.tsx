import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  UploadCloud, 
  Loader2, 
  ArrowRight, 
  FileText, 
  Lock, 
  ExternalLink,
  Sparkles,
  Zap,
  CheckCircle2,
  X
} from 'lucide-react';
import { apiFetch } from '../lib/api';

interface QuickAnalyzeCardProps {
  onOpenDeepDossier: (analysis: any) => void;
}

export function QuickAnalyzeCard({ onOpenDeepDossier }: QuickAnalyzeCardProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsScanning(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const text = await file.text();
      const res = await apiFetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_email: text,
          file_name: file.name
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Forensic analysis failed.');
      }

      setResult(data.analysis || data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to scan email file.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleLoadSample = async (sampleName: string) => {
    setIsScanning(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await apiFetch(`/data/demo_emails/${sampleName}`);
      const rawText = await res.text();

      const analyzeRes = await apiFetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_email: rawText,
          file_name: sampleName
        })
      });

      const data = await analyzeRes.json();
      if (!analyzeRes.ok) {
        throw new Error(data.error || 'Forensic analysis failed.');
      }

      setResult(data.analysis || data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error loading demo sample.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="bg-[#14120f] border border-[#2e2a22] rounded-[4px] p-4 sm:p-5 shadow-xl text-[#ede6d8]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3 border-b border-[#242019] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[3px] bg-[#c9a227]/15 border border-[#c9a227]/30 flex items-center justify-center text-[#e0a82e]">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#ede6d8]">
              {t('quickAnalyze.title', 'Instant Email Forensic Scan')}
            </h3>
            <p className="text-[11px] text-[#9d9282] font-mono">
              {t('quickAnalyze.subtitle', 'Verify cryptographic alignment, URLs, and attachment safety in under 3 clicks')}
            </p>
          </div>
        </div>

        {result && (
          <button
            type="button"
            onClick={() => setResult(null)}
            className="p-1 rounded text-[#8a8070] hover:text-[#ede6d8] hover:bg-[#1f1b15] transition-colors"
            title="Scan another email"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 mb-3 bg-rose-950/40 border border-rose-800/60 rounded text-rose-300 text-xs flex items-center gap-2 font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Upload Drop Zone or Result View */}
      {!result ? (
        <div className="space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
            }}
            className={`border-2 border-dashed rounded-[3px] p-6 text-center transition-colors cursor-pointer ${
              isDragging
                ? 'border-[#c9a227] bg-[#c9a227]/10'
                : 'border-[#3a352c] hover:border-[#8a8070] bg-[#110f0c]'
            }`}
          >
            <input
              type="file"
              id="quick-analyze-file-input"
              accept=".eml,.msg,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
              }}
            />
            <label htmlFor="quick-analyze-file-input" className="cursor-pointer block">
              {isScanning ? (
                <div className="py-3 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 text-[#c9a227] animate-spin" />
                  <span className="text-xs font-mono text-[#c9bfae]">
                    {t('quickAnalyze.scanning', 'Running Forensic Pipeline...')}
                  </span>
                </div>
              ) : (
                <div className="py-2 flex flex-col items-center justify-center gap-2">
                  <UploadCloud className="w-7 h-7 text-[#c9a227]" />
                  <p className="text-xs font-medium text-[#ede6d8]">
                    {t('quickAnalyze.dropPrompt', 'Drag & drop your .eml or raw message here, or click to browse')}
                  </p>
                  <p className="text-[10px] font-mono text-[#8a8070]">
                    Safe-Handling Rule: Encrypted in memory, never executed
                  </p>
                </div>
              )}
            </label>
          </div>

          {/* 1-Click Demo Samples */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="text-[11px] text-[#8a8070]">Or test a live attack sample:</span>
            <button
              type="button"
              disabled={isScanning}
              onClick={() => handleLoadSample('bec_wire_fraud.eml')}
              className="px-2 py-1 bg-[#1a1712] hover:bg-[#252019] border border-[#3a352c] rounded text-[#c9bfae] text-[11px] transition-colors cursor-pointer"
            >
              BEC Wire Fraud
            </button>
            <button
              type="button"
              disabled={isScanning}
              onClick={() => handleLoadSample('quishing_qr.eml')}
              className="px-2 py-1 bg-[#1a1712] hover:bg-[#252019] border border-[#3a352c] rounded text-[#c9bfae] text-[11px] transition-colors cursor-pointer"
            >
              Quishing (QR Code)
            </button>
            <button
              type="button"
              disabled={isScanning}
              onClick={() => handleLoadSample('spoofed_dmarc_fail.eml')}
              className="px-2 py-1 bg-[#1a1712] hover:bg-[#252019] border border-[#3a352c] rounded text-[#c9bfae] text-[11px] transition-colors cursor-pointer"
            >
              DMARC Hard-Fail
            </button>
          </div>
        </div>
      ) : (
        /* 3-Click Verdict Card */
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#100e0b] border border-[#242019] rounded-[3px]">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-[3px] flex items-center justify-center shrink-0 ${
                result.threatScore >= 70
                  ? 'bg-rose-950/60 border border-rose-700/60 text-rose-400'
                  : result.threatScore >= 35
                  ? 'bg-amber-950/60 border border-amber-600/60 text-amber-400'
                  : 'bg-emerald-950/60 border border-emerald-600/60 text-emerald-400'
              }`}>
                {result.threatScore >= 70 ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : result.threatScore >= 35 ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <ShieldCheck className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-[#ede6d8]">
                    {result.threatVerdict || (result.threatScore >= 70 ? 'MALICIOUS' : result.threatScore >= 35 ? 'SUSPICIOUS' : 'CLEAN')}
                  </span>
                  <span className="font-mono text-xs text-[#c9a227]">
                    Score: {result.threatScore || 0}/100
                  </span>
                </div>
                <p className="text-[11px] text-[#9d9282] font-mono truncate max-w-sm sm:max-w-md">
                  Subject: {result.subject || result.title || '(No Subject)'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenDeepDossier(result)}
              className="py-1.5 px-3 bg-[#c9a227] hover:bg-[#d8b030] text-[#110f0c] font-semibold text-xs rounded-[2px] flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-center shrink-0"
            >
              <span>{t('quickAnalyze.viewDossier', 'Open Deep Forensic Dossier')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Clear Executive Explanation */}
          <div className="p-3 bg-[#181511] border border-[#2e2a22] rounded-[3px] text-xs text-[#c9bfae] leading-relaxed">
            <div className="font-semibold text-[#ede6d8] mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#c9a227]" />
              <span>SOC Analyst Assessment &amp; Rationale</span>
            </div>
            <p>
              {result.why?.executive_summary || result.description || 'Forensic envelope deconstruction completed across cryptographic authentication, relay geolocation, URL safety, and attachment inspection.'}
            </p>
          </div>

          {/* Recommended Action */}
          <div className="flex items-center justify-between text-xs p-2.5 bg-[#14110d] border border-[#242019] rounded-[3px] font-mono">
            <span className="text-[#8a8070]">Recommended Action:</span>
            <span className={`font-semibold ${
              result.threatScore >= 70 ? 'text-rose-400' : result.threatScore >= 35 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {result.threatScore >= 70
                ? 'Immediate Quarantine & Sender Domain Block'
                : result.threatScore >= 35
                ? 'Security Review & User Warning Banner'
                : 'Permit Message Delivery to Inbox'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuickAnalyzeCard;
