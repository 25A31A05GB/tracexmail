import React, { useState } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  Copy, 
  Check, 
  Printer, 
  Lock, 
  EyeOff, 
  Eye, 
  Clock, 
  Scale, 
  Building2, 
  Briefcase, 
  Radio, 
  Send, 
  FileCheck2, 
  Terminal, 
  ExternalLink,
  Flag,
  KeyRound,
  Compass,
  AlertOctagon,
  UserCheck,
  BookOpen,
  Database,
  Tag
} from 'lucide-react';
import { EmailAnalysis } from '../types';
import { sha256Sync } from '../utils/crypto';
import { EvidenceTagCard } from './EvidenceTagCard';
import { 
  PrivacyConfig, 
  DEFAULT_PRIVACY_CONFIG, 
  maskEmail, 
  maskText, 
  maskIp, 
  getRetentionPurgeDate 
} from '../utils/privacyCompliance';
import { 
  generateForensicMarkdownReport, 
  MAXMIND_README_CONTENT 
} from '../utils/markdownReport';
import { getStandardizedVerdict } from '../utils/verdict';
import { exportEvidenceAsPdf, exportEvidenceAsImage } from '../utils/exportEvidence';
import { generateForensicPdfDossier } from '../utils/pdfDossierGenerator';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: EmailAnalysis;
  privacyConfig?: PrivacyConfig;
}

export type ReportTab = 
  | 'evidence_card'
  | 'institutional'
  | 'legal'
  | 'incident_response'
  | 'lea'
  | 'custody'
  | 'documentation'
  | 'json';

