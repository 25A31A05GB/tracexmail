import React, { useState } from 'react';
import { X, ShieldAlert, Zap, CheckCircle2, Loader2, Lock, Ban, MailX, AlertCircle } from 'lucide-react';
import { EmailAnalysis } from '../types';
import { apiFetch } from '../lib/api';

interface SoarActionModalProps {
  analysis: EmailAnalysis;
  onClose: () => void;
}

export function SoarActionModal({ analysis, onClose }: SoarActionModalProps) {
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [completedActions, setCompletedActions] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const senderEmail = analysis.headers?.fromEmail || analysis.from || '';
  const senderDomain = senderEmail.includes('@') ? senderEmail.split('@')[1] : '';
  const firstHopIp = analysis.hops?.[0]?.fromIp || (analysis.hops?.[0] as any)?.ip || '';

  const handleExecute = async (actionKey: string, actionTitle: string) => {
    setExecutingAction(actionKey);
    setErrorMessage(null);
    try {
      const res = await apiFetch('/api/soar/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionKey,
          caseId: analysis.id || '',
          senderEmail,
          senderDomain,
          ip: firstHopIp,
          subject: analysis.headers?.subject || analysis.subject || ''
        })
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {}
      if (res.ok && data.status === 'executed') {
        setCompletedActions(prev => ({ ...prev, [actionKey]: data.message || `Successfully executed ${actionTitle}` }));
      } else {
        const failureReason = data?.error || data?.message || (res.status === 501 ? 'Automated containment is not connected to any firewall, mail gateway or identity provider. No action was taken.' : `HTTP ${res.status}`);
        setErrorMessage(`${actionTitle} was NOT performed: ${failureReason}`);
      }
    } catch (err: any) {
      setErrorMessage(`${actionTitle} was NOT performed: ${err?.message || 'Network failure'}`);
    } finally {
      setExecutingAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-[#14110D] border border-[#3A3228] rounded-xl max-w-2xl w-full p-6 text-xs text-[#EDE6DC] font-sans shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2B241E] pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#D3A039]/20 border border-[#D3A039]/50 flex items-center justify-center text-[#D3A039]">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#EDE6DC] font-mono uppercase tracking-wide flex items-center gap-2">
                <span>SOAR Automated Playbook Actions</span>
              </h3>
              <p className="text-[11px] text-[#9C9186]">
                One-click response playbooks to quarantine threats, update edge firewall ACLs, and revoke sessions.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded bg-[#1D1712] text-[#9C9186] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Amber Alert: Automated Containment Notice */}
        <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Automated containment is not yet connected to any firewall, mail gateway, or identity provider.</span>
        </div>

        {/* Error Alert Message */}
        {errorMessage && (
          <div role="alert" className="p-3 rounded-lg bg-rose-950/50 border border-rose-700 text-rose-300 text-xs flex items-center gap-2 font-mono">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Playbook Action Cards */}
        <div className="space-y-3 overflow-y-auto flex-1 font-mono text-xs pr-1">
          {/* Action 1: Firewall IP Block */}
          <div className="p-3.5 rounded-lg bg-[#0E0B09] border border-[#2B241E] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ban className="w-4 h-4 text-rose-400" />
                <span className="font-bold text-[#EDE6DC]">Block Ingress IP on Edge Firewalls</span>
              </div>
              <button
                onClick={() => handleExecute('BLOCK_IP', 'Firewall IP Block')}
                disabled={Boolean(executingAction) || !firstHopIp}
                className="px-3 py-1 rounded bg-rose-950 hover:bg-rose-900 border border-rose-700 text-rose-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {executingAction === 'BLOCK_IP' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                <span>Block IP {firstHopIp ? `(${firstHopIp})` : '(No IP)'}</span>
              </button>
            </div>
            <p className="text-[11px] text-[#9C9186] font-sans">
              Injects IP drop rule across Palo Alto Networks, Fortinet, and AWS WAF edge ingress filters.
            </p>
            {completedActions['BLOCK_IP'] && (
              <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-[10.5px] flex items-center gap-1.5 font-sans">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{completedActions['BLOCK_IP']}</span>
              </div>
            )}
          </div>

          {/* Action 2: Domain Blacklist & Mailbox Quarantine */}
          <div className="p-3.5 rounded-lg bg-[#0E0B09] border border-[#2B241E] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MailX className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-[#EDE6DC]">Quarantine Inbound Domain in M365/Google</span>
              </div>
              <button
                onClick={() => handleExecute('QUARANTINE_DOMAIN', 'Domain Quarantine')}
                disabled={Boolean(executingAction) || !senderDomain}
                className="px-3 py-1 rounded bg-amber-950 hover:bg-amber-900 border border-amber-700 text-amber-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {executingAction === 'QUARANTINE_DOMAIN' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                <span>Quarantine Domain</span>
              </button>
            </div>
            <p className="text-[11px] text-[#9C9186] font-sans">
              Automatically moves all current and future emails from <b className="text-[#EDE6DC]">{senderDomain || 'target domain'}</b> into the tenant admin quarantine.
            </p>
            {completedActions['QUARANTINE_DOMAIN'] && (
              <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-[10.5px] flex items-center gap-1.5 font-sans">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{completedActions['QUARANTINE_DOMAIN']}</span>
              </div>
            )}
          </div>

          {/* Action 3: Revoke Recipient Tokens */}
          <div className="p-3.5 rounded-lg bg-[#0E0B09] border border-[#2B241E] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-[#EDE6DC]">Revoke Target User OAuth &amp; SSO Tokens</span>
              </div>
              <button
                onClick={() => handleExecute('REVOKE_TOKENS', 'User Session Revocation')}
                disabled={Boolean(executingAction)}
                className="px-3 py-1 rounded bg-purple-950 hover:bg-purple-900 border border-purple-700 text-purple-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {executingAction === 'REVOKE_TOKENS' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                <span>Revoke Sessions</span>
              </button>
            </div>
            <p className="text-[11px] text-[#9C9186] font-sans">
              Forces sign-out and expires active OAuth session tokens for users who interacted with phishing links.
            </p>
            {completedActions['REVOKE_TOKENS'] && (
              <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-[10.5px] flex items-center gap-1.5 font-sans">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{completedActions['REVOKE_TOKENS']}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#2B241E] pt-3 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#D3A039] hover:bg-[#b8892d] text-black font-bold font-mono text-xs cursor-pointer"
          >
            Close SOAR Panel
          </button>
        </div>
      </div>
    </div>
  );
}
