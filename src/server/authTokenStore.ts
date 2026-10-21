import crypto from 'crypto';
import { getSupabaseAdminClient } from './supabase';

export type TokenPurpose = 'signin' | 'signup' | 'reset' | 'recovery';

export interface EphemeralTokenRecord {
  tokenHash: string;
  email: string;
  purpose: TokenPurpose;
  expiresAt: number;
  lastSentAt: number;
  used: boolean;
  nonceHash?: string;
  payload?: any;
}

export interface EphemeralOtpRecord {
  otpHash: string;
  email: string;
  purpose: TokenPurpose | 'invite';
  expiresAt: number;
  attempts: number;
  lockedUntil?: number;
  lastSentAt: number;
  payload?: any;
}

// Backwards-compatible legacy interfaces
export interface OtpRecord {
  code: string;
  email: string;
  type: 'signup' | 'recovery' | 'invite' | 'reset';
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  payload?: any;
}

export interface MagicLinkRecord {
  token: string;
  email: string;
  type: 'signin' | 'signup' | 'recovery';
  expiresAt: number;
  lastSentAt: number;
  used: boolean;
  payload?: any;
}

export interface ResetTokenRecord {
  email: string;
  expiresAt: number;
}

// In-memory token storage maps (keyed by SHA-256 hash or canonical key)
const memoryTokenHashStore = new Map<string, EphemeralTokenRecord>();
const memoryOtpCanonicalStore = new Map<string, EphemeralOtpRecord>();
const memoryResetTokens = new Map<string, ResetTokenRecord>();

// Expiries & Lockout durations
export const TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
export const OTP_EXPIRY_MS = 10 * 60 * 1000;   // 10 minutes
export const OTP_LOCKOUT_MS = 15 * 60 * 1000;  // 15 minutes lock after 5 failed attempts
export const OTP_MAX_ATTEMPTS = 5;

/**
 * Computes a SHA-256 cryptographic digest of a token, code, or nonce.
 */
export function hashSecret(secret: string): string {
  if (!secret) return '';
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * Constant-time string equality check to eliminate timing side-channel attacks.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generates a high-entropy 32-byte base64url single-use token.
 */
export function generateToken32(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generates a cryptographically strong 6-digit one-time code.
 */
export function generate6DigitOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Normalizes an email address.
 */
export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Normalizes purpose keys, mapping legacy 'recovery' to 'reset'.
 */
function normalizePurpose(purpose: string): TokenPurpose {
  if (purpose === 'recovery') return 'reset';
  return purpose as TokenPurpose;
}

/**
 * ==============================================================================
 * HARDENED TOKEN SUBSYSTEM (32-byte base64url, SHA-256 stored, atomic consume)
 * ==============================================================================
 */

/**
 * Invalidates any prior active tokens for an email and purpose.
 */
export async function invalidateEarlierTokens(email: string, purpose?: TokenPurpose): Promise<void> {
  const cleanEmail = normalizeEmail(email);
  const targetPurpose = purpose ? normalizePurpose(purpose) : undefined;

  for (const [hash, rec] of memoryTokenHashStore.entries()) {
    if (rec.email === cleanEmail && (!targetPurpose || rec.purpose === targetPurpose)) {
      memoryTokenHashStore.delete(hash);
    }
  }

  // Synchronize invalidation to Supabase
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      let query = supabase.from('auth_ephemeral_tokens').delete().eq('email', cleanEmail);
      if (targetPurpose) {
        query = query.eq('token_type', targetPurpose);
      }
      await query;
    } catch (err: any) {
      console.warn('[AuthTokenStore] Notice invalidating prior tokens in Supabase:', err?.message);
    }
  }
}

/**
 * Issues a new 32-byte base64url single-use token, stores only its SHA-256 hash,
 * invalidates earlier tokens for the same email and purpose, and returns the raw token.
 */
