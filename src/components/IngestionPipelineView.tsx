import React, { useState, useRef, ChangeEvent, DragEvent, useEffect, Suspense, lazy } from 'react';
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
  Sparkles,
  Terminal,
  Copy,
  Trash2,
  AlertTriangle,
  Check,
  Loader2,
  RefreshCw,
  FileWarning,
  Zap,
  Globe,
  Clock,
  ShieldAlert,
  RotateCcw,
  Info,
  Mail,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { EmailAnalysis } from '../types';
import { SAMPLE_ANALYSES, EMPTY_ANALYSIS } from '../data/samples';
import { parseRawEml, mapBackendCaseToAnalysis } from '../utils/parser';
import { apiFetch } from '../lib/api';
import { ForensicScanAnimationModal } from './ForensicScanAnimationModal';
import { AlertToast } from './AlertToast';
import { WebSocketAlert } from '../hooks/useWebSocketAlerts';

const GmailConnectionView = lazy(() => import('./GmailConnectionView').then(m => ({ default: m.GmailConnectionView })));

interface IngestionPipelineViewProps {
  onSelectAnalysis: (analysis: EmailAnalysis) => void;
  onNavigateToOverview: () => void;
  defaultTab?: 'paste' | 'upload' | 'batch' | 'gmail';
  onNewCasesProcessed?: () => void;
}

