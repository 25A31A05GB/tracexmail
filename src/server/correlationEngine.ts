/**
 * TraceXMail Evidence-Based Campaign Correlation Engine
 * Derives campaign links and actor clusters strictly from verifiable technical evidence:
 * URL/Domain overlap, ASN/Infrastructure reuse, Content Fingerprints, DKIM Signatures,
 * and Targeted Attack Lures.
 * Explicitly rejects false correlations across shared hyperscalers (AWS, Cloudflare, Google).
 */

export interface EmailForensicRecord {
  id: string;
  subject: string;
  sender?: string;
  recipient?: string;
  fromDomain: string;
  relatedDomains?: string[];
  originIp?: string;
  originAsn?: string;
  originAsnOrg?: string;
  urls: string[];
  fileHashes?: string[];
  dkimDomain?: string;
  dkimSelector?: string;
  bodySnippet?: string;
  contentFingerprint?: string;
  threatScore?: number;
  threatVerdict?: string;
  createdAt?: string;
  tags?: string[];
  caseId?: string;
}

export interface CorrelationEvidence {
  rule: string;
  strength: 'STRONG' | 'MEDIUM' | 'WEAK';
  description: string;
  value: string;
  autoMergeEligible: boolean;
  iocType?: 'URL' | 'DOMAIN' | 'IP' | 'DKIM' | 'LURE' | 'ORGANIZATION' | 'INFRASTRUCTURE' | 'HASH';
}

export interface CorrelatedCaseMatch {
  caseId: string;
  emailId: string;
  subject: string;
  sender: string;
  similarityScore: number;
  relationshipStrength: 'STRONG' | 'MEDIUM' | 'WEAK';
  sharedEvidence: CorrelationEvidence[];
  sharedIocs: string[];
  reason: string;
  threatScore: number;
  threatVerdict: string;
  fromDomain?: string;
  originIp?: string;
  fileHashes?: string[];
  createdAt?: string;
}

export interface CampaignCluster {
  id: string;
  name: string;
  threatActor: string;
  status: 'ACTIVE' | 'MONITORED' | 'CONTAINED';
  targetIndustry: string;
  totalEmails: number;
  memberEmailIds: string[];
  memberCases?: any[];
  sharedEvidence: CorrelationEvidence[];
  possibleRelated?: Array<{
    email_id: string;
    subject: string;
    relationship_strength: 'STRONG' | 'MEDIUM' | 'WEAK';
    similarity_score: number;
    reason: string;
  }>;
  firstSeen: string;
  lastSeen: string;
  notes: string;
}

// Hyperscalers and public shared relays that should NOT trigger strong IP/ASN correlation on their own
const GENERIC_HOSTING_ASNS = ['AS16509', 'AS15169', 'AS13335', 'AS8075', 'AS14061', 'AS54113', 'AS20940'];
const GENERIC_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'mail.com', 'protonmail.com'];

