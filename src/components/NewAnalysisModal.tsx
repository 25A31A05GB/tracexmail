import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Server, 
  ArrowRight, 
  AlertCircle,
  Cpu
} from 'lucide-react';
import { EmailAnalysis } from '../types';
import { SAMPLE_ANALYSES } from '../data/samples';
import { parseRawEml, mapBackendCaseToAnalysis } from '../utils/parser';
import { apiFetch } from '../lib/api';
import { ForensicScanAnimationModal } from './ForensicScanAnimationModal';

interface NewAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalysisCreated: (analysis: EmailAnalysis) => void;
}

export function NewAnalysisModal({
  isOpen,
  onClose,
  onAnalysisCreated,
}: NewAnalysisModalProps) {
  const [tab, setTab] = useState<'paste' | 'upload' | 'preset'>('paste');
  const [pastedRaw, setPastedRaw] = useState<string>('');
  const [fileName, setFileName] = useState<string>('custom_submission.eml');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<EmailAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingAnalysisRef = useRef<EmailAnalysis | null>(null);
  const scanAnimationFinishedRef = useRef<boolean>(false);

  if (!isOpen) return null;

  const executePipelineWithAnimation = async (rawContent: string, name: string) => {
    setError(null);
    setFileName(name);
    setIsScanning(true);

    try {
      let parsedResult: EmailAnalysis | null = null;
      try {
        const formData = new FormData();
        formData.append('raw_email', rawContent);
        formData.append('filename', name);
        formData.append('source', 'user_submission');

        const res = await apiFetch('/api/v1/analyze', {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          const apiData = await res.json();
          parsedResult = mapBackendCaseToAnalysis(apiData, rawContent, name);
        }
      } catch (err) {
        console.warn('[NewAnalysisModal] Backend analysis fallback:', err);
      }

      if (!parsedResult) {
        parsedResult = parseRawEml(rawContent, name);
      }

      pendingAnalysisRef.current = parsedResult;
      setPendingAnalysis(parsedResult);

      if (scanAnimationFinishedRef.current && parsedResult) {
        onAnalysisCreated(parsedResult);
        setIsScanning(false);
        setPendingAnalysis(null);
        pendingAnalysisRef.current = null;
        scanAnimationFinishedRef.current = false;
        onClose();
      }
    } catch (err: any) {
      console.error('[NewAnalysisModal] Parsing error:', err);
      setError(err?.message || 'Forensic analysis encountered an unexpected error.');
      setIsScanning(false);
    }
  };

  const handleScanAnimationComplete = () => {
    const target = pendingAnalysisRef.current || pendingAnalysis;
    if (target) {
      onAnalysisCreated(target);
      setIsScanning(false);
      setPendingAnalysis(null);
      pendingAnalysisRef.current = null;
      scanAnimationFinishedRef.current = false;
      onClose();
    } else {
      scanAnimationFinishedRef.current = true;
    }
  };

  const handleProcessRaw = () => {
    if (!pastedRaw.trim()) {
      setError('Please paste raw email headers or RFC822 message text');
      return;
    }
    executePipelineWithAnimation(pastedRaw, fileName);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      executePipelineWithAnimation(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleDropFiles = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []) as File[];
    if (files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      executePipelineWithAnimation(content, file.name);
    };
    reader.readAsText(file);
  };

  return (
    <>
      {isScanning && (
        <ForensicScanAnimationModal
          isOpen={isScanning}
          filename={fileName}
          rawSnippet={pastedRaw}
          onComplete={handleScanAnimationComplete}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
        <div className="bg-[#1a1712] border border-[#3a352c] w-full max-w-2xl rounded-sm shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh] font-sans">
          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-[#3a352c] flex items-center justify-between bg-[#14120f]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border-[1.5px] border-[var(--thread)] relative shrink-0 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--thread)]" />
              </div>
              <div>
                <h3 className="text-base font-display font-bold text-[var(--paper)]">
                  Ingest Email for Forensic Inspection
                </h3>
                <p className="text-xs text-[var(--paper-dim)] font-sans">
                  Supports RFC822 (.eml, .msg, .txt), raw headers, and threat simulations
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-[var(--paper-dim)] hover:text-[var(--paper)] p-1 rounded-sm hover:bg-[#221e17] cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Modal Tab Switcher */}
            <div className="flex border-b border-[#3a352c] bg-[#14120f] px-5 pt-3 gap-2">
              <button
                onClick={() => setTab('paste')}
                className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  tab === 'paste'
                    ? 'border-[var(--thread)] text-[var(--paper)]'
                    : 'border-transparent text-[var(--paper-dim)] hover:text-[var(--paper)]'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-[var(--thread)]" />
                <span>Paste Headers / Raw EML</span>
              </button>
              <button
                onClick={() => setTab('upload')}
                className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  tab === 'upload'
                    ? 'border-[var(--thread)] text-[var(--paper)]'
                    : 'border-transparent text-[var(--paper-dim)] hover:text-[var(--paper)]'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-[var(--slate)]" />
                <span>Upload .EML File</span>
              </button>
              <button
                onClick={() => setTab('preset')}
                className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  tab === 'preset'
                    ? 'border-[var(--thread)] text-[var(--paper)]'
                    : 'border-transparent text-[var(--paper-dim)] hover:text-[var(--paper)]'
                }`}
              >
                <Server className="w-3.5 h-3.5 text-[var(--stamp)]" />
                <span>Threat Presets</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {error && (
                <div className="p-3 bg-rose-950/40 border border-rose-500/50 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {tab === 'paste' && (
                <div className="space-y-3">
                  <label className="text-xs text-slate-300 font-semibold block">
                    Paste RFC822 Raw Headers or Full MIME stream:
                  </label>
                  <textarea
                    value={pastedRaw}
                    onChange={(e) => setPastedRaw(e.target.value)}
                    placeholder="Delivered-To: victim@domain.com&#10;Received: from mail.attacker-server.com (185.220.101.5) by mx.google.com&#10;Authentication-Results: mx.google.com; spf=fail; dkim=fail; dmarc=reject&#10;From: 'PayPal Support' <service@paypal.com>&#10;Subject: [URGENT] Account Action Required&#10;..."
                    rows={10}
                    className="w-full bg-[#14120f] border border-[#3a352c] rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#b23a2e] placeholder:text-slate-600 resize-none"
                  ></textarea>
                </div>
              )}

              {tab === 'upload' && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDropFiles}
                  className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3 transition-colors ${
                    isDragging
                      ? 'border-blue-400 bg-blue-950/30'
                      : 'border-[#3a352c] hover:border-[#b23a2e]/70 bg-[#14120f]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".eml,.txt,.msg"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      Click to select or drag &amp; drop single or multiple .EML files
                    </p>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      Batch ingestion mode supported — select multiple files to analyze simultaneously
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-md shadow-blue-600/20"
                  >
                    Select Email Files (Batch Upload)
                  </button>
                </div>
              )}

              {tab === 'preset' && (
                <div className="space-y-2.5">
                  <div className="text-xs text-slate-400 uppercase font-semibold">
                    Select from Analyzed Threat Intelligence Corpora:
                  </div>
                  {SAMPLE_ANALYSES.map((sample) => (
                    <div
                      key={sample.id}
                      onClick={async () => {
                        try {
                          const rawContent = sample.rawHeaders || `From: ${sample.headers.from}\nTo: ${sample.headers.to}\nSubject: ${sample.headers.subject}\nDate: ${sample.headers.date}\nMessage-ID: ${sample.headers.messageId}\n\n${sample.name}`;
                          const formData = new FormData();
                          formData.append('raw_email', rawContent);
                          formData.append('filename', `${sample.id}.eml`);
                          formData.append('source', 'threat_intelligence_preset');
                          apiFetch('/api/v1/analyze', { method: 'POST', body: formData }).catch(console.warn);
                        } catch (e) {
                          console.warn('Preset ingestion error:', e);
                        }
                        onAnalysisCreated(sample);
                        onClose();
                      }}
                      className="p-3.5 bg-slate-900/70 hover:bg-slate-800 border border-slate-700/80 rounded-lg cursor-pointer transition-all flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-slate-200">{sample.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono truncate max-w-md">
                          {sample.headers.subject}
                        </div>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono ${
                          sample.verdict === 'MALICIOUS PHISH'
                            ? 'bg-rose-600 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {sample.verdict}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {tab === 'paste' && (
              <div className="p-4 border-t border-[#3a352c] bg-[#14120f] flex items-center justify-between">
                <span className="text-[11.5px] text-[var(--paper-muted)] font-sans">
                  Auto-extracts Hops, SPF/DKIM/DMARC &amp; URLs
                </span>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={onClose}
                    className="px-3.5 py-1.5 rounded-sm text-xs font-medium text-[var(--paper-dim)] hover:text-[var(--paper)] hover:bg-[#221e17] cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleProcessRaw}
                    className="btn-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer py-1.5 px-4"
                  >
                    <span>Execute Forensics</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