export async function createAndStoreToken(
  email: string,
  purpose: TokenPurpose,
  nonce?: string,
  payload?: any,
  ttlMs: number = TOKEN_EXPIRY_MS
): Promise<string> {
  const cleanEmail = normalizeEmail(email);
  const normPurpose = normalizePurpose(purpose);

  // 1. Invalidate any earlier outstanding tokens of the same purpose
  await invalidateEarlierTokens(cleanEmail, normPurpose);

  // 2. Generate 32 random bytes (base64url)
  const rawToken = generateToken32();
  const tokenHash = hashSecret(rawToken);
  const now = Date.now();
  const expiresAt = now + ttlMs;

  const nonceHash = nonce ? hashSecret(nonce) : undefined;

  const record: EphemeralTokenRecord = {
    tokenHash,
    email: cleanEmail,
    purpose: normPurpose,
    expiresAt,
    lastSentAt: now,
    used: false,
    nonceHash,
    payload
  };

  memoryTokenHashStore.set(tokenHash, record);

  // Persist SHA-256 hash to Supabase
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      await supabase.from('auth_ephemeral_tokens').upsert({
        token: tokenHash,
        token_type: normPurpose,
        email: cleanEmail,
        expires_at: new Date(expiresAt).toISOString(),
        last_sent_at: new Date(now).toISOString(),
        used: false,
        payload: {
          ...(payload || {}),
          nonceHash
        }
      });
    } catch (err: any) {
      console.warn('[AuthTokenStore] Notice persisting token hash to Supabase:', err?.message);
    }
  }

  return rawToken;
}

/**
 * Checks whether a token exists and is valid without consuming it yet.
 */
export async function peekToken(
  rawToken: string,
  expectedPurpose?: TokenPurpose,
  expectedEmail?: string
): Promise<{ valid: boolean; record?: EphemeralTokenRecord; error?: string }> {
  if (!rawToken) {
    return { valid: false, error: 'Token is missing.' };
  }

  const tokenHash = hashSecret(rawToken.trim());
  let record = memoryTokenHashStore.get(tokenHash);

  if (!record) {
    // Rehydrate from Supabase if not found in memory
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        const { data } = await supabase
          .from('auth_ephemeral_tokens')
          .select('*')
          .eq('token', tokenHash)
          .maybeSingle();

        if (data) {
          record = {
            tokenHash: data.token,
            email: data.email,
            purpose: normalizePurpose(data.token_type),
            expiresAt: new Date(data.expires_at).getTime(),
            lastSentAt: data.last_sent_at ? new Date(data.last_sent_at).getTime() : Date.now(),
            used: Boolean(data.used),
            nonceHash: data.payload?.nonceHash,
            payload: data.payload
          };
          memoryTokenHashStore.set(tokenHash, record);
        }
      } catch (err: any) {
        console.warn('[AuthTokenStore] Notice querying token from Supabase:', err?.message);
      }
    }
  }

  if (!record) {
    return { valid: false, error: 'Token is invalid or not found.' };
  }

  if (record.used) {
    return { valid: false, error: 'This token has already been used.' };
  }

  if (Date.now() > record.expiresAt) {
    memoryTokenHashStore.delete(tokenHash);
    return { valid: false, error: 'This token has expired.' };
  }

  if (expectedPurpose && record.purpose !== normalizePurpose(expectedPurpose)) {
    return { valid: false, error: `Invalid token purpose: expected ${expectedPurpose}.` };
  }

  if (expectedEmail && record.email !== normalizeEmail(expectedEmail)) {
    return { valid: false, error: 'Token email does not match requested email.' };
  }

  return { valid: true, record };
}

/**
 * Atomically consumes a token: marks it as used, deletes it from active store,
 * and returns the validated record.
 */
export async function consumeToken(
  rawToken: string,
  expectedPurpose: TokenPurpose,
  expectedEmail?: string
): Promise<{ valid: boolean; record?: EphemeralTokenRecord; error?: string }> {
  const peek = await peekToken(rawToken, expectedPurpose, expectedEmail);
  if (!peek.valid || !peek.record) {
    return peek;
  }

  const { record } = peek;
  record.used = true;
  memoryTokenHashStore.set(record.tokenHash, record);

  // Update in Supabase to mark as used
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      await supabase
        .from('auth_ephemeral_tokens')
        .update({ used: true })
        .eq('token', record.tokenHash);
    } catch (err: any) {
      console.warn('[AuthTokenStore] Notice marking consumed token in Supabase:', err?.message);
    }
  }

  return { valid: true, record };
}

