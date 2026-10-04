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
  X
} from 'lucide-react';
import { EmailAnalysis } from '../types';

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

  const handleExecuteSearch = async (queryToRun?: string) => {
    const q = queryToRun || searchQuery;
    setIsSearching(true);
    setSearchError(null);

    try {
      const token = localStorage.getItem('google_access_token');
      const userEmail = localStorage.getItem('user_email') || '';
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (userEmail) headers['x-user-email'] = userEmail;

      const res = await fetch(`/api/gmail/search?q=${encodeURIComponent(q)}`, { headers });
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

    const token = localStorage.getItem('google_access_token');
    const userEmail = localStorage.getItem('user_email') || '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (userEmail) headers['x-user-email'] = userEmail;

    if (actionType === 'quarantine' && targetId) {
      setIsQuarantining(true);
      setQuarantineResult(null);
      try {
        const res = await fetch('/api/gmail/quarantine-message', {
          method: 'POST',
          headers,
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
        const res = await fetch('/api/gmail/create-filter', {
          method: 'POST',
          headers,
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
        const res = await fetch('/api/gmail/trash-message', {
          method: 'POST',
          headers,
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
              Automated mailbox quarantine, native sender domain blacklisting, and cross-inbox threat queries.
            </p>
          </div>
        </div>

        {/* Dynamic Logged-in User Mailbox Indicator */}
        <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] text-slate-400">Mailbox:</span>
            <span className="text-[11px] font-bold text-white truncate max-w-[220px]">
              {localStorage.getItem('user_email') || 'Logged-in User Account'}
            </span>
          </div>
        </div>
      </div>

      {/* Action Row: 1-Click Live Actions for Current Case */}
      {analysis && (
        <div className="mb-6 p-4 rounded-lg bg-[#141826] border border-slate-800 space-y-3">
          <div className="text-xs font-mono font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-400" />
            <span>Active Incident Response Actions (Case: {analysis.id || 'INCIDENT'})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
            {/* Quarantine Button */}
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

            {/* Block Sender Domain Filter Button */}
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
    </div>
  );
}
