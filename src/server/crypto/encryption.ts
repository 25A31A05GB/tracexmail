import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface KeyProvider {
  getOrgDataKey(orgId: string): Promise<Buffer>;
  encryptOrgData(orgId: string, plaintext: Buffer | string): Promise<string>;
  decryptOrgData(orgId: string, ciphertext: string): Promise<Buffer>;
}

// In-memory key store for resolved master keys
let keyRegistry: Map<string, Buffer> = new Map();
let activeKeyId: string = 'k1';
let initialized = false;

/**
 * Initializes or reloads the master encryption keys from environment variables.
 */
export function initEncryptionKeys(): void {
  keyRegistry.clear();

  const rawKeys = process.env.TOKEN_ENCRYPTION_KEYS;
  const legacyKey = process.env.TOKEN_ENCRYPTION_KEY;
  activeKeyId = process.env.TOKEN_ENCRYPTION_ACTIVE_KEY_ID || 'k1';

  if (rawKeys) {
    try {
      const parsed = typeof rawKeys === 'string' ? JSON.parse(rawKeys) : rawKeys;
      for (const [id, keyVal] of Object.entries(parsed)) {
        if (typeof keyVal === 'string') {
          // Decode base64 or hex or utf8
          let buf: Buffer;
          if (/^[A-Za-z0-9+/=_-]{43,44}$/.test(keyVal)) {
            buf = Buffer.from(keyVal, 'base64');
          } else if (/^[0-9a-fA-F]{64}$/.test(keyVal)) {
            buf = Buffer.from(keyVal, 'hex');
          } else {
            buf = crypto.createHash('sha256').update(keyVal).digest();
          }
          if (buf.length === 32) {
            keyRegistry.set(id, buf);
          }
        }
      }
    } catch {
      // Fallback below
    }
  }

  // Support legacy single key if not already defined
  if (legacyKey && !keyRegistry.has('k1')) {
    let buf: Buffer;
    if (/^[A-Za-z0-9+/=_-]{43,44}$/.test(legacyKey)) {
      buf = Buffer.from(legacyKey, 'base64');
    } else if (/^[0-9a-fA-F]{64}$/.test(legacyKey)) {
      buf = Buffer.from(legacyKey, 'hex');
    } else {
      buf = crypto.createHash('sha256').update(legacyKey).digest();
    }
    if (buf.length === 32) {
      keyRegistry.set('k1', buf);
    }
  }

  // Development fallback: if no key is configured, use a deterministic or random fallback
  if (keyRegistry.size === 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: TOKEN_ENCRYPTION_KEYS or TOKEN_ENCRYPTION_KEY must be configured in production.');
    }
    const devFallback = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'tracexmail-dev-secret-key-32bytes!!').digest();
    keyRegistry.set('k1', devFallback);
    activeKeyId = 'k1';
  }

  // Ensure activeKeyId is in registry
  if (!keyRegistry.has(activeKeyId)) {
    const firstKey = keyRegistry.keys().next().value;
    if (firstKey) {
      activeKeyId = firstKey;
    }
  }

  initialized = true;
}

function ensureInitialized(): void {
  if (!initialized) {
    initEncryptionKeys();
  }
}

/**
 * Returns all configured key IDs
 */
export function getRegisteredKeyIds(): string[] {
  ensureInitialized();
  return Array.from(keyRegistry.keys());
}

/**
 * Returns the active encryption key ID
 */
export function getActiveKeyId(): string {
  ensureInitialized();
  return activeKeyId;
}

/**
 * Formats: "v1:<keyId>:<iv>:<tag>:<data>" (base64url for iv, tag, and ciphertext data)
 */
