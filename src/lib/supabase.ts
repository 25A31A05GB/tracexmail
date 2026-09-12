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

// If client-side VITE_ variables are missing, attempt runtime fetch of public config from server
if (typeof window !== 'undefined' && !isSupabaseConfigured) {
  fetch('/api/auth/status')
    .then(r => r.json())
    .then(data => {
      if (data?.supabaseUrl && data?.supabaseAnonKey && data.supabaseUrl.startsWith('http')) {
        supabase = createClient(data.supabaseUrl, data.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage,
          },
        });
        isSupabaseConfigured = true;
      }
    })
    .catch(() => {
      // Offline or network error; fallback remains placeholder
    });
}

export default supabase;

