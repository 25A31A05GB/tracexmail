import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface WebSocketAlert {
  id: string;
  case_id?: string;
  timestamp: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  title: string;
  description: string;
  source?: string;
  read?: boolean;
  threat_score?: number;
  category?: string;
  sender?: string;
  subject?: string;
}

const INITIAL_ALERTS: WebSocketAlert[] = [
  {
    id: 'alt_001',
    case_id: 'sample-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    severity: 'CRITICAL',
    title: 'BEC Payroll Spoofing Attack Detected',
    description: 'CEO impersonation attempting wire redirection. SPF neutral, display name mismatch, urgence trigger.',
    source: 'mail-gateway-01',
    read: false,
    threat_score: 92,
    category: 'BEC_IMPERSONATION',
    sender: 'ceo-office@company-exec.net',
    subject: 'URGENT: Updated Direct Deposit Routing'
  },
  {
    id: 'alt_002',
    case_id: 'sample-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    severity: 'HIGH',
    title: 'Credential Harvester Landing Page Identified',
    description: 'Obfuscated JavaScript redirecting to cloned Microsoft 365 sign-in page on Russian bulletproof ASN.',
    source: 'pipeline-heuristics',
    read: false,
    threat_score: 84,
    category: 'CREDENTIAL_HARVESTING',
    sender: 'security@microsoft-auth-verify.com',
    subject: 'Action Required: Verify Office 365 Password Expiry'
  },
  {
    id: 'alt_003',
    case_id: 'sample-3',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    severity: 'MEDIUM',
    title: 'Anomalous Email Hop Timing (14s latency in AS4837)',
    description: 'Unusual delay detected between internal gateway and external relay node.',
    source: 'traceroute-engine',
    read: true,
    threat_score: 55,
    category: 'HOP_ANOMALY',
    sender: 'billing@vendor-supplies.co.uk',
    subject: 'Invoice #884920 Overdue Notification'
  }
];