export function encrypt(plaintext: string | Buffer, explicitKeyId?: string): string {
  ensureInitialized();

  const keyId = explicitKeyId || activeKeyId;
  const key = keyRegistry.get(keyId);
  if (!key) {
    throw new Error(`Encryption key '${keyId}' not found in registry`);
  }

  const iv = crypto.randomBytes(12); // 12-byte random IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const dataBuffer = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;

  const encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1:${keyId}:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

/**
 * Decrypts a versioned ciphertext. Throws on format errors or tamper detection.
 */
export function decrypt(ciphertext: string): string {
  ensureInitialized();

  if (!ciphertext || typeof ciphertext !== 'string') {
    throw new Error('Invalid ciphertext input');
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 5 || parts[0] !== 'v1') {
    throw new Error('Invalid or unsupported ciphertext format');
  }

  const [, keyId, ivStr, tagStr, dataStr] = parts;

  const key = keyRegistry.get(keyId);
  if (!key) {
    throw new Error(`Key ID '${keyId}' not found in active key registry. Cannot decrypt.`);
  }

  let iv: Buffer;
  let tag: Buffer;
  let encryptedData: Buffer;

  try {
    iv = Buffer.from(ivStr, 'base64url');
    tag = Buffer.from(tagStr, 'base64url');
    encryptedData = Buffer.from(dataStr, 'base64url');
  } catch (err: any) {
    throw new Error(`Failed to decode base64url components: ${err.message}`);
  }

  if (iv.length !== 12) {
    throw new Error(`Invalid IV length: expected 12 bytes, got ${iv.length}`);
  }
  if (tag.length !== 16) {
    throw new Error(`Invalid authentication tag length: expected 16 bytes, got ${tag.length}`);
  }

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err: any) {
    throw new Error(`Decryption failed: integrity check failed or ciphertext tampered: ${err.message}`);
  }
}

/**
 * Decrypts to a raw Buffer (e.g. for binary .eml evidence)
 */
export function decryptToBuffer(ciphertext: string): Buffer {
  ensureInitialized();

  const parts = ciphertext.split(':');
  if (parts.length !== 5 || parts[0] !== 'v1') {
    throw new Error('Invalid or unsupported ciphertext format');
  }

  const [, keyId, ivStr, tagStr, dataStr] = parts;
  const key = keyRegistry.get(keyId);
  if (!key) {
    throw new Error(`Key ID '${keyId}' not found in active key registry.`);
  }

  const iv = Buffer.from(ivStr, 'base64url');
  const tag = Buffer.from(tagStr, 'base64url');
  const encryptedData = Buffer.from(dataStr, 'base64url');

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  } catch (err: any) {
    throw new Error(`Decryption failed: integrity check failed or ciphertext tampered: ${err.message}`);
  }
}

/**
 * Check if a string has the versioned ciphertext prefix
 */
export function isEncrypted(val: string | null | undefined): boolean {
  if (!val || typeof val !== 'string') return false;
  return val.startsWith('v1:') && val.split(':').length === 5;
}

/**
 * Check if ciphertext is encrypted with the current active key
 */
export function isEncryptedWithActiveKey(ciphertext: string): boolean {
  if (!isEncrypted(ciphertext)) return false;
  const parts = ciphertext.split(':');
  return parts[1] === getActiveKeyId();
}

/**
 * Re-encrypt ciphertext with the current active key if it was encrypted with an older key.
 */
export function reencryptWithActiveKey(ciphertext: string): { reencrypted: string; changed: boolean } {
  if (!isEncrypted(ciphertext)) {
    // If plaintext, encrypt it directly
    return { reencrypted: encrypt(ciphertext), changed: true };
  }
  const parts = ciphertext.split(':');
  if (parts[1] === getActiveKeyId()) {
    return { reencrypted: ciphertext, changed: false };
  }
  const decrypted = decrypt(ciphertext);
  return { reencrypted: encrypt(decrypted), changed: true };
}

// -------------------------------------------------------------
// Envelope Encryption (Per-Organization Data Keys)
// -------------------------------------------------------------

// In-memory cache of decrypted org data keys (orgId -> 32-byte Buffer)
const orgDataKeyCache: Map<string, Buffer> = new Map();
// Encrypted org data keys stored as ciphertext using master key (orgId -> ciphertext)
const encryptedOrgKeysStore: Map<string, string> = new Map();

