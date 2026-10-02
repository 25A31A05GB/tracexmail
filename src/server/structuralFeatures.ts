/**
 * TraceXMail Structural Identity-Consistency & Forensic Feature Extraction Engine
 * Provides deterministic, explainable feature extraction for ML classification & heuristic scoring.
 * Enforces identity consistency between From Header, Display Name, Reply-To, Return-Path,
 * and Authoritative DNS / Cryptographic Authentication.
 */

import fs from 'fs';
import path from 'path';

export interface BrandDefinition {
  id: string;
  name: string;
  legitimateDomains: string[];
  keywords: string[];
  regex: string;
}

export interface BrandConfig {
  version: string;
  brands: BrandDefinition[];
}

// Fallback brands if config file cannot be read
const DEFAULT_BRANDS: BrandDefinition[] = [
  {
    id: 'paypal',
    name: 'PayPal',
    legitimateDomains: ['paypal.com', 'paypal.co.uk', 'paypal.de', 'paypal-communication.com'],
    keywords: ['paypal', 'pay pal'],
    regex: '\\b(?:pay\\s*pal|paypal)\\b'
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    legitimateDomains: ['microsoft.com', 'office365.com', 'office.com', 'microsoftonline.com', 'outlook.com', 'live.com'],
    keywords: ['microsoft', 'office 365', 'office365', 'm365', 'outlook', 'microsoft 365'],
    regex: '\\b(?:microsoft|office\\s*365|m365|outlook|microsoftonline|microsoft\\s*365)\\b'
  },
  {
    id: 'google',
    name: 'Google',
    legitimateDomains: ['google.com', 'google.co.uk', 'gmail.com', 'googlemail.com'],
    keywords: ['google', 'gmail', 'google workspace', 'google drive'],
    regex: '\\b(?:google|gmail|google\\s*workspace|google\\s*drive)\\b'
  },
  {
    id: 'apple',
    name: 'Apple',
    legitimateDomains: ['apple.com', 'icloud.com', 'appleid.apple.com'],
    keywords: ['apple', 'icloud', 'apple id', 'apple support'],
    regex: '\\b(?:apple|icloud|apple\\s*id|apple\\s*support)\\b'
  },
  {
    id: 'docusign',
    name: 'DocuSign',
    legitimateDomains: ['docusign.com', 'docusign.net'],
    keywords: ['docusign', 'docu sign'],
    regex: '\\b(?:docusign|docu\\s*sign)\\b'
  },
  {
    id: 'amazon',
    name: 'Amazon',
    legitimateDomains: ['amazon.com', 'amazon.co.uk', 'amazonaws.com'],
    keywords: ['amazon', 'aws', 'amazon web services'],
    regex: '\\b(?:amazon|amazonaws|aws)\\b'
  },
  {
    id: 'chase',
    name: 'Chase Bank',
    legitimateDomains: ['chase.com', 'jpmorgan.com'],
    keywords: ['chase', 'jpmorgan', 'chase online'],
    regex: '\\b(?:chase|jpmorgan)\\b'
  },
  {
    id: 'bankofamerica',
    name: 'Bank of America',
    legitimateDomains: ['bankofamerica.com', 'bofa.com'],
    keywords: ['bank of america', 'bofa'],
    regex: '\\b(?:bank\\s*of\\s*america|bofa)\\b'
  },
  {
    id: 'wellsfargo',
    name: 'Wells Fargo',
    legitimateDomains: ['wellsfargo.com'],
    keywords: ['wells fargo', 'wellsfargo'],
    regex: '\\b(?:wells\\s*fargo|wellsfargo)\\b'
  },
  {
    id: 'netflix',
    name: 'Netflix',
    legitimateDomains: ['netflix.com'],
    keywords: ['netflix'],
    regex: '\\b(?:netflix)\\b'
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    legitimateDomains: ['dropbox.com'],
    keywords: ['dropbox'],
    regex: '\\b(?:dropbox)\\b'
  },
  {
    id: 'stripe',
    name: 'Stripe',
    legitimateDomains: ['stripe.com'],
    keywords: ['stripe'],
    regex: '\\b(?:stripe)\\b'
  },
  {
    id: 'github',
    name: 'GitHub',
    legitimateDomains: ['github.com'],
    keywords: ['github'],
    regex: '\\b(?:github)\\b'
  },
  {
    id: 'fedex',
    name: 'FedEx',
    legitimateDomains: ['fedex.com'],
    keywords: ['fedex'],
    regex: '\\b(?:fedex)\\b'
  },
  {
    id: 'ups',
    name: 'UPS',
    legitimateDomains: ['ups.com'],
    keywords: ['ups'],
    regex: '\\b(?:ups)\\b'
  }
];

