import React from 'react';
import { HelpCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '../primitives/Card';
import { Tooltip } from '../primitives/Tooltip';

export type MetricStatus = 'clean' | 'anomaly' | 'alert' | 'neutral';

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  secondaryValue?: string;
  tooltip?: string;
  icon?: React.ReactNode;
  status?: MetricStatus;
  trend?: {
    value: number | string;
    direction: 'up' | 'down' | 'neutral';
    isPositive?: boolean;
    label?: string;
  };
  className?: string;
  onClick?: () => void;
}

const statusBorderMap: Record<MetricStatus, string> = {
  clean: 'border-[var(--color-border)] hover:border-[var(--color-semantic-verified-border)]',
  anomaly: 'border-[var(--color-accent-gold-border)] bg-[rgba(201,162,39,0.02)]',
  alert: 'border-[var(--color-semantic-alert-border)] bg-[rgba(178,58,46,0.02)]',
  neutral: 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
};

const statusValueColorMap: Record<MetricStatus, string> = {
  clean: 'text-[var(--color-semantic-verified)]',
  anomaly: 'text-[var(--color-accent-gold)]',
  alert: 'text-[var(--color-semantic-alert)]',
  neutral: 'text-[var(--color-text-primary)]'
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  secondaryValue,
  tooltip,
  icon,
  status = 'neutral',
  trend,
  className = '',
  onClick
}) => {
  return (
    <Card
      variant={onClick ? 'interactive' : 'default'}
      onClick={onClick}
      className={`p-4 sm:p-5 flex flex-col justify-between ${statusBorderMap[status]} ${className}`}
    >
      {/* Top Header: Label, Tooltip & Icon */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium text-[var(--color-text-secondary)] font-sans truncate select-none">
            {label}
          </span>
          {tooltip && (
            <Tooltip content={tooltip} position="top">
              <button
                type="button"
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-help focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-border-focus)] rounded-full"
                aria-label={`Information about ${label}`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          )}
        </div>

        {icon && (
          <div className="text-[var(--color-text-muted)] shrink-0">
            {icon}
          </div>
        )}
      </div>

      {/* Main Metric Value */}
      <div className="flex items-baseline gap-1.5 my-1">
        <span
          className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums select-all ${statusValueColorMap[status]}`}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs font-mono text-[var(--color-text-muted)] uppercase">
            {unit}
          </span>
        )}
      </div>

      {/* Bottom Row: Trend or Secondary Context */}
      <div className="flex items-center justify-between text-xs font-sans mt-2 pt-2 border-t border-[var(--color-border-subtle)] gap-2">
        {trend ? (
          <div className="flex items-center gap-1">
            {trend.direction === 'up' && (
              <TrendingUp
                className={`w-3.5 h-3.5 ${
                  trend.isPositive
                    ? 'text-[var(--color-semantic-verified)]'
                    : 'text-[var(--color-semantic-alert)]'
                }`}
              />
            )}
            {trend.direction === 'down' && (
              <TrendingDown
                className={`w-3.5 h-3.5 ${
                  trend.isPositive
                    ? 'text-[var(--color-semantic-verified)]'
                    : 'text-[var(--color-semantic-alert)]'
                }`}
              />
            )}
            {trend.direction === 'neutral' && (
              <Minus className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            )}
            <span
              className={`font-mono text-xs font-medium tabular-nums ${
                trend.direction === 'neutral'
                  ? 'text-[var(--color-text-muted)]'
                  : trend.isPositive
                  ? 'text-[var(--color-semantic-verified)]'
                  : 'text-[var(--color-semantic-alert)]'
              }`}
            >
              {trend.value}
            </span>
            {trend.label && (
              <span className="text-[var(--color-text-muted)] text-[11px] truncate">
                {trend.label}
              </span>
            )}
          </div>
        ) : secondaryValue ? (
          <span className="text-[var(--color-text-muted)] text-[11px] font-mono truncate">
            {secondaryValue}
          </span>
        ) : (
          <span className="text-[var(--color-text-muted)] text-[11px] font-mono">
            LIVE TELEMETRY
          </span>
        )}
      </div>
    </Card>
  );
};

MetricCard.displayName = 'MetricCard';
