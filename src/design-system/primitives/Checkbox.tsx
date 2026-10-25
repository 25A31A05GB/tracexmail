import React, { forwardRef, useId } from 'react';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      description,
      error,
      className = '',
      id,
      disabled,
      checked,
      defaultChecked,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const checkboxId = id || generatedId;
    const errorId = `${checkboxId}-error`;
    const descId = `${checkboxId}-desc`;

    const hasError = Boolean(error);

    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <label
          htmlFor={checkboxId}
          className={`inline-flex items-start gap-2.5 cursor-pointer select-none ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <div className="relative flex items-center justify-center shrink-0 mt-0.5">
            <input
              ref={ref}
              type="checkbox"
              id={checkboxId}
              disabled={disabled}
              checked={checked}
              defaultChecked={defaultChecked}
              aria-invalid={hasError}
              aria-describedby={hasError ? errorId : description ? descId : undefined}
              className="peer sr-only"
              {...props}
            />
            <div
              className={`w-4 h-4 rounded-[var(--radius-sm)] border transition-all duration-150 flex items-center justify-center bg-[var(--color-surface-card)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-border-focus)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--color-surface-page)] peer-checked:bg-[var(--color-accent-gold)] peer-checked:border-[var(--color-accent-gold-border)] ${
                hasError
                  ? 'border-[var(--color-semantic-alert-border)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
              }`}
            >
              <Check className="w-3 h-3 text-[var(--color-text-inverse)] opacity-0 peer-checked:opacity-100 transition-opacity stroke-[3]" />
            </div>
          </div>

          {(label || description) && (
            <div className="flex flex-col">
              {label && (
                <span className="text-sm font-medium text-[var(--color-text-primary)] leading-snug">
                  {label}
                </span>
              )}
              {description && (
                <span id={descId} className="text-xs text-[var(--color-text-muted)] leading-normal mt-0.5">
                  {description}
                </span>
              )}
            </div>
          )}
        </label>

        {hasError && (
          <p id={errorId} className="text-xs text-[var(--color-semantic-alert)] pl-6.5 font-sans">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
