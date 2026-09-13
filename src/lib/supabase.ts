import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';

const clientEnvUrl =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  'https://zinyrzlswkwwzxlgptmq.supabase.co';
const clientEnvKey =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inppbnlyemxzd2t3d3p4bGdwdG1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MjQ1MDksImV4cCI6MjEwMzUwMDUwOX0.9NonejJ0MULA1yPkyqFSIA7al4vnPsahfORLyhYvZqc';

/**
 * Returns the canonical Google OAuth callback URL.
 */
export function getGoogleOAuthRedirectUrl(): string {
  if (typeof window === 'undefined') return '/auth/callback';
  return `${window.location.origin}/auth/callback`;
}

/**
 * Comprehensive diagnostic logger for Supabase Authentication operations.
 */
export function logSupabaseAuthEvent(event: string, details?: any, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = `[SupabaseAuth:${event}] [${timestamp}]`;
  if (level === 'error') {
    console.error(prefix, details);
  } else if (level === 'warn') {
    console.warn(prefix, details);
  } else {
    console.log(prefix, details);
  }
}

/**
 * Validates whether the Supabase URL and Anon Key are well-formed.
 */
export function validateSupabaseCredentials(url?: string | null, key?: string | null): boolean {
  if (!url || !key) return false;
  if (url.includes('placeholder') || key.includes('placeholder')) return false;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  if (key.trim().length < 15) return false;

  // Validate JWT structure if key follows the 3-part format
  try {
    const parts = key.split('.');
    if (parts.length === 3) {
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
    }
    return true;
  } catch {
    // If base64 decode fails on non-standard token, accept valid URL + non-empty key
    return true;
  }
}

export let isSupabaseConfigured = validateSupabaseCredentials(clientEnvUrl, clientEnvKey);
let configuredSupabaseUrl: string = isSupabaseConfigured ? clientEnvUrl : '';

/**
 * Frontend Supabase Client initialized with verified VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
 * Configured with session persistence, token auto-refresh, PKCE auth flow, and URL session detection.
 */
export let supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? clientEnvUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? clientEnvKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured,
      flowType: 'pkce',
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
      logSupabaseAuthEvent('Init', 'Querying /api/auth/status for runtime configuration...');
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
            flowType: 'pkce',
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          },
        });
        isSupabaseConfigured = true;
        logSupabaseAuthEvent('InitSuccess', { url: data.supabaseUrl });
        return true;
      } else {
        logSupabaseAuthEvent('InitNotice', 'Supabase credentials not active from server status endpoint.');
      }
    } catch (err: any) {
      logSupabaseAuthEvent('InitError', { message: err?.message }, 'warn');
    }
    return isSupabaseConfigured;
  })();

  return initPromise;
}

/**
 * Verifies if the current user session has an active, unexpired JWT token.
 */
export async function getValidSupabaseSession(): Promise<{ session: Session | null; user: User | null; valid: boolean; error?: string }> {
  try {
    if (!getIsSupabaseConfigured() || !supabase) {
      return { session: null, user: null, valid: false, error: 'Supabase client is not configured' };
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      logSupabaseAuthEvent('SessionCheckError', { error: error.message }, 'warn');
      return { session: null, user: null, valid: false, error: error.message };
    }

    if (!data.session || !data.session.access_token) {
      return { session: null, user: null, valid: false, error: 'No active session found' };
    }

    // Check expiration timestamp (with 30s buffer)
    const expiresAt = data.session.expires_at;
    if (expiresAt && (expiresAt * 1000) < (Date.now() + 30000)) {
      logSupabaseAuthEvent('TokenExpired', { expiresAt }, 'warn');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.session) {
        return { session: null, user: null, valid: false, error: refreshError?.message || 'Token refresh failed' };
      }
      return { session: refreshData.session, user: refreshData.session.user, valid: true };
    }

    return { session: data.session, user: data.session.user, valid: true };
  } catch (err: any) {
    return { session: null, user: null, valid: false, error: err?.message };
  }
}

// If client-side VITE_ variables are missing, attempt runtime fetch of public config from server
if (typeof window !== 'undefined' && !isSupabaseConfigured) {
  ensureSupabaseClient().catch(() => {});
}

export default supabase;

