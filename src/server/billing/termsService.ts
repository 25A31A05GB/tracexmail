import fs from 'fs';
import path from 'path';
import { logger } from '../logger';

export const CURRENT_TERMS_VERSION = '2026.2';
export const CURRENT_DPA_VERSION = '2026.1';

export interface TermsAcceptanceRecord {
  userId: string;
  userEmail: string;
  organizationId: string;
  termsVersion: string;
  dpaVersion: string;
  acceptedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

const termsMemory = new Map<string, TermsAcceptanceRecord>(); // key: userId
const TERMS_FILE = path.join(process.cwd(), 'data/terms_acceptances.json');

function loadTermsFromDisk(): void {
  try {
    if (fs.existsSync(TERMS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(TERMS_FILE, 'utf8'));
      if (Array.isArray(parsed)) {
        parsed.forEach((t) => {
          if (t && t.userId) termsMemory.set(t.userId, t);
        });
      }
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Failed to load terms acceptances from disk');
  }
}

function saveTermsToDisk(): void {
  try {
    const dir = path.dirname(TERMS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TERMS_FILE, JSON.stringify(Array.from(termsMemory.values()), null, 2), 'utf8');
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Failed to save terms acceptances to disk');
  }
}

// Initial load
loadTermsFromDisk();

export function recordTermsAcceptance(params: {
  userId: string;
  userEmail: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
}): TermsAcceptanceRecord {
  const record: TermsAcceptanceRecord = {
    userId: params.userId,
    userEmail: params.userEmail,
    organizationId: params.organizationId,
    termsVersion: CURRENT_TERMS_VERSION,
    dpaVersion: CURRENT_DPA_VERSION,
    acceptedAt: new Date().toISOString(),
    ipAddress: params.ipAddress,
    userAgent: params.userAgent
  };

  termsMemory.set(params.userId, record);
  saveTermsToDisk();
  return record;
}

export function checkTermsAcceptanceStatus(userId: string): {
  isAccepted: boolean;
  requiresReacceptance: boolean;
  acceptedVersion?: string;
  acceptedAt?: string;
} {
  const record = termsMemory.get(userId);
  if (!record) {
    return { isAccepted: false, requiresReacceptance: true };
  }

  const isUpToDate =
    record.termsVersion === CURRENT_TERMS_VERSION &&
    record.dpaVersion === CURRENT_DPA_VERSION;

  return {
    isAccepted: true,
    requiresReacceptance: !isUpToDate,
    acceptedVersion: record.termsVersion,
    acceptedAt: record.acceptedAt
  };
}
