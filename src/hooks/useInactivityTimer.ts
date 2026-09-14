import { useState, useEffect, useCallback, useRef } from 'react';
import { InactivityConfig, WorkspaceLockState } from '../types';

const STORAGE_CONFIG_KEY = 'tracexmail_inactivity_config';
const STORAGE_LOCK_STATE_KEY = 'tracexmail_workspace_locked';

function getStoredAuthToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('tracexmail_enclave_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.token) return parsed.token;
      if (parsed.access_token) return parsed.access_token;
    }
    const sbKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (sbKey) {
      const sbRaw = localStorage.getItem(sbKey);
      if (sbRaw) {
        const sbParsed = JSON.parse(sbRaw);
        if (sbParsed.access_token) return sbParsed.access_token;
      }
    }
  } catch {}
  return null;
}

export const DEFAULT_INACTIVITY_CONFIG: InactivityConfig = {
  enabled: true,
  timeoutMinutes: 15, // Default NIST SP 800-53 Rev 5 AC-11 recommended timeout
  warningSeconds: 60, // 60s pre-lock warning window
  soundAlert: true,
  autoLockOnBlur: false,
  complianceStandard: 'NIST SP 800-53 AC-11'
};

// Web Audio API security alert beep generator
function playWarningChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    // Two-tone attention chime (440Hz -> 660Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, now);
    osc1.frequency.exponentialRampToValueAtTime(660, now + 0.15);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second chime at +0.25s
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(554.37, now + 0.25);
    gain2.gain.setValueAtTime(0.06, now + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.25);
    osc2.stop(now + 0.6);
  } catch {
    // Audio contexts blocked or disabled in iframe/browser
  }
}

