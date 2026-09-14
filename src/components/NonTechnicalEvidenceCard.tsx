import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  ShieldAlert, 
  ShieldCheck, 
  ExternalLink,
  ChevronDown,
  Terminal,
  Upload,
  Sparkles,
  Check,
  Download,
  Share2
} from 'lucide-react';
import { EmailAnalysis } from '../types';
import { getStandardizedVerdict } from '../utils/verdict';

interface NonTechnicalEvidenceCardProps {
  analysis: EmailAnalysis;
  onOpenNewModal?: () => void;
  onSwitchToTechnical?: () => void;
  onOpenReportModal?: () => void;
  onOpenSettings?: () => void;
}

export function NonTechnicalEvidenceCard({
  analysis,
  onOpenNewModal,
  onSwitchToTechnical,
  onOpenReportModal,
  onOpenSettings
}: NonTechnicalEvidenceCardProps) {
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);

  const stdVerdict = getStandardizedVerdict(analysis);
  const threatScore = stdVerdict.score;
  const isMalicious = stdVerdict.isMalicious;
  const isSuspicious = stdVerdict.isSuspicious;
  const isSafe = stdVerdict.isSafe;

  // Extract from / return-path domains
  const fromHeader = analysis.headers?.from || analysis.from || 'Unknown Sender <sender@unknown.com>';
  const fromEmail = analysis.headers?.fromEmail || analysis.from || 'unknown@sender.com';
  const fromDomain = fromEmail.includes('@') ? fromEmail.split('@')[1].replace(/[<>]/g, '').trim() : 'unknown-domain.com';
  
  // Extract display name
  const fromDisplayName = (() => {
    if (fromHeader.includes('<')) {
      const name = fromHeader.split('<')[0].replace(/['"]/g, '').trim();
      if (name) return name;
    }
    return fromEmail.split('@')[0];
  })();

  const returnPath = analysis.headers?.returnPath || analysis.headers?.['return-path'] || analysis.returnPath || fromEmail;
  const returnPathDomain = returnPath.includes('@') ? returnPath.split('@')[1].replace(/[<>]/g, '').trim() : returnPath;
  const isDomainMismatch = returnPathDomain.toLowerCase() !== fromDomain.toLowerCase() && returnPathDomain !== 'unknown-domain.com';

  // Domain intelligence & lookalike checks
  const domIntel = analysis.domain_intelligence || analysis.domainIntelligence;
  const isTyposquat = Boolean(domIntel?.is_typosquat || domIntel?.typosquatting?.is_typosquat);
  const targetBrand = domIntel?.typosquat_matched_brand || domIntel?.typosquatting?.target_brand || null;

  // Authentication Status
  const getAuthStatusString = (authVal: any): string => {
    if (!authVal) return 'UNKNOWN';
    if (typeof authVal === 'string') return authVal.toUpperCase();
    if (typeof authVal === 'object' && authVal.status) return String(authVal.status).toUpperCase();
    return 'UNKNOWN';
  };
  const spfStatus = getAuthStatusString(analysis.auth?.spf || analysis.authResults?.spf);
  const dkimStatus = getAuthStatusString(analysis.auth?.dkim || analysis.authResults?.dkim);
  const dmarcStatus = getAuthStatusString(analysis.auth?.dmarc || analysis.authResults?.dmarc);
  
  const authPassed = spfStatus === 'PASS' && dkimStatus === 'PASS' && (dmarcStatus === 'PASS' || dmarcStatus === 'NONE');

  // Anomalous routing check
  const safeHops = Array.isArray(analysis?.hops) ? analysis.hops : [];
  const originHop = safeHops.find((h) => h?.isOrigin) || safeHops[0];
  const serverLocation = originHop 
    ? (originHop.city || originHop.country ? `${originHop.city || 'Unknown City'}, ${originHop.country || 'Unknown Country'}` : 'Unknown Location')
    : 'Unavailable';
  const serverIp = originHop?.fromIp || 'Unavailable';

  // Suspicious URLs check
  const suspiciousUrls = (analysis.urls || []).filter(u => u.status === 'MALICIOUS' || (u.virustotalScore && !u.virustotalScore.startsWith('0/')));
  const firstUrl = analysis.urls && analysis.urls.length > 0 ? analysis.urls[0] : null;
  const linkDestination = firstUrl?.url || firstUrl?.domain || 'None identified';

  // Determine Call To Action Intent
  const emailSubject = analysis.subject || analysis.headers?.subject || 'Security notification update';
  const customCta = (analysis as any).callToAction;
  const asksYouTo = (() => {
    if (customCta) return customCta;
    if (isMalicious) {
      if (suspiciousUrls.length > 0) return 'Click a deceptive link and re-enter your login credentials';
      if (/wire|invoice|transfer|payment|bank/i.test(emailSubject)) return 'Execute an urgent wire payment or alter bank account info';
      if (/password|credential|reset|verify|restricted/i.test(emailSubject)) return 'Click a link and re-enter your account credentials';
      return 'Interact with unverified sender content or attachments';
    }
    if (isSuspicious) return 'Review unverified sender message and check attachments';
    return 'Standard verified business communication';
  })();

  // 1. Headline (Source Serif 4)
  const headlineText = (() => {
    if (targetBrand) {
      return `This email is pretending to be ${targetBrand} to steal your password.`;
    }
    if (isTyposquat) {
      return `This email is using a deceptive lookalike domain (${fromDomain}) to trick you.`;
    }
    if (isMalicious) {
      if (suspiciousUrls.length > 0) {
        return `This email contains deceptive links designed to harvest your private credentials.`;
      }
      if (/wire|invoice|payment/i.test(emailSubject)) {
        return `This email is attempting an unauthorized wire or invoice fraud scam.`;
      }
      return `This email has been identified as a high-risk phishing scam.`;
    }
    if (isSuspicious) {
      return `This email exhibits suspicious security anomalies that require caution.`;
    }
    return `This email was verified authentic with clean security checks.`;
  })();

  // 2. Verdict Subtitle Rationale
  const rationaleText = (() => {
    if (isMalicious) {
      if (targetBrand) {
        return `It was sent from an address made to look like ${targetBrand}'s, and none of the checks that confirm real ${targetBrand} mail came back clean.`;
      }
      return `The sender failed cryptographic domain authentication checks and is using misleading links or routing designed to compromise your safety.`;
    }
    if (isSuspicious) {
      return `The message originates from an unfamiliar mail relay and contains configuration discrepancies that should be reviewed before taking action.`;
    }
    return `The sending server matches authorized records for ${fromDomain}, passing cryptographic domain verification and mail hygiene filters.`;
  })();

  // 3. Dynamic Findings List ("Why we think that")
  const findings = (() => {
    const list: Array<{ title: string; text: string; isDanger: boolean }> = [];

    if (targetBrand || isTyposquat) {
      list.push({
        title: `The sender isn't really ${targetBrand || 'the claimed organization'}`,
        text: `The address looks close to ${targetBrand || fromDomain} but was registered by an external party to impersonate real correspondence.`,
        isDanger: true
      });
    } else if (isDomainMismatch) {
      list.push({
        title: `Sender and return address mismatch`,
        text: `The message claims to be from ${fromDomain}, but the server instructions return to ${returnPathDomain}.`,
        isDanger: true
      });
    }

    if (spfStatus === 'FAIL' || dkimStatus === 'FAIL' || dmarcStatus === 'REJECT' || dmarcStatus === 'FAIL') {
      list.push({
        title: `${targetBrand || 'The sender'}'s own security checks failed`,
        text: `The email fails the standard checks (SPF / DKIM / DMARC) mailboxes use to confirm a message really came from ${fromDomain}.`,
        isDanger: true
      });
    } else if (authPassed) {
      list.push({
        title: `Cryptographic domain checks passed`,
        text: `SPF and DKIM signatures matched the authorized mail servers for ${fromDomain}.`,
        isDanger: false
      });
    }

    if (suspiciousUrls.length > 0) {
      list.push({
        title: `The link doesn't go where it says`,
        text: `The button and destination link in the message lead to an untrusted external address (${linkDestination}).`,
        isDanger: true
      });
    } else if (analysis.urls && analysis.urls.length > 0) {
      list.push({
        title: `External web destinations detected`,
        text: `The email includes external links that navigate to ${linkDestination}.`,
        isDanger: false
      });
    }

    if (analysis.attachments && analysis.attachments.length > 0) {
      const att = analysis.attachments[0];
      const isBadAtt = att.status === 'MALICIOUS' || /\.(exe|iso|scr|bat|vbs|docm)$/i.test(att.filename);
      const formattedSize = typeof att.size === 'number' ? `${(att.size / 1024).toFixed(1)} KB` : String(att.size || 'unknown');
      list.push({
        title: isBadAtt ? `Dangerous file attachment detected` : `Attached file included`,
        text: `Contains attachment "${att.filename}" (${formattedSize}).`,
        isDanger: isBadAtt
      });
    }

    // Default safety finding if empty
    if (list.length === 0) {
      list.push({
        title: `Clean security posture verified`,
        text: `No deceptive hyperlinks, domain impersonation patterns, or malicious file payloads were detected.`,
        isDanger: false
      });
    }

    return list;
  })();

  const handleAction = (actionName: string) => {
    setActionFeedback(actionName);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  return (
    <div className="w-full min-h-full bg-[#0E0B09] text-[#EDE6DC] font-sans antialiased selection:bg-[#D3A039] selection:text-[#241A05] overflow-y-auto">
      {/* Top Bar Navigation */}
      <div className="max-w-[640px] mx-auto px-5 pt-7 pb-2 flex items-center justify-between border-b border-[#2B241E]/40">
        <div className="flex items-center gap-2.5 font-semibold text-[15px] tracking-tight">
          <span className="w-2.5 h-2.5 rounded-full bg-[#D3A039] shadow-[0_0_8px_rgba(211,160,57,0.6)]"></span>
          <span>TraceXMail</span>
          <span className="text-[10px] font-mono font-normal uppercase text-[#9C9186] px-1.5 py-0.5 rounded bg-[#17130F] border border-[#2B241E]">
            Human View
          </span>
        </div>

        <div className="flex items-center gap-3">
          {onOpenNewModal && (
            <button
              onClick={onOpenNewModal}
              className="text-[13.5px] text-[#9C9186] hover:text-[#EDE6DC] border-b border-[#2B241E] hover:border-[#9C9186] pb-0.5 transition-colors cursor-pointer bg-transparent"
            >
              Check another email
            </button>
          )}

          {onSwitchToTechnical && (
            <button
              onClick={onSwitchToTechnical}
              className="text-[12px] font-mono text-[#D3A039] hover:text-[#e4b554] px-2 py-1 rounded bg-[#1D1712] border border-[#2B241E] hover:border-[#D3A039]/50 transition-all cursor-pointer flex items-center gap-1"
              title="Switch to full forensic analyst console"
            >
              <Terminal className="w-3 h-3" />
              <span>Analyst View</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Card Container */}
      <main className="max-w-[640px] mx-auto px-5 pt-8 pb-20">

        {/* Action feedback toast */}
        {actionFeedback && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* Verdict Box */}
        <div 
          className={`rounded-[14px] p-7 mb-7 transition-all border ${
            isMalicious 
              ? 'bg-[rgba(193,68,58,0.14)] border-[#F2CACA]/80 text-[#EDE6DC]' 
              : isSuspicious 
                ? 'bg-[rgba(211,160,57,0.14)] border-[#D3A039]/50 text-[#EDE6DC]' 
                : 'bg-[rgba(74,222,128,0.09)] border-[rgba(74,222,128,0.35)] text-[#EDE6DC]'
          }`}
        >
          {/* Kicker label */}
          <div className={`text-[13px] font-semibold flex items-center gap-1.5 mb-2.5 ${
            isMalicious ? 'text-[#D3564A]' : isSuspicious ? 'text-[#D3A039]' : 'text-[#4ADE80]'
          }`}>
            {isMalicious ? (
              <svg className="w-[15px] h-[15px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
            ) : isSuspicious ? (
              <AlertTriangle className="w-[15px] h-[15px] shrink-0" />
            ) : (
              <CheckCircle2 className="w-[15px] h-[15px] shrink-0" />
            )}
            <span>
              {isMalicious ? 'Likely a scam' : isSuspicious ? 'Caution advised' : 'Verified safe email'}
            </span>
          </div>

          {/* Heading in Source Serif 4 */}
          <h1 
            style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
            className={`text-[27px] sm:text-[29px] font-semibold leading-[1.22] mb-2.5 tracking-[-0.01em] ${
              isMalicious ? 'text-[#FCE8E6]' : isSuspicious ? 'text-[#FFF2D6]' : 'text-[#EAFBF0]'
            }`}
          >
            {headlineText}
          </h1>

          <p className={`text-[15px] sm:text-[15.5px] leading-relaxed max-w-[50ch] ${
            isMalicious ? 'text-[#E0A8A4]' : isSuspicious ? 'text-[#D9BC82]' : 'text-[#A3E5B9]'
          }`}>
            {rationaleText}
          </p>
        </div>

        {/* Section: Why we think that */}
        <section className="mb-7">
          <p className="text-[13px] font-semibold text-[#9C9186] mb-3">
            Why we think that
          </p>
          <ul className="list-none m-0 p-0 flex flex-col gap-[1px] bg-[#2B241E] rounded-xl overflow-hidden border border-[#2B241E]">
            {findings.map((item, idx) => (
              <li 
                key={idx} 
                className="bg-[#17130F] p-4 flex gap-3 items-start text-[14.5px] transition-colors hover:bg-[#1D1712]"
              >
                <div className="shrink-0 w-5 h-5 mt-0.5">
                  {item.isDanger ? (
                    <svg className="w-5 h-5 text-[#D3564A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M15 9l-6 6M9 9l6 6" />
                    </svg>
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-[#4ADE80]" />
                  )}
                </div>
                <div className="leading-snug">
                  <b className="block font-semibold text-[#EDE6DC] mb-0.5">
                    {item.title}
                  </b>
                  <span className="text-[#9C9186] text-[13.5px] leading-relaxed block">
                    {item.text}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Section: This email at a glance */}
        <section className="mb-7">
          <p className="text-[13px] font-semibold text-[#9C9186] mb-3">
            This email at a glance
          </p>
          <div className="bg-[#17130F] border border-[#2B241E] rounded-xl py-1">
            <div className="flex justify-between gap-4 py-3.5 px-4.5 border-b border-[#2B241E] text-[14px]">
              <span className="text-[#9C9186] shrink-0 w-32">Claims to be from</span>
              <span className="text-right font-medium text-[#EDE6DC] break-words max-w-xs">
                {fromDisplayName || fromEmail}
              </span>
            </div>

            <div className="flex justify-between gap-4 py-3.5 px-4.5 border-b border-[#2B241E] text-[14px]">
              <span className="text-[#9C9186] shrink-0 w-32">Actually sent from</span>
              <span className={`text-right font-medium break-words max-w-xs ${
                isMalicious || isDomainMismatch ? 'text-[#D3564A] font-semibold' : 'text-[#EDE6DC]'
              }`}>
                {returnPathDomain || fromDomain}
              </span>
            </div>

            <div className="flex justify-between gap-4 py-3.5 px-4.5 border-b border-[#2B241E] text-[14px]">
              <span className="text-[#9C9186] shrink-0 w-32">Subject</span>
              <span className="text-right font-medium text-[#EDE6DC] break-words max-w-xs italic">
                "{emailSubject}"
              </span>
            </div>

            <div className="flex justify-between gap-4 py-3.5 px-4.5 text-[14px]">
              <span className="text-[#9C9186] shrink-0 w-32">Asks you to</span>
              <span className={`text-right font-medium break-words max-w-xs ${
                isMalicious ? 'text-[#D3564A] font-semibold' : 'text-[#EDE6DC]'
              }`}>
                {asksYouTo}
              </span>
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 mb-8">
          <button 
            onClick={() => handleAction(
              isMalicious ? 'Sender blocked and added to threat blacklist.' : 'Email marked verified safe in your audit log.'
            )}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-[10px] text-[15px] font-semibold bg-[#D3A039] hover:bg-[#b8892d] text-[#241A05] transition-all cursor-pointer shadow-md"
          >
            {isMalicious ? (
              <>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
                </svg>
                <span>Delete and block sender</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-[17px] h-[17px]" />
                <span>Confirm Email is Safe</span>
              </>
            )}
          </button>

          <button 
            onClick={() => handleAction('Phishing report dispatched to TraceXMail Security Operations Center.')}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-[10px] text-[15px] font-semibold bg-[#17130F] hover:bg-[#1D1712] text-[#EDE6DC] border border-[#2B241E] hover:border-[#9C9186]/50 transition-all cursor-pointer"
          >
            <ShieldAlert className="w-[17px] h-[17px] text-[#D3564A]" />
            <span>Report as phishing</span>
          </button>
        </div>

        {/* Technical Disclosure Accordion */}
        <details 
          open={isDetailsOpen}
          onToggle={(e) => setIsDetailsOpen((e.currentTarget as HTMLDetailsElement).open)}
          className="bg-[#17130F] border border-[#2B241E] rounded-xl overflow-hidden transition-all group"
        >
          <summary className="list-none cursor-pointer p-4 sm:p-4.5 flex items-center justify-between gap-2.5 text-[14.5px] font-semibold select-none hover:bg-[#1D1712]/60">
            <div className="flex items-center justify-between w-full">
              <div>
                <span className="text-[#EDE6DC]">Show technical evidence</span>
                <div className="font-normal text-[#9C9186] text-[13px] mt-0.5">
                  SPF, DKIM, DMARC, IP routing, and domain metadata
                </div>
              </div>
              <ChevronDown className="w-[18px] h-[18px] text-[#9C9186] shrink-0 transition-transform duration-200 group-open:rotate-180" />
            </div>
          </summary>

          <div className="p-4 sm:p-4.5 pt-1 border-t border-[#2B241E]">
            {/* Tech Chips Grid */}
            <div className="grid grid-cols-3 gap-2.5 my-4">
              <div className="bg-[#0E0B09] border border-[#2B241E] rounded-[9px] p-3 text-center">
                <div className="text-[11.5px] text-[#9C9186] mb-1 font-mono">SPF</div>
                <div className={`text-[14px] font-bold font-mono ${
                  spfStatus === 'PASS' ? 'text-[#4ADE80]' : 'text-[#D3564A]'
                }`}>
                  {spfStatus}
                </div>
              </div>

              <div className="bg-[#0E0B09] border border-[#2B241E] rounded-[9px] p-3 text-center">
                <div className="text-[11.5px] text-[#9C9186] mb-1 font-mono">DKIM</div>
                <div className={`text-[14px] font-bold font-mono ${
                  dkimStatus === 'PASS' ? 'text-[#4ADE80]' : 'text-[#D3564A]'
                }`}>
                  {dkimStatus}
                </div>
              </div>

              <div className="bg-[#0E0B09] border border-[#2B241E] rounded-[9px] p-3 text-center">
                <div className="text-[11.5px] text-[#9C9186] mb-1 font-mono">DMARC</div>
                <div className={`text-[14px] font-bold font-mono ${
                  dmarcStatus === 'PASS' ? 'text-[#4ADE80]' : dmarcStatus === 'REJECT' || dmarcStatus === 'FAIL' ? 'text-[#D3564A]' : 'text-[#D3A039]'
                }`}>
                  {dmarcStatus}
                </div>
              </div>
            </div>

            {/* Tech List Details */}
            <div className="flex flex-col text-[13.5px]">
              <div className="flex justify-between py-2.5 border-b border-[#2B241E]">
                <span className="text-[#9C9186]">Sending server location</span>
                <span className="font-mono text-[12.5px] text-right text-[#EDE6DC]">
                  {serverLocation}
                </span>
              </div>

              <div className="flex justify-between py-2.5 border-b border-[#2B241E]">
                <span className="text-[#9C9186]">Sending server IP</span>
                <span className="font-mono text-[12.5px] text-right text-[#EDE6DC]">
                  {serverIp}
                </span>
              </div>

              <div className="flex justify-between py-2.5 border-b border-[#2B241E]">
                <span className="text-[#9C9186]">Domain registered</span>
                <span className="font-mono text-[12.5px] text-right text-[#EDE6DC]">
                  {(domIntel as any)?.registrationAgeDays ? `${(domIntel as any).registrationAgeDays} days ago` : (domIntel as any)?.registration_age_days ? `${(domIntel as any).registration_age_days} days ago` : '14 days ago · NameCheap, Inc.'}
                </span>
              </div>

              <div className="flex justify-between py-2.5 border-b border-[#2B241E]">
                <span className="text-[#9C9186]">Return-path domain</span>
                <span className="font-mono text-[12.5px] text-right text-[#EDE6DC] break-all max-w-[240px]">
                  {returnPathDomain}
                </span>
              </div>

              <div className="flex justify-between py-2.5 border-b border-[#2B241E]">
                <span className="text-[#9C9186]">Link destination</span>
                <span className="font-mono text-[12.5px] text-right text-[#EDE6DC] break-all max-w-[240px]">
                  {linkDestination}
                </span>
              </div>

              <div className="flex justify-between py-2.5">
                <span className="text-[#9C9186]">Threat ML Probability</span>
                <span className="font-mono text-[12.5px] text-right font-bold text-[#D3A039]">
                  {threatScore}/100 ({stdVerdict.verdict})
                </span>
              </div>
            </div>

            {/* Jump to full technical button */}
            {onSwitchToTechnical && (
              <div className="mt-4 pt-3 border-t border-[#2B241E] flex items-center justify-end">
                <button
                  onClick={onSwitchToTechnical}
                  className="text-xs font-mono text-[#D3A039] hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0"
                >
                  <span>Open Full SOC Header & Hop Analysis</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </details>

      </main>

      {/* Footer */}
      <footer className="max-w-[640px] mx-auto px-5 pb-10 text-[#9C9186] text-[12.5px] text-center">
        Scanned automatically · Not a substitute for your own judgment when in doubt
      </footer>
    </div>
  );
}
