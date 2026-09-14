import React, { useRef, useState } from 'react';
import { EmailAnalysis, EvidenceCardData } from '../types';
import { Printer, Copy, Check, ExternalLink, X, Tag, ChevronDown, ChevronUp, AlertCircle, AlertTriangle, Scale, ShieldAlert, CheckCircle2, Crosshair, Sparkles, AlertOctagon, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { sha256Sync, generateEvidenceId } from '../utils/crypto';
import { resolveOrigin, formatOriginLocation, formatOriginIp } from '../utils/originResolution';
import { extractRealSenderIp, formatRealSenderIp, formatRealSenderLocation } from '../utils/realSenderIp';
import { getStandardizedVerdict } from '../utils/verdict';
import { generateAttackNarrative } from '../utils/attackNarrative';
import { computeCounterfactuals, CounterfactualFactor } from '../utils/counterfactual';
import { mapComplianceFlags, ComplianceFlag } from '../utils/complianceMapping';
import { exportEvidenceAsPdf, exportEvidenceAsImage } from '../utils/exportEvidence';

/**
 * Pure mapping helper that converts an EmailAnalysis object to the EvidenceCardData schema.
 */
export function mapAnalysisToEvidenceCardData(analysis: EmailAnalysis): EvidenceCardData {
  const caseId = analysis.id || 'case-' + Date.now();
  const evidenceId = analysis.evidenceId || (analysis.id?.toUpperCase()?.startsWith('SAMPLE-') 
    ? `EV-${analysis.id.replace('sample-', '').toUpperCase()}` 
    : (analysis.id?.startsWith('case-') ? `EV-${analysis.id.slice(5, 11).toUpperCase()}` : generateEvidenceId()));
    
  const timestamp = analysis.headers?.date || analysis.analyzedAt || analysis.date || new Date().toUTCString();
  
  const fromDisplay = analysis.headers?.from || analysis.from || analysis.headers?.fromEmail || 'unknown@sender.corp';
  const fromEmail = analysis.headers?.fromEmail || analysis.from || '';
  const fromDomain = fromEmail.includes('@') ? fromEmail.split('@')[1].replace(/[<>]/g, '').trim() : '';
  
  const returnPath = analysis.headers?.returnPath || analysis.returnPath || '';
  const returnPathDomain = returnPath.includes('@') ? returnPath.split('@')[1].replace(/[<>]/g, '').trim() : '';
  const returnPathMismatch = Boolean(returnPath && fromDomain && returnPathDomain && !returnPathDomain.includes(fromDomain) && !fromDomain.includes(returnPathDomain));

  const replyTo = analysis.headers?.replyTo || analysis.replyTo || '';
  const replyToDomain = replyTo.includes('@') ? replyTo.split('@')[1].replace(/[<>]/g, '').trim() : '';
  const replyToMismatch = Boolean(replyTo && fromDomain && replyToDomain && !replyToDomain.includes(fromDomain) && !fromDomain.includes(replyToDomain));

  const rawSubject = analysis.headers?.subject || analysis.subject || analysis.name || '(No Subject)';
  const subjectDisplay = rawSubject.startsWith('"') && rawSubject.endsWith('"') ? rawSubject : `"${rawSubject}"`;

  // Standardized verdict, threat score, and status resolution from backend
  const stdVerdict = getStandardizedVerdict(analysis);
  const threatScore = stdVerdict.score;
  const stampWord = stdVerdict.stamp.word;
  const stampStatus = stdVerdict.stamp.status;
  const trustScoreLabel = stdVerdict.trustScoreLabel;

  // Identity Rows
  const identityRows = [
    { k: 'FROM', v: fromDisplay, status: '' },
    { k: 'RETURN-PATH', v: returnPath || fromDisplay, status: returnPathMismatch ? 'bad' : '' },
    { k: 'REPLY-TO', v: replyTo || fromDisplay, status: replyToMismatch ? 'bad' : '' }
  ];

  // Auth Checks
  const spfStatus = (analysis.auth?.spf?.status || analysis.authResults?.spf?.status || (stampStatus === 'good' ? 'PASS' : 'FAIL')).toUpperCase();
  const dkimStatus = (analysis.auth?.dkim?.status || analysis.authResults?.dkim?.status || (stampStatus === 'good' ? 'PASS' : 'FAIL')).toUpperCase();
  const dmarcStatus = (analysis.auth?.dmarc?.status || analysis.authResults?.dmarc?.status || (stampStatus === 'good' ? 'PASS' : 'FAIL')).toUpperCase();

  const checks = [
    { 
      label: 'SPF', 
      value: spfStatus, 
      status: spfStatus === 'PASS' ? 'pass' : (spfStatus === 'NEUTRAL' || spfStatus === 'SOFTFAIL' || spfStatus === 'NONE') ? 'warn' : 'fail' 
    },
    { 
      label: 'DKIM', 
      value: dkimStatus, 
      status: dkimStatus === 'PASS' ? 'pass' : (dkimStatus === 'NONE' || dkimStatus === 'NEUTRAL') ? 'warn' : 'fail' 
    },
    { 
      label: 'DMARC', 
      value: dmarcStatus, 
      status: dmarcStatus === 'PASS' ? 'pass' : (dmarcStatus === 'NONE') ? 'warn' : 'fail' 
    }
  ];

  // Origin Hop using centralized zero-fake-data resolver
  const origin = resolveOrigin(analysis.hops);
  const originIp = formatOriginIp(origin);
  const originLocationStr = formatOriginLocation(origin);
  const mapsUrl = origin.resolved && origin.lat != null && origin.lng != null
    ? `https://www.google.com/maps?q=${origin.lat},${origin.lng}`
    : undefined;

  const matchedOriginHop = origin.resolved ? analysis.hops?.find(h => h.fromIp === origin.ip) : undefined;
  const isTor = Boolean(matchedOriginHop?.is_tor || matchedOriginHop?.reverseDns?.includes('tor'));
  const torRdns = matchedOriginHop?.reverseDns || 'No PTR record';
  const abuseScore = origin.resolved ? (matchedOriginHop?.abuseScore ?? 0) : 0;

  // Real human sender (client) IP — distinct from the "Origin Relay IP" above, which is
  // the sending domain's own registered outbound mail server/infra IP. Only populated
  // when the sending platform actually disclosed it (e.g. X-Originating-IP). Never fabricated.
  const realSender = analysis.realSenderIp?.resolved
    ? analysis.realSenderIp
    : extractRealSenderIp(analysis.headers?.allHeaders);
  const realSenderIpStr = formatRealSenderIp(realSender, fromDomain);
  const realSenderLocStr = formatRealSenderLocation(realSender, fromDomain);

  // Relay Chain
  let chainString = '';
  if (analysis.hops && analysis.hops.length > 0) {
    const hopPieces = analysis.hops.map((h, i) => {
      const ip = h.fromIp || `hop-${i+1}`;
      const cc = h.countryCode || (h.isPrivate ? 'LAN' : 'EXT');
      const ispShort = h.isp ? `, ${h.isp.split(' ')[0]}` : (h.org ? `, ${h.org.split(' ')[0]}` : '');
      return `${ip} (${cc}${ispShort})`;
    });
    chainString = hopPieces.join(' <span class="arrow">→</span> ') + ` · ${analysis.hops.length} hops traced`;
  } else {
    chainString = 'No relay hops recorded in message headers';
  }

  // Domain Intel
  const domIntel = analysis.domain_intelligence || analysis.domainIntelligence;
  const targetDomain = domIntel?.domain || fromDomain || returnPathDomain || 'UNKNOWN';
  const domainAge = domIntel?.domain_age_days !== undefined
    ? `${domIntel.domain_age_days} days old` 
    : (domIntel?.created_date ? domIntel.created_date : 'UNKNOWN');
  const registrar = domIntel?.registrar || domIntel?.rdap?.registrar || 'UNKNOWN / NOT RESOLVED';
  const isTyposquat = Boolean(domIntel?.is_typosquat || domIntel?.typosquatting?.is_typosquat);
  const typosquatTarget = domIntel?.typosquat_matched_brand || domIntel?.typosquatting?.target_brand || null;

  const domainFlags: Array<{ text: string; level: 'red' | 'amber' | 'green' }> = [];
  if (isTyposquat && typosquatTarget) {
    domainFlags.push({ text: `LOOKALIKE BRAND: ${typosquatTarget}`, level: 'red' });
  }
  if (domIntel?.dns?.mx_records !== undefined && domIntel.dns.mx_records.length === 0) {
    domainFlags.push({ text: 'NO MX RECORD', level: 'amber' });
  }
  if (domIntel?.dns?.spf === null || domIntel?.dns?.spf === '') {
    domainFlags.push({ text: 'NO SPF RECORD', level: 'amber' });
  }
  if (domainFlags.length === 0 && domIntel?.domain) {
    domainFlags.push({ text: 'DOMAIN ENRICHED', level: 'green' });
  } else if (!domIntel?.domain) {
    domainFlags.push({ text: 'DOMAIN UNRESOLVED', level: 'amber' });
  }

  // AI Narrative Excerpt
  const rawNarrative = analysis.ai_narrative?.narrative || analysis.aiNarrative?.narrative || analysis.summary || 
    'Automated forensic evaluation completed.';
  const narrativeExcerpt = rawNarrative.length > 280 ? rawNarrative.slice(0, 275).trim() + '...' : rawNarrative;
  const aiEngine = analysis.ai_narrative?.model ? analysis.ai_narrative.model : 'Heuristic & Cryptographic Engine';

  // Findings: URLs & Attachments
  const findings: Array<{ label: string; badge: string; status: 'mal' | 'clean' | 'warn' }> = [];
  if (analysis.urls && analysis.urls.length > 0) {
    analysis.urls.slice(0, 4).forEach(u => {
      const cleanUrl = u.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const vtScoreStr = (u.virustotalScore || '').toLowerCase();
      const isUnchecked = !u.virustotalScore || vtScoreStr.includes('inactive') || vtScoreStr.includes('unconfigured') || vtScoreStr.includes('dormant') || vtScoreStr.includes('unindexed');
      const isMal = u.status === 'MALICIOUS' || (Boolean(u.virustotalScore) && !isUnchecked && !u.virustotalScore.startsWith('0/'));
      const isClean = u.status === 'CLEAN' || (Boolean(u.virustotalScore) && u.virustotalScore.startsWith('0/'));
      findings.push({
        label: cleanUrl.length > 35 ? cleanUrl.slice(0, 32) + '...' : cleanUrl,
        badge: u.virustotalScore || (u.status ? u.status : 'INSPECTED'),
        status: isMal ? 'mal' : isClean ? 'clean' : 'warn'
      });
    });
  }

  if (analysis.attachments && analysis.attachments.length > 0) {
    analysis.attachments.slice(0, 2).forEach(att => {
      const vtDetStr = (att.vtDetection || '').toLowerCase();
      const isUnchecked = !att.vtDetection || vtDetStr.includes('inactive') || vtDetStr.includes('unconfigured') || vtDetStr.includes('dormant') || vtDetStr.includes('unindexed');
      const isMal = att.status === 'MALICIOUS' || (Boolean(att.vtDetection) && !isUnchecked && !att.vtDetection.startsWith('0/'));
      findings.push({
        label: att.filename,
        badge: att.vtDetection ? att.vtDetection.split(' ')[0] : (att.status === 'MALICIOUS' ? 'FLAGGED' : 'CLEAN'),
        status: isMal ? 'mal' : (att.status === 'CLEAN' ? 'clean' : 'warn')
      });
    });
  }

  if (findings.length === 0) {
    findings.push({
      label: 'No suspicious URLs or embedded attachments detected',
      badge: 'CLEAN',
      status: 'clean'
    });
  }

  // ML Score & Confidence (Strictly authentic; never fabricate or substitute threat score)
  const hasValidMlConfidence = typeof analysis.mlConfidence === 'number' && !isNaN(analysis.mlConfidence) && analysis.mlConfidence >= 0;
  const mlPercentNum = hasValidMlConfidence 
    ? (analysis.mlConfidence <= 1 ? analysis.mlConfidence * 100 : analysis.mlConfidence)
    : null;
  const mlPercentText = mlPercentNum !== null ? `${mlPercentNum.toFixed(1)}%` : 'ML confidence unavailable';
  const mlResultLabel = analysis.classification || (stampWord === 'PHISH' ? 'phish' : stampWord.toLowerCase());

  // Hash & SOC Recommendation (Compute hash strictly from real RFC 822 email payload bytes; no fabrication)
  const rawBytes = analysis.rawEml || (analysis as any).rawEmail;
  const rawHash = analysis.sha256 || analysis.sha256Hash || analysis.custodyHash || (rawBytes ? sha256Sync(rawBytes) : null);
  const fullHash = rawHash || 'Hash unavailable — raw message not retained';
  const shortHash = rawHash 
    ? (rawHash.length > 26 ? `${rawHash.slice(0, 19)}...${rawHash.slice(-4)}` : rawHash)
    : 'Hash unavailable — raw message not retained';
  
  const socAction = stdVerdict.recommendedAction;

  // Deep Analysis Modules
  const attackNarrative = generateAttackNarrative(analysis);
  const counterfactuals = computeCounterfactuals(analysis);
  const complianceFlags = mapComplianceFlags(analysis);
  const senderBaselineAnomaly = analysis.senderBaselineAnomaly ||
    analysis.correlationEvidence?.find(c => c.rule === 'SENDER_BASELINE_ANOMALY')?.description ||
    analysis.heuristics?.find(h => h.id === 'SENDER_BASELINE_ANOMALY' || h.title?.toLowerCase().includes('sender baseline'))?.description ||
    null;

  return {
    caseId,
    evidenceId,
    timestamp,
    verdict: {
      text: stampWord,
      status: stampStatus,
      scoreLabel: trustScoreLabel
    },
    subject: subjectDisplay,
    identityRows,
    checks,
    origin: {
      sectionTitle: 'ORIGIN & SENDER IP',
      ip: originIp,
      ipStatus: (abuseScore > 50 || isTor) ? 'bad' : 'good',
      location: originLocationStr,
      mapsUrl,
      extraRows: [
        ...(isTor ? [{ k: 'TOR EXIT', v: `ACTIVE — ${torRdns}`, status: 'bad' }] : []),
        { k: 'ABUSEIPDB', v: `${abuseScore} / 100 blacklisted`, status: abuseScore > 50 ? 'bad' : abuseScore > 20 ? 'warn' : 'good' },
        {
          k: 'REAL SENDER IP',
          v: realSender.resolved ? `${realSenderIpStr} (via ${realSender.ipSource})` : realSenderIpStr,
          status: realSender.resolved ? (realSender.isProxyOrVpn || realSender.isTor ? 'bad' : 'good') : ''
        },
        {
          k: 'SENDER GEOLOCATION',
          v: realSenderLocStr,
          status: realSender.resolved ? '' : ''
        }
      ]
    },
    relay: {
      chain: chainString,
      graphUrl: 'https://tracexmail.vercel.app'
    },
    entity: {
      sectionTitle: 'DOMAIN INTELLIGENCE',
      rows: [
        { k: 'DOMAIN', v: targetDomain, status: isTyposquat ? 'bad' : '' },
        { k: 'REGISTERED', v: domainAge, status: domainAge === 'UNKNOWN' ? '' : 'warn' },
        { k: 'REGISTRAR', v: registrar, status: '' }
      ],
      flags: domainFlags
    },
    aiSummary: {
      text: narrativeExcerpt,
      engine: aiEngine,
      fullUrl: '#'
    },
    findings,
    score: {
      label: analysis.activeClassifier === 'logistic_regression'
        ? '5-Class Softmax Logistic Regression'
        : '5-Class Centroid-Cosine Classifier',
      percent: mlPercentNum,
      resultText: mlPercentText,
      resultLabel: mlResultLabel,
      good: stampStatus === 'good'
    },
    footer: {
      hashLabel: 'SHA-256',
      hash: shortHash,
      actionLabel: 'SOC action:',
      action: socAction,
      actionGood: stampStatus === 'good'
    },
    threatScoreBreakdown: analysis.threatScoreBreakdown,
    senderBaselineAnomaly,
    deepAnalysis: {
      attackNarrative,
      counterfactuals,
      complianceFlags,
      senderBaselineAnomaly
    }
  };
}

export interface EvidenceCardProps {
  data?: EvidenceCardData;
  analysis?: EmailAnalysis;
  onNavigateToMap?: () => void;
  onNavigateToGraph?: () => void;
  onOpenNarrative?: () => void;
  onClose?: () => void;
  isModal?: boolean;
}

export function EvidenceTagCard({
  data: directData,
  analysis,
  onNavigateToMap,
  onNavigateToGraph,
  onOpenNarrative,
  onClose,
  isModal = false
}: EvidenceCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [deepAnalysisOpen, setDeepAnalysisOpen] = useState(false);
  const [showAllCounterfactuals, setShowAllCounterfactuals] = useState(false);
  const [attackStoryOpen, setAttackStoryOpen] = useState(true);
  const [counterfactualsOpen, setCounterfactualsOpen] = useState(true);
  const [complianceOpen, setComplianceOpen] = useState(true);
  const [senderAnomalyOpen, setSenderAnomalyOpen] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);

  // Compute final case card data from analysis or direct data prop
  const cardData: EvidenceCardData = directData || (analysis ? mapAnalysisToEvidenceCardData(analysis) : {
    caseId: 'NO-CASE-SELECTED',
    evidenceId: 'EVD-PENDING',
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
    verdict: { text: 'PENDING', status: 'good', scoreLabel: 'N/A' },
    subject: 'No Email Evidence Loaded',
    identityRows: [
      { k: 'FROM', v: 'Awaiting Ingestion', status: '' },
      { k: 'RETURN-PATH', v: 'Awaiting Ingestion', status: '' },
      { k: 'REPLY-TO', v: 'Awaiting Ingestion', status: '' }
    ],
    checks: [
      { label: 'SPF', value: 'UNKNOWN', status: 'pass' },
      { label: 'DKIM', value: 'UNKNOWN', status: 'pass' },
      { label: 'DMARC', value: 'UNKNOWN', status: 'pass' }
    ],
    origin: {
      sectionTitle: 'ORIGIN & RELAY',
      ip: 'UNKNOWN',
      ipStatus: 'good',
      location: 'Unresolved Infrastructure',
      mapsUrl: '#',
      extraRows: [
        { k: 'ENRICHMENT', v: 'Awaiting RFC 822 EML ingestion', status: '' }
      ]
    },
    relay: {
      chain: 'No relay hops recorded in message headers'
    },
    entity: {
      sectionTitle: 'DOMAIN INTELLIGENCE',
      rows: [
        { k: 'DOMAIN', v: 'UNKNOWN', status: '' },
        { k: 'REGISTERED', v: 'UNKNOWN', status: '' },
        { k: 'REGISTRAR', v: 'UNKNOWN', status: '' }
      ],
      flags: [
        { text: 'AWAITING INGESTION', level: 'amber' }
      ]
    },
    aiSummary: {
      text: 'No active email analysis loaded. Select a case from Case Management or upload an RFC 822 EML file to inspect forensic telemetry.',
      engine: 'TraceXMail Forensic Core'
    },
    findings: [
      { label: 'No artifacts loaded', badge: 'PENDING', status: 'clean' }
    ],
    score: {
      label: '5-Class Nearest Centroid Classifier',
      percent: null,
      resultText: 'ML confidence unavailable',
      resultLabel: 'pending',
      good: true
    },
    footer: {
      hashLabel: 'SHA-256',
      hash: 'Hash unavailable — raw message not retained',
      actionLabel: 'SOC action:',
      action: 'AWAITING INGESTION',
      actionGood: true
    }
  });

  // Deep analysis data derivation
  const attackNarrative = cardData.deepAnalysis?.attackNarrative || (analysis ? generateAttackNarrative(analysis) : undefined);
  const counterfactuals: CounterfactualFactor[] = cardData.deepAnalysis?.counterfactuals || (analysis ? computeCounterfactuals(analysis) : []);
  const complianceFlags: ComplianceFlag[] = cardData.deepAnalysis?.complianceFlags || (analysis ? mapComplianceFlags(analysis) : []);
  const senderAnomaly = cardData.deepAnalysis?.senderBaselineAnomaly ||
    cardData.senderBaselineAnomaly ||
    analysis?.senderBaselineAnomaly ||
    analysis?.correlationEvidence?.find(c => c.rule === 'SENDER_BASELINE_ANOMALY')?.description ||
    analysis?.heuristics?.find(h => h.id === 'SENDER_BASELINE_ANOMALY' || h.title?.toLowerCase().includes('sender baseline'))?.description ||
    null;

  // Calculate one-line teaser summary for collapsed state (Real counts only)
  const indicatorCount = (analysis?.heuristics || []).filter(h => h.triggered).length || (cardData.findings || []).filter(f => f.status === 'mal').length || 0;
  const indicatorText = indicatorCount === 0
    ? '0 attack indicators on record'
    : `${indicatorCount} attack indicator${indicatorCount === 1 ? '' : 's'}`;
  const complianceNames = complianceFlags.length > 0
    ? complianceFlags.map(f => f.regime.split('(')[0].replace(/§43A.*/, '§43A').trim()).slice(0, 2).join(', ')
    : 'None';
  const teaserSummary = `${indicatorText} · ${counterfactuals.length > 0 ? (showAllCounterfactuals ? `${counterfactuals.length} counterfactuals` : '1 counterfactual') : 'counterfactuals'} · compliance: ${complianceNames}${senderAnomaly ? ' · ⚠️ baseline anomaly' : ''}`;

  // Procedural barcode line widths
  const barcodeWidths = [3, 1, 2, 1, 4, 1, 1, 3, 2, 1, 1, 4, 2, 1, 3, 1, 2, 4, 1, 1, 2, 3, 1, 1, 4, 2, 1, 3, 1, 2, 1, 4, 1, 2, 3, 1, 1, 2, 4, 1];

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const filename = `TraceXMail-Evidence-${cardData.evidenceId || cardData.caseId || 'artifact'}.pdf`;
      await exportEvidenceAsPdf(cardRef.current!, filename, {
        caseId: cardData.caseId,
        evidenceId: cardData.evidenceId,
        title: cardData.subject,
        analysis
      });
    } catch (err) {
      console.error('Failed to export Evidence as PDF:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportImage = async () => {
    setExportingImage(true);
    try {
      const filename = `TraceXMail-Evidence-${cardData.evidenceId || cardData.caseId || 'artifact'}.png`;
      await exportEvidenceAsImage(cardRef.current!, filename, {
        caseId: cardData.caseId,
        evidenceId: cardData.evidenceId,
        title: cardData.subject,
        analysis
      });
    } catch (err) {
      console.error('Failed to export Evidence as Image:', err);
    } finally {
      setExportingImage(false);
    }
  };

  const handleCopySummary = () => {
    const text = `TRACE-X EVIDENCE CARD: ${cardData.caseId}\nEvidence ID: ${cardData.evidenceId}\nTimestamp: ${cardData.timestamp}\nVerdict: ${cardData.verdict.text} (${cardData.verdict.scoreLabel})\nSubject: ${cardData.subject}\nChecks: ${cardData.checks.map(c => `${c.label}:${c.value}`).join(' | ')}\nOrigin: ${cardData.origin?.ip || ''} (${cardData.origin?.location || ''})\nSHA-256: ${cardData.footer?.hash || ''}\nSOC Action: ${cardData.footer?.action || ''}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenMaps = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigateToMap) {
      onNavigateToMap();
    } else if (cardData.origin?.mapsUrl) {
      window.open(cardData.origin.mapsUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenGraph = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigateToGraph) {
      onNavigateToGraph();
    }
  };

  const handleOpenNarrativeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onOpenNarrative) {
      onOpenNarrative();
    }
  };

  const stampClass = cardData.verdict.status === 'good' ? 'good' : cardData.verdict.status === 'warn' ? 'warn' : '';

  const cardHtml = (
    <div 
      ref={cardRef}
      id="card"
      className="evidence-card relative select-text"
    >
      {/* Folder Tab Header */}
      <div className="tab">
        <div className="caseid">
          CASE <b>{cardData.caseId}</b>
        </div>
        <div className="meta">
          {cardData.evidenceId} · {cardData.timestamp}
        </div>
      </div>

      {/* Main Body */}
      <div className="body">
        {/* Rubber-Stamp Verdict Badge */}
        <div className={`stamp ${stampClass}`}>
          {cardData.verdict.text}
          <small>{cardData.verdict.scoreLabel}</small>
        </div>

        {/* Subject */}
        <div className="subject">
          <h1>{cardData.subject}</h1>
        </div>

        {/* Identity Rows */}
        {cardData.identityRows.map((r, idx) => (
          <div key={idx} className="row">
            <div className="k">{r.k}</div>
            <div className={`v ${r.status || ''}`}>{r.v}</div>
          </div>
        ))}

        {/* Authentication Checks */}
        {cardData.checks && cardData.checks.length > 0 && (
          <>
            <div className="section-label">AUTHENTICATION</div>
            <div className="chips">
              {cardData.checks.map((c, idx) => (
                <div key={idx} className="chip">
                  <div className="label">{c.label}</div>
                  <div className={`val ${c.status}`}>{c.value}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Origin & Relay */}
        {cardData.origin && (
          <>
            <div className="section-label">{cardData.origin.sectionTitle || 'ORIGIN & RELAY'}</div>
            <div className="row">
              <div className="k">FIRST-HOP IP</div>
              <div className={`v ${cardData.origin.ipStatus || ''}`}>{cardData.origin.ip}</div>
            </div>

            <div className="row row-link">
              <div className="k">LOCATION</div>
              <div className="v">
                <span>{cardData.origin.location}</span>
                {cardData.origin.mapsUrl && (
                  <button 
                    onClick={handleOpenMaps}
                    className="inline-link"
                    title="Open Location in Geo Map View"
                  >
                    Maps ↗
                  </button>
                )}
              </div>
            </div>

            {cardData.origin.extraRows && cardData.origin.extraRows.map((r, idx) => (
              <div key={idx} className="row">
                <div className="k">{r.k}</div>
                <div className={`v ${r.status || ''}`}>{r.v}</div>
              </div>
            ))}
          </>
        )}

        {cardData.relay && (
          <div className="relay mt-1.5">
            <span 
              className="chain leading-relaxed" 
              dangerouslySetInnerHTML={{ __html: cardData.relay.chain }} 
            />
            <button 
              onClick={handleOpenGraph}
              className="inline-link shrink-0"
              title="Open Full Relationship Graph"
            >
              Full graph ↗
            </button>
          </div>
        )}

        {/* Domain Intelligence */}
        {cardData.entity && (
          <>
            <div className="section-label">{cardData.entity.sectionTitle || 'DOMAIN INTELLIGENCE'}</div>
            {cardData.entity.rows.map((r, idx) => (
              <div key={idx} className="row">
                <div className="k">{r.k}</div>
                <div className={`v ${r.status || ''}`}>{r.v}</div>
              </div>
            ))}
            {cardData.entity.flags && cardData.entity.flags.length > 0 && (
              <div className="flags">
                {cardData.entity.flags.map((f, idx) => (
                  <span 
                    key={idx} 
                    className={`flag ${f.level === 'amber' ? 'amber' : f.level === 'green' ? 'green' : ''}`}
                  >
                    {f.text}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {/* AI Case Summary */}
        {cardData.aiSummary && (
          <>
            <div className="section-label">AI CASE SUMMARY</div>
            <div className="ai-box">
              <p>{cardData.aiSummary.text}</p>
              <div className="meta-row">
                <span className="engine">{cardData.aiSummary.engine}</span>
                <button 
                  onClick={handleOpenNarrativeClick}
                  className="inline-link"
                  title="Inspect Full Forensic Narrative"
                >
                  Full narrative ↗
                </button>
              </div>
            </div>
          </>
        )}

        {/* Links & Attachments */}
        {cardData.findings && cardData.findings.length > 0 && (
          <>
            <div className="section-label">LINKS &amp; ATTACHMENTS</div>
            {cardData.findings.map((f, idx) => (
              <div key={idx} className="link-item">
                <span className="url" title={f.label}>{f.label}</span>
                <span className={`badge ${f.status}`}>{f.badge}</span>
              </div>
            ))}
          </>
        )}

        {/* ML Verdict */}
        {cardData.score && (
          <>
            <div className="section-label">ML VERDICT</div>
            <div className="gauge-wrap">
              <div className="gauge-top">
                <span>{cardData.score.label}</span>
                <span>
                  {cardData.score.percent != null ? (
                    <>
                      <b style={{ color: cardData.score.good ? 'var(--ec-green)' : 'var(--ec-red)' }}>
                        {cardData.score.resultText}
                      </b>{' '}
                      {cardData.score.resultLabel}
                    </>
                  ) : (
                    <span className="text-slate-400 font-mono text-xs">
                      {cardData.score.resultText}
                    </span>
                  )}
                </span>
              </div>
              {cardData.score.percent != null ? (
                <div className="gauge">
                  <div 
                    className={`gauge-fill ${cardData.score.good ? 'good' : ''}`}
                    style={{ width: `${Math.max(4, Math.min(100, cardData.score.percent))}%` }}
                  />
                </div>
              ) : (
                <div className="text-[10px] text-slate-500 font-mono italic mt-0.5">
                  ML confidence unavailable
                </div>
              )}
            </div>
          </>
        )}

        {/* Threat Score Breakdown */}
        {(cardData.threatScoreBreakdown || analysis?.threatScoreBreakdown) && (() => {
          const bd = cardData.threatScoreBreakdown || analysis?.threatScoreBreakdown;
          if (!bd || !bd.components) return null;
          return (
            <>
              <div className="section-label flex items-center justify-between">
                <span>THREAT SCORE BREAKDOWN</span>
                <button
                  type="button"
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="inline-link text-[10px]"
                >
                  {showBreakdown ? 'Hide ▲' : 'Details ▼'}
                </button>
              </div>
              <div className="p-2 bg-slate-900/50 rounded border border-slate-700/50 text-[11px] font-mono space-y-1.5">
                <div className="flex justify-between items-center text-slate-300 font-bold">
                  <span>Cumulative Threat Risk:</span>
                  <span className={bd.total >= 70 ? 'text-red-400' : bd.total >= 40 ? 'text-amber-400' : 'text-emerald-400'}>
                    {bd.total} / {bd.maxScore || 100}
                  </span>
                </div>
                {showBreakdown && (
                  <div className="space-y-1 pt-1 border-t border-slate-800 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Authentication:</span>
                      <span className={bd.components.authentication?.score > 0 ? 'text-red-400' : 'text-slate-300'}>
                        +{bd.components.authentication?.score ?? 0} pts
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Domain Intelligence:</span>
                      <span className={bd.components.domainRisk?.score > 0 ? 'text-red-400' : 'text-slate-300'}>
                        +{bd.components.domainRisk?.score ?? 0} pts
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Infrastructure:</span>
                      <span className={bd.components.infrastructureRisk?.score > 0 ? 'text-red-400' : 'text-slate-300'}>
                        +{bd.components.infrastructureRisk?.score ?? 0} pts
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">ML Content Classification:</span>
                      <span className={bd.components.mlClassification?.score > 0 ? 'text-red-400' : 'text-slate-300'}>
                        +{bd.components.mlClassification?.score ?? 0} pts
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Heuristics & Signals:</span>
                      <span className={bd.components.heuristics?.score > 0 ? 'text-red-400' : 'text-slate-300'}>
                        +{bd.components.heuristics?.score ?? 0} pts
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* Expandable Deep Analysis Section */}
        <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/80 overflow-hidden text-xs">
          {/* Main Deep Analysis Toggle Header */}
          <button
            type="button"
            onClick={() => setDeepAnalysisOpen(!deepAnalysisOpen)}
            className="w-full px-3 py-2 flex items-center justify-between bg-slate-800/60 hover:bg-slate-800 transition-colors text-left select-none cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="font-semibold text-slate-200">Deep Analysis</span>
              <span className="px-1.5 py-0.2 rounded bg-cyan-950/60 border border-cyan-800/80 text-[10px] text-cyan-400 font-mono">
                Forensic Lab
              </span>
              {!deepAnalysisOpen && (
                <span className="text-[10px] text-slate-400 font-mono truncate hidden sm:inline ml-1" title={teaserSummary}>
                  — {teaserSummary}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {deepAnalysisOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </div>
          </button>

          {/* Sub-teaser when collapsed on small screens */}
          {!deepAnalysisOpen && (
            <div className="px-3 py-1.5 text-[10px] font-mono text-slate-400 bg-slate-950/40 border-t border-slate-800/60 flex items-center justify-between sm:hidden">
              <span className="truncate">{teaserSummary}</span>
            </div>
          )}

          {/* Expanded Deep Analysis Body */}
          {deepAnalysisOpen && (
            <div className="p-3 space-y-3 border-t border-slate-800 text-slate-300">
              {/* 1. Attack Story Panel */}
              {attackNarrative && (
                <div className="rounded border border-slate-700/60 bg-slate-950/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAttackStoryOpen(!attackStoryOpen)}
                    className="w-full px-2.5 py-1.5 flex items-center justify-between bg-slate-800/40 hover:bg-slate-800/60 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <Crosshair className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="font-semibold text-[11px] text-slate-200">What likely happened</span>
                      <span className="text-[10px] text-slate-400 font-mono">(Attack Story)</span>
                    </div>
                    {attackStoryOpen ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                  </button>
                  {attackStoryOpen && (
                    <div className="p-2.5 border-t border-slate-800/60 text-slate-300 text-xs leading-relaxed font-sans">
                      <p>{attackNarrative}</p>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Counterfactual Panel */}
              {counterfactuals.length > 0 && (
                <div className="rounded border border-slate-700/60 bg-slate-950/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCounterfactualsOpen(!counterfactualsOpen)}
                    className="w-full px-2.5 py-1.5 flex items-center justify-between bg-slate-800/40 hover:bg-slate-800/60 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="font-semibold text-[11px] text-slate-200">Score Sensitivity &amp; Counterfactuals</span>
                      <span className="px-1 py-0.2 rounded bg-cyan-950/60 border border-cyan-800/60 text-[9px] text-cyan-300 font-mono">
                        {counterfactuals.length} Pillars
                      </span>
                    </div>
                    {counterfactualsOpen ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                  </button>

                  {counterfactualsOpen && (
                    <div className="p-2.5 border-t border-slate-800/60 space-y-2">
                      <div className="text-[10px] text-slate-400">
                        Simulated score &amp; verdict if individual forensic factors were reversed:
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] font-mono border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                              <th className="py-1 pr-2">Factor / Simulation</th>
                              <th className="py-1 px-2 text-right">Current</th>
                              <th className="py-1 pl-2 text-right">If Reversed</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {(showAllCounterfactuals ? counterfactuals : counterfactuals.slice(0, 1)).map((cf, idx) => {
                              const isLegit = cf.verdictIfFlipped === 'LEGITIMATE';
                              const isSusp = cf.verdictIfFlipped === 'SUSPICIOUS';
                              const badgeColor = isLegit
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                : isSusp
                                ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                                : 'bg-rose-950/80 text-rose-300 border-rose-700/60';

                              return (
                                <tr key={idx} className="hover:bg-slate-800/30">
                                  <td className="py-1.5 pr-2">
                                    <div className="font-semibold text-slate-200 flex items-center gap-1">
                                      <span>{cf.factor}</span>
                                      {cf.isDecisive && (
                                        <span className="px-1 py-0.2 rounded bg-amber-950/80 border border-amber-700/80 text-[9px] text-amber-300 font-sans font-normal">
                                          ★ Decisive
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-sans leading-tight mt-0.5">
                                      {cf.actionText}
                                    </div>
                                  </td>
                                  <td className="py-1.5 px-2 text-right align-top whitespace-nowrap">
                                    <span className={cf.currentContribution > 0 ? 'text-rose-400' : 'text-slate-400'}>
                                      {cf.currentContribution > 0 ? `+${cf.currentContribution}` : '0'} pts
                                    </span>
                                  </td>
                                  <td className="py-1.5 pl-2 text-right align-top whitespace-nowrap">
                                    <div className="font-bold text-slate-200">
                                      {cf.scoreIfFlipped}/100
                                    </div>
                                    <span className={`inline-block px-1 py-0.2 rounded border text-[9px] ${badgeColor} mt-0.5`}>
                                      {cf.verdictIfFlipped}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {counterfactuals.length > 1 && (
                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setShowAllCounterfactuals(!showAllCounterfactuals)}
                            className="inline-link text-[10px] font-mono cursor-pointer"
                          >
                            {showAllCounterfactuals
                              ? '▲ Show most decisive factor only'
                              : `▼ Show all ${counterfactuals.length} forensic pillars`}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 3. Compliance / Regulatory Mapping Panel */}
              {complianceFlags.length > 0 && (
                <div className="rounded border border-slate-700/60 bg-slate-950/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setComplianceOpen(!complianceOpen)}
                    className="w-full px-2.5 py-1.5 flex items-center justify-between bg-slate-800/40 hover:bg-slate-800/60 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="font-semibold text-[11px] text-slate-200">Regulatory &amp; Compliance Flags</span>
                      <span className="px-1 py-0.2 rounded bg-purple-950/60 border border-purple-800/60 text-[9px] text-purple-300 font-mono">
                        {complianceFlags.length}
                      </span>
                    </div>
                    {complianceOpen ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                  </button>

                  {complianceOpen && (
                    <div className="p-2.5 border-t border-slate-800/60 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {complianceFlags.map((flag, idx) => (
                          <div
                            key={idx}
                            className={`px-2 py-1.5 rounded border text-[11px] font-mono flex flex-col gap-0.5 ${flag.color || 'bg-slate-900 border-slate-700 text-slate-300'} w-full`}
                          >
                            <div className="font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              <span>{flag.regime}</span>
                            </div>
                            <div className="text-[10px] font-sans opacity-90 leading-tight">
                              {flag.reason}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. Sender Baseline Anomaly Panel (rendered ONLY if present) */}
              {senderAnomaly && (
                <div className="rounded border border-rose-800/70 bg-rose-950/30 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSenderAnomalyOpen(!senderAnomalyOpen)}
                    className="w-full px-2.5 py-1.5 flex items-center justify-between bg-rose-950/50 hover:bg-rose-950/70 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="font-semibold text-[11px] text-rose-300">Sender Baseline Anomaly</span>
                      <span className="px-1 py-0.2 rounded bg-rose-950 border border-rose-700 text-[9px] text-rose-300 font-mono">
                        Deviation
                      </span>
                    </div>
                    {senderAnomalyOpen ? <ChevronUp className="w-3 h-3 text-rose-400" /> : <ChevronDown className="w-3 h-3 text-rose-400" />}
                  </button>

                  {senderAnomalyOpen && (
                    <div className="p-2.5 border-t border-rose-900/60 text-xs text-rose-200 leading-relaxed font-sans">
                      <p>{typeof senderAnomaly === 'string' ? senderAnomaly : senderAnomaly.description}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Footer */}
      {cardData.footer && (
        <div className="footer">
          <div className="hashline">
            {cardData.footer.hashLabel}{' '}
            <b className={cardData.footer.hash.startsWith('Hash unavailable') ? 'font-normal text-slate-400 italic text-[11px]' : ''}>
              {cardData.footer.hash}
            </b>
          </div>
          {!cardData.footer.hash.startsWith('Hash unavailable') && (
            <div className="barcode" title={`Digest: ${cardData.footer.hash}`}>
              {barcodeWidths.map((w, idx) => (
                <div key={idx} style={{ width: `${w}px` }} />
              ))}
            </div>
          )}
          <div className="verdictline">
            <span>{cardData.footer.actionLabel}</span>
            <b className={cardData.footer.actionGood ? 'good' : ''}>{cardData.footer.action}</b>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150">
        <div className="flex flex-col items-center max-w-full my-auto">
          {/* Action Bar */}
          <div className="w-full max-w-[520px] flex items-center justify-between mb-3 px-1 text-xs">
            <div className="flex items-center gap-2 text-[#F2EFE7] font-mono font-medium">
              <span className="w-2 h-2 rounded-full bg-[#CC9A4A] animate-pulse" />
              <span>FORENSIC EVIDENCE CARD</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="px-2.5 py-1 rounded bg-[#CC9A4A]/20 hover:bg-[#CC9A4A]/30 border border-[#CC9A4A]/50 text-[#CC9A4A] hover:text-[#F2EFE7] text-[11px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Export Evidence Card as PDF Dossier"
              >
                {exportingPdf ? <Loader2 className="w-3 h-3 animate-spin text-[#CC9A4A]" /> : <FileText className="w-3 h-3 text-[#CC9A4A]" />}
                <span>{exportingPdf ? 'Saving PDF...' : 'PDF'}</span>
              </button>
              <button
                type="button"
                onClick={handleExportImage}
                disabled={exportingImage}
                className="px-2.5 py-1 rounded bg-blue-900/30 hover:bg-blue-800/40 border border-blue-700/60 text-blue-300 hover:text-white text-[11px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Export Evidence Card as High-Res PNG Image"
              >
                {exportingImage ? <Loader2 className="w-3 h-3 animate-spin text-blue-400" /> : <ImageIcon className="w-3 h-3 text-blue-400" />}
                <span>{exportingImage ? 'Saving PNG...' : 'Image'}</span>
              </button>
              <button
                type="button"
                onClick={handleCopySummary}
                className="px-2.5 py-1 rounded bg-[#171B24] hover:bg-[#2B3140] border border-[#2B3140] text-[#F2EFE7] text-[11px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Copy Text Summary"
              >
                {copied ? <Check className="w-3 h-3 text-[#3FCC93]" /> : <Copy className="w-3 h-3 text-[#CC9A4A]" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-2.5 py-1 rounded bg-[#171B24] hover:bg-[#2B3140] border border-[#2B3140] text-[#F2EFE7] text-[11px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Print Evidence Tag Card"
              >
                <Printer className="w-3 h-3 text-[#F2EFE7]" />
                <span>Print</span>
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded bg-[#171B24] hover:bg-[#2B3140] border border-[#2B3140] text-[#7C8494] hover:text-[#F2EFE7] transition-colors cursor-pointer"
                  title="Close Card View"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Render Card */}
          {cardHtml}
        </div>
      </div>
    );
  }

  return cardHtml;
}

// Alias exports for flexibility
export const EvidenceCard = EvidenceTagCard;
export default EvidenceTagCard;
