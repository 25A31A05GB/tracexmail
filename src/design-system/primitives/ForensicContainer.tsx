import React, { forwardRef } from 'react';

export interface ForensicContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  bordered?: boolean;
}

export const ForensicContainer = forwardRef<HTMLDivElement, ForensicContainerProps>(
  ({ bordered = true, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 ${
          bordered ? 'border-x border-[var(--color-border-subtle)]' : ''
        } ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ForensicContainer.displayName = 'ForensicContainer';