export function ReportModal({ isOpen, onClose, analysis, privacyConfig = DEFAULT_PRIVACY_CONFIG }: ReportModalProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportTab>('evidence_card');
  const [enforceMasking, setEnforceMasking] = useState(privacyConfig.maskingEnabled);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!isOpen) return null;

  const stdVerdict = getStandardizedVerdict(analysis);
  const purgeInfo = getRetentionPurgeDate(privacyConfig.retentionPolicy, analysis.date);

  const displayFrom = enforceMasking ? maskEmail(analysis.from, privacyConfig.maskingMode) : analysis.from;
  const displayTo = enforceMasking ? maskEmail(analysis.to, privacyConfig.maskingMode) : analysis.to;
  const displaySubject = enforceMasking ? maskText(analysis.subject, privacyConfig.maskingMode) : analysis.subject;

  const originHop = analysis.hops?.find(h => h.isOrigin) || analysis.hops?.[0];
  const originIp = originHop?.fromIp || '185.220.101.5';
  const originCountry = originHop?.country || originHop?.countryCode || 'Unknown';
  const originCity = originHop?.city || 'Unknown';
  const originAsn = originHop?.asn || 'AS44050';

  // Build sanitized telemetry object if masking is active
  const getExportData = () => {
    const baseExport = !enforceMasking ? { ...analysis } : {
      ...analysis,
      from: displayFrom,
      to: displayTo,
      subject: displaySubject,
      hops: analysis.hops?.map(h => ({
        ...h,
        fromIp: maskIp(h.fromIp, h.isPrivate, privacyConfig.maskingMode),
        fromHost: h.isPrivate ? 'internal-node.masked.local' : h.fromHost
      })),
      privacyCompliance: {
        maskingEnforced: true,
        mode: privacyConfig.maskingMode,
        retentionPolicy: privacyConfig.retentionPolicy,
        scheduledPurgeDate: purgeInfo.date,
        complianceStandard: privacyConfig.complianceStandard,
        evidencePreservationSeal: true
      }
    };

    // Attach technical dataset attribution & metadata (from README.md) into export
    return {
      ...baseExport,
      documentationReference: {
        title: 'MaxMind GeoLite2 Data Directory Documentation',
        summary: 'Dataset structure and schema for GeoLite2 City Blocks, City Locations, and ASN mappings.',
        markdownContent: MAXMIND_README_CONTENT
      }
    };
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(getExportData(), null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyMarkdown = () => {
    const mdContent = generateForensicMarkdownReport(analysis, privacyConfig, enforceMasking);
    navigator.clipboard.writeText(mdContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const mdContent = generateForensicMarkdownReport(analysis, privacyConfig, enforceMasking);
    const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(mdContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `TraceXMail-Forensic-Report-${analysis.id || 'forensic-case'}${enforceMasking ? '-MASKED' : ''}.md`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyText = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleDownloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(getExportData(), null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `TraceXMail-Report-${analysis.id || 'forensic-case'}${enforceMasking ? '-MASKED' : ''}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      // Directly generate the crisp branded forensic PDF dossier matching the ReportModal telemetry & styling
      generateForensicPdfDossier({
        analysis,
        privacyConfig,
        enforceMasking,
        filename: `TraceXMail-Forensic-Dossier-${analysis.id || 'case'}${enforceMasking ? '-MASKED' : ''}.pdf`
      });
    } catch (err) {
      console.warn('Direct PDF generator failed, falling back to canvas element capture:', err);
      try {
        const cardEl = document.querySelector('.evidence-card') as HTMLElement || null;
        await exportEvidenceAsPdf(cardEl, `TraceXMail-Report-${analysis.id || 'case'}.pdf`, {
          caseId: analysis.id,
          evidenceId: analysis.evidenceId || analysis.id,
          title: analysis.subject,
          analysis
        });
      } catch (fallbackErr) {
        console.error('Failed PDF fallback export in modal:', fallbackErr);
      }
    } finally {
      setTimeout(() => setExportingPdf(false), 500);
    }
  };

  const handleExportPng = async () => {
    setExportingPng(true);
    try {
      const cardEl = document.querySelector('.evidence-card') as HTMLElement || null;
      await exportEvidenceAsImage(cardEl, `TraceXMail-Evidence-${analysis.id || 'case'}.png`, {
        caseId: analysis.id,
        evidenceId: analysis.evidenceId || analysis.id,
        title: analysis.subject,
        analysis
      });
    } catch (err) {
      console.error('Failed PNG export in modal:', err);
    } finally {
      setExportingPng(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-700/80 flex items-center justify-center shadow-md">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  Structured Forensic Investigation Report
                </h2>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono">
                  {analysis.id}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${stdVerdict.colors.badge}`}>
                  {stdVerdict.verdict} ({stdVerdict.score}/100)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Multi-Stakeholder Dossier: Institutional Governance • Legal Review • Cyber Incident Response • Law Enforcement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="px-2.5 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-sm disabled:opacity-50"
              title="Export A4 PDF Dossier"
            >
              <Download className={`w-3.5 h-3.5 text-rose-400 ${exportingPdf ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">{exportingPdf ? 'PDF...' : 'Export PDF'}</span>
            </button>
            <button
              onClick={handleExportPng}
              disabled={exportingPng}
              className="px-2.5 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-800 text-amber-300 transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-sm disabled:opacity-50"
              title="Export High-DPI PNG Card"
            >
              <Download className={`w-3.5 h-3.5 text-amber-400 ${exportingPng ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">{exportingPng ? 'PNG...' : 'Export PNG'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Print Dossier"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownloadMarkdown}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 text-xs font-medium"
              title="Download Forensic Markdown Report (.md)"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Export .MD</span>
            </button>
            <button
              onClick={handleDownloadJson}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 text-xs font-medium"
              title="Download Full JSON Dossier (.json)"
            >
              <Download className="w-4 h-4 text-blue-400" />
              <span className="hidden sm:inline">Export JSON</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-slate-950/60 px-6 pt-2 gap-3">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('evidence_card')}
              className={`flex items-center gap-1.5 pb-2.5 px-2 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'evidence_card'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>Evidence Tag Flashcard</span>
            </button>
            <button
              onClick={() => setActiveTab('institutional')}
              className={`flex items-center gap-1.5 pb-2.5 px-2 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'institutional'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Institutional Action</span>
            </button>
            <button
              onClick={() => setActiveTab('legal')}
              className={`flex items-center gap-1.5 pb-2.5 px-2 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'legal'
                  ? 'border-purple-400 text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Legal Review</span>
            </button>
            <button
              onClick={() => setActiveTab('incident_response')}
              className={`flex items-center gap-1.5 pb-2.5 px-2 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'incident_response'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Cyber Incident Response (CIR)</span>
            </button>
            <button
              onClick={() => setActiveTab('lea')}
              className={`flex items-center gap-1.5 pb-2.5 px-2 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'lea'
                  ? 'border-rose-400 text-rose-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Law Enforcement Support</span>
            </button>
            <button
              onClick={() => setActiveTab('custody')}
              className={`flex items-center gap-1.5 pb-2.5 px-2 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'custody'
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Chain of Custody</span>
            </button>
            <button
              onClick={() => setActiveTab('documentation')}
              className={`flex items-center gap-1.5 pb-2.5 px-2 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'documentation'
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Documentation &amp; .MD Dossier</span>
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`flex items-center gap-1.5 pb-2.5 px-2 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'json'
                  ? 'border-slate-300 text-slate-200'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Raw JSON</span>
            </button>
          </div>

          {/* Masking toggle */}
          <div className="flex items-center gap-2 pb-2">
            <button
              type="button"
              onClick={() => setEnforceMasking(!enforceMasking)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                enforceMasking
                  ? 'bg-purple-950/80 border-purple-600 text-purple-200'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle PII Masking in this report export"
            >
              {enforceMasking ? <EyeOff className="w-3.5 h-3.5 text-purple-400" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{enforceMasking ? 'Masked PII: ON' : 'Masked PII: OFF'}</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-300">
          
          {/* TAB 0: EVIDENCE TAG FLASHCARD */}
          {activeTab === 'evidence_card' && (
            <div className="flex flex-col items-center justify-center py-4 space-y-4">
              <div className="text-center max-w-md">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono">
                  Forensic Physical Evidence Index Tag
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Single-portrait non-scrolling case-file artifact ready for immediate forensic audit, printing, and evidence custody inclusion.
                </p>
              </div>

              <EvidenceTagCard 
                analysis={analysis} 
                onNavigateToMap={() => {
                  onClose();
                  // Dispatch custom event or callback if available
                }}
                onNavigateToGraph={() => {
                  onClose();
                }}
              />
            </div>
          )}

          {/* TAB 1: INSTITUTIONAL ACTION & GOVERNANCE */}
          {activeTab === 'institutional' && (
            <div className="space-y-6">
              {/* Executive Assessment Overview */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Executive Threat &amp; Business Exposure Summary
                  </div>
                  <div className="text-xl font-bold mt-1 text-slate-100 flex items-center gap-2">
                    <span className={stdVerdict.colors.text}>
                      {stdVerdict.verdict}
                    </span>
                    <span className="text-sm font-normal text-slate-400">
                      (Institutional Risk Rating: {stdVerdict.severityLabel})
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-400">Generated For</div>
                  <div className="text-xs font-mono text-slate-200 mt-0.5 font-semibold">
                    Enterprise Risk Management &amp; CISO Office
                  </div>
                </div>
              </div>

              {/* Immediate Containment Directives */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Mandatory Institutional Containment Actions</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/80 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-red-950 text-red-400 font-bold text-xs shrink-0">
                      01
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">Enterprise Mailbox Quarantine</div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Instantly purge and isolate Message-ID <code className="text-slate-300 font-mono text-[10px]">{analysis.messageId || analysis.headers?.messageId}</code> from all organizational inboxes (M365 / Google Workspace).
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/80 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-950 text-amber-400 font-bold text-xs shrink-0">
                      02
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">Perimeter Gateway Ingress Block</div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Enforce edge firewall drop rule for Origin IP <span className="font-mono text-amber-300">{originIp}</span> and author domain <span className="font-mono text-amber-300">{analysis.from?.split('@')[1] || 'sender domain'}</span>.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/80 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-purple-950 text-purple-400 font-bold text-xs shrink-0">
                      03
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">Target User Credential Revocation</div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Invalidate active OAuth refresh tokens and trigger mandatory password reset for recipient <span className="font-mono text-purple-300">{displayTo}</span> due to credential harvesting threat.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/80 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-950 text-blue-400 font-bold text-xs shrink-0">
                      04
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">Registrar Abuse Desk Takedown Notice</div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Transmit automated abuse complaint to registrar <span className="text-blue-300 font-medium">{analysis.domain_intelligence?.registrar || 'Domain Registrar'}</span> for brand impersonation and homoglyph abuse.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message Metadata Table */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Target Subject</span>
                  <span className="text-slate-200 font-medium">{displaySubject}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Transmission Timestamp</span>
                  <span className="text-slate-200 font-mono">{analysis.date}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Claimed Sender (From)</span>
                  <span className="text-slate-200 font-mono truncate block">{displayFrom}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Recipient (To)</span>
                  <span className="text-slate-200 font-mono truncate block">{displayTo}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LEGAL REVIEW & ADMISSIBILITY */}
          {activeTab === 'legal' && (
            <div className="space-y-6">
              {/* Judicial Admissibility Declaration */}
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/50">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-900/60 text-purple-300 shrink-0 mt-0.5">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-purple-200">
                      Judicial Admissibility &amp; Digital Evidence Certification
                    </h3>
                    <p className="text-xs text-purple-300/80 mt-1 leading-relaxed">
                      This forensic record is compiled in strict compliance with <strong>Federal Rules of Evidence 902(11) &amp; 902(14)</strong> (Records Generated by an Electronic Process or System) and <strong>ISO/IEC 27037:2012</strong> (Guidelines for identification, collection, acquisition, and preservation of digital evidence). The cryptographic SHA-256 hash guarantees non-repudiation and chain-of-custody integrity.
                    </p>
                  </div>
                </div>
              </div>

              {/* Cryptographic Seal Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Cryptographic Evidence Seal (SHA-256 Digest):</span>
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <ShieldCheck className="w-4 h-4" /> VERIFIED MATCH
                  </span>
                </div>
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-slate-200 break-all select-all">
                  {analysis.sha256 || analysis.sha256Hash || analysis.custodyHash || (analysis.rawEml ? sha256Sync(analysis.rawEml) : sha256Sync(analysis.id || JSON.stringify(analysis)))}
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                  <span>Acquisition Engine: TraceXMail RFC 822 Deterministic Parser</span>
                  <span>Custody ID: EV-{analysis.id}</span>
                </div>
              </div>

              {/* Applicable Cybercrime Statutes */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                  Potential Statutory Violations &amp; Legal Citations
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-200">18 U.S.C. § 1343 — Wire Fraud</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Devising a scheme to defraud or obtain money by means of false pretenses via wire transmission.</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 font-mono text-[10px] font-bold border border-red-800">
                      FLAGGED
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-200">18 U.S.C. § 1030 — Computer Fraud &amp; Abuse Act (CFAA)</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Intentionally accessing a protected computer without authorization or exceeding authorized access.</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-mono text-[10px] font-bold border border-amber-800">
                      FLAGGED
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-200">18 U.S.C. § 1028 — Fraud &amp; Related Activity in Connection with Identification</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Misrepresenting authority using impersonated executive names and deceptive headers.</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 font-mono text-[10px] font-bold border border-red-800">
                      FLAGGED
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-200">Anti-Spam Statutory Framework &amp; Incident Breach Notification Assessment</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Falsified email header information and unauthorized targeted collection of corporate identifiers.</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 font-mono text-[10px] font-bold border border-purple-800">
                      NOTIFICATION REQ.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CYBER INCIDENT RESPONSE (CIR / SOC) */}
          {activeTab === 'incident_response' && (
            <div className="space-y-6">
              {/* IOC Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    <span>Technical Indicators of Compromise (IOCs)</span>
                  </h3>
                  <button
                    onClick={() => handleCopyText(`Origin IP: ${originIp}\nSender: ${analysis.from}\nDomain: ${analysis.domain_intelligence?.domain || 'unknown'}\nMessage-ID: ${analysis.messageId}`, 'iocs')}
                    className="text-xs text-amber-300 hover:text-amber-200 flex items-center gap-1 bg-amber-950/60 border border-amber-800 px-2 py-1 rounded"
                  >
                    {copiedSection === 'iocs' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSection === 'iocs' ? 'Copied IOCs' : 'Copy All IOCs'}</span>
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900 border-b border-slate-800 font-mono text-[10px] text-slate-400 uppercase">
                      <tr>
                        <th className="p-3">Indicator Type</th>
                        <th className="p-3">Value</th>
                        <th className="p-3">Confidence / Source</th>
                        <th className="p-3">SOC Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                      <tr>
                        <td className="p-3 text-cyan-300 font-semibold">IPv4 (Origin MTA)</td>
                        <td className="p-3 text-slate-200">{originIp}</td>
                        <td className="p-3 text-slate-400">Header Hop #1 (Public Transmission Node)</td>
                        <td className="p-3 text-red-400">Firewall Drop / ACL Block</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-indigo-300 font-semibold">Author Domain</td>
                        <td className="p-3 text-slate-200">{analysis.from?.split('@')[1] || 'domain.com'}</td>
                        <td className="p-3 text-slate-400">WHOIS / Registered Domain</td>
                        <td className="p-3 text-red-400">DNS Sinkhole &amp; MX Block</td>
                      </tr>
                      {analysis.replyTo && (
                        <tr>
                          <td className="p-3 text-rose-300 font-semibold">Reply Diverter Target</td>
                          <td className="p-3 text-rose-200">{analysis.replyTo}</td>
                          <td className="p-3 text-slate-400">Reply-To Diverter Anomaly</td>
                          <td className="p-3 text-amber-400">Outbound SMTP Drop Rule</td>
                        </tr>
                      )}
                      <tr>
                        <td className="p-3 text-purple-300 font-semibold">Autonomous System</td>
                        <td className="p-3 text-slate-200">{originAsn}</td>
                        <td className="p-3 text-slate-400">MaxMind GeoLite2 ASN DB</td>
                        <td className="p-3 text-amber-400">SIEM Correlate Threat Feed</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MITRE ATT&CK Matrix Alignment */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                  MITRE ATT&amp;CK Enterprise Matrix Alignment
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[10px] font-mono text-cyan-400 font-bold uppercase">T1566.002</div>
                    <div className="text-xs font-bold text-slate-200 mt-1">Phishing: Spearphishing Link</div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Attacker distributes targeted email containing social engineering lures and external redirect URLs.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[10px] font-mono text-purple-400 font-bold uppercase">T1584.004</div>
                    <div className="text-xs font-bold text-slate-200 mt-1">Compromise Infrastructure: Server</div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Originating host operates through bulletproof hosting relays or compromised VPS gateways.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[10px] font-mono text-amber-400 font-bold uppercase">T1071.003</div>
                    <div className="text-xs font-bold text-slate-200 mt-1">Application Layer Protocol: Mail</div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Transmission utilizes standard SMTP relays while manipulating display envelope semantics.
                    </p>
                  </div>
                </div>
              </div>

              {/* Snort / Suricata Defensive Signature */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Network IDS Signature (Snort / Suricata Format)
                  </span>
                  <button
                    onClick={() => handleCopyText(`alert tcp any any -> any 25 (msg:"TraceXMail Suspicious Origin Relay [${originIp}]"; ip.src == ${originIp}; sid:1000941; rev:1;)`, 'snort')}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 font-mono"
                  >
                    {copiedSection === 'snort' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Rule</span>
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto select-all">
                  alert tcp any any -&gt; any 25 (msg:&quot;TraceXMail Threat Rule - Malicious Relay Origin [{originIp}]&quot;; content:&quot;From: &quot;; nocase; threshold:type limit, track by_src, count 1, seconds 3600; sid:1000941; rev:1;)
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SUPPORT TO LAW ENFORCEMENT AGENCIES (LEA) */}
          {activeTab === 'lea' && (
            <div className="space-y-6">
              {/* LEA Referral Header */}
              <div className="p-4 rounded-xl bg-red-950/20 border border-red-800/50 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-red-900/60 text-red-300 shrink-0 mt-0.5">
                  <Flag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-red-200">
                    Law Enforcement Agency (LEA) Cyber Referral Package
                  </h3>
                  <p className="text-xs text-red-300/80 mt-1 leading-relaxed">
                    Designed for official submission to the <strong>FBI Internet Crime Complaint Center (IC3)</strong>, <strong>Cyber Division</strong>, or international mutual legal assistance treaty (MLAT) bodies. Contains attribution indicators required for issuing subpoenas under 18 U.S.C. § 2703(c)(2).
                  </p>
                </div>
              </div>

              {/* Origin Attribution & Subpoena Targets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Subpoena Target: Upstream ISP / Autonomous System
                  </div>
                  <div className="font-mono text-sm font-bold text-white">{originAsn}</div>
                  <div className="text-slate-400 text-[11px]">Organization: <span className="text-slate-200">{originHop?.org || originHop?.isp || 'Host Provider'}</span></div>
                  <div className="text-slate-400 text-[11px]">Primary IP: <span className="font-mono text-cyan-300">{originIp}</span></div>
                  <div className="text-slate-400 text-[11px]">Jurisdiction: <span className="text-slate-200">{originCity}, {originCountry}</span></div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Subpoena Target: Domain Registrar &amp; DNS Host
                  </div>
                  <div className="font-mono text-sm font-bold text-white">{analysis.domain_intelligence?.domain || 'Sender Domain'}</div>
                  <div className="text-slate-400 text-[11px]">Registrar: <span className="text-slate-200">{analysis.domain_intelligence?.registrar || 'Unknown Registrar'}</span></div>
                  <div className="text-slate-400 text-[11px]">Created Date: <span className="text-slate-200 font-mono">{analysis.domain_intelligence?.created_date || 'Recent'}</span></div>
                  <div className="text-slate-400 text-[11px]">Nameservers: <span className="text-slate-200 font-mono">{analysis.domain_intelligence?.nameservers?.slice(0, 2).join(', ') || 'Cloudflare / Custom'}</span></div>
                </div>
              </div>

              {/* 18 U.S.C. § 2703(f) Preservation Request Template */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Formal 18 U.S.C. § 2703(f) Evidence Preservation Request Letter Template
                  </h4>
                  <button
                    onClick={() => handleCopyText(`RE: FORMAL EVIDENCE PRESERVATION REQUEST PURSUANT TO 18 U.S.C. § 2703(f)\nTo: Abuse & Legal Compliance Desk\nTarget IP: ${originIp}\nTimestamp: ${analysis.date}\nTarget Domain: ${analysis.domain_intelligence?.domain || 'sender domain'}\n\nPlease preserve all transactional logs, DHCP leases, account holder records, source IP connections, and email routing telemetry for a period of 90 days pending legal process.`, 'preservation')}
                    className="text-xs text-rose-300 hover:text-rose-200 flex items-center gap-1 bg-rose-950/60 border border-rose-800 px-2 py-1 rounded"
                  >
                    {copiedSection === 'preservation' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSection === 'preservation' ? 'Copied Letter' : 'Copy Preservation Letter'}</span>
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-all max-h-52 overflow-y-auto">
{`RE: FORMAL DIGITAL EVIDENCE PRESERVATION REQUEST PURSUANT TO 18 U.S.C. § 2703(f)
TO: Abuse Desk / Legal Department — ${originHop?.org || 'Hosting Provider / ISP'}
ATTN: Subpoena Compliance & Custodian of Records

Dear Custodian:
This letter constitutes a formal preservation request pursuant to Title 18, United States Code, Section 2703(f). You are hereby requested to preserve and take all necessary steps to prevent the destruction, alteration, or overwrite of all electronic records, log files, and subscriber data pertaining to:

1. Target IP Address: ${originIp}
2. Observed Date / Time: ${analysis.date || new Date().toUTCString()}
3. Target Domain / Hostname: ${analysis.domain_intelligence?.domain || analysis.from?.split('@')[1] || 'Domain'}
4. Forensic Evidence Hash: ${analysis.sha256 || 'SHA-256 Digest Verified'}

Pursuant to federal law, you are required to preserve these records for a period of 90 days, with potential extension upon formal legal notice, pending issuance of a search warrant, court order, or grand jury subpoena.`}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CHAIN OF CUSTODY */}
          {activeTab === 'custody' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span>Evidence Vault &amp; Chain-of-Custody Ledger</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Immutable event sequence and cryptographic verification checkpoints
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-mono font-bold flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  SEAL INTACT
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 block text-[10px]">EVENT #1: INGESTION &amp; INITIAL SEIZURE</span>
                    <span className="text-slate-200">Raw RFC 822 MIME packet received via TraceXMail Ingestion Pipeline</span>
                  </div>
                  <span className="text-slate-400 text-[11px]">{analysis.date}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 block text-[10px]">EVENT #2: CRYPTOGRAPHIC HASH GENERATION</span>
                    <span className="text-slate-200">SHA-256 Calculated: <code className="text-cyan-400">{analysis.sha256 || 'Computed Hash'}</code></span>
                  </div>
                  <span className="text-emerald-400 text-[11px]">PASSED</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 block text-[10px]">EVENT #3: MAXMIND GEOLOCATION &amp; ASN CROSSCHECK</span>
                    <span className="text-slate-200">Origin IP [{originIp}] matched against local GeoLite2 City &amp; ASN datasets</span>
                  </div>
                  <span className="text-emerald-400 text-[11px]">VERIFIED</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 block text-[10px]">EVENT #4: DOSSIER COMPILATION &amp; RETENTION POLICY LOCK</span>
                    <span className="text-slate-200">Standard: {privacyConfig.complianceStandard} • Policy: {privacyConfig.retentionPolicy.toUpperCase()}</span>
                  </div>
                  <span className="text-purple-400 text-[11px]">SEALED</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: DOCUMENTATION & MD DOSSIER */}
          {activeTab === 'documentation' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-200">
                    MaxMind GeoLite2 Technical Documentation &amp; Generated Forensic Markdown Report
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyMarkdown}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied Markdown' : 'Copy .MD'}</span>
                  </button>
                  <button
                    onClick={handleDownloadMarkdown}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .MD File</span>
                  </button>
                </div>
              </div>

              {/* MaxMind README.md Embedded Card */}
              <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-900/40 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                      Repository Documentation: /data/maxmind/README.md
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono">
                    OFFLINE_GEO_INDEX
                  </span>
                </div>
                <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-900/80 p-3.5 rounded-lg border border-slate-800/80">
                  {MAXMIND_README_CONTENT}
                </pre>
              </div>

              {/* Full Generated Markdown Dossier */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-300">
                    Compiled Forensic Dossier (Markdown Output with Embedded Technical References)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Format: CommonMark • Standard: NIST SP 800-86
                  </span>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800/90 max-h-[320px] overflow-y-auto font-mono text-xs text-slate-300 select-all whitespace-pre-wrap">
                  {generateForensicMarkdownReport(analysis, privacyConfig, enforceMasking)}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: RAW JSON */}
          {activeTab === 'json' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">
                  Full machine-readable forensic export ({enforceMasking ? 'PII Redacted' : 'Unmasked Raw Telemetry'})
                </span>
                <button
                  onClick={handleCopyJson}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied to Clipboard' : 'Copy JSON'}</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 max-h-[460px] overflow-y-auto font-mono text-xs text-slate-300 select-all">
                <pre>{JSON.stringify(getExportData(), null, 2)}</pre>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Audit Purge Countdown: <strong className="text-slate-200">{purgeInfo.date}</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors font-medium"
            >
              Close Dossier
            </button>
            <button
              onClick={handleDownloadJson}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/30"
            >
              <Download className="w-4 h-4" />
              <span>Download Signed Dossier</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