let cachedBrands: BrandDefinition[] | null = null;

export function loadBrandDefinitions(): BrandDefinition[] {
  if (cachedBrands) return cachedBrands;
  try {
    const configPath = path.join(process.cwd(), 'config', 'brand_domains.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed: BrandConfig = JSON.parse(raw);
      if (parsed.brands && Array.isArray(parsed.brands)) {
        cachedBrands = parsed.brands;
        return cachedBrands;
      }
    }
  } catch (e) {
    console.warn('[BrandConfig] Failed to load config/brand_domains.json, using defaults:', e);
  }
  cachedBrands = DEFAULT_BRANDS;
  return cachedBrands;
}

/**
 * Extracts pure domain from an email address or domain string.
 */
export function extractDomain(inputStr: string): string {
  if (!inputStr) return '';
  const match = inputStr.match(/@([a-zA-Z0-9.-]+)/);
  if (match) return match[1].toLowerCase().trim();
  return inputStr.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
}

/**
 * Checks for punycode or obvious homoglyph indicators in domain.
 */
export function isPunycodeOrHomoglyph(domain: string): boolean {
  if (!domain) return false;
  if (domain.startsWith('xn--') || domain.includes('.xn--')) return true;
  // Cyrillic/Greek character ranges mixed in domain
  if (/[\u0400-\u04FF\u0370-\u03FF]/.test(domain)) return true;
  return false;
}

export interface StructuralIdentityEvaluation {
  claimedBrand: string | null;
  isBrandDomainAligned: boolean;
  isBrandDisplayMismatch: boolean;
  isLookalikeDomain: boolean;
  lookalikePattern: string | null;
  isReplyToMismatch: boolean;
  isReturnPathMismatch: boolean;
  isPunycode: boolean;
  structuralTokens: string[];
}

/**
 * Evaluates structural consistency across sender headers, display name, and brand registries.
 */
