import crypto from 'crypto';
import QRCode from 'qrcode';
import { logger } from '../logger';

export interface UserMfaRecord {
  userId: string;
  secret: string; // Base32 TOTP secret
  enabled: boolean;
  recoveryCodeHashes: string[]; // SHA-256 hashed recovery codes
  enrolledAt: string;
}

const mfaStore = new Map<string, UserMfaRecord>();
const orgMfaRequirement = new Map<string, boolean>();

// Base32 Alphabet RFC 4648
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(base32: string): Buffer {
  const cleaned = base32.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generates an RFC 6238 TOTP code for a given secret at a given counter/timestamp.
 */
export function generateTotpCode(secretBase32: string, timeStepWindow: number = Math.floor(Date.now() / 1000 / 30)): string {
  const key = base32Decode(secretBase32);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigUInt64BE(BigInt(timeStepWindow));

  const hmac = crypto.createHmac('sha1', key).update(timeBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verifies a 6-digit TOTP code against a secret with +/- 1 time-step tolerance.
 */
export function verifyTotpCode(secretBase32: string, token: string): boolean {
  if (!token || token.length !== 6) return false;
  const currentStep = Math.floor(Date.now() / 1000 / 30);

  // Check t-1, t, t+1
  for (let step = currentStep - 1; step <= currentStep + 1; step++) {
    if (generateTotpCode(secretBase32, step) === token) {
      return true;
    }
  }
  return false;
}

/**
 * Enrolls a user in TOTP MFA, generating secret, recovery codes, and QR Code.
 */
export async function enrollMfa(userId: string, email: string): Promise<{
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
  recoveryCodes: string[];
}> {
  const secretBytes = crypto.randomBytes(20);
  const secret = base32Encode(secretBytes);
  const issuer = 'TraceXMail';
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  // Generate 8 alphanumeric recovery codes (8 chars each)
  const recoveryCodes: string[] = [];
  const recoveryCodeHashes: string[] = [];

  for (let i = 0; i < 8; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    recoveryCodes.push(code);
    recoveryCodeHashes.push(crypto.createHash('sha256').update(code).digest('hex'));
  }

  mfaStore.set(userId, {
    userId,
    secret,
    enabled: true,
    recoveryCodeHashes,
    enrolledAt: new Date().toISOString()
  });

  return { secret, otpauthUrl, qrCodeDataUrl, recoveryCodes };
}

/**
 * Verifies and consumes a recovery code for a user.
 */
export function verifyAndConsumeRecoveryCode(userId: string, code: string): boolean {
  const record = mfaStore.get(userId);
  if (!record || !record.enabled) return false;

  const codeHash = crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
  const index = record.recoveryCodeHashes.indexOf(codeHash);

  if (index !== -1) {
    // Single-use: remove consumed code
    record.recoveryCodeHashes.splice(index, 1);
    logger.info({ userId }, 'Used MFA recovery code successfully');
    return true;
  }

  return false;
}

export function getUserMfaRecord(userId: string): UserMfaRecord | null {
  return mfaStore.get(userId) || null;
}

export function setOrgMfaRequirement(orgId: string, required: boolean): void {
  orgMfaRequirement.set(orgId, required);
}

export function isMfaRequiredForOrg(orgId: string): boolean {
  return orgMfaRequirement.get(orgId) || false;
}
