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

// Pre-seed primary app maintainers and administrators
const seedProfiles: StoredUserProfile[] = [
  {
    id: 'd9f3b70c-58d8-44fa-9bec-ba1ebc4bbf20',
    email: 'ramofyou@gmail.com',
    fullName: 'SOC Administrator (Ram)',
    role: 'admin',
    organizationId: DEFAULT_ORG_ID,
    accountType: 'organization',
    emailVerified: true,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'usr_jayram_sappa',
    email: 'jayramsappa537@gmail.com',
    fullName: 'Jayram Sappa',
    role: 'admin',
    organizationId: DEFAULT_ORG_ID,
    accountType: 'organization',
    emailVerified: true,
    updatedAt: new Date().toISOString()
  }
];

// Initialize in-memory store with seeds
for (const profile of seedProfiles) {
  memoryProfileStore.set(profile.id, profile);
  memoryProfileStore.set(profile.email.toLowerCase(), profile);
}

/**
 * Check if the email belongs to a recognized system administrator
 */
export function isKnownAdminEmail(email?: string): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return clean === 'ramofyou@gmail.com' || clean === 'jayramsappa537@gmail.com';
}

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

/**
 * Resolve an authenticated Supabase user into an authoritative UserRole and organizationId.
 * Guarantees a resilient, non-null context even if 'public.profiles' table does not exist in Supabase.
 */
export async function resolveUserProfile(authUser: {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}): Promise<{ organizationId: string; role: UserRole }> {
  const userId = authUser.id;
  const cleanEmail = (authUser.email || '').trim().toLowerCase();

  // 1. Check in-memory profile cache first
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

  // 2. Query Supabase profiles if table is available
  if (supabaseAdmin && profilesTableStatus !== 'UNAVAILABLE') {
    try {
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('organization_id, role, full_name')
        .eq('id', userId)
        .maybeSingle();

      if (!profileErr && profile && profile.organization_id && profile.role) {
        profilesTableStatus = 'AVAILABLE';
        const validRole: UserRole = profile.role === 'admin' || profile.role === 'analyst' || profile.role === 'read_only'
          ? profile.role
          : 'analyst';

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
          console.info('[UserProfileStore] "public.profiles" table not detected in Supabase schema cache. Resilient in-memory profiles active.');
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('schema cache') || err?.message?.includes('does not exist')) {
        profilesTableStatus = 'UNAVAILABLE';
        lastTableCheckTime = now;
      }
    }
  }

  // 3. Fallback resolution: determine role and organization with security-conscious defaults
  let determinedRole: UserRole = 'analyst';
  if (isKnownAdminEmail(cleanEmail)) {
    determinedRole = 'admin';
  } else if (authUser.app_metadata?.role && ['admin', 'analyst', 'read_only'].includes(authUser.app_metadata.role)) {
    determinedRole = authUser.app_metadata.role as UserRole;
  } else if (authUser.user_metadata?.role && ['admin', 'analyst', 'read_only'].includes(authUser.user_metadata.role)) {
    determinedRole = authUser.user_metadata.role as UserRole;
  }

  const determinedOrg = authUser.user_metadata?.organization_id || authUser.user_metadata?.org_name || DEFAULT_ORG_ID;
  const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || cleanEmail.split('@')[0] || 'Security Analyst';

  const newStoredProfile: StoredUserProfile = {
    id: userId,
    email: cleanEmail,
    fullName,
    role: determinedRole,
    organizationId: determinedOrg,
    accountType: (authUser.user_metadata?.account_type as any) || 'organization',
    emailVerified: Boolean(cleanEmail),
    updatedAt: new Date().toISOString()
  };

  memoryProfileStore.set(userId, newStoredProfile);
  if (cleanEmail) memoryProfileStore.set(cleanEmail, newStoredProfile);

  // 4. Try background auto-provision to Supabase profiles IF table is available
  if (supabaseAdmin && profilesTableStatus !== 'UNAVAILABLE') {
    try {
      const { error: upsertErr } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          email: cleanEmail,
          role: determinedRole,
          organization_id: determinedOrg,
          full_name: fullName,
          updated_at: new Date().toISOString()
        });

      if (upsertErr) {
        if (upsertErr.message?.includes('schema cache') || upsertErr.message?.includes('does not exist') || (upsertErr as any).code === 'PGRST205') {
          profilesTableStatus = 'UNAVAILABLE';
          lastTableCheckTime = now;
        }
      } else {
        profilesTableStatus = 'AVAILABLE';
      }
    } catch (upsertCatch: any) {
      if (upsertCatch?.message?.includes('schema cache') || upsertCatch?.message?.includes('does not exist')) {
        profilesTableStatus = 'UNAVAILABLE';
        lastTableCheckTime = now;
      }
    }
  }

  return {
    organizationId: determinedOrg,
    role: determinedRole
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
