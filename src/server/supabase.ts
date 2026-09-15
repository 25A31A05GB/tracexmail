import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedSupabaseAdminClient: SupabaseClient | null = null;
let hasLoggedAdminNotice = false;

export const DEFAULT_ORG_ID = 'org_acme_soc_01';

/**
 * Returns the Supabase service-role client for server-side operations.
 * Strictly requires SUPABASE_SERVICE_ROLE_KEY to bypass RLS for administrative and pipeline writes.
 * In development or local sandbox mode without service-role credentials, returns null gracefully
 * so in-memory fallbacks operate seamlessly.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (cachedSupabaseAdminClient) return cachedSupabaseAdminClient;

  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_DB_URL;

  const serviceRoleKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY
  )?.trim();

  if (!url) {
    if (!hasLoggedAdminNotice) {
      hasLoggedAdminNotice = true;
      if (process.env.NODE_ENV === 'production') {
        console.error(
          '[Supabase Admin] CRITICAL CONFIGURATION ERROR: SUPABASE_URL (or VITE_SUPABASE_URL) is not defined. ' +
          'Admin client cannot initialize without a valid Supabase project URL.'
        );
      } else {
        console.info('[Supabase Admin] SUPABASE_URL not configured. Operating in local in-memory storage mode.');
      }
    }
    return null;
  }

  if (!serviceRoleKey) {
    if (!hasLoggedAdminNotice) {
      hasLoggedAdminNotice = true;
      if (process.env.NODE_ENV === 'production') {
        console.warn(
          '[Supabase Admin] SUPABASE_SERVICE_ROLE_KEY is not defined. Operating in resilient in-memory storage mode.'
        );
      } else {
        console.info('[Supabase Admin] SUPABASE_SERVICE_ROLE_KEY not configured. Operating in local in-memory storage mode.');
      }
    }
    return null;
  }

  // Validate that serviceRoleKey is a valid JWT matching the Supabase project ref
  const urlMatch = url.match(/https?:\/\/([^.]+)\.supabase\./i);
  const urlRef = urlMatch ? urlMatch[1].toLowerCase() : null;

  try {
    const parts = serviceRoleKey.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
      if (urlRef && payload.ref && payload.ref.toLowerCase() !== urlRef) {
        if (!hasLoggedAdminNotice) {
          hasLoggedAdminNotice = true;
          console.warn(
            `[Supabase Admin] SUPABASE_SERVICE_ROLE_KEY project ref mismatch (URL: "${urlRef}", Key: "${payload.ref}"). Operating in resilient in-memory storage mode.`
          );
        }
        return null;
      }
      if (payload.role && payload.role !== 'service_role') {
        if (!hasLoggedAdminNotice) {
          hasLoggedAdminNotice = true;
          console.warn(
            `[Supabase Admin] SUPABASE_SERVICE_ROLE_KEY has role "${payload.role}" (expected "service_role"). Operating in resilient in-memory storage mode.`
          );
        }
        return null;
      }
    }
  } catch (parseErr) {
    if (!hasLoggedAdminNotice) {
      hasLoggedAdminNotice = true;
      console.warn('[Supabase Admin] SUPABASE_SERVICE_ROLE_KEY is not a valid JWT. Operating in resilient in-memory storage mode.');
    }
    return null;
  }

  if (url && serviceRoleKey && url.startsWith('http')) {
    try {
      cachedSupabaseAdminClient = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      return cachedSupabaseAdminClient;
    } catch (err) {
      console.error('[Supabase Admin] Failed initializing Supabase admin client:', err);
      return null;
    }
  }
  return null;
}

export const getSupabaseClient = getSupabaseAdminClient;

export function isSupabaseConfigured(): boolean {
  return getSupabaseAdminClient() !== null;
}

