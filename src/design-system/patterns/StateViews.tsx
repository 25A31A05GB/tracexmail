import React from 'react';
import { AlertCircle, Inbox, RefreshCw, Info } from 'lucide-react';
import { Button } from '../primitives/Button';

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = 'h-4 w-full' }) => {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={`animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-section)] border border-[var(--color-border-subtle)] ${className}`}
    />
  );
};

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon = <Inbox className="w-8 h-8 text-[var(--color-text-muted)]" />,
  actionLabel,
  onAction,
  className = ''
}) => {
  return (
    <div
      className={`p-8 sm:p-12 text-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-card)] flex flex-col items-center justify-center max-w-lg mx-auto ${className}`}
    >
      <div className="w-14 h-14 rounded-full bg-[var(--color-surface-section)] border border-[var(--color-border)] flex items-center justify-center mb-4 text-[var(--color-text-muted)]">
        {icon}
      </div>
      <h3 className="text-base font-semibold font-sans text-[var(--color-text-primary)] mb-1">
        {title}
      </h3>
      <p className="text-xs text-[var(--color-text-muted)] font-sans max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Forensic Analysis Encountered an Error',
  message,
  onRetry,
  className = ''
}) => {
  return (
    <div
      role="alert"
      className={`p-6 rounded-[var(--radius-md)] border border-[var(--color-semantic-alert-border)] bg-[rgba(178,58,46,0.03)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-[var(--radius-sm)] bg-[rgba(178,58,46,0.1)] border border-[var(--color-semantic-alert-border)] flex items-center justify-center shrink-0 text-[var(--color-semantic-alert)]">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold font-sans text-[var(--color-semantic-alert)]">
            {title}
          </h4>
          <p className="text-xs font-sans text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
            {message}
          </p>
        </div>
      </div>

      {onRetry && (
        <Button
          variant="danger"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Retry
        </Button>
      )}
    </div>
  );
};

export interface PartialDataNoticeProps {
  title?: string;
  missingSignals?: string[];
  explanation?: string;
  className?: string;
}

export const PartialDataNotice: React.FC<PartialDataNoticeProps> = ({
  title = 'Offline Holdout: Network Telemetry Omitted',
  missingSignals = ['Authoritative DNS NXDOMAIN', 'SPF/DKIM/DMARC Live Verification', 'MTA Hop RTT Latencies'],
  explanation = 'TraceXMail defense-in-depth engine allocates 80% of threat scoring to network & cryptographic signals. On offline static corpora, scores reflect content-only classifiers.',
  className = ''
}) => {
  return (
    <div
      className={`p-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-section)] flex items-start gap-3 text-xs font-sans text-[var(--color-text-secondary)] ${className}`}
    >
      <Info className="w-4 h-4 text-[var(--color-accent-gold)] shrink-0 mt-0.5" />
      <div className="flex flex-col gap-1 min-w-0">
        <span className="font-semibold text-[var(--color-text-primary)]">
          {title}
        </span>
        <p className="m-0 leading-relaxed text-[var(--color-text-muted)]">
          {explanation}
        </p>
        {missingSignals && missingSignals.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {missingSignals.map((sig) => (
              <span
                key={sig}
                className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] border border-[var(--color-border-subtle)] text-[10.5px] font-mono text-[var(--color-text-muted)]"
              >
                {sig}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
