import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp, Terminal, Shield } from 'lucide-react';
import { Badge } from './Badge';

export interface ForensicContainerProps {
  title: string;
  subtitle?: string;
  rawContent: string;
  sha256?: string;
  statusBadge?: {
    variant: 'verified' | 'anomaly' | 'alert' | 'destination' | 'intelligence' | 'neutral';
    label: string;
  };
  initialExpanded?: boolean;
  className?: string;
  maxHeight?: string;
}

export const ForensicContainer: React.FC<ForensicContainerProps> = ({
  title,
  subtitle,
  rawContent,
  sha256,
  statusBadge,
  initialExpanded = true,
  className = '',
  maxHeight = 'max-h-96'
}) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = rawContent;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={`rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-section)] overflow-hidden transition-all duration-150 ${className}`}
    >
      {/* Container Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-surface-card)] border-b border-[var(--color-border-subtle)] gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--color-surface-section)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
            <Terminal className="w-3.5 h-3.5 text-[var(--color-accent-gold)]" aria-hidden="true" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold font-mono tracking-tight text-[var(--color-text-primary)] truncate">
                {title}
              </span>
              {statusBadge && (
                <Badge variant={statusBadge.variant} size="sm">
                  {statusBadge.label}
                </Badge>
              )}
            </div>
            {subtitle && (
              <span className="text-[11px] text-[var(--color-text-muted)] font-mono truncate">
                {subtitle}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {sha256 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-section)] border border-[var(--color-border-subtle)] text-[10px] font-mono text-[var(--color-text-muted)]">
              <Shield className="w-3 h-3 text-[var(--color-accent-gold)]" />
              <span>SHA-256: {sha256.slice(0, 8)}...{sha256.slice(-6)}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-section)] text-[var(--color-text-primary)] hover:border-[var(--color-accent-gold)] hover:text-[var(--color-accent-gold)] transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-border-focus)]"
            title="Copy raw telemetry"
            aria-label="Copy raw telemetry"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[var(--color-semantic-verified)]" />
                <span className="text-[var(--color-semantic-verified)] text-[11px]">COPIED</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="text-[11px]">COPY</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-section)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-border-focus)]"
            title={isExpanded ? 'Collapse' : 'Expand'}
            aria-label={isExpanded ? 'Collapse telemetry view' : 'Expand telemetry view'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Raw Payload Stream */}
      {isExpanded && (
        <div className={`p-4 overflow-x-auto overflow-y-auto ${maxHeight} font-mono text-xs leading-relaxed text-[var(--color-text-secondary)] select-text`}>
          <pre className="whitespace-pre font-mono text-[11.5px] leading-5 m-0">
            {rawContent}
          </pre>
        </div>
      )}
    </div>
  );
};

ForensicContainer.displayName = 'ForensicContainer';
