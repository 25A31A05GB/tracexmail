/**
 * TraceXMail PII Removal & Sanitization Engine
 *
 * Strips personal names, phone numbers, and pseudonymizes email addresses
 * using HMAC-SHA256 with a tenant-isolated salt before storage, preserving
 * only the necessary syntactic and domain features required for forensic classification.
 */

import crypto from 'crypto';

export interface PiiSanitizationOptions {
  salt?: string;
  preserveSenderDomain?: boolean;
}

const DEFAULT_SALT = 'tracexmail_pii_salt_2026_isolated';

// RFC 5322 compatible email regex
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/g;

// International & US phone number formats
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

// Salutation name patterns like "Dear John Doe," or "From: Jane Smith"
const NAME_SALUTATION_REGEX = /(?:dear|hi|hello|regards|sincerely|thanks,?\s+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi;

/**
 * Deterministically pseudonymizes an email address while preserving the domain part
 * for DKIM/SPF alignment and sender domain group splitting.
 */
export function pseudonymizeEmail(email: string, salt = DEFAULT_SALT): string {
  const parts = email.trim().split('@');
  if (parts.length !== 2) return '[REDACTED_EMAIL]';
  const [localPart, domain] = parts;
  const hmac = crypto.createHmac('sha256', salt).update(localPart.toLowerCase()).digest('hex').slice(0, 8);
  return `usr_${hmac}@${domain.toLowerCase()}`;
}

/**
 * Strips phone numbers from raw text.
 */
export function stripPhoneNumbers(text: string): string {
  return text.replace(PHONE_REGEX, '[PHONE_REDACTED]');
}

/**
 * Sanitizes all email addresses inside a text block by pseudonymizing their local parts.
 */
export function sanitizeEmailsInText(text: string, salt = DEFAULT_SALT): string {
  return text.replace(EMAIL_REGEX, (_match, domain) => {
    const fullMatch = _match;
    return pseudonymizeEmail(fullMatch, salt);
  });
}

/**
 * Strips names from salutations and signatures.
 */
export function stripNames(text: string): string {
  return text.replace(NAME_SALUTATION_REGEX, (match, name) => {
    return match.replace(name, '[NAME_REDACTED]');
  });
}

/**
 * Master sanitization pipeline for incoming raw email records.
 */
export function sanitizeEmailRecord(record: {
  subject: string;
  text: string;
  from?: string;
  fromDomain?: string;
}, options: PiiSanitizationOptions = {}): {
  subject: string;
  text: string;
  from: string;
  fromDomain: string;
} {
  const salt = options.salt || DEFAULT_SALT;

  let from = record.from || '';
  let fromDomain = record.fromDomain || '';

  // Extract or preserve domain
  if (!fromDomain && from) {
    const match = from.match(/@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
    if (match) fromDomain = match[1].toLowerCase();
  }

  // Pseudonymize from header
  if (from) {
    from = sanitizeEmailsInText(from, salt);
    // Strip display name: "John Doe <usr_...>" -> "User <usr_...>"
    from = from.replace(/^[^<]+<([^>]+)>/, 'User <$1>');
  }

  // Sanitize subject line
  let subject = sanitizeEmailsInText(record.subject, salt);
  subject = stripPhoneNumbers(subject);
  subject = stripNames(subject);

  // Sanitize body text
  let text = sanitizeEmailsInText(record.text, salt);
  text = stripPhoneNumbers(text);
  text = stripNames(text);

  return {
    subject,
    text,
    from,
    fromDomain: fromDomain.toLowerCase()
  };
}
