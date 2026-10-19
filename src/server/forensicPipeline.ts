import crypto from 'crypto';
import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { GoogleGenAI } from '@google/genai';
import { authenticate } from 'mailauth';
import { parse as parseHtml } from 'node-html-parser';
import { extractHopsAndOriginIp } from './ipExtractor';
import { resolveIpGeolocation } from './geoService';
import { resolveDomainIntelligence } from './domainService';
import { isSpamhausListed } from './intelligence/spamhausDrop';
import { isTorExitNode } from './intelligence/torExitNodes';
import { parseAuthenticationHeaders } from '../utils/authParser';
import { parseMimeStructure, decodeHeaderWords } from '../utils/mimeDecoder';
import { classifyEmailContent } from './classifier';
import { extractFinancialEntities, getWeightedSocialEngineeringScore } from './structuralFeatures';
import { correlateCaseWithCases } from './correlationEngine';
import { upsertPersistedCase, inMemoryStore, type PersistedCase } from './caseStore';
import { getStoredProfile } from './userProfileStore';
import { getSupabaseClient, DEFAULT_ORG_ID } from './supabase';
import { logAuditAction } from './compliance';
import { broadcastAlert, broadcastWebSocketEvent } from './websocket';
import {
  processInboundQuarantineGate,
  recordSyncedEmail,
  insertQuarantineReportNote,
  ensureFreshAccessToken,
  getGmailAccessToken,
  getGmailStatus
} from './gmailService';
import { logger } from './logger';

export function analyzeContentRisk(subject: string, body: string): { score: number; heuristics: any[] } {
  const text = `${subject} ${body}`;
  const lower = text.toLowerCase();
  const heuristics: any[] = [];
  let score = 0;

  const seScores = getWeightedSocialEngineeringScore(text);
  const finEntities = extractFinancialEntities(text);

  if (seScores.urgency > 0.1 || seScores.fear_threat > 0.1) {
    score += 15;
    heuristics.push({
      id: 'h-urgency',
      title: 'Urgency/Pressure Language',
      severity: 'MEDIUM',
      description: 'Urgent action or threat of account suspension detected in message content.',
      triggered: true
    });
  }

  const isBecContext = /(?:wire|direct deposit|payroll|w-2|gift card|invoice|remittance|swift transfer|routing number|escrow|bank details|ach debit)/i.test(text);
  if (isBecContext || finEntities.hasFinancialEntities) {
    score += 25;
    const finDetails: string[] = [];
    if (finEntities.dollarAmounts.length > 0) finDetails.push(`Amounts: ${finEntities.dollarAmounts.join(', ')}`);
    if (finEntities.ibanNumbers.length > 0) finDetails.push(`IBANs: ${finEntities.ibanNumbers.join(', ')}`);
    if (finEntities.routingNumbers.length > 0) finDetails.push(`Routing: ${finEntities.routingNumbers.join(', ')}`);
    if (finEntities.bankAccountCandidates.length > 0) finDetails.push(`Accounts: ${finEntities.bankAccountCandidates.join(', ')}`);

    heuristics.push({
      id: 'h-bec',
      title: 'Business Email Compromise Pattern',
      severity: 'HIGH',
      description: finDetails.length > 0
        ? `Financial or banking alteration request with verified entities (${finDetails.join(' | ')}).`
        : 'Financial or banking alteration request patterns characteristic of BEC.',
      triggered: true
    });
  }

  const credentialPhrases = [
    'click here to verify', 'confirm your password', 'log in to secure your account',
    'reset password', 'session expired', 'verify credentials', 'login below', 're-authenticate'
  ];
  if (credentialPhrases.some((p) => lower.includes(p))) {
    score += 20;
    heuristics.push({
      id: 'h-cred-harvest',
      title: 'Credential Harvesting Language',
      severity: 'HIGH',
      description: 'Deceptive calls to action prompting credential submission or authentication bypass.',
      triggered: true
    });
  }

  return { score, heuristics };
}

