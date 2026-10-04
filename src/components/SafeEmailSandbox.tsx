import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  ExternalLink, 
  Eye, 
  Code, 
  FileText, 
  CheckCircle2, 
  AlertOctagon, 
  Paperclip, 
  ShieldCheck,
  Lock,
  Globe,
  Info
} from 'lucide-react';
import { EmailAnalysis } from '../types';

interface SafeEmailSandboxProps {
  analysis: EmailAnalysis;
  className?: string;
}

export function SafeEmailSandbox({ analysis, className = '' }: SafeEmailSandboxProps) {
  const [viewMode, setViewMode] = useState<'sanitized' | 'threat_overlays' | 'raw_body'>('sanitized');
  const [hideEnvelope, setHideEnvelope] = useState<boolean>(false);

  const subject = analysis?.subject || analysis?.headers?.subject || '(No Subject)';
  const from = analysis?.from || analysis?.headers?.from || 'Unknown Sender';
  const to = analysis?.to || analysis?.headers?.to || 'undisclosed-recipients';
  const date = analysis?.date || analysis?.headers?.date || analysis?.analyzedAt || new Date().toUTCString();
  const returnPath = analysis?.headers?.returnPath || analysis?.headers?.['return-path'] || analysis?.returnPath || 'N/A';
  const replyTo = analysis?.headers?.replyTo || analysis?.headers?.['reply-to'] || analysis?.replyTo || null;

  // 1. Extract Real Email Body
  const rawBodyText = useMemo(() => {
    if (analysis?.body && analysis.body.trim().length > 0) return analysis.body;
    const emailHtml = (analysis as any)?.html;
    if (emailHtml && typeof emailHtml === 'string' && emailHtml.trim().length > 0) {
      // Strip tags for text view
      return emailHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                      .replace(/<[^>]+>/g, ' ')
                      .replace(/&nbsp;/g, ' ')
                      .trim();
    }
    const raw = (analysis as any)?.rawSource || (analysis as any)?.rawEmail || (analysis as any)?.rawEml;
    if (raw && typeof raw === 'string') {
      const parts = raw.split(/\r?\n\r?\n/);
      if (parts.length > 1) {
        return parts.slice(1).join('\n\n').trim();
      }
    }
    return '';
  }, [analysis]);

  // 2. Real URL Extraction from content
  const extractedUrls = useMemo(() => {
    const foundUrls = new Set<string>();
    
    // Add already parsed urls
    if (Array.isArray(analysis?.urls)) {
      analysis.urls.forEach(u => {
        if (typeof u === 'string') foundUrls.add(u);
        else if (u?.url) foundUrls.add(u.url);
      });
    }
    if (Array.isArray((analysis as any)?.extractedUrls)) {
      (analysis as any).extractedUrls.forEach((u: any) => {
        if (typeof u === 'string') foundUrls.add(u);
        else if (u?.url) foundUrls.add(u.url);
      });
    }

    // Scan raw body with standard URL regex
    const combinedText = `${rawBodyText} ${(analysis as any)?.html || ''} ${(analysis as any)?.rawSource || ''}`;
    const urlRegex = /(https?:\/\/[^\s"'<>\)]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = urlRegex.exec(combinedText)) !== null) {
      const cleanUrl = match[1].replace(/[.,;!?]+$/, '');
      foundUrls.add(cleanUrl);
    }

    return Array.from(foundUrls);
  }, [analysis, rawBodyText]);

  // 3. Real Attachment Extraction
  const realAttachments = useMemo(() => {
    if (Array.isArray(analysis?.attachments) && analysis.attachments.length > 0) {
      return analysis.attachments;
    }
    // Scan raw source for attachments
    const raw = (analysis as any)?.rawSource || '';
    const attMatches: Array<{ filename: string; size?: string; type?: string }> = [];
    const attRegex = /Content-Disposition:\s*attachment;\s*filename=["']?([^"';\r\n]+)["']?/gi;
    let attMatch: RegExpExecArray | null;
    while ((attMatch = attRegex.exec(raw)) !== null) {
      attMatches.push({
        filename: attMatch[1],
        size: 'Embedded in MIME',
        type: 'Parsed Attachment'
      });
    }
    return attMatches;
  }, [analysis]);

  // 4. Real Dynamic Threat Indicators
  const indicators = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      description: string;
      severity: 'critical' | 'high' | 'medium';
      elementMatched: string;
    }> = [];

    // Check display name spoofing
    const fromLower = from.toLowerCase();
    const returnPathLower = returnPath.toLowerCase();
    const isBrandMentioned = /(microsoft|paypal|apple|google|amazon|docusign|bank|support|security|payroll|cfo|ceo|admin)/i.test(from);
    
    // Extract actual domain from from-address
    const fromEmailMatch = from.match(/<([^>]+)>/) || from.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const fromEmail = fromEmailMatch ? fromEmailMatch[1].toLowerCase() : '';
    const fromDomain = fromEmail.split('@')[1] || '';
    
    if (isBrandMentioned && fromDomain && !fromDomain.includes(fromLower.match(/(microsoft|paypal|apple|google|amazon|docusign)/)?.[0] || '___')) {
      list.push({
        id: 'disp_spoof',
        title: 'Brand / Authority Display Name Mismatch',
        description: `Header displays authoritative brand in "${from}", but sending domain is "${fromDomain}".`,
        severity: 'critical',
        elementMatched: from
      });
    }

    // Check Return-Path divergence
    if (returnPath !== 'N/A' && fromEmail && returnPathLower !== fromEmail && !returnPathLower.includes(fromDomain)) {
      list.push({
        id: 'return_path_mismatch',
        title: 'Return-Path Address Divergence',
        description: `Bounces and envelope delivery route to "${returnPath}", differing from sender domain "${fromDomain}".`,
        severity: 'high',
        elementMatched: returnPath
      });
    }

    // Check Reply-To divergence
    if (replyTo && fromEmail && !replyTo.toLowerCase().includes(fromDomain)) {
      list.push({
        id: 'reply_to_divergence',
        title: 'Deceptive Reply-To Target',
        description: `User replies will be silently redirected to external address "${replyTo}".`,
        severity: 'high',
        elementMatched: replyTo
      });
    }

    // Check Phishing Links
    extractedUrls.forEach((url, i) => {
      const isIpUrl = /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(url);
      const isSuspicious = isIpUrl || /(login|verify|auth|session|secure|account|update|token)/i.test(url);
      if (isSuspicious) {
        list.push({
          id: `phish_url_${i}`,
          title: isIpUrl ? 'Direct IP Hyperlink Target' : 'Suspicious Credential Target URL',
          description: isIpUrl ? 'URL points directly to an IP address without valid domain validation.' : 'URL contains high-risk credential-harvesting keywords.',
          severity: isIpUrl ? 'critical' : 'high',
          elementMatched: url
        });
      }
    });

    // Check Urgency Coercion in real body
    const bodyLower = rawBodyText.toLowerCase();
    const urgencyMatch = bodyLower.match(/(24 hours|immediate|suspend|within 1 hour|action required|overdue|unauthorized access|terminate)/i);
    if (urgencyMatch) {
      list.push({
        id: 'urgency_coercion',
        title: 'Coercive Urgency Trigger',
        description: `Psychological pressure phrase "${urgencyMatch[0]}" detected in body to coerce hasty action.`,
        severity: 'high',
        elementMatched: urgencyMatch[0]
      });
    }

    // Check Attachments
    realAttachments.forEach((att, idx) => {
      const filename = att.filename || `Attachment-${idx + 1}`;
      const isDangerousExt = /\.(exe|scr|iso|vbs|bat|xlsm|docm|hta|cmd|pif)$/i.test(filename);
      if (isDangerousExt) {
        list.push({
          id: `att_danger_${idx}`,
          title: 'Dangerous Executable / Macro Attachment',
          description: `Attachment "${filename}" has high-risk extension capable of code execution.`,
          severity: 'critical',
          elementMatched: filename
        });
      }
    });

    return list;
  }, [from, returnPath, replyTo, extractedUrls, rawBodyText, realAttachments]);

  // Safe HTML render for iframe
  const sanitizedHtmlDoc = useMemo(() => {
    const emailHtml = (analysis as any)?.html;
    if (emailHtml && typeof emailHtml === 'string' && emailHtml.trim().length > 0) {
      // Strip script tags entirely
      return emailHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    // Return formatted plain text
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #e2e8f0; background: #0d0f17; padding: 20px; font-size: 14px; margin: 0; white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>${rawBodyText || '(Empty message payload)'}</body>
</html>`;
  }, [(analysis as any)?.html, rawBodyText]);

  return (
    <div className={`rounded-xl border border-slate-800 bg-[#0e1017] p-5 shadow-lg ${className}`}>
      {/* Sandbox Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                Safe Visual Email Sandbox
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                ISOLATED / ZERO-SCRIPT IFRAME
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Live recipient preview parsed from real RFC MIME payload with active threat callouts.
            </span>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('sanitized')}
            className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
              viewMode === 'sanitized'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Sanitized Mailbox</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('threat_overlays')}
            className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
              viewMode === 'threat_overlays'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Threat Overlays ({indicators.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('raw_body')}
            className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
              viewMode === 'raw_body'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Raw MIME</span>
          </button>
        </div>
      </div>

      {/* Main Sandbox Viewport */}
      {viewMode === 'sanitized' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-800 bg-[#141722] overflow-hidden shadow-inner font-sans">
            {/* Title Bar */}
            <div className="bg-[#1c202e] px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-2 font-medium text-slate-300 truncate max-w-sm">{subject}</span>
              </div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">SANDBOX DOM ISOLATED</span>
            </div>

            {/* Email Header Telemetry */}
            <div className="p-4 bg-[#161a26] border-b border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-bold text-white text-sm">{subject}</div>
                <span className="text-[11px] font-mono text-slate-400">{date}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">From:</span>
                  <span className="text-white font-medium break-all">{from}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">To:</span>
                  <span className="text-slate-200 break-all">{to}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-slate-400">Return-Path:</span>
                  <span className="text-amber-300 truncate">{returnPath}</span>
                </div>
                {replyTo && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-400">Reply-To:</span>
                    <span className="text-purple-300 truncate">{replyTo}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Real Rendered Iframe Body with Zero-Script Sandbox */}
            <div className="bg-[#0d0f17]">
              <iframe
                title="Sanitized Email Content"
                srcDoc={sanitizedHtmlDoc}
                sandbox="allow-same-origin"
                className="w-full min-h-[220px] max-h-[460px] border-none block"
              />
            </div>

            {/* Attachments Footer */}
            {realAttachments.length > 0 ? (
              <div className="p-4 border-t border-slate-800 bg-[#121520]">
                <div className="text-[11px] font-mono uppercase text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Verified Inbound Attachments ({realAttachments.length})</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {realAttachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-slate-700 bg-slate-900 flex items-center gap-2.5 text-xs font-mono"
                    >
                      <FileText className="w-4 h-4 text-amber-400" />
                      <div>
                        <div className="text-white font-semibold">{att.filename}</div>
                        <div className="text-[10px] text-slate-400">{att.size || 'MIME Part'} • {att.type || 'Binary'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-4 py-2.5 border-t border-slate-800/80 bg-[#121520] text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>Zero attached file payloads detected in this email envelope.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Threat Overlays View */}
      {viewMode === 'threat_overlays' && (
        <div className="space-y-3 font-mono">
          {indicators.length === 0 ? (
            <div className="p-6 rounded-lg border border-emerald-500/30 bg-emerald-950/20 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="text-white font-bold text-sm">No Deceptive Content Tricks Detected</div>
              <p className="text-xs text-slate-300 font-sans max-w-md mx-auto">
                Display name matches envelope domain, no coercive urgency triggers found, and no suspicious attachment extensions detected.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {indicators.map((ind) => (
                <div
                  key={ind.id}
                  className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/60 flex items-start gap-3"
                >
                  <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    ind.severity === 'critical'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  }`}>
                    <AlertOctagon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                      <span className="font-bold text-white text-xs">{ind.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        ind.severity === 'critical'
                          ? 'bg-rose-950 text-rose-300 border border-rose-700'
                          : 'bg-amber-950 text-amber-300 border border-amber-700'
                      }`}>
                        {ind.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-sans leading-relaxed mb-2">
                      {ind.description}
                    </p>
                    <div className="p-2 rounded bg-black/40 border border-slate-800 text-[11px] text-slate-400 font-mono break-all">
                      <span className="text-slate-500">Matched Evidence: </span>
                      <span className="text-rose-300 font-semibold">{ind.elementMatched}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Raw MIME Body */}
      {viewMode === 'raw_body' && (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 max-h-96 overflow-y-auto space-y-2">
          <div className="text-slate-500 text-[11px] border-b border-slate-800 pb-2 mb-2 flex items-center justify-between">
            <span>RAW RFC 822 / RFC 2045 EXTRACT:</span>
            <span>{((analysis as any)?.rawSource?.length || rawBodyText.length)} bytes</span>
          </div>
          <pre className="whitespace-pre-wrap break-all leading-relaxed text-[11px] text-emerald-400/90 font-mono">
            {(analysis as any)?.rawSource || (analysis as any)?.rawEmail || (analysis as any)?.rawEml || `Subject: ${subject}\nFrom: ${from}\nTo: ${to}\nDate: ${date}\n\n${rawBodyText || '(No body data)'}`}
          </pre>
        </div>
      )}
    </div>
  );
}
