export type RetentionPolicy = 'ephemeral' | '30_days' | '90_days' | '365_days' | 'legal_hold';
export type MaskingMode = 'strict_redaction' | 'pseudonymized' | 'anonymized';

export interface PrivacyConfig {
  maskingEnabled: boolean;
  maskSenderRecipient: boolean;
  maskSubjectAndBody: boolean;
  maskInternalIps: boolean;
  maskingMode: MaskingMode;
  retentionPolicy: RetentionPolicy;
  complianceStandard: 'NIST SP 800-86' | 'ISO/IEC 27037' | 'Data Minimization & Sanitization' | 'CJIS Guidelines';
  evidencePreservationSeal: boolean;
  operatorId: string;
}

export const DEFAULT_PRIVACY_CONFIG: PrivacyConfig = {
  maskingEnabled: false,
  maskSenderRecipient: true,
  maskSubjectAndBody: true,
  maskInternalIps: true,
  maskingMode: 'pseudonymized',
  retentionPolicy: '90_days',
  complianceStandard: 'ISO/IEC 27037',
  evidencePreservationSeal: true,
  operatorId: 'INV-SOC-SEC-892'
};

const STORAGE_KEY = 'tracexmail_privacy_config';

export function loadPrivacyConfig(): PrivacyConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_PRIVACY_CONFIG, ...JSON.parse(saved) };
    }
  } catch {
    // fallback
  }
  return DEFAULT_PRIVACY_CONFIG;
}

export function savePrivacyConfig(config: PrivacyConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

/**
 * Mask an email address according to privacy mode
 */
export function maskEmail(email?: string, mode: MaskingMode = 'pseudonymized'): string {
  if (!email) return '';
  if (mode === 'strict_redaction') {
    return '[REDACTED_EMAIL]';
  }

  // Check if format is "Name <user@domain.com>"
  const match = email.match(/^(.*)<(.*?)>$/);
  if (match) {
    const name = match[1].trim();
    const addr = match[2].trim();
    return `${maskName(name, mode)} <${maskRawEmail(addr, mode)}>`;
  }

  return maskRawEmail(email, mode);
}

function maskName(name: string, mode: MaskingMode): string {
  if (!name) return '';
  if (mode === 'strict_redaction') return '[REDACTED_USER]';
  if (mode === 'anonymized') return 'Subject-X';
  const parts = name.split(/\s+/);
  return parts.map(p => (p.length > 2 ? `${p[0]}***${p[p.length - 1]}` : `${p[0]}*`)).join(' ');
}

function maskRawEmail(addr: string, mode: MaskingMode): string {
  if (!addr.includes('@')) return addr;
  const [user, domain] = addr.split('@');
  if (mode === 'strict_redaction') return '[REDACTED_EMAIL]';
  if (mode === 'anonymized') return `analyst-masked@${domain}`;

  const maskedUser = user.length > 3 
    ? `${user.slice(0, 2)}***${user.slice(-1)}`
    : `${user[0]}***`;
  return `${maskedUser}@${domain}`;
}

/**
 * Mask an IP address (especially RFC 1918 internal addresses)
 */
export function maskIp(ip?: string, isPrivate?: boolean, mode: MaskingMode = 'pseudonymized'): string {
  if (!ip) return '';
  if (mode === 'strict_redaction') return '[REDACTED_IP]';
  if (isPrivate) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.***.***.${parts[3]}`;
    }
  }
  return ip;
}

/**
 * Mask subject line or sensitive message body
 */
export function maskText(text?: string, mode: MaskingMode = 'pseudonymized'): string {
  if (!text) return '';
  if (mode === 'strict_redaction') return '[REDACTED_SENSITIVE_COMMUNICATION]';
  
  // Mask monetary amounts, credit cards, or passwords
  let result = text
    .replace(/\$[\d,]+(\.\d{2})?/g, '$[REDACTED_AMOUNT]')
    .replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, '[REDACTED_CARD_NUMBER]')
    .replace(/(wire\s+transfer|routing\s+number|account\s+number|swift\s+code)\s*[:#]?\s*[\w\d-]+/gi, '$1: [REDACTED_BANK_IDENTIFIER]')
    .replace(/(password|credentials?|login\s+pin)\s*[:=]\s*[\S]+/gi, '$1: [REDACTED_CREDENTIAL]');

  return result;
}

/**
 * Calculate scheduled purge date based on retention policy
 */
export function getRetentionPurgeDate(policy: RetentionPolicy, ingestedDateStr?: string): { date: string; daysRemaining: number } {
  const baseDate = ingestedDateStr ? new Date(ingestedDateStr) : new Date();
  const validBase = isNaN(baseDate.getTime()) ? new Date() : baseDate;
  
  let days = 90;
  switch (policy) {
    case 'ephemeral':
      return { date: 'Immediate (Zero-Retention In-Memory Only)', daysRemaining: 0 };
    case '30_days':
      days = 30;
      break;
    case '90_days':
      days = 90;
      break;
    case '365_days':
      days = 365;
      break;
    case 'legal_hold':
      return { date: 'Indefinite (Legal Hold Chain-of-Custody Lock)', daysRemaining: 9999 };
  }

  const purgeDate = new Date(validBase.getTime() + days * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffDays = Math.max(0, Math.ceil((purgeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  
  return {
    date: purgeDate.toISOString().split('T')[0],
    daysRemaining: diffDays
  };
}
