import { EmailAnalysis, EvidenceCardData, Hop } from '../types';
import { getStandardizedVerdict } from './verdict';

/**
 * Generates a clean, structured, human-readable and machine-parseable
 * formatted text block for external incident reports (Jira, ServiceNow, Slack, Splunk, etc.)
 */
export function formatEvidenceReport(
  cardData?: EvidenceCardData,
  analysis?: EmailAnalysis
): string {
  const caseId = cardData?.caseId || analysis?.id || 'INC-' + Date.now();
  const evidenceId = cardData?.evidenceId || analysis?.evidenceId || 'EV-' + Date.now();
  const timestamp = cardData?.timestamp || analysis?.analyzedAt || analysis?.date || new Date().toUTCString();

  const stdVerdict = analysis ? getStandardizedVerdict(analysis) : null;
  const verdictText = cardData?.verdict?.text || stdVerdict?.verdict || 'UNKNOWN';
  const threatScore = cardData?.verdict?.scoreLabel || (stdVerdict ? `${stdVerdict.score}/100` : 'N/A');
  const subject = cardData?.subject || analysis?.subject || analysis?.headers?.subject || '(No Subject)';
  
  const fromHeader = analysis?.headers?.from || analysis?.from || 'Unknown Sender';
  const returnPath = analysis?.headers?.returnPath || analysis?.headers?.['return-path'] || analysis?.returnPath || 'N/A';
  const replyTo = analysis?.headers?.replyTo || analysis?.headers?.['reply-to'] || analysis?.replyTo || 'N/A';
  const messageId = analysis?.headers?.messageId || analysis?.headers?.['message-id'] || analysis?.messageId || 'N/A';
  const dateHeader = analysis?.headers?.date || analysis?.date || timestamp;
  const toHeader = analysis?.headers?.to || analysis?.to || 'undisclosed-recipients';

  const spf = analysis?.auth?.spf || analysis?.authResults?.spf || (cardData?.checks?.find(c => c.label === 'SPF')?.value) || 'UNKNOWN';
  const dkim = analysis?.auth?.dkim || analysis?.authResults?.dkim || (cardData?.checks?.find(c => c.label === 'DKIM')?.value) || 'UNKNOWN';
  const dmarc = analysis?.auth?.dmarc || analysis?.authResults?.dmarc || (cardData?.checks?.find(c => c.label === 'DMARC')?.value) || 'UNKNOWN';

  const sha256 = cardData?.footer?.hash || analysis?.sha256 || 'N/A';
  const socAction = cardData?.footer?.action || (verdictText.includes('MALICIOUS') ? 'IMMEDIATE QUARANTINE & BLOCK SENDER DOMAIN' : 'LOG AND MONITOR');

  const hops: Hop[] = Array.isArray(analysis?.hops) ? analysis.hops : [];
  const firstHop = hops.find(h => h.isOrigin) || hops[0];

  const domIntel = analysis?.domain_intelligence || analysis?.domainIntelligence;
  const typosquat = domIntel?.typosquatting?.target_brand || domIntel?.typosquat_matched_brand;

  let report = `================================================================================
                    TRACEXMAIL SECURITY INCIDENT REPORT
================================================================================
INCIDENT / CASE ID : ${caseId}
EVIDENCE DOSSIER   : ${evidenceId}
TIMESTAMP (UTC)    : ${timestamp}
SHA-256 SEAL       : ${sha256}
--------------------------------------------------------------------------------
[1] THREAT VERDICT & RISK ASSESSMENT
--------------------------------------------------------------------------------
VERDICT            : ${verdictText}
THREAT SCORE       : ${threatScore}
RECOMMENDED ACTION : ${socAction}
${typosquat ? `IMPERSONATION TARGET : Pretending to be "${typosquat}"\n` : ''}
SUMMARY :
${cardData?.aiSummary?.text || analysis?.ai_narrative?.narrative || (analysis as any)?.attackStory || (analysis as any)?.summary || 'Email analyzed through multi-layer header and routing forensics.'}

--------------------------------------------------------------------------------
[2] ENVELOPE & SENDER IDENTITY
--------------------------------------------------------------------------------
Subject            : ${subject}
From               : ${fromHeader}
To                 : ${toHeader}
Return-Path        : ${returnPath}
Reply-To           : ${replyTo}
Message-ID         : ${messageId}
Date               : ${dateHeader}

--------------------------------------------------------------------------------
[3] AUTHENTICATION & PROTOCOL INTEGRITY
--------------------------------------------------------------------------------
SPF Check          : ${typeof spf === 'object' ? JSON.stringify(spf) : spf}
DKIM Signature     : ${typeof dkim === 'object' ? JSON.stringify(dkim) : dkim}
DMARC Enforcement  : ${typeof dmarc === 'object' ? JSON.stringify(dmarc) : dmarc}

--------------------------------------------------------------------------------
[4] INFRASTRUCTURE & FIRST-HOP ORIGIN
--------------------------------------------------------------------------------
First-Hop IP       : ${firstHop?.fromIp || cardData?.origin?.ip || 'N/A'}
Origin Location    : ${firstHop?.city ? `${firstHop.city}, ${firstHop.country}` : (cardData?.origin?.location || 'N/A')}
ASN / ISP          : ${firstHop?.asn || 'N/A'} (${firstHop?.isp || firstHop?.org || 'N/A'})
Reverse DNS        : ${firstHop?.reverseDns || firstHop?.fromHost || 'N/A'}
Anomalies / Flags  : ${[
  firstHop?.isTorExitNode ? 'TOR_EXIT_NODE' : null,
  firstHop?.isProxyOrVpn ? 'VPN/PROXY' : null,
  firstHop?.isBlacklisted ? 'BLACKLISTED_IP' : null,
  firstHop?.countryMismatch ? 'GEO_MISMATCH' : null
].filter(Boolean).join(', ') || 'None detected'}

--------------------------------------------------------------------------------
[5] ROUTING TRACEROUTE HOPS (${hops.length} Hops recorded)
--------------------------------------------------------------------------------
${hops.length > 0 ? hops.map((h, i) => {
  const flags = [
    h.isOrigin ? '[ORIGIN]' : '',
    h.isTorExitNode ? '[TOR]' : '',
    h.isProxyOrVpn ? '[VPN]' : '',
    h.abuseScore ? `[Abuse:${h.abuseScore}%]` : ''
  ].filter(Boolean).join(' ');
  return `Hop #${h.hopNumber || i + 1} | IP: ${(h.fromIp || 'N/A').padEnd(16)} | Host: ${(h.fromHost || h.byHost || 'N/A').padEnd(28)} | Location: ${h.city || ''} ${h.country || ''} ${flags}`;
}).join('\n') : 'No relay hops available.'}
`;

  // Extracted URLs / IOCs if present
  if (analysis?.urls && analysis.urls.length > 0) {
    report += `\n--------------------------------------------------------------------------------
