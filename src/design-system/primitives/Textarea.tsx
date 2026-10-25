import React, { forwardRef, useId } from 'react';
import { AlertCircle } from 'lucide-react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  mono?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      helperText,
      error,
      mono = false,
      className = '',
      id,
      disabled,
      rows = 4,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const textareaId = id || generatedId;
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;

    const hasError = Boolean(error);

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-xs font-medium text-[var(--color-text-secondary)] select-none"
          >
            {label}
          </label>
        )}

        <div className="relative w-full">
          <textarea
            ref={ref}
            id={textareaId}
            rows={rows}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
            className={`w-full p-3 rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-muted)] border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-y ${
              mono ? 'font-mono text-xs' : 'font-sans'
            } ${
              hasError
                ? 'border-[var(--color-semantic-alert-border)] focus:ring-[var(--color-semantic-alert)]'
                : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
            } ${className}`}
            {...props}
          />
        </div>

        {hasError ? (
          <p id={errorId} className="text-xs text-[var(--color-semantic-alert)] flex items-center gap-1 font-sans">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : (
          helperText && (
            <p id={helperId} className="text-xs text-[var(--color-text-muted)] font-sans">
              {helperText}
            </p>
          )
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