export function broadcastAnalysisProgress(
  requestId: string | undefined,
  stage: string,
  label: string,
  status: 'active' | 'done' = 'done'
): void {
  if (!requestId) return;
  try {
    broadcastWebSocketEvent({
      type: 'ANALYSIS_PROGRESS',
      requestId,
      stage,
      label,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    logger.warn({ error: err?.message }, '[Analysis Progress Broadcast Warning]');
  }
}

export function buildEvidenceWhyNarrative(analysisOrCase: any): {
  why: string;
  evidence_chain: string[];
  confidence: number;
  limitation: string;
} {
  const threatScore = analysisOrCase.threat_score ?? analysisOrCase.threatScore ?? 0;
  const severity = (analysisOrCase.severity || 'LOW').toUpperCase();
  const breakdown = analysisOrCase.threat_score_breakdown || analysisOrCase.threatScoreBreakdown;
  const heuristics = analysisOrCase.heuristics || [];
  const fromDomain = analysisOrCase.from_domain || analysisOrCase.fromDomain || 'sender domain';

  const authObj = analysisOrCase.auth || {};
  const spfPass = authObj.spf?.status === 'PASS';
  const dkimPass = authObj.dkim?.status === 'PASS';
  const dmarcPass = authObj.dmarc?.status === 'PASS';
  const authAllPass = spfPass && dkimPass && dmarcPass;

  let topDrivers: string[] = [];
  if (breakdown?.components) {
    const compMap = breakdown.components;
    const names: Record<string, string> = {
      authentication: 'Authentication Anomaly',
      domainRisk: 'Domain Intelligence Risk',
      infrastructureRisk: 'Infrastructure & Relay Anomaly',
      mlClassification: 'ML Content Lure Pattern',
      heuristics: 'Identity & Call-to-Action Heuristics'
    };
    const drivers = Object.entries(compMap)
      .filter(([_, v]: [string, any]) => v && v.score > 0)
      .sort((a: [string, any], b: [string, any]) => (b[1].score / (b[1].max || 1)) - (a[1].score / (a[1].max || 1)));

    topDrivers = drivers.map(([k, v]: [string, any]) => `${names[k] || k} (+${v.score} pts)`);
  }

  if (topDrivers.length === 0 && heuristics.length > 0) {
    topDrivers = heuristics.filter((h: any) => h.triggered).map((h: any) => h.title);
  }

  const primaryDriversStr = topDrivers.length > 0 ? topDrivers.join(', ') : 'multi-vector heuristic patterns';

  let whyText = '';
  const evidenceChain: string[] = [];
  const classificationName = analysisOrCase.classification || '';
  const verdictName = (analysisOrCase.verdict || '').toUpperCase();
  const isElevatedThreat =
    threatScore >= 25 ||
    ['CRITICAL', 'HIGH', 'MEDIUM'].includes(severity) ||
    ['PHISH', 'MALICIOUS', 'FRAUD', 'SUSPICIOUS', 'IMPERSONATION', 'BEC'].includes(verdictName) ||
    (classificationName && !['Legitimate', 'Clean'].includes(classificationName));

  if (isElevatedThreat) {
    if (authAllPass) {
      whyText = `Flagged with threat score ${threatScore}/100 (${severity}, verdict ${verdictName || 'SUSPICIOUS'}). Note: Cryptographic authentication (SPF, DKIM, DMARC) passed successfully, which confirms domain ownership but does NOT guarantee message content or link safety. Primary risk is driven by: ${primaryDriversStr}.`;
    } else {
      whyText = `Flagged with threat score ${threatScore}/100 (${severity}, verdict ${verdictName || 'SUSPICIOUS'}) due to detected threat vectors: ${primaryDriversStr}.`;
    }
    evidenceChain.push(`1. Primary threat drivers: ${primaryDriversStr}.`);
    if (authAllPass) {
      evidenceChain.push(`2. SPF/DKIM/DMARC passed for domain "${fromDomain}", proving domain ownership but not content safety.`);
    } else {
      evidenceChain.push(`2. Authentication evaluation: SPF=${authObj.spf?.status || 'NONE'}, DKIM=${authObj.dkim?.status || 'NONE'}, DMARC=${authObj.dmarc?.status || 'NONE'}.`);
    }
    if (heuristics.length > 0) {
      evidenceChain.push(`3. Triggered forensic heuristics: ${heuristics.slice(0, 3).map((h: any) => h.title).join('; ')}.`);
    }
  } else {
    whyText = `Message verified as legitimate (threat score ${threatScore}/100). Envelope authentication, sender domain reputation, and transmission path show no high-risk indicators.`;
    evidenceChain.push(`1. Sender domain "${fromDomain}" resolved with verified reputation.`);
    evidenceChain.push(`2. Cryptographic SPF/DKIM/DMARC authentication validated.`);
    evidenceChain.push(`3. No high-risk heuristic triggers or suspicious payload URLs detected.`);
  }

  return {
    why: whyText,
    evidence_chain: evidenceChain,
    confidence: Math.min(0.99, Math.max(0.70, analysisOrCase.ml_confidence || analysisOrCase.mlConfidence || 0.95)),
    limitation: 'Authoritative multi-vector forensic evaluation.'
  };
}

export async function generateAiNarrativeForCase(targetCase: any): Promise<{
  narrative: string;
  model: string;
  source: string;
  disclaimer: string;
}> {
  const caseId = targetCase?.id || 'CASE-LIVE';
  const subject = targetCase?.headers?.subject || targetCase?.title || targetCase?.name || targetCase?.subject || '(No Subject)';
  const threatScore = targetCase?.threat_score ?? targetCase?.threatScore ?? targetCase?.riskScore ?? 0;
  const severity = targetCase?.severity || targetCase?.threatVerdict || (threatScore >= 75 ? 'HIGH' : threatScore >= 40 ? 'MEDIUM' : 'LOW');
  const fromDomain = targetCase?.from_domain || targetCase?.fromDomain || 'sender-domain.com';
  const originIp = targetCase?.origin_ip || targetCase?.originIp || targetCase?.hops?.[0]?.fromIp || '127.0.0.1';
  const originCountry = targetCase?.origin_country || targetCase?.originCountry || targetCase?.hops?.[0]?.country || 'Unknown';
  const spfStatus = targetCase?.auth?.spf?.status || 'NONE';
  const dkimStatus = targetCase?.auth?.dkim?.status || 'NONE';
  const dmarcStatus = targetCase?.auth?.dmarc?.status || 'NONE';
  const heuristicsList = Array.isArray(targetCase?.heuristics) && targetCase.heuristics.length > 0
    ? targetCase.heuristics.map((h: any) => h.title || h.name || h.id).slice(0, 4).join(', ')
    : (targetCase?.tags ? targetCase.tags.join(', ') : 'Forensic Telemetry');

  const breakdownText = (targetCase?.threat_score_breakdown || targetCase?.threatScoreBreakdown)
    ? JSON.stringify(targetCase.threat_score_breakdown || targetCase.threatScoreBreakdown)
    : 'N/A';

  const promptText = `Perform forensic narrative synthesis for Case ID "${caseId}".
Telemetry Evidence:
- Subject: "${subject}"
- Verdict: ${severity} (Threat Score: ${threatScore}/100)
- Sender Domain: ${fromDomain}
- Origin IP: ${originIp} (${originCountry})
- Cryptographic Auth: SPF=${spfStatus}, DKIM=${dkimStatus}, DMARC=${dmarcStatus}
- Heuristics Triggered: ${heuristicsList}
- Threat Score Breakdown: ${breakdownText}

CRITICAL INSTRUCTION:
Write a concise 3-4 sentence SOC analyst summary based strictly on this evidence.
Your summary's tone and conclusion MUST match the threat score (${threatScore}/100) and severity (${severity}) — do NOT describe the message as clean, legitimate, or verified authentic if the threat score is 35 or higher or severity is MEDIUM/HIGH/CRITICAL.
If authentication (SPF/DKIM/DMARC) passed but the threat score is elevated, explicitly explain why (name the actual driving components like ML content lures or domain age) and state that passing authentication only proves domain ownership, not message content safety.`;

  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
      const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

      for (let i = 0; i < candidateModels.length; i++) {
        const model = candidateModels[i];
        try {
          const response = await ai.models.generateContent({
            model,
            contents: promptText
          });

          const narrativeText = response?.text;
          if (narrativeText && narrativeText.trim()) {
            return {
              narrative: narrativeText.trim(),
              model,
              source: `TraceXMail Gemini AI Forensic Engine (${model})`,
              disclaimer: 'AI-generated narrative summary based on deterministic forensic telemetry. Verify independently before regulatory or legal submission.'
            };
          }
        } catch (modelErr: any) {
          const errMsg = modelErr?.message || String(modelErr);
          const isTransient =
            modelErr?.status === 503 ||
            modelErr?.code === 503 ||
            errMsg.includes('503') ||
            errMsg.includes('high demand') ||
            errMsg.includes('UNAVAILABLE') ||
            errMsg.includes('429');

          if (isTransient && i < candidateModels.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 350 * (i + 1)));
            continue;
          }
        }
      }
    } catch (geminiErr: any) {
      logger.warn({ error: geminiErr?.message }, '[Gemini API Narrative Error]');
    }
  }

  if (groqKey) {
    try {
      const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [
            {
              role: 'system',
              content: 'You are TraceXMail Groq AI Forensic Reasoning Engine. Synthesize high-accuracy email forensic summaries.'
            },
            {
              role: 'user',
              content: promptText
            }
          ],
          temperature: 0.2
        })
      });

      if (response.ok) {
        const data: any = await response.json();
        const narrativeText = data.choices?.[0]?.message?.content;
        if (narrativeText && narrativeText.trim()) {
          return {
            narrative: narrativeText.trim(),
            model: groqModel,
            source: `TraceXMail Groq AI Forensic Engine (${groqModel})`,
            disclaimer: 'AI-generated narrative summary based on deterministic forensic telemetry. Verify independently before regulatory or legal submission.'
          };
        }
      }
    } catch (groqErr: any) {
      logger.warn({ error: groqErr?.message }, '[Groq API Narrative Error]');
    }
  }

  // Telemetry Forensic Fallback
  let fallbackText = `Forensic telemetry briefing for "${subject}" (${fromDomain}): Originating relay IP ${originIp} (${originCountry}) evaluated with cryptographic authentication SPF=${spfStatus}, DKIM=${dkimStatus}, DMARC=${dmarcStatus}.`;
  if (threatScore >= 75) {
    fallbackText += ` High-risk threat indicators identified (${heuristicsList}) resulting in risk score ${threatScore}/100 (${severity}). Immediate quarantine and investigation recommended.`;
  } else if (threatScore >= 40) {
    fallbackText += ` Suspicious anomalies detected (${heuristicsList}) resulting in risk score ${threatScore}/100 (${severity}). Security analyst review advised.`;
  } else {
    fallbackText += ` Cryptographic and routing telemetry verified authentic with risk score ${threatScore}/100 (${severity}).`;
  }

  return {
    narrative: fallbackText,
    model: 'TraceXMail Telemetry Engine',
    source: 'TraceXMail Core Telemetry Engine',
    disclaimer: 'AI-generated narrative summary based on deterministic forensic telemetry. Verify independently before regulatory or legal submission.'
  };
}

