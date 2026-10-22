import React from 'react';
import { Server, ArrowDown, Clock, ShieldCheck, ShieldAlert, Globe } from 'lucide-react';
import { Badge } from '../primitives/Badge';

export interface MTAHop {
  index: number;
  from?: string;
  by?: string;
  ip?: string;
  timestamp?: string;
  delayMs?: number;
  asn?: string;
  country?: string;
  tlsVersion?: string;
  isForged?: boolean;
  anomaly?: string;
}

export interface HopTimelineProps {
  hops: MTAHop[];
  className?: string;
  onSelectHop?: (hop: MTAHop) => void;
}

export const HopTimeline: React.FC<HopTimelineProps> = ({
  hops,
  className = '',
  onSelectHop
}) => {
  if (!hops || hops.length === 0) {
    return (
      <div className="p-6 text-center text-xs font-mono text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-surface-card)]">
        NO MTA RECEIVED CHAIN IDENTIFIED IN RFC 822 HEADERS
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {hops.map((hop, i) => {
        const isFirst = i === 0;
        const isLast = i === hops.length - 1;
        const hasAnomaly = Boolean(hop.isForged || hop.anomaly);

        return (
          <div key={hop.index} className="flex flex-col">
            <div
              onClick={() => onSelectHop?.(hop)}
              className={`p-4 rounded-[var(--radius-md)] border transition-all duration-150 ${
                hasAnomaly
                  ? 'border-[var(--color-accent-gold-border)] bg-[rgba(201,162,39,0.02)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-card)] hover:border-[var(--color-text-muted)]'
              } ${onSelectHop ? 'cursor-pointer' : ''}`}
            >
              {/* Hop Header */}
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                      isFirst
                        ? 'bg-[var(--color-accent-gold-muted)] text-[var(--color-accent-gold)] border border-[var(--color-accent-gold-border)]'
                        : isLast
                        ? 'bg-[var(--color-semantic-destination-subtle)] text-[var(--color-semantic-destination)] border border-[var(--color-semantic-destination-border)]'
                        : 'bg-[var(--color-surface-section)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'
                    }`}
                  >
                    {hop.index}
                  </div>
                  <span className="text-xs font-mono font-semibold text-[var(--color-text-primary)]">
                    {isFirst ? 'ORIGIN HOP (INITIAL SENDER)' : isLast ? 'FINAL DESTINATION (MX GATEWAY)' : `RELAY MTA ${hop.index}`}
                  </span>
                  {hasAnomaly ? (
                    <Badge variant="anomaly" size="sm" icon={<ShieldAlert className="w-3 h-3" />}>
                      {hop.isForged ? 'FORGED HOP' : 'DELAY ANOMALY'}
                    </Badge>
                  ) : (
                    <Badge variant="verified" size="sm" icon={<ShieldCheck className="w-3 h-3" />}>
                      VALID
                    </Badge>
                  )}
                </div>

                {hop.delayMs !== undefined && (
                  <div className="flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)]">
                    <Clock className="w-3.5 h-3.5" />
                    <span className={`tabular-nums ${hop.delayMs > 5000 ? 'text-[var(--color-accent-gold)] font-semibold' : ''}`}>
                      +{hop.delayMs.toLocaleString()} ms
                    </span>
                  </div>
                )}
              </div>

              {/* Hop Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono pt-2 border-t border-[var(--color-border-subtle)]">
                <div>
                  <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">From Host:</span>
                  <span className="text-[var(--color-text-primary)] truncate block" title={hop.from || 'Unknown'}>
                    {hop.from || '—'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">By (Recipient MTA):</span>
                  <span className="text-[var(--color-text-primary)] truncate block" title={hop.by || 'Unknown'}>
                    {hop.by || '—'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">IP & Location:</span>
                  <div className="flex items-center gap-1.5 text-[var(--color-text-primary)]">
                    {hop.country && <Globe className="w-3 h-3 text-[var(--color-text-muted)]" />}
                    <span>{hop.ip || '—'} {hop.country ? `(${hop.country})` : ''}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">Autonomous System (ASN):</span>
                  <span className="text-[var(--color-text-muted)] truncate block" title={hop.asn || 'Unresolved'}>
                    {hop.asn || 'Unresolved'}
                  </span>
                </div>
              </div>

              {hop.anomaly && (
                <div className="mt-2.5 pt-2 border-t border-[var(--color-border-subtle)] text-xs text-[var(--color-accent-gold)] font-sans">
                  <strong>Telemetry Flag:</strong> {hop.anomaly}
                </div>
              )}
            </div>

            {/* Connecting Line between hops */}
            {!isLast && (
              <div className="flex items-center justify-center py-1">
                <ArrowDown className="w-4 h-4 text-[var(--color-text-muted)] opacity-60" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

HopTimeline.displayName = 'HopTimeline';