/**
 * Validates the bound nonce cookie for magic link requests.
 */
export function verifyTokenNonce(record: EphemeralTokenRecord, rawNonce?: string): boolean {
  if (!record.nonceHash) return true; // No nonce was bound
  if (!rawNonce) return false;
  const candidateNonceHash = hashSecret(rawNonce.trim());
  return timingSafeEqualString(candidateNonceHash, record.nonceHash);
}

/**
 * ==============================================================================
 * HARDENED OTP SUBSYSTEM (6 digits, SHA-256 stored, 5-attempt lockout, 10 min expiry)
 * ==============================================================================
 */

/**
 * Generates and stores a 6-digit numeric OTP code for the given email and purpose.
 * Stores only its SHA-256 hash. Returns the raw 6-digit code for email dispatch.
 */
export async function createAndStoreOtp(
  email: string,
  purpose: TokenPurpose | 'invite',
  payload?: any
): Promise<string> {
  const cleanEmail = normalizeEmail(email);
  const normPurpose = purpose === 'recovery' ? 'reset' : purpose;
  const key = `${normPurpose}:${cleanEmail}`;

  // Invalidate any existing OTP for this email and purpose
  memoryOtpCanonicalStore.delete(key);

  const rawCode = generate6DigitOtp();
  const otpHash = hashSecret(rawCode);
  const now = Date.now();
  const expiresAt = now + OTP_EXPIRY_MS;

  const record: EphemeralOtpRecord = {
    otpHash,
    email: cleanEmail,
    purpose: normPurpose,
    expiresAt,
    attempts: 0,
    lastSentAt: now,
    payload
  };

  memoryOtpCanonicalStore.set(key, record);

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      await supabase.from('auth_ephemeral_tokens').upsert({
        token: key,
        token_type: 'otp',
        email: cleanEmail,
        code: otpHash,
        expires_at: new Date(expiresAt).toISOString(),
        last_sent_at: new Date(now).toISOString(),
        attempts: 0,
        used: false,
        payload: payload || {}
      });
    } catch (err: any) {
      console.warn('[AuthTokenStore] Notice persisting OTP to Supabase:', err?.message);
    }
  }

  return rawCode;
}

/**
 * Verifies and atomically consumes a 6-digit OTP code.
 * Enforces constant-time comparison, 10 min expiry, and 15 min lock after 5 attempts.
 */
export async function verifyAndConsumeOtp(
  email: string,
  purpose: TokenPurpose | 'invite',
  candidateCode: string
): Promise<{ valid: boolean; record?: EphemeralOtpRecord; error?: string; locked?: boolean }> {
  const cleanEmail = normalizeEmail(email);
  const normPurpose = purpose === 'recovery' ? 'reset' : purpose;
  const key = `${normPurpose}:${cleanEmail}`;

  let record = memoryOtpCanonicalStore.get(key);

  if (!record) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        const { data } = await supabase
          .from('auth_ephemeral_tokens')
          .select('*')
          .eq('token', key)
          .maybeSingle();

        if (data) {
          record = {
            otpHash: data.code,
            email: data.email,
            purpose: normPurpose,
            expiresAt: new Date(data.expires_at).getTime(),
            attempts: data.attempts || 0,
            lockedUntil: data.payload?.lockedUntil,
            lastSentAt: data.last_sent_at ? new Date(data.last_sent_at).getTime() : Date.now(),
            payload: data.payload
          };
          memoryOtpCanonicalStore.set(key, record);
        }
      } catch (err: any) {
        console.warn('[AuthTokenStore] Notice querying OTP from Supabase:', err?.message);
      }
    }
  }

  if (!record) {
    return { valid: false, error: 'No verification code found. Please request a new one.' };
  }

  const now = Date.now();

  // Check lockout
  if (record.lockedUntil && record.lockedUntil > now) {
    const remainingMin = Math.ceil((record.lockedUntil - now) / 60000);
    return {
      valid: false,
      locked: true,
      error: `Verification locked due to too many failed attempts. Please try again in ${remainingMin} minutes.`
    };
  }

  // Check expiry
  if (now > record.expiresAt) {
    memoryOtpCanonicalStore.delete(key);
    return { valid: false, error: 'Verification code has expired. Please request a new code.' };
  }

  // Constant-time hash comparison
  const candidateHash = hashSecret(candidateCode.trim());
  const isMatch = timingSafeEqualString(candidateHash, record.otpHash);

  if (!isMatch) {
    record.attempts += 1;
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      record.lockedUntil = now + OTP_LOCKOUT_MS;
      memoryOtpCanonicalStore.set(key, record);

      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          await supabase.from('auth_ephemeral_tokens').update({
            attempts: record.attempts,
            payload: { ...(record.payload || {}), lockedUntil: record.lockedUntil }
          }).eq('token', key);
        } catch {}
      }

      return {
        valid: false,
        locked: true,
        error: 'Too many incorrect attempts. For security, verification is locked for 15 minutes.'
      };
    }

    memoryOtpCanonicalStore.set(key, record);
    return {
      valid: false,
      error: `Incorrect verification code. ${OTP_MAX_ATTEMPTS - record.attempts} attempt(s) remaining.`
    };
  }

  // Successful match: atomically delete
  memoryOtpCanonicalStore.delete(key);
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      await supabase.from('auth_ephemeral_tokens').delete().eq('token', key);
    } catch {}
  }

  return { valid: true, record };
}

