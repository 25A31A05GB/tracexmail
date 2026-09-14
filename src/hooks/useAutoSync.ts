import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../lib/api';

export interface AutoSyncConfig {
  enabled: boolean;
  interval_seconds: number;
  is_connected: boolean;
  email_address: string | null;
  last_polled_at: string | null;
  is_syncing: boolean;
}

const STORAGE_KEY_ENABLED = 'tracexmail_autosync_enabled';
const STORAGE_KEY_INTERVAL = 'tracexmail_autosync_interval';

export function useAutoSync(onTriggerSync?: () => void | Promise<void>) {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ENABLED);
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const [intervalSeconds, setIntervalSecondsState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_INTERVAL);
      const val = stored ? parseInt(stored, 10) : 30;
      return !isNaN(val) && val >= 5 ? val : 30;
    } catch {
      return 30;
    }
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => new Date());
  const [countdown, setCountdown] = useState<number>(30);
  const [isGmailConnected, setIsGmailConnected] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const countdownRef = useRef<number>(30);
  const intervalSecondsRef = useRef<number>(intervalSeconds);
  const enabledRef = useRef<boolean>(enabled);
  const isSyncingRef = useRef<boolean>(false);

  countdownRef.current = countdown;
  intervalSecondsRef.current = intervalSeconds;
  enabledRef.current = enabled;
  isSyncingRef.current = isSyncing;

  // 1. Fetch initial status & sync config from backend
  const refreshConfig = useCallback(async () => {
    try {
      const res = await apiFetch('/api/gmail/sync-config');
      if (res.ok) {
        const data: AutoSyncConfig = await res.json();
        setIsGmailConnected(data.is_connected);
        if (data.interval_seconds && data.interval_seconds >= 5) {
          setIntervalSecondsState(data.interval_seconds);
          intervalSecondsRef.current = data.interval_seconds;
        }
      }
    } catch (err) {
      console.debug('[useAutoSync] Error fetching sync config:', err);
    }
  }, []);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  // 2. Perform synchronization cycle
  const triggerSyncNow = useCallback(async () => {
    if (isSyncingRef.current) return;
    setIsSyncing(true);
    isSyncingRef.current = true;
    setErrorMsg(null);

    try {
      // 1. Trigger background Gmail poll if connected
      try {
        const gmailRes = await apiFetch('/api/gmail/poll-now', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxResults: 5 })
        });
        if (gmailRes.status === 429) {
          setErrorMsg('Sync rate-limited. Retrying on next scheduled cycle.');
        }
      } catch {
        // non-blocking
      }

      // 2. Trigger case and dashboard data refresh
      if (onTriggerSync) {
        await Promise.resolve(onTriggerSync());
      }

      // 3. Dispatch global custom event for any listeners (CasesView, Live Stream, Metrics)
      window.dispatchEvent(new CustomEvent('TRACEXMAIL_BACKGROUND_SYNC_TRIGGERED', {
        detail: { timestamp: new Date().toISOString() }
      }));

      setLastSyncTime(new Date());
    } catch (err: any) {
      console.warn('[useAutoSync] Sync cycle warning:', err?.message);
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
      setCountdown(intervalSecondsRef.current);
    }
  }, [onTriggerSync]);

  // 3. Update enabled state (both locally and backend)
  const toggleEnabled = useCallback(async (nextVal?: boolean) => {
    const target = typeof nextVal === 'boolean' ? nextVal : !enabledRef.current;
    setEnabledState(target);
    enabledRef.current = target;
    try {
      localStorage.setItem(STORAGE_KEY_ENABLED, String(target));
    } catch {}

    if (target) {
      setCountdown(intervalSecondsRef.current);
    }

    try {
      await apiFetch('/api/gmail/sync-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: target,
          interval_seconds: intervalSecondsRef.current
        })
      });
    } catch {
      // ignore
    }
  }, []);

  // 4. Update interval state (both locally and backend)
  const setPollingInterval = useCallback(async (seconds: number) => {
    const sanitized = Math.max(5, Math.min(600, seconds));
    setIntervalSecondsState(sanitized);
    intervalSecondsRef.current = sanitized;
    setCountdown(sanitized);

    try {
      localStorage.setItem(STORAGE_KEY_INTERVAL, String(sanitized));
    } catch {}

    try {
      await apiFetch('/api/gmail/sync-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: enabledRef.current,
          interval_seconds: sanitized
        })
      });
    } catch {
      // ignore
    }
  }, []);

  // 5. Timer countdown loop
  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Trigger sync on timer expiration
          triggerSyncNow();
          return intervalSecondsRef.current;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [enabled, triggerSyncNow]);

  // 6. Listen for disconnect / config events
  useEffect(() => {
    const handleDisconnect = () => {
      setIsGmailConnected(false);
      refreshConfig();
    };

    const handleConfigChange = (e: any) => {
      if (e?.detail?.config) {
        const cfg = e.detail.config;
        setIsGmailConnected(cfg.is_connected);
      }
    };

    window.addEventListener('GMAIL_DISCONNECTED', handleDisconnect);
    window.addEventListener('AUTO_SYNC_CONFIG_CHANGED', handleConfigChange);

    return () => {
      window.removeEventListener('GMAIL_DISCONNECTED', handleDisconnect);
      window.removeEventListener('AUTO_SYNC_CONFIG_CHANGED', handleConfigChange);
    };
  }, [refreshConfig]);

  return {
    enabled,
    intervalSeconds,
    countdown,
    isSyncing,
    lastSyncTime,
    isGmailConnected,
    errorMsg,
    toggleEnabled,
    setPollingInterval,
    triggerSyncNow,
    refreshConfig
  };
}
