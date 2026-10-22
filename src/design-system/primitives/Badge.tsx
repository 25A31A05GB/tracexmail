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
  pulsing?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
  verified: {
    container:
      'bg-[var(--color-semantic-verified-subtle)] text-[var(--color-semantic-verified)] border border-[var(--color-semantic-verified-border)]',
    dot: 'bg-[var(--color-semantic-verified)]'
  },
  anomaly: {
    container:
      'bg-[var(--color-semantic-anomaly-subtle)] text-[var(--color-semantic-anomaly)] border border-[var(--color-semantic-anomaly-border)]',
    dot: 'bg-[var(--color-semantic-anomaly)]'
  },
  alert: {
    container:
      'bg-[var(--color-semantic-alert-subtle)] text-[var(--color-semantic-alert)] border border-[var(--color-semantic-alert-border)]',
    dot: 'bg-[var(--color-semantic-alert)]'
  },
  destination: {
    container:
      'bg-[var(--color-semantic-destination-subtle)] text-[var(--color-semantic-destination)] border border-[var(--color-semantic-destination-border)]',
    dot: 'bg-[var(--color-semantic-destination)]'
  },
  intelligence: {
    container:
      'bg-[var(--color-semantic-intelligence-subtle)] text-[var(--color-semantic-intelligence)] border border-[var(--color-semantic-intelligence-border)]',
    dot: 'bg-[var(--color-semantic-intelligence)]'
  },
  neutral: {
    container:
      'bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)]',
    dot: 'bg-[var(--color-text-muted)]'
  }
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-2 py-0.5 gap-1 rounded-[var(--radius-sm)]',
  md: 'text-xs px-2.5 py-1 gap-1.5 rounded-[var(--radius-sm)]'
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'sm',
  pulsing = false,
  icon,
  className = '',
  children,
  ...props
}) => {
  const styles = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center font-mono font-medium uppercase tracking-wider select-none shrink-0 ${styles.container} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {pulsing && (
        <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${styles.dot}`}
          />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${styles.dot}`} />
        </span>
      )}
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

Badge.displayName = 'Badge';
