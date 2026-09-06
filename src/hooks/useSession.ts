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
  refreshProfile: () => Promise<void>;
  loginAsRole: (role: UserRole, options?: { email?: string; fullName?: string; orgName?: string; accountType?: AccountType; employeeId?: string; isEmailVerified?: boolean }) => void;
  switchRole: (newRole: UserRole) => void;
  switchAccountType: (newType: AccountType, orgName?: string) => void;
  upgradeToOrganization: (orgName: string) => Promise<void>;
}

const STORAGE_KEY = 'tracexmail_enclave_session';

export function useSession(): UseSessionReturn {
  const [session, setLocalSession] = useState<Session | EnclaveLocalSession | null>(null);
  const [user, setUser] = useState<User | EnclaveLocalSession['user'] | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
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
          setLocalSession(parsed);
          setUser(parsed.user as any);
          setProfile(parsed.profile);
          const sessionUser: SessionUser = {
            userId: parsed.user.id,
            email: parsed.user.email,
            organizationId: parsed.profile.organization_id || 'org_acme_soc_01',
            role: parsed.profile.role || 'analyst',
            label: parsed.profile.full_name || 'Security Analyst',
            authMethod: 'enclave_token'
          };
          setSession(parsed.token, sessionUser);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Failed to parse stored enclave session:', e);
      }

      setLocalSession(null);
      setUser(null);
      setProfile(null);
      setSession(null, null);
      setLoading(false);
      return;
    }

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
      label: prof?.full_name || (currentUser.email ? currentUser.email.split('@')[0] : 'Security Analyst'),
      authMethod: 'supabase_jwt'
    };

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
        if (isMounted) {
          setLocalSession(parsed);
          setUser(parsed.user as any);
          setProfile(parsed.profile);
          const sessionUser: SessionUser = {
            userId: parsed.user.id,
            email: parsed.user.email,
            organizationId: parsed.profile.organization_id || 'org_acme_soc_01',
            role: parsed.profile.role || 'analyst',
            label: parsed.profile.full_name || 'Security Analyst',
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
        console.warn('[useSession] getSession error:', error.message);
        setLoading(false);
        return;
      }
      if (initSession) {
        syncState(initSession);
      } else {
        setLoading(false);
      }
    });

    // Auth state listener for sign in / sign out / token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      if (newSession) {
        syncState(newSession);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [syncState]);

  const signOut = useCallback(async () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}

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
    setSession(null, null);
  }, []);

  const loginAsRole = useCallback((newRole: UserRole, options?: { email?: string; fullName?: string; orgName?: string; accountType?: AccountType; employeeId?: string; isEmailVerified?: boolean }) => {
    const roleTitles: Record<UserRole, { title: string; defaultEmail: string }> = {
      admin: { title: 'SOC Lead (Commander)', defaultEmail: 'admin@tracexmail.sec' },
      analyst: { title: 'Senior Forensic Analyst', defaultEmail: 'analyst@tracexmail.sec' },
      read_only: { title: 'Security Auditor', defaultEmail: 'auditor@tracexmail.sec' }
    };

    const email = options?.email || roleTitles[newRole].defaultEmail;
    const fullName = options?.fullName || roleTitles[newRole].title;
    const orgName = options?.orgName || (options?.accountType === 'personal' ? 'Personal Sandbox' : 'Acme Cyber Defense SOC');
    const accountType: AccountType = options?.accountType || (newRole === 'admin' ? 'organization' : 'organization');
    const isVerified = options?.isEmailVerified ?? true;
    const userId = `usr_${newRole}_${Date.now()}`;

    const localProf: UserProfile = {
      id: userId,
      organization_id: accountType === 'personal' ? 'org_personal_user' : 'org_acme_soc_01',
      role: newRole,
      full_name: fullName,
      email,
      employee_id: options?.employeeId,
      account_type: accountType,
      email_verified: isVerified,
      created_at: new Date().toISOString()
    };

    const enclaveSession: EnclaveLocalSession = {
      token: `enclave_jwt_${newRole}_${Date.now()}`,
      user: {
        id: userId,
        email,
        email_confirmed_at: isVerified ? new Date().toISOString() : undefined,
        user_metadata: {
          full_name: fullName,
          org_name: orgName,
          organization_name: orgName,
          role: newRole,
          account_type: accountType,
          employee_id: options?.employeeId,
          email_verified: isVerified
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

    const sessionUser: SessionUser = {
      userId,
      email,
      organizationId: accountType === 'personal' ? 'org_personal_user' : 'org_acme_soc_01',
      role: newRole,
      label: fullName,
      authMethod: 'enclave_token'
    };
    setSession(enclaveSession.token, sessionUser);
  }, []);

  const switchRole = useCallback((newRole: UserRole) => {
    if (!session) return;
    const currentEmail = user?.email || 'analyst@tracexmail.sec';
    const currentName = profile?.full_name || user?.user_metadata?.full_name || 'Operator';
    const orgName = user?.user_metadata?.org_name || 'Acme Cyber Defense SOC';
    const currentAccType: AccountType = profile?.account_type || user?.user_metadata?.account_type || 'organization';

    loginAsRole(newRole, {
      email: currentEmail,
      fullName: currentName,
      orgName,
      accountType: currentAccType
    });
  }, [session, user, profile, loginAsRole]);

  const switchAccountType = useCallback((newType: AccountType, orgName?: string) => {
    if (!session) return;
    const currentEmail = user?.email || 'analyst@tracexmail.sec';
    const currentName = profile?.full_name || user?.user_metadata?.full_name || 'Operator';
    const currentRole = (profile?.role as UserRole) || (user?.user_metadata?.role as UserRole) || 'analyst';

    loginAsRole(currentRole, {
      email: currentEmail,
      fullName: currentName,
      orgName: orgName || (newType === 'organization' ? 'Enterprise Cyber SOC' : 'Personal Sandbox'),
      accountType: newType
    });
  }, [session, user, profile, loginAsRole]);

  const upgradeToOrganization = useCallback(async (orgName: string) => {
    if (!session) return;
    const currentEmail = user?.email || 'admin@defense.sec';
    const currentName = profile?.full_name || user?.user_metadata?.full_name || 'Organization Lead';
    
    // Switch to Admin role in organization mode
    loginAsRole('admin', {
      email: currentEmail,
      fullName: currentName,
      orgName: orgName.trim() || 'Enterprise Cyber SOC',
      accountType: 'organization'
    });
  }, [session, user, profile, loginAsRole]);

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
    user?.user_metadata?.organization_id || 
    'org_acme_soc_01';

  const accountType: AccountType = (profile?.account_type as AccountType) ||
    (user?.user_metadata?.account_type as AccountType) ||
    (role === 'admin' ? 'organization' : 'organization');

  const isEmailVerified: boolean = Boolean(
    (user as any)?.email_confirmed_at || 
    user?.user_metadata?.email_verified !== false ||
    profile?.email_verified !== false
  );

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
    refreshProfile,
    loginAsRole,
    switchRole,
    switchAccountType,
    upgradeToOrganization
  };
}