export function evaluateStructuralIdentity(input: {
  from: string;
  fromDomain?: string;
  replyTo?: string;
  returnPath?: string;
  auth?: {
    spf?: { status?: string };
    dkim?: { status?: string };
    dmarc?: { status?: string; policy?: string };
  };
  domainIntelligence?: {
    status?: string;
    is_newly_registered?: boolean;
    domain_age_days?: number;
    mx_missing?: boolean;
    typosquatting?: { is_typosquat?: boolean; target_brand?: string };
  };
  hops?: Array<{ isTor?: boolean; is_tor?: boolean; abuseScore?: number }>;
}): StructuralIdentityEvaluation {
  const brands = loadBrandDefinitions();
  const from = input.from || '';
  const fromDomain = (input.fromDomain || extractDomain(from)).toLowerCase();
  const replyTo = input.replyTo || '';
  const returnPath = input.returnPath || '';

  const replyDomain = extractDomain(replyTo);
  const returnDomain = extractDomain(returnPath);

  let claimedBrand: string | null = null;
  let isBrandDomainAligned = false;
  let isBrandDisplayMismatch = false;
  let isLookalikeDomain = false;
  let lookalikePattern: string | null = null;

  const structuralTokens: string[] = [];

  // 1. Sender Domain Token
  if (fromDomain) {
    structuralTokens.push(`domain_${fromDomain.replace(/[^a-z0-9]/g, '_')}`);
  }

  // 2. Punycode check
  const isPunycode = isPunycodeOrHomoglyph(fromDomain);
  if (isPunycode) {
    structuralTokens.push('feat_lookalike_punycode');
    structuralTokens.push('feat_impersonation_cue');
  }

  // 3. Brand & Display Name Spoofing
  const lowerFrom = from.toLowerCase();
  for (const b of brands) {
    let matchesDisplayName = false;
    try {
      const rx = new RegExp(b.regex, 'i');
      matchesDisplayName = rx.test(lowerFrom);
    } catch {
      matchesDisplayName = b.keywords.some(k => lowerFrom.includes(k.toLowerCase()));
    }

    if (matchesDisplayName) {
      claimedBrand = b.name;
      structuralTokens.push(`feat_brand_ref_${b.id}`);

      const isLegitDomain = b.legitimateDomains.some(ld =>
        fromDomain === ld || fromDomain.endsWith('.' + ld)
      );

      if (isLegitDomain) {
        isBrandDomainAligned = true;
        structuralTokens.push('feat_brand_domain_aligned');
      } else {
        isBrandDisplayMismatch = true;
        structuralTokens.push('feat_brand_display_domain_mismatch');
        structuralTokens.push('feat_impersonation_cue');
      }
    }

    // Check lookalike patterns in domain name (e.g. paypal-security.com, verify-docusign.net)
    const isAuthenticBrandDomain = b.legitimateDomains.some(ld =>
      fromDomain === ld || fromDomain.endsWith('.' + ld)
    );
    if (fromDomain && !isAuthenticBrandDomain) {
      if (
        fromDomain.includes(`${b.id}-`) ||
        fromDomain.includes(`-${b.id}`) ||
        fromDomain.includes(`${b.id}.`) ||
        (fromDomain.includes(b.id) && fromDomain.length > b.id.length + 4)
      ) {
        isLookalikeDomain = true;
        lookalikePattern = `Hyphenated/Compound Lookalike of ${b.name}`;
        structuralTokens.push('feat_lookalike_hyphenated_brand');
        structuralTokens.push(`feat_lookalike_brand_${b.id}`);
        structuralTokens.push('feat_impersonation_cue');
      }
    }
  }

  // 4. Reply-To Mismatch
  const isReplyToMismatch = Boolean(replyDomain && fromDomain && replyDomain !== fromDomain);
  if (isReplyToMismatch) {
    structuralTokens.push('feat_reply_to_mismatch');
  }

  // 5. Return-Path Mismatch (Excludes legitimate ESP bounce infrastructure like Google gaia.bounces / Microsoft prod.outlook)
  const isEspBounceAligned = Boolean(
    (fromDomain === 'gmail.com' || fromDomain.endsWith('.google.com') || fromDomain === 'google.com') &&
    (returnDomain.endsWith('.google.com') || returnDomain === 'google.com' || returnDomain === 'gmail.com')
  ) || Boolean(
    (fromDomain === 'outlook.com' || fromDomain.endsWith('.microsoft.com') || fromDomain === 'microsoft.com') &&
    (returnDomain.endsWith('.outlook.com') || returnDomain.endsWith('.microsoft.com') || returnDomain.endsWith('.office365.com'))
  );

  const isReturnPathMismatch = Boolean(returnDomain && fromDomain && returnDomain !== fromDomain && !isEspBounceAligned);
  if (isReturnPathMismatch) {
    structuralTokens.push('feat_return_path_mismatch');
  }

  // 6. Cryptographic Authentication Signals
  const spfStatus = (input.auth?.spf?.status || '').toUpperCase();
  if (spfStatus === 'PASS') structuralTokens.push('feat_auth_spf_pass');
  else if (spfStatus === 'FAIL') {
    structuralTokens.push('feat_auth_spf_fail');
    structuralTokens.push('feat_impersonation_cue');
  } else if (spfStatus === 'SOFTFAIL') structuralTokens.push('feat_auth_spf_softfail');
  else structuralTokens.push('feat_auth_spf_none');

  const dkimStatus = (input.auth?.dkim?.status || '').toUpperCase();
  if (dkimStatus === 'PASS') structuralTokens.push('feat_auth_dkim_pass');
  else if (dkimStatus === 'FAIL' || dkimStatus === 'INVALID') {
    structuralTokens.push('feat_auth_dkim_fail');
    structuralTokens.push('feat_impersonation_cue');
  } else structuralTokens.push('feat_auth_dkim_none');

  const dmarcStatus = (input.auth?.dmarc?.status || '').toUpperCase();
  if (dmarcStatus === 'PASS') structuralTokens.push('feat_auth_dmarc_pass');
  else if (dmarcStatus === 'FAIL' || dmarcStatus === 'REJECT') {
    structuralTokens.push('feat_auth_dmarc_fail');
    structuralTokens.push('feat_impersonation_cue');
  } else structuralTokens.push('feat_auth_dmarc_none');

  // 7. Domain Intelligence Signals
  if (input.domainIntelligence?.status === 'nxdomain') {
    structuralTokens.push('feat_nxdomain');
  }
  if (input.domainIntelligence?.is_newly_registered || (input.domainIntelligence?.domain_age_days !== undefined && input.domainIntelligence.domain_age_days < 30)) {
    structuralTokens.push('feat_newly_registered_domain');
  }
  if (input.domainIntelligence?.mx_missing) {
    structuralTokens.push('feat_mx_missing');
  }

  // 8. Routing / Tor Signals
  if (input.hops?.some(h => h.isTor || h.is_tor || (h.abuseScore && h.abuseScore > 60))) {
    structuralTokens.push('feat_anonymized_relay_tor');
  }

  return {
    claimedBrand,
    isBrandDomainAligned,
    isBrandDisplayMismatch,
    isLookalikeDomain,
    lookalikePattern,
    isReplyToMismatch,
    isReturnPathMismatch,
    isPunycode,
    structuralTokens
  };
}

