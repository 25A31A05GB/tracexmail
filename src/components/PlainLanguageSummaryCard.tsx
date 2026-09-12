import React from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Info,
  ShieldBan,
  ArrowRight
} from 'lucide-react';
import { EmailAnalysis } from '../types';
import { JargonTooltip } from './JargonTooltip';
import { getStandardizedVerdict } from '../utils/verdict';

interface PlainLanguageSummaryCardProps {
  analysis: EmailAnalysis;
  onToggleTechnicalDetails?: (expanded: boolean) => void;
  isTechnicalExpanded?: boolean;
}

export function PlainLanguageSummaryCard({
  analysis,
  onToggleTechnicalDetails,
  isTechnicalExpanded = true
}: PlainLanguageSummaryCardProps) {
  const stdVerdict = getStandardizedVerdict(analysis);
  const threatScore = stdVerdict.score;
  const isMalicious = stdVerdict.isMalicious;
  const isSuspicious = stdVerdict.isSuspicious;
  const isSafe = stdVerdict.isSafe;

  // Cryptographic authentication checks
  const spfPass = analysis.auth?.spf?.status === 'PASS';
  const dkimPass = analysis.auth?.dkim?.status === 'PASS';
  const dmarcPass = analysis.auth?.dmarc?.status === 'PASS';
  const authPassed = spfPass && dkimPass && dmarcPass;

  const fromEmail = analysis.headers?.fromEmail || analysis.from || 'unknown@sender.corp';
  const fromDomain = fromEmail.includes('@') ? fromEmail.split('@')[1].replace(/[<>]/g, '').trim() : 'sender domain';

  // Domain intelligence & lookalike checks
  const domIntel = analysis.domain_intelligence || analysis.domainIntelligence;
  const isTyposquat = Boolean(domIntel?.is_typosquat || domIntel?.typosquatting?.is_typosquat);
  const targetBrand = domIntel?.typosquat_matched_brand || domIntel?.typosquatting?.target_brand || null;

  // Anomalous routing check
  const anomalousHop = analysis.hops?.find(h => h.is_tor || h.isBlacklisted || (h.abuseScore && h.abuseScore > 60));
  const isOriginAnomalous = Boolean(anomalousHop) || (analysis.hops && analysis.hops.length > 0 && !analysis.hops[0].isPrivate && (analysis.hops[0].abuseScore || 0) > 50);

  // Suspicious URLs check
  const suspiciousUrls = (analysis.urls || []).filter(u => u.status === 'MALICIOUS' || (u.virustotalScore && !u.virustotalScore.startsWith('0/')));
  const hasSuspiciousUrls = suspiciousUrls.length > 0;

  // Suspicious attachments check
  const dangerousAtts = (analysis.attachments || []).filter(a => a.status === 'MALICIOUS' || /\.(exe|scr|bat|vbs|docm|xlsm|pptm|jar|iso)$/i.test(a.filename));
  const hasDangerousAtts = dangerousAtts.length > 0;

  // 1. One-Sentence Plain-Language Explanation of What Was Detected
  let plainExplanation = '';
  if (isMalicious) {
    if (isTyposquat && targetBrand) {
      plainExplanation = `This email is pretending to be from ${targetBrand}, but the sender's domain (${fromDomain}) is a deceptive lookalike registered to trick you.`;
    } else if (hasSuspiciousUrls) {
      const dest = suspiciousUrls[0].domain || 'an external unknown host';
      plainExplanation = `This email contains deceptive links that point to an untrusted server (${dest}) to harvest credentials.`;
    } else if (anomalousHop) {
      plainExplanation = `This email originated from an anonymized relay or suspicious hosting provider (${anomalousHop.city || 'unverified region'}, ${anomalousHop.country || 'anomalous network'}) rather than an authorized enterprise mail server.`;
    } else if (hasDangerousAtts) {
      plainExplanation = `This email includes dangerous file attachments (${dangerousAtts[0].filename}) engineered to execute malicious scripts or malware.`;
    } else if (!isTyposquat && !hasSuspiciousUrls && !anomalousHop && !hasDangerousAtts) {
      plainExplanation = `This email was flagged by automated classification as potentially malicious, but no specific technical evidence (spoofed domain, malicious links, dangerous attachments, or anomalous routing) was found — manual review is recommended before taking action.`;
    } else {
      plainExplanation = `This email exhibits strong indicators of a targeted phishing or wire fraud lure designed to compromise credentials.`;
    }
  } else if (isSuspicious) {
    plainExplanation = `This email exhibits irregular routing or sender configuration anomalies that warrant caution before interacting with its contents.`;
  } else {
    plainExplanation = `This email was verified authentic with clean cryptographic signatures and safe transmission routing.`;
  }

  // 2. 'What this means' section translating technical findings into plain English
  const whatThisMeans: Array<{ title: string; text: string; jargonKey?: string }> = [];

  if (authPassed) {
    whatThisMeans.push({
      title: 'Authentication passed',
      text: 'Authentication passed — this means the sender really owns their domain, but it does NOT mean the email is safe.',
      jargonKey: 'DMARC'
    });
  } else if (analysis.auth?.spf?.status === 'FAIL' || analysis.auth?.dkim?.status === 'FAIL' || analysis.auth?.dmarc?.status === 'FAIL' || analysis.auth?.dmarc?.status === 'REJECT') {
    whatThisMeans.push({
      title: 'Authentication failed',
      text: 'Authentication failed — the sender failed cryptographic SPF/DKIM verification, indicating potential sender spoofing.',
      jargonKey: 'SPF'
    });
  }

  if (isTyposquat) {
    whatThisMeans.push({
      title: 'Lookalike domain',
      text: `Lookalike domain — the sender's address looks almost identical to ${targetBrand || 'a trusted brand'} but has deliberate typos to trick you.`,
      jargonKey: 'TYPOSQUATTING'
    });
  }

  if (hasSuspiciousUrls) {
    whatThisMeans.push({
      title: 'Dangerous links',
      text: "Dangerous links — the email contains links whose displayed text doesn't match where they actually lead.",
    });
  }

  if (isOriginAnomalous) {
    whatThisMeans.push({
      title: 'Unusual routing',
      text: 'Unusual routing — the email originated from a hosting provider or exit relay rather than a standard corporate mail server.',
      jargonKey: anomalousHop?.is_tor ? 'TOR' : 'ASN'
    });
  }

  if (hasDangerousAtts) {
    whatThisMeans.push({
      title: 'Dangerous attachments',
      text: 'Dangerous attachments — contains files that could execute malware or scripts on your computer.'
    });
  }

  if (isSafe && whatThisMeans.length === 0) {
    whatThisMeans.push({
      title: 'Verified sender',
      text: 'Verified sender — cryptographic checks confirmed the sender identity and no deceptive links or malware were found.'
    });
  }

  // 3. Clear Recommended Action
  let recommendedAction = '';
  if (isMalicious) {
    recommendedAction = 'Do not click links or reply. Block sender domain and delete message.';
  } else if (isSuspicious) {
    recommendedAction = 'Exercise caution. Do not click links, open attachments, or enter credentials until verified with the sender through an independent channel.';
  } else {
    recommendedAction = 'Message passed safety and identity verification. Safe to read and proceed normally.';
  }

  return (
    <div id="plain-language-summary-card" className="bg-[#16181D] border border-[#2A2D34] rounded-xl p-5 shadow-lg font-sans text-slate-100">
      {/* Header: Clear, Bold Verdict Badge + Threat Score + Progressive Disclosure Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A2D34] pb-4 mb-4">
        <div className="flex items-center gap-3">
          {/* Bold Verdict Badge: SAFE (green), SUSPICIOUS (amber), MALICIOUS (red) */}
          <div
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 font-black text-sm tracking-wider uppercase shadow-md ${
              isMalicious
                ? 'bg-rose-500 text-white shadow-rose-900/40'
                : isSuspicious
                ? 'bg-amber-500 text-slate-950 shadow-amber-900/30'
                : 'bg-emerald-600 text-white shadow-emerald-900/40'
            }`}
          >
            {isMalicious ? (
              <ShieldAlert className="w-4 h-4 text-white shrink-0" />
            ) : isSuspicious ? (
              <AlertTriangle className="w-4 h-4 text-slate-950 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-white shrink-0" />
            )}
            <span>
              {isMalicious ? 'MALICIOUS' : isSuspicious ? 'SUSPICIOUS' : 'SAFE'}
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span
              className={`px-2.5 py-1 rounded-md font-bold border ${
                isMalicious
                  ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                  : isSuspicious
                  ? 'bg-amber-950/40 border-amber-800 text-amber-300'
                  : 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              }`}
            >
              {threatScore}/100 Threat Score
            </span>
            <span className="text-slate-400 hidden md:inline">•</span>
            <span className="text-slate-300 text-xs hidden md:inline">
              Executive & Non-Technical Reviewer Summary
            </span>
          </div>
        </div>

        {/* Progressive Disclosure Toggle Button */}
        {onToggleTechnicalDetails && (
          <button
            type="button"
            onClick={() => onToggleTechnicalDetails(!isTechnicalExpanded)}
            className="px-3.5 py-1.5 rounded-lg bg-[#1D2027] hover:bg-[#2A2D34] border border-[#2A2D34] text-xs text-cyan-300 hover:text-cyan-200 font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto shadow-sm"
          >
            {isTechnicalExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 text-cyan-400" />
                <span>Hide technical deep dive</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 text-cyan-400" />
                <span>Show technical deep dive</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* 1. One-Sentence Plain-Language Explanation */}
      <div className={`p-4 rounded-lg border mb-4 text-[14px] leading-relaxed font-medium ${
        isMalicious 
          ? 'bg-rose-950/20 border-rose-900/40 text-rose-100' 
          : isSuspicious 
          ? 'bg-amber-950/20 border-amber-900/40 text-amber-100' 
          : 'bg-emerald-950/20 border-emerald-900/40 text-emerald-100'
      }`}>
        <p>{plainExplanation}</p>
      </div>

      {/* 2. 'What this means' Section translating findings into plain English */}
      <div className="mb-4 space-y-2">
        <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>What this means</span>
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {whatThisMeans.map((item, idx) => (
            <div 
              key={idx} 
              className="bg-[#1D2027] border border-[#2A2D34] rounded-lg p-3 text-xs text-slate-200 flex items-start gap-2.5 leading-relaxed"
            >
              <div className="mt-0.5 shrink-0">
                {isMalicious || isSuspicious ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 block" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 block" />
                )}
              </div>
              <div className="flex-1">
                <span>{item.text}</span>
                {item.jargonKey && (
                  <span className="ml-2 inline-block">
                    <JargonTooltip termKey={item.jargonKey} className="text-[11px]" />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Recommended Action Banner */}
      <div className={`rounded-lg p-3.5 border flex items-start gap-3 text-xs leading-relaxed ${
        isMalicious
          ? 'bg-rose-950/30 border-rose-700/60 text-rose-200'
          : isSuspicious
          ? 'bg-amber-950/30 border-amber-700/60 text-amber-200'
          : 'bg-emerald-950/30 border-emerald-700/60 text-emerald-200'
      }`}>
        <div className="font-bold uppercase tracking-wider font-mono text-[11px] shrink-0 flex items-center gap-1 mt-0.5">
          {isMalicious ? <ShieldBan className="w-3.5 h-3.5 text-rose-400" /> : <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />}
          <span>Recommended Action:</span>
        </div>
        <div className="font-semibold text-slate-100">
          {recommendedAction}
        </div>
      </div>
    </div>
  );
}
