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

/**
 * Resolve an authenticated Supabase user into an authoritative UserRole and organizationId.
 *
 * CRITICAL SECURITY MANDATE:
 * NEVER trust client-writable user_metadata or app_metadata for authorization, role, or organization_id.
 * Any authenticated user can mutate user_metadata from their client via supabase.auth.updateUser().
 * Role and organization MUST be resolved exclusively from verified server-side stores:
 * 1. The authoritative 'public.profiles' table in Supabase
 * 2. Or a verified in-memory profile created by server-side admin actions/invitations
 *
 * If no verified profile row exists, FAIL CLOSED to lowest privilege ('read_only').
 */
export async function resolveUserProfile(authUser: {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}): Promise<{ organizationId: string; role: UserRole }> {
  const userId = authUser.id;
  const cleanEmail = (authUser.email || '').trim().toLowerCase();

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
          console.info('[UserProfileStore] "public.profiles" table not detected in Supabase schema cache. Operating in fail-closed mode.');
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('schema cache') || err?.message?.includes('does not exist')) {
        profilesTableStatus = 'UNAVAILABLE';
        lastTableCheckTime = now;
      }
    }
  }

  // 3. Fail closed: NEVER trust user_metadata or app_metadata for elevated permissions
  console.warn(`[Security] No verified profile record found for user ${userId} (${cleanEmail || 'unknown'}). Failing closed to read_only role. Client user_metadata is untrusted.`);

  return {
    organizationId: DEFAULT_ORG_ID,
    role: 'read_only'
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
