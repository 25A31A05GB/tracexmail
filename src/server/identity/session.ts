import crypto from 'crypto';
import { logger } from '../logger';

export interface UserSession {
  id: string;
  userId: string;
  organizationId: string;
  ip: string;
  userAgent: string;
  createdAt: number;
  lastActiveAt: number;
  lastAuthenticatedAt: number;
  expiresAt: number;
  amr: string[]; // e.g. ['pwd'], ['pwd', 'mfa'], ['sso']
  isMfaVerified: boolean;
  revoked: boolean;
}

export interface OrgSessionConfig {
  orgId: string;
  idleTimeoutMinutes: number; // e.g. 15 or 30 minutes
  absoluteTimeoutHours: number; // e.g. 12 or 24 hours
  requireReauthForSensitiveActions: boolean;
}

const sessionsStore = new Map<string, UserSession>();
const orgSessionConfigs = new Map<string, OrgSessionConfig>();

export function setOrgSessionConfig(config: OrgSessionConfig): void {
  orgSessionConfigs.set(config.orgId, config);
}

export function getOrgSessionConfig(orgId: string): OrgSessionConfig {
  return orgSessionConfigs.get(orgId) || {
    orgId,
    idleTimeoutMinutes: 30,
    absoluteTimeoutHours: 24,
    requireReauthForSensitiveActions: true
  };
}

export function createSession(params: {
  userId: string;
  organizationId: string;
  ip: string;
  userAgent: string;
  amr?: string[];
  isMfaVerified?: boolean;
}): UserSession {
  const sessionId = `sess_${crypto.randomUUID()}`;
  const now = Date.now();
  const config = getOrgSessionConfig(params.organizationId);

  const session: UserSession = {
    id: sessionId,
    userId: params.userId,
    organizationId: params.organizationId,
    ip: params.ip,
    userAgent: params.userAgent,
    createdAt: now,
    lastActiveAt: now,
    lastAuthenticatedAt: now,
    expiresAt: now + config.absoluteTimeoutHours * 60 * 60 * 1000,
    amr: params.amr || ['pwd'],
    isMfaVerified: params.isMfaVerified ?? false,
    revoked: false
  };

  sessionsStore.set(sessionId, session);
  return session;
}

export function getSession(sessionId: string): UserSession | null {
  const session = sessionsStore.get(sessionId);
  if (!session || session.revoked) return null;

  const now = Date.now();
  const config = getOrgSessionConfig(session.organizationId);

  // Absolute timeout check
  if (now > session.expiresAt) {
    session.revoked = true;
    return null;
  }

  // Idle timeout check
  const idleMs = config.idleTimeoutMinutes * 60 * 1000;
  if (now - session.lastActiveAt > idleMs) {
    session.revoked = true;
    return null;
  }

  // Touch session
  session.lastActiveAt = now;
  return session;
}

export function listActiveSessions(userId: string): UserSession[] {
  const now = Date.now();
  return Array.from(sessionsStore.values()).filter(
    s => s.userId === userId && !s.revoked && s.expiresAt > now
  );
}

export function revokeSession(sessionId: string): boolean {
  const s = sessionsStore.get(sessionId);
  if (s) {
    s.revoked = true;
    logger.info({ sessionId, userId: s.userId }, 'Revoked user session');
    return true;
  }
  return false;
}

export function revokeAllSessions(userId: string): number {
  let count = 0;
  for (const s of sessionsStore.values()) {
    if (s.userId === userId && !s.revoked) {
      s.revoked = true;
      count++;
    }
  }
  logger.info({ userId, count }, 'Revoked all user sessions');
  return count;
}

/**
 * Verifies that the user has re-authenticated recently (e.g. within the last 5 minutes)
 * for sensitive operations (role changes, encryption key rotation, data export/deletion).
 */
export function verifyRecentAuthentication(session: UserSession, maxAgeSeconds: number = 300): boolean {
  const ageSeconds = (Date.now() - session.lastAuthenticatedAt) / 1000;
  return ageSeconds <= maxAgeSeconds;
}
