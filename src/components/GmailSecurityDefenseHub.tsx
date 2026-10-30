import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Trash2, 
  Tag, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink, 
  Lock, 
  Mail, 
  AlertOctagon,
  Clock,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  Send,
  SendHorizontal,
  Sparkles,
  Copy,
  FileText,
  Layers,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { EmailAnalysis } from '../types';
import { apiFetch } from '../lib/api';

interface GmailSecurityDefenseHubProps {
  analysis?: EmailAnalysis;
  onNavigateToCase?: (caseId: string) => void;
  className?: string;
}

export function GmailSecurityDefenseHub({
  analysis,
  onNavigateToCase,
  className = ''
}: GmailSecurityDefenseHubProps) {
  const [searchQuery, setSearchQuery] = useState('label:INBOX');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Quarantine & Filter State
  const [isQuarantining, setIsQuarantining] = useState(false);
  const [quarantineResult, setQuarantineResult] = useState<string | null>(null);
  
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterResult, setFilterResult] = useState<string | null>(null);

  // Mandatory Confirmation Dialog State (as required by Google Workspace integration)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionType: 'quarantine' | 'create_filter' | 'trash';
    targetId?: string;
    targetDomain?: string;
  } | null>(null);

  // SOAR Alert Dispatch Modal State
  const [showSoarModal, setShowSoarModal] = useState(false);
  const [soarRecipient, setSoarRecipient] = useState('');
  const [soarSubject, setSoarSubject] = useState('');
  const [soarBody, setSoarBody] = useState('');
  const [soarTemplate, setSoarTemplate] = useState<'credential_harvest' | 'vip_spoof' | 'malware_quarantine' | 'custom'>('credential_harvest');
  const [soarSending, setSoarSending] = useState(false);
  const [soarResult, setSoarResult] = useState<{ success: boolean; message: string; messageId?: string } | null>(null);
  const [copiedSoarBody, setCopiedSoarBody] = useState(false);

  // Extract relevant values from current analysis if provided
  const fromEmail = analysis?.from?.match(/<([^>]+)>/)?.[1] || analysis?.from || '';
  const fromDomain = fromEmail.includes('@') ? fromEmail.split('@')[1] : '';
  const gmailMessageId = (analysis as any)?.gmailMessageId || (analysis as any)?.googleMessageId;

  // Search Presets
  const presets = [
    { label: 'Dangerous Executable / Macro Attachments', query: 'has:attachment (filename:exe OR filename:xlsm OR filename:iso OR filename:vbs)' },
    { label: 'Financial Coercion Lures', query: 'subject:"wire transfer" OR subject:"urgent payment" OR subject:"invoice overdue"' },
    { label: 'Credential Harvest Keyword Mimicry', query: 'subject:"account suspended" OR subject:"verify password" OR subject:"mfa session"' },
    { label: 'All Unread Inbound Messages', query: 'is:unread label:INBOX' }
  ];

  const applySoarTemplate = (templateType: 'credential_harvest' | 'vip_spoof' | 'malware_quarantine' | 'custom') => {
    setSoarTemplate(templateType);
    setSoarResult(null);
    const caseId = analysis?.id || `CASE-${Date.now().toString(36).toUpperCase()}`;
    const threatScore = analysis?.threatScore ?? 85;
    const sender = fromEmail || 'unknown-sender@external.net';
    const targetRecipient = (analysis as any)?.to || localStorage.getItem('user_email') || 'security-team@enterprise.org';

    if (templateType === 'credential_harvest') {
      setSoarSubject(`🚨 [SOC ALERT] Potential Credential Harvesting Incident (${caseId})`);
      setSoarRecipient(targetRecipient);
      setSoarBody(
`ATTENTION: TraceXMail SOAR Automated Incident Notice
Incident Case: ${caseId}
Severity: CRITICAL (Threat Score: ${threatScore}/100)
Detected Sender: ${sender}
Target Mailbox: ${targetRecipient}

INCIDENT SUMMARY:
An inbound email exhibiting deceptive credential harvesting patterns has been triaged by TraceXMail Security Enclave. The communication attempted to coerce users into providing credentials through falsified authentication portals.

SECURITY DIRECTIVE & IMMEDIATE ACTIONS:
1. DO NOT click any links or download attachments from ${sender}.
2. If credentials were submitted, immediately reset your corporate SSO password and revoke active session tokens.
3. Verify your Multi-Factor Authentication (MFA/2FA) enrollment in Google Workspace.
4. This incident has been recorded in the TraceXMail forensic audit log.

Reported by: TraceXMail SOAR Automation Engine
Timestamp: ${new Date().toUTCString()}`
      );
    } else if (templateType === 'vip_spoof') {
      setSoarSubject(`⚠️ [SOC WARNING] Executive / VIP Impersonation Attempt Quarantined (${caseId})`);
      setSoarRecipient(targetRecipient);
      setSoarBody(
`ATTENTION: Executive Protection & Impersonation Alert
Incident Case: ${caseId}
Severity: HIGH (Threat Score: ${threatScore}/100)
Impersonated Domain / Identity: ${fromDomain || 'Executive Entity'}
Sender Address: ${sender}

INCIDENT SUMMARY:
The TraceXMail heuristic engine intercepted an inbound message attempting executive identity mimicry (Business Email Compromise - BEC). The communication may request unauthorized wire transfers, gift card purchases, or confidential employee data.

SECURITY DIRECTIVE:
1. This communication is fraudulent and was NOT sent by corporate leadership.
2. The message has been held in quarantine and flagged with TraceXMail/QUARANTINED.
3. No financial transfers or sensitive data dispatches should be executed based on this thread.

TraceXMail SOC Operations Team`
      );
    } else if (templateType === 'malware_quarantine') {
      setSoarSubject(`🛡️ [SOC NOTICE] Malicious Attachment Quarantined by TraceXMail Gate (${caseId})`);
      setSoarRecipient(targetRecipient);
      setSoarBody(
`ATTENTION: Malicious Payload Interception Notice
Incident Case: ${caseId}
Verdict: MALICIOUS_ATTACHMENT (Score: ${threatScore}/100)
Originating Sender: ${sender}

INCIDENT SUMMARY:
An email containing potentially weaponized macros, executables, or disguised archive attachments was intercepted before mailbox delivery. The message has been quarantined in accordance with enterprise zero-trust email policies.

STATUS:
- Quarantined: YES (TraceXMail/QUARANTINED)
- Recipient Action Required: None. Mailbox is protected.
- Detailed forensics are available to SOC administrators in TraceXMail Incident Case #${caseId}.`
      );
    } else {
      setSoarSubject(`[SOC Security Directive] Incident ${caseId}`);
      setSoarRecipient(targetRecipient);
      setSoarBody(
`TraceXMail Security Directive
Case ID: ${caseId}
Threat Score: ${threatScore}/100
Sender: ${sender}

[Enter customized SOC analyst notes and instructions here]`
      );
    }
  };

  const handleOpenSoarModal = (defaultTemplate?: 'credential_harvest' | 'vip_spoof' | 'malware_quarantine' | 'custom') => {
    applySoarTemplate(defaultTemplate || 'credential_harvest');
    setShowSoarModal(true);
  };

  const handleDispatchSoarAlert = async () => {
    if (!soarRecipient || !soarSubject || !soarBody) {
      setSoarResult({ success: false, message: 'Please provide recipient email, subject, and message body.' });
      return;
    }
    setSoarSending(true);
    setSoarResult(null);

    try {
      const res = await apiFetch('/api/gmail/send-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: soarRecipient.trim(),
          subject: soarSubject.trim(),
          body: soarBody.trim(),
          htmlBody: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #334155; border-radius: 10px; background-color: #0b0f19; color: #f1f5f9;">
            <div style="border-bottom: 2px solid #ef4444; padding-bottom: 12px; margin-bottom: 18px;">
              <h2 style="color: #ef4444; margin: 0; font-size: 18px; letter-spacing: 0.5px;">TraceXMail SOAR • Automated Security Advisory</h2>
            </div>
            <pre style="background: #111827; padding: 18px; border-radius: 8px; border: 1px solid #1f2937; white-space: pre-wrap; font-family: 'JetBrains Mono', Consolas, Monaco, monospace; font-size: 13px; line-height: 1.6; color: #e2e8f0;">${soarBody.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
            <hr style="border: 0; border-top: 1px solid #1e293b; margin: 24px 0 16px;" />
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">Dispatched automatically by TraceXMail Enterprise Security Orchestration, Automation and Response (SOAR) via Google Workspace Gmail API.</p>
          </div>`
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSoarResult({
          success: true,
          message: data.message || `Alert email successfully dispatched to ${soarRecipient}!`,
          messageId: data.messageId
        });
      } else {
        throw new Error(data.error || 'Failed to dispatch alert email');
      }
    } catch (err: any) {
      setSoarResult({
        success: false,
        message: 'Dispatch error: ' + (err.message || 'Unknown network error')
      });
    } finally {
      setSoarSending(false);
    }
  };

  const handleExecuteSearch = async (queryToRun?: string) => {
    const q = queryToRun || searchQuery;
    setIsSearching(true);
    setSearchError(null);

    try {
      const res = await apiFetch(`/api/gmail/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to search Gmail messages');
      }

      setSearchResults(data.messages || []);
    } catch (err: any) {
      setSearchError(err.message || 'Error executing Gmail search');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmModal) return;
    const { actionType, targetId, targetDomain } = confirmModal;
    setConfirmModal(null);

    if (actionType === 'quarantine' && targetId) {
      setIsQuarantining(true);
      setQuarantineResult(null);
      try {
        const res = await apiFetch('/api/gmail/quarantine-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: targetId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to quarantine');
        setQuarantineResult(`Message ${targetId} successfully quarantined in Gmail under "${data.labelApplied}" and removed from INBOX.`);
      } catch (err: any) {
        setQuarantineResult(`Quarantine error: ${err.message}`);
      } finally {
        setIsQuarantining(false);
      }
    } else if (actionType === 'create_filter' && targetDomain) {
      setIsFiltering(true);
      setFilterResult(null);
      try {
        const res = await apiFetch('/api/gmail/create-filter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromCriteria: targetDomain })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create filter');
        setFilterResult(`Active rule created in Gmail! All future inbound emails from "*@${targetDomain}" will be immediately sent to Trash.`);
      } catch (err: any) {
        setFilterResult(`Filter creation error: ${err.message}`);
      } finally {
        setIsFiltering(false);
      }
    } else if (actionType === 'trash' && targetId) {
      try {
        const res = await apiFetch('/api/gmail/trash-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: targetId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to trash');
        setSearchResults(prev => prev.filter(m => m.id !== targetId));
      } catch (err: any) {
        alert(`Failed to trash message: ${err.message}`);
      }
    }
  };

  return (
    <div className={`rounded-xl border border-indigo-500/30 bg-[#0c0f18] p-5 shadow-xl ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-500/20 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-white uppercase tracking-wider">
                Gmail Enterprise Defense &amp; Threat Hunter
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                OFFICIAL WORKSPACE API
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated mailbox quarantine, native sender domain blacklisting, cross-inbox queries, and SOAR alert dispatch.
            </p>
          </div>
        </div>

        {/* Dynamic Logged-in User Mailbox Indicator & Quick SOAR Action */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto font-mono text-xs flex-wrap">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] text-slate-400">Mailbox:</span>
            <span className="text-[11px] font-bold text-white truncate max-w-[200px]">
              {localStorage.getItem('user_email') || 'Logged-in User Account'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleOpenSoarModal('custom')}
            className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Dispatch SOAR Alert Email via Gmail API (gmail.send)"
          >
            <Send className="w-3.5 h-3.5 text-indigo-400" />
            <span>SOAR Alert Dispatch</span>
          </button>
        </div>
      </div>

      {/* Action Row: 1-Click Live Actions for Current Case */}
      {analysis && (
        <div className="mb-6 p-4 rounded-lg bg-[#141826] border border-slate-800 space-y-3">
          <div className="text-xs font-mono font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-400" />
            <span>Active Incident Response Actions (Case: {analysis.id || 'INCIDENT'})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
            {/* Action 1: Quarantine Button */}
            <div className="p-3 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="font-bold text-white mb-1 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-rose-400" />
                  <span>Quarantine in Gmail</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans mb-3">
                  Removes this message from INBOX and tags it with the prominent red <code className="text-rose-300">TraceXMail/QUARANTINED</code> label.
                </p>
              </div>

              {quarantineResult && (
                <div className="mb-2 p-2 rounded text-[11px] bg-slate-950 border border-slate-700 text-slate-300">
                  {quarantineResult}
                </div>
              )}

              <button
                type="button"
                onClick={() => setConfirmModal({
                  isOpen: true,
                  title: 'Confirm Message Quarantine in Gmail',
                  description: `This action will remove the email from your primary INBOX, mark it as read, and attach the security label "TraceXMail/QUARANTINED" in your connected Gmail account.`,
                  actionType: 'quarantine',
                  targetId: gmailMessageId || analysis.id
                })}
                disabled={isQuarantining}
                className="w-full py-2 px-3 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>{isQuarantining ? 'Applying Quarantine...' : 'Apply Quarantine Label'}</span>
              </button>
            </div>

            {/* Action 2: Block Sender Domain Filter Button */}
            <div className="p-3 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="font-bold text-white mb-1 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-amber-400" />
                  <span>Permanent Domain Blacklist</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans mb-3">
                  Creates a server-side Gmail rule that intercepts future incoming messages from <code className="text-amber-300">@{fromDomain || 'sender-domain'}</code> and trashes them automatically.
                </p>
              </div>

              {filterResult && (
                <div className="mb-2 p-2 rounded text-[11px] bg-slate-950 border border-slate-700 text-slate-300">
                  {filterResult}
                </div>
              )}

              <button
                type="button"
                onClick={() => setConfirmModal({
                  isOpen: true,
                  title: `Create Permanent Gmail Filter for @${fromDomain}`,
                  description: `This will programmatically create a native Gmail Filter rule under your Google account settings. All future inbound emails from "*@${fromDomain}" will bypass your INBOX and be sent straight to Trash.`,
                  actionType: 'create_filter',
                  targetDomain: fromDomain || fromEmail
                })}
                disabled={isFiltering || !fromDomain}
                className="w-full py-2 px-3 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>{isFiltering ? 'Creating Filter Rule...' : `Block *@${fromDomain || 'Domain'}`}</span>
              </button>
            </div>

            {/* Action 3: Dispatch SOAR Alert Email */}
            <div className="p-3 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="font-bold text-white mb-1 flex items-center gap-1.5">
                  <SendHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Dispatch SOAR Alert</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans mb-3">
                  Transmits automated incident triage advisories, employee phishing alerts, or executive warnings via official <code className="text-indigo-300">gmail.send</code> scope.
                </p>
              </div>

              {soarResult && (
                <div className={`mb-2 p-2 rounded text-[11px] border ${soarResult.success ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300' : 'bg-rose-950/70 border-rose-800 text-rose-300'}`}>
                  {soarResult.message}
                </div>
              )}

              <button
                type="button"
                onClick={() => handleOpenSoarModal('credential_harvest')}
                className="w-full py-2 px-3 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Open SOAR Dispatch</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Threat Hunter Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Search className="w-4 h-4 text-indigo-400" />
            <span>Cross-Inbox Threat Hunter (Live Google Query)</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Powered by Google's native email index
          </span>
        </div>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExecuteSearch()}
              placeholder='e.g. has:attachment filename:xlsm OR from:*@evil.com'
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/60 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={() => handleExecuteSearch()}
            disabled={isSearching}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin' : ''}`} />
            <span>{isSearching ? 'Searching...' : 'Search Gmail'}</span>
          </button>
        </div>

        {/* Query Presets */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase mr-1">Forensic Presets:</span>
          {presets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setSearchQuery(p.query);
                handleExecuteSearch(p.query);
              }}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-mono transition-colors cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Search Results Display */}
        {searchError && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 font-mono text-xs">
            {searchError}
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="rounded-lg border border-slate-800 overflow-hidden font-mono text-xs mt-3">
            <div className="bg-slate-900 px-3 py-2 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Matching Gmail Messages ({searchResults.length})</span>
              <span>Click to quarantine or review</span>
            </div>

            <div className="divide-y divide-slate-800/60 bg-[#10131d] max-h-80 overflow-y-auto">
              {searchResults.map((m) => (
                <div key={m.id} className="p-3 hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-white truncate text-xs">{m.subject}</span>
                      {m.labelIds?.includes('TraceXMail/QUARANTINED') && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-950 text-rose-300 border border-rose-800 font-bold">
                          QUARANTINED
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      From: <span className="text-slate-300">{m.from}</span> • <span className="text-slate-500">{m.date}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-sans truncate mt-0.5">
                      {m.snippet}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmModal({
                        isOpen: true,
                        title: 'Quarantine Message',
                        description: `Apply "TraceXMail/QUARANTINED" and remove this message from INBOX?`,
                        actionType: 'quarantine',
                        targetId: m.id
                      })}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700 transition-colors cursor-pointer"
                      title="Quarantine in Gmail"
                    >
                      <Tag className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmModal({
                        isOpen: true,
                        title: 'Move Message to Trash',
                        description: `Move this email message (${m.subject}) directly to Trash in Gmail?`,
                        actionType: 'trash',
                        targetId: m.id
                      })}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                      title="Move to Trash"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mandatory User Confirmation Modal for Destructive/Mutating Operations */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121624] border-2 border-indigo-500/50 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>{confirmModal.title}</span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              {confirmModal.description}
            </p>

            <div className="p-3 rounded bg-black/50 border border-slate-800 text-[11px] text-slate-400">
              <span className="text-amber-400 font-bold block mb-1">Target Resource:</span>
              <span>{confirmModal.targetId || confirmModal.targetDomain}</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer shadow-md"
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOAR Alert Dispatch Modal */}
      {showSoarModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0f1422] border-2 border-indigo-500/50 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 font-mono text-xs my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <span>SOAR Automated Alert Dispatch</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-semibold">
                      gmail.send
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                    Transmit official incident response directives and employee warnings via Google Workspace API.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSoarModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Selector Tabs */}
            <div className="space-y-1.5 shrink-0">
              <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                Incident Response Template
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-sans">
                <button
                  type="button"
                  onClick={() => applySoarTemplate('credential_harvest')}
                  className={`p-2 rounded-lg text-left text-xs font-medium border transition-all cursor-pointer ${
                    soarTemplate === 'credential_harvest'
                      ? 'bg-rose-950/60 border-rose-500 text-rose-200 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Credential Phish</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">Password reset &amp; MFA</div>
                </button>

                <button
                  type="button"
                  onClick={() => applySoarTemplate('vip_spoof')}
                  className={`p-2 rounded-lg text-left text-xs font-medium border transition-all cursor-pointer ${
                    soarTemplate === 'vip_spoof'
                      ? 'bg-amber-950/60 border-amber-500 text-amber-200 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>VIP Spoof / BEC</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">Executive mimicry alert</div>
                </button>

                <button
                  type="button"
                  onClick={() => applySoarTemplate('malware_quarantine')}
                  className={`p-2 rounded-lg text-left text-xs font-medium border transition-all cursor-pointer ${
                    soarTemplate === 'malware_quarantine'
                      ? 'bg-purple-950/60 border-purple-500 text-purple-200 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>Malware Notice</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">Quarantined attachment</div>
                </button>

                <button
                  type="button"
                  onClick={() => applySoarTemplate('custom')}
                  className={`p-2 rounded-lg text-left text-xs font-medium border transition-all cursor-pointer ${
                    soarTemplate === 'custom'
                      ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>Custom Directive</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">Freeform SOC directive</div>
                </button>
              </div>
            </div>

            {/* Form Fields: Scrollable Area */}
            <div className="space-y-3.5 overflow-y-auto pr-1 flex-1">
              {/* Recipient */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-300 font-semibold uppercase tracking-wider">
                    Recipient Address (To) *
                  </label>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="text-slate-500">Quick fill:</span>
                    <button
                      type="button"
                      onClick={() => setSoarRecipient(localStorage.getItem('user_email') || 'security-lead@company.com')}
                      className="text-indigo-400 hover:underline cursor-pointer"
                    >
                      Admin
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => setSoarRecipient((analysis as any)?.to || 'affected-user@company.com')}
                      className="text-indigo-400 hover:underline cursor-pointer"
                    >
                      Targeted Employee
                    </button>
                  </div>
                </div>
                <input
                  type="email"
                  value={soarRecipient}
                  onChange={(e) => setSoarRecipient(e.target.value)}
                  placeholder="e.g. employee@company.com, soc-dispatch@company.com"
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="text-[11px] text-slate-300 font-semibold uppercase tracking-wider block mb-1">
                  Subject Line *
                </label>
                <input
                  type="text"
                  value={soarSubject}
                  onChange={(e) => setSoarSubject(e.target.value)}
                  placeholder="Subject of the security incident dispatch"
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Message Body */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-300 font-semibold uppercase tracking-wider">
                    Alert Body / Directive *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(soarBody);
                      setCopiedSoarBody(true);
                      setTimeout(() => setCopiedSoarBody(false), 2000);
                    }}
                    className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSoarBody ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSoarBody ? 'Copied' : 'Copy Text'}</span>
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={soarBody}
                  onChange={(e) => setSoarBody(e.target.value)}
                  className="w-full p-3 rounded-lg bg-black/70 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500 transition-colors leading-relaxed resize-y"
                  placeholder="Type or format your incident notification message..."
                />
              </div>

              {/* Dispatch Feedback / Result Banner */}
              {soarResult && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                    soarResult.success
                      ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-200'
                      : 'bg-rose-950/60 border-rose-700/60 text-rose-200'
                  }`}
                >
                  {soarResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <p className="font-bold">{soarResult.message}</p>
                    {soarResult.messageId && (
                      <p className="text-[10px] font-mono text-emerald-400/80">
                        Gmail Message ID: <code className="bg-black/40 px-1 py-0.5 rounded">{soarResult.messageId}</code>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-3 shrink-0">
              <div className="text-[11px] text-slate-500 font-sans">
                Sends RFC 2822 email directly via connected Gmail account.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSoarModal(false)}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleDispatchSoarAlert}
                  disabled={soarSending || !soarRecipient || !soarSubject}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold flex items-center gap-2 cursor-pointer shadow-md transition-all"
                >
                  {soarSending ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{soarSending ? 'Dispatching via Gmail...' : 'Send Alert Email'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

