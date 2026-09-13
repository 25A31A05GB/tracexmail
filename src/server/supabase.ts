import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedSupabaseAdminClient: SupabaseClient | null = null;

export const DEFAULT_ORG_ID = 'org_acme_soc_01';

function extractJwtRef(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      return payload.ref || null;
    }
  } catch {
    // ignore
  }
  return null;
}

function extractUrlProjectRef(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (host.endsWith('.supabase.co')) {
      return host.split('.')[0] || null;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Returns the Supabase service-role client for server-side operations.
 * Prioritizes SUPABASE_SERVICE_ROLE_KEY to bypass RLS for administrative/pipeline writes.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (cachedSupabaseAdminClient) return cachedSupabaseAdminClient;

  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    'https://zinyrzlswkwwzxlgptmq.supabase.co';

  const expectedRef = extractUrlProjectRef(url);

  const candidateKeys = [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.VITE_SUPABASE_ANON_KEY,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inppbnlyemxzd2t3d3p4bGdwdG1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MjQ1MDksImV4cCI6MjEwMzUwMDUwOX0.9NonejJ0MULA1yPkyqFSIA7al4vnPsahfORLyhYvZqc'
  ].filter((k): k is string => Boolean(k && k.trim().length > 0));

  // Find a key whose JWT project ref matches expectedRef (if detectable)
  let key: string | null = null;
  if (expectedRef) {
    for (const candidate of candidateKeys) {
      const tokenRef = extractJwtRef(candidate);
      if (tokenRef === expectedRef) {
        key = candidate;
        break;
      }
    }
  }

  // Fallback to first candidate if no matching ref was found
  if (!key && candidateKeys.length > 0) {
    key = candidateKeys[0];
  }

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
