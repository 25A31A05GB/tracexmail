import React, { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { 
  Database, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Layers, 
  ShieldCheck, 
  Cpu, 
  Lock, 
  Activity,
  Sparkles
} from 'lucide-react';
import { EmailAnalysis } from '../types';
import { SAMPLE_ANALYSES } from '../data/samples';
import { parseRawEml, mapBackendCaseToAnalysis } from '../utils/parser';
import { apiFetch } from '../lib/api';
import { ForensicScanAnimationModal } from './ForensicScanAnimationModal';

interface IngestionPipelineViewProps {
  onSelectAnalysis: (analysis: EmailAnalysis) => void;
  onNavigateToOverview: () => void;
}

export function IngestionPipelineView({
  onSelectAnalysis,
  onNavigateToOverview
}: IngestionPipelineViewProps) {
  const [activeTab, setActiveTab] = useState<'paste' | 'upload' | 'batch'>('paste');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('raw_email.eml');
  const [isScanning, setIsScanning] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<EmailAnalysis | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const executePipelineWithAnimation = async (content: string, name: string) => {
    if (!content.trim()) {
      setError('Please provide valid raw RFC822 email content or headers.');
      return;
    }
    setError(null);
    setFileName(name);
    setIsScanning(true);

    try {
      let backendResult: any = null;
      try {
        const formData = new FormData();
        formData.append('raw_email', content);
        formData.append('filename', name);
        formData.append('source', 'email_upload');

        const res = await apiFetch('/api/v1/analyze', {
          method: 'POST',
          body: formData
        });
        if (res.ok) {
          backendResult = await res.json();
        }
      } catch (err) {
        console.warn('[IngestionPipeline] Backend direct call fallback:', err);
      }

      let finalAnalysis: EmailAnalysis;
      if (backendResult?.analysis || backendResult?.case) {
        finalAnalysis = mapBackendCaseToAnalysis(backendResult.analysis || backendResult, content, name);
      } else {
        finalAnalysis = parseRawEml(content, name);
      }

      setPendingAnalysis(finalAnalysis);
    } catch (err: any) {
      console.error('[IngestionPipeline] Error processing email:', err);
      setError(err.message || 'Error processing email file');
      setIsScanning(false);
    }
  };

  const handleScanAnimationComplete = () => {
    if (pendingAnalysis) {
      onSelectAnalysis(pendingAnalysis);
      onNavigateToOverview();
    }
    setIsScanning(false);
    setPendingAnalysis(null);
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

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
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
          rawSnippet={rawText}
          onComplete={handleScanAnimationComplete}
        />
      )}

      <div className="flex-1 flex flex-col h-full bg-[var(--ink)] overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Top Banner */}
        <div className="bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-5 sm:p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full border-[1.5px] border-[var(--thread)] flex items-center justify-center bg-[rgba(178,58,46,0.1)]">
              <Database className="w-5 h-5 text-[var(--thread)]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-display font-bold text-[var(--paper)] flex items-center gap-2">
                <span>Email Ingestion &amp; Evidence Pipeline</span>
              </h2>
              <p className="text-xs text-[var(--paper-dim)] mt-0.5 font-sans">
                Ingest raw RFC822 (.eml, .msg, .txt) email files through the multi-stage forensic analysis engine.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToOverview}
              className="px-3.5 py-2 bg-[var(--ink)] hover:bg-[#252019] text-[var(--paper)] text-xs font-semibold rounded-sm border border-[var(--line)] flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <span>View Case Overview</span>
              <ArrowRight className="w-3.5 h-3.5 text-[var(--slate)]" />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-sm bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-rose-300 text-xs flex items-center gap-2 font-sans">
            <AlertCircle className="w-4 h-4 shrink-0 text-[var(--thread)]" />
            <span>{error}</span>
          </div>
        )}

        {/* Main Ingestion Box */}
        <div className="bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-5 sm:p-6 shadow-md space-y-4">
          <div className="flex border-b border-[var(--line)] gap-2 pb-0">
            <button
              onClick={() => setActiveTab('paste')}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'paste'
                  ? 'border-[var(--thread)] text-[var(--paper)]'
                  : 'border-transparent text-[var(--paper-dim)] hover:text-[var(--paper)]'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[var(--thread)]" />
              <span>Paste Raw Headers / RFC822</span>
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'upload'
                  ? 'border-[var(--thread)] text-[var(--paper)]'
                  : 'border-transparent text-[var(--paper-dim)] hover:text-[var(--paper)]'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-[var(--slate)]" />
              <span>Upload .EML File</span>
            </button>
            <button
              onClick={() => setActiveTab('batch')}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'batch'
                  ? 'border-[var(--thread)] text-[var(--paper)]'
                  : 'border-transparent text-[var(--paper-dim)] hover:text-[var(--paper)]'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-[var(--stamp)]" />
              <span>Forensic Preset Cases</span>
            </button>
          </div>

          {activeTab === 'paste' && (
            <div className="space-y-3 pt-2">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste raw email headers (Received, From, To, Subject, Authentication-Results, etc.)..."
                rows={11}
                className="w-full p-3.5 rounded-sm bg-[var(--ink)] border border-[var(--line)] font-mono text-xs text-[var(--paper)] placeholder-[var(--paper-muted)] focus:outline-none focus:border-[var(--slate)] transition-colors"
              />
              <div className="flex justify-end">
                <button
                  disabled={!rawText.trim()}
                  onClick={() => executePipelineWithAnimation(rawText, 'pasted_message.eml')}
                  className="btn-primary text-xs font-semibold flex items-center gap-2 cursor-pointer py-2 px-4.5 disabled:opacity-50"
                >
                  <span>Execute Forensic Pipeline</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4 pt-2">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-10 border-2 border-dashed rounded-sm text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-[var(--thread)] bg-[rgba(178,58,46,0.1)]'
                    : 'border-[var(--line)] hover:border-[var(--slate)] bg-[var(--ink)]'
                }`}
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-[rgba(127,163,186,0.12)] border border-[rgba(127,163,186,0.3)] flex items-center justify-center text-[var(--slate)] mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-[var(--paper)]">
                  Click to select or drag &amp; drop your .EML file here
                </p>
                <p className="text-xs text-[var(--paper-dim)] font-sans mt-1">
                  Supports standard RFC822 (.eml, .msg, .txt) format
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".eml,.msg,.txt"
                  className="hidden"
                />
              </div>
            </div>
          )}

          {activeTab === 'batch' && (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-[var(--paper-dim)] font-sans">
                Select one of the pre-loaded threat campaign samples to run through the forensic pipeline:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SAMPLE_ANALYSES.map((sample) => (
                  <div
                    key={sample.id}
                    onClick={() => {
                      const rawContent = sample.rawHeaders || `From: ${sample.headers.from}\nTo: ${sample.headers.to}\nSubject: ${sample.headers.subject}\nDate: ${sample.headers.date}\nMessage-ID: ${sample.headers.messageId}\n\n${sample.name}`;
                      executePipelineWithAnimation(rawContent, `${sample.id}.eml`);
                    }}
                    className="p-3.5 rounded-sm bg-[var(--ink)] border border-[var(--line)] hover:border-[var(--thread)] cursor-pointer transition-all space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase text-[var(--thread)] bg-[rgba(178,58,46,0.15)] border border-[rgba(178,58,46,0.3)] px-2 py-0.5 rounded-sm">
                        {sample.threatVerdict || sample.verdict}
                      </span>
                      <span className="text-[10.5px] font-mono text-[var(--paper-muted)]">{sample.id}</span>
                    </div>
                    <div className="text-xs font-semibold text-[var(--paper)] truncate group-hover:text-[var(--paper)]">{sample.subject}</div>
                    <div className="text-[11px] text-[var(--paper-dim)] font-mono truncate">{sample.from}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
