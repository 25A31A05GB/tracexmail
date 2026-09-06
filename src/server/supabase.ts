import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedSupabaseAdminClient: SupabaseClient | null = null;

export const DEFAULT_ORG_ID = 'org_acme_soc_01';

/**
 * Returns the Supabase service-role client for server-side operations.
 * Prioritizes SUPABASE_SERVICE_ROLE_KEY to bypass RLS for administrative/pipeline writes.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (cachedSupabaseAdminClient) return cachedSupabaseAdminClient;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_DB_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  if (url && key && url.startsWith('http')) {
    try {
      cachedSupabaseAdminClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      return cachedSupabaseAdminClient;
    } catch (err) {
      console.warn('[Supabase] Failed initializing Supabase admin client:', err);
      return null;
    }
  }
  return null;
}

export const getSupabaseClient = getSupabaseAdminClient;

export function isSupabaseConfigured(): boolean {
  return getSupabaseAdminClient() !== null;
}