export class EnvKeyProvider implements KeyProvider {
  async getOrgDataKey(orgId: string): Promise<Buffer> {
    ensureInitialized();

    const cached = orgDataKeyCache.get(orgId);
    if (cached) return cached;

    // Check if we have an encrypted key stored for this org
    let encryptedKey = encryptedOrgKeysStore.get(orgId);
    let keyBuf: Buffer;

    if (encryptedKey) {
      keyBuf = decryptToBuffer(encryptedKey);
    } else {
      // Generate a new random 32-byte data key for this organization
      keyBuf = crypto.randomBytes(32);
      // Encrypt the org data key with master active key (envelope encryption)
      encryptedKey = encrypt(keyBuf);
      encryptedOrgKeysStore.set(orgId, encryptedKey);
    }

    orgDataKeyCache.set(orgId, keyBuf);
    return keyBuf;
  }

  async encryptOrgData(orgId: string, plaintext: Buffer | string): Promise<string> {
    const orgKey = await this.getOrgDataKey(orgId);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', orgKey, iv);
    const dataBuffer = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;

    const encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Org ciphertext format: v1:org:<orgId>:<iv>:<tag>:<data>
    return `v1:org:${orgId}:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
  }

  async decryptOrgData(orgId: string, ciphertext: string): Promise<Buffer> {
    if (!ciphertext || typeof ciphertext !== 'string') {
      throw new Error('Invalid org ciphertext');
    }

    const parts = ciphertext.split(':');
    if (parts.length !== 6 || parts[0] !== 'v1' || parts[1] !== 'org') {
      // Also support master-encrypted data as fallback
      if (parts.length === 5 && parts[0] === 'v1') {
        return decryptToBuffer(ciphertext);
      }
      throw new Error('Invalid organization ciphertext format');
    }

    const targetOrgId = parts[2];
    if (targetOrgId !== orgId) {
      throw new Error(`Data key organization mismatch: expected ${orgId}, received ${targetOrgId}`);
    }

    const iv = Buffer.from(parts[3], 'base64url');
    const tag = Buffer.from(parts[4], 'base64url');
    const encryptedData = Buffer.from(parts[5], 'base64url');

    const orgKey = await this.getOrgDataKey(orgId);

    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', orgKey, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    } catch (err: any) {
      throw new Error(`Org data decryption failed: integrity check failed or tampered: ${err.message}`);
    }
  }
}

/**
 * AWS KMS KeyProvider Stub (ready to drop in with @aws-sdk/client-kms)
 */
export class AwsKmsKeyProvider implements KeyProvider {
  private keyArn: string;
  private envFallback: EnvKeyProvider;

  constructor(keyArn: string = process.env.AWS_KMS_KEY_ARN || 'arn:aws:kms:us-east-1:123456789012:key/tracexmail-master') {
    this.keyArn = keyArn;
    this.envFallback = new EnvKeyProvider();
  }

  async getOrgDataKey(orgId: string): Promise<Buffer> {
    // When AWS KMS SDK is enabled, this calls GenerateDataKeyCommand({ KeyId: this.keyArn, KeySpec: 'AES_256' })
    return this.envFallback.getOrgDataKey(orgId);
  }

  async encryptOrgData(orgId: string, plaintext: Buffer | string): Promise<string> {
    return this.envFallback.encryptOrgData(orgId, plaintext);
  }

  async decryptOrgData(orgId: string, ciphertext: string): Promise<Buffer> {
    return this.envFallback.decryptOrgData(orgId, ciphertext);
  }
}

/**
 * GCP Cloud KMS KeyProvider Stub (ready to drop in with @google-cloud/kms)
 */
export class GcpKmsKeyProvider implements KeyProvider {
  private keyName: string;
  private envFallback: EnvKeyProvider;

  constructor(keyName: string = process.env.GCP_KMS_KEY_NAME || 'projects/p/locations/global/keyRings/r/cryptoKeys/tracexmail') {
    this.keyName = keyName;
    this.envFallback = new EnvKeyProvider();
  }

  async getOrgDataKey(orgId: string): Promise<Buffer> {
    return this.envFallback.getOrgDataKey(orgId);
  }

  async encryptOrgData(orgId: string, plaintext: Buffer | string): Promise<string> {
    return this.envFallback.encryptOrgData(orgId, plaintext);
  }

  async decryptOrgData(orgId: string, ciphertext: string): Promise<Buffer> {
    return this.envFallback.decryptOrgData(orgId, ciphertext);
  }
}

// Global KeyProvider instance
let currentKeyProvider: KeyProvider = new EnvKeyProvider();

export function getKeyProvider(): KeyProvider {
  const providerType = process.env.KMS_PROVIDER?.toLowerCase();
  if (providerType === 'aws') {
    if (!(currentKeyProvider instanceof AwsKmsKeyProvider)) {
      currentKeyProvider = new AwsKmsKeyProvider();
    }
  } else if (providerType === 'gcp') {
    if (!(currentKeyProvider instanceof GcpKmsKeyProvider)) {
      currentKeyProvider = new GcpKmsKeyProvider();
    }
  }
  return currentKeyProvider;
}

export async function encryptOrgData(orgId: string, plaintext: string | Buffer): Promise<string> {
  return getKeyProvider().encryptOrgData(orgId, plaintext);
}

export async function decryptOrgData(orgId: string, ciphertext: string): Promise<string> {
  const buf = await getKeyProvider().decryptOrgData(orgId, ciphertext);
  return buf.toString('utf8');
}

// -------------------------------------------------------------
// Startup Security Checks & Secret Validation
// -------------------------------------------------------------

export function verifyStartupKeys(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const isProd = process.env.NODE_ENV === 'production';

  // Read example values from .env.example to ensure no defaults are used
  const placeholderValues = new Set<string>();
  try {
    const envExamplePath = path.resolve(process.cwd(), '.env.example');
    if (fs.existsSync(envExamplePath)) {
      const content = fs.readFileSync(envExamplePath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const val = trimmed.slice(eqIdx + 1).trim();
            if (val) placeholderValues.add(val);
          }
        }
      });
    }
  } catch {
    // Ignore if missing
  }

  // Common dangerous default strings
  ['changeme', 'secret', 'password', '123456', 'default', 'example'].forEach(v => placeholderValues.add(v));

  ensureInitialized();

  // 1. Check master encryption keys
  if (keyRegistry.size === 0) {
    errors.push('No token encryption keys configured');
  } else {
    for (const [id, buf] of keyRegistry.entries()) {
      if (buf.length < 32) {
        errors.push(`Encryption key '${id}' length is ${buf.length} bytes; must be at least 32 bytes.`);
      }
    }
  }

  // 2. Check active key
  if (!keyRegistry.has(activeKeyId)) {
    errors.push(`Active key ID '${activeKeyId}' does not exist in TOKEN_ENCRYPTION_KEYS`);
  }

  // 3. Check for placeholder matches in critical secrets
  const criticalVars = [
    'JWT_SECRET',
    'TOKEN_ENCRYPTION_KEY',
    'TOKEN_ENCRYPTION_KEYS',
    'SUPABASE_SERVICE_ROLE_KEY',
    'TRACEXMAIL_ADMIN_API_KEY'
  ];

  for (const varName of criticalVars) {
    const val = process.env[varName];
    if (val && placeholderValues.has(val)) {
      errors.push(`Security violation: ${varName} matches placeholder value from .env.example!`);
    }
    if (isProd && val && val.length < 16) {
      errors.push(`Security violation: ${varName} is dangerously short for production (< 16 characters).`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export const encryptSecret = encrypt;
export const decryptSecret = decrypt;
