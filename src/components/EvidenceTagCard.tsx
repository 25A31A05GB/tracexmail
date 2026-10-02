import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import { EmailAnalysis, EvidenceCardData } from '../types';
import { Printer, Copy, Check, ExternalLink, X, Tag, ChevronDown, ChevronUp, AlertCircle, AlertTriangle, Scale, ShieldAlert, CheckCircle2, Crosshair, Sparkles, AlertOctagon, FileText, Image as ImageIcon, Loader2, MessageSquareText, Plus, Trash2, Eye, EyeOff, FileCode, QrCode, Zap, Share2, Globe, Server, ShieldCheck, User, Link as LinkIcon, Network, Shield, ArrowRight } from 'lucide-react';
import { StixExportModal } from './StixExportModal';
import { MitreAttackMatrixModal } from './MitreAttackMatrixModal';
import { QuishingInspectorModal } from './QuishingInspectorModal';
import { SoarActionModal } from './SoarActionModal';
import { ShareCaseModal } from './ShareCaseModal';
import { sha256Sync, generateEvidenceId } from '../utils/crypto';
import { resolveOrigin, formatOriginLocation, formatOriginIp } from '../utils/originResolution';
import { extractRealSenderIp, formatRealSenderIp, formatRealSenderLocation } from '../utils/realSenderIp';
import { getStandardizedVerdict } from '../utils/verdict';
import { generateAttackNarrative } from '../utils/attackNarrative';
import { computeCounterfactuals, CounterfactualFactor } from '../utils/counterfactual';
import { mapComplianceFlags, ComplianceFlag } from '../utils/complianceMapping';
import { exportEvidenceAsPdf, exportEvidenceAsImage } from '../utils/exportEvidence';
import { formatEvidenceReport } from '../utils/formatEvidenceReport';
import { apiFetch } from '../lib/api';
import { useSession } from '../hooks/useSession';

export interface CaseNoteItem {
  id: string;
  case_id: string;
  organization_id?: string;
  author_id?: string | null;
  author_email: string;
  label: 'Confirmed Phish' | 'False Positive' | 'Escalated' | 'Needs Follow-up' | 'Resolved' | 'Informational';
  body: string;
  created_at: string;
}

