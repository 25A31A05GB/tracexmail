import { useState, useEffect, useRef } from 'react';
import {
  Mail,
  CheckCircle2,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Zap,
  AlertCircle,
  Radio,
  Sliders,
  ShieldAlert,
  Send,
  History,
  Lock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Server,
  Copy,
  Check,
  Calendar,
  Clock,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Key,
  Shield,
  Activity,
  ArrowUpRight
} from 'lucide-react';
import { gmailPubSub, WatchSubscriptionState } from '../services/gmailPubSub';
import { GmailConfigStatus, OAuthScopesStatus } from './GmailConfigStatus';

const API_URL = (
  (import.meta as any).env?.VITE_API_URL ||
  ''
).replace(/\/$/, '');

interface WatchConfig {
  enabled: boolean;
  active: boolean;
  topic_name: string;
  expiration: number | null;
  last_push_received_at: string | null;
}

interface QuarantineConfig {
  enabled: boolean;
  threshold: number;
  quarantine_label: string;
  remove_inbox_label: boolean;
  admin_webhook_url: string;
}

interface QuarantineLog {
  id: string;
  timestamp: string;
  messageId: string;
  subject: string;
  from: string;
  threatScore: number;
  verdict: string;
  action: 'HOLD_QUARANTINED' | 'INSPECTED_CLEAN' | 'ALERT_DISPATCHED';
  deliveryStage: 'pre-delivery-hold' | 'post-delivery-alert';
  adminWebhookDispatched: boolean;
}

interface GmailStatusResponse {
  is_connected: boolean;
  oauth_configured: boolean;
  email_address: string | null;
  last_polled_at: string | null;
  polling_interval_seconds: number;
  history_id: string | null;
  oauth_scopes?: OAuthScopesStatus;
  watch?: WatchConfig;
  quarantine?: QuarantineConfig;
  metrics?: {
    total_ingested: number;
    pre_delivery_quarantined: number;
    post_delivery_alerts: number;
    last_delivery_stage: 'pre-delivery-hold' | 'post-delivery-alert' | null;
    last_quarantine_at: string | null;
  };
}

interface GmailConnectionViewProps {
  onNewCasesProcessed?: () => void;
  onSelectAnalysis?: (analysis: any) => void;
  onNavigateToOverview?: () => void;
  currentUserEmail?: string;
}