[6] EXTRACTED URLS & INDICATORS OF COMPROMISE (IOCs)
--------------------------------------------------------------------------------
${analysis.urls.map((u, i) => `[${i + 1}] URL     : ${u.defangedUrl || u.url}\n    Status  : ${u.status || 'UNRATED'} | Rep: ${u.virustotalScore || 'Clean'}\n    Domain  : ${u.domain || 'N/A'}`).join('\n\n')}
`;
  }

  // Raw Headers section if available
  const rawHeaders = analysis?.rawHeaders || (analysis?.headers ? Object.entries(analysis.headers).map(([k, v]) => `${k}: ${v}`).join('\n') : null);
  if (rawHeaders) {
    report += `\n--------------------------------------------------------------------------------
[7] RAW RFC822 EMAIL HEADERS
--------------------------------------------------------------------------------
${rawHeaders}
`;
  }

  report += `\n================================================================================
              END OF INCIDENT REPORT · GENERATED BY TRACEXMAIL FORENSICS
================================================================================`;

  return report;
}

/**
 * Formats an EmailAnalysis object into a standard, compliant RFC 5322 EML format string,
 * including all headers, authentication results, MTA hop traces, and body content.
 */
export function formatAnalysisToEml(analysis: EmailAnalysis): string {
  if (!analysis) return '';

  // 1. If rawEml already exists and is non-empty, prefer it directly
  if (analysis.rawEml && analysis.rawEml.trim().length > 0) {
    return analysis.rawEml.trim();
  }

  const lines: string[] = [];

  // 2. Core RFC 5322 Headers
  const messageId = analysis.messageId || analysis.headers?.messageId || `<${analysis.id || 'case-' + Date.now()}@tracexmail.internal>`;
  const date = analysis.date || analysis.headers?.date || analysis.analyzedAt || new Date().toUTCString();
  const from = analysis.from || analysis.headers?.from || 'unknown@domain.com';
  const to = analysis.to || analysis.headers?.to || 'recipient@domain.com';
  const subject = analysis.subject || analysis.headers?.subject || 'No Subject';
  const replyTo = analysis.replyTo || analysis.headers?.replyTo;
  const returnPath = analysis.returnPath || analysis.headers?.returnPath;

  lines.push(`Message-ID: ${messageId}`);
  lines.push(`Date: ${date}`);
  lines.push(`From: ${from}`);
  lines.push(`To: ${to}`);
  lines.push(`Subject: ${subject}`);
  if (replyTo) lines.push(`Reply-To: ${replyTo}`);
  if (returnPath) lines.push(`Return-Path: ${returnPath}`);

  // 3. MIME Headers
  lines.push('MIME-Version: 1.0');
  lines.push('Content-Type: text/plain; charset=utf-8');

  // 4. Custom TraceXMail Forensic Headers
  lines.push(`X-TraceXMail-Verdict: ${analysis.threatVerdict || 'UNKNOWN'}`);
  lines.push(`X-TraceXMail-ThreatScore: ${analysis.threatScore ?? 0}`);
  const sha256 = analysis.sha256Hash || analysis.sha256 || analysis.custodyHash;
  if (sha256) lines.push(`X-TraceXMail-SHA256: ${sha256}`);

  // 5. Authentication Results & Received-SPF (RFC 8601)
  const spfStat = analysis.authResults?.spf?.status || analysis.auth?.spf?.status || 'none';
  const dkimStat = analysis.authResults?.dkim?.status || analysis.auth?.dkim?.status || 'none';
  const dmarcStat = analysis.authResults?.dmarc?.status || analysis.auth?.dmarc?.status || 'none';
  const fromDomain = from.includes('@') ? from.split('@')[1] : 'sender.com';

  lines.push(`Received-SPF: ${spfStat} (mx.corporate.com: domain of ${fromDomain} designates permitted sender)`);
  lines.push(`Authentication-Results: mx.corporate.com; spf=${spfStat} smtp.mailfrom=${fromDomain}; dkim=${dkimStat}; dmarc=${dmarcStat}`);

  // 6. Received Hop Headers (chronological MTA traversal)
  if (Array.isArray(analysis.hops) && analysis.hops.length > 0) {
    analysis.hops.forEach((hop) => {
      const fromHost = hop.fromHost || hop.fromIp || 'mail.relay.net';
      const byHost = hop.byHost || 'mx.corporate.com';
      const protocol = hop.protocol || 'ESMTPS';
      const hopTime = hop.timestamp || date;
      lines.push(`Received: from ${fromHost} (${hop.fromIp ? `[${hop.fromIp}]` : 'unknown'})\r\n  by ${byHost} with ${protocol}\r\n  for <${to}>; ${hopTime}`);
    });
  }

  // 7. If rawHeaders string exists, append any non-duplicate headers
  if (analysis.rawHeaders) {
    const rawHeaderLines = analysis.rawHeaders.split(/\r?\n/);
    rawHeaderLines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && trimmed.includes(':')) {
        const key = trimmed.split(':')[0].toLowerCase();
        if (!['message-id', 'date', 'from', 'to', 'subject', 'mime-version', 'content-type', 'x-tracexmail-verdict'].includes(key)) {
          lines.push(trimmed);
        }
      }
    });
  }

  // 8. Header-Body separator
  lines.push('');

  // 9. Body Content
  const bodyContent = analysis.bodyText || analysis.body || 'No body content available.';
  lines.push(bodyContent);

  return lines.join('\r\n');
}
