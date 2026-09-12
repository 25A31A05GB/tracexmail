import { createClient, SupabaseClient } from '@supabase/supabase-js';

const clientEnvUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const clientEnvKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export let isSupabaseConfigured = Boolean(clientEnvUrl && clientEnvKey);

/**
 * Frontend Supabase Client initialized with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
 * Configured with session persistence, token auto-refresh, and URL session detection.
 */
export let supabase: SupabaseClient = createClient(
  clientEnvUrl || 'https://placeholder.supabase.co',
  clientEnvKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
);

let configuredSupabaseUrl: string = clientEnvUrl;

export function getIsSupabaseConfigured(): boolean {
  return isSupabaseConfigured && !configuredSupabaseUrl.includes('placeholder');
}

let initPromise: Promise<boolean> | null = null;

/**
 * Ensures the Supabase client is configured, fetching from /api/auth/status if needed.
 */
export async function ensureSupabaseClient(): Promise<boolean> {
  if (isSupabaseConfigured && configuredSupabaseUrl && !configuredSupabaseUrl.includes('placeholder')) {
    return true;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      if (data?.supabaseUrl && data?.supabaseAnonKey && data.supabaseUrl.startsWith('http')) {
        configuredSupabaseUrl = data.supabaseUrl;
        supabase = createClient(data.supabaseUrl, data.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          },
        });
        isSupabaseConfigured = true;
        return true;
      }
    } catch {
      // ignore
    }
    return isSupabaseConfigured;
  })();

  return initPromise;
}

// If client-side VITE_ variables are missing, attempt runtime fetch of public config from server
if (typeof window !== 'undefined' && !isSupabaseConfigured) {
  ensureSupabaseClient().catch(() => {});
}

export default supabase;

