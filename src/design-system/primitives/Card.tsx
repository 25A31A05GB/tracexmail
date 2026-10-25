import React, { forwardRef } from 'react';

export type CardVariant = 'default' | 'section' | 'interactive' | 'anomaly' | 'alert';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  glow?: boolean;
}

const variantStyles: Record<CardVariant, string> = {
  default:
    'bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-[var(--radius-md)]',
  section:
    'bg-[var(--color-surface-section)] border border-[var(--color-border)] rounded-[var(--radius-lg)]',
  interactive:
    'bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-[var(--radius-md)] hover:border-[var(--color-text-muted)] cursor-pointer transition-all duration-150',
  anomaly:
    'bg-[var(--color-surface-card)] border border-[var(--color-accent-gold-border)] rounded-[var(--radius-md)] shadow-[var(--elevation-anomaly-glow)]',
  alert:
    'bg-[var(--color-surface-card)] border border-[var(--color-semantic-alert-border)] rounded-[var(--radius-md)]'
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', glow = false, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`relative overflow-hidden transition-colors ${variantStyles[variant]} ${
          glow ? 'shadow-[var(--elevation-anomaly-glow)]' : ''
        } ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  action?: React.ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', action, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`p-4 sm:p-5 flex items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] ${className}`}
        {...props}
      >
        <div className="flex flex-col gap-1 min-w-0">{children}</div>
        {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={`text-base font-semibold text-[var(--color-text-primary)] font-sans tracking-tight ${className}`}
        {...props}
      >
        {children}
      </h3>
    );
  }
);

CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className = '', children, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={`text-xs text-[var(--color-text-muted)] font-sans leading-relaxed ${className}`}
    >
      {children}
    </p>
  );
});

CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`p-4 sm:p-5 ${className}`} {...props}>
        {children}
      </div>
    );
  }
);

CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`p-4 sm:p-5 bg-[var(--color-surface-section)] border-t border-[var(--color-border-subtle)] flex items-center justify-between gap-4 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';