/**
 * Standard unified tokenizer that extracts NLP tokens, n-grams, and structural identity features.
 * Guaranteed to produce identical feature tokens across Training, Standalone Verification, and Runtime Inference.
 */
export function extractForensicTokens(input: {
  subject: string;
  from?: string;
  fromDomain?: string;
  bodyText?: string;
  text?: string;
  replyTo?: string;
  returnPath?: string;
  auth?: {
    spf?: { status?: string };
    dkim?: { status?: string };
    dmarc?: { status?: string; policy?: string };
  };
  domainIntelligence?: {
    status?: string;
    is_newly_registered?: boolean;
    domain_age_days?: number;
    mx_missing?: boolean;
    typosquatting?: { is_typosquat?: boolean; target_brand?: string };
  };
  hops?: Array<{ isTor?: boolean; is_tor?: boolean; abuseScore?: number }>;
  options?: {
    includeCharNgrams?: boolean;
  };
}): string[] {
  const subject = input.subject || '';
  const body = input.bodyText || input.text || '';
  const from = input.from || '';
  const fromDomain = (input.fromDomain || extractDomain(from)).toLowerCase();
  const includeCharNgrams = input.options?.includeCharNgrams ?? true;

  const combined = `${subject} ${subject} ${from} ${fromDomain} ${body.slice(0, 4000)}`;
  // Strip zero-width & invisible format characters used in bypass attacks (e.g. \u200B-\u200D, \uFEFF, \u00AD, \u2060)
  const cleanZeroWidth = combined.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060]/g, '');
  const normalized = cleanZeroWidth
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, ' url_token ')
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, ' ip_token ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = normalized.split(' ').filter(w => w.length >= 2 && w.length <= 25);
  const tokens: string[] = [...words];

  // Word bigrams for syntactic pattern detection
  for (let i = 0; i < words.length - 1; i++) {
    tokens.push(`${words[i]}_${words[i + 1]}`);
  }

  // Character 3-gram and 4-gram features (Phase C1: catch obfuscations, homoglyphs & spaced words)
  if (includeCharNgrams) {
    const seenCharNgrams = new Set<string>();
    for (const word of words) {
      if (word === 'url_token' || word === 'ip_token') continue;
      // 3-grams
      if (word.length >= 3) {
        for (let i = 0; i <= word.length - 3; i++) {
          const g3 = `__c3_${word.slice(i, i + 3)}`;
          if (!seenCharNgrams.has(g3)) {
            seenCharNgrams.add(g3);
            tokens.push(g3);
          }
        }
      }
      // 4-grams
      if (word.length >= 4) {
        for (let i = 0; i <= word.length - 4; i++) {
          const g4 = `__c4_${word.slice(i, i + 4)}`;
          if (!seenCharNgrams.has(g4)) {
            seenCharNgrams.add(g4);
            tokens.push(g4);
          }
        }
      }
    }

    // Catch space-obfuscated words (e.g. 'c l i c k' -> 'click', 'p a y p a l' -> 'paypal')
    const singleLetterSeqMatch = normalized.match(/\b(?:[a-z0-9]\s+){2,}[a-z0-9]\b/g);
    if (singleLetterSeqMatch) {
      for (const seq of singleLetterSeqMatch) {
        const collapsed = seq.replace(/\s+/g, '');
        if (collapsed.length >= 3) {
          for (let i = 0; i <= collapsed.length - 3; i++) {
            const g3 = `__c3_${collapsed.slice(i, i + 3)}`;
            if (!seenCharNgrams.has(g3)) {
              seenCharNgrams.add(g3);
              tokens.push(g3);
            }
          }
        }
        if (collapsed.length >= 4) {
          for (let i = 0; i <= collapsed.length - 4; i++) {
            const g4 = `__c4_${collapsed.slice(i, i + 4)}`;
            if (!seenCharNgrams.has(g4)) {
              seenCharNgrams.add(g4);
              tokens.push(g4);
            }
          }
        }
      }
    }
  }

  // Evaluate and inject structural identity features
  const structuralEval = evaluateStructuralIdentity({
    from,
    fromDomain,
    replyTo: input.replyTo,
    returnPath: input.returnPath,
    auth: input.auth,
    domainIntelligence: input.domainIntelligence,
    hops: input.hops
  });

  tokens.push(...structuralEval.structuralTokens);

  // Expanded deterministic linguistic semantic cues
  const seScores = getWeightedSocialEngineeringScore(combined);
  const finEntities = extractFinancialEntities(combined);

  if (finEntities.hasFinancialEntities || /(?:wire|direct deposit|payroll|w-2|gift card|invoice|remittance|swift transfer|routing number|escrow|bank details|ach debit)/i.test(combined)) {
    tokens.push('__cue_fraud_wire__');
  }
  if (seScores.urgency > 0.1 || seScores.fear_threat > 0.1 || /(?:urgent|immediate|account suspended|password expired|verify your identity|unauthorized access|restricted|unlock account|confirm credentials)/i.test(combined)) {
    tokens.push('__cue_phish_urgency__');
  }
  if (seScores.authority > 0.2) {
    tokens.push('__cue_authority__');
  }
  if (seScores.secrecy_isolation > 0.2) {
    tokens.push('__cue_secrecy__');
  }
  if (seScores.reward > 0.2) {
    tokens.push('__cue_reward__');
  }
  if (/(?:unsubscribe|newsletter|discount|promo|b2b leads|opt-out|voucher|cold outbound|pipeline|webinar)/i.test(combined)) {
    tokens.push('__cue_marketing_promo__');
  }
  if (/(?:github|commit|pull request|jira|slack|gitlab|standup|meeting notes|agenda|aws billing|cloud run|datadog|receipt)/i.test(combined)) {
    tokens.push('__cue_legitimate_work__');
  }

  return tokens;
}

