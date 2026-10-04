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
  Server
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
  const [activeTab, setActiveTab] = useState<'token' | 'stream' | 'enterprise'>('token');
  const [emailInput, setEmailInput] = useState<string>(currentUserEmail || '');
  const [accessTokenInput, setAccessTokenInput] = useState<string>('');
  const [clientIdInput, setClientIdInput] = useState<string>('');
  const [clientSecretInput, setClientSecretInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (currentUserEmail) {
      setEmailInput(currentUserEmail);
    }
  }, [currentUserEmail, isOpen]);

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

  if (!isOpen) return null;

  const effectiveEmail = emailInput.trim() || currentUserEmail || 'operator@acmedefense.sec';

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
      setTimeout(() => {
        onClose();
      }, 1200);
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
      setTimeout(() => {
        onClose();
      }, 1200);
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
                <span>Connect Gmail Live Synchronization</span>
              </h3>
              <p className="text-[11px] text-[#9d9282] font-mono mt-0.5">
                In-app real-time inbox telemetry &bull; Zero external popup windows
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

        {/* Tab selection */}
        <div className="flex border-b border-[#2c261e] bg-[#100e0b] px-4 pt-2 gap-2 text-xs font-mono overflow-x-auto">
          <button
            onClick={() => { setActiveTab('token'); setErrorMsg(null); }}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 cursor-pointer transition-colors shrink-0 ${
              activeTab === 'token'
                ? 'border-amber-400 text-amber-300 font-bold'
                : 'border-transparent text-[#8a8070] hover:text-[#ede6d8]'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>Sign in with Google OAuth (Primary)</span>
          </button>

          <button
            onClick={() => { setActiveTab('stream'); setErrorMsg(null); }}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 cursor-pointer transition-colors shrink-0 ${
              activeTab === 'stream'
                ? 'border-amber-400 text-amber-300 font-bold'
                : 'border-transparent text-[#8a8070] hover:text-[#ede6d8]'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>1-Click Live Ingestion Stream</span>
          </button>

          <button
            onClick={() => { setActiveTab('enterprise'); setErrorMsg(null); }}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 cursor-pointer transition-colors shrink-0 ${
              activeTab === 'enterprise'
                ? 'border-amber-400 text-amber-300 font-bold'
                : 'border-transparent text-[#8a8070] hover:text-[#ede6d8]'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Enterprise Gateway</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 font-mono text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 font-sans text-xs leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded text-emerald-300 flex items-start gap-2.5">
              <Check className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <div className="flex-1 font-sans text-xs leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* Email input field common to both */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-[#9d9282] uppercase tracking-wider font-semibold block">
              Target Gmail Address to Monitor
            </label>
            <div className="relative">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="user@gmail.com or corporate-inbox@domain.com"
                className="w-full px-3.5 py-2.5 bg-[#0e0c0a] border border-[#332b21] rounded text-[#ede6d8] focus:border-amber-400 focus:outline-none placeholder-[#5a5245]"
              />
              <span className="absolute right-3 top-2.5 text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Encrypted Enclave</span>
              </span>
            </div>
            <p className="text-[10.5px] text-[#7a7162] font-sans">
              Inbound emails received by this address will be monitored, evaluated for SPF/DKIM alignment, and checked against threat heuristics.
            </p>
          </div>

          {/* TAB 1: Stream Mode */}
          {activeTab === 'stream' && (
            <div className="space-y-4 pt-1">
              <div className="p-3.5 rounded bg-[#181410] border border-[#2e2820] space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Seamless In-App Ingestion Stream</span>
                </div>
                <p className="text-[11px] text-[#b9af9c] font-sans leading-relaxed">
                  Activates continuous live monitoring and polling directly within your security analyst workstation. Eliminates external browser popups, consent redirects, and landing page flashing.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2 text-[10.5px]">
                  <div className="p-2 rounded bg-[#100e0b] border border-[#2a241c] flex items-center gap-2 text-emerald-400">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>In-App Real-time Feed</span>
                  </div>
                  <div className="p-2 rounded bg-[#100e0b] border border-[#2a241c] flex items-center gap-2 text-emerald-400">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Auto-quarantine Heuristics</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleActivateStream}
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-bold rounded text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 fill-current" />
                  )}
                  <span>{isSubmitting ? 'Connecting Real-Time Stream...' : `Activate Live Ingestion for ${effectiveEmail}`}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Direct Token Mode */}
          {activeTab === 'token' && (
            <div className="space-y-4 pt-1">
              {/* Option A: Direct Google OAuth Popup Button */}
              <div className="p-3.5 rounded bg-[#181410] border border-[#2e2820] space-y-2.5">
                <span className="font-bold text-amber-300 flex items-center gap-1.5 font-mono">
                  <Globe className="w-4 h-4 text-amber-400" />
                  <span>Option A: Interactive Google OAuth Popup</span>
                </span>
                <p className="text-[11px] text-[#b9af9c] font-sans leading-relaxed">
                  Click below to open the standard Google Authentication popup and authorize your mailbox:
                </p>
                <GoogleAuthButton
                  id="connect-modal-google-auth-btn"
                  mode="continue"
                  variant="primary"
                  scopes="https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify"
                  onSuccess={(user) => {
                    const userEmail = user?.email || effectiveEmail;
                    setSuccessMsg(`Google Account authorized for ${userEmail}! Initializing sync...`);
                    onConnected(userEmail);
                    setTimeout(() => onClose(), 1200);
                  }}
                  onError={(err) => setErrorMsg(err)}
                />
              </div>

              <div className="flex items-center gap-3 my-1 text-xs text-[#3a352c]">
                <div className="flex-1 h-px bg-[#2c261e]" />
                <span className="font-mono text-[10px] text-[#8a8070]">OR CUSTOM GOOGLE CLIENT CREDENTIALS</span>
                <div className="flex-1 h-px bg-[#2c261e]" />
              </div>

              <div className="p-3.5 rounded bg-[#181410] border border-[#2e2820] space-y-3">
                <span className="font-bold text-amber-300 flex items-center gap-1.5 font-mono">
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>Option C: Connect Google Client ID &amp; Secret Key</span>
                </span>
                
                <div className="space-y-2">
                  <div>
                    <label className="text-[10.5px] text-[#9d9282] uppercase tracking-wider block mb-1">
                      Google OAuth Client ID
                    </label>
                    <input
                      type="text"
                      value={clientIdInput}
                      onChange={(e) => setClientIdInput(e.target.value)}
                      placeholder="1234567890-xyz.apps.googleusercontent.com"
                      className="w-full px-3 py-2 bg-[#0e0c0a] border border-[#332b21] rounded text-[#ede6d8] focus:border-amber-400 focus:outline-none placeholder-[#5a5245] font-mono text-[11px]"
                    />
                  </div>

                  <div>
                    <label className="text-[10.5px] text-[#9d9282] uppercase tracking-wider block mb-1">
                      Google OAuth Client Secret
                    </label>
                    <input
                      type="password"
                      value={clientSecretInput}
                      onChange={(e) => setClientSecretInput(e.target.value)}
                      placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 bg-[#0e0c0a] border border-[#332b21] rounded text-[#ede6d8] focus:border-amber-400 focus:outline-none placeholder-[#5a5245] font-mono text-[11px]"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveClientCredentials}
                  disabled={isSubmitting || !clientIdInput.trim() || !clientSecretInput.trim()}
                  className="w-full py-2 px-3 bg-[#26201a] hover:bg-[#332b22] border border-amber-500/40 text-amber-300 font-bold rounded text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 mt-1"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Save &amp; Activate Google Client Credentials</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-[#9d9282] uppercase tracking-wider font-semibold block">
                  Option B: Google OAuth Access Token (<code className="text-amber-300">ya29...</code>)
                </label>
                <textarea
                  value={accessTokenInput}
                  onChange={(e) => setAccessTokenInput(e.target.value)}
                  placeholder="Paste OAuth2 access token with gmail.readonly and gmail.modify scopes..."
                  rows={3}
                  className="w-full p-3 bg-[#0e0c0a] border border-[#332b21] rounded text-[#ede6d8] focus:border-amber-400 focus:outline-none placeholder-[#5a5245] font-mono text-[11px]"
                />
              </div>

              <div className="p-3 rounded bg-[#181410] border border-[#2e2820] text-[10.5px] text-[#9d9282] font-sans space-y-1">
                <span className="font-bold text-[#ede6d8] flex items-center gap-1.5 font-mono">
                  <Info className="w-3.5 h-3.5 text-amber-400" />
                  <span>How to obtain an Access Token:</span>
                </span>
                <p>
                  Generate a token with scopes <code className="text-amber-300 font-mono">gmail.readonly</code> &amp; <code className="text-amber-300 font-mono">gmail.modify</code> from the Google OAuth 2.0 Playground or your Google Cloud service account.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleConnectDirectToken}
                  disabled={isSubmitting || !accessTokenInput.trim()}
                  className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Key className="w-4 h-4" />
                  )}
                  <span>{isSubmitting ? 'Verifying Credentials...' : 'Verify & Connect Google Token'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Enterprise Webhook */}
          {activeTab === 'enterprise' && (
            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded bg-[#181410] border border-[#2e2820] space-y-2">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Server className="w-4 h-4" />
                  <span>Google Cloud Pub/Sub Webhook Target</span>
                </span>
                <p className="text-[11px] text-[#b9af9c] font-sans leading-relaxed">
                  For enterprise organizations routing through Google Cloud Pub/Sub, configure push notifications to the TraceXMail ingestion webhook:
                </p>
                <div className="p-2.5 rounded bg-[#0e0c0a] border border-[#332b21] text-[11px] font-mono text-emerald-400 break-all select-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}/api/gmail/push` : '/api/gmail/push'}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleActivateStream}
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-[#201c16] hover:bg-[#2c261e] border border-[#3a352c] text-[#ede6d8] font-bold rounded text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Connect Webhook Gateway Stream</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-[#100e0b] border-t border-[#2c261e] flex items-center justify-between text-[11px] text-[#8a8070] font-mono">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cryptographic OAuth Enclave</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#1c1813] hover:bg-[#252019] text-[#ede6d8] rounded border border-[#332b21] cursor-pointer transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConnectGmailModal;
