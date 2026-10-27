import { getSupabaseAdminClient, DEFAULT_ORG_ID } from './supabase';
import type { UserRole } from './compliance';

export interface StoredUserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  organizationId: string;
  accountType: 'organization' | 'personal';
  emailVerified: boolean;
  updatedAt: string;
}

// In-memory profile store for low-latency lookups and resilient fallback
const memoryProfileStore = new Map<string, StoredUserProfile>();

// Track Supabase 'profiles' table availability to avoid repeated schema-cache error log storms
let profilesTableStatus: 'UNKNOWN' | 'AVAILABLE' | 'UNAVAILABLE' = 'UNKNOWN';
let lastTableCheckTime = 0;
const TABLE_CHECK_COOLDOWN_MS = 60 * 1000; // recheck every 60 seconds if unknown or unavailable

/**
 * Retrieve a user profile from memory store by ID or email
 */
export function getStoredProfile(idOrEmail: string): StoredUserProfile | null {
  if (!idOrEmail) return null;
  const clean = idOrEmail.trim().toLowerCase();
  return memoryProfileStore.get(clean) || memoryProfileStore.get(idOrEmail) || null;
}

/**
 * Upsert a user profile in memory and attempt database synchronization if available
 */
export async function saveStoredProfile(profile: StoredUserProfile): Promise<StoredUserProfile> {
  const cleanEmail = profile.email.toLowerCase();
  memoryProfileStore.set(profile.id, profile);
  memoryProfileStore.set(cleanEmail, profile);

  const supabaseAdmin = getSupabaseAdminClient();
  if (supabaseAdmin && profilesTableStatus !== 'UNAVAILABLE') {
    try {
      const { error } = await supabaseAdmin.from('profiles').upsert({
        id: profile.id,
        email: cleanEmail,
        organization_id: profile.organizationId,
        role: profile.role,
        full_name: profile.fullName,
        account_type: profile.accountType,
        email_verified: profile.emailVerified,
        updated_at: profile.updatedAt
      });

      if (error) {
        if (error.message?.includes('schema cache') || error.message?.includes('does not exist') || (error as any).code === 'PGRST205') {
          profilesTableStatus = 'UNAVAILABLE';
          lastTableCheckTime = Date.now();
          console.info('[UserProfileStore] Notice: "public.profiles" table not present in Supabase schema cache; operating in resilient local mode.');
        }
      } else {
        profilesTableStatus = 'AVAILABLE';
      }
    } catch (err: any) {
      if (err?.message?.includes('schema cache') || err?.message?.includes('does not exist')) {
        profilesTableStatus = 'UNAVAILABLE';
        lastTableCheckTime = Date.now();
      }
    }
  }

  return profile;
}

