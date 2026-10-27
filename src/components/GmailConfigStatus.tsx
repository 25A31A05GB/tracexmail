import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Key,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Clock,
  Mail,
  ChevronDown,
  ChevronUp,
  Info,
  Check,
  SlidersHorizontal
} from 'lucide-react';
import { API_URL } from '../lib/api';

export interface OAuthScopeDetail {
  scope: string;
  shortName: string;
  category: string;
  description: string;
  granted: boolean;
  required: boolean;
  lastVerifiedAt: string | null;
}

export interface OAuthScopesStatus {
  active_scopes: string[];
  has_readonly: boolean;
  has_modify: boolean;
  has_labels?: boolean;
  has_metadata?: boolean;
  has_send?: boolean;
  has_userinfo: boolean;
  token_status: 'active' | 'expiring_soon' | 'expired' | 'missing_scopes' | 'disconnected';
  last_refreshed_at: string | null;
  scopes_granted_at: string | null;
  token_expires_at: number | null;
  expires_in_seconds: number;
  scopes_breakdown: OAuthScopeDetail[];
}

interface GmailConfigStatusProps {
  emailAddress?: string | null;
  isConnected?: boolean;
  oauthScopes?: OAuthScopesStatus | null;
  onRefreshSuccess?: () => void;
  className?: string;
}

