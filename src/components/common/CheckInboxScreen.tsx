import React, { useState, useEffect } from 'react';
import { Mail, RefreshCw, ArrowLeft, ShieldAlert } from 'lucide-react';

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.trim().toLowerCase().split('@');
  const maskedLocal = local.length <= 2
    ? `${local[0]}*`
    : `${local[0]}${'*'.repeat(Math.min(5, Math.max(3, local.length - 2)))}${local[local.length - 1]}`;

  const domainParts = domain.split('.');
  const maskedDomain = domainParts.map((part, idx) => {
    if (idx === domainParts.length - 1) return part; // Keep TLD visible
    if (part.length <= 2) return `${part[0]}*`;
    return `${part[0]}${'*'.repeat(Math.min(4, Math.max(2, part.length - 2)))}${part[part.length - 1]}`;
  }).join('.');

  return `${maskedLocal}@${maskedDomain}`;
}

export interface CheckInboxScreenProps {
  email: string;
  title?: string;
  description?: string;
  onResend: () => Promise<void> | void;
  onChangeEmail: () => void;
  onBackToLogin: () => void;
}

export function CheckInboxScreen({
  email,
  title = 'Check your inbox',
  description = 'We sent instructions and a single-use verification link to your work email.',
  onResend,
  onChangeEmail,
  onBackToLogin
}: CheckInboxScreenProps) {
  const [countdown, setCountdown] = useState<number>(30);
  const [resending, setResending] = useState<boolean>(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleResendClick = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setResendStatus(null);
    try {
      await onResend();
      setResendStatus('A fresh verification link has been sent.');
      setCountdown(30);
    } catch {
      setResendStatus('Unable to resend at this moment. Please wait and try again.');
    } finally {
      setResending(false);
    }
  };

  const masked = maskEmail(email);

  return (
    <div className="w-full max-w-md mx-auto space-y-6 text-left">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-[rgba(201,162,39,0.12)] border border-[#3a352c] text-[#c9a227] flex items-center justify-center mx-auto mb-2">
          <Mail className="w-6 h-6" aria-hidden="true" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-[#ede6d8]">
          {title}
        </h2>
        <p className="text-sm text-[#94a3b8] leading-relaxed">
          {description}
        </p>
        <div className="inline-block px-3 py-1.5 rounded bg-[#171410] border border-[#3a352c] font-mono text-sm text-[#c9a227]">
          {masked}
        </div>
      </div>

      <div className="p-4 rounded bg-[#171410] border border-[#3a352c] space-y-2 text-xs text-[#94a3b8]">
        <div className="flex items-center gap-2 text-[#ede6d8] font-semibold">
          <ShieldAlert className="w-4 h-4 text-[#c9a227] shrink-0" aria-hidden="true" />
          <span>Security &amp; Expiry Notice</span>
        </div>
        <p className="leading-relaxed">
          For your protection, this single-use link expires in <strong>15 minutes</strong> and can only be used once.
        </p>
        <p className="text-[#8a8070] pt-1 border-t border-[#3a352c]/60">
          Didn't receive it? Please check your spam or junk folder, or verify the email address.
        </p>
      </div>

      {resendStatus && (
        <div className="p-3 rounded bg-[#171410] border border-[#48a975] text-xs text-[#ede6d8] font-sans">
          {resendStatus}
        </div>
      )}

      <div className="space-y-3 pt-2">
        <button
          type="button"
          onClick={handleResendClick}
          disabled={countdown > 0 || resending}
          className="w-full py-2.5 px-4 rounded bg-[#171410] border border-[#3a352c] hover:border-[#c9a227] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-[#ede6d8] transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#94a3b8] ${resending ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>
            {countdown > 0
              ? `Resend available in ${countdown}s`
              : resending
              ? 'Sending…'
              : 'Resend email'}
          </span>
        </button>

        <button
          type="button"
          onClick={onChangeEmail}
          className="w-full py-2 px-3 text-xs text-[#94a3b8] hover:text-[#ede6d8] transition-colors text-center cursor-pointer bg-transparent border-0"
        >
          Use a different email address
        </button>

        <div className="pt-2 border-t border-[#3a352c]/50">
          <button
            type="button"
            onClick={onBackToLogin}
            className="w-full py-2 px-3 text-xs text-[#94a3b8] hover:text-[#ede6d8] transition-colors flex items-center justify-center gap-1.5 cursor-pointer bg-transparent border-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to sign in</span>
          </button>
        </div>
      </div>
    </div>
  );
}
