import React, { useState, useMemo } from 'react';
import { 
  Zap, 
  Trash2, 
  ShieldAlert, 
  KeyRound, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Server, 
  Globe, 
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Terminal,
  Download,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';
import { EmailAnalysis } from '../types';

interface SoarPlaybookConsoleProps {
  analysis: EmailAnalysis;
  className?: string;
}

export function SoarPlaybookConsole({ analysis, className = '' }: SoarPlaybookConsoleProps) {
  const [clawbackRunning, setClawbackRunning] = useState(false);
  const [clawbackResult, setClawbackResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const messageId = analysis?.headers?.messageId || analysis?.headers?.['message-id'] || analysis?.messageId || '';
  const fromEmail = analysis?.from?.match(/<([^>]+)>/)?.[1] || analysis?.from || 'sender@evil.com';
  const fromDomain = fromEmail.split('@')[1] || 'evil-domain.com';
  
  const hops = Array.isArray(analysis?.hops) ? analysis.hops : [];
  const firstHop = hops.find(h => h.isOrigin) || hops[0];
  const originIp = (analysis as any)?.senderIp || firstHop?.fromIp || '198.51.100.23';

  // 1. Real Gmail Trash Action
  const handleExecuteGmailClawback = async () => {
    setClawbackRunning(true);
    setClawbackResult(null);

    const token = localStorage.getItem('google_access_token');
    const gmailMsgId = (analysis as any)?.gmailMessageId || (analysis as any)?.googleMessageId;

    if (!token) {
      setTimeout(() => {
        setClawbackRunning(false);
        setClawbackResult({
          success: false,
          message: 'Google Workspace OAuth token not found in browser. Authenticate via Google Live Sync tab to execute direct API purges, or copy the PowerShell command below.'
        });
      }, 600);
      return;
    }

    if (!gmailMsgId) {
      setTimeout(() => {
        setClawbackRunning(false);
        setClawbackResult({
          success: false,
          message: `This case was uploaded via raw EML file. Use the M365 PowerShell / GAM query below to purge Message-ID: <${messageId || 'N/A'}>.`
        });
      }, 600);
      return;
    }

    try {
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(gmailMsgId)}/trash`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error(`Gmail API returned HTTP ${res.status}`);
      }

      setClawbackResult({
        success: true,
        message: `Successfully moved message (${gmailMsgId}) to Trash in connected Gmail account via Google Workspace API.`
      });
    } catch (err: any) {
      setClawbackResult({
        success: false,
        message: `API execution failed: ${err.message || 'Network error'}`
      });
    } finally {
      setClawbackRunning(false);
    }
  };

  // 2. Real PowerShell Command for M365 Hard Purge
  const m365PowerShellCommand = useMemo(() => {
    const safeMsgId = (messageId || 'unknown-msg-id').replace(/[<>]/g, '');
    return `Search-Mailbox -Identity * -SearchQuery 'MessageId:"<${safeMsgId}>"' -DeleteContent -Force`;
  }, [messageId]);

  // 3. Real Google GAM command
  const gamCommand = useMemo(() => {
    const safeMsgId = (messageId || 'unknown-msg-id').replace(/[<>]/g, '');
    return `gam all users delete messages query "rfc822msgid:${safeMsgId}" doit`;
  }, [messageId]);

  // 4. Real Palo Alto CLI & iptables syntax
  const paloAltoCli = useMemo(() => {
    const sanitizedIp = originIp.replace(/[^0-9.]/g, '');
    return `set address ioc_block_${sanitizedIp.replace(/\./g, '_')} ip-netmask ${sanitizedIp}/32\nset address-group BLOCKED_THREAT_IPS member ioc_block_${sanitizedIp.replace(/\./g, '_')}`;
  }, [originIp]);

  const iptablesCmd = useMemo(() => {
    return `iptables -A INPUT -s ${originIp} -j DROP`;
  }, [originIp]);

  // 5. Download Real EDR IOC CSV file
  const handleDownloadIocCsv = () => {
    const rows = [
      ['Indicator', 'Type', 'Confidence', 'Description', 'CaseID'],
      [originIp, 'IPv4', 'High', `Origin IP of malicious email ${analysis.subject || ''}`, analysis.id || 'CASE'],
      [fromDomain, 'Domain', 'High', `Sender domain of malicious email ${analysis.subject || ''}`, analysis.id || 'CASE'],
      [analysis.sha256 || 'N/A', 'SHA256', 'High', 'Cryptographic digest of raw email envelope', analysis.id || 'CASE']
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `TraceXMail-IOCs-${analysis.id || 'case'}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(id);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  return (
    <div className={`rounded-xl border border-slate-800 bg-[#0e1017] p-5 shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                Real-Time Incident Response &amp; Containment Console
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                ACTIVE MITIGATION
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Live API execution for connected mailboxes and production-ready CLI scripts for enterprise firewalls and SIEMs.
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownloadIocCsv}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-blue-400" />
          <span>Download IOCs (.csv)</span>
        </button>
      </div>

      {/* Grid of Real Incident Response Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
        {/* Module 1: Live Mailbox Purge & Clawback */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="font-bold text-white flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Live Mailbox Purge</span>
              </div>
              <span className="text-[10px] text-slate-400 uppercase">Gmail / M365</span>
            </div>
            <p className="text-xs text-slate-300 font-sans leading-relaxed mb-3">
              Directly executes message deletion in your connected mailbox via Google API, or copy the production PowerShell command for Exchange Online.
            </p>

            {clawbackResult && (
              <div className={`p-2.5 rounded text-[11px] mb-3 ${
                clawbackResult.success 
                  ? 'bg-emerald-950/60 border border-emerald-600 text-emerald-300' 
                  : 'bg-amber-950/60 border border-amber-700 text-amber-200'
              }`}>
                {clawbackResult.message}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={handleExecuteGmailClawback}
              disabled={clawbackRunning}
              className="w-full py-2 px-3 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {clawbackRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Executing API Call...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Execute Trash Action via Gmail API</span>
                </>
              )}
            </button>

            {/* PowerShell Snippet */}
            <div className="p-2 rounded bg-black/60 border border-slate-800 text-[10px]">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span>M365 Exchange Online PowerShell:</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(m365PowerShellCommand, 'ps')}
                  className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {copiedItem === 'ps' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedItem === 'ps' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <code className="text-sky-300 break-all">{m365PowerShellCommand}</code>
            </div>
          </div>
        </div>

        {/* Module 2: Firewall Perimeter Blocking */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="font-bold text-white flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-amber-400" />
                <span>Firewall Rule Generator</span>
              </div>
              <span className="text-[10px] text-slate-400 uppercase">Palo Alto / Linux</span>
            </div>
            <p className="text-xs text-slate-300 font-sans leading-relaxed mb-2">
              Generated rule syntax for the observed origin IP <code className="text-amber-300">{originIp}</code> ready for edge firewall deployment.
            </p>
          </div>

          <div className="space-y-2">
            {/* Palo Alto PAN-OS */}
            <div className="p-2 rounded bg-black/60 border border-slate-800 text-[10px]">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span>Palo Alto Networks PAN-OS CLI:</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(paloAltoCli, 'pa')}
                  className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {copiedItem === 'pa' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedItem === 'pa' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <code className="text-emerald-300 break-all">{paloAltoCli}</code>
            </div>

            {/* Linux iptables */}
            <div className="p-2 rounded bg-black/60 border border-slate-800 text-[10px]">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span>Linux iptables:</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(iptablesCmd, 'iptables')}
                  className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {copiedItem === 'iptables' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedItem === 'iptables' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <code className="text-amber-300 break-all">{iptablesCmd}</code>
            </div>
          </div>
        </div>

        {/* Module 3: Local Host DNS Sinkhole */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="font-bold text-white flex items-center gap-1.5">
                <Server className="w-4 h-4 text-purple-400" />
                <span>Local DNS Sinkhole Entry</span>
              </div>
              <span className="text-[10px] text-slate-400 uppercase">/etc/hosts</span>
            </div>
            <p className="text-xs text-slate-300 font-sans leading-relaxed mb-2">
              Redirects adversary domain <code className="text-purple-300">{fromDomain}</code> to loopback address (127.0.0.1) on local analysis machines.
            </p>
          </div>

          <div className="p-2 rounded bg-black/60 border border-slate-800 text-[10px]">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span>Hosts file line:</span>
              <button
                type="button"
                onClick={() => copyToClipboard(`127.0.0.1 ${fromDomain}`, 'hosts')}
                className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                {copiedItem === 'hosts' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedItem === 'hosts' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <code className="text-purple-300">127.0.0.1 {fromDomain}</code>
          </div>
        </div>

        {/* Module 4: Google Workspace Admin Console Deep Link */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="font-bold text-white flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-sky-400" />
                <span>Identity Containment Portal</span>
              </div>
              <span className="text-[10px] text-slate-400 uppercase">Admin Portals</span>
            </div>
            <p className="text-xs text-slate-300 font-sans leading-relaxed mb-2">
              Launch enterprise directory management consoles to terminate active session tokens or enforce credential rotation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://admin.google.com"
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-2 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Google Admin Console</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
            <a
              href="https://entra.microsoft.com"
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-2 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Microsoft Entra</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