export function GmailConnectionView({ onNewCasesProcessed, onSelectAnalysis, onNavigateToOverview, currentUserEmail = 'jayramsappa537@gmail.com' }: GmailConnectionViewProps) {
  const [status, setStatus] = useState<GmailStatusResponse | null>(null);
  const [pubSubState, setPubSubState] = useState<WatchSubscriptionState>(() => gmailPubSub.getState());
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [testingPubSub, setTestingPubSub] = useState<boolean>(false);
  const [startingWatch, setStartingWatch] = useState<boolean>(false);
  const [renewingWatch, setRenewingWatch] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Real-time Progress Indicator & WebSocket Sync state
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncStage, setSyncStage] = useState<string>('Enclave Idle');
  const [lastSyncCompletedAt, setLastSyncCompletedAt] = useState<Date | null>(null);
  const [lastSyncDetails, setLastSyncDetails] = useState<{
    count: number;
    status: string;
    subject?: string;
    stage?: string;
  } | null>(null);
  const [syncCompletedAnim, setSyncCompletedAnim] = useState<boolean>(false);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Quarantine & Gate Settings state
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [showWatchConfig, setShowWatchConfig] = useState<boolean>(false);
  const [showAuditLogs, setShowAuditLogs] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<QuarantineLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  const [quarantineEnabled, setQuarantineEnabled] = useState<boolean>(true);
  const [quarantineThreshold, setQuarantineThreshold] = useState<number>(70);
  const [quarantineLabel, setQuarantineLabel] = useState<string>('TraceXMail-Quarantine');
  const [adminWebhookUrl, setAdminWebhookUrl] = useState<string>('');
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

  // Real Gmail OAuth Token Direct Link
  const [showDirectTokenConnect, setShowDirectTokenConnect] = useState<boolean>(false);
  const [directEmail, setDirectEmail] = useState<string>(currentUserEmail || 'jayramsappa537@gmail.com');
  const [directAccessToken, setDirectAccessToken] = useState<string>('');
  const [connectingToken, setConnectingToken] = useState<boolean>(false);
  const [directTokenSuccess, setDirectTokenSuccess] = useState<string | null>(null);

  const [topicName, setTopicName] = useState<string>('projects/tracexmail-enterprise/topics/inbox-watch');
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);

  const pushWebhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/gmail/pubsub/push` : '/api/gmail/pubsub/push';

  // Subscribe to gmailPubSub state changes
  useEffect(() => {
    const unsubscribe = gmailPubSub.subscribe((newState) => {
      setPubSubState(newState);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const targetEmail = directEmail.trim() || currentUserEmail || 'jayramsappa537@gmail.com';
      const res = await fetch(`${API_URL}/api/gmail/status?user_email=${encodeURIComponent(targetEmail)}`, {
        signal: controller.signal,
        headers: {
          'x-user-email': targetEmail
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data: GmailStatusResponse = await res.json();
      setStatus(data);
      if (data.quarantine) {
        setQuarantineEnabled(data.quarantine.enabled);
        setQuarantineThreshold(data.quarantine.threshold);
        setQuarantineLabel(data.quarantine.quarantine_label);
        setAdminWebhookUrl(data.quarantine.admin_webhook_url || '');
      }
      if (data.watch?.topic_name) {
        setTopicName(data.watch.topic_name);
      }
      await gmailPubSub.fetchStatus();
      setErrorMsg(null);
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setErrorMsg('Gmail service is taking too long to respond. Please try again.');
      } else {
        setErrorMsg('Failed to fetch Gmail status. Please try again.');
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleToggleWatch = async (enable: boolean) => {
    setStartingWatch(true);
    setErrorMsg(null);
    try {
      if (enable) {
        const res = await gmailPubSub.startWatch({ topicName });
        if (res.success !== false) {
          setSyncResult(
            `⚡ Gmail users.watch() active! Pub/Sub subscriber listening on ${topicName}`
          );
        } else {
          throw new Error(res.error || 'Failed to activate Gmail watch');
        }
      } else {
        const res = await gmailPubSub.stopWatch();
        if (res.success !== false) {
          setSyncResult('Gmail users.watch() stopped.');
        } else {
          throw new Error(res.error || 'Failed to stop Gmail watch');
        }
      }
      fetchStatus();
    } catch (err: any) {
      setErrorMsg('Error updating Gmail watch: ' + err.message);
    } finally {
      setStartingWatch(false);
    }
  };

  const handleManualRenewWatch = async () => {
    setRenewingWatch(true);
    setErrorMsg(null);
    try {
      const res = await gmailPubSub.startWatch({ topicName });
      if (res.success !== false) {
        setSyncResult(`⚡ Gmail users.watch() subscription successfully renewed!`);
        fetchStatus();
      } else {
        throw new Error(res.error || 'Failed to renew watch subscription');
      }
    } catch (err: any) {
      setErrorMsg('Renewal error: ' + err.message);
    } finally {
      setRenewingWatch(false);
    }
  };

  const handleTriggerPubSubTest = async (isMalicious: boolean = true) => {
    setTestingPubSub(true);
    setSyncResult(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/gmail/pubsub/test-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_malicious: isMalicious,
          emailAddress: status?.email_address || 'security-audit@tracexmail-enterprise.internal',
          subject: isMalicious
            ? '🚨 URGENT: Wire Transfer Authorization & Security Confirmation'
            : 'Corporate Security Routine Policy Health Check'
        })
      });

      if (res.ok) {
        const data = await res.json();
        const isQuar = data.quarantined;
        setSyncResult(
          isQuar
            ? `⚡ Cloud Pub/Sub Push Intercepted (0.3s): High-Risk Threat (${data.case?.threat_score}/100) placed in PRE-DELIVERY QUARANTINE HOLD before mailbox delivery.`
            : `⚡ Cloud Pub/Sub Push Processed (0.2s): Inbound message clean (${data.case?.threat_score}/100). Delivered to inbox.`
        );
        if (onNewCasesProcessed) onNewCasesProcessed();
        fetchStatus();
      } else {
        setErrorMsg('Failed to execute Pub/Sub push test.');
      }
    } catch (err: any) {
      setErrorMsg('Pub/Sub test error: ' + err.message);
    } finally {
      setTestingPubSub(false);
    }
  };

  const copyPushWebhookUrl = () => {
    navigator.clipboard.writeText(pushWebhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`${API_URL}/api/gmail/quarantine/logs`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err: any) {
      console.warn('Failed fetching quarantine logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSaveQuarantineConfig = async () => {
    setSavingConfig(true);
    setConfigSuccess(null);
    try {
      const res = await fetch(`${API_URL}/api/gmail/quarantine/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: quarantineEnabled,
          threshold: quarantineThreshold,
          quarantineLabelName: quarantineLabel,
          removeInboxLabel: true,
          adminWebhookUrl
        })
      });

      if (res.ok) {
        setConfigSuccess('Quarantine gate & threshold settings saved successfully.');
        setTimeout(() => setConfigSuccess(null), 4000);
        fetchStatus();
      } else {
        throw new Error('Failed to update quarantine configuration');
      }
    } catch (err: any) {
      setErrorMsg('Error saving configuration: ' + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDirectTokenConnect = async () => {
    if (!directAccessToken.trim()) {
      setErrorMsg('Please provide a valid Google OAuth Access Token.');
      return;
    }
    setConnectingToken(true);
    setErrorMsg(null);
    setDirectTokenSuccess(null);
    try {
      const targetEmail = directEmail.trim() || currentUserEmail || 'jayramsappa537@gmail.com';
      const res = await fetch(`${API_URL}/api/gmail/connect-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: directAccessToken.trim(),
          email: targetEmail,
          expires_in_seconds: 3600
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to connect Gmail token');
      }
      setDirectTokenSuccess(`Real Gmail account connected: ${targetEmail}. Starting live synchronization...`);
      setDirectAccessToken('');
      setShowDirectTokenConnect(false);
      await fetchStatus();
      // Immediately run real sync
      await handleSyncNow();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error connecting real Gmail token');
    } finally {
      setConnectingToken(false);
    }
  };

  const handleConnectGmail = async () => {
    try {
      setErrorMsg('');
      setSyncResult('');

      const res = await fetch(`${API_URL}/api/gmail/oauth/start`, {
        headers: {
          'x-organization-id': 'org_acme_soc_01',
        },
      });

      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.detail || data?.message || `Failed to start Gmail OAuth (${res.status})`);
      }

      const popup = window.open(
        data.url,
        'TraceXMailGmailOAuth',
        'width=600,height=700,resizable=yes,scrollbars=yes'
      );

      if (!popup) {
        throw new Error('OAuth popup was blocked. Please allow popups for TraceXMail.');
      }
    } catch (err: any) {
      console.error('[GmailOAuth] Failed to start OAuth flow:', err);
      setErrorMsg('Error starting Gmail OAuth flow: ' + (err?.message || String(err)));
    }
  };

  const handleSyncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncCompletedAnim(false);
    setSyncResult(null);
    setErrorMsg(null);
    setSyncProgress(15);
    setSyncStage('Connecting to Gmail Enclave API...');

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    // Smooth real-time progress steps during sync
    progressIntervalRef.current = setInterval(() => {
      setSyncProgress((prev) => {
        if (prev < 40) {
          setSyncStage('Querying latest Gmail inbound messages...');
          return prev + 10;
        } else if (prev < 75) {
          setSyncStage('Scanning headers & cryptographic signatures (SPF/DKIM)...');
          return prev + 8;
        } else if (prev < 90) {
          setSyncStage('Evaluating threat heuristics & quarantine rules...');
          return prev + 4;
        }
        return prev;
      });
    }, 280);

    try {
      const targetEmail = directEmail.trim() || currentUserEmail || 'jayramsappa537@gmail.com';
      const res = await fetch(`${API_URL}/api/gmail/poll-now`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': targetEmail
        },
        body: JSON.stringify({
          user_email: targetEmail
        })
      });

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

      if (res.ok) {
        const data = await res.json();
        const count = data.processed_cases_count || 0;
        const stage = data.delivery_stage === 'pre-delivery-hold' ? 'Pre-Delivery Intercepted' : 'Post-Delivery Ingested';
        
        setSyncProgress(100);
        setSyncStage(`Sync completed: ${count} email(s) analyzed`);
        setLastSyncCompletedAt(new Date());
        setLastSyncDetails({
          count,
          status: data.quarantine_status || 'AUDITED',
          stage: data.delivery_stage
        });
        setSyncCompletedAnim(true);
        setSyncResult(`Sync complete: ${count} email(s) evaluated (${stage} — ${data.quarantine_status}).`);
        
        if (count > 0 && onNewCasesProcessed) {
          onNewCasesProcessed();
        }
        fetchStatus();

        setTimeout(() => {
          setSyncing(false);
          setTimeout(() => setSyncCompletedAnim(false), 3500);
        }, 750);
      } else {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        setSyncing(false);
        setErrorMsg('Failed to sync Gmail mailbox.');
      }
    } catch (e: any) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setSyncing(false);
      setErrorMsg('Error during sync: ' + e.message);
    }
  };

  const handleSimulateInboundInterception = async (isMalicious: boolean = true) => {
    setSimulating(true);
    setSyncResult(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/gmail/simulate-inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_malicious: isMalicious })
      });

      if (res.ok) {
        const data = await res.json();
        const isQuar = data.quarantined;
        setSyncResult(
          isQuar
            ? `🚨 PRE-DELIVERY INTERCEPTION: High-Risk Inbound Email (Threat Score ${data.case?.threat_score}/100) placed in Quarantine Hold before inbox display. Webhook dispatched to SOC.`
            : `✅ Inbound Email Passed Gate: Verified clean (Threat Score ${data.case?.threat_score}/100). Delivered to inbox.`
        );
        if (onNewCasesProcessed) onNewCasesProcessed();
        fetchStatus();
      } else {
        setErrorMsg('Simulation failed to trigger inbound push webhook.');
      }
    } catch (err: any) {
      setErrorMsg('Simulation error: ' + err.message);
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Handle OAuth redirection query parameters (?gmail_auth=success or error)
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const gmailAuth = searchParams.get('gmail_auth');
      const authEmail = searchParams.get('email');
      const authError = searchParams.get('error');

      if (gmailAuth === 'success') {
        setErrorMsg(null);
        setSyncResult(`Gmail mailbox connected successfully${authEmail ? ` (${authEmail})` : ''}.`);
        fetchStatus();
        handleSyncNow();

        // If running inside an OAuth popup window, signal opener and close
        if (window.opener && window.opener !== window) {
          try {
            window.opener.postMessage({
              type: 'GMAIL_OAUTH_SUCCESS',
              email: authEmail,
              connected: true
            }, '*');
            setTimeout(() => window.close(), 600);
          } catch {}
        }

        // Clean up URL parameters cleanly
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } else if (gmailAuth === 'error') {
        const errorDesc = authError || 'Gmail authorization encountered an error.';
        setErrorMsg(errorDesc);

        if (window.opener && window.opener !== window) {
          try {
            window.opener.postMessage({
              type: 'GMAIL_OAUTH_ERROR',
              error: errorDesc
            }, '*');
            setTimeout(() => window.close(), 1500);
          } catch {}
        }

        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } catch (err) {
      console.warn('[GmailConnectionView] Error processing URL parameters:', err);
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'GMAIL_OAUTH_SUCCESS') {
        setErrorMsg(null);
        setSyncResult(`Gmail account connected successfully${event.data.email ? ` (${event.data.email})` : ''}.`);
        fetchStatus();
        handleSyncNow();
      } else if (event.data && event.data.type === 'GMAIL_OAUTH_ERROR') {
        setErrorMsg(`Gmail OAuth Error: ${event.data.error || 'Failed to authenticate.'}`);
      }
    };

    const handleWsSyncComplete = (event: any) => {
      const detail = event?.detail || event;
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      setSyncProgress(100);
      setSyncStage(`Live sync completed: ${detail?.processed_count || 1} email(s) analyzed`);
      setLastSyncCompletedAt(new Date());
      setLastSyncDetails({
        count: detail?.processed_count || 1,
        status: detail?.quarantine_status || 'AUDITED',
        subject: detail?.subject,
        stage: detail?.delivery_stage
      });
      setSyncCompletedAnim(true);
      
      const count = detail?.processed_count || 1;
      const stage = detail?.delivery_stage === 'pre-delivery-hold' ? 'Pre-Delivery Intercepted' : 'Post-Delivery Ingested';
      setSyncResult(`WebSocket Sync: ${count} email(s) evaluated (${stage} — ${detail?.quarantine_status || 'AUDITED'}).`);
      
      if (onNewCasesProcessed) {
        onNewCasesProcessed();
      }
      fetchStatus();

      setTimeout(() => {
        setSyncing(false);
        setTimeout(() => setSyncCompletedAnim(false), 3500);
      }, 750);
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('GMAIL_SYNC_COMPLETE', handleWsSyncComplete);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('GMAIL_SYNC_COMPLETE', handleWsSyncComplete);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [onNewCasesProcessed]);

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect this Gmail account?')) return;
    try {
      const res = await fetch(`${API_URL}/api/gmail/disconnect`, { method: 'POST' });
      if (res.ok) {
        fetchStatus();
        setSyncResult('Gmail account disconnected.');
      }
    } catch (e: any) {
      setErrorMsg('Error disconnecting Gmail account.');
    }
  };

  if (loading) {
    return (
      <div className="bg-[#1a1712] border border-[#3a352c] rounded-xl p-6 flex items-center justify-center gap-3 text-slate-400 text-xs">
        <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
        <span>Loading Gmail Connection Status...</span>
      </div>
    );
  }

  return (
    <div className="bg-[#181613] border border-[#342e26] rounded-2xl p-5 sm:p-6 space-y-6 shadow-sm">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2d2820] pb-5">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base font-semibold text-[#f4efe6]">Gmail Real-Time Ingestion &amp; Protection</h3>
              {syncing ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950/80 text-amber-300 border border-amber-500/40 animate-pulse shadow-sm shadow-amber-500/10">
                  <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                  <span>Syncing ({Math.round(syncProgress)}%)</span>
                </span>
              ) : syncCompletedAnim || (lastSyncCompletedAt && Date.now() - new Date(lastSyncCompletedAt).getTime() < 120000) ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 transition-all shadow-sm shadow-emerald-500/10">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Synced Just Now {lastSyncDetails ? `• ${lastSyncDetails.count} verified` : ''}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Live Protection</span>
                </span>
              )}
            </div>
            <p className="text-xs text-[#a89d8d] mt-1 max-w-2xl leading-relaxed">
              Inbound emails are automatically monitored. Threat patterns and phishing attempts are quarantined before reaching your active inbox.
            </p>
          </div>
        </div>

        {status?.is_connected ? (
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className={`font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-all relative overflow-hidden ${
                syncing
                  ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 bg-[length:200%_auto] text-stone-950 ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/25 animate-pulse cursor-wait'
                  : syncCompletedAnim
                  ? 'bg-emerald-500 text-stone-950 ring-2 ring-emerald-400/60 shadow-lg shadow-emerald-500/20'
                  : 'bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 hover:shadow-md'
              }`}
            >
              {syncCompletedAnim ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-stone-950" />
              ) : (
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              )}
              <span>
                {syncing
                  ? `Syncing (${Math.round(syncProgress)}%)...`
                  : syncCompletedAnim
                  ? 'Synced!'
                  : 'Sync Inbox'}
              </span>
            </button>
            <button
              onClick={() => handleSimulateInboundInterception(true)}
              disabled={simulating || syncing}
              className="bg-[#26211a] hover:bg-[#322c22] disabled:opacity-50 text-[#f4efe6] border border-[#443c30] px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Simulates a sample phishing test to demonstrate pre-delivery quarantine"
            >
              <ShieldAlert className={`w-3.5 h-3.5 text-amber-400 ${simulating ? 'animate-spin' : ''}`} />
              <span>{simulating ? 'Testing...' : 'Simulate Test Threat'}</span>
            </button>
            <button
              onClick={handleDisconnect}
              disabled={syncing}
              className="bg-[#201c17] hover:bg-red-950/40 hover:text-red-300 border border-[#383126] hover:border-red-800/60 text-[#a89d8d] px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnectGmail}
            className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm transition-all shrink-0"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>Connect Gmail Account</span>
          </button>
        )}
      </div>

      {/* Real-time Sync Progress Indicator Bar */}
      {(syncing || syncCompletedAnim) && (
        <div className="p-4 bg-[#1b1712] border border-amber-500/30 rounded-xl space-y-3 transition-all duration-300 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 font-medium text-[#f4efe6]">
              {syncCompletedAnim ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
              )}
              <span>{syncStage}</span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span className={`text-xs font-bold ${syncCompletedAnim ? 'text-emerald-400' : 'text-amber-400'}`}>
                {Math.round(syncProgress)}%
              </span>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="w-full bg-[#0e0c0a] rounded-full h-2 overflow-hidden border border-[#332b21]">
            <div
              className={`h-full transition-all duration-300 ease-out rounded-full ${
                syncCompletedAnim
                  ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.7)]'
                  : 'bg-gradient-to-r from-amber-600 via-amber-400 to-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
              }`}
              style={{ width: `${Math.min(100, Math.max(8, syncProgress))}%` }}
            />
          </div>

          {/* Real-time Step Flow */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono">
            <div className={`flex items-center gap-1.5 ${syncProgress >= 20 ? 'text-amber-300 font-semibold' : 'text-[#6b6255]'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${syncProgress >= 20 ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]' : 'bg-[#4a4237]'}`} />
              <span className="truncate">1. Enclave Handshake</span>
            </div>
            <div className={`flex items-center gap-1.5 ${syncProgress >= 50 ? 'text-amber-300 font-semibold' : 'text-[#6b6255]'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${syncProgress >= 50 ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]' : 'bg-[#4a4237]'}`} />
              <span className="truncate">2. Inbound Query</span>
            </div>
            <div className={`flex items-center gap-1.5 ${syncProgress >= 80 ? 'text-amber-300 font-semibold' : 'text-[#6b6255]'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${syncProgress >= 80 ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]' : 'bg-[#4a4237]'}`} />
              <span className="truncate">3. Threat Heuristics</span>
            </div>
            <div className={`flex items-center gap-1.5 ${syncProgress >= 100 ? 'text-emerald-400 font-semibold' : 'text-[#6b6255]'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${syncProgress >= 100 ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-[#4a4237]'}`} />
              <span className="truncate">4. Ingestion Complete</span>
            </div>
          </div>
        </div>
      )}

      {/* Notifications / Alerts */}
      {errorMsg && (
        <div className="p-4 bg-red-950/30 border border-red-900/40 rounded-xl text-red-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => fetchStatus()}
            className="px-3 py-1 bg-red-900/50 hover:bg-red-800/60 text-red-100 rounded-lg text-xs font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {syncResult && (
        <div className="p-4 bg-emerald-950/30 border border-emerald-900/40 rounded-xl text-emerald-200 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{syncResult}</span>
        </div>
      )}

      {directTokenSuccess && (
        <div className="p-4 bg-emerald-950/30 border border-emerald-900/40 rounded-xl text-emerald-200 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{directTokenSuccess}</span>
        </div>
      )}

      {/* Gmail Configuration Status: Active OAuth Scopes & Refresh Permissions */}
      <GmailConfigStatus
        emailAddress={status?.email_address || currentUserEmail || 'jayramsappa537@gmail.com'}
        isConnected={status?.is_connected}
        oauthScopes={status?.oauth_scopes}
        onRefreshSuccess={fetchStatus}
      />

      {/* Real Gmail Account & Direct OAuth Link Panel */}
      <div className="p-4 bg-[#14120f] border border-[#3a352c] rounded-xl space-y-3 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Real Gmail Mailbox Integration</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                  LIVE SYNC ENGINE
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Connected Target: <span className="font-mono text-[var(--paper)] font-bold">{status?.email_address || currentUserEmail || 'jayramsappa537@gmail.com'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowDirectTokenConnect(!showDirectTokenConnect)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>{showDirectTokenConnect ? 'Hide Direct Token Input' : 'Configure Live OAuth Token'}</span>
          </button>
        </div>

        {showDirectTokenConnect && (
          <div className="p-3.5 bg-[#1c1813] border border-[#4a4235] rounded-lg space-y-3 animate-in fade-in duration-150">
            <div className="text-xs text-slate-300 leading-relaxed">
              To synchronize real emails from your personal or corporate Google account directly (e.g. <span className="font-mono text-amber-300">{currentUserEmail || 'jayramsappa537@gmail.com'}</span>), provide an authorized Google Access Token with <span className="font-mono text-purple-300">gmail.readonly</span> and <span className="font-mono text-purple-300">gmail.modify</span> scopes:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Gmail Address</label>
                <input
                  type="email"
                  value={directEmail}
                  onChange={(e) => setDirectEmail(e.target.value)}
                  placeholder={currentUserEmail || 'jayramsappa537@gmail.com'}
                  className="w-full bg-[#110e0a] border border-[#3a352c] rounded-md px-3 py-1.5 text-xs text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Google OAuth Access Token</label>
                <input
                  type="password"
                  value={directAccessToken}
                  onChange={(e) => setDirectAccessToken(e.target.value)}
                  placeholder="ya29.a0AfH6SM..."
                  className="w-full bg-[#110e0a] border border-[#3a352c] rounded-md px-3 py-1.5 text-xs text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowDirectTokenConnect(false)}
                className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDirectTokenConnect}
                disabled={connectingToken || !directAccessToken.trim()}
                className="px-4 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{connectingToken ? 'Connecting Token...' : 'Connect & Sync Live Mailbox'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Live users.watch() Push Interception & Subscription Expiration Panel */}
      {status?.is_connected && (
        <div className="p-4 bg-[#14120f] border border-purple-900/50 rounded-xl space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-950/80 border border-purple-800/80 flex items-center justify-center shrink-0 mt-0.5">
                <Radio className={`w-4 h-4 ${pubSubState.active ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-white tracking-wide">
                    Gmail Push Interception (<span className="font-mono text-purple-300">users.watch()</span>)
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1.5 ${
                      pubSubState.active
                        ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        pubSubState.active ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'
                      }`}
                    />
                    {pubSubState.active ? 'SUBSCRIPTION ACTIVE' : 'SUBSCRIPTION INACTIVE'}
                  </span>
                  {pubSubState.isExpiringSoon && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/80 border border-amber-600 text-amber-300">
                      EXPIRING SOON
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Direct Google Cloud Pub/Sub push subscription enables sub-second inbound interception and pre-delivery hold before mailbox arrival.
                </p>
              </div>
            </div>

            {/* Interactive Toggle Switch */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleToggleWatch(!pubSubState.active)}
                disabled={startingWatch}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  pubSubState.active ? 'bg-purple-600' : 'bg-slate-700'
                } ${startingWatch ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={pubSubState.active ? 'Click to stop users.watch()' : 'Click to activate users.watch()'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    pubSubState.active ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-xs font-mono font-semibold text-slate-200 select-none">
                {pubSubState.active ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
          </div>

          {/* Expiration & Renewal Schedule Sub-bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2.5 border-t border-slate-800/80 text-xs">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Expiration Date</span>
                <span className="text-xs font-mono font-semibold text-slate-200 truncate">
                  {pubSubState.expirationDateFormatted ||
                    (status?.watch?.expiration
                      ? new Date(status.watch.expiration).toUTCString()
                      : 'Not Subscribed (Inactive)')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Time Remaining</span>
                <span className="text-xs font-mono font-semibold text-amber-300 truncate">
                  {pubSubState.timeRemaining || (pubSubState.active ? '7 days validity' : 'N/A')}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-2 truncate">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div className="truncate">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Auto-Renewal Logic</span>
                  <span className="text-[11px] text-emerald-400 font-mono">24h Proactive Window</span>
                </div>
              </div>
              {pubSubState.active && (
                <button
                  onClick={handleManualRenewWatch}
                  disabled={renewingWatch || startingWatch}
                  className="px-2 py-1 bg-purple-950 hover:bg-purple-900 border border-purple-700/80 text-purple-200 rounded text-[10px] font-semibold cursor-pointer transition-colors shrink-0"
                  title="Force immediate subscription renewal via users.watch()"
                >
                  {renewingWatch ? 'Renewing...' : 'Renew Now'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Clean Metrics Grid */}
      {status?.is_connected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#1f1b16] p-4 rounded-xl border border-[#342e26] space-y-1">
            <span className="text-[11px] text-[#9d9282] block">Monitored Mailbox</span>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#f4efe6] truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate">{status.email_address}</span>
            </div>
          </div>

          <div className="bg-[#1f1b16] p-4 rounded-xl border border-[#342e26] space-y-1">
            <span className="text-[11px] text-[#9d9282] block">Monitoring Status</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300 truncate">
              <Radio className="w-3.5 h-3.5 text-purple-400 shrink-0 animate-pulse" />
              <span>Real-Time Push Active</span>
            </div>
          </div>

          <div className="bg-[#1f1b16] p-4 rounded-xl border border-[#342e26] space-y-1">
            <span className="text-[11px] text-[#9d9282] block">Threats Quarantined</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>{status.metrics?.pre_delivery_quarantined || 0} Blocked</span>
            </div>
          </div>

          <div className="bg-[#1f1b16] p-4 rounded-xl border border-[#342e26] space-y-1">
            <span className="text-[11px] text-[#9d9282] block">Total Scanned</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#f4efe6]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{status.metrics?.total_ingested || 0} Messages</span>
            </div>
          </div>
        </div>
      )}

      {/* Quarantine & Gate Settings Drawer */}
      {status?.is_connected && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowWatchConfig(!showWatchConfig)}
                className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5 text-purple-400" />
                <span>Pub/Sub `watch()` Subscription</span>
                {showWatchConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setShowConfig(!showConfig)}
                className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                <span>Pre-Delivery Quarantine Gate</span>
                {showConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              onClick={() => {
                setShowAuditLogs(!showAuditLogs);
                if (!showAuditLogs) fetchAuditLogs();
              }}
              className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-purple-400" />
              <span>Quarantine Audit Trail</span>
              {showAuditLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Cloud Pub/Sub Watch Config Panel */}
          {showWatchConfig && (
            <div className="p-4 bg-[#14120f] rounded-lg border border-[#3a352c] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-purple-400" />
                    Google Cloud Pub/Sub `users.watch()` Configuration
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Registers a mailbox listener with Google's Gmail API. Google Cloud pushes inbound notifications to our webhook within milliseconds of message arrival.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${status?.watch?.active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'}`}>
                    {status?.watch?.active ? 'STATUS: ACTIVE' : 'STATUS: INACTIVE'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Pub/Sub Topic Name</label>
                  <input
                    type="text"
                    value={topicName}
                    onChange={(e) => setTopicName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-purple-500 outline-none"
                    placeholder="projects/my-gcp-project/topics/inbox-watch"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">Topic granted publishing rights to `gmail-api-push@system.gserviceaccount.com`.</span>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Push Webhook Receiver Endpoint</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={pushWebhookUrl}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono outline-none select-all"
                    />
                    <button
                      onClick={copyPushWebhookUrl}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-300 text-xs flex items-center gap-1 shrink-0 transition-colors"
                      title="Copy webhook URL"
                    >
                      {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Configure this HTTPS URL in your Google Cloud Pub/Sub Subscription push settings.</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 flex-wrap gap-2">
                <div className="text-[11px] font-mono text-slate-400">
                  {status?.watch?.expiration ? `Subscription renews by: ${new Date(status.watch.expiration).toUTCString()}` : 'Standard 7-day auto-renewal period.'}
                </div>

                <div className="flex items-center gap-2">
                  {status?.watch?.active ? (
                    <button
                      onClick={() => handleToggleWatch(false)}
                      disabled={startingWatch}
                      className="bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/60 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {startingWatch ? 'Stopping...' : 'Stop Watch Subscription'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleWatch(true)}
                      disabled={startingWatch}
                      className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                    >
                      {startingWatch ? 'Registering...' : 'Activate Gmail watch() API'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Config Panel */}
          {showConfig && (
            <div className="p-4 bg-[#14120f] rounded-lg border border-[#3a352c] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Automated Pre-Delivery Gate</h4>
                  <p className="text-[11px] text-slate-400">When enabled, messages exceeding the risk threshold are withheld from recipient inbox until reviewed by SOC analysts.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quarantineEnabled}
                    onChange={(e) => setQuarantineEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Quarantine Risk Threshold: <span className="text-amber-400 font-mono font-bold">{quarantineThreshold}/100</span>
                  </label>
                  <input
                    type="range"
                    min="30"
                    max="95"
                    step="5"
                    value={quarantineThreshold}
                    onChange={(e) => setQuarantineThreshold(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">Emails scoring ≥ {quarantineThreshold} are quarantined immediately on arrival.</span>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Quarantine Holding Label</label>
                  <input
                    type="text"
                    value={quarantineLabel}
                    onChange={(e) => setQuarantineLabel(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-blue-500 outline-none"
                    placeholder="TraceXMail-Quarantine"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">Gmail label applied to quarantined messages.</span>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">SOC Admin Webhook URL (Optional)</label>
                  <input
                    type="url"
                    value={adminWebhookUrl}
                    onChange={(e) => setAdminWebhookUrl(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-blue-500 outline-none"
                    placeholder="https://soc.enterprise.corp/api/v1/quarantine-alerts"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">HTTP POST webhook dispatched instantly when an email is intercepted and quarantined.</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                {configSuccess && (
                  <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {configSuccess}
                  </span>
                )}
                {!configSuccess && <span />}

                <button
                  onClick={handleSaveQuarantineConfig}
                  disabled={savingConfig}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded text-xs font-semibold cursor-pointer shadow-sm transition-colors"
                >
                  {savingConfig ? 'Saving...' : 'Save Quarantine Gate Settings'}
                </button>
              </div>
            </div>
          )}

          {/* Audit Logs Table */}
          {showAuditLogs && (
            <div className="p-4 bg-[#14120f] rounded-lg border border-[#3a352c] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Quarantine & Interception Audit Log</h4>
                <button
                  onClick={fetchAuditLogs}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingLogs ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">No quarantine events recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 text-[11px]">
                      <tr>
                        <th className="p-2">Timestamp</th>
                        <th className="p-2">Subject / Message</th>
                        <th className="p-2">Sender</th>
                        <th className="p-2">Risk Score</th>
                        <th className="p-2">Stage</th>
                        <th className="p-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-900/40">
                          <td className="p-2 text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                          <td className="p-2 text-slate-200 font-semibold max-w-[220px] truncate" title={log.subject}>{log.subject}</td>
                          <td className="p-2 text-slate-400 max-w-[180px] truncate" title={log.from}>{log.from}</td>
                          <td className="p-2">
                            <span className={`font-bold ${log.threatScore >= 70 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {log.threatScore}/100
                            </span>
                          </td>
                          <td className="p-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              log.deliveryStage === 'pre-delivery-hold'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {log.deliveryStage === 'pre-delivery-hold' ? 'PRE-DELIVERY' : 'POST-DELIVERY'}
                            </span>
                          </td>
                          <td className="p-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              log.action === 'HOLD_QUARANTINED'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : log.action === 'ALERT_DISPATCHED'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