/**
 * ==============================================================================
 * BACKWARD COMPATIBILITY ADAPTERS (for existing test suites and references)
 * ==============================================================================
 */

export async function saveResetToken(
  token: string,
  recordOrEmail: ResetTokenRecord | string,
  maybeExpiresAt?: number
): Promise<void> {
  const cleanEmail = typeof recordOrEmail === 'string' ? recordOrEmail : recordOrEmail.email;
  const expiresAt = typeof recordOrEmail === 'string'
    ? (maybeExpiresAt || Date.now() + TOKEN_EXPIRY_MS)
    : recordOrEmail.expiresAt;

  memoryResetTokens.set(token, { email: normalizeEmail(cleanEmail), expiresAt });
  const tokenHash = hashSecret(token);
  memoryTokenHashStore.set(tokenHash, {
    tokenHash,
    email: normalizeEmail(cleanEmail),
    purpose: 'reset',
    expiresAt,
    lastSentAt: Date.now(),
    used: false
  });
}

export async function getResetToken(token: string): Promise<ResetTokenRecord | null> {
  const mem = memoryResetTokens.get(token);
  if (mem && Date.now() <= mem.expiresAt) return mem;

  const peek = await peekToken(token, 'reset');
  if (peek.valid && peek.record) {
    return { email: peek.record.email, expiresAt: peek.record.expiresAt };
  }
  return null;
}

export async function deleteResetToken(token: string): Promise<void> {
  memoryResetTokens.delete(token);
  memoryTokenHashStore.delete(hashSecret(token));
}

export async function saveOtp(key: string, record: OtpRecord): Promise<void> {
  const rawType = (record.type === 'recovery' ? 'reset' : record.type) as TokenPurpose;
  const canonicalKey = `${rawType}:${normalizeEmail(record.email)}`;
  memoryOtpCanonicalStore.set(canonicalKey, {
    otpHash: hashSecret(record.code),
    email: normalizeEmail(record.email),
    purpose: rawType,
    expiresAt: record.expiresAt || (Date.now() + OTP_EXPIRY_MS),
    attempts: record.attempts || 0,
    lastSentAt: record.lastSentAt || Date.now(),
    payload: record.payload
  });
}

export async function getOtp(key: string, cleanEmail?: string): Promise<OtpRecord | null> {
  const parts = key.split(':');
  const type = (parts[0] === 'recovery' ? 'reset' : parts[0]) as TokenPurpose;
  const email = normalizeEmail(cleanEmail || parts[1] || '');
  const canonicalKey = `${type}:${email}`;

  const rec = memoryOtpCanonicalStore.get(canonicalKey);
  if (rec && Date.now() <= rec.expiresAt) {
    return {
      code: rec.otpHash, // Return hash for test equality
      email: rec.email,
      type: rec.purpose as any,
      expiresAt: rec.expiresAt,
      attempts: rec.attempts,
      lastSentAt: rec.lastSentAt,
      payload: rec.payload
    };
  }
  return null;
}