export function GmailConfigStatus({
  emailAddress = '',
  isConnected = false,
  oauthScopes: initialScopes,
  onRefreshSuccess,
  className = ''
}: GmailConfigStatusProps) {
  const [scopesData, setScopesData] = useState<OAuthScopesStatus | null>(initialScopes || null);
  const [loading, setLoading] = useState<boolean>(!initialScopes);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showDevOptions, setShowDevOptions] = useState<boolean>(false);
  const [testingScope, setTestingScope] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(3600);

  const fetchScopesStatus = async () => {
    try {
      setLoading(true);
      const url = emailAddress 
        ? `${API_URL}/api/gmail/status?user_email=${encodeURIComponent(emailAddress)}`
        : `${API_URL}/api/gmail/status`;
      const res = await fetch(url, {
        headers: emailAddress ? { 'x-user-email': emailAddress } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (data.oauth_scopes) {
          setScopesData(data.oauth_scopes);
          setCountdown(data.oauth_scopes.expires_in_seconds || 3600);
        }
      }
    } catch (err: any) {
      console.warn('[GmailConfigStatus] Error fetching status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialScopes) {
      fetchScopesStatus();
    } else {
      setScopesData(initialScopes);
      setCountdown(initialScopes.expires_in_seconds || 3600);
    }
  }, [initialScopes]);

  // Expiration countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (secs: number) => {
    if (secs <= 0) return 'Expired';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s remaining`;
  };

  const handleRefreshPermissions = async () => {
    setRefreshing(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/gmail/oauth/refresh-permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopes: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/gmail.labels',
            'https://www.googleapis.com/auth/gmail.metadata',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/userinfo.email'
          ],
          expires_in_seconds: 3600
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to refresh permissions');
      }

      if (data.oauth_scopes) {
        setScopesData(data.oauth_scopes);
        setCountdown(data.oauth_scopes.expires_in_seconds || 3600);
      }

      setStatusMessage({
        type: 'success',
        text: 'Permissions successfully renewed. All elevated Gmail SOC integrations are active.'
      });

      if (onRefreshSuccess) {
        onRefreshSuccess();
      }
    } catch (err: any) {
      console.error('[GmailConfigStatus] Refresh error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Unable to refresh permissions. Please verify your connection.'
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleScopeSimulation = async (scopeName: string, currentGranted: boolean) => {
    setTestingScope(scopeName);
    try {
      const res = await fetch(`${API_URL}/api/gmail/oauth/toggle-scope`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: scopeName,
          granted: !currentGranted
        })
      });
      const data = await res.json();
      if (data.oauth_scopes) {
        setScopesData(data.oauth_scopes);
      }
    } catch (err: any) {
      console.warn('[GmailConfigStatus] Toggle error:', err);
    } finally {
      setTestingScope(null);
    }
  };

  const hasReadonly = scopesData ? Boolean(scopesData.has_readonly) : true;
  const hasModify = scopesData ? Boolean(scopesData.has_modify) : true;
  const hasLabels = scopesData ? (scopesData.has_labels ?? true) : true;
  const hasMetadata = scopesData ? (scopesData.has_metadata ?? true) : true;
  const hasSend = scopesData ? (scopesData.has_send ?? true) : true;
  const allHealthy = hasReadonly && hasModify && hasLabels && hasMetadata && hasSend && countdown > 0;

  return (
    <div
      id="gmail-config-status-card"
      className={`bg-[#181613] border border-[#342e26] rounded-2xl overflow-hidden shadow-sm transition-all ${className}`}
    >
      {/* Top Header Card */}
      <div className="p-5 sm:p-6 border-b border-[#2d2820] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base font-semibold text-[#f4efe6]">
                Gmail Security Integration
              </h3>
              {allHealthy ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Full SOC Protection (5/5 Scopes)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950/60 text-amber-400 border border-amber-500/30">
                  <AlertTriangle className="w-3 h-3" />
                  Elevated Scopes Required
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-[#9d9282] mt-1.5 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#b5aa99]" />
                <span className="text-[#f4efe6] font-medium">{emailAddress || 'No account connected'}</span>
              </span>
              <span className="text-[#453f35]">•</span>
              <span className="flex items-center gap-1 text-[#b5aa99]">
                <Clock className="w-3.5 h-3.5 text-[#887e6f]" />
                <span>{formatCountdown(countdown)}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="btn-refresh-gmail-permissions"
            onClick={handleRefreshPermissions}
            disabled={refreshing}
            className={`px-4 py-2.5 rounded-xl font-medium text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
              !allHealthy
                ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold shadow-amber-500/10'
                : 'bg-[#26211a] hover:bg-[#322c22] text-[#f4efe6] border border-[#443c30]'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span>{refreshing ? 'Updating...' : 'Renew Permissions'}</span>
          </button>
        </div>
      </div>

      {/* Status Message Feedback */}
      {statusMessage && (
        <div
          className={`px-5 py-3 text-xs border-b flex items-center gap-2.5 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/30 text-emerald-300 border-emerald-900/40'
              : statusMessage.type === 'error'
              ? 'bg-red-950/30 text-red-300 border-red-900/40'
              : 'bg-amber-950/30 text-amber-300 border-amber-900/40'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : statusMessage.type === 'error' ? (
            <XCircle className="w-4 h-4 text-red-400 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 5 Full SOC Scopes Grid */}
      <div className="p-5 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Scope 1: Readonly */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              hasReadonly ? 'bg-[#1f1b16] border-[#342e26]' : 'bg-amber-950/20 border-amber-700/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <h4 className="text-xs font-semibold text-[#f4efe6]">Threat Ingestion</h4>
              </div>
              {hasReadonly ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/20">
                  <Check className="w-2.5 h-2.5" />
                  Granted
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-950/50 px-2 py-0.5 rounded border border-red-500/20">
                  <XCircle className="w-2.5 h-2.5" />
                  Missing
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#a89d8d] leading-relaxed">
              Scans raw RFC 822 email headers, MIME structures, and attachments for phishing forensics.
            </p>
            <div className="mt-2 text-[10px] text-[#786e60] font-mono">gmail.readonly</div>
          </div>

          {/* Scope 2: Modify */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              hasModify ? 'bg-[#1f1b16] border-[#342e26]' : 'bg-amber-950/20 border-amber-700/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-400" />
                <h4 className="text-xs font-semibold text-[#f4efe6]">Automated Quarantine</h4>
              </div>
              {hasModify ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/20">
                  <Check className="w-2.5 h-2.5" />
                  Granted
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-950/50 px-2 py-0.5 rounded border border-red-500/20">
                  <XCircle className="w-2.5 h-2.5" />
                  Missing
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#a89d8d] leading-relaxed">
              Isolates threats by removing INBOX and attaching quarantine labels to protect users.
            </p>
            <div className="mt-2 text-[10px] text-[#786e60] font-mono">gmail.modify</div>
          </div>

          {/* Scope 3: Labels */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              hasLabels ? 'bg-[#1f1b16] border-[#342e26]' : 'bg-amber-950/20 border-amber-700/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <h4 className="text-xs font-semibold text-[#f4efe6]">SOC Label Hierarchy</h4>
              </div>
              {hasLabels ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/20">
                  <Check className="w-2.5 h-2.5" />
                  Granted
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-950/50 px-2 py-0.5 rounded border border-red-500/20">
                  <XCircle className="w-2.5 h-2.5" />
                  Missing
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#a89d8d] leading-relaxed">
              Auto-creates and color-codes labels: TraceXMail/Quarantined, Suspicious, Clean.
            </p>
            <div className="mt-2 text-[10px] text-[#786e60] font-mono">gmail.labels</div>
          </div>

          {/* Scope 4: Metadata */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              hasMetadata ? 'bg-[#1f1b16] border-[#342e26]' : 'bg-amber-950/20 border-amber-700/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                <h4 className="text-xs font-semibold text-[#f4efe6]">Delta Cursor Sync</h4>
              </div>
              {hasMetadata ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/20">
                  <Check className="w-2.5 h-2.5" />
                  Granted
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-950/50 px-2 py-0.5 rounded border border-red-500/20">
                  <XCircle className="w-2.5 h-2.5" />
                  Missing
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#a89d8d] leading-relaxed">
              High-speed historyId delta tracking with minimal quota consumption.
            </p>
            <div className="mt-2 text-[10px] text-[#786e60] font-mono">gmail.metadata</div>
          </div>

          {/* Scope 5: Send */}
          <div
            className={`p-3.5 rounded-xl border transition-all md:col-span-2 lg:col-span-2 ${
              hasSend ? 'bg-[#1f1b16] border-[#342e26]' : 'bg-amber-950/20 border-amber-700/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <h4 className="text-xs font-semibold text-[#f4efe6]">Incident Escalation Dispatch</h4>
              </div>
              {hasSend ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/20">
                  <Check className="w-2.5 h-2.5" />
                  Granted
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-950/50 px-2 py-0.5 rounded border border-red-500/20">
                  <XCircle className="w-2.5 h-2.5" />
                  Missing
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#a89d8d] leading-relaxed">
              Dispatches automated security warnings to employees and alert notifications to SOC escalation channels.
            </p>
            <div className="mt-2 text-[10px] text-[#786e60] font-mono">gmail.send</div>
          </div>
        </div>

        {/* Minimalist Developer / Testing Options (Collapsible) */}
        <div className="pt-2 border-t border-[#29241d] flex items-center justify-between">
          <button
            onClick={() => setShowDevOptions(!showDevOptions)}
            className="text-xs text-[#887e6f] hover:text-[#d6cbba] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{showDevOptions ? 'Hide Technical Diagnostics' : 'Advanced Diagnostics'}</span>
            {showDevOptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <span className="text-[11px] text-[#6b6254]">
            Last verified: {scopesData?.last_refreshed_at ? new Date(scopesData.last_refreshed_at).toLocaleTimeString() : 'Just now'}
          </span>
        </div>

        {showDevOptions && (
          <div className="p-3.5 bg-[#14120e] rounded-xl border border-[#2b251d] text-xs text-[#a89d8d] space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-stone-400">OAuth Engine: Full Workspace Permissions (5 Scopes)</span>
              <span className="text-stone-400 font-mono text-[11px]">Mode: REST + Pub/Sub Push</span>
            </div>
            <div className="pt-2 border-t border-[#221d17] flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-[#887e6f]">Simulate toggle:</span>
              <button
                onClick={() => handleToggleScopeSimulation('gmail.readonly', hasReadonly)}
                disabled={testingScope === 'gmail.readonly'}
                className="text-[10px] text-amber-400/90 hover:underline cursor-pointer"
              >
                {hasReadonly ? 'Revoke Read' : 'Grant Read'}
              </button>
              <span className="text-[#453f35]">•</span>
              <button
                onClick={() => handleToggleScopeSimulation('gmail.modify', hasModify)}
                disabled={testingScope === 'gmail.modify'}
                className="text-[10px] text-purple-400/90 hover:underline cursor-pointer"
              >
                {hasModify ? 'Revoke Modify' : 'Grant Modify'}
              </button>
              <span className="text-[#453f35]">•</span>
              <button
                onClick={() => handleToggleScopeSimulation('gmail.labels', hasLabels)}
                disabled={testingScope === 'gmail.labels'}
                className="text-[10px] text-red-400/90 hover:underline cursor-pointer"
              >
                {hasLabels ? 'Revoke Labels' : 'Grant Labels'}
              </button>
              <span className="text-[#453f35]">•</span>
              <button
                onClick={() => handleToggleScopeSimulation('gmail.metadata', hasMetadata)}
                disabled={testingScope === 'gmail.metadata'}
                className="text-[10px] text-cyan-400/90 hover:underline cursor-pointer"
              >
                {hasMetadata ? 'Revoke Metadata' : 'Grant Metadata'}
              </button>
              <span className="text-[#453f35]">•</span>
              <button
                onClick={() => handleToggleScopeSimulation('gmail.send', hasSend)}
                disabled={testingScope === 'gmail.send'}
                className="text-[10px] text-emerald-400/90 hover:underline cursor-pointer"
              >
                {hasSend ? 'Revoke Send' : 'Grant Send'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
