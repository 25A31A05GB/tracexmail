import React, { forwardRef, useId } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options?: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      helperText,
      error,
      options,
      children,
      className = '',
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;

    const hasError = Boolean(error);

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-medium text-[var(--color-text-secondary)] select-none"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center w-full">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
            className={`w-full h-10 pl-3 pr-10 rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] text-[var(--color-text-primary)] text-sm border transition-all duration-150 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
              hasError
                ? 'border-[var(--color-semantic-alert-border)] focus:ring-[var(--color-semantic-alert)]'
                : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
            } ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className="bg-[var(--color-surface-card)] text-[var(--color-text-primary)]"
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <span
            className="absolute right-3 text-[var(--color-text-muted)] pointer-events-none shrink-0"
            aria-hidden="true"
          >
            <ChevronDown className="w-4 h-4" />
          </span>
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

Select.displayName = 'Select';
