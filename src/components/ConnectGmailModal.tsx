import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Zap, 
  Key, 
  ShieldCheck, 
  Globe, 
  Check, 
  AlertCircle, 
  Loader2, 
  Info, 
  Lock,
  ArrowRight,
  Sparkles,
  Server,
  Cloud,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { GoogleAuthButton } from './GoogleAuthButton';

interface ConnectGmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string;
  onConnected: (email: string) => Promise<void>;
}

export function ConnectGmailModal({
  isOpen,
  onClose,
  currentUserEmail = '',
  onConnected
}: ConnectGmailModalProps) {
  // Provider Selection: 'gmail' | 'microsoft365'
  const [selectedProvider, setSelectedProvider] = useState<'gmail' | 'microsoft365'>('gmail');

  // Gmail Tabs: 'token' | 'stream' | 'enterprise'
  const [gmailTab, setGmailTab] = useState<'token' | 'stream' | 'enterprise'>('token');

  // M365 Inputs
  const [m365TenantId, setM365TenantId] = useState('');
  const [m365ClientId, setM365ClientId] = useState('');
  const [m365ClientSecret, setM365ClientSecret] = useState('');
  const [m365UserEmail, setM365UserEmail] = useState(currentUserEmail || '');
  const [m365Quarantine, setM365Quarantine] = useState(true);
  const [showAdminConsentGuide, setShowAdminConsentGuide] = useState(false);

  // Common Inputs
  const [emailInput, setEmailInput] = useState<string>(currentUserEmail || '');
  const [accessTokenInput, setAccessTokenInput] = useState<string>('');
  const [clientIdInput, setClientIdInput] = useState<string>('');
  const [clientSecretInput, setClientSecretInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Provider Statuses
  const [providersStatus, setProvidersStatus] = useState<any[]>([]);

  useEffect(() => {
    if (currentUserEmail) {
      setEmailInput(currentUserEmail);
      setM365UserEmail(currentUserEmail);
    }
    if (isOpen) {
      apiFetch('/api/mail/providers')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setProvidersStatus(data);
        })
        .catch(() => {});
    }
  }, [currentUserEmail, isOpen]);

  if (!isOpen) return null;

  const effectiveEmail = emailInput.trim() || currentUserEmail || 'operator@acmedefense.sec';

  const handleM365Connect = async () => {
    if (!m365ClientId.trim() || !m365ClientSecret.trim() || !m365TenantId.trim()) {
      setErrorMsg('Tenant ID, Client ID, and Client Secret are required for Microsoft 365.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await apiFetch('/api/mail/m365/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: m365TenantId.trim(),
          clientId: m365ClientId.trim(),
          clientSecret: m365ClientSecret.trim(),
          emailAddress: m365UserEmail.trim() || effectiveEmail,
          quarantineEnabled: m365Quarantine
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to authenticate and connect to Microsoft 365 Graph API.');
      }

      setSuccessMsg('Microsoft 365 Exchange Online successfully connected! Tokens encrypted at rest.');
      await onConnected(m365UserEmail.trim() || effectiveEmail);
      setTimeout(() => onClose(), 1400);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error connecting Microsoft 365');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveClientCredentials = async () => {
    if (!clientIdInput.trim() || !clientSecretInput.trim()) {
      setErrorMsg('Please enter both Google Client ID and Client Secret.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await apiFetch('/api/gmail/oauth/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientIdInput.trim(),
          client_secret: clientSecretInput.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to configure Google Client Credentials.');
      }

      setSuccessMsg('Google Client ID & Secret successfully saved and activated!');
      setClientIdInput('');
      setClientSecretInput('');
      await onConnected(effectiveEmail);
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving Google Client credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivateStream = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const enclaveToken = `soc_enclave_stream_${Date.now()}`;
      const res = await apiFetch('/api/gmail/connect-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: enclaveToken,
          email: effectiveEmail,
          expires_in_seconds: 86400 * 30
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to establish live ingestion stream.');
      }

      setSuccessMsg(`Live SOC stream connected for ${effectiveEmail}! Initializing real-time telemetry...`);
      await onConnected(effectiveEmail);
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error connecting live stream');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnectDirectToken = async () => {
    if (!accessTokenInput.trim()) {
      setErrorMsg('Please enter your Google OAuth Access Token.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await apiFetch('/api/gmail/connect-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessTokenInput.trim(),
          email: effectiveEmail,
          expires_in_seconds: 3600
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to validate and connect Google OAuth token.');
      }

      setSuccessMsg(`Google Workspace credentials authorized for ${effectiveEmail}! Starting live sync...`);
      setAccessTokenInput('');
      await onConnected(effectiveEmail);
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error verifying Google OAuth credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl bg-[#14120e] border border-[#3a352c] rounded-lg shadow-2xl text-[#ede6d8] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#2c261e] flex items-center justify-between gap-3 bg-[#181511]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-[#ede6d8] flex items-center gap-2">
                <span>Enterprise Mailbox Connector</span>
              </h3>
              <p className="text-[11px] text-[#9d9282] font-mono mt-0.5">
                Real-time threat monitoring &amp; automated quarantine isolation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#201b15] hover:bg-[#2b251d] text-[#8a8070] hover:text-[#ede6d8] flex items-center justify-center transition-colors cursor-pointer border border-[#3a352c]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Provider Switcher */}
        <div className="grid grid-cols-2 p-2 bg-[#100e0b] border-b border-[#2c261e] gap-2">
          <button
            onClick={() => { setSelectedProvider('gmail'); setErrorMsg(null); }}
            className={`p-2.5 rounded flex items-center justify-center gap-2 font-mono text-xs cursor-pointer border transition-all ${
              selectedProvider === 'gmail'
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 font-bold'
                : 'bg-[#181511] border-[#2c261e] text-[#8a8070] hover:text-[#ede6d8]'
            }`}
          >
            <Globe className="w-4 h-4 text-amber-400" />
            <span>Google Workspace / Gmail</span>
          </button>

          <button
            onClick={() => { setSelectedProvider('microsoft365'); setErrorMsg(null); }}
            className={`p-2.5 rounded flex items-center justify-center gap-2 font-mono text-xs cursor-pointer border transition-all ${
              selectedProvider === 'microsoft365'
                ? 'bg-blue-500/15 border-blue-500/50 text-blue-300 font-bold'
                : 'bg-[#181511] border-[#2c261e] text-[#8a8070] hover:text-[#ede6d8]'
            }`}
          >
            <Cloud className="w-4 h-4 text-blue-400" />
            <span>Microsoft 365 (Exchange)</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded text-red-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded text-emerald-300 text-xs flex items-start gap-2.5">
              <Check className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* MICROSOFT 365 WIZARD */}
          {selectedProvider === 'microsoft365' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-950/20 border border-blue-900/40 rounded flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-[#c9bfae] space-y-1">
                  <p className="font-semibold text-blue-300">Microsoft Graph API Integration</p>
                  <p>
                    Connects using least-privilege scopes (<code className="text-blue-300 font-mono">Mail.Read</code> &amp; <code className="text-blue-300 font-mono">Mail.ReadWrite</code> for quarantine). All credentials are stored with versioned AES-256-GCM encryption.
                  </p>
                </div>
              </div>

              {/* Admin Consent collapsible instructions */}
              <div className="border border-[#2c261e] rounded bg-[#181511] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdminConsentGuide(!showAdminConsentGuide)}
                  className="w-full p-3 flex items-center justify-between text-xs font-mono text-[#c9bfae] hover:bg-[#201b15] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    <span>Microsoft Entra ID (Azure) Admin Consent Instructions</span>
                  </span>
                  {showAdminConsentGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showAdminConsentGuide && (
                  <div className="p-3.5 border-t border-[#2c261e] bg-[#120f0c] text-xs text-[#9d9282] space-y-2 font-mono">
                    <p className="text-[#ede6d8] font-sans font-medium">To connect your tenant-wide organization mailbox:</p>
                    <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed">
                      <li>Go to <strong>Microsoft Entra Admin Center</strong> (<code className="text-blue-300">entra.microsoft.com</code>).</li>
                      <li>Navigate to <strong>App registrations</strong> &rarr; <strong>New registration</strong> (Name: <span className="text-[#ede6d8]">TraceXMail Forensic Defense</span>).</li>
                      <li>Under <strong>API permissions</strong>, add <strong>Microsoft Graph</strong>:
                        <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px]">
                          <li><span className="text-blue-300">Mail.Read</span> (Application or Delegated)</li>
                          <li><span className="text-blue-300">Mail.ReadWrite</span> (Required for automated quarantine)</li>
                        </ul>
                      </li>
                      <li>Click <strong>&quot;Grant admin consent for your organization&quot;</strong>.</li>
                      <li>Under <strong>Certificates &amp; secrets</strong>, generate a New client secret.</li>
                      <li>Copy the <strong>Directory (tenant) ID</strong>, <strong>Application (client) ID</strong>, and <strong>Secret value</strong> below.</li>
                    </ol>
                  </div>
                )}
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block text-[11px] text-[#9d9282] uppercase mb-1">
                    Directory (Tenant) ID *
                  </label>
                  <input
                    type="text"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={m365TenantId}
                    onChange={(e) => setM365TenantId(e.target.value)}
                    className="w-full bg-[#100e0b] border border-[#2c261e] rounded p-2 text-[#ede6d8] focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#9d9282] uppercase mb-1">
                    Application (Client) ID *
                  </label>
                  <input
                    type="text"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={m365ClientId}
                    onChange={(e) => setM365ClientId(e.target.value)}
                    className="w-full bg-[#100e0b] border border-[#2c261e] rounded p-2 text-[#ede6d8] focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#9d9282] uppercase mb-1">
                    Client Secret Value *
                  </label>
                  <input
                    type="password"
                    placeholder="Enter Microsoft Entra client secret"
                    value={m365ClientSecret}
                    onChange={(e) => setM365ClientSecret(e.target.value)}
                    className="w-full bg-[#100e0b] border border-[#2c261e] rounded p-2 text-[#ede6d8] focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#9d9282] uppercase mb-1">
                    Mailbox Address (User Principal Name)
                  </label>
                  <input
                    type="email"
                    placeholder="security-inbox@yourdomain.com"
                    value={m365UserEmail}
                    onChange={(e) => setM365UserEmail(e.target.value)}
                    className="w-full bg-[#100e0b] border border-[#2c261e] rounded p-2 text-[#ede6d8] focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="m365QuarantineCheck"
                    checked={m365Quarantine}
                    onChange={(e) => setM365Quarantine(e.target.checked)}
                    className="rounded border-[#2c261e] text-blue-500 focus:ring-0"
                  />
                  <label htmlFor="m365QuarantineCheck" className="text-xs text-[#c9bfae] cursor-pointer">
                    Enable Automated Quarantine (moves threats to dedicated <code className="text-blue-300">TraceXMail-Quarantine</code> folder)
                  </label>
                </div>

                <button
                  onClick={handleM365Connect}
                  disabled={isSubmitting}
                  className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Microsoft 365 Credentials...</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-4 h-4" />
                      <span>Authenticate &amp; Connect Microsoft 365</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* GMAIL WIZARD */}
          {selectedProvider === 'gmail' && (
            <div className="space-y-4">
              {/* Tab selection */}
              <div className="flex border-b border-[#2c261e] pb-1 gap-2 text-xs font-mono">
                <button
                  onClick={() => setGmailTab('token')}
                  className={`pb-1 px-2 border-b-2 cursor-pointer transition-colors ${
                    gmailTab === 'token'
                      ? 'border-amber-400 text-amber-300 font-bold'
                      : 'border-transparent text-[#8a8070] hover:text-[#ede6d8]'
                  }`}
                >
                  OAuth (Primary)
                </button>
                <button
                  onClick={() => setGmailTab('stream')}
                  className={`pb-1 px-2 border-b-2 cursor-pointer transition-colors ${
                    gmailTab === 'stream'
                      ? 'border-amber-400 text-amber-300 font-bold'
                      : 'border-transparent text-[#8a8070] hover:text-[#ede6d8]'
                  }`}
                >
                  1-Click Stream
                </button>
                <button
                  onClick={() => setGmailTab('enterprise')}
                  className={`pb-1 px-2 border-b-2 cursor-pointer transition-colors ${
                    gmailTab === 'enterprise'
                      ? 'border-amber-400 text-amber-300 font-bold'
                      : 'border-transparent text-[#8a8070] hover:text-[#ede6d8]'
                  }`}
                >
                  API Credentials
                </button>
              </div>

              {gmailTab === 'token' && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-[#c9bfae]">
                      Sign in with your Google account to grant TraceXMail least-privilege read access for incoming email telemetry.
                    </p>
                  </div>

                  <div className="py-2">
                    <GoogleAuthButton
                      onSuccess={async (email) => {
                        setSuccessMsg(`Google Workspace authorized for ${email}!`);
                        await onConnected(email);
                        setTimeout(() => onClose(), 1200);
                      }}
                      onError={(err) => setErrorMsg(err)}
                    />
                  </div>
                </div>
              )}

              {gmailTab === 'stream' && (
                <div className="space-y-3">
                  <div className="p-3 bg-[#181511] border border-[#2c261e] rounded text-xs space-y-2">
                    <p className="text-[#ede6d8] font-bold">1-Click Live Ingestion Stream</p>
                    <p className="text-[#9d9282]">
                      Immediately engages synthetic live email feed and simulated Pub/Sub dispatcher for evaluation and testing.
                    </p>
                  </div>
                  <button
                    onClick={handleActivateStream}
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold rounded flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    <span>Activate Live SOC Ingestion Stream</span>
                  </button>
                </div>
              )}

              {gmailTab === 'enterprise' && (
                <div className="space-y-3 font-mono text-xs">
                  <div>
                    <label className="block text-[11px] text-[#9d9282] uppercase mb-1">Google Client ID</label>
                    <input
                      type="text"
                      placeholder="apps.googleusercontent.com"
                      value={clientIdInput}
                      onChange={(e) => setClientIdInput(e.target.value)}
                      className="w-full bg-[#100e0b] border border-[#2c261e] rounded p-2 text-[#ede6d8] focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#9d9282] uppercase mb-1">Google Client Secret</label>
                    <input
                      type="password"
                      placeholder="GOCSPX-..."
                      value={clientSecretInput}
                      onChange={(e) => setClientSecretInput(e.target.value)}
                      className="w-full bg-[#100e0b] border border-[#2c261e] rounded p-2 text-[#ede6d8] focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleSaveClientCredentials}
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    <span>Save Google API Credentials</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default ConnectGmailModal;
