import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, CheckCircle2, ShieldCheck, Mail, RotateCw, ArrowLeft, KeyRound } from 'lucide-react';

interface OtpVerificationViewProps {
  email: string;
  type: 'signup' | 'recovery' | 'invite';
  onVerified: (data: any) => void;
  onBack: () => void;
  title?: string;
  subtitle?: string;
  extraPayload?: Record<string, any>;
}

export function OtpVerificationModal({
  email,
  type,
  onVerified,
  onBack,
  title,
  subtitle,
  extraPayload = {}
}: OtpVerificationViewProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Send initial OTP on mount
  useEffect(() => {
    let isMounted = true;

    async function sendInitialOtp() {
      try {
        const res = await fetch('/api/auth/otp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, type, payload: extraPayload })
        });
        const data = await res.json();
        if (isMounted) {
          if (data.preview_code) {
            setPreviewCode(data.preview_code);
          }
          setSuccessMsg(`A 6-digit verification code was dispatched to ${email}.`);
        }
      } catch (err) {
        console.warn('[OTP] Initial dispatch error:', err);
      }
    }

    sendInitialOtp();

    // Auto focus first digit input
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);

    return () => {
      isMounted = false;
    };
  }, [email, type]);

  // Resend countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleDigitChange = (index: number, val: string) => {
    // Only accept numeric characters
    const cleanVal = val.replace(/\D/g, '');
    
    // Handle paste of full 6-digit code
    if (cleanVal.length > 1) {
      const codeDigits = cleanVal.slice(0, 6).split('');
      const newDigits = [...digits];
      codeDigits.forEach((char, i) => {
        newDigits[i] = char;
      });
      setDigits(newDigits);
      const nextFocus = Math.min(codeDigits.length, 5);
      inputRefs.current[nextFocus]?.focus();

      if (codeDigits.length === 6) {
        triggerVerification(newDigits.join(''));
      }
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleanVal;
    setDigits(newDigits);
    setErrorMsg(null);

    // Auto-advance to next input
    if (cleanVal && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // If all 6 digits filled, trigger auto-submit
    if (cleanVal && index === 5) {
      const fullCode = newDigits.join('');
      if (fullCode.length === 6) {
        triggerVerification(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setDigits(newDigits);
    const nextFocus = Math.min(pasted.length, 5);
    inputRefs.current[nextFocus]?.focus();

    if (pasted.length === 6) {
      triggerVerification(pasted);
    }
  };

  const triggerVerification = async (codeToVerify?: string) => {
    const fullCode = codeToVerify || digits.join('');
    if (fullCode.length < 6) {
      setErrorMsg('Please enter all 6 digits of your verification code.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code: fullCode,
          type,
          ...extraPayload
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Invalid verification code. Please check and try again.');
        setLoading(false);
        return;
      }

      setSuccessMsg('Security code confirmed! Finalizing session…');
      setTimeout(() => {
        onVerified(data);
      }, 500);
    } catch (err: any) {
      console.error('[OTP] Verification error:', err);
      setErrorMsg(err.message || 'An unexpected verification error occurred.');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;

    setResending(true);
    setErrorMsg(null);
    setDigits(['', '', '', '', '', '']);

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type, payload: extraPayload })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to dispatch verification code.');
      } else {
        if (data.preview_code) {
          setPreviewCode(data.preview_code);
        }
        setSuccessMsg(`A new 6-digit code has been dispatched to ${email}.`);
        setCountdown(60);
        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 100);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error resending code.');
    } finally {
      setResending(false);
    }
  };

  const defaultTitle = type === 'signup' 
    ? 'Verify Your Email' 
    : type === 'recovery' 
    ? 'Enter Security Code' 
    : 'Confirm Invitation';

  const defaultSubtitle = `Enter the 6-digit verification code sent to ${email} to complete verification.`;

  return (
    <div className="space-y-5">
      {/* Top navigation */}
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
        <button
          type="button"
          onClick={onBack}
          className="text-[var(--paper-dim)] hover:text-[var(--paper)] text-xs flex items-center gap-1.5 transition-colors cursor-pointer bg-transparent border-0 p-0"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[var(--thread)]" />
          <span>Back</span>
        </button>

        <div className="font-mono text-[10.5px] text-[var(--stamp)] uppercase tracking-wider flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--forensic-green)]" />
          <span>ONE-TIME PASSWORD</span>
        </div>
      </div>

      {/* Header Info */}
      <div className="space-y-1 text-center">
        <div className="w-12 h-12 rounded-full bg-[rgba(201,162,39,0.12)] border border-[var(--stamp)] text-[var(--stamp)] flex items-center justify-center mx-auto mb-2">
          <KeyRound className="w-6 h-6" />
        </div>
        <h3 className="font-display font-bold text-lg text-[var(--paper)] tracking-tight">
          {title || defaultTitle}
        </h3>
        <p className="text-xs text-[var(--paper-dim)] leading-relaxed max-w-sm mx-auto">
          {subtitle || defaultSubtitle}
        </p>
      </div>

      {/* Dev / Testing Quick Access Code Badge */}
      {previewCode && (
        <div className="p-2.5 rounded-[2px] bg-[rgba(201,162,39,0.12)] border border-[var(--stamp)]/60 text-center text-xs flex items-center justify-between px-3">
          <span className="text-[11px] font-mono text-[var(--paper-dim)]">SOC Testing Preview:</span>
          <button
            type="button"
            onClick={() => {
              const codeArr = previewCode.split('');
              setDigits(codeArr);
              triggerVerification(previewCode);
            }}
            className="font-mono font-bold text-[var(--stamp)] hover:underline cursor-pointer bg-transparent border-0 text-xs flex items-center gap-1"
            title="Click to auto-fill preview code"
          >
            <span>Code: {previewCode}</span>
            <span className="text-[10px] text-[var(--paper-dim)] font-normal">(Click to autofill)</span>
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-[2px] bg-[rgba(178,58,46,0.15)] border border-[var(--thread)] text-[var(--rose-300)] text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--thread)]" />
          <div className="leading-relaxed font-sans flex-1">{errorMsg}</div>
        </div>
      )}

      {successMsg && !errorMsg && (
        <div className="p-3 rounded-[2px] bg-[rgba(72,169,117,0.15)] border border-[var(--forensic-green)] text-[var(--paper)] text-xs flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[var(--forensic-green)]" />
          <div className="leading-relaxed font-sans">{successMsg}</div>
        </div>
      )}

      {/* 6-Digit Code Input Box */}
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-2 sm:gap-2.5" onPaste={handlePaste}>
          {digits.map((digit, idx) => (
            <input
              key={idx}
              ref={el => {
                inputRefs.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digit}
              disabled={loading}
              onChange={e => handleDigitChange(idx, e.target.value)}
              onKeyDown={e => handleKeyDown(idx, e)}
              className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-mono font-bold bg-[var(--ink)] border border-[var(--line)] rounded-sm text-[var(--paper)] focus:outline-none focus:border-[var(--stamp)] focus:ring-1 focus:ring-[var(--stamp)] disabled:opacity-50 transition-all shadow-inner"
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => triggerVerification()}
          disabled={loading || digits.join('').length < 6}
          className="w-full py-2.5 px-4 bg-[var(--stamp)] text-[var(--ink)] font-bold text-xs tracking-wider uppercase rounded-sm hover:brightness-110 active:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Verifying Code…</span>
            </>
          ) : (
            <span>Verify & Continue</span>
          )}
        </button>

        {/* Resend Action & Countdown */}
        <div className="flex items-center justify-between text-xs text-[var(--paper-dim)] pt-2 border-t border-[var(--line)]">
          <span className="text-[11.5px]">Didn&apos;t receive the code?</span>
          {countdown > 0 ? (
            <span className="font-mono text-[11px] text-[var(--slate)]">
              Resend in {countdown}s
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-[11px] font-mono text-[var(--stamp)] hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
            >
              <RotateCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
              <span>{resending ? 'Sending…' : 'Resend Code'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
