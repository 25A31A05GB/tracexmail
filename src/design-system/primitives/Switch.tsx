import React, { forwardRef, useId } from 'react';

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      label,
      description,
      onCheckedChange,
      className = '',
      id,
      disabled,
      checked,
      defaultChecked,
      onChange,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const switchId = id || generatedId;
    const descId = `${switchId}-desc`;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onCheckedChange?.(e.target.checked);
    };

    return (
      <div className={`flex items-start justify-between gap-4 ${className}`}>
        {(label || description) && (
          <label htmlFor={switchId} className="flex flex-col cursor-pointer select-none">
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
          </label>
        )}

        <div className="relative inline-flex items-center shrink-0">
          <input
            ref={ref}
            type="checkbox"
            role="switch"
            id={switchId}
            disabled={disabled}
            checked={checked}
            defaultChecked={defaultChecked}
            aria-checked={checked}
            aria-describedby={description ? descId : undefined}
            onChange={handleChange}
            className="peer sr-only"
            {...props}
          />
          <div
            className={`w-11 h-6 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-card)] transition-colors duration-200 cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-border-focus)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--color-surface-page)] peer-checked:bg-[var(--color-accent-gold)] peer-checked:border-[var(--color-accent-gold-border)] ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-[var(--color-text-primary)] shadow-sm transform transition-transform duration-200 mt-0.5 ml-1 peer-checked:translate-x-5 peer-checked:bg-[var(--color-text-inverse)]" />
          </div>
        </div>
      </div>
    );
  }
);

Switch.displayName = 'Switch';
