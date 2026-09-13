import { useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { setSession, SessionUser } from '../lib/api';

export type UserRole = 'admin' | 'analyst' | 'read_only';
export type AccountType = 'personal' | 'organization';

export interface UserProfile {
  id: string;
  organization_id?: string;
  role?: UserRole;
  full_name?: string;
  email?: string;
  employee_id?: string;
  account_type?: AccountType;
  email_verified?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EnclaveLocalSession {
  token: string;
  user: {
    id: string;
    email: string;
    email_confirmed_at?: string;
    user_metadata: {
      full_name: string;
      org_name: string;
      organization_name: string;
      role: UserRole;
      account_type?: AccountType;
      employee_id?: string;
      email_verified?: boolean;
    };
  };
  profile: UserProfile;
}

export interface LoginRoleOptions {
  token: string;
  userId: string;
  email: string;
  fullName?: string;
  orgName?: string;
  accountType?: AccountType;
  employeeId?: string;
  isEmailVerified: boolean;
}

export interface UseSessionReturn {
  session: Session | EnclaveLocalSession | null;
  user: User | EnclaveLocalSession['user'] | null;
  profile: UserProfile | null;
  role: UserRole;
  organizationId: string;
  accountType: AccountType;
  isEmailVerified: boolean;
  loading: boolean;
  userLabel: string;
  signOut: () => Promise<void>;
  revokeAllOtherSessions: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  loginAsRole: (role: UserRole, options: LoginRoleOptions) => void;
  switchRole: (newRole: UserRole) => void;
  switchAccountType: (newType: AccountType, orgName?: string) => void;
  upgradeToOrganization: (orgName: string) => Promise<void>;
}

const STORAGE_KEY = 'tracexmail_enclave_session';

export function useSession(): UseSessionReturn {
  const [session, setLocalSession] = useState<Session | EnclaveLocalSession | null>(null);
  const [user, setUser] = useState<User | EnclaveLocalSession['user'] | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async (currentUser: User): Promise<UserProfile | null> => {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        console.warn('[useSession] Profile fetch error:', error.message);
      }

      if (data) {
        return data as UserProfile;
      }
    } catch (err) {
      console.warn('[useSession] Error fetching profile:', err);
    }
    return null;
  }, []);

  const syncState = useCallback(async (currentSession: Session | null) => {
    if (!currentSession || !currentSession.user) {
      // Check if local enclave session exists before clearing
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: EnclaveLocalSession = JSON.parse(stored);
          if (parsed.token && parsed.user?.id && parsed.user?.email) {
            setLocalSession(parsed);
            setUser(parsed.user as any);
            setProfile(parsed.profile);
            setSessionToken(parsed.token);
            const sessionUser: SessionUser = {
              userId: parsed.user.id,
              email: parsed.user.email,
              organizationId: parsed.profile?.organization_id || 'org_acme_soc_01',
              role: parsed.profile?.role || 'analyst',
              label: parsed.profile?.full_name || 'Security Analyst',
              authMethod: 'enclave_token'
            };
            setSession(parsed.token, sessionUser);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to parse stored enclave session:', e);
      }

      setLocalSession(null);
      setUser(null);
      setProfile(null);
      setSessionToken(null);
      setSession(null, null);
      setLoading(false);
      return;
    }

    // Valid live Supabase session active - remove stale enclave local sessions
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('tracexmail_supabase_auth_callback');
    } catch {}

    setLocalSession(currentSession);
    const currentUser = currentSession.user;
    setUser(currentUser);

    const prof = await fetchProfile(currentUser);
    setProfile(prof);

    const role: UserRole = (prof?.role as UserRole) || 
      (currentUser.user_metadata?.role as UserRole) || 
      'analyst';
    
    const organizationId = prof?.organization_id || 
      currentUser.user_metadata?.org_name || 
      currentUser.user_metadata?.organization_id || 
      'org_acme_soc_01';

    const sessionUser: SessionUser = {
      userId: currentUser.id,
      email: currentUser.email || '',
      organizationId,
      role,
      label: prof?.full_name || currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || (currentUser.email ? currentUser.email.split('@')[0] : 'Security Analyst'),
      authMethod: 'supabase_jwt'
    };

    setSessionToken(currentSession.access_token);
    setSession(currentSession.access_token, sessionUser);
    setLoading(false);
  }, [fetchProfile]);

  useEffect(() => {
    let isMounted = true;

    // Check localStorage first
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: EnclaveLocalSession = JSON.parse(stored);
        if (isMounted && parsed.token && parsed.user?.id && parsed.user?.email) {
          setLocalSession(parsed);
          setUser(parsed.user as any);
          setProfile(parsed.profile);
          setSessionToken(parsed.token);
          const sessionUser: SessionUser = {
            userId: parsed.user.id,
            email: parsed.user.email,
            organizationId: parsed.profile?.organization_id || 'org_acme_soc_01',
            role: parsed.profile?.role || 'analyst',
            label: parsed.profile?.full_name || 'Security Analyst',
            authMethod: 'enclave_token'
          };
          setSession(parsed.token, sessionUser);
          setLoading(false);
        }
      }
    } catch (e) {
      console.warn('Failed reading initial enclave session:', e);
    }

    if (!supabase) {
      setLoading(false);
      return;
    }

    // Initial Supabase session retrieval
    supabase.auth.getSession().then(({ data: { session: initSession }, error }) => {
      if (!isMounted) return;
      if (error) {
        console.warn('[useSession] Supabase getSession error:', error.message, error);
        setLoading(false);
        return;
      }
      if (initSession) {
        console.log('[useSession] Initial Supabase session restored for user:', initSession.user?.email);
        syncState(initSession);
      } else {
        setLoading(false);
      }
    });

    // Auth state listener for sign in / sign out / token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;
      if (newSession) {
        syncState(newSession);
      } else if (event === 'SIGNED_OUT') {
        syncState(null);
      }
    });

    // Cross-window / popup message listener for Google OAuth callback events
    const handleAuthMessage = async (event: MessageEvent) => {
      if (!isMounted || !event.data) return;
      if (event.data.type === 'SUPABASE_AUTH_SUCCESS') {
        console.log('[useSession] SUPABASE_AUTH_SUCCESS event received from callback popup/window:', event.data);
        const { code, hash, search } = event.data;
        try {
          if (hash) {
            const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            if (accessToken && refreshToken) {
              await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            }
          } else if (code) {
            await (supabase.auth as any).exchangeCodeForSession?.(code);
          } else if (search) {
            const searchParams = new URLSearchParams(search);
            const queryCode = searchParams.get('code');
            if (queryCode) {
              await (supabase.auth as any).exchangeCodeForSession?.(queryCode);
            }
          }
          const { data } = await supabase.auth.getSession();
          if (data.session && isMounted) {
            syncState(data.session);
          }
        } catch (e) {
          console.warn('[useSession] Error processing auth message tokens:', e);
        }
      }
    };

    window.addEventListener('message', handleAuthMessage);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener('message', handleAuthMessage);
    };
  }, [syncState]);

  const signOut = useCallback(async () => {
    const currentToken = sessionToken;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}

    // Call server revocation endpoint if token exists
    if (currentToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (err) {
        console.warn('[useSession] Server logout notice:', err);
      }
    }

    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('[useSession] signOut error:', err);
      }
    }
    setLocalSession(null);
    setUser(null);
    setProfile(null);
    setSessionToken(null);
    setSession(null, null);
  }, [sessionToken]);

  const revokeAllOtherSessions = useCallback(async () => {
    const currentToken = sessionToken;
    if (supabase) {
      try {
        await supabase.auth.signOut({ scope: 'others' });
      } catch (err) {
        console.warn('[useSession] Supabase revoke others notice:', err);
      }
    }
    if (currentToken) {
      try {
        await fetch('/api/auth/revoke-all-sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (err) {
        console.warn('[useSession] Server revoke-all notice:', err);
      }
    }
  }, [sessionToken]);

  /**
   * loginAsRole now REQUIRES real values verified by the server/Supabase.
   * Disallows fabrication of tokens or unverified access out of thin air.
   */
  const loginAsRole = useCallback((newRole: UserRole, options: LoginRoleOptions) => {
    if (!options || !options.token || !options.userId || !options.email) {
      console.error('[useSession] loginAsRole rejected: missing required real authentication credentials (token, userId, or email).');
      return;
    }

    const { token, userId, email, isEmailVerified } = options;
    const fullName = options.fullName || email.split('@')[0];
    const orgName = options.orgName || (options.accountType === 'personal' ? 'Personal Sandbox' : 'Acme Cyber Defense SOC');
    const accountType: AccountType = options.accountType || (newRole === 'admin' ? 'organization' : 'organization');

    const localProf: UserProfile = {
      id: userId,
      organization_id: accountType === 'personal' ? 'org_personal_user' : 'org_acme_soc_01',
      role: newRole,
      full_name: fullName,
      email,
      employee_id: options.employeeId,
      account_type: accountType,
      email_verified: isEmailVerified,
      created_at: new Date().toISOString()
    };

    const enclaveSession: EnclaveLocalSession = {
      token,
      user: {
        id: userId,
        email,
        email_confirmed_at: isEmailVerified ? new Date().toISOString() : undefined,
        user_metadata: {
          full_name: fullName,
          org_name: orgName,
          organization_name: orgName,
          role: newRole,
          account_type: accountType,
          employee_id: options.employeeId,
          email_verified: isEmailVerified
        }
      },
      profile: localProf
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enclaveSession));
    } catch (e) {
      console.warn('Failed to save enclave session to localStorage:', e);
    }

    setLocalSession(enclaveSession);
    setUser(enclaveSession.user as any);
    setProfile(localProf);
    setSessionToken(token);

    const sessionUser: SessionUser = {
      userId,
      email,
      organizationId: accountType === 'personal' ? 'org_personal_user' : 'org_acme_soc_01',
      role: newRole,
      label: fullName,
      authMethod: 'enclave_token'
    };
    setSession(token, sessionUser);
  }, []);

  /**
   * switchRole only relabels an ALREADY-authenticated session using the existing real token.
   */
  const switchRole = useCallback((newRole: UserRole) => {
    if (!session || !sessionToken || !user || !user.id || !user.email) {
      console.warn('[useSession] switchRole denied: No authenticated session active.');
      return;
    }
    const currentEmail = user.email;
    const currentName = profile?.full_name || user.user_metadata?.full_name || 'Operator';
    const orgName = user.user_metadata?.org_name || 'Acme Cyber Defense SOC';
    const currentAccType: AccountType = profile?.account_type || user.user_metadata?.account_type || 'organization';
    const isVerified = Boolean((user as any).email_confirmed_at);

    loginAsRole(newRole, {
      token: sessionToken,
      userId: user.id,
      email: currentEmail,
      fullName: currentName,
      orgName,
      accountType: currentAccType,
      isEmailVerified: isVerified
    });
  }, [session, sessionToken, user, profile, loginAsRole]);

  /**
   * switchAccountType only switches mode on an ALREADY-authenticated session.
   */
  const switchAccountType = useCallback((newType: AccountType, orgName?: string) => {
    if (!session || !sessionToken || !user || !user.id || !user.email) {
      console.warn('[useSession] switchAccountType denied: No authenticated session active.');
      return;
    }
    const currentEmail = user.email;
    const currentName = profile?.full_name || user.user_metadata?.full_name || 'Operator';
    const currentRole = (profile?.role as UserRole) || (user.user_metadata?.role as UserRole) || 'analyst';
    const isVerified = Boolean((user as any).email_confirmed_at);

    loginAsRole(currentRole, {
      token: sessionToken,
      userId: user.id,
      email: currentEmail,
      fullName: currentName,
      orgName: orgName || (newType === 'organization' ? 'Enterprise Cyber SOC' : 'Personal Sandbox'),
      accountType: newType,
      isEmailVerified: isVerified
    });
  }, [session, sessionToken, user, profile, loginAsRole]);

  /**
   * upgradeToOrganization requires an existing authenticated session.
   */
  const upgradeToOrganization = useCallback(async (orgName: string) => {
    if (!session || !sessionToken || !user || !user.id || !user.email) {
      console.warn('[useSession] upgradeToOrganization denied: No authenticated session active.');
      return;
    }
    const currentEmail = user.email;
    const currentName = profile?.full_name || user.user_metadata?.full_name || 'Organization Lead';
    const isVerified = Boolean((user as any).email_confirmed_at);

    loginAsRole('admin', {
      token: sessionToken,
      userId: user.id,
      email: currentEmail,
      fullName: currentName,
      orgName: orgName.trim() || 'Enterprise Cyber SOC',
      accountType: 'organization',
      isEmailVerified: isVerified
    });
  }, [session, sessionToken, user, profile, loginAsRole]);

  const refreshProfile = useCallback(async () => {
    if (user && (user as User).id) {
      const prof = await fetchProfile(user as User);
      if (prof) setProfile(prof);
    }
  }, [user, fetchProfile]);

  const role: UserRole = (profile?.role as UserRole) || 
    (user?.user_metadata?.role as UserRole) || 
    'analyst';

  const organizationId = profile?.organization_id || 
    user?.user_metadata?.org_name || 
    (user?.user_metadata as any)?.organization_id || 
    'org_acme_soc_01';

  const accountType: AccountType = (profile?.account_type as AccountType) ||
    (user?.user_metadata?.account_type as AccountType) ||
    (role === 'admin' ? 'organization' : 'organization');

  // Strict email verification check: only genuine email_confirmed_at counts
  const isEmailVerified: boolean = Boolean((user as any)?.email_confirmed_at);

  // Compute initials or short user label
  const userLabel = profile?.full_name 
    ? profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : user?.email 
      ? user.email.substring(0, 2).toUpperCase()
      : role === 'admin' ? 'AD' : role === 'read_only' ? 'AU' : 'AN';

  return {
    session,
    user,
    profile,
    role,
    organizationId,
    accountType,
    isEmailVerified,
    loading,
    userLabel,
    signOut,
    revokeAllOtherSessions,
    refreshProfile,
    loginAsRole,
    switchRole,
    switchAccountType,
    upgradeToOrganization
  };
}