// ============================================================================
// LAYER 3: Expanded, Weighted Social Engineering Lexicons & Deterministic Entity Extractor
// (Free, deterministic zero-API-key baseline)
// ============================================================================

export const AUTHORITY_CUES: string[] = [
  'chief executive officer', 'ceo', 'cfo', 'coo', 'cio', 'ciso',
  'executive office', 'board of directors', 'managing director', 'president',
  'office of the president', 'general counsel', 'legal department', 'compliance team',
  'internal audit', 'information security department', 'system administrator',
  'security operations center', 'it helpdesk', 'human resources director',
  'payroll director', 'controller', 'vice president of finance',
  'head of finance', 'supervisory authority', 'law enforcement', 'internal revenue service',
  'irs notice', 'federal bureau', 'corporate headquarters', 'authorized corporate officer'
];

export const URGENCY_CUES: string[] = [
  'urgent', 'urgently', 'immediately', 'immediate action required',
  'within 24 hours', 'within 12 hours', 'within 48 hours', 'within 2 hours',
  'strict deadline', 'critical deadline', 'time-sensitive', 'act now',
  'do not delay', 'final notice', 'last warning', 'expiring soon',
  'expires today', 'expires in 24 hours', 'critical notice', 'prompt attention',
  'mandatory update', 'immediate response required', 'before close of business',
  'by end of day', 'by today', 'account closure imminent', 'action required immediately',
  'terminate access immediately', 'requires your urgent review'
];

