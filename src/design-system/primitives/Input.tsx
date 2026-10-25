import React, { forwardRef, useId } from 'react';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      mono = false,
      className = '',
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const hasError = Boolean(error);

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-[var(--color-text-secondary)] select-none"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center w-full">
          {leftIcon && (
            <span
              className="absolute left-3 text-[var(--color-text-muted)] pointer-events-none shrink-0"
              aria-hidden="true"
            >
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
            className={`w-full h-10 px-3 rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-muted)] border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
              leftIcon ? 'pl-9' : ''
            } ${rightIcon || hasError ? 'pr-9' : ''} ${
              mono ? 'font-mono text-xs' : 'font-sans'
            } ${
              hasError
                ? 'border-[var(--color-semantic-alert-border)] focus:ring-[var(--color-semantic-alert)]'
                : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
            } ${className}`}
            {...props}
          />

          {hasError ? (
            <span
              className="absolute right-3 text-[var(--color-semantic-alert)] pointer-events-none shrink-0"
              aria-hidden="true"
            >
              <AlertCircle className="w-4 h-4" />
            </span>
          ) : (
            rightIcon && (
              <span className="absolute right-3 text-[var(--color-text-muted)] shrink-0">
                {rightIcon}
              </span>
            )
          )}
        </div>

        {hasError ? (
          <p id={errorId} className="text-xs text-[var(--color-semantic-alert)] flex items-center gap-1 font-sans">
            {error}
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

Input.displayName = 'Input';
