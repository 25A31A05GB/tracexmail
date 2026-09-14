import { getSupabaseAdminClient } from './supabase';

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

// In-memory caches for sub-millisecond lookups
const memoryOtpStore = new Map<string, OtpRecord>();
const memoryMagicLinks = new Map<string, MagicLinkRecord>();
const memoryResetTokens = new Map<string, ResetTokenRecord>();

/**
 * ==============================================================================
 * OTP TOKEN STORE
 * ==============================================================================
 */

export async function saveOtp(key: string, record: OtpRecord): Promise<void> {
  memoryOtpStore.set(key, record);

  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  try {
    await supabase.from('auth_ephemeral_tokens').upsert({
      token: key,
      token_type: 'otp',
      email: record.email.toLowerCase(),
      code: record.code,
      expires_at: new Date(record.expiresAt).toISOString(),
      last_sent_at: new Date(record.lastSentAt).toISOString(),
      attempts: record.attempts || 0,
      used: false,
      payload: record.payload || {}
    });
  } catch (err: any) {
    console.warn('[AuthTokenStore] Failed persisting OTP to Supabase:', err?.message);
  }
}

export async function getOtp(key: string, cleanEmail?: string): Promise<OtpRecord | null> {
  // 1. Check in-memory first
  if (memoryOtpStore.has(key)) {
    return memoryOtpStore.get(key)!;
  }

  // Fallback checks across variant keys in memory if cleanEmail provided
  if (cleanEmail) {
    const candidates = [
      `recovery:${cleanEmail}`,
      `reset:${cleanEmail}`,
      `signup:${cleanEmail}`,
      `any:${cleanEmail}`
    ];
    for (const cand of candidates) {
      if (memoryOtpStore.has(cand)) {
        return memoryOtpStore.get(cand)!;
      }
    }
  }

  // 2. Rehydrate from Supabase if server restarted
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  try {
    let query = supabase.from('auth_ephemeral_tokens').select('*').eq('token_type', 'otp');

    if (cleanEmail) {
      query = query.or(`token.eq.${key},token.like.%:${cleanEmail}`);
    } else {
      query = query.eq('token', key);
    }

    const { data, error } = await query.order('last_sent_at', { ascending: false }).limit(1).maybeSingle();

    if (error || !data) return null;

    const expiresAt = new Date(data.expires_at).getTime();
    if (Date.now() > expiresAt) {
      deleteOtp(data.token).catch(() => {});
      return null;
    }

    const rec: OtpRecord = {
      code: data.code,
      email: data.email,
      type: (data.token.split(':')[0] as any) || 'signup',
      expiresAt,
      attempts: data.attempts || 0,
      lastSentAt: data.last_sent_at ? new Date(data.last_sent_at).getTime() : Date.now(),
      payload: data.payload || null
    };

    memoryOtpStore.set(data.token, rec);
    return rec;
  } catch (err: any) {
    console.warn('[AuthTokenStore] Failed fetching OTP from Supabase:', err?.message);
    return null;
  }
}