export const FEAR_THREAT_CUES: string[] = [
  'account suspended', 'account locked', 'unauthorized access', 'security breach',
  'policy violation', 'access revoked', 'legal action', 'court subpoena',
  'arrest warrant', 'termination of service', 'frozen assets', 'fraud alert',
  'suspicious activity detected', 'penalty fee', 'account restriction',
  'disciplinary action', 'audit finding', 'failure to comply', 'security alert',
  'unusual login attempt', 'access restricted', 'security compromised',
  'breach of policy', 'blacklisted sender', 'revocation notice', 'pending litigation'
];

export const SECRECY_ISOLATION_CUES: string[] = [
  'strictly confidential', 'keep this confidential', 'do not discuss with colleagues',
  'private matter', 'discrete assistance', 'discreet transaction', 'do not call me',
  'handle privately', 'sensitive acquisition', 'bypass normal channels',
  'out of the office', 'currently in a meeting', 'do not forward this email',
  'keep this quiet', 'between you and me', 'sole discretion',
  'undisclosed transaction', 'no phone calls', 'privileged communication',
  'do not mention to it', 'keep off the record', 'unannounced acquisition',
  'sensitive personnel matter', 'executive discretion required'
];

export const REWARD_CUES: string[] = [
  'bonus payment', 'unclaimed funds', 'lottery prize', 'settlement payout',
  'grant approval', 'crypto reward', 'cashback refund', 'compensation fund',
  'exclusive gift', 'dividend distribution', 'inheritance beneficiary',
  'special dividend', 'financial gift', 'overpayment refund', 'voucher reward',
  'million dollars', 'funds credited', 'claim your prize', 'reimbursement check',
  'welfare benefit', 'approved grant', 'congratulations you won',
  'payment release', 'guaranteed return', 'windfall allocation'
];

/**
 * Validates an International Bank Account Number (IBAN) using ISO 13616 Modulo 97-10 check.
 */
export function isValidIban(iban: string): boolean {
  const clean = iban.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$/.test(clean)) {
    return false;
  }
  // Move first 4 characters to the end
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  // Convert letters to numbers A=10 .. Z=35
  let numericString = '';
  for (let i = 0; i < rearranged.length; i++) {
    const code = rearranged.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      numericString += (code - 55).toString();
    } else {
      numericString += rearranged[i];
    }
  }

  // Modulo 97 on large numeric string using BigInt
  try {
    return BigInt(numericString) % 97n === 1n;
  } catch {
    return false;
  }
}

/**
 * Validates a US 9-digit ABA Routing Transit Number using official Federal Reserve checksum:
 * 3*(d0 + d3 + d6) + 7*(d1 + d4 + d7) + 1*(d2 + d5 + d8) mod 10 === 0
 */
export function isValidAbaRoutingNumber(routing: string): boolean {
  const clean = routing.replace(/[\s-]/g, '');
  if (!/^\d{9}$/.test(clean)) return false;
  const digits = clean.split('').map(d => parseInt(d, 10));
  const checksum = (
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    1 * (digits[2] + digits[5] + digits[8])
  ) % 10;
  return checksum === 0;
}

export interface FinancialEntitiesResult {
  dollarAmounts: string[];
  ibanNumbers: string[];
  routingNumbers: string[];
  bankAccountCandidates: string[];
  hasFinancialEntities: boolean;
  totalAmountsCount: number;
}

/**
 * Deterministic Financial Entity Extractor:
 * Extracts dollar/currency amounts, verified IBANs, ABA routing numbers, and bank account patterns.
 */