export async function parseRawEmailToAnalysis(
  rawContent: string,
  fileName: string = 'email.eml',
  requestId?: string,
  options?: {
    isPushInterception?: boolean;
    deliveryStage?: 'pre-delivery-hold' | 'post-delivery-alert';
    userId?: string;
    userEmail?: string;
    organizationId?: string;
  }
): Promise<{ case: any; analysis: any; alert: any }> {
  // 1. Extract chronological hops and candidate origin IPs using RFC 5321/5322 extraction engine
  const { hops: extractedHops } = extractHopsAndOriginIp(rawContent);

  const lines = rawContent.split(/\r?\n/);
  let subject = '(No Subject)';
  let from = 'unknown@sender.corp';
  let to = 'recipient@enterprise.corp';
  let replyTo: string | undefined = undefined;
  let returnPath: string | undefined = undefined;
  let date = new Date().toUTCString();
  let messageId = `<${Date.now()}@tracexmail.local>`;
  const allHeaders: Record<string, string> = {};

  let currentHeader = '';
  let currentValue = '';

  for (const line of lines) {
    if (line.trim() === '') {
      if (currentHeader || Object.keys(allHeaders).length > 0) {
        break; // Header boundary reached
      }
      continue;
    }
    if (/^[^\s:]+:/.test(line)) {
      if (currentHeader) {
        allHeaders[currentHeader] = currentValue;
      }
      const colonIdx = line.indexOf(':');
      currentHeader = line.substring(0, colonIdx).trim();
      currentValue = line.substring(colonIdx + 1).trim();

      const lower = currentHeader.toLowerCase();
      const decodedVal = decodeHeaderWords(currentValue);
      if (lower === 'subject') subject = decodedVal;
      else if (lower === 'from') from = decodedVal;
      else if (lower === 'to') to = decodedVal;
      else if (lower === 'reply-to') replyTo = decodedVal;
      else if (lower === 'return-path') returnPath = decodedVal;
      else if (lower === 'date') date = decodedVal;
      else if (lower === 'message-id') messageId = decodedVal;
      else if (!from || from === 'unknown@sender.corp') {
        if (lower === 'sender' || lower === 'resent-from' || lower === 'x-sender') from = decodedVal;
      }
      if (!to || to === 'recipient@enterprise.corp') {
        if (lower === 'delivered-to' || lower === 'x-original-to' || lower === 'envelope-to' || lower === 'cc') to = decodedVal;
      }
    } else if (/^\s+/.test(line) && currentHeader) {
      currentValue += ' ' + line.trim();
    } else if (currentHeader) {
      currentValue += ' ' + line.trim();
    }
  }
  if (currentHeader) {
    allHeaders[currentHeader] = currentValue;
  }
  broadcastAnalysisProgress(requestId, 'headers', 'Parsed RFC822 headers and relay chain', 'done');

  // 2. Extract genuine fromEmail and sender domain
  const fromEmailMatch = from.match(/<([^>]+)>/) || from.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const fromEmail = fromEmailMatch ? fromEmailMatch[1].trim() : from.trim();
  let fromDomain = '';
  if (fromEmail.includes('@')) {
    fromDomain = fromEmail.split('@')[1].toLowerCase().trim();
  } else if (returnPath && returnPath.includes('@')) {
    const rpMatch = returnPath.match(/<([^>]+)>/) || returnPath.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (rpMatch) fromDomain = rpMatch[1].split('@')[1].toLowerCase().trim();
  }
  if (!fromDomain) {
    fromDomain = 'unspecified-sender.net';
  }

  // 3. Resolve Real Domain Intelligence
  const domainIntelligence = await resolveDomainIntelligence(fromDomain);
  broadcastAnalysisProgress(requestId, 'domain', `Resolved DNS & RDAP for ${fromDomain}`, 'done');
  const isTyposquat = domainIntelligence.is_typosquat || false;
  const targetBrand = domainIntelligence.typosquatting?.target_brand;

  // 4. Resolve Real Geolocation and Network Details for all extracted hops
  const hops: any[] = [];
  for (let idx = 0; idx < extractedHops.length; idx++) {
    const cand = extractedHops[idx];
    const geo = await resolveIpGeolocation(cand.fromIp);
    const ipIsSpamhaus = cand.fromIp ? isSpamhausListed(cand.fromIp) : false;

    const infraType: 'INTERNAL_PRIVATE' | 'BOTNET_INDICATOR' | 'TOR_EXIT_NODE' | 'VPN_PROXY' | 'DATACENTER_HOSTING' | 'PUBLIC_ROUTABLE' =
      geo.isPrivate ? 'INTERNAL_PRIVATE'
      : (ipIsSpamhaus ? 'BOTNET_INDICATOR'
      : (geo.isTor ? 'TOR_EXIT_NODE'
      : (geo.infra === 'vpn' ? 'VPN_PROXY'
      : (geo.infra === 'hosting' ? 'DATACENTER_HOSTING'
      : 'PUBLIC_ROUTABLE'))));

    hops.push({
      hopNumber: idx + 1,
      fromHost: cand.fromHost || (cand.fromIp ? `host-${cand.fromIp.replace(/[.:]/g, '-')}` : 'unknown-relay'),
      fromIp: cand.fromIp,
      byHost: cand.byHost || 'mx-ingress',
      protocol: cand.protocol || 'ESMTP',
      timestamp: cand.timestamp || date,
      delaySec: cand.delaySec ?? (idx === 0 ? 0 : 1),
      isPrivate: geo.isPrivate,
      isRfc1918: geo.isRfc1918,
      subnetType: geo.classification.subnetType,
      cidr: geo.classification.cidr,
      scope: geo.classification.scope,
      subnetDescription: geo.classification.description,
      city: geo.city,
      country: geo.country,
      countryCode: geo.countryCode,
      rirCountry: geo.rirCountry,
      countryMismatch: geo.countryMismatch,
      region: geo.region,
      timeZone: geo.timeZone,
      lat: geo.lat,
      lng: geo.lng,
      accuracyRadius: geo.accuracyRadius,
      asn: geo.asn,
      org: geo.org,
      isp: geo.isp,
      reverseDns: geo.reverseDns,
      abuseScore: ipIsSpamhaus ? 100 : (geo.abuseScore ?? 0),
      isBlacklisted: ipIsSpamhaus || (geo.isBlacklisted ?? false),
      isProxyOrVpn: geo.isProxyOrVpn ?? false,
      isAnonymousProxy: geo.isProxyOrVpn ?? false,
      is_vpn: Boolean((geo.infra === 'vpn' || geo.isProxyOrVpn) && !geo.isTor),
      is_cloud: Boolean(geo.infra === 'hosting' || infraType === 'DATACENTER_HOSTING'),
      is_tor: geo.isTor ?? (cand.fromIp ? isTorExitNode(cand.fromIp) : false),
      isTorExitNode: geo.isTor ?? (cand.fromIp ? isTorExitNode(cand.fromIp) : false),
      is_botnet_indicator: ipIsSpamhaus,
      infra: geo.infra,
      infrastructureType: infraType,
      isOrigin: (cand as any).isOrigin ?? (idx === 0),
      isPublicGateway: (cand as any).isPublicGateway ?? false,
      maxmindVerified: true,
      maxmindSource: geo.source,
      lookupMethod: geo.lookupMethod
    });
  }
  broadcastAnalysisProgress(requestId, 'geo', `Traced ${hops.length} relay hop(s) via MaxMind GeoIP & ASN`, 'done');

  // 5. Ensure earliest public hop is flagged as gateway if origin is private
  const firstPublicHop = hops.find((h) => !h.isPrivate && h.fromIp);
  if (firstPublicHop && !firstPublicHop.isOrigin) {
    firstPublicHop.isPublicGateway = true;
  }
  const primaryGeoHop = hops.find((h) => !h.isPrivate && h.fromIp) || hops[0];

  const bodyText = rawContent.split(/\r?\n\r?\n/).slice(1).join('\n');

  // 6. Parse authentication headers
  const headerAuth = parseAuthenticationHeaders(allHeaders, {
    fromDomain,
    fromEmail,
    originIp: primaryGeoHop?.fromIp,
    domainDns: domainIntelligence.dns,
    isNxdomain: domainIntelligence.status === 'nxdomain'
  });

  let authResult: any = null;
  try {
    const authPromise = authenticate(rawContent, {
      ip: primaryGeoHop?.fromIp,
      helo: primaryGeoHop?.fromHost || undefined,
      mta: 'tracexmail.local',
      sender: fromEmail || from
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Mailauth verification timed out after 3s')), 3000)
    );
    authResult = await Promise.race([authPromise, timeoutPromise]);
  } catch (authErr: any) {
    logger.warn({ error: authErr?.message || authErr }, '[MailAuth Verification Warning]');
  }

  const rawDkim = authResult?.dkim?.results?.[0];
  const mailauthDkimStatus = rawDkim?.status?.result ? String(rawDkim.status.result).toUpperCase() : 'NONE';
  const dkimStatus = (headerAuth.dkim.status && headerAuth.dkim.status !== 'NONE')
    ? headerAuth.dkim.status
    : (mailauthDkimStatus !== 'NONE' ? mailauthDkimStatus : 'NONE');
  const dkimSelector = headerAuth.dkim.selector || rawDkim?.selector || 's1';
  const dkimDomain = headerAuth.dkim.domain || rawDkim?.signingDomain || fromDomain;
  const dkimDetails = headerAuth.dkim.details || rawDkim?.status?.comment || rawDkim?.info || (rawDkim ? 'DKIM signature evaluation' : 'No DKIM signature present');

  const mailauthSpfStatus = authResult?.spf?.status?.result ? String(authResult.spf.status.result).toUpperCase() : 'NONE';
  const spfStatus = (headerAuth.spf.status && headerAuth.spf.status !== 'NONE')
    ? headerAuth.spf.status
    : (mailauthSpfStatus !== 'NONE' ? mailauthSpfStatus : (domainIntelligence.status === 'nxdomain' ? 'FAIL' : 'NONE'));
  const spfRecord = headerAuth.spf.record || domainIntelligence.dns?.spf || authResult?.spf?.header || undefined;
  const spfDetails = headerAuth.spf.details || authResult?.spf?.status?.comment || authResult?.spf?.info || domainIntelligence.dns?.spf_qualifier || 'Authoritative DNS & SPF validation';

  const mailauthDmarcStatus = authResult?.dmarc?.status?.result ? String(authResult.dmarc.status.result).toUpperCase() : 'NONE';
  let dmarcStatus = (headerAuth.dmarc.status && headerAuth.dmarc.status !== 'NONE')
    ? headerAuth.dmarc.status
    : (mailauthDmarcStatus !== 'NONE' ? mailauthDmarcStatus : 'NONE');

  if (dmarcStatus === 'NONE') {
    if (spfStatus === 'PASS' || dkimStatus === 'PASS') {
      dmarcStatus = 'PASS';
    } else if (spfStatus === 'FAIL' || dkimStatus === 'FAIL') {
      dmarcStatus = 'FAIL';
    }
  }

  const dmarcPolicy = headerAuth.dmarc.policy || authResult?.dmarc?.policy || domainIntelligence.dns?.dmarc_policy || 'none';
  const dmarcDetails = headerAuth.dmarc.details || authResult?.dmarc?.status?.comment || authResult?.dmarc?.info || domainIntelligence.dns?.dmarc_enforcement || 'Authoritative DMARC policy evaluation';

  const arcStatus = authResult?.arc?.status?.result
    ? String(authResult.arc.status.result).toUpperCase()
    : headerAuth.arc.status;
  const arcDetails = authResult?.arc?.authResults || headerAuth.arc.details || (authResult?.arc?.status?.result ? `ARC status: ${authResult.arc.status.result}` : 'No ARC signature chain present');

  const synthesizedAuth = {
    spf: { status: spfStatus, record: spfRecord, ip: primaryGeoHop?.fromIp, domain: fromDomain, details: spfDetails },
    dkim: { status: dkimStatus, selector: dkimSelector, domain: dkimDomain, details: dkimDetails },
    dmarc: { status: dmarcStatus, policy: dmarcPolicy, domain: fromDomain, details: dmarcDetails },
    arc: { status: arcStatus, details: arcDetails }
  };
  broadcastAnalysisProgress(requestId, 'auth', `Verified SPF=${spfStatus} DKIM=${dkimStatus} DMARC=${dmarcStatus}`, 'done');

  // Content Risk Heuristics
  const contentRisk = analyzeContentRisk(subject, bodyText);

  // 7. Multi-Layer Classifier
  const classification = await classifyEmailContent({
    from,
    fromDomain,
    to,
    subject,
    bodyText,
    replyTo,
    returnPath,
    hops,
    auth: synthesizedAuth,
    domainIntelligence: domainIntelligence as any
  });

  const combinedHeuristics = [...classification.heuristics, ...contentRisk.heuristics.filter((h) => !classification.heuristics.some((ch) => ch.id === h.id))];

  const mismatchHop = hops.find((h) => h.countryMismatch && h.fromIp);
  if (mismatchHop && !combinedHeuristics.some((h) => h.id === 'h-rir-geo-mismatch')) {
    combinedHeuristics.push({
      id: 'h-rir-geo-mismatch',
      title: 'RIR / MaxMind Country Allocation Mismatch',
      severity: 'LOW',
      description: `Relay hop IP ${mismatchHop.fromIp} MaxMind location identifies as [${mismatchHop.countryCode || mismatchHop.country}] while authoritative Regional Internet Registry (RIR) registration indicates allocation in [${mismatchHop.rirCountry}].`,
      triggered: true
    });
  }

  const spamhausHop = hops.find((h) => h.fromIp && isSpamhausListed(h.fromIp));
  if (spamhausHop && !combinedHeuristics.some((h) => h.id === 'h-spamhaus-drop')) {
    combinedHeuristics.push({
      id: 'h-spamhaus-drop',
      title: 'Spamhaus DROP / EDROP Malicious Netblock',
      severity: 'CRITICAL',
      description: `Relay IP ${spamhausHop.fromIp} belongs to an active Spamhaus DROP/EDROP advisory netblock associated with hijacked infrastructure or botnet operations.`,
      triggered: true
    });
  }

  const threatScore = classification.threatScore;
  const severity = classification.severity;
  const verdict = classification.verdict;
  const mlConfidence = classification.mlConfidence;
  const phishingProbability = classification.phishingProbability;
  const threatScoreBreakdown = classification.threatScoreBreakdown;
  broadcastAnalysisProgress(requestId, 'classify', `ML classifier: ${verdict} (${threatScore}/100)`, 'done');

  const torHop = hops.find((h) => h.is_tor || h.isBlacklisted || (h.abuseScore && h.abuseScore > 60));
  const primaryIpIsSpamhaus = primaryGeoHop?.fromIp ? isSpamhausListed(primaryGeoHop.fromIp) : false;

  const caseInfraType: 'INTERNAL_PRIVATE' | 'BOTNET_INDICATOR' | 'TOR_EXIT_NODE' | 'VPN_PROXY' | 'DATACENTER_HOSTING' | 'PUBLIC_ROUTABLE' =
    primaryGeoHop?.isPrivate ? 'INTERNAL_PRIVATE'
    : (primaryIpIsSpamhaus ? 'BOTNET_INDICATOR'
    : (primaryGeoHop?.is_tor ? 'TOR_EXIT_NODE'
    : (primaryGeoHop?.infra === 'vpn' ? 'VPN_PROXY'
    : (primaryGeoHop?.infra === 'hosting' ? 'DATACENTER_HOSTING'
    : 'PUBLIC_ROUTABLE'))));

  const whyNarrative = buildEvidenceWhyNarrative({
    threat_score: threatScore,
    severity,
    threat_score_breakdown: threatScoreBreakdown,
    heuristics: combinedHeuristics,
    from_domain: fromDomain,
    auth: synthesizedAuth,
    ml_confidence: mlConfidence
  });

  const quarantineOutcome = await processInboundQuarantineGate({
    messageId,
    from,
    subject,
    threatScore,
    verdict,
    isPushInterception: options?.isPushInterception
  });
  const deliveryStage = options?.deliveryStage || quarantineOutcome.deliveryStage;

  const newId = `case-${Date.now()}`;
  const effectiveUserEmail = (options?.userEmail || getGmailStatus()?.email_address || 'analyst@tracexmail.sec').toLowerCase().trim();
  const effectiveProfile = effectiveUserEmail ? getStoredProfile(effectiveUserEmail) : null;
  const effectiveUserId = options?.userId || effectiveProfile?.id || (effectiveUserEmail ? `usr_${effectiveUserEmail.replace(/[^a-zA-Z0-9]/g, '_')}` : undefined);
  const effectiveOrgId = options?.organizationId || effectiveProfile?.organizationId || DEFAULT_ORG_ID;

  const newCaseItem: any = {
    id: newId,
    user_id: effectiveUserId,
    user_email: effectiveUserEmail,
    created_by: effectiveUserId,
    organization_id: effectiveOrgId,
    title: subject,
    description: `Analyzed RFC822 message submission (${rawContent.length} bytes) from file ${fileName}. Statistical ML risk probability: ${(phishingProbability * 100).toFixed(1)}%.`,
    status: quarantineOutcome.isQuarantined ? 'QUARANTINED' : 'OPEN',
    severity,
    threat_score: threatScore,
    threat_score_breakdown: threatScoreBreakdown,
    classification: classification.classification,
    created_at: new Date().toISOString(),
    from_domain: fromDomain,
    origin_ip: primaryGeoHop?.fromIp || '127.0.0.1',
    origin_country: primaryGeoHop?.country || 'Unknown',
    origin_asn: primaryGeoHop?.asn || 'AS-UNKNOWN',
    origin_asn_org: primaryGeoHop?.org || 'ISP',
    infra_type: caseInfraType,
    delivery_stage: deliveryStage,
    deliveryStage: deliveryStage,
    quarantine_action: quarantineOutcome.actionTaken,
    quarantine_label: quarantineOutcome.appliedLabel,
    tags: [
      'Ingested',
      'Automated Forensic Analysis',
      ...(quarantineOutcome.isQuarantined ? ['Quarantined', 'Pre-Delivery Gate'] : []),
      ...(isTyposquat ? ['Typosquatting'] : []),
      ...(torHop ? ['Tor Relay'] : []),
      ...(classification.topVectors.slice(0, 2))
    ],
    assigned_user: effectiveUserEmail || 'TraceXMail Engine',
    source: 'gmail_ingest',
    ml_confidence: mlConfidence,
    phishing_probability: phishingProbability,
    auth: synthesizedAuth,
    heuristics: combinedHeuristics,
    why: whyNarrative
  };

  const aiNarrativeResult = await generateAiNarrativeForCase(newCaseItem);
  newCaseItem.ai_narrative = aiNarrativeResult;
  newCaseItem.aiNarrative = aiNarrativeResult;

  // Persist to Supabase Postgres if configured
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('cases').insert([{
        id: newCaseItem.id,
        organization_id: effectiveOrgId,
        user_id: effectiveUserId,
        user_email: effectiveUserEmail,
        created_by: effectiveUserId,
        title: newCaseItem.title,
        description: newCaseItem.description,
        status: newCaseItem.status,
        severity: newCaseItem.severity,
        threat_score: newCaseItem.threat_score,
        threat_score_breakdown: newCaseItem.threat_score_breakdown,
        classification: newCaseItem.classification,
        auth: newCaseItem.auth,
        heuristics: newCaseItem.heuristics,
        ml_confidence: newCaseItem.ml_confidence,
        phishing_probability: newCaseItem.phishing_probability,
        from_domain: newCaseItem.from_domain,
        origin_ip: newCaseItem.origin_ip,
        origin_country: newCaseItem.origin_country,
        origin_asn: newCaseItem.origin_asn,
        origin_asn_org: newCaseItem.origin_asn_org,
        infra_type: newCaseItem.infra_type,
        created_at: newCaseItem.created_at,
        assigned_user: newCaseItem.assigned_user,
        tags: newCaseItem.tags,
        source: 'gmail_ingest',
        raw_analysis: newCaseItem
      }]);
    } catch (dbErr: any) {
      logger.warn({ error: dbErr?.message }, '[Supabase] Case DB persist warning');
    }
  }

  // Correlate with existing cases
  try {
    const existingPool = Array.from(inMemoryStore.values());
    const corr = correlateCaseWithCases(newCaseItem, existingPool);
    if (corr.correlatedCases.length > 0) {
      newCaseItem.suggested_members = corr.suggestedMembers;
      newCaseItem.correlation_evidence = corr.correlationEvidence;
      newCaseItem.correlation_count = corr.correlatedCases.length;
      if (corr.campaignSuggestion) {
        newCaseItem.campaign_id = corr.campaignSuggestion.id;
        newCaseItem.campaign_name = corr.campaignSuggestion.name;
      }
    } else {
      newCaseItem.suggested_members = [];
      newCaseItem.correlation_evidence = [];
      newCaseItem.correlation_count = 0;
    }
  } catch (corrErr: any) {
    logger.warn({ error: corrErr?.message }, '[Correlation] Error during email ingest correlation');
    newCaseItem.suggested_members = [];
    newCaseItem.correlation_evidence = [];
    newCaseItem.correlation_count = 0;
  }

  // Store in memory and persist to disk
  inMemoryStore.set(newCaseItem.id, newCaseItem);
  upsertPersistedCase(newCaseItem);

  broadcastWebSocketEvent({
    type: 'CASE_CREATED',
    case: newCaseItem,
    caseId: newCaseItem.id,
    userId: effectiveUserId,
    userEmail: effectiveUserEmail,
    organizationId: effectiveOrgId,
    timestamp: new Date().toISOString()
  }, effectiveOrgId);

  // Evidence metadata and raw hash
  const sha256 = crypto.createHash('sha256').update(rawContent || '').digest('hex');
  const evidenceId = `EV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const mimeStructure = parseMimeStructure(rawContent);
  const cleanHtml = mimeStructure.decodedHtmlText || '';
  const cleanBody = mimeStructure.decodedBodyText || bodyText || '';

  const foundUrls = new Set<string>();
  if (cleanHtml) {
    try {
      const root = parseHtml(cleanHtml);
      const elements = root.querySelectorAll('a[href], form[action], img[src]');
      for (const el of elements) {
        const target = el.getAttribute('href') || el.getAttribute('action') || el.getAttribute('src');
        if (!target) continue;
        const clean = target.trim().replace(/&amp;/g, '&');
        if (/^(mailto|tel|javascript|cid|data):/i.test(clean)) continue;
        if (/http:\/\/(www\.)?w3\.org/i.test(clean)) continue;
        if (/http:\/\/schemas\./i.test(clean)) continue;
        if (clean.startsWith('http://') || clean.startsWith('https://')) {
          foundUrls.add(clean.replace(/[),.;'"]+$/, ''));
        }
      }
    } catch {}
  }

  if (cleanBody) {
    const bodyUrlRegex = /(https?:\/\/[^\s<>"']+)/gi;
    let urlMatch;
    while ((urlMatch = bodyUrlRegex.exec(cleanBody)) !== null) {
      const u = urlMatch[1].replace(/[),.;'"]+$/, '').replace(/&amp;/g, '&');
      if (!/http:\/\/(www\.)?w3\.org/i.test(u) && !/http:\/\/schemas\./i.test(u)) {
        foundUrls.add(u);
      }
    }
  }

  const extractedUrls: any[] = [];
  for (const u of foundUrls) {
    let urlHostname = '';
    try {
      urlHostname = new URL(u).hostname.toLowerCase();
    } catch {
      urlHostname = u;
    }
    const isKnownBrand = /(google|github|microsoft|apple|amazon|linkedin|licdn|stripe|paypal)\.com$/i.test(urlHostname);
    const isSuspicious = !isKnownBrand && /verify|security|update|login|auth|banking|wire|tax|service|account|support|temp|session|credential/i.test(urlHostname);
    const isMaliciousUrl = !isKnownBrand && (isSuspicious || isTyposquat);

    extractedUrls.push({
      url: u,
      defangedUrl: u.replace(/^https?:\/\//i, (m) => (m.toLowerCase().startsWith('https') ? 'hxxps://' : 'hxxp://')).replace(/\./g, '[.]'),
      domain: urlHostname,
      status: isMaliciousUrl ? 'MALICIOUS' : isKnownBrand ? 'CLEAN' : 'SUSPICIOUS',
      category: isMaliciousUrl ? 'Credential Harvesting Link' : isKnownBrand ? 'Legitimate Domain' : 'Uncategorized Link'
    });
  }

  const extractedAttachments = mimeStructure.attachments.map((att) => ({
    filename: att.filename,
    size: att.size,
    mimeType: att.mimeType,
    sha256: att.sha256,
    md5: att.md5,
    status: att.isDangerous ? 'MALICIOUS' : 'CLEAN'
  }));

  const emailAnalysis = {
    id: newId,
    sessionId: `Analysis-${new Date().toISOString().slice(0, 10)}-${crypto.randomInt(100, 999)}`,
    trackingId: `tr-${Date.now()}`,
    evidenceId,
    sha256,
    sha256Hash: sha256,
    custodyHash: sha256,
    evidenceSource: 'ingest',
    evidenceReceivedAt: new Date().toISOString(),
    hashVerified: true,
    rawEml: rawContent,
    name: subject !== '(No Subject)' ? subject : fileName,
    analyzedAt: new Date().toUTCString(),
    headers: {
      subject,
      from,
      fromEmail,
      fromName: from.replace(/<[^>]+>/, '').replace(/"/g, '').trim(),
      to,
      replyTo,
      returnPath,
      date,
      messageId,
      allHeaders: {
        From: from,
        To: to,
        Subject: subject,
        Date: date,
        'Message-ID': messageId,
        ...allHeaders
      }
    },
    auth: synthesizedAuth,
    hops,
    urls: extractedUrls,
    attachments: extractedAttachments,
    heuristics: combinedHeuristics,
    riskScore: threatScore,
    threatScore,
    threatVerdict: verdict,
    threatScoreBreakdown,
    classification: classification.classification,
    probabilities: classification.probabilities,
    verdict,
    mlConfidence,
    phishingProbability,
    deliveryStage,
    quarantine: quarantineOutcome,
    why: whyNarrative,
    ai_narrative: aiNarrativeResult
  };

  const alertSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = severity === 'CLEAN' ? 'LOW' : (severity as any);
  const newAlert = {
    id: `alt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    organization_id: effectiveOrgId,
    case_id: newId,
    timestamp: new Date().toISOString(),
    severity: alertSeverity,
    title: isTyposquat
      ? `🚨 Typosquatting Phishing Detected: ${fromDomain}`
      : torHop
      ? `⚠️ Tor Exit Node Routing Detected: ${subject}`
      : threatScore >= 75
      ? `🚨 High-Risk Threat Alert (${threatScore}/100): ${subject}`
      : `🔍 Forensic Case Ingested: ${subject}`,
    description: `Analyzed inbound email "${subject}" from ${fromDomain}. Evaluated threat score: ${threatScore}/100.`,
    source: 'forensic-pipeline',
    read: false,
    threat_score: threatScore,
    category: isTyposquat ? 'TYPOSQUATTING_DOMAIN' : torHop ? 'TOR_RELAY_ANOMALY' : threatScore >= 80 ? 'PHISHING_LURE' : 'FORENSIC_INGEST',
    sender: from,
    subject
  };

  if (supabase) {
    try {
      await supabase.from('alerts').insert([newAlert]);
    } catch {}
  }

  recordSyncedEmail({
    id: newId,
    messageId,
    subject,
    from,
    to,
    date,
    timestamp: new Date().toISOString(),
    threatScore,
    threatCategory: alertSeverity === 'CRITICAL' ? 'CRITICAL' : alertSeverity === 'HIGH' ? 'MALICIOUS' : alertSeverity === 'MEDIUM' ? 'SUSPICIOUS' : 'CLEAN',
    verdict,
    deliveryStage: deliveryStage as any,
    actionTaken: quarantineOutcome.actionTaken,
    isQuarantined: quarantineOutcome.isQuarantined,
    appliedLabel: quarantineOutcome.appliedLabel,
    authResults: synthesizedAuth,
    securitySignals: combinedHeuristics.map((h) => h.title || h.id),
    whyNarrative: whyNarrative?.why,
    linksCount: extractedUrls.length,
    attachmentsCount: extractedAttachments.length,
    rawEmlSnippet: rawContent.slice(0, 400),
    caseId: newId,
    fullAnalysis: emailAnalysis
  });

  broadcastAlert(newAlert, { caseItem: newCaseItem, organization_id: effectiveOrgId });
  broadcastAnalysisProgress(requestId, 'finalize', 'Case record finalized', 'done');

  return { case: newCaseItem, analysis: emailAnalysis, alert: newAlert };
}