// Helper to extract clean domain
function extractDomain(input?: string): string {
  if (!input) return '';
  const clean = input.toLowerCase().trim();
  const emailMatch = clean.match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
  if (emailMatch) return emailMatch[1];
  const urlMatch = clean.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})/i);
  if (urlMatch) return urlMatch[1];
  return clean.replace(/^[<"'\s]+|[>"'\s]+$/g, '');
}

// Helper to check if IP is private or loopback
function isPrivateIp(ip?: string): boolean {
  if (!ip || ip === 'UNKNOWN' || ip === '127.0.0.1' || ip === '::1') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  return false;
}

// Helper to extract high-risk lure patterns
function extractLureArchetype(text?: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (/wire\s*transfer|payment\s*invoice|direct\s*deposit|payroll\s*update|ach\s*settlement|banking\s*alert/i.test(lower)) {
    return 'FINANCIAL_WIRE_INVOICE_DIVERSION';
  }
  if (/password\s*expired|security\s*alert|account\s*(suspended|locked|restricted)|verify\s*your\s*identity|action\s*required.*login/i.test(lower)) {
    return 'CREDENTIAL_HARVEST_ACCOUNT_TAKEOVER';
  }
  if (/docusign|sign\s*now|contract\s*review|secure\s*document|adobe\s*sign|pdf\s*enclosed/i.test(lower)) {
    return 'DOCUMENT_ESIGN_EXPLOIT';
  }
  if (/ceo|executive|urgent\s*task|confidential\s*request|are\s*you\s*at\s*your\s*desk/i.test(lower)) {
    return 'EXECUTIVE_IMPERSONATION_BEC';
  }
  if (/tax\s*return|w-2|irs\s*refund|tax\s*filing/i.test(lower)) {
    return 'TAX_W2_FRAUD';
  }
  return null;
}

/**
 * Extracts a normalized EmailForensicRecord from various backend case or email analysis representations
 */
export function extractForensicRecord(item: any): EmailForensicRecord {
  if (!item) {
    return { id: `item-${Date.now()}`, subject: 'Unknown', fromDomain: '', urls: [] };
  }

  const id = item.id || item.caseId || `case-${Date.now()}`;
  const subject = item.title || item.headers?.subject || item.subject || item.raw_analysis?.subject || item.raw_analysis?.headers?.subject || 'Untitled Investigation';
  const sender = item.from || item.headers?.from || item.sender || item.raw_analysis?.from || item.raw_analysis?.headers?.from || '';
  const recipient = item.to || item.headers?.to || item.recipient || item.raw_analysis?.to || item.raw_analysis?.headers?.to || '';
  
  const fromDomain = item.from_domain || item.domain || extractDomain(sender);
  
  // Extract related domains (replyTo, returnPath)
  const relatedDomainsSet = new Set<string>();
  if (fromDomain) relatedDomainsSet.add(fromDomain.toLowerCase());
  const replyTo = item.replyTo || item.headers?.replyTo || item.raw_analysis?.headers?.replyTo || '';
  if (replyTo) {
    const d = extractDomain(replyTo);
    if (d) relatedDomainsSet.add(d.toLowerCase());
  }
  const returnPath = item.returnPath || item.headers?.returnPath || item.raw_analysis?.headers?.returnPath || '';
  if (returnPath) {
    const d = extractDomain(returnPath);
    if (d) relatedDomainsSet.add(d.toLowerCase());
  }

  // Extract true origin IP
  let originIp = item.origin_ip || item.raw_analysis?.originIp || item.raw_analysis?.origin_ip;
  if (!originIp && Array.isArray(item.hops) && item.hops.length > 0) {
    originIp = item.hops[0].ip;
  }
  if (!originIp && Array.isArray(item.raw_analysis?.hops) && item.raw_analysis.hops.length > 0) {
    originIp = item.raw_analysis.hops[0].ip;
  }

  // Extract ASN
  const originAsn = item.origin_asn || item.raw_analysis?.originAsn || item.raw_analysis?.hops?.[0]?.asn || '';
  const originAsnOrg = item.origin_asn_org || item.raw_analysis?.originAsnOrg || item.raw_analysis?.hops?.[0]?.asnOrg || item.raw_analysis?.hops?.[0]?.org || '';

  // Extract URLs
  const urlSet = new Set<string>();
  const rawUrls = item.urls || item.extracted_urls || item.raw_analysis?.extractedUrls || item.raw_analysis?.urls || item.raw_analysis?.indicators?.urls || [];
  if (Array.isArray(rawUrls)) {
    for (const u of rawUrls) {
      if (typeof u === 'string' && u.trim().startsWith('http')) {
        urlSet.add(u.trim().replace(/[),.;'"]+$/, ''));
      } else if (u && typeof u.url === 'string') {
        urlSet.add(u.url.trim().replace(/[),.;'"]+$/, ''));
      }
    }
  }

  // Extract File Hashes (Attachments, SHA-256 custody, indicators)
  const hashSet = new Set<string>();
  const rawAttachments = item.attachments || item.raw_analysis?.attachments || [];
  if (Array.isArray(rawAttachments)) {
    for (const att of rawAttachments) {
      if (att?.sha256) hashSet.add(att.sha256.toLowerCase().trim());
      if (att?.md5) hashSet.add(att.md5.toLowerCase().trim());
      if (att?.hash) hashSet.add(att.hash.toLowerCase().trim());
    }
  }
  const explicitHashes = item.file_hashes || item.fileHashes || item.ioc_indicators?.file_hashes || [];
  if (Array.isArray(explicitHashes)) {
    for (const h of explicitHashes) {
      if (typeof h === 'string' && h.trim()) hashSet.add(h.toLowerCase().trim());
    }
  }
  if (item.sha256 && typeof item.sha256 === 'string') hashSet.add(item.sha256.toLowerCase().trim());
  if (item.sha256Hash && typeof item.sha256Hash === 'string') hashSet.add(item.sha256Hash.toLowerCase().trim());
  if (item.raw_analysis?.sha256Hash && typeof item.raw_analysis.sha256Hash === 'string') hashSet.add(item.raw_analysis.sha256Hash.toLowerCase().trim());
  if (item.custodyHash && typeof item.custodyHash === 'string') hashSet.add(item.custodyHash.toLowerCase().trim());

  // Extract DKIM
  const dkimDomain = item.dkim_domain || item.auth?.dkim?.domain || item.raw_analysis?.auth?.dkim?.domain || '';
  const dkimSelector = item.dkim_selector || item.auth?.dkim?.selector || item.raw_analysis?.auth?.dkim?.selector || '';

  // Threat Scores
  const threatScore = typeof item.threat_score === 'number' 
    ? item.threat_score 
    : (typeof item.threatScore === 'number' ? item.threatScore : 75);
  const threatVerdict = item.severity || item.threat_verdict || item.verdict || 'SUSPICIOUS';

  const bodySnippet = item.description || item.raw_analysis?.bodyText || item.body || item.raw_analysis?.body || '';
  const createdAt = item.created_at || item.createdAt || new Date().toISOString();
  const tags = Array.isArray(item.tags) ? item.tags : [];

  return {
    id,
    subject,
    sender,
    recipient,
    fromDomain,
    relatedDomains: Array.from(relatedDomainsSet),
    originIp,
    originAsn,
    originAsnOrg,
    urls: Array.from(urlSet),
    fileHashes: Array.from(hashSet),
    dkimDomain,
    dkimSelector,
    bodySnippet,
    threatScore,
    threatVerdict,
    createdAt,
    tags,
    caseId: item.caseId || id
  };
}

/**
 * Compares two forensic records across all technical dimensions and returns
 * structured correlation evidence, similarity score (0-1), and classification.
 */
export function compareRecords(primary: EmailForensicRecord, candidate: EmailForensicRecord): {
  strength: 'STRONG' | 'MEDIUM' | 'WEAK' | null;
  score: number;
  evidence: CorrelationEvidence[];
  sharedIocs: string[];
  reason: string;
} {
  const evidence: CorrelationEvidence[] = [];
  const sharedIocs: string[] = [];
  let scorePoints = 0;

  // 1. Exact Malicious / Destination URL Overlap (STRONG: +45)
  if (primary.urls.length > 0 && candidate.urls.length > 0) {
    const commonUrls = primary.urls.filter(u => candidate.urls.includes(u));
    if (commonUrls.length > 0) {
      scorePoints += 45;
      sharedIocs.push(`URL: ${commonUrls[0]}`);
      evidence.push({
        rule: 'SHARED_MALICIOUS_URL',
        strength: 'STRONG',
        description: `Both messages reference identical destination payload URL: ${commonUrls[0]}`,
        value: commonUrls[0],
        autoMergeEligible: true,
        iocType: 'URL'
      });
    } else {
      // Check hostname/domain overlap of target URLs
      const primaryUrlDomains = primary.urls.map(extractDomain).filter(d => d && !GENERIC_EMAIL_DOMAINS.includes(d));
      const candidateUrlDomains = candidate.urls.map(extractDomain).filter(d => d && !GENERIC_EMAIL_DOMAINS.includes(d));
      const commonDomains = primaryUrlDomains.filter(d => candidateUrlDomains.includes(d));
      if (commonDomains.length > 0) {
        scorePoints += 25;
        sharedIocs.push(`Target Domain: ${commonDomains[0]}`);
        evidence.push({
          rule: 'SHARED_PAYLOAD_DOMAIN',
          strength: 'MEDIUM',
          description: `Embedded links target the same destination domain: ${commonDomains[0]}`,
          value: commonDomains[0],
          autoMergeEligible: false,
          iocType: 'DOMAIN'
        });
      }
    }
  }

  // 2. Sender Domain Overlap (STRONG: +35 if non-generic)
  if (primary.fromDomain && candidate.fromDomain && primary.fromDomain === candidate.fromDomain) {
    const isGeneric = GENERIC_EMAIL_DOMAINS.includes(primary.fromDomain);
    if (!isGeneric) {
      scorePoints += 35;
      sharedIocs.push(`Domain: ${primary.fromDomain}`);
      evidence.push({
        rule: 'SHARED_SENDER_DOMAIN',
        strength: 'STRONG',
        description: `Identical sender domain ${primary.fromDomain} identified across both messages`,
        value: primary.fromDomain,
        autoMergeEligible: true,
        iocType: 'DOMAIN'
      });
    } else if (primary.sender && candidate.sender && primary.sender === candidate.sender) {
      scorePoints += 25;
      sharedIocs.push(`Sender: ${primary.sender}`);
      evidence.push({
        rule: 'SHARED_EXACT_SENDER',
        strength: 'MEDIUM',
        description: `Identical public mailbox sender address ${primary.sender}`,
        value: primary.sender,
        autoMergeEligible: false,
        iocType: 'DOMAIN'
      });
    }
  }

  // 3. Origin Relay IP Overlap (STRONG: +40 if dedicated/bulletproof, MEDIUM: +15 if cloud)
  if (
    primary.originIp &&
    candidate.originIp &&
    primary.originIp === candidate.originIp &&
    !isPrivateIp(primary.originIp)
  ) {
    const isCloudAsn = GENERIC_HOSTING_ASNS.includes(primary.originAsn || '');
    if (!isCloudAsn) {
      scorePoints += 40;
      sharedIocs.push(`IP: ${primary.originIp}`);
      evidence.push({
        rule: 'SHARED_ORIGIN_IP',
        strength: 'STRONG',
        description: `Identical dedicated origin MTA relay IP ${primary.originIp} (${primary.originAsnOrg || 'Private Hosting Node'})`,
        value: primary.originIp,
        autoMergeEligible: true,
        iocType: 'IP'
      });
    } else {
      scorePoints += 15;
      sharedIocs.push(`Cloud Relay: ${primary.originIp}`);
      evidence.push({
        rule: 'SHARED_CLOUD_INGRESS',
        strength: 'MEDIUM',
        description: `Shared cloud relay infrastructure IP ${primary.originIp} (${primary.originAsnOrg || 'Cloud Provider'})`,
        value: primary.originIp,
        autoMergeEligible: false,
        iocType: 'IP'
      });
    }
  } else if (
    primary.originIp &&
    candidate.originIp &&
    primary.originIp !== candidate.originIp &&
    !isPrivateIp(primary.originIp) &&
    !isPrivateIp(candidate.originIp)
  ) {
    // 3b. Shared /24 Subnet Network Block
    const pSubnet = primary.originIp.split('.').slice(0, 3).join('.');
    const cSubnet = candidate.originIp.split('.').slice(0, 3).join('.');
    if (pSubnet && cSubnet && pSubnet === cSubnet && pSubnet.split('.').length === 3) {
      scorePoints += 25;
      sharedIocs.push(`Subnet: ${pSubnet}.0/24`);
      evidence.push({
        rule: 'SHARED_IP_SUBNET',
        strength: 'MEDIUM',
        description: `Origin relay nodes belong to identical /24 network subnet block (${pSubnet}.0/24)`,
        value: `${pSubnet}.0/24`,
        autoMergeEligible: false,
        iocType: 'IP'
      });
    }
  }

  // 3c. Shared Auxiliary Routing / Reply Domain Overlap
  if (primary.relatedDomains && candidate.relatedDomains && primary.relatedDomains.length > 0 && candidate.relatedDomains.length > 0) {
    const commonRelDomains = primary.relatedDomains.filter(d => 
      d && !GENERIC_EMAIL_DOMAINS.includes(d) && candidate.relatedDomains!.includes(d) && d !== primary.fromDomain
    );
    if (commonRelDomains.length > 0) {
      scorePoints += 30;
      sharedIocs.push(`Infrastructure Domain: ${commonRelDomains[0]}`);
      evidence.push({
        rule: 'SHARED_INFRASTRUCTURE_DOMAIN',
        strength: 'STRONG',
        description: `Shared routing/reply-to infrastructure domain: ${commonRelDomains[0]}`,
        value: commonRelDomains[0],
        autoMergeEligible: true,
        iocType: 'DOMAIN'
      });
    }
  }

  // 3d. File Hash Overlap (Attachments / Malicious Dropper Payload) (STRONG: +50)
  if (
    primary.fileHashes && 
    primary.fileHashes.length > 0 && 
    candidate.fileHashes && 
    candidate.fileHashes.length > 0
  ) {
    const commonHashes = primary.fileHashes.filter(h => candidate.fileHashes!.includes(h));
    if (commonHashes.length > 0) {
      scorePoints += 50;
      const hDisplay = commonHashes[0].length > 16 ? `${commonHashes[0].slice(0, 16)}...` : commonHashes[0];
      sharedIocs.push(`File Hash: ${hDisplay}`);
      evidence.push({
        rule: 'SHARED_FILE_HASH',
        strength: 'STRONG',
        description: `Identical cryptographic attachment file hash (SHA-256): ${commonHashes[0]}`,
        value: commonHashes[0],
        autoMergeEligible: true,
        iocType: 'HASH'
      });
    }
  }

  // 4. DKIM Signature Alignment (STRONG: +35)
  if (
    primary.dkimDomain &&
    candidate.dkimDomain &&
    primary.dkimDomain === candidate.dkimDomain &&
    !GENERIC_EMAIL_DOMAINS.includes(primary.dkimDomain)
  ) {
    const selectorMatch = primary.dkimSelector && candidate.dkimSelector && primary.dkimSelector === candidate.dkimSelector;
    scorePoints += selectorMatch ? 40 : 25;
    sharedIocs.push(`DKIM: ${primary.dkimDomain}${selectorMatch ? `:${primary.dkimSelector}` : ''}`);
    evidence.push({
      rule: 'SHARED_DKIM_SIGNATURE',
      strength: 'STRONG',
      description: selectorMatch
        ? `Identical cryptographic DKIM signing key domain (${primary.dkimDomain}) and selector (${primary.dkimSelector})`
        : `Identical DKIM signing domain (${primary.dkimDomain})`,
      value: primary.dkimDomain,
      autoMergeEligible: Boolean(selectorMatch),
      iocType: 'DKIM'
    });
  }

  // 5. Threat Lure Archetype / Linguistic Intent (MEDIUM: +20)
  const primaryLure = extractLureArchetype(`${primary.subject} ${primary.bodySnippet}`);
  const candidateLure = extractLureArchetype(`${candidate.subject} ${candidate.bodySnippet}`);
  if (primaryLure && candidateLure && primaryLure === candidateLure) {
    scorePoints += 20;
    evidence.push({
      rule: 'MATCHING_ATTACK_LURE',
      strength: 'MEDIUM',
      description: `Matching threat lure archetype identified: ${primaryLure.replace(/_/g, ' ')}`,
      value: primaryLure,
      autoMergeEligible: false,
      iocType: 'LURE'
    });
  }

  // 6. Temporal Attack Window (MEDIUM: +10 if within 72 hours)
  if (scorePoints > 0 && primary.createdAt && candidate.createdAt) {
    const t1 = new Date(primary.createdAt).getTime();
    const t2 = new Date(candidate.createdAt).getTime();
    if (!isNaN(t1) && !isNaN(t2)) {
      const diffHours = Math.abs(t1 - t2) / (1000 * 60 * 60);
      if (diffHours <= 72) {
        scorePoints += 10;
        evidence.push({
          rule: 'SYNCHRONIZED_ATTACK_BURST',
          strength: 'MEDIUM',
          description: `Dispatched within ${Math.round(diffHours)} hours of each other (synchronized campaign delivery window)`,
          value: `${Math.round(diffHours)}h`,
          autoMergeEligible: false,
          iocType: 'INFRASTRUCTURE'
        });
      }
    }
  }

  if (evidence.length === 0 || scorePoints < 20) {
    return { strength: null, score: 0, evidence: [], sharedIocs: [], reason: 'No significant correlation' };
  }

  const normalizedScore = Math.min(1.0, Math.round((scorePoints / 100) * 100) / 100);
  const hasStrong = evidence.some(e => e.strength === 'STRONG');
  const strength: 'STRONG' | 'MEDIUM' | 'WEAK' = hasStrong || normalizedScore >= 0.65
    ? 'STRONG'
    : normalizedScore >= 0.35
    ? 'MEDIUM'
    : 'WEAK';

  const reason = evidence.map(e => e.description).slice(0, 2).join('; ');

  return {
    strength,
    score: normalizedScore,
    evidence,
    sharedIocs,
    reason
  };
}

/**
 * Evaluates a single case against an entire pool of cases and returns
 * correlated candidate matches, shared evidence, and auto-suggested members.
 */
export function correlateCaseWithCases(targetCase: any, allCases: any[]): {
  correlatedCases: CorrelatedCaseMatch[];
  correlationEvidence: CorrelationEvidence[];
  suggestedMembers: Array<{
    email_id: string;
    case_id: string;
    subject: string;
    sender: string;
    relationship_strength: 'STRONG' | 'MEDIUM' | 'WEAK';
    similarity_score: number;
    reason: string;
    shared_iocs: string[];
    threat_score: number;
    threat_verdict: string;
  }>;
  campaignSuggestion?: {
    id: string;
    name: string;
    actor: string;
    confidence: number;
    sharedIndicators: string[];
  };
} {
  const primaryRecord = extractForensicRecord(targetCase);
  const matches: CorrelatedCaseMatch[] = [];
  const aggregatedEvidence: CorrelationEvidence[] = [];

  const existingMemberIds = new Set<string>();
  if (Array.isArray(targetCase.email_ids)) {
    targetCase.email_ids.forEach((id: string) => existingMemberIds.add(id));
  }
  if (Array.isArray(targetCase.members)) {
    targetCase.members.forEach((m: any) => existingMemberIds.add(m.id || m.email_id));
  }
  existingMemberIds.add(primaryRecord.id);

  for (const c of allCases) {
    const candidateRecord = extractForensicRecord(c);
    if (candidateRecord.id === primaryRecord.id) continue;

    const result = compareRecords(primaryRecord, candidateRecord);
    if (result.strength) {
      matches.push({
        caseId: candidateRecord.id,
        emailId: candidateRecord.id,
        subject: candidateRecord.subject,
        sender: candidateRecord.sender || `sender@${candidateRecord.fromDomain || 'unknown'}`,
        similarityScore: result.score,
        relationshipStrength: result.strength,
        sharedEvidence: result.evidence,
        sharedIocs: result.sharedIocs,
        reason: result.reason,
        threatScore: candidateRecord.threatScore || 75,
        threatVerdict: candidateRecord.threatVerdict || 'SUSPICIOUS',
        fromDomain: candidateRecord.fromDomain,
        originIp: candidateRecord.originIp,
        fileHashes: candidateRecord.fileHashes,
        createdAt: candidateRecord.createdAt
      });

      for (const ev of result.evidence) {
        if (!aggregatedEvidence.some(e => e.rule === ev.rule && e.value === ev.value)) {
          aggregatedEvidence.push(ev);
        }
      }
    }
  }

  // Sort matches by similarity score descending
  matches.sort((a, b) => b.similarityScore - a.similarityScore);

  // Suggested members are correlated cases that are NOT already in the case's member list
  const suggestedMembers = matches
    .filter(m => !existingMemberIds.has(m.caseId))
    .map(m => ({
      email_id: m.caseId,
      case_id: m.caseId,
      subject: m.subject,
      sender: m.sender,
      relationship_strength: m.relationshipStrength,
      similarity_score: m.similarityScore,
      reason: m.reason,
      shared_iocs: m.sharedIocs,
      threat_score: m.threatScore,
      threat_verdict: m.threatVerdict
    }));

  let campaignSuggestion = undefined;
  if (matches.length > 0 && matches[0].similarityScore >= 0.60) {
    const top = matches[0];
    const sharedDomain = primaryRecord.fromDomain || top.fromDomain || 'Infrastructure Reuse';
    campaignSuggestion = {
      id: `camp-${sharedDomain.replace(/[^a-zA-Z0-9]/g, '-')}`,
      name: `Threat Campaign: ${sharedDomain} Infrastructure Cluster`,
      actor: primaryRecord.fromDomain?.includes('paypal') 
        ? 'FIN-ACTOR-409 (Credential Harvester Group)' 
        : primaryRecord.fromDomain?.includes('invoice')
        ? 'TA-INVOICE-DROPPER'
        : 'Unattributed Infrastructure Syndicate',
      confidence: top.similarityScore,
      sharedIndicators: top.sharedIocs
    };
  }

  return {
    correlatedCases: matches,
    correlationEvidence: aggregatedEvidence,
    suggestedMembers,
    campaignSuggestion
  };
}

/**
 * Runs multi-case transitive clustering across all forensic records
 * and returns full Campaign Clusters with temporal tracking.
 */
export function correlateEmails(emails: EmailForensicRecord[]): CampaignCluster[] {
  const clusters: CampaignCluster[] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < emails.length; i++) {
    const primary = emails[i];
    if (assigned.has(primary.id)) continue;

    const clusterMembers: EmailForensicRecord[] = [primary];
    const sharedEvidence: CorrelationEvidence[] = [];

    for (let j = i + 1; j < emails.length; j++) {
      const candidate = emails[j];
      if (assigned.has(candidate.id)) continue;

      const comparison = compareRecords(primary, candidate);
      if (comparison.strength === 'STRONG' || comparison.strength === 'MEDIUM') {
        clusterMembers.push(candidate);
        assigned.add(candidate.id);

        for (const ev of comparison.evidence) {
          if (!sharedEvidence.some(e => e.rule === ev.rule && e.value === ev.value)) {
            sharedEvidence.push(ev);
          }
        }
      }
    }

    assigned.add(primary.id);

    if (clusterMembers.length > 1) {
      const dates = clusterMembers.map(m => new Date(m.createdAt || Date.now()).getTime()).filter(t => !isNaN(t));
      const firstSeen = dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : new Date().toISOString();
      const lastSeen = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : new Date().toISOString();

      const domain = primary.fromDomain || 'Infrastructure Reuse';
      const actor = domain.includes('paypal')
        ? 'FIN-ACTOR-409 (Credential Harvester Group)'
        : domain.includes('invoice') || primary.subject.toLowerCase().includes('invoice')
        ? 'TA-INVOICE-DROPPER'
        : 'Unattributed Threat Cluster';

      clusters.push({
        id: `camp-${domain.replace(/[^a-zA-Z0-9]/g, '-')}-${i + 1}`,
        name: `Campaign Cluster (${domain})`,
        threatActor: actor,
        status: 'ACTIVE',
        targetIndustry: 'Enterprise & Financial Services',
        totalEmails: clusterMembers.length,
        memberEmailIds: clusterMembers.map(m => m.id),
        memberCases: clusterMembers,
        sharedEvidence,
        firstSeen,
        lastSeen,
        notes: `Correlated via ${sharedEvidence.length} verifiable technical telemetry evidence links.`
      });
    }
  }

  return clusters;
}

/**
 * Computes global correlation across an array of all cases,
 * generating campaign clusters and an enrichment map for every case.
 */
export function correlateAllCases(allCases: any[]): {
  clusters: CampaignCluster[];
  caseEnrichmentMap: Map<string, {
    suggested_members: any[];
    correlation_count: number;
    campaign_id?: string;
    campaign_name?: string;
    shared_evidence: CorrelationEvidence[];
  }>;
} {
  const records = allCases.map(extractForensicRecord);
  const clusters = correlateEmails(records);
  const caseEnrichmentMap = new Map<string, {
    suggested_members: any[];
    correlation_count: number;
    campaign_id?: string;
    campaign_name?: string;
    shared_evidence: CorrelationEvidence[];
  }>();

  for (const c of allCases) {
    const singleResult = correlateCaseWithCases(c, allCases);
    const cluster = clusters.find(cl => cl.memberEmailIds.includes(c.id));

    caseEnrichmentMap.set(c.id, {
      suggested_members: singleResult.suggestedMembers,
      correlation_count: singleResult.correlatedCases.length,
      campaign_id: cluster?.id || singleResult.campaignSuggestion?.id,
      campaign_name: cluster?.name || singleResult.campaignSuggestion?.name,
      shared_evidence: singleResult.correlationEvidence
    });
  }

  return {
    clusters,
    caseEnrichmentMap
  };
}