export function IngestionPipelineView({
  onSelectAnalysis,
  onNavigateToOverview,
  defaultTab = 'paste',
  onNewCasesProcessed
}: IngestionPipelineViewProps) {
  const [activeTab, setActiveTab] = useState<'paste' | 'upload' | 'batch' | 'gmail'>(defaultTab);
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('raw_email.eml');
  const [isScanning, setIsScanning] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<EmailAnalysis | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticToast, setDiagnosticToast] = useState<WebSocketAlert | null>(null);
  const [copiedLogs, setCopiedLogs] = useState(false);

  // Pending Analysis & Diagnostic Error States
  const [isPendingBackend, setIsPendingBackend] = useState<boolean>(false);
  const [backendStage, setBackendStage] = useState<string>('Initializing pipeline connection...');
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [diagnosticError, setDiagnosticError] = useState<{
    title: string;
    detail: string;
    code?: string;
    reasons: string[];
    rawContent: string;
    fileName: string;
    fallbackAvailable: boolean;
  } | null>(null);

  const [pipelineStartTime, setPipelineStartTime] = useState<number | undefined>(undefined);
  const pendingAnalysisRef = useRef<EmailAnalysis | null>(null);
  const scanAnimationFinishedRef = useRef<boolean>(false);

  // Diagnostic Log State
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>(() => [
    `[${new Date().toISOString().split('T')[1].slice(0, 8)}] DIAGNOSTIC: Pipeline initialized. Ready for RFC822 ingestion.`
  ]);

  // Telemetry Console disclosure state (collapsed by default, persisted per user)
  const [isTelemetryExpanded, setIsTelemetryExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tracexmail_telemetry_expanded');
      if (saved !== null) return saved === 'true';
    } catch {}
    return false;
  });

  const toggleTelemetry = () => {
    setIsTelemetryExpanded(prev => {
      const next = !prev;
      try {
        localStorage.setItem('tracexmail_telemetry_expanded', String(next));
      } catch {}
      return next;
    });
  };

  const addLog = (msg: string) => {
    const ts = new Date().toISOString().split('T')[1].slice(0, 8);
    setDiagnosticLogs(prev => [...prev, `[${ts}] ${msg}`]);
  };

  const handleLoadSampleHeader = () => {
    const sample = SAMPLE_ANALYSES[0] || EMPTY_ANALYSIS;
    const headerStr = sample.rawHeaders || `From: ${sample.headers?.from || 'sender@domain.com'}\nTo: ${sample.headers?.to || 'recipient@domain.com'}\nSubject: ${sample.headers?.subject || 'Security Verification Notification'}\nDate: ${sample.headers?.date || new Date().toUTCString()}\nMessage-ID: ${sample.headers?.messageId || '<sample-header-01@domain.com>'}\nAuthentication-Results: spf=pass dkim=pass dmarc=pass\nReceived: from relay.network.net by gateway.corp.net with ESMTP id 9823419; ${sample.headers?.date || new Date().toUTCString()}\n\n${sample.name || 'Sample Analysis Email'}`;
    setRawText(headerStr);
    setFileName(`${sample.id || 'sample-email'}.eml`);
    addLog(`[ACTION] Loaded benchmark RFC822 sample '${sample.id}' into editor.`);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const executePipelineWithAnimation = async (content: string, name: string) => {
    if (!content.trim()) {
      const errText = 'Please provide valid raw RFC822 email content or headers.';
      setError(errText);
      addLog(`[ERROR] Ingestion halted: ${errText}`);
      setDiagnosticToast({
        id: `toast_${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: 'CRITICAL',
        title: 'Ingestion Validation Error',
        description: 'Provided payload is empty or invalid RFC822 header data.',
        source: 'IngestionPipelineView',
        category: 'INGESTION_ERROR'
      });
      return;
    }

    setError(null);
    setDiagnosticError(null);
    setFileName(name);
    setIsScanning(true);
    setIsPendingBackend(true);
    setElapsedMs(0);
    const startNow = performance.now();
    setPipelineStartTime(startNow);
    setBackendStage('1/4 Transmitting payload to /api/v1/analyze endpoint...');

    addLog(`[INGEST] Loaded payload '${name}' (${content.length} bytes). Starting multi-stage telemetry scan...`);

    // Live execution timer interval
    const startTime = startNow;
    const timerInterval = setInterval(() => {
      const currentElapsed = Math.round(performance.now() - startTime);
      setElapsedMs(currentElapsed);
      if (currentElapsed > 3200) {
        setBackendStage('4/4 Synthesizing case dossier & threat verdict...');
      } else if (currentElapsed > 1800) {
        setBackendStage('3/4 Querying Gemini 3.6 AI Intel & Threat Rep APIs...');
      } else if (currentElapsed > 800) {
        setBackendStage('2/4 Parsing MIME structure, Received headers, & DKIM signatures...');
      }
    }, 100);

    let backendResult: any = null;
    let backendFailed = false;
    let failureDetail = '';

    try {
      addLog(`[TRANSPORT] Transmitting payload to /api/v1/analyze endpoint...`);
      const formData = new FormData();
      formData.append('raw_email', content);
      formData.append('filename', name);
      formData.append('source', 'email_upload');

      const res = await apiFetch('/api/v1/analyze', {
        method: 'POST',
        body: formData
      });
      const elapsed = Math.round(performance.now() - startTime);

      if (res.ok) {
        backendResult = await res.json();
        addLog(`[SUCCESS] Backend /api/v1/analyze responded HTTP 200 OK (${elapsed}ms). Case ID: ${backendResult.id || backendResult.case?.id || 'XM-ANALYSIS'}`);
      } else {
        backendFailed = true;
        let bodyText = '';
        try { bodyText = await res.text(); } catch {}
        failureDetail = `HTTP ${res.status} ${res.statusText}: ${bodyText || 'Backend processing failure'}`;
        addLog(`[ERROR] Backend analysis engine failed (${elapsed}ms): ${failureDetail}`);

        // Trigger visible AlertToast for backend processing failure
        setDiagnosticToast({
          id: `toast_err_${Date.now()}`,
          timestamp: new Date().toISOString(),
          severity: 'CRITICAL',
          title: 'Backend Analysis Engine Failure',
          description: `${failureDetail}. Diagnostic error logged.`,
          source: 'ForensicEngine',
          category: 'ANALYSIS_FAILURE',
          sender: name
        });
      }
    } catch (err: any) {
      backendFailed = true;
      failureDetail = err?.message || 'Network transport or connection failure';
      addLog(`[ERROR] Connection exception to /api/v1/analyze: ${failureDetail}`);

      // Trigger visible AlertToast for network / exception failure
      setDiagnosticToast({
        id: `toast_err_${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: 'CRITICAL',
        title: 'Backend Transport Exception',
        description: `Failed to communicate with /api/v1/analyze (${failureDetail}). Diagnostic error logged.`,
        source: 'NetworkTransport',
        category: 'CONNECTION_FAILURE',
        sender: name
      });
    } finally {
      clearInterval(timerInterval);
      setIsPendingBackend(false);
    }

    try {
      let finalAnalysis: EmailAnalysis | null = null;
      if (backendResult?.analysis || backendResult?.case) {
        addLog(`[MAPPER] Mapping backend JSON schema to structured EmailAnalysis object...`);
        finalAnalysis = mapBackendCaseToAnalysis(backendResult.analysis || backendResult, content, name);
      } else if (!backendFailed) {
        // If backend returned OK but no analysis data was present
        backendFailed = true;
        failureDetail = 'Backend returned HTTP 200 but contained empty analysis schema object.';
      }

      if (backendFailed || !finalAnalysis) {
        // Set Diagnostic Error UI State explaining potential reasons
        setDiagnosticError({
          title: 'Diagnostic Error — Analysis Engine Returned No Data',
          detail: failureDetail || 'Analysis engine request did not yield valid forensic telemetry.',
          code: 'ERR_FORENSIC_ENGINE_NO_DATA',
          reasons: [
            'Processing Delays or Cold Start: High queue volume on analysis worker threads or transient container cold start.',
            'API Quota or Rate Limitations: External Gemini 3.6 AI Intel or Threat APIs (VirusTotal, MaxMind GeoIP) reached request thresholds.',
            'RFC822 Header Structure Anomaly: Raw email payload missing mandatory envelope fields (From, Received, Message-ID).',
            'Network Transport Partition: Disruption in server-side API transport or socket pipeline.'
          ],
          rawContent: content,
          fileName: name,
          fallbackAvailable: true
        });

        // Still construct client-side fallback as backup
        addLog(`[FALLBACK] Constructing client-side cryptographic parser fallback...`);
        finalAnalysis = parseRawEml(content, name);
      }

      if (finalAnalysis) {
        addLog(`[TELEMETRY] Analysis compiled. Subject: '${finalAnalysis.subject || finalAnalysis.headers?.subject}'. Threat Score: ${finalAnalysis.threatScore || finalAnalysis.riskScore || 0}/100.`);
        console.log('📊 [IngestionPipelineView] Email analysis object constructed:', finalAnalysis);
        pendingAnalysisRef.current = finalAnalysis;
        setPendingAnalysis(finalAnalysis);

        // If animation already finished while processing, dispatch immediately
        if (scanAnimationFinishedRef.current && !backendFailed) {
          addLog(`[DISPATCH] Scan complete signal caught; mounting analysis in workspace...`);
          console.log('🚀 [IngestionPipelineView] Auto-dispatching analysis to App state:', finalAnalysis.id);
          onSelectAnalysis(finalAnalysis);
          onNavigateToOverview();
          setIsScanning(false);
          setPendingAnalysis(null);
          pendingAnalysisRef.current = null;
          scanAnimationFinishedRef.current = false;
        }
      }
    } catch (err: any) {
      const fatalErr = err.message || 'Fatal error mapping forensic telemetry';
      addLog(`[FATAL] Pipeline mapping error: ${fatalErr}`);
      setError(fatalErr);
      setIsScanning(false);

      setDiagnosticToast({
        id: `toast_fatal_${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: 'CRITICAL',
        title: 'Fatal Forensic Ingestion Failure',
        description: `Failed to construct evidence model: ${fatalErr}. Check RFC822 header formatting.`,
        source: 'ForensicParser',
        category: 'PARSER_FAILURE',
        sender: name
      });
    }
  };

  const handleScanAnimationComplete = () => {
    const analysisToSelect = pendingAnalysisRef.current || pendingAnalysis;
    if (analysisToSelect) {
      addLog(`[DISPATCH] Animation complete; dispatching selected analysis to workspace view...`);
      console.log('🚀 [IngestionPipelineView] handleScanAnimationComplete dispatching analysis:', {
        id: analysisToSelect.id,
        subject: analysisToSelect.subject || analysisToSelect.headers?.subject,
        threatScore: analysisToSelect.threatScore ?? analysisToSelect.riskScore,
        analysisObject: analysisToSelect
      });
      onSelectAnalysis(analysisToSelect);
      onNavigateToOverview();
      setIsScanning(false);
      setPendingAnalysis(null);
      pendingAnalysisRef.current = null;
      scanAnimationFinishedRef.current = false;
    } else {
      // Record animation completed if backend processing is still running
      console.log('⏳ [IngestionPipelineView] Scan animation completed before backend processing finished.');
      scanAnimationFinishedRef.current = true;
    }
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
          analysis={pendingAnalysis}
          startTimeMs={pipelineStartTime}
          onComplete={handleScanAnimationComplete}
        />
      )}

      <div className="flex-1 flex flex-col h-full bg-[var(--ink)] overflow-y-auto w-full max-w-full min-w-0 p-3.5 sm:p-6 space-y-4 sm:space-y-6">
        {/* Top Banner */}
        <div className="bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-3.5 sm:p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-full border-[1.5px] border-[var(--thread)] flex items-center justify-center bg-[rgba(178,58,46,0.1)] shrink-0">
              <Database className="w-4 sm:w-5 h-4 sm:h-5 text-[var(--thread)]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base md:text-lg font-display font-bold text-[var(--paper)] flex items-center gap-2">
                <span>Upload &amp; Inspect Email</span>
              </h2>
              <p className="text-[11px] sm:text-xs text-[var(--paper-dim)] mt-0.5 font-sans leading-relaxed line-clamp-2 sm:line-clamp-none">
                Upload an email file (.eml, .msg, or raw text) to instantly verify sender, route, links, and security status.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
            <button
              onClick={onNavigateToOverview}
              className="w-full sm:w-auto justify-center px-3.5 py-2 bg-[var(--ink)] hover:bg-[#252019] text-[var(--paper)] text-xs font-semibold rounded-sm border border-[var(--line)] flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <span>View Case Overview</span>
              <ArrowRight className="w-3.5 h-3.5 text-[var(--slate)]" />
            </button>
          </div>
        </div>

        {/* 1. Waiting for Analysis Status Component (Pending Backend Call) */}
        {isPendingBackend && (
          <div className="bg-[#15120e] border border-[rgba(201,162,39,0.4)] rounded-sm p-5 shadow-lg space-y-3 font-mono">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2c271f]">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-8 h-8 rounded bg-[rgba(201,162,39,0.15)] border border-[rgba(201,162,39,0.35)]">
                  <Loader2 className="w-4 h-4 text-[var(--stamp)] animate-spin" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--stamp)]">
                      WAITING FOR ANALYSIS...
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[rgba(201,162,39,0.2)] text-[var(--stamp)] border border-[rgba(201,162,39,0.4)] font-bold">
                      PENDING ENGINE
                    </span>
                  </div>
                  <p className="text-[11px] text-[#b9af9c] mt-0.5 font-sans">
                    Communicating with backend forensic analysis engine for payload: <span className="font-mono text-[#ede6d8]">{fileName}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-emerald-400 font-bold bg-[#0d0b08] px-3 py-1.5 rounded border border-[#2c271f]">
                <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>{(elapsedMs / 1000).toFixed(1)}s</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#b9af9c]">
                <span className="flex items-center gap-1.5 text-[var(--slate)] font-semibold">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Pipeline Stage:</span>
                </span>
                <span className="text-[#ede6d8] font-semibold">{backendStage}</span>
              </div>
              {/* Progress bar line */}
              <div className="w-full h-1.5 bg-[#201c16] rounded-full overflow-hidden border border-[#3a352c]">
                <div 
                  className="h-full bg-gradient-to-r from-[var(--slate)] via-[var(--stamp)] to-emerald-400 transition-all duration-200"
                  style={{ width: `${Math.min(95, Math.max(10, (elapsedMs / 4000) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. Diagnostic Error Fallback UI Component */}
        {diagnosticError && (
          <div className="bg-[#170e0d] border border-rose-800/80 rounded-sm p-5 shadow-lg space-y-4 font-mono">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-rose-950">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded bg-rose-950/80 border border-rose-700/80 flex items-center justify-center shrink-0 text-rose-400 mt-0.5">
                  <FileWarning className="w-5 h-5 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-rose-200">
                      {diagnosticError.title}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 font-bold">
                      {diagnosticError.code || 'ERR_DIAGNOSTIC_FAILURE'}
                    </span>
                  </div>
                  <p className="text-xs text-rose-300 font-sans leading-relaxed">
                    {diagnosticError.detail}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDiagnosticError(null)}
                className="text-xs text-rose-400 hover:text-rose-200 underline cursor-pointer self-end sm:self-auto shrink-0"
              >
                Dismiss Notice
              </button>
            </div>

            {/* Explanation of Potential Reasons */}
            <div className="bg-[#0f0a0a] border border-rose-900/40 rounded p-3.5 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-rose-300 font-bold uppercase text-[11px] tracking-wider">
                <Info className="w-3.5 h-3.5 text-rose-400" />
                <span>POTENTIAL FAILURE CAUSES &amp; DIAGNOSTICS:</span>
              </div>
              <ul className="space-y-1.5 text-rose-200/90 text-[11px] font-sans pl-1">
                {diagnosticError.reasons.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-rose-500 font-mono font-bold select-none">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Interactive Recovery Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-[11px] text-[#b9af9c] font-sans flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Client-side local cryptographic parser is ready as fallback.</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    executePipelineWithAnimation(diagnosticError.rawContent, diagnosticError.fileName);
                  }}
                  className="px-3 py-1.5 text-xs bg-[#241e1a] hover:bg-[#2d2621] text-[#ede6d8] rounded border border-[#3a352c] flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[var(--slate)]" />
                  <span>Retry Backend</span>
                </button>

                {diagnosticError.fallbackAvailable && (
                  <button
                    onClick={() => {
                      const fallbackAnalysis = parseRawEml(diagnosticError.rawContent, diagnosticError.fileName);
                      onSelectAnalysis(fallbackAnalysis);
                      onNavigateToOverview();
                      setDiagnosticError(null);
                      addLog(`[FORCE_FALLBACK] User mounted client-side parsed analysis to workspace.`);
                    }}
                    className="px-3.5 py-1.5 text-xs bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 rounded border border-emerald-700/80 flex items-center gap-1.5 font-bold transition-all cursor-pointer shadow-sm"
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Load Local Fallback Analysis</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-sm bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-rose-300 text-xs flex items-center gap-2 font-sans">
            <AlertCircle className="w-4 h-4 shrink-0 text-[var(--thread)]" />
            <span>{error}</span>
          </div>
        )}

        {/* Main Ingestion Box */}
        <div className="bg-[var(--ink-2)] border border-[var(--line)] rounded-sm p-3.5 sm:p-6 shadow-md space-y-4 max-w-full min-w-0">
          {/* Ingestion Method Tabs with Visual Priority */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between border-b border-[var(--line)] gap-2 pb-0">
            <div className="flex gap-1 sm:gap-2 overflow-x-auto whitespace-nowrap scrollbar-none max-w-full pb-0.5">
              {/* Primary Direct Ingestion Methods */}
              <button
                onClick={() => setActiveTab('paste')}
                className={`pb-2 sm:pb-3 px-2.5 sm:px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 shrink-0 ${
                  activeTab === 'paste'
                    ? 'border-[var(--thread)] text-[var(--paper)] font-bold bg-[rgba(178,58,46,0.08)] rounded-t-sm'
                    : 'border-transparent text-[var(--paper-dim)] hover:text-[var(--paper)]'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-[var(--thread)] shrink-0" />
                <span className="hidden xs:inline">Paste Headers</span>
                <span className="xs:hidden inline">Paste</span>
              </button>

              <button
                onClick={() => setActiveTab('upload')}
                className={`pb-2 sm:pb-3 px-2.5 sm:px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 shrink-0 ${
                  activeTab === 'upload'
                    ? 'border-[var(--thread)] text-[var(--paper)] font-bold bg-[rgba(178,58,46,0.08)] rounded-t-sm'
                    : 'border-transparent text-[var(--paper-dim)] hover:text-[var(--paper)]'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-[var(--slate)] shrink-0" />
                <span className="hidden xs:inline">Upload File</span>
                <span className="xs:hidden inline">Upload</span>
              </button>

              <button
                onClick={() => setActiveTab('gmail')}
                className={`pb-2 sm:pb-3 px-2 sm:px-3 text-xs font-medium border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'gmail'
                    ? 'border-amber-500 text-[var(--paper)] font-bold bg-amber-500/10 rounded-t-sm'
                    : 'border-transparent text-[#8a8070] hover:text-[var(--paper-dim)]'
                }`}
                title="Direct Gmail Gateway Sync"
              >
                <Mail className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="flex items-center gap-1.5">
                  <span className="hidden sm:inline">Gmail Live Sync</span>
                  <span className="sm:hidden inline">Gmail Sync</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </span>
              </button>
            </div>
          </div>

          {activeTab === 'paste' && (
            <div className="space-y-3 pt-1">
              <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1.5 text-xs">
                <span className="text-[var(--paper-dim)] font-sans text-[11px] sm:text-xs">
                  Paste raw email headers or RFC822 payload:
                </span>
              </div>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && rawText.trim()) {
                    executePipelineWithAnimation(rawText, 'pasted_message.eml');
                  }
                }}
                placeholder="Paste raw email headers (Received, From, To, Subject, Authentication-Results, etc.)..."
                rows={8}
                className="w-full p-3 sm:p-3.5 rounded-sm bg-[var(--ink)] border border-[var(--line)] font-mono text-xs text-[var(--paper)] placeholder-[var(--paper-muted)] focus:outline-none focus:border-[var(--slate)] transition-colors shadow-inner"
              />

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                <span className="text-[11px] text-[var(--paper-muted)] font-mono self-start sm:self-auto">
                  {rawText.length > 0 ? `${rawText.length.toLocaleString()} bytes ready • Press ⌘↵ to run` : 'Ready for input • Supports RFC822 / MIME text'}
                </span>
                <button
                  disabled={!rawText.trim() || isScanning}
                  onClick={() => executePipelineWithAnimation(rawText, 'pasted_message.eml')}
                  className="w-full sm:w-auto px-5 sm:px-6 py-2.5 bg-gradient-to-r from-[var(--thread)] to-[#c94132] hover:brightness-110 active:scale-[0.99] text-white text-xs font-bold rounded-sm border border-[rgba(255,255,255,0.15)] flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed min-h-[40px]"
                >
                  <span>Execute Forensic Pipeline</span>
                  <ArrowRight className="w-4 h-4" />
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
                className={`p-10 sm:p-12 border-2 border-dashed rounded-sm text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-[var(--thread)] bg-[rgba(178,58,46,0.15)] scale-[1.01]'
                    : 'border-[var(--line)] hover:border-[var(--slate)] bg-[var(--ink)] hover:bg-[#1a1713]'
                }`}
              >
                <div className="w-14 h-14 mx-auto rounded-full bg-[rgba(127,163,186,0.12)] border border-[rgba(127,163,186,0.3)] flex items-center justify-center text-[var(--slate)] mb-3 shadow-inner">
                  <Upload className="w-7 h-7" />
                </div>
                <p className="text-sm font-bold text-[var(--paper)]">
                  Click to select or drag &amp; drop your .EML file here
                </p>
                <p className="text-xs text-[var(--paper-dim)] font-sans mt-1 max-w-sm mx-auto">
                  Automatic MIME parsing, hop routing extraction, SPF/DKIM verification, and threat analysis.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded bg-[#201c16] border border-[#3a352c] text-[11px] font-mono text-[var(--paper-muted)]">
                  <span>Accepts: .eml, .msg, .txt RFC822</span>
                </div>
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

          {activeTab === 'gmail' && (
            <div className="pt-2">
              <Suspense fallback={
                <div className="flex items-center justify-center p-8">
                  <div className="w-8 h-8 border-2 border-[var(--stamp)]/30 border-t-[var(--stamp)] rounded-full animate-spin" />
                </div>
              }>
                <GmailConnectionView onNewCasesProcessed={onNewCasesProcessed} />
              </Suspense>
            </div>
          )}
        </div>

        {/* Diagnostic Pipeline Terminal Log Panel (Progressive Disclosure) */}
        {(() => {
          const hasActiveJobOrError = isScanning || isPendingBackend || !!diagnosticError || !!error;
          const isTerminalOpen = isTelemetryExpanded || hasActiveJobOrError;

          if (!isTerminalOpen) {
            return (
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={toggleTelemetry}
                  className="px-3 py-1.5 rounded-sm bg-[#14110e] hover:bg-[#1a1612] border border-[#2e2820] hover:border-[#3a352c] text-[#8a8070] hover:text-[#ede6d8] flex items-center gap-2 font-mono text-[11px] transition-colors cursor-pointer"
                  title="Open Diagnostic Telemetry Console"
                >
                  <Terminal className="w-3.5 h-3.5 text-[var(--slate)]" />
                  <span className="font-medium">Diagnostic Telemetry</span>
                  <span className="text-[10px] text-[#6b6255]">({diagnosticLogs.length} events • Idle)</span>
                  <ChevronDown className="w-3 h-3 text-[#6b6255] ml-1" />
                </button>
              </div>
            );
          }

          return (
            <div className="bg-[#100e0b] border border-[#3a352c] rounded-sm font-mono shadow-md overflow-hidden transition-all duration-200 animate-in fade-in duration-150">
              <div 
                onClick={toggleTelemetry}
                className="flex items-center justify-between p-3 cursor-pointer bg-[#14110e] hover:bg-[#1a1612] transition-colors select-none"
                title="Click to collapse telemetry console"
              >
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Terminal className="w-4 h-4 text-[var(--slate)] shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#ede6d8]">
                    PIPELINE DIAGNOSTIC TELEMETRY
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1e1b15] text-[#b9af9c] border border-[#3a352c]">
                    {diagnosticLogs.length} EVENTS
                  </span>
                  {hasActiveJobOrError ? (
                    <span className="text-[9.5px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-sans font-semibold flex items-center gap-1.5 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span>{isPendingBackend ? 'Active Telemetry Streaming' : 'Diagnostic Notice Recorded'}</span>
                    </span>
                  ) : (
                    <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-[#17140f] text-[#8a8070] font-sans">
                      Idle • Standby
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(diagnosticLogs.join('\n'));
                      setCopiedLogs(true);
                      setTimeout(() => setCopiedLogs(false), 2000);
                    }}
                    className="px-2 py-1 text-[10.5px] bg-[#1e1b15] hover:bg-[#2a251e] text-[#b9af9c] hover:text-[#ede6d8] rounded border border-[#3a352c] flex items-center gap-1 transition-colors cursor-pointer"
                    title="Copy diagnostic log output to clipboard"
                  >
                    {copiedLogs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={() => setDiagnosticLogs([`[${new Date().toISOString().split('T')[1].slice(0, 8)}] DIAGNOSTIC: Terminal logs cleared.`])}
                    className="px-2 py-1 text-[10.5px] bg-[#1e1b15] hover:bg-[#2a251e] text-[#b9af9c] hover:text-[#ede6d8] rounded border border-[#3a352c] flex items-center gap-1 transition-colors cursor-pointer"
                    title="Clear diagnostic log terminal"
                  >
                    <Trash2 className="w-3 h-3 text-[var(--thread)]" />
                    <span>Clear</span>
                  </button>
                  <button
                    onClick={toggleTelemetry}
                    className="px-2.5 py-1 text-[11px] bg-[#221d17] hover:bg-[#2c261e] text-[#ede6d8] rounded border border-[#3a352c] flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Collapse diagnostic console"
                  >
                    <span>Collapse</span>
                    <ChevronUp className="w-3.5 h-3.5 text-[var(--slate)]" />
                  </button>
                </div>
              </div>

              <div className="p-3 bg-[#0a0907] border-t border-[#24201a]">
                <div className="text-[11px] leading-relaxed max-h-52 overflow-y-auto space-y-1 text-[#b9af9c]">
                  {diagnosticLogs.map((log, index) => {
                    const isError = log.includes('[ERROR]') || log.includes('[FATAL]');
                    const isSuccess = log.includes('[SUCCESS]') || log.includes('[COMPLETE]');
                    const isIngest = log.includes('[INGEST]') || log.includes('[TRANSPORT]');
                    return (
                      <div 
                        key={index} 
                        className={`flex items-start gap-2 font-mono ${
                          isError 
                            ? 'text-rose-400 font-semibold bg-rose-950/20 px-1 py-0.5 rounded' 
                            : isSuccess 
                              ? 'text-emerald-400 font-semibold' 
                              : isIngest 
                                ? 'text-[var(--slate)]' 
                                : 'text-[#b9af9c]'
                        }`}
                      >
                        <span className="text-[#6b6255] select-none">&gt;</span>
                        <span className="break-all">{log}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Visible Forensic AlertToast Notification for Ingestion / Engine Errors */}
      <AlertToast
        alert={diagnosticToast}
        onDismiss={() => setDiagnosticToast(null)}
        onInspect={() => {
          onNavigateToOverview();
          setDiagnosticToast(null);
        }}
      />
    </>
  );
}
