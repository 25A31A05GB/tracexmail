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
}

const sizeWidthStyles: Record<DrawerSize, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
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
  className = ''
}) => {
  const generatedId = useId();
  const titleId = `${generatedId}-drawer-title`;
  const drawerRef = useRef<HTMLDivElement>(null);

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

  const content = (
    <div className="fixed inset-0 z-50 overflow-hidden" role="presentation">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-200"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Slide Panel */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className={`aria-hidden:pointer-events-none fixed inset-y-0 ${
            position === 'right' ? 'right-0' : position === 'left' ? 'left-0' : 'bottom-0 inset-x-0'
          } flex max-w-full pl-10`}
        >
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            className={`pointer-events-auto w-screen ${sizeWidthStyles[size]} bg-[var(--color-surface-card)] border-l border-[var(--color-border)] shadow-[var(--elevation-3)] flex flex-col focus:outline-none ${className}`}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-[var(--color-border-subtle)] flex items-start justify-between gap-4">
              <div className="flex flex-col min-w-0">
                {title && (
                  <h2
                    id={titleId}
                    className="text-base font-semibold font-sans text-[var(--color-text-primary)] tracking-tight truncate"
                  >
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-xs font-mono text-[var(--color-text-muted)] truncate mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-[var(--radius-sm)] border border-transparent hover:border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center justify-center transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
                aria-label="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 font-sans text-sm text-[var(--color-text-secondary)]">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="p-4 sm:p-5 bg-[var(--color-surface-section)] border-t border-[var(--color-border-subtle)] flex items-center justify-end gap-3">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};

Drawer.displayName = 'Drawer';
