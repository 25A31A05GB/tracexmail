import { supabase, isSupabaseConfigured, ensureSupabaseClient, getIsSupabaseConfigured, getSupabaseAnonKey, getGoogleOAuthRedirectUrl } from './supabase';

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
  const callbackUrl = getGoogleOAuthRedirectUrl();
  const anonKey = getSupabaseAnonKey();

  try {
    console.log('[Supabase Google Auth] Initiating OAuth flow. inIframe:', inIframe, 'callbackUrl:', callbackUrl);

    // Request OAuth authorization URL with skipBrowserRedirect so we can sanitize
    // and guarantee the `apikey` query parameter is present for Supabase's Kong gateway.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          ...(anonKey ? { apikey: anonKey } : {})
        }
      }
    });

    if (error) {
      console.error('[Supabase Google Auth] signInWithOAuth failed:', error.status, error.message, error);
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

    let authUrl = data?.url;
    if (!authUrl) {
      return {
        success: false,
        error: 'Failed to retrieve Google OAuth authorization URL from Supabase.'
      };
    }

    // Ensure `apikey` parameter is explicitly attached to the auth URL to satisfy Supabase Kong gateway
    if (anonKey) {
      try {
        const urlObj = new URL(authUrl);
        if (!urlObj.searchParams.has('apikey')) {
          urlObj.searchParams.set('apikey', anonKey);
          authUrl = urlObj.toString();
        }
      } catch {
        if (!authUrl.includes('apikey=')) {
          authUrl += (authUrl.includes('?') ? '&' : '?') + `apikey=${encodeURIComponent(anonKey)}`;
        }
      }
    }

    console.log('[Supabase Google Auth] Opening Google OAuth popup window to:', authUrl);

    // Open provider authorization URL in a standard centered popup window
    const width = 560;
    const height = 680;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      'tracexmail_google_auth_popup',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=1,resizable=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      // If browser blocked popup window, fallback to top-level window redirect
      console.warn('[Supabase Google Auth] Popup window blocked by browser, falling back to top-level redirection...');
      if (!inIframe) {
        window.location.assign(authUrl);
        return { success: true };
      }
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
        window.removeEventListener('storage', storageListener);
        clearInterval(pollTimer);
        try {
          localStorage.removeItem('tracexmail_supabase_auth_callback');
        } catch {}
      };

      const handleCallbackPayload = async (payload: any) => {
        if (resolved) return;

        if (payload?.type === 'SUPABASE_AUTH_ERROR' || payload?.error) {
          console.error('[Supabase Google Auth] OAuth error reported:', payload);
          resolved = true;
          cleanup();
          const detail = payload.error || payload.errorCode || 'Google OAuth authentication failed.';
          resolve({
            success: false,
            error: detail.includes('access_denied')
              ? 'Sign in was cancelled or permission was denied.'
              : `Google authentication failed: ${detail}`
          });
          return;
        }

        if (payload?.type === 'SUPABASE_AUTH_SUCCESS') {
          console.log('[Supabase Google Auth] Processing auth callback tokens...');
          try {
            const hash = payload.hash || '';
            const search = payload.search || '';

            if (hash) {
              const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
              const accessToken = hashParams.get('access_token');
              const refreshToken = hashParams.get('refresh_token');
              if (accessToken && refreshToken) {
                console.log('[Supabase Google Auth] Applying tokens via setSession...');
                await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken
                });
              }
            } else if (search) {
              const searchParams = new URLSearchParams(search);
              const code = searchParams.get('code');
              if (code) {
                console.log('[Supabase Google Auth] Exchanging PKCE code for session...');
                await (supabase.auth as any).exchangeCodeForSession?.(code);
              }
            }

            // Verify active session
            const { data: sessionData } = await supabase.auth.getSession();
            let activeUser = sessionData?.session?.user;

            if (!activeUser) {
              const { data: userData } = await supabase.auth.getUser();
              activeUser = userData?.user;
            }

            if (activeUser) {
              resolved = true;
              cleanup();
              console.log('[Supabase Google Auth] Session successfully established:', activeUser.email);
              resolve({
                success: true,
                user: activeUser
              });
              return;
            } else {
              console.warn('[Supabase Google Auth] OAuth callback completed but no user session was found.');
              resolved = true;
              cleanup();
              resolve({
                success: false,
                error: 'Authentication exchange finished without establishing a session. Please verify that the Google provider is enabled in your Supabase Dashboard.'
              });
              return;
            }
          } catch (err: any) {
            console.error('[Supabase Google Auth] Finalization exception:', err);
            resolved = true;
            cleanup();
            resolve({
              success: false,
              error: err?.message || 'Failed finalizing Google authentication session.'
            });
            return;
          }
        }
      };

      const messageListener = async (event: MessageEvent) => {
        const isAllowedOrigin = 
          !event.origin ||
          event.origin === window.location.origin ||
          event.origin.endsWith('.vercel.app') ||
          event.origin.endsWith('.run.app') ||
          event.origin.includes('localhost') ||
          event.origin.includes('127.0.0.1');

        if (!isAllowedOrigin) return;
        if (event.data?.type === 'SUPABASE_AUTH_SUCCESS' || event.data?.type === 'SUPABASE_AUTH_ERROR') {
          await handleCallbackPayload(event.data);
        }
      };

      const storageListener = async (e: StorageEvent) => {
        if (e.key === 'tracexmail_supabase_auth_callback' && e.newValue) {
          try {
            const payload = JSON.parse(e.newValue);
            await handleCallbackPayload(payload);
          } catch {}
        }
      };

      window.addEventListener('message', messageListener);
      window.addEventListener('storage', storageListener);

      // Check if user manually closed the popup without authenticating
      const pollTimer = setInterval(async () => {
        // Also check if localStorage was updated in background
        try {
          const storedCallback = localStorage.getItem('tracexmail_supabase_auth_callback');
          if (storedCallback) {
            const payload = JSON.parse(storedCallback);
            await handleCallbackPayload(payload);
            return;
          }
        } catch {}

        if (popup.closed) {
          clearInterval(pollTimer);
          if (resolved) return;

          // Check if session was established despite popup closing
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData?.session?.user) {
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
                error: 'Authentication incomplete: Google sign-in window was closed.'
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
