import crypto from 'crypto';
import { logger } from '../logger';

export type ApiKeyScope =
  | 'analyze:write'
  | 'cases:read'
  | 'cases:write'
  | 'alerts:read'
  | 'alerts:write'
  | 'quarantine:manage'
  | 'admin:*';

export interface ApiKeyRecord {
  id: string;
  name: string;
  organizationId: string;
  userId: string;
  keyPrefix: string; // e.g. "txm_live_a1b2c3d4"
  keyHash: string; // SHA-256 hash of full token
  scopes: ApiKeyScope[];
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
  revoked: boolean;
}

const apiKeysStore = new Map<string, ApiKeyRecord>();

/**
 * Creates a new API key. The plaintext key is only returned ONCE.
 */
export function createApiKey(params: {
  name: string;
  organizationId: string;
  userId: string;
  scopes: ApiKeyScope[];
  expiresInDays?: number;
}): { plaintextKey: string; keyRecord: ApiKeyRecord } {
  const entropy = crypto.randomBytes(24).toString('base64url');
  const plaintextKey = `txm_live_${entropy}`;
  const keyPrefix = plaintextKey.slice(0, 16);
  const keyHash = crypto.createHash('sha256').update(plaintextKey).digest('hex');

  const now = new Date();
  const expiresAt = params.expiresInDays
    ? new Date(now.getTime() + params.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  const keyRecord: ApiKeyRecord = {
    id: `key_${crypto.randomUUID()}`,
    name: params.name,
    organizationId: params.organizationId,
    userId: params.userId,
    keyPrefix,
    keyHash,
    scopes: params.scopes,
    createdAt: now.toISOString(),
    expiresAt,
    revoked: false
  };

  apiKeysStore.set(keyRecord.id, keyRecord);
  logger.info({ keyId: keyRecord.id, orgId: params.organizationId, name: params.name }, 'Created scoped API key');

  return { plaintextKey, keyRecord };
}

/**
 * Authenticates an incoming API key string against stored hashed keys.
 */
export function authenticateApiKey(rawKey: string): {
  valid: boolean;
  keyRecord?: ApiKeyRecord;
  error?: string;
} {
  if (!rawKey || !rawKey.startsWith('txm_live_')) {
    // Check fallback env keys if in non-production
    if (process.env.NODE_ENV !== 'production') {
      if (rawKey === process.env.TRACEXMAIL_ADMIN_API_KEY) {
        return {
          valid: true,
          keyRecord: {
            id: 'key_env_admin',
            name: 'Environment Admin Key',
            organizationId: 'default-org',
            userId: 'usr_admin',
            keyPrefix: 'env_admin',
            keyHash: 'env',
            scopes: ['admin:*'],
            createdAt: new Date().toISOString(),
            revoked: false
          }
        };
      }
    }
    return { valid: false, error: 'Malformed or invalid API key prefix' };
  }

  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

  for (const record of apiKeysStore.values()) {
    if (record.keyHash === hash) {
      if (record.revoked) {
        return { valid: false, error: 'API key has been revoked' };
      }
      if (record.expiresAt && new Date() > new Date(record.expiresAt)) {
        return { valid: false, error: 'API key has expired' };
      }

      record.lastUsedAt = new Date().toISOString();
      return { valid: true, keyRecord: record };
    }
  }

  return { valid: false, error: 'API key not recognized' };
}

export function revokeApiKey(keyId: string): boolean {
  const record = apiKeysStore.get(keyId);
  if (record) {
    record.revoked = true;
    logger.info({ keyId }, 'Revoked API key');
    return true;
  }
  return false;
}

export function listApiKeys(orgId: string): ApiKeyRecord[] {
  return Array.from(apiKeysStore.values()).filter(k => k.organizationId === orgId && !k.revoked);
}