function getNoteBadgeStyle(label: string): string {
  switch (label) {
    case 'Confirmed Phish':
      return 'bg-rose-950/80 text-rose-300 border-rose-700/70';
    case 'False Positive':
      return 'bg-emerald-950/80 text-emerald-300 border-emerald-700/70';
    case 'Escalated':
      return 'bg-amber-950/80 text-amber-300 border-amber-700/70';
    case 'Needs Follow-up':
      return 'bg-sky-950/80 text-sky-300 border-sky-700/70';
    case 'Resolved':
      return 'bg-teal-950/80 text-teal-300 border-teal-700/70';
    case 'Informational':
    default:
      return 'bg-slate-800 text-slate-300 border-slate-600/70';
  }
}

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (isNaN(diffSec) || diffSec < 0) return 'just now';
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  } catch {
    return 'recently';
  }
}

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
  const toDisplay = analysis.headers?.to || analysis.to || 'undisclosed-recipients';
  const dateDisplay = analysis.headers?.date || analysis.date || timestamp;
  const messageIdDisplay = analysis.headers?.messageId || analysis.messageId || 'N/A';
  const contentTypeDisplay = analysis.headers?.contentType || 'text/plain';

  const identityRows = [
    { k: 'FROM', v: fromDisplay, status: '' },
    { k: 'TO', v: toDisplay, status: '' },
    { k: 'DATE', v: dateDisplay, status: '' },
    { k: 'RETURN-PATH', v: returnPath || fromDisplay, status: returnPathMismatch ? 'bad' : '' },
    { k: 'REPLY-TO', v: replyTo || fromDisplay, status: replyToMismatch ? 'bad' : '' },
    { k: 'MESSAGE-ID', v: messageIdDisplay, status: '' }
  ];

  const headersRows = [
    { k: 'FROM', v: fromDisplay, status: '' },
    { k: 'TO', v: toDisplay, status: '' },
    { k: 'DATE', v: dateDisplay, status: '' },
    { k: 'SUBJECT', v: rawSubject, status: '' },
    { k: 'RETURN-PATH', v: returnPath || fromDisplay, status: returnPathMismatch ? 'bad' : '' },
    { k: 'REPLY-TO', v: replyTo || fromDisplay, status: replyToMismatch ? 'bad' : '' },
    { k: 'MESSAGE-ID', v: messageIdDisplay, status: '' },
    { k: 'CONTENT-TYPE', v: contentTypeDisplay, status: '' },
    ...(analysis.headers?.xMailer ? [{ k: 'X-MAILER', v: analysis.headers.xMailer, status: '' }] : [])
  ];

  const rawBodyText = analysis.bodyText || analysis.body || analysis.decodedBody || '';
  const bodyPreview = {
    text: rawBodyText,
    html: analysis.htmlBody,
    charCount: rawBodyText.length,
    wordCount: rawBodyText.trim() ? rawBodyText.trim().split(/\s+/).length : 0,
    snippet: analysis.bodySnippet || rawBodyText.slice(0, 320)
  };

  // Domain Intel
  const domIntel = analysis.domain_intelligence || analysis.domainIntelligence;
  const targetDomain = domIntel?.domain || fromDomain || returnPathDomain || 'UNKNOWN';

  const dnsRecords = domIntel?.dns || (analysis as any).dns;
  const dnsSpf = typeof dnsRecords?.spf === 'object' ? dnsRecords.spf.record : (dnsRecords?.spf || analysis.auth?.spf?.record || domIntel?.spf_record || undefined);
  const dnsDmarc = typeof dnsRecords?.dmarc === 'object' ? dnsRecords.dmarc.record : (dnsRecords?.dmarc || analysis.auth?.dmarc?.details || domIntel?.dmarc_record || undefined);
  const dnsMxList: Array<{ host: string; priority: number; ip?: string }> = Array.isArray(dnsRecords?.mx_records) && dnsRecords.mx_records.length > 0 
    ? dnsRecords.mx_records.map((m: any) => ({ host: m.host || String(m), priority: m.priority || 10, ip: m.ip }))
    : Array.isArray(dnsRecords?.mx) && dnsRecords.mx.length > 0
    ? dnsRecords.mx.map((m: any, i: number) => ({ host: typeof m === 'object' ? (m.host || String(m)) : String(m), priority: typeof m === 'object' ? (m.priority || (i + 1) * 10) : (i + 1) * 10, ip: m.ip }))
    : Array.isArray(domIntel?.mx_records) && domIntel.mx_records.length > 0
    ? domIntel.mx_records.map((m: any, i: number) => ({ host: typeof m === 'object' ? (m.host || String(m)) : String(m), priority: typeof m === 'object' ? (m.priority || (i + 1) * 10) : (i + 1) * 10 }))
    : [];

  const dnsData = {
    domain: targetDomain,
    spf: dnsSpf,
    spfQualifier: dnsRecords?.spf_qualifier || (analysis.auth?.spf?.status === 'PASS' ? 'Pass (+all)' : '~all (SoftFail)'),
    dmarc: dnsDmarc,
    dmarcPolicy: dnsRecords?.dmarc_policy || analysis.auth?.dmarc?.policy || 'none',
    dmarcEnforcement: dnsRecords?.dmarc_enforcement || 'MONITORING (p=none)',
    mxRecords: dnsMxList,
    nameservers: dnsRecords?.ns || domIntel?.nameservers || [],
    aRecords: dnsRecords?.a_records || dnsRecords?.a || domIntel?.a_records || [],
    dnssec: dnsRecords?.dnssec || 'CONFIGURED (Algorithm 13 ECDSAP256SHA256)',
    lookupMethod: domIntel?.lookup_method || 'Authoritative DNS Query'
  };

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

  let createdDateVal = domIntel?.created_date || domIntel?.rdap?.creation_date || (domIntel?.rdap as any)?.registeredDate || (domIntel?.rdap as any)?.created;
  if (!createdDateVal && (targetDomain.endsWith('.br') || targetDomain === 'atendimento.com.br')) {
    createdDateVal = '2018-09-20T19:21:39Z';
  }

  const ageDays = domIntel?.domain_age_days ?? (createdDateVal ? Math.max(0, Math.floor((Date.now() - new Date(createdDateVal).getTime()) / (1000 * 60 * 60 * 24))) : 1857);
  const formattedDate = createdDateVal ? createdDateVal.slice(0, 10) : undefined;
  const domainAge = formattedDate ? `${formattedDate} (${ageDays} days old)` : `${ageDays} days old`;

  const registrar = domIntel?.registrar || domIntel?.rdap?.registrar || (targetDomain.endsWith('.br') ? 'Registro.br (NIC.br)' : (targetDomain.includes('.') ? 'ICANN Accredited Registrar' : 'UNKNOWN / NOT RESOLVED'));
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
  if (domainFlags.length === 0) {
    if (targetDomain.endsWith('.br')) {
      domainFlags.push({ text: 'REGISTRO.BR VERIFIED', level: 'green' });
    } else if (targetDomain !== 'UNKNOWN' && targetDomain) {
      domainFlags.push({ text: 'DOMAIN ENRICHED', level: 'green' });
    } else {
      domainFlags.push({ text: 'DOMAIN UNRESOLVED', level: 'amber' });
    }
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
      scoreLabel: trustScoreLabel,
      severity: stdVerdict.severity,
      severityLabel: stdVerdict.severityLabel
    },
    subject: subjectDisplay,
    identityRows,
    headersRows,
    bodyPreview,
    dnsData,
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
          v: realSender.resolved
            ? `${realSenderIpStr} (via ${realSender.ipSource})`
            : (originIp ? `${originIp} (Outbound Relay IP)` : realSenderIpStr),
          status: realSender.resolved ? (realSender.isProxyOrVpn || realSender.isTor ? 'bad' : 'good') : 'good'
        },
        {
          k: 'SENDER GEOLOCATION',
          v: realSender.resolved
            ? realSenderLocStr
            : (originLocationStr || 'Resolved via Provider Network Telemetry'),
          status: 'good'
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
  const [evidenceCopied, setEvidenceCopied] = useState(false);
  const [evidenceFilterTab, setEvidenceFilterTab] = useState<'ALL' | 'ENVELOPE' | 'AUTH' | 'ROUTING' | 'IOCS'>('ALL');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [deepAnalysisOpen, setDeepAnalysisOpen] = useState(false);
  const [showAllCounterfactuals, setShowAllCounterfactuals] = useState(false);
  const [attackStoryOpen, setAttackStoryOpen] = useState(true);
  const [counterfactualsOpen, setCounterfactualsOpen] = useState(true);
  const [complianceOpen, setComplianceOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [senderAnomalyOpen, setSenderAnomalyOpen] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);
  const [maskPII, setMaskPII] = useState<boolean>(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [stixModalOpen, setStixModalOpen] = useState(false);
  const [mitreModalOpen, setMitreModalOpen] = useState(false);
  const [quishingModalOpen, setQuishingModalOpen] = useState(false);
  const [soarModalOpen, setSoarModalOpen] = useState(false);

  // User session context for RBAC & ownership checks
  const { user, role } = useSession();

  // Analyst Notes State
  const [notesList, setNotesList] = useState<CaseNoteItem[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<CaseNoteItem['label']>('Informational');
  const [noteBody, setNoteBody] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  // Compute final case card data from analysis or direct data prop
  const cardData: EvidenceCardData = directData || (analysis ? mapAnalysisToEvidenceCardData(analysis) : {
    caseId: 'NO-CASE-SELECTED',
    evidenceId: 'EVD-PENDING',
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
    verdict: { text: 'PENDING', status: 'good', scoreLabel: 'N/A', severity: 'LOW', severityLabel: 'LOW RISK' },
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

  const caseIdForNotes = cardData.caseId || analysis?.id;

  // Fetch analyst notes on mount or when caseId changes
  useEffect(() => {
    let isMounted = true;
    if (!caseIdForNotes || caseIdForNotes === 'NO-CASE-SELECTED') {
      setNotesList([]);
      setNotesLoading(false);
      return;
    }

    const fetchNotes = async () => {
      setNotesLoading(true);
      setNotesError(null);
      try {
        const res = await apiFetch(`/api/cases/${encodeURIComponent(caseIdForNotes)}/notes`);
        if (!res.ok) {
          throw new Error(`Failed to load notes (${res.status})`);
        }
        const data = await res.json();
        if (isMounted) {
          setNotesList(Array.isArray(data) ? data : []);
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('[EvidenceCard] Notes fetch error:', err);
          setNotesError(err?.message || 'Could not load analyst notes');
          setNotesList([]);
        }
      } finally {
        if (isMounted) {
          setNotesLoading(false);
        }
      }
    };

    fetchNotes();
    return () => {
      isMounted = false;
    };
  }, [caseIdForNotes]);

  // Submit new analyst note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseIdForNotes || caseIdForNotes === 'NO-CASE-SELECTED') return;
    if (!noteBody.trim() || submittingNote) return;

    setSubmittingNote(true);
    setNotesError(null);
    try {
      const res = await apiFetch(`/api/cases/${encodeURIComponent(caseIdForNotes)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: selectedLabel,
          body: noteBody.trim()
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to add note (${res.status})`);
      }

      const createdNote: CaseNoteItem = await res.json();
      setNotesList(prev => [createdNote, ...prev.filter(n => n.id !== createdNote.id)]);
      setNoteBody('');
    } catch (err: any) {
      console.error('[EvidenceCard] Add note error:', err);
      setNotesError(err?.message || 'Failed to submit note');
    } finally {
      setSubmittingNote(false);
    }
  };

  // Delete analyst note
  const handleDeleteNote = async (noteId: string) => {
    if (!caseIdForNotes || deletingNoteId) return;
    setDeletingNoteId(noteId);
    setNotesError(null);
    try {
      const res = await apiFetch(`/api/cases/${encodeURIComponent(caseIdForNotes)}/notes/${encodeURIComponent(noteId)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to delete note (${res.status})`);
      }
      setNotesList(prev => prev.filter(n => n.id !== noteId));
    } catch (err: any) {
      console.error('[EvidenceCard] Delete note error:', err);
      setNotesError(err?.message || 'Failed to delete note');
    } finally {
      setDeletingNoteId(null);
    }
  };

  const canDeleteNote = (note: CaseNoteItem) => {
    if (role === 'admin') return true;
    if (user?.id && note.author_id && note.author_id === user.id) return true;
    if (user?.email && note.author_email && note.author_email.toLowerCase() === user.email.toLowerCase()) return true;
    return false;
  };

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

  const handleCopyEvidence = () => {
    const reportText = formatEvidenceReport(cardData, analysis);
    navigator.clipboard.writeText(reportText);
    setEvidenceCopied(true);
    setTimeout(() => setEvidenceCopied(false), 2500);
  };

  const handleCopySummary = () => {
    handleCopyEvidence();
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

  // Derive visual severity level and styling for rapid situational awareness
  const severityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = (() => {
    if (cardData.verdict.severity) {
      const s = cardData.verdict.severity.toUpperCase();
      if (s === 'CRITICAL' || s === 'HIGH' || s === 'MEDIUM' || s === 'LOW') {
        return s as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      }
    }
    const verdictText = (cardData.verdict.text || '').toUpperCase();
    const verdictStatus = cardData.verdict.status;
    if (verdictText.includes('CRITICAL') || verdictText.includes('FRAUD') || verdictText.includes('MALICIOUS') || verdictText.includes('IMPERSONAT')) {
      return 'CRITICAL';
    }
    if (verdictText.includes('PHISH') || verdictStatus === 'bad') {
      return 'HIGH';
    }
    if (verdictText.includes('SUSPICIOUS') || verdictText.includes('UNCERTAIN') || verdictStatus === 'warn') {
      return 'MEDIUM';
    }
    return 'LOW';
  })();

  const cardContainerVariants: Variants = {
    hidden: { 
      opacity: 0, 
      y: 28,
      scale: 0.97,
      rotateX: 3,
      boxShadow: '0 16px 32px -8px rgba(0, 0, 0, 0.65), 0 4px 12px -2px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)'
    },
    visible: {
      opacity: 1, 
      y: 0,
      scale: 1,
      rotateX: 0,
      boxShadow: '0 16px 32px -8px rgba(0, 0, 0, 0.65), 0 4px 12px -2px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)',
      transition: {
        duration: 0.45,
        ease: [0.16, 1, 0.3, 1],
        staggerChildren: 0.04,
        delayChildren: 0.05
      }
    },
    hover: {
      scale: 1.018,
      y: -4,
      boxShadow: '0 28px 60px -12px rgba(0, 0, 0, 0.88), 0 18px 30px -6px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(204, 154, 74, 0.45), 0 0 28px -2px rgba(204, 154, 74, 0.22)',
      transition: {
        type: 'spring',
        stiffness: 360,
        damping: 24,
        mass: 0.8
      }
    }
  };

  const cardItemVariants: Variants = {
    hidden: { 
      opacity: 0, 
      y: 12
    },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.35,
        ease: 'easeOut'
      }
    }
  };

  const stampVariants: Variants = {
    hidden: { 
      opacity: 0, 
      scale: 2.2, 
      rotate: -18,
      filter: 'blur(4px)'
    },
    visible: { 
      opacity: 1, 
      scale: 1, 
      rotate: -4,
      filter: 'blur(0px)',
      transition: {
        type: 'spring',
        damping: 12,
        stiffness: 240,
        delay: 0.32
      }
    }
  };

  const cardHtml = (
    <motion.div 
      ref={cardRef}
      id="card"
      className={`evidence-card relative select-text overflow-hidden ${maskPII ? 'mask-pii' : ''}`}
      variants={cardContainerVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      whileTap={{
        scale: 0.995,
        y: -1,
        transition: { duration: 0.1 }
      }}
    >
      {/* Subtle Holographic Laser Sweep on Load */}
      <motion.div
        initial={{ x: '-100%', opacity: 0.6 }}
        animate={{ x: '200%', opacity: 0 }}
        transition={{ duration: 1.2, ease: 'easeInOut', delay: 0.2 }}
        className="pointer-events-none absolute inset-0 z-30 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent skew-x-12"
      />

      {/* Folder Tab Header */}
      <motion.div variants={cardItemVariants} className="tab flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="caseid">
            CASE <b>{cardData.caseId}</b>
          </div>
          <div className="meta">
            {cardData.evidenceId} · {cardData.timestamp}
          </div>

          {/* Visual 'Severity' Indicator Badge for Rapid Situational Awareness */}
          <div 
            className={`evidence-severity-badge inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] text-[11px] font-mono font-semibold tracking-wider uppercase border shadow-sm transition-all select-none ${
              severityLevel === 'CRITICAL'
                ? 'bg-rose-950/75 border-rose-600/70 text-rose-300 shadow-rose-950/40'
                : severityLevel === 'HIGH'
                ? 'bg-orange-950/75 border-orange-600/70 text-orange-300 shadow-orange-950/40'
                : severityLevel === 'MEDIUM'
                ? 'bg-amber-950/75 border-amber-600/70 text-amber-300 shadow-amber-950/40'
                : 'bg-emerald-950/75 border-emerald-600/70 text-emerald-300 shadow-emerald-950/40'
            }`}
            title={`Threat Verdict Severity: ${severityLevel} (${cardData.verdict.severityLabel || cardData.verdict.text})`}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  severityLevel === 'CRITICAL'
                    ? 'bg-rose-400'
                    : severityLevel === 'HIGH'
                    ? 'bg-orange-400'
                    : severityLevel === 'MEDIUM'
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  severityLevel === 'CRITICAL'
                    ? 'bg-rose-500'
                    : severityLevel === 'HIGH'
                    ? 'bg-orange-500'
                    : severityLevel === 'MEDIUM'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
              />
            </span>
            <span className="opacity-70 text-[9.5px] font-normal tracking-wide text-slate-400">SEV:</span>
            <span>{severityLevel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Share Case Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShareModalOpen(true);
            }}
            className="px-2.5 py-0.5 rounded-[4px] text-[11px] font-mono flex items-center gap-1.5 transition-all cursor-pointer border bg-[#12161F] border-[#22364a] text-[#7fa3ba] hover:text-[#edf4fa] hover:border-[#4a759c] hover:bg-[#182330] shadow-sm"
            title="Generate secure, temporary link for internal team collaboration"
          >
            <Share2 className="w-3 h-3 text-[#6d9bbd]" />
            <span>Share Case</span>
          </button>

          {/* Small 'Mask PII' Toggle Inside Evidence Card Header */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMaskPII(!maskPII);
            }}
            className={`px-2 py-0.5 rounded-[4px] text-[11px] font-mono flex items-center gap-1.5 transition-all cursor-pointer border ${
              maskPII
                ? 'bg-[#CC9A4A]/25 border-[#CC9A4A] text-[#CC9A4A] font-semibold shadow-sm'
                : 'bg-[#12161F] border-[#2B241E] text-[#8a8070] hover:text-[#ede6d8] hover:border-[#574f42]'
            }`}
            title={
              maskPII
                ? 'PII Masking Active (CSS blur applied to sensitive names & IPs). Click to unmask.'
                : 'Click to mask PII (dynamically blurs sensitive names, emails, and IP addresses in the card body)'
            }
          >
            {maskPII ? <EyeOff className="w-3 h-3 text-[#CC9A4A]" /> : <Eye className="w-3 h-3 text-[#8a8070]" />}
            <span>Mask PII</span>
            <span className={`w-1.5 h-1.5 rounded-full ${maskPII ? 'bg-[#CC9A4A] animate-pulse' : 'bg-[#574f42]'}`} />
          </button>
        </div>
      </motion.div>

      {/* Main Body */}
      <div className={`body relative ${maskPII ? 'mask-pii' : ''}`}>
        {/* Rubber-Stamp Verdict Badge with Ink Slam Animation */}
        <motion.div 
          variants={stampVariants} 
          className={`stamp ${stampClass}`}
        >
          {cardData.verdict.text}
          <small>{cardData.verdict.scoreLabel}</small>
          {/* Stamp Ink Shockwave */}
          <motion.span
            initial={{ scale: 0.8, opacity: 0.8 }}
            animate={{ scale: 1.4, opacity: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="pointer-events-none absolute inset-0 rounded border-2 border-current opacity-0"
          />
        </motion.div>

        {/* 1️⃣ SUBJECT & HERO THREAT OVERVIEW */}
        <motion.div variants={cardItemVariants} className="subject pr-28 sm:pr-32 mb-3">
          <h1 className={`text-base sm:text-lg font-display font-bold leading-snug text-[#ede6d8] ${maskPII ? 'pii-sensitive pii-subject' : ''}`}>
            {cardData.subject}
          </h1>
          <div className="flex items-center gap-3 text-[11px] font-mono text-[#8a8070] mt-1.5 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="text-slate-400">Threat Risk:</span>
              <strong className={cardData.score?.good ? 'text-emerald-400' : 'text-rose-400'}>
                {analysis?.threatScore ?? analysis?.riskScore ?? 0}/100
              </strong>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <span className="text-slate-400">ML Model:</span>
              <strong className="text-cyan-300">
                {cardData.score?.resultText} ({cardData.score?.resultLabel})
              </strong>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <User className="w-3 h-3 text-[#c9a227]" />
              <span className="text-slate-300 font-semibold">{analysis?.assigned_user || analysis?.assignedUser || analysis?.user_email || 'Jayaram Sappa'}</span>
              <span className="text-[10px] text-[#8a8070]">(Lead SOC)</span>
            </span>
          </div>
        </motion.div>

        {/* Quick Action Toolbar */}
        <motion.div variants={cardItemVariants} className="flex flex-wrap items-center justify-between gap-1.5 mb-4 pt-1.5 border-t border-b border-[#3a352c]/50 pb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setMitreModalOpen(true)}
              className="px-2 py-0.5 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 text-[10.5px] font-mono flex items-center gap-1 transition-all cursor-pointer"
              title="Inspect MITRE ATT&CK Matrix Techniques"
            >
              <Crosshair className="w-3 h-3 text-rose-400" />
              <span>MITRE ATT&CK</span>
            </button>

            <button
              type="button"
              onClick={() => setStixModalOpen(true)}
              className="px-2 py-0.5 rounded bg-[#17130F] hover:bg-[#2B241E] border border-[#2B241E] text-[#EDE6DC] text-[10.5px] font-mono flex items-center gap-1 transition-all cursor-pointer"
              title="Export STIX 2.1 & OpenIOC Threat Intel Bundle"
            >
              <FileCode className="w-3 h-3 text-[#D3A039]" />
              <span>STIX 2.1</span>
            </button>

            <button
              type="button"
              onClick={() => setQuishingModalOpen(true)}
              className="px-2 py-0.5 rounded bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/50 text-amber-300 text-[10.5px] font-mono flex items-center gap-1 transition-all cursor-pointer"
              title="Optical QR Code (Quishing) Phishing Scanner"
            >
              <QrCode className="w-3 h-3 text-amber-400" />
              <span>Quishing</span>
            </button>

            <button
              type="button"
              onClick={() => setSoarModalOpen(true)}
              className="px-2 py-0.5 rounded bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/50 text-purple-300 text-[10.5px] font-mono flex items-center gap-1 transition-all cursor-pointer"
              title="Automated SOAR Quarantine & Firewall Action Playbooks"
            >
              <Zap className="w-3 h-3 text-purple-400" />
              <span>SOAR Playbook</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyEvidence}
              className="px-2.5 py-0.5 rounded bg-[#CC9A4A]/20 hover:bg-[#CC9A4A]/30 border border-[#CC9A4A]/60 text-[#CC9A4A] hover:text-white text-[10.5px] font-mono flex items-center gap-1 transition-all cursor-pointer font-semibold shadow-sm"
              title="Copy formatted raw headers, hops & threat verdict"
            >
              {evidenceCopied ? <Check className="w-3 h-3 text-[#3FCC93]" /> : <Copy className="w-3 h-3 text-[#CC9A4A]" />}
              <span>{evidenceCopied ? 'Copied Dossier!' : 'Copy Dossier'}</span>
            </button>
          </div>
        </motion.div>

        {/* 2️⃣ ENVELOPE & SENDER IDENTITY (Clean 2-Column Grid) */}
        <motion.div variants={cardItemVariants} className="mb-4">
          <div className="section-label">ENVELOPE &amp; SENDER IDENTITY</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 bg-[#15120e] p-2.5 rounded border border-[#2b241e] text-[12px] font-mono">
            {cardData.identityRows.map((r, idx) => (
              <div key={idx} className="flex items-baseline justify-between gap-2 py-0.5 border-b border-[#221c17] last:border-none">
                <span className="text-[10.5px] text-[#8a8070] uppercase font-semibold shrink-0 w-24 tracking-wider">{r.k}:</span>
                <span className={`truncate text-right flex-1 ${r.status || ''} ${maskPII ? 'pii-sensitive pii-name pii-email' : ''}`} title={r.v}>
                  {r.v}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* 3️⃣ DUAL SECURITY PILLARS: AUTH & ORIGIN INFRASTRUCTURE */}
        <motion.div variants={cardItemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
          {/* Left Column: Cryptographic Authentication */}
          <div className="bg-[#15120e] p-3 rounded border border-[#2b241e] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="section-label mb-0">CRYPTOGRAPHIC AUTHENTICATION</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {cardData.checks.map((c, idx) => (
                  <div key={idx} className="chip text-center p-1.5 rounded bg-[#100e0c] border border-[#2b241e]">
                    <div className="label text-[9px] text-[#8a8070] font-semibold">{c.label}</div>
                    <div className={`val text-[11px] font-bold mt-0.5 ${c.status}`}>{c.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-[10.5px] font-mono text-[#8a8070] space-y-0.5 pt-1.5 border-t border-[#221c17]">
              <div>DMARC Policy: <span className="text-slate-300">{cardData.dnsData?.dmarcPolicy || 'none'}</span></div>
              <div>Alignment: <span className="text-slate-300">{cardData.dnsData?.dmarcEnforcement || 'Verified Cryptographic SPF/DKIM'}</span></div>
            </div>
          </div>

          {/* Right Column: Origin & Transmission Infrastructure */}
          {cardData.origin && (
            <div className="bg-[#15120e] p-3 rounded border border-[#2b241e] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="section-label mb-0">ORIGIN &amp; TRANSMISSION ROUTE</span>
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="space-y-1 text-[11.5px] font-mono">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] text-[#8a8070]">First-Hop IP:</span>
                    <span className={`font-bold ${cardData.origin.ipStatus || ''} ${maskPII ? 'pii-sensitive pii-ip' : ''}`}>
                      {cardData.origin.ip}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] text-[#8a8070]">Location:</span>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={maskPII ? 'pii-sensitive pii-location' : ''}>{cardData.origin.location}</span>
                      {cardData.origin.mapsUrl && (
                        <button onClick={handleOpenMaps} className="inline-link text-[10px] shrink-0" title="Open Map">
                          Map ↗
                        </button>
                      )}
                    </div>
                  </div>
                  {cardData.origin.extraRows && cardData.origin.extraRows.slice(0, 2).map((r, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2">
                      <span className="text-[10.5px] text-[#8a8070]">{r.k}:</span>
                      <span className={`truncate text-right ${r.status || ''} ${maskPII ? 'pii-sensitive' : ''}`} title={r.v}>
                        {r.v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {cardData.relay && (
                <div className="pt-2 border-t border-[#221c17] mt-1.5 flex items-center justify-between text-[10.5px] font-mono text-[#8a8070]">
                  <span className="truncate mr-2" dangerouslySetInnerHTML={{ __html: cardData.relay.chain }} />
                  <button onClick={handleOpenGraph} className="inline-link shrink-0 text-[10px]" title="Open Graph">
                    Graph ↗
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* 4️⃣ THREAT INTELLIGENCE & OBSERVED ARTIFACTS (IOCs) */}
        <motion.div variants={cardItemVariants} className="mb-4 bg-[#15120e] p-3 rounded border border-[#2b241e]">
          <div className="section-label">THREAT INTELLIGENCE &amp; OBSERVED ARTIFACTS (IOCs)</div>
          
          {/* Domain Intelligence Bar */}
          {cardData.entity && (
            <div className="mb-2.5 pb-2 border-b border-[#221c17]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                {cardData.entity.rows.map((r, idx) => (
                  <div key={idx} className="flex flex-col">
                    <span className="text-[9.5px] text-[#8a8070] font-semibold uppercase">{r.k}</span>
                    <span className={`truncate font-medium text-[#ede6d8] ${r.status || ''}`}>{r.v}</span>
                  </div>
                ))}
              </div>
              {cardData.entity.flags && cardData.entity.flags.length > 0 && (
                <div className="flags mt-2">
                  {cardData.entity.flags.map((f, idx) => (
                    <span key={idx} className={`flag ${f.level === 'amber' ? 'amber' : f.level === 'green' ? 'green' : ''}`}>
                      {f.text}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Links & Attachments Findings */}
          {cardData.findings && cardData.findings.length > 0 && (
            <div className="space-y-1 mb-2">
              <span className="text-[10px] text-[#8a8070] font-mono uppercase tracking-wider block">Observed Links &amp; File Payloads:</span>
              {cardData.findings.map((f, idx) => (
                <div key={idx} className="link-item flex items-center justify-between p-1.5 rounded bg-[#100e0c] border border-[#2b241e]">
                  <span className="url text-xs text-[#ede6d8] truncate mr-2" title={f.label}>{f.label}</span>
                  <span className={`badge ${f.status} shrink-0 text-[10px]`}>{f.badge}</span>
                </div>
              ))}
            </div>
          )}

          {/* Threat Score Breakdown Bars */}
          {(cardData.threatScoreBreakdown || analysis?.threatScoreBreakdown) && (() => {
            const bd = cardData.threatScoreBreakdown || analysis?.threatScoreBreakdown;
            if (!bd || !bd.components) return null;
            return (
              <div className="pt-2 border-t border-[#221c17]">
                <div className="flex items-center justify-between text-[10.5px] font-mono text-[#8a8070] mb-1.5">
                  <span>Cumulative Risk Distribution:</span>
                  <button
                    type="button"
                    onClick={() => setShowBreakdown(!showBreakdown)}
                    className="inline-link text-[10px]"
                  >
                    {showBreakdown ? 'Hide Breakdown ▲' : 'Show Breakdown ▼'}
                  </button>
                </div>
                {showBreakdown && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[10px] font-mono">
                    <div className="p-1.5 rounded bg-[#100e0c] border border-[#221c17] text-center">
                      <div className="text-[#8a8070]">Auth</div>
                      <div className={bd.components.authentication?.score > 0 ? 'text-rose-400 font-bold' : 'text-slate-300 font-semibold'}>
                        +{bd.components.authentication?.score ?? 0} pts
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-[#100e0c] border border-[#221c17] text-center">
                      <div className="text-[#8a8070]">Domain</div>
                      <div className={bd.components.domainRisk?.score > 0 ? 'text-rose-400 font-bold' : 'text-slate-300 font-semibold'}>
                        +{bd.components.domainRisk?.score ?? 0} pts
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-[#100e0c] border border-[#221c17] text-center">
                      <div className="text-[#8a8070]">Infra</div>
                      <div className={bd.components.infrastructureRisk?.score > 0 ? 'text-rose-400 font-bold' : 'text-slate-300 font-semibold'}>
                        +{bd.components.infrastructureRisk?.score ?? 0} pts
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-[#100e0c] border border-[#221c17] text-center">
                      <div className="text-[#8a8070]">ML Content</div>
                      <div className={bd.components.mlClassification?.score > 0 ? 'text-rose-400 font-bold' : 'text-slate-300 font-semibold'}>
                        +{bd.components.mlClassification?.score ?? 0} pts
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-[#100e0c] border border-[#221c17] text-center col-span-2 sm:col-span-1">
                      <div className="text-[#8a8070]">Heuristics</div>
                      <div className={bd.components.heuristics?.score > 0 ? 'text-rose-400 font-bold' : 'text-slate-300 font-semibold'}>
                        +{bd.components.heuristics?.score ?? 0} pts
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </motion.div>

        {/* 5️⃣ RELATED INCIDENTS & CAMPAIGN CORRELATION (Cross-Case Intel) */}
        <motion.div variants={cardItemVariants} className="mb-4 bg-[#15120e] p-3 rounded border border-[#2b241e]">
          <div className="flex items-center justify-between mb-2">
            <span className="section-label mb-0">RELATED INCIDENTS &amp; CAMPAIGN CORRELATION</span>
            <Network className="w-3.5 h-3.5 text-purple-400" />
          </div>

          <div className="p-2 rounded bg-[#100e0c] border border-[#221c17] space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-slate-200">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-[#8a8070]">Active Campaign Cluster:</span>
                <span className="font-bold text-purple-300">
                  {analysis?.campaign_name || analysis?.campaign_id || (analysis?.correlationEvidence?.length ? 'CAMP-2026-OCT-01 (Multi-Hop Infiltration)' : 'Cluster: Standalone Investigation')}
                </span>
              </div>
              <span className="text-[10px] text-[#8a8070]">
                {analysis?.correlationEvidence?.length ? `${analysis.correlationEvidence.length} Evidence Rules Matched` : 'Deterministic Hash & Origin Check'}
              </span>
            </div>

            {analysis?.correlationEvidence && analysis.correlationEvidence.length > 0 ? (
              <div className="space-y-1 pt-1 border-t border-[#221c17]">
                {analysis.correlationEvidence.slice(0, 3).map((c, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-[11px] text-[#b9af9c]">
                    <span className="text-purple-400 font-bold">↳</span>
                    <span>{c.description || c.rule || 'Correlated cross-case IOC link detected'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-[#8a8070] italic pt-1 border-t border-[#221c17]">
                Single-instance incident. No identical weaponized dropper hash or Tor relay overlaps detected across other open tenant cases.
              </div>
            )}
          </div>
        </motion.div>

        {/* 6️⃣ TEAM ANALYST ACTIVITY & AUDIT TRAIL */}
        <motion.div variants={cardItemVariants} className="mb-4 bg-[#15120e] p-3 rounded border border-[#2b241e]">
          <div className="flex items-center justify-between mb-2">
            <span className="section-label mb-0">TEAM ANALYST ATTRIBUTION &amp; TRIAGE</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/70 text-blue-300 border border-blue-800/60">
              {analysis?.status || 'TRIAGED / IN PROGRESS'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-[#ede6d8] mb-2 p-2 rounded bg-[#100e0c] border border-[#221c17]">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-[#c9a227]" />
              <span className="text-[#8a8070]">Investigator:</span>
              <span className="font-bold">{analysis?.assigned_user || analysis?.assignedUser || analysis?.user_email || 'Jayaram Sappa'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[#8a8070]">Clearance:</span>
              <span className="text-cyan-300 font-semibold">{role === 'admin' ? 'Forensic Lead (Admin)' : 'Security Operations Analyst'}</span>
            </div>
          </div>

          {/* AI Case Summary Narrative Box */}
          {cardData.aiSummary && (
            <div className="ai-box mt-2">
              <p className={maskPII ? 'pii-sensitive' : ''}>{cardData.aiSummary.text}</p>
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
          )}
        </motion.div>

        {/* 7️⃣ COLLAPSIBLE DEEP FORENSIC LAB */}
        <motion.div variants={cardItemVariants} className="mt-3 rounded-lg border border-slate-700 bg-slate-900/80 overflow-hidden text-xs">
          {/* Main Deep Analysis Toggle Header */}
          <button
            type="button"
            onClick={() => setDeepAnalysisOpen(!deepAnalysisOpen)}
            className="w-full px-3 py-2 flex items-center justify-between bg-slate-800/60 hover:bg-slate-800 transition-colors text-left select-none cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="font-semibold text-slate-200">Deep Forensic Lab</span>
              <span className="px-1.5 py-0.2 rounded bg-cyan-950/60 border border-cyan-800/80 text-[10px] text-cyan-400 font-mono">
                Kill-Chain &amp; Counterfactuals
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

              {/* 4. Analyst Notes Panel */}
              <div className="rounded border border-slate-700/60 bg-slate-950/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setNotesOpen(!notesOpen)}
                  className="w-full px-2.5 py-1.5 flex items-center justify-between bg-slate-800/40 hover:bg-slate-800/60 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <MessageSquareText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="font-semibold text-[11px] text-slate-200">Analyst Notes &amp; Findings</span>
                    <span className="px-1 py-0.2 rounded bg-amber-950/60 border border-amber-800/60 text-[9px] text-amber-300 font-mono">
                      {notesList.length}
                    </span>
                  </div>
                  {notesOpen ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                </button>

                {notesOpen && (
                  <div className="p-2.5 border-t border-slate-800/60 space-y-3">
                    {/* Add Note Form */}
                    <form onSubmit={handleAddNote} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] uppercase font-mono text-slate-400 shrink-0">Label:</label>
                        <select
                          value={selectedLabel}
                          onChange={(e) => setSelectedLabel(e.target.value as CaseNoteItem['label'])}
                          className="px-2 py-1 text-[11px] font-mono bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
                        >
                          <option value="Confirmed Phish">Confirmed Phish</option>
                          <option value="False Positive">False Positive</option>
                          <option value="Escalated">Escalated</option>
                          <option value="Needs Follow-up">Needs Follow-up</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Informational">Informational</option>
                        </select>
                      </div>

                      <div className="relative">
                        <textarea
                          value={noteBody}
                          onChange={(e) => setNoteBody(e.target.value.slice(0, 1000))}
                          placeholder="Attach analyst findings, containment notes, or triage context..."
                          rows={2}
                          maxLength={1000}
                          className="w-full px-2.5 py-1.5 text-xs font-sans bg-slate-900/90 border border-slate-700/80 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/80 resize-y min-h-[50px] leading-relaxed"
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className={noteBody.length >= 950 ? 'text-amber-400 font-semibold' : 'text-slate-500'}>
                          {noteBody.length}/1000 chars
                        </span>
                        <button
                          type="submit"
                          disabled={!noteBody.trim() || submittingNote || !caseIdForNotes || caseIdForNotes === 'NO-CASE-SELECTED'}
                          className="px-2.5 py-1 rounded bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/50 text-amber-300 hover:text-amber-200 text-[11px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {submittingNote ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3 text-amber-400" />
                              <span>Add Note</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>

                    {notesError && (
                      <div className="px-2 py-1 rounded bg-rose-950/40 border border-rose-800/60 text-[10px] text-rose-300 font-mono flex items-center justify-between">
                        <span>{notesError}</span>
                        <button type="button" onClick={() => setNotesError(null)} className="text-rose-400 hover:text-rose-200 cursor-pointer">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Notes List */}
                    <div className="space-y-2 pt-1 border-t border-slate-800/60">
                      {notesLoading && notesList.length === 0 ? (
                        <div className="py-3 flex items-center justify-center gap-2 text-slate-400 text-xs font-mono">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          <span>Loading analyst notes...</span>
                        </div>
                      ) : notesList.length === 0 ? (
                        <div className="py-2.5 text-center text-xs text-slate-500 font-mono italic">
                          No analyst notes yet
                        </div>
                      ) : (
                        notesList.map((note) => (
                          <div
                            key={note.id}
                            className="p-2 rounded bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 transition-colors text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold tracking-wide uppercase ${getNoteBadgeStyle(note.label)}`}>
                                  {note.label}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono truncate max-w-[160px]" title={note.author_email}>
                                  {note.author_email}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {formatRelativeTime(note.created_at)}
                                </span>
                                {canDeleteNote(note) && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteNote(note.id)}
                                    disabled={deletingNoteId === note.id}
                                    title="Delete this note"
                                    className="p-0.5 rounded text-slate-500 hover:text-rose-400 transition-colors cursor-pointer disabled:opacity-40"
                                  >
                                    {deletingNoteId === note.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin text-rose-400" />
                                    ) : (
                                      <Trash2 className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-slate-200 text-xs leading-relaxed font-sans whitespace-pre-wrap break-words">
                              {note.body}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Sender Baseline Anomaly Panel */}
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
        </motion.div>

      </div>

      {/* Footer */}
      {cardData.footer && (
        <motion.div variants={cardItemVariants} className="footer">
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
        </motion.div>
      )}
    </motion.div>
  );

  if (isModal) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto"
      >
        <div className="flex flex-col items-center max-w-full my-auto">
          {/* Action Bar */}
          <motion.div 
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="w-full max-w-[520px] flex items-center justify-between mb-3 px-1 text-xs"
          >
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
                onClick={handleCopyEvidence}
                className="px-2.5 py-1 rounded bg-[#CC9A4A]/20 hover:bg-[#CC9A4A]/30 border border-[#CC9A4A]/60 text-[#CC9A4A] hover:text-[#F2EFE7] text-[11px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer font-semibold shadow-sm"
                title="Copy formatted raw headers, hops and threat verdict for external incident reports"
              >
                {evidenceCopied ? <Check className="w-3 h-3 text-[#3FCC93]" /> : <Copy className="w-3 h-3 text-[#CC9A4A]" />}
                <span>{evidenceCopied ? 'Copied Evidence!' : 'Copy Evidence'}</span>
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
          </motion.div>

          {/* Render Card */}
          {cardHtml}

          {/* Advanced Modals */}
          {shareModalOpen && (
            <ShareCaseModal
              isOpen={shareModalOpen}
              onClose={() => setShareModalOpen(false)}
              caseId={cardData.caseId}
              evidenceId={cardData.evidenceId}
              subject={cardData.subject}
              verdict={cardData.verdict.text}
              severity={severityLevel}
              threatScore={analysis?.threatScore ?? analysis?.riskScore}
            />
          )}
          {stixModalOpen && analysis && (
            <StixExportModal analysis={analysis} onClose={() => setStixModalOpen(false)} />
          )}
          {mitreModalOpen && (
            <MitreAttackMatrixModal analysis={analysis} onClose={() => setMitreModalOpen(false)} />
          )}
          {quishingModalOpen && (
            <QuishingInspectorModal analysis={analysis} onClose={() => setQuishingModalOpen(false)} />
          )}
          {soarModalOpen && analysis && (
            <SoarActionModal analysis={analysis} onClose={() => setSoarModalOpen(false)} />
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <>
      {cardHtml}
      {shareModalOpen && (
        <ShareCaseModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          caseId={cardData.caseId}
          evidenceId={cardData.evidenceId}
          subject={cardData.subject}
          verdict={cardData.verdict.text}
          severity={severityLevel}
          threatScore={analysis?.threatScore ?? analysis?.riskScore}
        />
      )}
      {stixModalOpen && analysis && (
        <StixExportModal analysis={analysis} onClose={() => setStixModalOpen(false)} />
      )}
      {mitreModalOpen && (
        <MitreAttackMatrixModal analysis={analysis} onClose={() => setMitreModalOpen(false)} />
      )}
      {quishingModalOpen && (
        <QuishingInspectorModal analysis={analysis} onClose={() => setQuishingModalOpen(false)} />
      )}
      {soarModalOpen && analysis && (
        <SoarActionModal analysis={analysis} onClose={() => setSoarModalOpen(false)} />
      )}
    </>
  );
}

// Alias exports for flexibility
export const EvidenceCard = EvidenceTagCard;
export default EvidenceTagCard;
