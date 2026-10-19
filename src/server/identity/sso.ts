import crypto from 'crypto';
import { logger } from '../logger';

export interface IdpConfig {
  orgId: string;
  protocol: 'saml' | 'oidc';
  issuer: string;
  entryPointOrAuthUrl: string;
  certOrJwks?: string;
  clientId?: string;
  clientSecret?: string;
  allowedDomains: string[];
  enforceSso: boolean;
  defaultRole: 'admin' | 'analyst' | 'read_only';
  enabled: boolean;
  updatedAt: string;
}

// In-memory SSO config registry (orgId -> IdpConfig)
const ssoConfigs = new Map<string, IdpConfig>();

// Seed default mock / test SSO configurations if needed
export function setOrgSsoConfig(config: IdpConfig): void {
  ssoConfigs.set(config.orgId, {
    ...config,
    updatedAt: new Date().toISOString()
  });
  logger.info({ orgId: config.orgId, protocol: config.protocol, enforceSso: config.enforceSso }, 'Configured enterprise SSO for organization');
}

export function getOrgSsoConfig(orgId: string): IdpConfig | null {
  return ssoConfigs.get(orgId) || null;
}

/**
 * Looks up SSO configuration based on user's email domain.
 */
export function findSsoConfigByEmailDomain(email: string): IdpConfig | null {
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@')[1].toLowerCase().trim();

  for (const config of ssoConfigs.values()) {
    if (config.enabled && config.allowedDomains.some(d => d.toLowerCase() === domain)) {
      return config;
    }
  }
  return null;
}

/**
 * Checks if password authentication is strictly forbidden for a given email address
 * because its organization enforces SSO.
 */
export function isPasswordLoginForbiddenForEmail(email: string): boolean {
  const sso = findSsoConfigByEmailDomain(email);
  return Boolean(sso && sso.enforceSso);
}

/**
 * Just-in-Time (JIT) provisioning handler for successful SSO authentication.
 */
export async function provisionSsoUser(params: {
  email: string;
  name?: string;
  orgId: string;
  groups?: string[];
}): Promise<{ userId: string; role: 'admin' | 'analyst' | 'read_only'; orgId: string }> {
  const { getStoredProfile, saveUserProfile } = await import('../userProfileStore');

  let role: 'admin' | 'analyst' | 'read_only' = 'analyst';
  const config = getOrgSsoConfig(params.orgId);
  if (config) {
    role = config.defaultRole || 'analyst';
  }

  // Group to role mapping if IdP sent groups
  if (params.groups && Array.isArray(params.groups)) {
    const lowerGroups = params.groups.map(g => g.toLowerCase());
    if (lowerGroups.some(g => g.includes('admin') || g.includes('secops-leads'))) {
      role = 'admin';
    } else if (lowerGroups.some(g => g.includes('auditor') || g.includes('read_only'))) {
      role = 'read_only';
    }
  }

  const existing = getStoredProfile(params.email);
  const userId = existing?.id || `usr_sso_${crypto.randomBytes(8).toString('hex')}`;

  await saveUserProfile(params.email, {
    id: userId,
    name: params.name || existing?.fullName || params.email.split('@')[0],
    organizationId: params.orgId,
    role
  });

  logger.info({ userId, email: params.email, orgId: params.orgId, role }, 'JIT provisioned/synced SSO user');

  return { userId, role, orgId: params.orgId };
}
