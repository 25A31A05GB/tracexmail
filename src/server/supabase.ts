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
      console.error(
        '[Supabase Admin] CRITICAL CONFIGURATION ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is missing. ' +
        'The admin client strictly requires the service role key to bypass RLS for administrative operations and pipeline writes. ' +
        'Fallback to anon keys has been disabled to prevent silent permission failures.'
      );
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

