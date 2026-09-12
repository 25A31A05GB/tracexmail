import { createClient, SupabaseClient } from '@supabase/supabase-js';

const clientEnvUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const clientEnvKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

/**
 * Validates whether the Supabase URL and Anon Key are well-formed and belong to the same project.
 */
export function validateSupabaseCredentials(url?: string | null, key?: string | null): boolean {
  if (!url || !key) return false;
  if (url.includes('placeholder') || key.includes('placeholder')) return false;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;

  // Validate JWT structure
  try {
    const parts = key.split('.');
    if (parts.length !== 3) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);

    // Extract project ref from URL e.g. https://<ref>.supabase.co
    const urlMatch = url.match(/https?:\/\/([^.]+)\.supabase\./i);
    if (urlMatch && urlMatch[1] && parsed.ref) {
      if (urlMatch[1].toLowerCase() !== parsed.ref.toLowerCase()) {
        console.warn(
          `[Supabase] Mismatched URL ref ("${urlMatch[1]}") and Anon Key ref ("${parsed.ref}"). Supabase client disabled.`
        );
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export let isSupabaseConfigured = validateSupabaseCredentials(clientEnvUrl, clientEnvKey);
let configuredSupabaseUrl: string = isSupabaseConfigured ? clientEnvUrl : '';

/**
 * Frontend Supabase Client initialized with verified VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
 * Configured with session persistence, token auto-refresh, and URL session detection.
 */
export let supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? clientEnvUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? clientEnvKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
    realtime: {
      params: {
        eventsPerSecond: isSupabaseConfigured ? 10 : 0,
      },
    },
  }
);

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
      if (
        data?.supabaseConfigured &&
        data?.supabaseUrl &&
        data?.supabaseAnonKey &&
        validateSupabaseCredentials(data.supabaseUrl, data.supabaseAnonKey)
      ) {
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

