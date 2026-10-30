/**
 * TraceXMail PII Stripping and Anonymization Engine
 * 
 * Complies with Step 2: Strip or hash personal data (names, email addresses, phone numbers)
 * before storing records; keep only what features need (domain, security signals, attack vectors).
 */

import crypto from 'crypto';

export interface PiiSanitizationStats {
  emailsHashed: number;
  phoneNumbersRedacted: number;
  namesRedacted: number;
  financialIdsRedacted: number;
}

export interface SanitizedRecordFields {
  subject: string;
  text: string;
  from: string;
  fromDomain: string;
  replyTo?: string;
  returnPath?: string;
  stats: PiiSanitizationStats;
}

// Well-known corporate brands, cloud providers, and security systems to preserve as entities
const PRESERVED_ORGANIZATIONAL_NAMES = new Set([
  'google', 'google security', 'google workspace',
  'microsoft', 'microsoft 365', 'microsoft security', 'office 365',
  'paypal', 'paypal security', 'paypal support',
  'apple', 'apple support', 'icloud',
  'amazon', 'amazon web services', 'aws', 'aws billing',
  'github', 'github security',
  'stripe', 'docusign', 'netflix', 'dropbox',
  'chase', 'bank of america', 'wells fargo', 'citigroup',
  'it support', 'system administrator', 'security operations', 'helpdesk', 'compliance team'
]);

/**
 * Deterministically pseudonymizes personal local-parts of email addresses.
 * Preserves the domain for sender reputation and spoofing analysis.
 * Example: "john.smith@gmail.com" -> "[USR_a1b2c3d4]@gmail.com"
 */
export function hashEmailAddress(emailStr: string, salt: string = 'tracexmail_pii_salt_2026'): string {
  const match = emailStr.match(/^(.*?)<([^>]+)>$/);
  const rawAddr = match ? match[2].trim() : emailStr.trim();
  const displayName = match ? match[1].trim() : '';

  const atPos = rawAddr.lastIndexOf('@');
  if (atPos === -1) {
    return emailStr;
  }

  const localPart = rawAddr.slice(0, atPos);
  const domainPart = rawAddr.slice(atPos + 1).toLowerCase();

  // If local part is a generic role account, keep it (e.g. no-reply, support, admin, security, alerts)
  const isGenericRole = /^(no-?reply|support|billing|alerts?|security|helpdesk|admin|info|contact|notifications?)$/i.test(localPart);
  let pseudonymizedLocal: string;

  if (isGenericRole) {
    pseudonymizedLocal = localPart.toLowerCase();
  } else {
    const hash = crypto.createHmac('sha256', salt).update(localPart.toLowerCase()).digest('hex').slice(0, 8);
    pseudonymizedLocal = `usr_${hash}`;
  }

  const sanitizedEmail = `${pseudonymizedLocal}@${domainPart}`;

  if (displayName) {
    const sanitizedName = sanitizeDisplayName(displayName);
    return `${sanitizedName} <${sanitizedEmail}>`;
  }

  return sanitizedEmail;
}

/**
 * Strips personal names from display names, preserving organizational and role-based names.
 */
