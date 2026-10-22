import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export type DrawerPosition = 'right' | 'left' | 'bottom';
export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  position?: DrawerPosition;
  size?: DrawerSize;
  className?: string;
  closeOnBackdropClick?: boolean;
}

const widthStyles: Record<DrawerSize, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl'
};

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  position = 'right',
  size = 'md',
  className = '',
  closeOnBackdropClick = true
}) => {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const descId = `${generatedId}-desc`;
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape & Lock body scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    drawerRef.current?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const positionClasses = {
    right: 'inset-y-0 right-0 w-full',
    left: 'inset-y-0 left-0 w-full',
    bottom: 'inset-x-0 bottom-0 max-h-[85vh] w-full'
  }[position];

  const content = (
    <div className="fixed inset-0 z-50 overflow-hidden" role="presentation">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-250"
        aria-hidden="true"
        onClick={closeOnBackdropClick ? onClose : undefined}
      />

      {/* Slide-over Surface */}
      <div className={`fixed ${positionClasses} flex ${position === 'right' ? 'justify-end' : ''}`}>
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={subtitle ? descId : undefined}
          tabIndex={-1}
          className={`relative w-full ${widthStyles[size]} h-full bg-[var(--color-surface-section)] border-l border-[var(--color-border)] shadow-[var(--elevation-2)] flex flex-col focus:outline-none transition-transform duration-250 ${className}`}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-4 sm:p-5 bg-[var(--color-surface-card)] border-b border-[var(--color-border-subtle)] gap-4">
            <div className="flex flex-col gap-1 min-w-0">
              {title && (
                <h2
                  id={titleId}
                  className="text-base font-semibold font-sans text-[var(--color-text-primary)] tracking-tight truncate"
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <p id={descId} className="text-xs text-[var(--color-text-muted)] font-mono truncate">
                  {subtitle}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-[var(--radius-sm)] border border-transparent hover:border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center justify-center transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 text-sm text-[var(--color-text-secondary)]">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="p-4 sm:p-5 bg-[var(--color-surface-card)] border-t border-[var(--color-border-subtle)] flex items-center justify-between gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};

Drawer.displayName = 'Drawer';
