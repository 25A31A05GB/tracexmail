import React from 'react';

export type BadgeVariant =
  | 'verified'
  | 'anomaly'
  | 'alert'
  | 'destination'
  | 'intelligence'
  | 'neutral';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  pulsing?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  verified:
    'bg-[var(--color-semantic-verified-subtle)] text-[var(--color-semantic-verified)] border border-[var(--color-semantic-verified-border)]',
  anomaly:
    'bg-[var(--color-accent-gold-muted)] text-[var(--color-accent-gold)] border border-[var(--color-accent-gold-border)]',
  alert:
    'bg-[rgba(178,58,46,0.15)] text-[var(--color-semantic-alert)] border border-[var(--color-semantic-alert-border)]',
  destination:
    'bg-[var(--color-semantic-destination-subtle)] text-[var(--color-semantic-destination)] border border-[var(--color-semantic-destination-border)]',
  intelligence:
    'bg-[var(--color-semantic-intelligence-subtle)] text-[var(--color-semantic-intelligence)] border border-[var(--color-semantic-intelligence-border)]',
  neutral:
    'bg-[var(--color-surface-card)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[10px] gap-1 rounded-[var(--radius-sm)] font-mono',
  md: 'px-2.5 py-1 text-xs gap-1.5 rounded-[var(--radius-sm)] font-mono'
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  icon,
  pulsing = false,
  children,
  className = '',
  ...props
}) => {
  return (
    <span
      className={`inline-flex items-center font-semibold tracking-wider uppercase select-none ${
        variantStyles[variant]
      } ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {pulsing && (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      {children && <span>{children}</span>}
    </span>
  );
};

Badge.displayName = 'Badge';