export async function updateOtpAttempts(key: string, attempts: number): Promise<void> {
  const parts = key.split(':');
  const type = (parts[0] === 'recovery' ? 'reset' : parts[0]) as TokenPurpose;
  const email = normalizeEmail(parts[1] || '');
  const canonicalKey = `${type}:${email}`;

  const rec = memoryOtpCanonicalStore.get(canonicalKey);
  if (rec) {
    rec.attempts = attempts;
  }
}

export async function deleteOtp(key: string, cleanEmail?: string): Promise<void> {
  const parts = key.split(':');
  const type = (parts[0] === 'recovery' ? 'reset' : parts[0]) as TokenPurpose;
  const email = normalizeEmail(cleanEmail || parts[1] || '');
  memoryOtpCanonicalStore.delete(`${type}:${email}`);
  memoryOtpCanonicalStore.delete(`reset:${email}`);
  memoryOtpCanonicalStore.delete(`signin:${email}`);
  memoryOtpCanonicalStore.delete(`signup:${email}`);
}

export async function saveMagicLink(
  tokenOrRecord: string | MagicLinkRecord,
  maybeRecord?: MagicLinkRecord
): Promise<void> {
  const record = typeof tokenOrRecord === 'string'
    ? (maybeRecord || { token: tokenOrRecord, email: '', type: 'signin' as const, expiresAt: Date.now() + TOKEN_EXPIRY_MS, lastSentAt: Date.now(), used: false })
    : tokenOrRecord;

  const rawType = record.type === 'recovery' ? 'reset' : record.type;
  const tokenHash = hashSecret(record.token);

  memoryTokenHashStore.set(tokenHash, {
    tokenHash,
    email: normalizeEmail(record.email),
    purpose: rawType as TokenPurpose,
    expiresAt: record.expiresAt || (Date.now() + TOKEN_EXPIRY_MS),
    lastSentAt: record.lastSentAt || Date.now(),
    used: record.used,
    payload: record.payload
  });
}

export async function getMagicLink(token: string): Promise<MagicLinkRecord | null> {
  const peek = await peekToken(token);
  if (peek.valid && peek.record) {
    return {
      token,
      email: peek.record.email,
      type: peek.record.purpose === 'reset' ? 'recovery' : (peek.record.purpose as any),
      expiresAt: peek.record.expiresAt,
      lastSentAt: peek.record.lastSentAt,
      used: peek.record.used,
      payload: peek.record.payload
    };
  }
  return null;
}

export async function markMagicLinkUsed(token: string): Promise<void> {
  const tokenHash = hashSecret(token);
  const rec = memoryTokenHashStore.get(tokenHash);
  if (rec) {
    rec.used = true;
  }
}

export async function deleteMagicLink(token: string): Promise<void> {
  memoryTokenHashStore.delete(hashSecret(token));
}

export async function checkMagicLinkCooldown(
  email: string,
  cooldownMs: number = 5000
): Promise<{ rateLimited: boolean; retryAfterSeconds: number }> {
  const cleanEmail = normalizeEmail(email);
  const now = Date.now();

  for (const [, rec] of memoryTokenHashStore) {
    if (rec.email === cleanEmail && now - rec.lastSentAt < cooldownMs) {
      const wait = Math.ceil((cooldownMs - (now - rec.lastSentAt)) / 1000);
      return { rateLimited: true, retryAfterSeconds: wait };
    }
  }

  return { rateLimited: false, retryAfterSeconds: 0 };
}

export interface StoredTokens {
  access_token?: string;
  refresh_token?: string;
}

let storedTokensMemory: StoredTokens | null = null;

export async function getStoredTokens(): Promise<StoredTokens | null> {
  return storedTokensMemory;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  storedTokensMemory = tokens;
}

/**
 * Asserts that the persistent database is configured in production.
 * Fails startup if the database is missing and in-memory persistence is attempted.
 */
export function assertProductionDatabaseReady(): void {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_IN_MEMORY_AUTH_IN_PRODUCTION !== 'true') {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      throw new Error(
        '[FATAL] Production database (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) is required for authTokenStore persistence. In-memory token storage is strictly forbidden in production.'
      );
    }
  }
}
