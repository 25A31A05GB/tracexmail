import { supabase, isSupabaseConfigured, ensureSupabaseClient, getIsSupabaseConfigured } from './supabase';

export interface GoogleAuthResult {
  success: boolean;
  error?: string;
  user?: any;
  isDemo?: boolean;
  notConfigured?: boolean;
}

/**
 * Checks whether the application is running inside an iframe
 * (such as Google AI Studio preview sandbox).
 */
export function isRunningInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Helper to simulate a Google authenticated session when Supabase credentials
 * are not yet provisioned in a sandbox environment.
 */
export function signInWithGoogleDemoSession(): GoogleAuthResult {
  try {
    const demoUser = {
      id: 'usr_google_' + Math.random().toString(36).substring(2, 9),
      email: 'alex.vance.sec@gmail.com',
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: {
        full_name: 'Alex Vance (Google)',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&fit=crop&crop=face',
        name: 'Alex Vance',
        email: 'alex.vance.sec@gmail.com',
        role: 'analyst'
      },
      email_confirmed_at: new Date().toISOString()
    };

    // Save to local enclave session format
    const localSession = {
      token: 'demo_google_jwt_' + Date.now(),
      user: demoUser,
      profile: {
        id: demoUser.id,
        organization_id: 'org_acme_soc_01',
        role: 'analyst',
        full_name: 'Alex Vance (Google Account)',
        email: demoUser.email,
        account_type: 'organization',
        email_verified: true,
        created_at: new Date().toISOString()
      },
      storedAt: Date.now()
    };

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('tracexmail_enclave_session', JSON.stringify(localSession));
    }

    return {
      success: true,
      user: demoUser,
      isDemo: true
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to initialize demo Google session.'
    };
  }
}

/**
 * Initiates Supabase Google OAuth sign-in.
 * Handles both iframe-safe popup mode and top-level redirect mode.
 */
export async function signInWithGoogleOAuth(): Promise<GoogleAuthResult> {
  // Try to dynamically ensure client configuration before failing
  await ensureSupabaseClient();

  if (!getIsSupabaseConfigured() || !supabase) {
    return {
      success: false,
      notConfigured: true,
      error: 'Supabase credentials are not configured in this environment. To enable live Google Auth via Supabase, specify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (and enable Google Provider in the Supabase Authentication dashboard).'
    };
  }

  const inIframe = isRunningInIframe();
  const callbackUrl = `${window.location.origin}/auth/callback`;

  try {
    // Inside an iframe (e.g. AI Studio preview), redirecting inside the iframe
    // causes Google accounts to fail with X-Frame-Options: SAMEORIGIN.
    // We request the OAuth URL with skipBrowserRedirect and open a popup window.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
        skipBrowserRedirect: inIframe,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('provider is not enabled') || msg.includes('unsupported provider')) {
        return {
          success: false,
          error: 'Google OAuth provider is not enabled in your Supabase project. Go to Supabase Dashboard -> Authentication -> Providers -> Google, toggle it ON, and enter your Google OAuth Client ID & Secret.'
        };
      }
      return {
        success: false,
        error: error.message
      };
    }

    // In top-level mode where skipBrowserRedirect is false, Supabase already initiates the redirect
    if (!inIframe || !data?.url) {
      return { success: true };
    }

    // In iframe mode: open provider authorization URL directly in a popup window
    const width = 560;
    const height = 680;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      data.url,
      'tracexmail_google_auth_popup',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=1,resizable=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      // Browser popup blocker prevented opening the popup window
      return {
        success: false,
        error: 'The Google authentication popup was blocked by your browser. Please allow popups for this site and try again.'
      };
    }

    // Await message from the popup or popup closure
    return new Promise<GoogleAuthResult>((resolve) => {
      let resolved = false;

      const cleanup = () => {
        window.removeEventListener('message', messageListener);
        clearInterval(pollTimer);
      };

      const messageListener = async (event: MessageEvent) => {
        // Validate origin: accept local or matching origin
        if (event.origin !== window.location.origin && !event.origin.endsWith('.run.app') && !event.origin.includes('localhost')) {
          return;
        }

        if (event.data?.type === 'SUPABASE_AUTH_SUCCESS') {
          if (resolved) return;
          resolved = true;
          cleanup();

          try {
            // Check if tokens were passed via hash or PKCE code via search
            const hash = event.data.hash || '';
            const search = event.data.search || '';

            if (hash) {
              const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
              const accessToken = hashParams.get('access_token');
              const refreshToken = hashParams.get('refresh_token');
              if (accessToken && refreshToken) {
                await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken
                });
              }
            } else if (search) {
              const searchParams = new URLSearchParams(search);
              const code = searchParams.get('code');
              if (code) {
                await (supabase.auth as any).exchangeCodeForSession?.(code);
              }
            }

            const { data: sessionData } = await supabase.auth.getSession();
            resolve({
              success: true,
              user: sessionData?.session?.user
            });
          } catch (err: any) {
            resolve({
              success: false,
              error: err?.message || 'Failed finalizing Google authentication session.'
            });
          }
        }
      };

      window.addEventListener('message', messageListener);

      // Check if user manually closed the popup without authenticating
      const pollTimer = setInterval(async () => {
        if (popup.closed) {
          clearInterval(pollTimer);
          if (resolved) return;

          // Check if session was established despite popup closing
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData?.session) {
              resolved = true;
              cleanup();
              resolve({
                success: true,
                user: sessionData.session.user
              });
              return;
            }
          } catch {}

          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve({
                success: false,
                error: 'Authentication cancelled: the Google sign-in window was closed.'
              });
            }
          }, 600);
        }
      }, 500);

      // Safety timeout: 2 minutes
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({
            success: false,
            error: 'Authentication timed out. Please try again.'
          });
        }
      }, 120000);
    });
  } catch (err: any) {
    console.error('[Google OAuth Error]', err);
    return {
      success: false,
      error: err?.message || 'An unexpected error occurred while initiating Google sign in.'
    };
  }
}