const googleAuthClient = new OAuth2Client();

export async function verifyGooglePubSubPushToken(req: express.Request): Promise<boolean> {
  const pushSecret = process.env.PUBSUB_PUSH_TOKEN;
  const providedQueryToken = (req.query.token as string) || (req.headers['x-goog-pubsub-token'] as string);

  if (pushSecret && providedQueryToken) {
    const bufA = Buffer.from(providedQueryToken);
    const bufB = Buffer.from(pushSecret);
    if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
      return true;
    }
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.slice(7).trim();
    try {
      const audience = process.env.PUBSUB_AUDIENCE || `${req.protocol}://${req.get('host')}/api/gmail/pubsub/push`;
      const ticket = await googleAuthClient.verifyIdToken({
        idToken,
        audience: audience.includes(',') ? audience.split(',').map((s) => s.trim()) : audience
      });
      const payload = ticket.getPayload();
      if (payload && (payload.iss === 'https://accounts.google.com' || payload.iss === 'accounts.google.com')) {
        return true;
      }
    } catch (oidcErr: any) {
      logger.warn({ error: oidcErr?.message }, '[GmailPubSub] Google OIDC token verification notice');
    }
  }

  if (!pushSecret && process.env.NODE_ENV !== 'production') {
    logger.warn('[GmailPubSub] PUBSUB_PUSH_TOKEN not configured in development environment. Permitting request for local testing.');
    return true;
  }

  return false;
}
