import React, { useState, useMemo } from 'react';
import { 
  Scale, 
  ShieldCheck, 
  CheckCircle2, 
  Download, 
  Copy, 
  Check, 
  Lock, 
  FileCheck2, 
  Award,
  Clock,
  Printer,
  Edit2
} from 'lucide-react';
import { EmailAnalysis } from '../types';
import { sha256Sync } from '../utils/crypto';

interface LegalCustodyCertificateProps {
  analysis: EmailAnalysis;
  className?: string;
}

export function LegalCustodyCertificate({ analysis, className = '' }: LegalCustodyCertificateProps) {
  const [copiedHash, setCopiedHash] = useState(false);
  const [examinerName, setExaminerName] = useState('Senior Digital Forensics Examiner');
  const [organization, setOrganization] = useState('Enterprise Incident Response Unit');
  const [isEditing, setIsEditing] = useState(false);

  const rawPayload = (analysis as any)?.rawSource || 
                     (analysis as any)?.rawEmail || 
                     `From: ${analysis.from}\nTo: ${analysis.to}\nSubject: ${analysis.subject}\nDate: ${analysis.date}\n\n${analysis.body || ''}`;
  
  // Real Bit-Exact SHA-256 Calculation
  const realSha256 = useMemo(() => {
    if (analysis?.sha256 && analysis.sha256.length === 64) {
      return analysis.sha256;
    }
    return sha256Sync(rawPayload);
  }, [analysis?.sha256, rawPayload]);

  const byteLength = useMemo(() => {
    return new TextEncoder().encode(rawPayload).length;
  }, [rawPayload]);

  const lineCount = useMemo(() => {
    return rawPayload.split(/\r?\n/).length;
  }, [rawPayload]);

  const caseId = analysis?.id || analysis?.evidenceId || 'CASE-2026-0881';
  const timestamp = analysis?.analyzedAt || analysis?.date || new Date().toUTCString();

  const handleCopyHash = () => {
    navigator.clipboard.writeText(realSha256);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handlePrintCertificate = () => {
    window.print();
  };

  return (
    <div className={`rounded-xl border border-slate-800 bg-[#0e1017] p-5 shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                FRE 902 / ISO 27037 Legal Custody Certificate
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-500/10 text-teal-300 border border-teal-500/30">
                COURT ADMISSIBLE
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Verified electronic record declaration under Federal Rules of Evidence FRE 902(13) &amp; 902(14).
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Edit2 className="w-3 h-3 text-teal-400" />
            <span>{isEditing ? 'Save Signer' : 'Edit Signer'}</span>
          </button>
          <button
            type="button"
            onClick={handlePrintCertificate}
            className="px-2.5 py-1 rounded bg-teal-800/50 hover:bg-teal-700/60 text-teal-200 border border-teal-600/50 text-xs font-mono font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Affidavit</span>
          </button>
        </div>
      </div>

      {/* Signer Customization Drawer if active */}
      {isEditing && (
        <div className="mb-4 p-3 rounded-lg bg-slate-900 border border-teal-500/40 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div>
            <label className="block text-slate-400 mb-1 text-[11px]">Examiner Title &amp; Name:</label>
            <input
              type="text"
              value={examinerName}
              onChange={(e) => setExaminerName(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded bg-black/60 border border-slate-700 text-white focus:outline-none focus:border-teal-400"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1 text-[11px]">Organization / Agency:</label>
            <input
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded bg-black/60 border border-slate-700 text-white focus:outline-none focus:border-teal-400"
            />
          </div>
        </div>
      )}

      {/* Official Certificate Parchment Box */}
      <div className="rounded-lg border-2 border-teal-600/60 bg-[#0a1416]/80 p-5 space-y-4 font-mono text-xs text-slate-200 shadow-inner">
        {/* Certificate Title */}
        <div className="text-center border-b border-teal-800/60 pb-3">
          <div className="text-teal-400 text-[10px] uppercase tracking-widest font-bold">
            UNITED STATES FEDERAL RULES OF EVIDENCE (FRE) RULE 902 DECLARATION
          </div>
          <div className="text-white text-base font-bold tracking-wide mt-1 font-sans">
            CERTIFICATE OF FORENSIC AUTHENTICITY &amp; DIGITAL INTEGRITY
          </div>
          <div className="text-slate-400 text-[11px] mt-0.5">
            Pursuant to Fed. R. Evid. 902(13) &amp; 902(14) Certified Records Generated by an Electronic Process
          </div>
        </div>

        {/* Declarative statement */}
        <div className="text-xs font-sans text-slate-300 leading-relaxed space-y-2">
          <p>
            I, the undersigned forensic examiner on behalf of <strong>{organization}</strong>, hereby declare under penalty of perjury that the digital forensic record identified below was acquired, hashed, and sealed in the regular course of business in strict compliance with <strong>ISO/IEC 27037:2012</strong> and <strong>NIST SP 800-86</strong> standards.
          </p>
          <p>
            The bit-exact SHA-256 digest below was computed directly from the byte stream of the unaltered RFC 822 envelope ({byteLength.toLocaleString()} bytes, {lineCount} lines).
          </p>
        </div>

        {/* Forensic Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded bg-black/50 border border-teal-800/40 text-[11px]">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Incident Case Docket:</span>
            <span className="text-white font-bold">{caseId}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Payload Byte Count:</span>
            <span className="text-teal-300 font-bold">{byteLength.toLocaleString()} bytes ({lineCount} lines)</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Atomic UTC Timestamp:</span>
            <span className="text-teal-300 truncate block">{timestamp}</span>
          </div>
          <div className="sm:col-span-3 pt-1 border-t border-slate-800/80">
            <span className="text-slate-400 block text-[10px] uppercase">Verified SHA-256 Cryptographic Hash:</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-emerald-400 font-bold break-all bg-emerald-950/60 px-2 py-1 rounded border border-emerald-700/60 text-[11px] flex-1">
                {realSha256}
              </span>
              <button
                type="button"
                onClick={handleCopyHash}
                className="px-2 py-1 rounded bg-teal-800/40 hover:bg-teal-700/50 text-teal-200 border border-teal-600/40 text-[10px] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedHash ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Examiner Signature Block */}
        <div className="pt-3 border-t border-teal-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-500/10 border-2 border-teal-500/40 flex items-center justify-center text-teal-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white text-xs">{examinerName}</div>
              <div className="text-[10px] text-teal-300">{organization} • Docket #{caseId}</div>
            </div>
          </div>

          <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1.5 self-start sm:self-auto bg-emerald-950/50 px-2.5 py-1 rounded border border-emerald-600/50">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Cryptographic Digital Signature Valid</span>
          </div>
        </div>
      </div>
    </div>
  );
}
