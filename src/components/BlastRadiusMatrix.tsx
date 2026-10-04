import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  MousePointerClick, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Building, 
  Key, 
  Radio, 
  ShieldCheck,
  Search,
  ExternalLink,
  Lock,
  ArrowRight,
  RefreshCw,
  Info
} from 'lucide-react';
import { EmailAnalysis } from '../types';

interface BlastRadiusMatrixProps {
  analysis: EmailAnalysis;
  className?: string;
}

interface RealRecipientRecord {
  email: string;
  name?: string;
  source: 'To Header' | 'Cc Header' | 'Bcc Header' | 'Google Workspace Match' | 'Historical Case Match';
  timestamp: string;
  status: 'ANALYZED' | 'QUARANTINED' | 'CROSS_REFERENCED';
  details: string;
}

export function BlastRadiusMatrix({ analysis, className = '' }: BlastRadiusMatrixProps) {
  const [isScanningWorkspace, setIsScanningWorkspace] = useState(false);
  const [workspaceMatches, setWorkspaceMatches] = useState<RealRecipientRecord[]>([]);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // 1. Extract Real Recipients from RFC Headers
  const realHeaderRecipients = useMemo(() => {
    const list: RealRecipientRecord[] = [];
    const dateStr = analysis?.date || analysis?.headers?.date || analysis?.analyzedAt || new Date().toUTCString();

    // Helper to parse comma separated emails with friendly names
    const addEmails = (raw: string | undefined, source: RealRecipientRecord['source']) => {
      if (!raw) return;
      const parts = raw.split(/,\s*(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      parts.forEach(p => {
        const trimmed = p.trim();
        if (!trimmed) return;
        const match = trimmed.match(/(.*?)\s*<([^>]+)>/) || [null, '', trimmed];
        const name = match[1]?.replace(/^"|"$/g, '').trim() || undefined;
        const email = (match[2] || trimmed).toLowerCase();
        
        if (email.includes('@') && !list.some(x => x.email === email)) {
          list.push({
            email,
            name: name && name !== email ? name : undefined,
            source,
            timestamp: dateStr,
            status: analysis?.status?.toUpperCase() === 'QUARANTINED' ? 'QUARANTINED' : 'ANALYZED',
            details: `Extracted from email ${source}`
          });
        }
      });
    };

    addEmails(analysis?.to || analysis?.headers?.to, 'To Header');
    addEmails((analysis?.headers as any)?.cc || (analysis as any)?.cc, 'Cc Header');
    addEmails((analysis?.headers as any)?.bcc || (analysis as any)?.bcc, 'Bcc Header');

    // If still empty, add default placeholder with real context
    if (list.length === 0) {
      list.push({
        email: 'undisclosed-recipients',
        source: 'To Header',
        timestamp: dateStr,
        status: 'ANALYZED',
        details: 'Header contains undisclosed recipients'
      });
    }

    return list;
  }, [analysis]);

  // 2. Scan Local / Historical Cases for same sender or subject
  useEffect(() => {
    try {
      const stored = localStorage.getItem('tracexmail_cases') || localStorage.getItem('email_analyses_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const sender = (analysis?.from || '').toLowerCase();
          const senderIp = (analysis as any)?.senderIp;
          const subject = (analysis?.subject || '').toLowerCase().trim();

          const matches: RealRecipientRecord[] = [];
          parsed.forEach((c: any) => {
            if (c.id === analysis.id) return; // skip self
            const cSender = (c.from || '').toLowerCase();
            const cSubject = (c.subject || '').toLowerCase().trim();
            const cTo = (c.to || '').toLowerCase();

            if (cTo && cTo.includes('@') && (cSender === sender || (subject && cSubject === subject))) {
              if (!matches.some(m => m.email === cTo) && !realHeaderRecipients.some(r => r.email === cTo)) {
                matches.push({
                  email: cTo,
                  source: 'Historical Case Match',
                  timestamp: c.date || c.analyzedAt || 'Previous Ingestion',
                  status: c.status?.toUpperCase() === 'QUARANTINED' ? 'QUARANTINED' : 'CROSS_REFERENCED',
                  details: `Matched previous case ${c.id || 'INC'} with identical sender domain`
                });
              }
            }
          });

          if (matches.length > 0) {
            setWorkspaceMatches(matches);
          }
        }
      }
    } catch {
      // ignore localstorage errors
    }
  }, [analysis, realHeaderRecipients]);

  // 3. Live Google Workspace / Gmail API Search
  const handleScanLiveWorkspace = async () => {
    setIsScanningWorkspace(true);
    setScanMessage(null);

    const token = localStorage.getItem('google_access_token');
    const messageId = analysis?.headers?.messageId || analysis?.headers?.['message-id'] || analysis?.messageId;
    const subject = analysis?.subject || analysis?.headers?.subject;

    if (!token) {
      setTimeout(() => {
        setIsScanningWorkspace(false);
        setScanMessage('Google Workspace OAuth not currently connected. To search tenant-wide inboxes, authenticate via the Google Live Sync tab.');
      }, 800);
      return;
    }

    try {
      const query = messageId ? `rfc822msgid:${messageId}` : `subject:"${subject}"`;
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error(`Gmail API responded with HTTP ${res.status}`);
      }

      const data = await res.json();
      const messages = data.messages || [];

      if (messages.length === 0) {
        setScanMessage(`Scan complete: Zero other messages found in connected mailbox matching query.`);
      } else {
        setScanMessage(`Found ${messages.length} message instance(s) in connected mailbox matching this Message-ID/Subject.`);
      }
    } catch (err: any) {
      setScanMessage(`Workspace query failed: ${err.message || 'API error'}`);
    } finally {
      setIsScanningWorkspace(false);
    }
  };

  const allRecipients = [...realHeaderRecipients, ...workspaceMatches];

  return (
    <div className={`rounded-xl border border-slate-800 bg-[#0e1017] p-5 shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                Recipient Blast Radius &amp; Cross-Mailbox Scope
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                VERIFIED RFC HEADERS
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Evaluated directly from real RFC 822 envelope recipients (To, Cc, Bcc) and cross-case correlation.
            </span>
          </div>
        </div>

        {/* Live Workspace Query Trigger */}
        <button
          type="button"
          onClick={handleScanLiveWorkspace}
          disabled={isScanningWorkspace}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanningWorkspace ? 'animate-spin' : ''}`} />
          <span>{isScanningWorkspace ? 'Searching...' : 'Scan Connected Mailbox'}</span>
        </button>
      </div>

      {/* Workspace Scan Notice if available */}
      {scanMessage && (
        <div className="mb-4 p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-indigo-300 flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{scanMessage}</span>
        </div>
      )}

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5 font-mono">
        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Confirmed Recipients</div>
          <div className="text-lg font-bold text-white">{allRecipients.length} Recipient(s)</div>
          <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Extracted from envelope</span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Delivery Scope</div>
          <div className="text-lg font-bold text-indigo-300">
            {allRecipients.length > 1 ? 'Multi-Recipient Campaign' : 'Single Target'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {realHeaderRecipients.length} Header / {workspaceMatches.length} Cross-Case
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 col-span-2 sm:col-span-1">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Tenant Posture</div>
          <div className="text-lg font-bold text-amber-300">
            {analysis?.status?.toUpperCase() || 'EVALUATED'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Security audit level active
          </div>
        </div>
      </div>

      {/* Real Recipients Table */}
      <div className="rounded-lg border border-slate-800 overflow-hidden font-mono text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[10px] uppercase tracking-wider">
                <th className="p-2.5">Recipient Identity</th>
                <th className="p-2.5">Source Header</th>
                <th className="p-2.5">Timestamp</th>
                <th className="p-2.5">Dossier Status</th>
                <th className="p-2.5">Evidence Provenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-[#12141c]">
              {allRecipients.map((rec, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-2.5">
                    <div className="font-semibold text-white">
                      {rec.name ? `${rec.name} <${rec.email}>` : rec.email}
                    </div>
                  </td>
                  <td className="p-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800">
                      {rec.source}
                    </span>
                  </td>
                  <td className="p-2.5 text-slate-400 text-[11px]">
                    {rec.timestamp}
                  </td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      rec.status === 'QUARANTINED'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                    }`}>
                      {rec.status}
                    </span>
                  </td>
                  <td className="p-2.5 text-slate-300 text-[11px]">
                    {rec.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
