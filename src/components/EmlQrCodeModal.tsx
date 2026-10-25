import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, Download, Copy, Check, Mail, ShieldCheck, AlertCircle } from 'lucide-react';
import { Modal } from '../design-system/primitives/Modal.tsx';
import { Button } from '../design-system/primitives/Button.tsx';
import { Badge } from '../design-system/primitives/Badge.tsx';
import { EmailAnalysis } from '../types';
import { formatAnalysisToEml } from '../utils/formatEvidenceReport';

export interface EmlQrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis?: EmailAnalysis | null;
}

export const EmlQrCodeModal: React.FC<EmlQrCodeModalProps> = ({
  isOpen,
  onClose,
  analysis
}) => {
  const [qrMode, setQrMode] = useState<'eml_data' | 'mailto'>('eml_data');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [generating, setGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !analysis) return;

    let isMounted = true;
    setGenerating(true);
    setErrorMsg(null);

    async function generateQr() {
      try {
        let payload = '';

        if (qrMode === 'mailto') {
          const recipient = analysis?.from || 'sender@domain.com';
          const subj = encodeURIComponent(analysis?.subject || 'Fwd: Forensic Investigation');
          const bodySnippet = encodeURIComponent(
            (analysis?.bodyText || analysis?.body || 'No body content available.').slice(0, 800)
          );
          payload = `mailto:${recipient}?subject=${subj}&body=${bodySnippet}`;
        } else {
          // Standard EML payload
          const emlStr = formatAnalysisToEml(analysis!);
          // If EML exceeds 1800 chars (QR Code Level L capacity limit), optimize payload
          if (emlStr.length > 1800) {
            const parts = emlStr.split(/\r?\n\r?\n/);
            const headers = parts[0];
            const bodyPreview = (parts.slice(1).join('\n') || '').slice(0, 400);
            payload = `${headers}\r\n\r\nX-TraceXMail-Notice: Body truncated for QR scanner capacity\r\n\r\n${bodyPreview}`;
          } else {
            payload = emlStr;
          }
        }

        const dataUrl = await QRCode.toDataURL(payload, {
          errorCorrectionLevel: 'L',
          margin: 2,
          width: 320,
          color: {
            dark: '#100e0c',
            light: '#ffffff'
          }
        });

        if (isMounted) {
          setQrDataUrl(dataUrl);
        }
      } catch (err) {
        console.error('[EmlQrCodeModal] QR generation error:', err);
        if (isMounted) {
          setErrorMsg('Failed to encode payload into QR matrix. Payload exceeds maximum 2D scanner density.');
        }
      } finally {
        if (isMounted) setGenerating(false);
      }
    }

    generateQr();

    return () => {
      isMounted = false;
    };
  }, [isOpen, analysis, qrMode]);

  const handleDownloadQrPng = () => {
    if (!qrDataUrl || !analysis) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `${analysis.id || 'case'}_eml_qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyPayload = async () => {
    if (!analysis) return;
    const emlStr = formatAnalysisToEml(analysis);
    try {
      await navigator.clipboard.writeText(emlStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!analysis) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-[var(--color-accent-gold)]" />
          <span>Mobile EML Import QR Code</span>
        </div>
      }
      description="Scan with a mobile camera or QR reader to import RFC 822 email payload directly into mobile email apps."
      size="md"
    >
      <div className="flex flex-col items-center gap-5">
        {/* Mode Selector */}
        <div className="flex items-center p-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-section)] border border-[var(--color-border)] w-full max-w-sm">
          <button
            type="button"
            onClick={() => setQrMode('eml_data')}
            className={`flex-1 py-1.5 text-xs font-medium font-sans rounded-[calc(var(--radius-sm)-2px)] transition-colors cursor-pointer ${
              qrMode === 'eml_data'
                ? 'bg-[var(--color-accent-gold)] text-[var(--color-text-inverse)] font-semibold shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Standard RFC 822 EML
          </button>
          <button
            type="button"
            onClick={() => setQrMode('mailto')}
            className={`flex-1 py-1.5 text-xs font-medium font-sans rounded-[calc(var(--radius-sm)-2px)] transition-colors cursor-pointer ${
              qrMode === 'mailto'
                ? 'bg-[var(--color-accent-gold)] text-[var(--color-text-inverse)] font-semibold shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Direct mailto: Schema
          </button>
        </div>

        {/* QR Code Container */}
        <div className="p-4 rounded-[var(--radius-md)] bg-white border border-[var(--color-border)] shadow-md flex items-center justify-center min-h-[280px] min-w-[280px] relative">
          {generating ? (
            <div className="flex flex-col items-center gap-2 text-neutral-800 text-xs font-mono">
              <div className="w-6 h-6 border-2 border-neutral-800 border-t-transparent rounded-full animate-spin" />
              <span>Encoding EML matrix...</span>
            </div>
          ) : errorMsg ? (
            <div className="flex flex-col items-center text-center p-4 gap-2 text-red-600 text-xs font-sans">
              <AlertCircle className="w-6 h-6" />
              <span>{errorMsg}</span>
            </div>
          ) : qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="EML Mobile Import QR Code"
              className="w-64 h-64 object-contain"
            />
          ) : null}
        </div>

        {/* Case Metadata Pills */}
        <div className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--color-surface-section)] border border-[var(--color-border-subtle)] flex flex-col gap-1.5 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-text-muted)]">Subject:</span>
            <span className="text-[var(--color-text-primary)] font-semibold truncate max-w-[220px]">
              {analysis.subject || 'No Subject'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-text-muted)]">From:</span>
            <span className="text-[var(--color-text-primary)] truncate max-w-[220px]">
              {analysis.from || 'unknown@domain.com'}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border-subtle)]">
            <span className="text-[var(--color-text-muted)]">Verdict:</span>
            <Badge
              variant={
                analysis.threatVerdict === 'MALICIOUS'
                  ? 'alert'
                  : analysis.threatVerdict === 'SUSPICIOUS'
                  ? 'anomaly'
                  : 'verified'
              }
              size="sm"
            >
              {analysis.threatVerdict || 'UNKNOWN'}
            </Badge>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-3 w-full pt-2 border-t border-[var(--color-border-subtle)] justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyPayload}
            leftIcon={copied ? <Check className="w-3.5 h-3.5 text-[var(--color-semantic-verified)]" /> : <Copy className="w-3.5 h-3.5" />}
          >
            {copied ? 'Copied EML String' : 'Copy EML Payload'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleDownloadQrPng}
            leftIcon={<Download className="w-3.5 h-3.5" />}
            disabled={!qrDataUrl}
          >
            Download QR (PNG)
          </Button>
        </div>
      </div>
    </Modal>
  );
};

EmlQrCodeModal.displayName = 'EmlQrCodeModal';
