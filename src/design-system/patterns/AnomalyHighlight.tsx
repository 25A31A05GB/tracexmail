import React from 'react';
import { AlertTriangle, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';

export interface AnomalyHighlightProps {
  title: string;
  threatType: string;
  mitreId?: string;
  mitreTactic?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceScore: number;
  explanation: string;
  recommendedAction: string;
  onTakeAction?: () => void;
  actionLabel?: string;
  className?: string;
}

const severityBadgeMap: Record<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW', 'alert' | 'anomaly' | 'verified' | 'neutral'> = {
  CRITICAL: 'alert',
  HIGH: 'alert',
  MEDIUM: 'anomaly',
  LOW: 'verified'
};

export const AnomalyHighlight: React.FC<AnomalyHighlightProps> = ({
  title,
  threatType,
  mitreId,
  mitreTactic,
  severity,
  confidenceScore,
  explanation,
  recommendedAction,
  onTakeAction,
  actionLabel = 'ISOLATE & REMEDIATE',
  className = ''
}) => {
  return (
    <div
      className={`relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-accent-gold-border)] bg-[var(--color-surface-section)] shadow-[var(--elevation-anomaly-glow)] transition-all p-5 sm:p-6 ${className}`}
    >
      {/* Top Gold Anomaly Accent Indicator Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--color-accent-gold)]" />

      {/* Header Info */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-accent-gold-muted)] border border-[var(--color-accent-gold-border)] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-[var(--color-accent-gold)]" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-semibold tracking-wider text-[var(--color-accent-gold)] uppercase">
                PRIMARY FORENSIC ANOMALY
              </span>
              <Badge variant={severityBadgeMap[severity]} size="sm">
                {severity} RISK ({confidenceScore}% CONFIDENCE)
              </Badge>
            </div>
            <h2 className="text-lg sm:text-xl font-display font-semibold text-[var(--color-text-primary)] mt-0.5">
              {title}
            </h2>
          </div>
        </div>

        {mitreId && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] border border-[var(--color-border)] text-xs font-mono text-[var(--color-text-muted)]">
            <ShieldAlert className="w-3.5 h-3.5 text-[var(--color-accent-gold)]" />
            <span className="text-[var(--color-text-primary)] font-semibold">{mitreId}</span>
            {mitreTactic && <span className="hidden sm:inline text-[var(--color-text-muted)]">• {mitreTactic}</span>}
          </div>
        )}
      </div>

      {/* Forensic Explanation */}
      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-card)] border border-[var(--color-border-subtle)] p-4 mb-4">
        <span className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">
          ANALYSIS FINDING: {threatType}
        </span>
        <p className="text-sm font-sans text-[var(--color-text-primary)] leading-relaxed m-0">
          {explanation}
        </p>
      </div>

      {/* Recommended SOC Action Footer */}
      <div className="flex items-center justify-between gap-4 flex-wrap pt-2 border-t border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="w-4 h-4 text-[var(--color-semantic-verified)] shrink-0" />
          <span className="text-xs font-sans text-[var(--color-text-secondary)]">
            <strong className="text-[var(--color-text-primary)] font-medium">Recommended Action:</strong>{' '}
            {recommendedAction}
          </span>
        </div>

        {onTakeAction && (
          <Button
            variant="primary"
            size="sm"
            onClick={onTakeAction}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
};

AnomalyHighlight.displayName = 'AnomalyHighlight';