export function sanitizeDisplayName(nameStr: string): string {
  const cleaned = nameStr.replace(/["']/g, '').trim();
  if (!cleaned) return '';

  const lower = cleaned.toLowerCase();
  if (PRESERVED_ORGANIZATIONAL_NAMES.has(lower)) {
    return cleaned;
  }

  // Check if role-based
  if (/(support|security|alert|team|service|billing|desk|admin|compliance|system|mailer)/i.test(lower)) {
    return cleaned;
  }

  // Personal name detected -> redact
  return '[NAME_REDACTED]';
}

/**
 * Redacts personal names in common salutations and sign-offs within email body text.
 */
export function sanitizeBodyText(text: string, stats?: PiiSanitizationStats): string {
  let cleaned = text;

  // 1. Redact phone numbers (US, international formats, hyphenated, spaced, dotted, parenthesized)
  // Matches e.g. +1-800-555-0199, (555) 123-4567, 555.123.4567, +44 20 7946 0958, 800-555-1212
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
  cleaned = cleaned.replace(phoneRegex, (match) => {
    // Avoid false positive on dates like 2026-10-28 or short serial numbers
    if (match.length >= 10 && !match.startsWith('19') && !match.startsWith('20')) {
      if (stats) stats.phoneNumbersRedacted++;
      return '[PHONE_REDACTED]';
    }
    return match;
  });

  // 2. Redact inline email addresses in body text, preserving domain
  const inlineEmailRegex = /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
  cleaned = cleaned.replace(inlineEmailRegex, (_full, domain) => {
    if (stats) stats.emailsHashed++;
    return `[EMAIL_REDACTED]@${domain.toLowerCase()}`;
  });

  // 3. Redact common salutations containing personal names
  // e.g. "Dear John,", "Hi Alice Smith,", "Hello Mr. Henderson,"
  const salutationRegex = /\b(Dear|Hi|Hello|Hey)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)([,:!]|\s*\n)/g;
  cleaned = cleaned.replace(salutationRegex, (_match, greeting, name, punct) => {
    const lowerName = name.toLowerCase();
    if (['customer', 'user', 'member', 'colleague', 'all', 'team'].includes(lowerName)) {
      return `${greeting} ${name}${punct}`;
    }
    if (stats) stats.namesRedacted++;
    return `${greeting} [NAME_REDACTED]${punct}`;
  });

  // 4. Redact common sign-offs containing personal names
  // e.g. "Sincerely, John Doe", "Best regards, Alice"
  const signoffRegex = /\b(Sincerely|Best regards|Regards|Thanks|Cheerfully yours|Yours faithfully),?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
  cleaned = cleaned.replace(signoffRegex, (_match, signoff) => {
    if (stats) stats.namesRedacted++;
    return `${signoff},\n[NAME_REDACTED]`;
  });

  // 5. Redact SSNs and Credit Card numbers if present
  // SSN: \b\d{3}-\d{2}-\d{4}\b
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  cleaned = cleaned.replace(ssnRegex, () => {
    if (stats) stats.financialIdsRedacted++;
    return '[SSN_REDACTED]';
  });

  // Credit Cards: 16 digits formatted in 4-digit groups
  const ccRegex = /\b(?:\d{4}[ -]?){3}\d{4}\b/g;
  cleaned = cleaned.replace(ccRegex, () => {
    if (stats) stats.financialIdsRedacted++;
    return '[CREDIT_CARD_REDACTED]';
  });

  return cleaned;
}

/**
 * Sanitizes an entire email record, stripping PII while preserving features needed for ML.
 */
export function sanitizeEmailRecord(record: {
  subject: string;
  text: string;
  from: string;
  fromDomain: string;
  replyTo?: string;
  returnPath?: string;
}): SanitizedRecordFields {
  const stats: PiiSanitizationStats = {
    emailsHashed: 0,
    phoneNumbersRedacted: 0,
    namesRedacted: 0,
    financialIdsRedacted: 0
  };

  // 1. Sanitize 'From' header
  const sanitizedFrom = hashEmailAddress(record.from);
  if (sanitizedFrom !== record.from) {
    stats.emailsHashed++;
  }

  // 2. Sanitize 'replyTo' and 'returnPath' if present
  let sanitizedReplyTo: string | undefined = undefined;
  if (record.replyTo) {
    sanitizedReplyTo = hashEmailAddress(record.replyTo);
    if (sanitizedReplyTo !== record.replyTo) stats.emailsHashed++;
  }

  let sanitizedReturnPath: string | undefined = undefined;
  if (record.returnPath) {
    sanitizedReturnPath = hashEmailAddress(record.returnPath);
    if (sanitizedReturnPath !== record.returnPath) stats.emailsHashed++;
  }

  // 3. Sanitize Subject Line (redact phone numbers or email addresses in subject)
  let sanitizedSubject = record.subject;
  sanitizedSubject = sanitizedSubject.replace(/\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g, (_m, domain) => {
    stats.emailsHashed++;
    return `[EMAIL]@${domain.toLowerCase()}`;
  });
  sanitizedSubject = sanitizedSubject.replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, () => {
    stats.phoneNumbersRedacted++;
    return '[PHONE]';
  });

  // 4. Sanitize Body Text
  const sanitizedText = sanitizeBodyText(record.text, stats);

  return {
    subject: sanitizedSubject,
    text: sanitizedText,
    from: sanitizedFrom,
    fromDomain: record.fromDomain, // Retained for ML threat intelligence and domain alignment
    replyTo: sanitizedReplyTo,
    returnPath: sanitizedReturnPath,
    stats
  };
}