export async function updateOtpAttempts(key: string, attempts: number): Promise<void> {
  const mem = memoryOtpStore.get(key);
  if (mem) {
    mem.attempts = attempts;
    memoryOtpStore.set(key, mem);
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  try {
    await supabase.from('auth_ephemeral_tokens').update({ attempts }).eq('token', key);
  } catch (err: any) {
    console.warn('[AuthTokenStore] Failed updating OTP attempts in Supabase:', err?.message);
  }
}

export async function deleteOtp(key: string, cleanEmail?: string): Promise<void> {
  memoryOtpStore.delete(key);
  if (cleanEmail) {
    memoryOtpStore.delete(`any:${cleanEmail}`);
    memoryOtpStore.delete(`recovery:${cleanEmail}`);
    memoryOtpStore.delete(`reset:${cleanEmail}`);
    memoryOtpStore.delete(`signup:${cleanEmail}`);
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  try {
    if (cleanEmail) {
      await supabase.from('auth_ephemeral_tokens').delete().eq('email', cleanEmail.toLowerCase()).eq('token_type', 'otp');
    } else {
      await supabase.from('auth_ephemeral_tokens').delete().eq('token', key);
    }
  } catch (err: any) {
    console.warn('[AuthTokenStore] Failed deleting OTP from Supabase:', err?.message);
  }
}

/**
 * ==============================================================================
 * MAGIC LINK TOKEN STORE
 * ==============================================================================
 */

export async function saveMagicLink(
  tokenOrRecord: string | MagicLinkRecord,
  maybeRecord?: MagicLinkRecord
): Promise<void> {
  const record: MagicLinkRecord = typeof tokenOrRecord === 'string'
    ? (maybeRecord || { token: tokenOrRecord, email: '', type: 'signin', expiresAt: Date.now() + 15 * 60 * 1000, lastSentAt: Date.now(), used: false })
    : tokenOrRecord;

  memoryMagicLinks.set(record.token, record);

  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  try {
    await supabase.from('auth_ephemeral_tokens').upsert({
      token: record.token,
      token_type: 'magic_link',
      email: record.email.toLowerCase(),
      expires_at: new Date(record.expiresAt).toISOString(),
      last_sent_at: new Date(record.lastSentAt).toISOString(),
      used: record.used,
      payload: {
        ...(record.payload || {}),
        magic_link_type: record.type
      }
    });
  } catch (err: any) {
    console.warn('[AuthTokenStore] Failed persisting magic link to Supabase:', err?.message);
  }
}

export async function getMagicLink(token: string): Promise<MagicLinkRecord | null> {
  // 1. Memory check
  if (memoryMagicLinks.has(token)) {
    return memoryMagicLinks.get(token)!;
  }

  // 2. Database rehydration on restart
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('auth_ephemeral_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error || !data) return null;

    const expiresAt = new Date(data.expires_at).getTime();
    const rec: MagicLinkRecord = {
      token: data.token,
      email: data.email,
      type: data.payload?.magic_link_type || 'signin',
      expiresAt,
      lastSentAt: data.last_sent_at ? new Date(data.last_sent_at).getTime() : Date.now(),
      used: Boolean(data.used),
      payload: data.payload || null
    };

    memoryMagicLinks.set(token, rec);
    return rec;
  } catch (err: any) {
    console.warn('[AuthTokenStore] Failed fetching magic link from Supabase:', err?.message);
    return null;
  }
}

export async function markMagicLinkUsed(token: string): Promise<void> {
  const rec = memoryMagicLinks.get(token);
  if (rec) {
    rec.used = true;
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  try {
    await supabase.from('auth_ephemeral_tokens').update({ used: true }).eq('token', token);
  } catch (err: any) {
    console.warn('[AuthTokenStore] Failed marking magic link used in Supabase:', err?.message);
  }
}

export async function deleteMagicLink(token: string): Promise<void> {
  memoryMagicLinks.delete(token);

  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  try {
    await supabase.from('auth_ephemeral_tokens').delete().eq('token', token);
  } catch (err: any) {
    console.warn('[AuthTokenStore] Failed deleting magic link from Supabase:', err?.message);
  }
}

export async function checkMagicLinkCooldown(
  email: string,
  cooldownMs: number = 5000
): Promise<{ rateLimited: boolean; retryAfterSeconds: number }> {
  const cleanEmail = email.trim().toLowerCase();
  const now = Date.now();

  // Check in-memory
  for (const [, rec] of memoryMagicLinks) {
    if (rec.email === cleanEmail && now - rec.lastSentAt < cooldownMs) {
      const wait = Math.ceil((cooldownMs - (now - rec.lastSentAt)) / 1000);
      return { rateLimited: true, retryAfterSeconds: wait };
    }
  }

  // Check database for recent requests
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      const { data } = await supabase
        .from('auth_ephemeral_tokens')
        .select('last_sent_at')
        .eq('email', cleanEmail)
        .eq('token_type', 'magic_link')
        .order('last_sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.last_sent_at) {
        const lastSent = new Date(data.last_sent_at).getTime();
        if (now - lastSent < cooldownMs) {
          const wait = Math.ceil((cooldownMs - (now - lastSent)) / 1000);
          return { rateLimited: true, retryAfterSeconds: wait };
        }
      }
    } catch {
      // Graceful fallback to memory check
    }
  }

  return { rateLimited: false, retryAfterSeconds: 0 };
}

/**
 * ==============================================================================
 * PASSWORD RESET TOKEN STORE
 * ==============================================================================
 */

export async function saveResetToken(
  token: string,
  recordOrEmail: ResetTokenRecord | string,
  maybeExpiresAt?: number
): Promise<void> {
  const record: ResetTokenRecord = typeof recordOrEmail === 'string'
    ? { email: recordOrEmail, expiresAt: maybeExpiresAt || (Date.now() + 30 * 60 * 1000) }
    : recordOrEmail;

  memoryResetTokens.set(token, record);

  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  try {
    await supabase.from('auth_ephemeral_tokens').upsert({
      token,
      token_type: 'reset',
      email: record.email.toLowerCase(),
      expires_at: new Date(record.expiresAt).toISOString(),
      last_sent_at: new Date().toISOString(),
      used: false
    });
  } catch (err: any) {
    console.warn('[AuthTokenStore] Failed persisting reset token to Supabase:', err?.message);
  }
}

export async function getResetToken(token: string): Promise<ResetTokenRecord | null> {
  if (memoryResetTokens.has(token)) {
    return memoryResetTokens.get(token)!;
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('auth_ephemeral_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error || !data) return null;

    const expiresAt = new Date(data.expires_at).getTime();
    if (Date.now() > expiresAt) {
      deleteResetToken(token).catch(() => {});
      return null;
    }

    const rec: ResetTokenRecord = {
      email: data.email,
      expiresAt
    };
    memoryResetTokens.set(token, rec);
    return rec;
  } catch (err: any) {
    console.warn('[AuthTokenStore] Failed fetching reset token from Supabase:', err?.message);
    return null;
  }
}

export async function deleteResetToken(token: string): Promise<void> {
  memoryResetTokens.delete(token);

  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  try {
    await supabase.from('auth_ephemeral_tokens').delete().eq('token', token);
  } catch (err: any) {
    console.warn('[AuthTokenStore] Failed deleting reset token from Supabase:', err?.message);
  }
}