export function useInactivityTimer(isAuthenticated: boolean) {
  const [config, setConfig] = useState<InactivityConfig>(() => {
    if (typeof window === 'undefined') return DEFAULT_INACTIVITY_CONFIG;
    try {
      const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (saved) {
        return { ...DEFAULT_INACTIVITY_CONFIG, ...JSON.parse(saved) };
      }
    } catch {}
    return DEFAULT_INACTIVITY_CONFIG;
  });

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(STORAGE_LOCK_STATE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [isWarning, setIsWarning] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(config.timeoutMinutes * 60);
  const [idleSeconds, setIdleSeconds] = useState<number>(0);
  const [lockedAt, setLockedAt] = useState<string | null>(null);
  const [lockReason, setLockReason] = useState<'inactivity' | 'manual' | 'policy'>('inactivity');
  const [unlocking, setUnlocking] = useState<boolean>(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const lastActivityRef = useRef<number>(Date.now());
  const warningFiredRef = useRef<boolean>(false);
  const audioChimePlayedRef = useRef<boolean>(false);

  // Save config changes to localStorage
  const updateConfig = useCallback((partial: Partial<InactivityConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  // Record lock state to server audit log
  const logLockEvent = useCallback(async (reason: 'inactivity' | 'manual' | 'policy', idleSecs: number) => {
    const token = getStoredAuthToken();
    if (!token) return;

    try {
      await fetch('/api/auth/inactivity-lock-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          lockReason: reason,
          idleSeconds: idleSecs,
          timeoutMinutes: config.timeoutMinutes
        })
      });
    } catch (err) {
      console.warn('[InactivityTimer] Audit log warning:', err);
    }
  }, [config.timeoutMinutes]);

  // Lock the workspace immediately
  const lockNow = useCallback((reason: 'inactivity' | 'manual' | 'policy' = 'manual') => {
    setIsLocked(true);
    setIsWarning(false);
    setLockReason(reason);
    const nowIso = new Date().toISOString();
    setLockedAt(nowIso);
    setUnlockError(null);
    try {
      localStorage.setItem(STORAGE_LOCK_STATE_KEY, 'true');
    } catch {}

    const idle = Math.floor((Date.now() - lastActivityRef.current) / 1000);
    logLockEvent(reason, idle);
  }, [logLockEvent]);

  // Extend / Reset session timer
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    warningFiredRef.current = false;
    audioChimePlayedRef.current = false;
    setIsWarning(false);
    setSecondsRemaining(config.timeoutMinutes * 60);
    setIdleSeconds(0);
  }, [config.timeoutMinutes]);

  // Unlock workspace with password or quick session revalidation
  const unlockWorkspace = useCallback(async (password?: string, quickUnlock: boolean = false): Promise<boolean> => {
    setUnlocking(true);
    setUnlockError(null);

    const token = getStoredAuthToken();

    try {
      // If quick unlock with active token
      if (quickUnlock && token) {
        const res = await fetch('/api/auth/unlock-workspace', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ quickUnlock: true })
        });

        if (res.ok) {
          setIsLocked(false);
          setIsWarning(false);
          try {
            localStorage.removeItem(STORAGE_LOCK_STATE_KEY);
          } catch {}
          resetTimer();
          return true;
        }
      }

      // Password-based unlock
      if (!password || password.trim().length === 0) {
        setUnlockError('Please enter your operator password to unlock the workspace.');
        setUnlocking(false);
        return false;
      }

      const res = await fetch('/api/auth/unlock-workspace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          password: password.trim(),
          quickUnlock: false
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setUnlockError(data.error || 'Invalid credentials. Access to workspace denied.');
        setUnlocking(false);
        return false;
      }

      setIsLocked(false);
      setIsWarning(false);
      try {
        localStorage.removeItem(STORAGE_LOCK_STATE_KEY);
      } catch {}
      resetTimer();
      return true;
    } catch (err: any) {
      setUnlockError(err.message || 'Error communicating with security enclave.');
      return false;
    } finally {
      setUnlocking(false);
    }
  }, [resetTimer]);

  // Activity event listener handler (throttled)
  useEffect(() => {
    if (!isAuthenticated || !config.enabled || isLocked) {
      return;
    }

    let lastEventTime = 0;
    const handleUserActivity = () => {
      const now = Date.now();
      // Throttle user activity dispatch to once every 2 seconds
      if (now - lastEventTime > 2000) {
        lastEventTime = now;
        lastActivityRef.current = now;
        if (isWarning) {
          // If warning is open, any intentional user action extends session
          setIsWarning(false);
          warningFiredRef.current = false;
          audioChimePlayedRef.current = false;
        }
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    events.forEach(evt => window.addEventListener(evt, handleUserActivity, { passive: true }));

    // Auto lock on tab blur if strict autoLockOnBlur enabled
    const handleBlur = () => {
      if (config.autoLockOnBlur && !isLocked) {
        lockNow('policy');
      }
    };
    window.addEventListener('blur', handleBlur);

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleUserActivity));
      window.removeEventListener('blur', handleBlur);
    };
  }, [isAuthenticated, config.enabled, config.autoLockOnBlur, isLocked, isWarning, lockNow]);

  // Main 1-second interval timer ticker
  useEffect(() => {
    if (!isAuthenticated || !config.enabled || isLocked) {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastActivityRef.current) / 1000);
      const totalTimeoutSecs = config.timeoutMinutes * 60;
      const remaining = Math.max(0, totalTimeoutSecs - elapsedSeconds);

      setIdleSeconds(elapsedSeconds);
      setSecondsRemaining(remaining);

      // Warning phase trigger
      if (remaining <= config.warningSeconds && remaining > 0) {
        if (!warningFiredRef.current) {
          warningFiredRef.current = true;
          setIsWarning(true);
          if (config.soundAlert && !audioChimePlayedRef.current) {
            audioChimePlayedRef.current = true;
            playWarningChime();
          }
        }
      } else if (remaining > config.warningSeconds) {
        if (warningFiredRef.current) {
          warningFiredRef.current = false;
          audioChimePlayedRef.current = false;
          setIsWarning(false);
        }
      }

      // Auto-lock trigger
      if (remaining <= 0) {
        lockNow('inactivity');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, config.enabled, config.timeoutMinutes, config.warningSeconds, config.soundAlert, isLocked, lockNow]);

  // Global Keyboard shortcut for locking: Cmd+Shift+L / Ctrl+Shift+L
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        e.stopPropagation();
        if (!isLocked) {
          lockNow('manual');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated, isLocked, lockNow]);

  const lockState: WorkspaceLockState = {
    isLocked,
    isWarning,
    secondsRemaining,
    totalTimeoutSeconds: config.timeoutMinutes * 60,
    idleSeconds,
    lockedAt,
    lockReason
  };

  return {
    config,
    updateConfig,
    lockState,
    isLocked,
    isWarning,
    secondsRemaining,
    idleSeconds,
    lockedAt,
    lockReason,
    unlocking,
    unlockError,
    lockNow,
    resetTimer,
    extendSession: resetTimer,
    unlockWorkspace
  };
}
