import crypto from 'crypto';
import { logger } from '../logger';

export interface AuditLogEntry {
  id: string;
  sequence: number;
  previousHash: string;
  hash: string;
  timestamp: string;
  actor: {
    id: string;
    email: string;
    role: string;
  };
  organizationId: string;
  action: string;
  target: string;
  ip: string;
  userAgent: string;
  requestId: string;
  result: 'success' | 'failure' | 'denied';
  metadata?: Record<string, any>;
}

// In-memory append-only audit store with hash chain
const auditChain: AuditLogEntry[] = [];
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

function computeEntryHash(entry: Omit<AuditLogEntry, 'hash'>): string {
  const payload = [
    entry.sequence,
    entry.previousHash,
    entry.timestamp,
    entry.actor.id,
    entry.organizationId,
    entry.action,
    entry.target,
    entry.result
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Appends an immutable audit log entry and updates the cryptographic hash chain.
 */
export async function logAuditEvent(params: {
  actor: { id: string; email: string; role: string };
  organizationId: string;
  action: string;
  target: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  result?: 'success' | 'failure' | 'denied';
  metadata?: Record<string, any>;
}): Promise<AuditLogEntry> {
  const sequence = auditChain.length + 1;
  const previousHash = auditChain.length > 0 ? auditChain[auditChain.length - 1].hash : GENESIS_HASH;
  const timestamp = new Date().toISOString();

  const entryData: Omit<AuditLogEntry, 'hash'> = {
    id: `aud_${crypto.randomUUID()}`,
    sequence,
    previousHash,
    timestamp,
    actor: params.actor,
    organizationId: params.organizationId || 'default-org',
    action: params.action,
    target: params.target,
    ip: params.ip || '127.0.0.1',
    userAgent: params.userAgent || 'unknown',
    requestId: params.requestId || crypto.randomUUID(),
    result: params.result || 'success',
    metadata: params.metadata
  };

  const hash = computeEntryHash(entryData);
  const completeEntry: AuditLogEntry = { ...entryData, hash };

  // Append-only
  auditChain.push(completeEntry);

  // Asynchronously dispatch to SIEM webhook if configured
  const siemWebhookUrl = process.env.SIEM_WEBHOOK_URL;
  if (siemWebhookUrl) {
    setImmediate(async () => {
      try {
        const axios = (await import('axios')).default;
        const hmacKey = process.env.SIEM_HMAC_KEY || 'tracexmail-siem-key';
        const signature = crypto
          .createHmac('sha256', hmacKey)
          .update(JSON.stringify(completeEntry))
          .digest('hex');

        await axios.post(siemWebhookUrl, completeEntry, {
          headers: {
            'x-tracexmail-signature': signature,
            'Content-Type': 'application/json'
          },
          timeout: 4000
        });
      } catch (err: any) {
        logger.warn({ error: err.message }, 'Failed forwarding audit log to SIEM webhook');
      }
    });
  }

  return completeEntry;
}

/**
 * Verifies the integrity of the cryptographic hash chain.
 * Returns valid: true if completely pristine, or details of the first tampered block.
 */
export function verifyAuditChain(organizationId?: string): {
  valid: boolean;
  totalRecords: number;
  tamperedRecordId?: string;
  error?: string;
} {
  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < auditChain.length; i++) {
    const entry = auditChain[i];

    // Check link to previous hash
    if (entry.previousHash !== expectedPrevHash) {
      return {
        valid: false,
        totalRecords: auditChain.length,
        tamperedRecordId: entry.id,
        error: `Broken hash chain at sequence ${entry.sequence}: previousHash mismatch`
      };
    }

    // Recompute and verify current hash
    const recomputed = computeEntryHash(entry);
    if (recomputed !== entry.hash) {
      return {
        valid: false,
        totalRecords: auditChain.length,
        tamperedRecordId: entry.id,
        error: `Tampering detected at record ${entry.id} (sequence ${entry.sequence}): content hash mismatch`
      };
    }

    expectedPrevHash = entry.hash;
  }

  return {
    valid: true,
    totalRecords: auditChain.length
  };
}

/**
 * Exports audit logs for an organization as CSV.
 */
export function exportAuditLogsAsCsv(organizationId?: string): string {
  const records = organizationId
    ? auditChain.filter(r => r.organizationId === organizationId)
    : auditChain;

  const headers = ['id', 'sequence', 'timestamp', 'actor_email', 'action', 'target', 'result', 'ip', 'requestId', 'hash'];
  const rows = records.map(r => [
    r.id,
    r.sequence,
    r.timestamp,
    r.actor.email,
    r.action,
    r.target,
    r.result,
    r.ip,
    r.requestId,
    r.hash
  ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Exports audit logs for an organization as JSON.
 */
export function exportAuditLogsAsJson(organizationId?: string): AuditLogEntry[] {
  if (organizationId) {
    return auditChain.filter(r => r.organizationId === organizationId);
  }
  return [...auditChain];
}
