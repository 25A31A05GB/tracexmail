import { useState, useEffect, useCallback } from 'react';

export interface OnlineStatusState {
  isOnline: boolean;
  offlineSince: Date | null;
  wasOffline: boolean;
  isReconnecting: boolean;
  checkConnection: () => Promise<boolean>;
}

export function useOnlineStatus(): OnlineStatusState {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });

  const [offlineSince, setOfflineSince] = useState<Date | null>(null);
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    setIsReconnecting(true);
    try {
      // Perform a lightweight probe to the local backend / health endpoint
      const response = await fetch('/api/samples', {
        method: 'HEAD',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const online = response.ok || response.status < 500;
      setIsOnline(online);
      if (online && offlineSince) {
        setWasOffline(true);
        setOfflineSince(null);
      }
      return online;
    } catch {
      setIsOnline(false);
      if (!offlineSince) {
        setOfflineSince(new Date());
      }
      return false;
    } finally {
      setIsReconnecting(false);
    }
  }, [offlineSince]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (offlineSince) {
        setWasOffline(true);
        setOfflineSince(null);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setOfflineSince(new Date());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [offlineSince]);

  // Clear wasOffline badge after 5 seconds
  useEffect(() => {
    if (wasOffline && isOnline) {
      const timer = setTimeout(() => setWasOffline(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [wasOffline, isOnline]);

  return {
    isOnline,
    offlineSince,
    wasOffline,
    isReconnecting,
    checkConnection
  };
}