export function extractFinancialEntities(text: string): FinancialEntitiesResult {
  if (!text) {
    return {
      dollarAmounts: [],
      ibanNumbers: [],
      routingNumbers: [],
      bankAccountCandidates: [],
      hasFinancialEntities: false,
      totalAmountsCount: 0
    };
  }

  const dollarAmounts: string[] = [];
  const ibanNumbers: string[] = [];
  const routingNumbers: string[] = [];
  const bankAccountCandidates: string[] = [];

  // 1. Dollar / Currency patterns ($1,200.00, 50,000 USD, €45,000, etc.)
  const currencyRegex = /(?:\$|€|£|¥)\s*[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|\b[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?\s*(?:USD|dollars?|EUR|euros?|GBP|pounds?|CAD|AUD)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = currencyRegex.exec(text)) !== null) {
    const val = match[0].trim();
    if (!dollarAmounts.includes(val)) {
      dollarAmounts.push(val);
    }
  }

  // 2. IBAN Candidates
  const ibanRegex = /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}\b/g;
  while ((match = ibanRegex.exec(text.toUpperCase())) !== null) {
    const cand = match[0];
    if (isValidIban(cand) && !ibanNumbers.includes(cand)) {
      ibanNumbers.push(cand);
    }
  }

  // 3. ABA Routing Number Candidates (9 consecutive digits or formatted XXX-XXX-XXX)
  const routingRegex = /\b(?:\d{3}[-\s]?\d{3}[-\s]?\d{3}|\d{9})\b/g;
  while ((match = routingRegex.exec(text)) !== null) {
    const digitsOnly = match[0].replace(/[-\s]/g, '');
    if (digitsOnly.length === 9 && isValidAbaRoutingNumber(digitsOnly)) {
      if (!routingNumbers.includes(digitsOnly)) {
        routingNumbers.push(digitsOnly);
      }
    }
  }

  // 4. Bank Account / Wire Instruction context cues
  const accountPattern = /(?:account|acct|iban|routing|swift|sort\s*code|beneficiary\s*bank|bank\s*name)\s*(?:#|no\.?|num\.?|number|id)?[:\s]+([A-Z0-9-]{5,34})/gi;
  while ((match = accountPattern.exec(text)) !== null) {
    const matchedAccount = match[1].trim();
    if (matchedAccount && !bankAccountCandidates.includes(matchedAccount)) {
      bankAccountCandidates.push(matchedAccount);
    }
  }

  const hasFinancialEntities = dollarAmounts.length > 0 ||
    ibanNumbers.length > 0 ||
    routingNumbers.length > 0 ||
    bankAccountCandidates.length > 0;

  return {
    dollarAmounts,
    ibanNumbers,
    routingNumbers,
    bankAccountCandidates,
    hasFinancialEntities,
    totalAmountsCount: dollarAmounts.length
  };
}

/**
 * Computes match density (0.0 to 1.0) for categorized social engineering lexicons.
 */
export function getWeightedSocialEngineeringScore(text: string): Record<string, number> {
  if (!text) {
    return {
      authority: 0,
      urgency: 0,
      fear_threat: 0,
      secrecy_isolation: 0,
      reward: 0,
      composite_density: 0
    };
  }

  const lower = text.toLowerCase();
  const wordCount = Math.max(1, lower.split(/\s+/).length);

  const countMatches = (cues: string[]) => {
    let count = 0;
    for (const phrase of cues) {
      if (lower.includes(phrase)) {
        count++;
      }
    }
    return count;
  };

  const authMatches = countMatches(AUTHORITY_CUES);
  const urgencyMatches = countMatches(URGENCY_CUES);
  const fearMatches = countMatches(FEAR_THREAT_CUES);
  const secrecyMatches = countMatches(SECRECY_ISOLATION_CUES);
  const rewardMatches = countMatches(REWARD_CUES);

  // Density scoring: 1 match = ~0.35, 2 matches = ~0.70, 3+ matches = 1.0, adjusted by document length
  const scoreCategory = (matches: number) => {
    if (matches === 0) return 0;
    const base = Math.min(1.0, matches * 0.35);
    const densityBoost = Math.min(0.2, (matches / Math.sqrt(wordCount)) * 2);
    return parseFloat(Math.min(1.0, base + densityBoost).toFixed(3));
  };

  const authority = scoreCategory(authMatches);
  const urgency = scoreCategory(urgencyMatches);
  const fear_threat = scoreCategory(fearMatches);
  const secrecy_isolation = scoreCategory(secrecyMatches);
  const reward = scoreCategory(rewardMatches);

  const totalMatches = authMatches + urgencyMatches + fearMatches + secrecyMatches + rewardMatches;
  const composite_density = parseFloat(Math.min(1.0, (authority * 0.25 + urgency * 0.30 + fear_threat * 0.20 + secrecy_isolation * 0.15 + reward * 0.10)).toFixed(3));

  return {
    authority,
    urgency,
    fear_threat,
    secrecy_isolation,
    reward,
    composite_density,
    totalMatches
  };
}