export function useWebSocketAlerts() {
  const [alerts, setAlerts] = useState<WebSocketAlert[]>(INITIAL_ALERTS);
  const [activeToast, setActiveToast] = useState<WebSocketAlert | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [lastCreatedCaseId, setLastCreatedCaseId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  // Fetch initial alerts from backend
  const refreshAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setAlerts(data);
        }
      }
    } catch {
      // Keep initial alerts fallback
    }
  }, []);

  useEffect(() => {
    refreshAlerts();
  }, [refreshAlerts]);

  const unreadCount = alerts.filter(a => !a.read).length;

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (typeof window !== 'undefined' && window.AudioContext) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch {
      // Audio context might be restricted before user gesture
    }
  }, [soundEnabled]);

  const addAlert = useCallback((newAlert: WebSocketAlert) => {
    setAlerts(prev => {
      // Deduplicate by ID
      const exists = prev.some(a => a.id === newAlert.id);
      if (exists) return prev;
      return [newAlert, ...prev.slice(0, 99)];
    });
    setActiveToast(newAlert);
    playNotificationSound();
  }, [playNotificationSound]);

  const markAsRead = useCallback(async (alertId: string) => {
    setAlerts(prev => prev.map(a => (a.id === alertId ? { ...a, read: true } : a)));
    try {
      await fetch(`/api/alerts/${alertId}/read`, { method: 'PATCH' });
    } catch {
      // ignore
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    try {
      await fetch('/api/alerts/mark-all-read', { method: 'POST' });
    } catch {
      // ignore
    }
  }, []);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    setStatus('connecting');

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/alerts`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type === 'CASE_CREATED' && data.case?.id) {
            setLastCreatedCaseId(data.case.id);
          }
          if (data && data.type === 'GMAIL_SYNC_COMPLETE') {
            if (data.latest_case_id) {
              setLastCreatedCaseId(data.latest_case_id);
            }
            const syncAlert: WebSocketAlert = {
              id: `sync_${Date.now()}`,
              case_id: data.latest_case_id,
              timestamp: data.timestamp || new Date().toISOString(),
              severity: data.quarantine_status === 'HOLD_QUARANTINED' ? 'HIGH' : 'INFO',
              title: data.quarantine_status === 'HOLD_QUARANTINED'
                ? 'Gmail Auto-Sync: Pre-Delivery Threat Intercepted'
                : 'Gmail Mailbox Sync Complete',
              description: data.quarantine_status === 'HOLD_QUARANTINED'
                ? `Sync evaluated ${data.processed_count || 1} email(s). Quarantined high-risk item: "${data.subject || 'Suspicious Email'}" before delivery.`
                : `Successfully polled mailbox. ${data.processed_count || 1} email(s) ingested and verified (${data.delivery_stage || 'post-delivery-alert'} - ${data.quarantine_status || 'AUDITED'}).`,
              source: 'gmail-sync-engine',
              read: false,
              threat_score: data.quarantine_status === 'HOLD_QUARANTINED' ? 88 : 15,
              category: 'GMAIL_SYNC',
              subject: data.subject
            };
            addAlert(syncAlert);
          }
          if (data && (data.title || data.type === 'ALERT')) {
            const rawAlert = data.alert || data;
            const incoming: WebSocketAlert = {
              id: rawAlert.id || `alt_${Date.now()}`,
              case_id: rawAlert.case_id || rawAlert.caseId,
              timestamp: rawAlert.timestamp || new Date().toISOString(),
              severity: rawAlert.severity || 'HIGH',
              title: rawAlert.title || 'Threat Detected',
              description: rawAlert.description || rawAlert.message || 'Suspicious forensic pattern observed',
              source: rawAlert.source || 'live-stream',
              read: false,
              threat_score: rawAlert.threat_score || 75,
              category: rawAlert.category || 'THREAT_ALERT',
              sender: rawAlert.sender,
              subject: rawAlert.subject
            };
            addAlert(incoming);
          }
        } catch (e) {
          console.warn('[WebSocket] Error parsing incoming alert:', e);
        }
      };

      ws.onerror = () => {
        setStatus('error');
      };

      ws.onclose = () => {
        setStatus('disconnected');
        // Retry connection after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };
    } catch {
      setStatus('disconnected');
    }
  }, [addAlert]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Real-time Postgres changes stream via Supabase Realtime channel
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel('supabase_realtime_alerts_stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (payload) => {
        const row = payload.new as any;
        if (row) {
          const incoming: WebSocketAlert = {
            id: row.id || `alt_${Date.now()}`,
            case_id: row.case_id,
            timestamp: row.timestamp || new Date().toISOString(),
            severity: row.severity || 'HIGH',
            title: row.title || 'Security Incident Alert',
            description: row.description || 'Forensic threat anomaly detected in message pipeline.',
            source: row.source || 'supabase-realtime',
            read: Boolean(row.read),
            threat_score: row.threat_score || 80,
            category: row.category || 'SECURITY_ALERT',
            sender: row.sender,
            subject: row.subject
          };
          addAlert(incoming);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alerts' }, (payload) => {
        const row = payload.new as any;
        if (row && row.id) {
          setAlerts(prev => prev.map(a => (a.id === row.id ? { ...a, ...row } : a)));
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cases' }, (payload) => {
        const newCase = payload.new as any;
        if (newCase?.id) {
          setLastCreatedCaseId(newCase.id);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cases' }, (payload) => {
        const updatedCase = payload.new as any;
        if (updatedCase?.id) {
          setLastCreatedCaseId(`update_${updatedCase.id}_${Date.now()}`);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addAlert]);

  const dismissToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  const broadcastTestAlert = useCallback((custom?: Partial<WebSocketAlert>) => {
    const mockAlert: WebSocketAlert = {
      id: `alt_${Date.now()}`,
      case_id: 'sample-1',
      timestamp: new Date().toISOString(),
      severity: custom?.severity || 'CRITICAL',
      title: custom?.title || 'Simulated Phishing IOC Broadcast',
      description: custom?.description || 'Manual test alert generated by SOC analyst from forensic pipeline console.',
      source: 'soc-manual-test',
      read: false,
      threat_score: 95,
      category: 'TEST_ALERT',
      ...custom
    };
    addAlert(mockAlert);
  }, [addAlert]);

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    connect();
  }, [connect]);

  return {
    alerts,
    activeToast,
    status,
    unreadCount,
    soundEnabled,
    lastCreatedCaseId,
    setSoundEnabled,
    dismissToast,
    markAsRead,
    markAllAsRead,
    refreshAlerts,
    broadcastTestAlert,
    reconnect
  };
}