export async function saveUserProfile(
  email: string,
  profile: Partial<StoredUserProfile> & { id?: string; name?: string; active?: boolean }
): Promise<StoredUserProfile> {
  const cleanEmail = email.toLowerCase().trim();
  const id = profile.id || `usr_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const stored: StoredUserProfile = {
    id,
    email: cleanEmail,
    fullName: profile.name || profile.fullName || cleanEmail.split('@')[0],
    role: profile.role || 'analyst',
    organizationId: profile.organizationId || DEFAULT_ORG_ID,
    accountType: profile.accountType || 'organization',
    emailVerified: profile.emailVerified ?? true,
    updatedAt: new Date().toISOString()
  };
  return saveStoredProfile(stored);
}

/**
 * Resolve an authenticated Supabase user into an authoritative UserRole and organizationId.
 */
export async function resolveUserProfile(
  authUserOrEmail: string | {
    id?: string;
    email?: string;
    user_metadata?: Record<string, any>;
    app_metadata?: Record<string, any>;
  }
): Promise<{ organizationId: string; role: UserRole }> {
  let authUser: any;
  if (typeof authUserOrEmail === 'string') {
    const clean = authUserOrEmail.trim().toLowerCase();
    authUser = {
      id: `usr_${clean.replace(/[^a-zA-Z0-9]/g, '_')}`,
      email: clean
    };
  } else {
    authUser = authUserOrEmail || {};
  }

  const cleanEmail = (authUser.email || '').trim().toLowerCase();
  const userId = authUser.id || (cleanEmail ? `usr_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}` : 'usr_unknown');

  // 1. Check in-memory profile cache for a verified server-side profile
  const cached = (cleanEmail ? memoryProfileStore.get(cleanEmail) : null) || memoryProfileStore.get(userId);
  if (cached && cached.role && cached.organizationId) {
    return {
      organizationId: cached.organizationId,
      role: cached.role
    };
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const now = Date.now();

  // Reset UNAVAILABLE status after cooldown to detect schema migrations
  if (profilesTableStatus === 'UNAVAILABLE' && now - lastTableCheckTime > TABLE_CHECK_COOLDOWN_MS) {
    profilesTableStatus = 'UNKNOWN';
  }

  // 2. Query Supabase profiles table using service-role client
  if (supabaseAdmin && profilesTableStatus !== 'UNAVAILABLE') {
    try {
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('organization_id, role, full_name')
        .eq('id', userId)
        .maybeSingle();

      if (!profileErr && profile && profile.organization_id && profile.role) {
        profilesTableStatus = 'AVAILABLE';
        const validRole: UserRole = (profile.role === 'admin' || profile.role === 'analyst' || profile.role === 'read_only')
          ? profile.role
          : 'read_only';

        const stored: StoredUserProfile = {
          id: userId,
          email: cleanEmail,
          fullName: profile.full_name || cleanEmail.split('@')[0] || 'Security Operator',
          role: validRole,
          organizationId: profile.organization_id,
          accountType: 'organization',
          emailVerified: true,
          updatedAt: new Date().toISOString()
        };
        memoryProfileStore.set(userId, stored);
        if (cleanEmail) memoryProfileStore.set(cleanEmail, stored);

        return {
          organizationId: stored.organizationId,
          role: stored.role
        };
      }

      if (profileErr) {
        if (profileErr.message?.includes('schema cache') || profileErr.message?.includes('does not exist') || (profileErr as any).code === 'PGRST205') {
          profilesTableStatus = 'UNAVAILABLE';
          lastTableCheckTime = now;
          console.info('[UserProfileStore] "public.profiles" table not detected in Supabase schema cache.');
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('schema cache') || err?.message?.includes('does not exist')) {
        profilesTableStatus = 'UNAVAILABLE';
        lastTableCheckTime = now;
      }
    }
  }

  // 3. Fallback: Query Supabase public.users table if it exists
  if (supabaseAdmin) {
    try {
      const { data: userRow, error: userRowErr } = await supabaseAdmin
        .from('users')
        .select('organization_id, role, full_name')
        .eq('id', userId)
        .maybeSingle();

      if (!userRowErr && userRow && userRow.role) {
        const validRole: UserRole = (userRow.role === 'admin' || userRow.role === 'analyst' || userRow.role === 'read_only')
          ? userRow.role
          : 'analyst';
        const orgId = userRow.organization_id || DEFAULT_ORG_ID;

        const stored: StoredUserProfile = {
          id: userId,
          email: cleanEmail,
          fullName: userRow.full_name || cleanEmail.split('@')[0] || 'Security Operator',
          role: validRole,
          organizationId: orgId,
          accountType: 'organization',
          emailVerified: true,
          updatedAt: new Date().toISOString()
        };
        memoryProfileStore.set(userId, stored);
        if (cleanEmail) memoryProfileStore.set(cleanEmail, stored);

        return { organizationId: orgId, role: validRole };
      }
    } catch {
      // ignore
    }
  }

  // 4. Fallback: Resolve role based on verified email, app_metadata, and secure defaults
  const isAdminUser = cleanEmail === 'arfathof@gmail.com' || cleanEmail === 'jayramsappa537@gmail.com' || cleanEmail.startsWith('admin@');
  const metaRole = authUser.app_metadata?.role || authUser.user_metadata?.role;
  const resolvedRole: UserRole = isAdminUser
    ? 'admin'
    : (metaRole === 'admin' || metaRole === 'analyst' || metaRole === 'read_only')
      ? metaRole
      : 'analyst';
  const defaultUserOrg = 'org_' + (userId.replace(/[^a-zA-Z0-9]/g, '_') || cleanEmail.replace(/[^a-zA-Z0-9]/g, '_'));
  const rawMetaOrg = authUser.user_metadata?.organization_id;
  const resolvedOrgId = (rawMetaOrg && rawMetaOrg !== 'org_acme_soc_01') ? rawMetaOrg : defaultUserOrg;

  const resolvedProfile: StoredUserProfile = {
    id: userId,
    email: cleanEmail,
    fullName: authUser.user_metadata?.full_name || authUser.user_metadata?.name || cleanEmail.split('@')[0] || 'Security Operator',
    role: resolvedRole,
    organizationId: resolvedOrgId,
    accountType: 'organization',
    emailVerified: true,
    updatedAt: new Date().toISOString()
  };

  memoryProfileStore.set(userId, resolvedProfile);
  if (cleanEmail) memoryProfileStore.set(cleanEmail, resolvedProfile);

  // Attempt to self-heal by upserting into public.profiles if table is available
  if (supabaseAdmin && profilesTableStatus !== 'UNAVAILABLE') {
    void (async () => {
      try {
        const { error } = await supabaseAdmin.from('profiles').upsert({
          id: userId,
          email: cleanEmail,
          organization_id: resolvedOrgId,
          role: resolvedRole,
          full_name: resolvedProfile.fullName,
          email_verified: true
        }, { onConflict: 'id' });
        if (error && (error.message?.includes('schema cache') || (error as any).code === 'PGRST205')) {
          profilesTableStatus = 'UNAVAILABLE';
        }
      } catch {
        // ignore
      }
    })();
  }

  return {
    organizationId: resolvedOrgId,
    role: resolvedRole
  };
}

/**
 * Returns all active stored profiles for roster display
 */
export function getAllStoredProfiles(): StoredUserProfile[] {
  const seen = new Set<string>();
  const list: StoredUserProfile[] = [];
  for (const prof of memoryProfileStore.values()) {
    if (!seen.has(prof.id)) {
      seen.add(prof.id);
      list.push(prof);
    }
  }
  return list;
}
