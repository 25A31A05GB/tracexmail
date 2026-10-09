import React from 'react';
import * as Sentry from '@sentry/react';
import { AlertOctagon } from 'lucide-react';

// Add this button component to your app to test Sentry's error tracking
export function ErrorButton() {
  return (
    <button
      onClick={() => {
        throw new Error('This is your first error!');
      }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[rgba(178,58,46,0.15)] hover:bg-[rgba(178,58,46,0.25)] border border-[var(--thread)] text-[var(--rose-400)] text-xs font-mono font-medium transition-colors cursor-pointer"
      title="Test Sentry error tracking by throwing an intentional exception"
    >
      <AlertOctagon className="w-3.5 h-3.5" />
      <span>Break the world</span>
    </button>
  );
}

export default ErrorButton;
