import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getSupabaseAdminClient, getSupabaseClient, DEFAULT_ORG_ID } from './supabase';
import { logAuditAction, AuthenticatedRequest, requireAuth, requireRole, UserRole } from './compliance';
import { authLimiter } from './rateLimiter';

export interface AuthSecurityOptions {
  broadcastAlertFn: (alert: any, extraData?: any) => Promise<void> | void;
}

interface FailedAttemptTracker {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
}

// In-memory brute force trackers (per-IP and per-account)
const failedAttemptsByIp = new Map<string, FailedAttemptTracker>();
const failedAttemptsByAccount = new Map<string, FailedAttemptTracker>();

const MONITORING_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const FAILED_LOGIN_ALERT_THRESHOLD = 5; // Alert SOC upon 5 failed attempts

// Dummy bcrypt hash used for timing-safe constant-time password verification when user does not exist
const DUMMY_BCRYPT_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

/**
 * Records failed login attempt and dispatches real-time SOC Live Alert
 * if the failed attempt threshold is reached or exceeded.
 */
function recordFailedLogin(
  ip: string,
  accountEmail: string | null,
  broadcastAlertFn: (alert: any, extraData?: any) => Promise<void> | void
) {
  const now = Date.now();

  // 1. Track by IP
  let ipEntry = failedAttemptsByIp.get(ip);
  if (!ipEntry || now - ipEntry.lastAttempt > MONITORING_WINDOW_MS) {
    ipEntry = { count: 1, firstAttempt: now, lastAttempt: now };
  } else {
    ipEntry.count += 1;
    ipEntry.lastAttempt = now;
  }
  failedAttemptsByIp.set(ip, ipEntry);

  // 2. Track by Account
  let accEntry: FailedAttemptTracker | undefined;
  if (accountEmail) {
    const norm = accountEmail.toLowerCase().trim();
    accEntry = failedAttemptsByAccount.get(norm);
    if (!accEntry || now - accEntry.lastAttempt > MONITORING_WINDOW_MS) {
      accEntry = { count: 1, firstAttempt: now, lastAttempt: now };
    } else {
      accEntry.count += 1;
      accEntry.lastAttempt = now;
    }
    failedAttemptsByAccount.set(norm, accEntry);
  }

  // 3. Trigger SIEM Live Alert if threshold reached
  const isIpTriggered = ipEntry.count >= FAILED_LOGIN_ALERT_THRESHOLD;
  const isAccTriggered = accEntry && accEntry.count >= FAILED_LOGIN_ALERT_THRESHOLD;

  if (isIpTriggered || isAccTriggered) {
    const alertId = `alt_sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const targetLabel = isAccTriggered
      ? `Targeted Account: ${accountEmail} (${accEntry?.count} attempts)`
      : `Origin IP: ${ip} (${ipEntry.count} attempts)`;

    const secAlert = {
      id: alertId,
      organization_id: DEFAULT_ORG_ID,
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
      title: `🚨 Authentication Attack: Excessive Failed Logins (${accountEmail || ip})`,
      description: `Security threshold exceeded: Repeated failed authentication attempts detected for ${targetLabel} within a 15-minute window. Rate-limiting backoff active. Potential brute-force or credential-stuffing threat.`,
      source: 'auth-firewall',
      read: false,
      threat_score: 95,
      category: 'AUTH_BRUTE_FORCE',
      sender: accountEmail || 'unknown@threat-actor.net',
      subject: 'Security Alert: Credential Attack In Progress'
    };

    try {
      broadcastAlertFn(secAlert);
    } catch (err: any) {
      console.warn('[AuthSecurity] Failed to dispatch security threshold alert:', err?.message);
    }
  }
}

/**
 * Resets failed login counters upon successful authentication
 */
function resetFailedLoginCounters(ip: string, accountEmail?: string | null) {
  failedAttemptsByIp.delete(ip);
  if (accountEmail) {
    failedAttemptsByAccount.delete(accountEmail.toLowerCase().trim());
  }
}

export function createAuthRouter(options: AuthSecurityOptions): Router {
  const router = Router();
  const { broadcastAlertFn } = options;

  // Apply strict rate limiting across all auth routes
  router.use(authLimiter);

  /**
   * POST /api/auth/login
   * Timing-safe, enumeration-resistant authentication.
   * Both non-existent accounts and wrong passwords return the exact same generic error.
   */
  router.post('/login', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required.',
        code: 'MISSING_CREDENTIALS'
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password);

    try {
      const supabase = getSupabaseClient();
      let authSuccess = false;
      let authenticatedUser: any = null;
      let sessionToken: string | null = null;
      let profileData: any = null;

      if (supabase) {
        // Authenticate against Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword
        });

        if (!error && data.user && data.session) {
          authSuccess = true;
          authenticatedUser = data.user;
          sessionToken = data.session.access_token;

          // Fetch profile data
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();
          profileData = profile;
        }
      }

      if (authSuccess && authenticatedUser) {
        resetFailedLoginCounters(ip, cleanEmail);

        await logAuditAction({
          organization_id: profileData?.organization_id || DEFAULT_ORG_ID,
          user_id: authenticatedUser.id,
          user_email: cleanEmail,
          user_role: profileData?.role || 'analyst',
          action: 'AUTH_LOGIN_SUCCESS',
          resource_type: 'auth',
          details: {
            auth_provider: 'supabase',
            mfa_level: authenticatedUser.app_metadata?.aal || 'aal1'
          },
          ip_address: ip,
          status: 'SUCCESS'
        }).catch(err => console.warn('[AuthAudit] Failed logging login success:', err));

        return res.json({
          status: 'success',
          token: sessionToken,
          user: {
            id: authenticatedUser.id,
            email: cleanEmail,
            role: profileData?.role || 'analyst',
            organizationId: profileData?.organization_id || DEFAULT_ORG_ID,
            fullName: profileData?.full_name || cleanEmail.split('@')[0],
            emailVerified: Boolean(authenticatedUser.email_confirmed_at)
          }
        });
      }

      // If authentication failed: perform dummy bcrypt check to equalize timing
      // with successful password verification, preventing timing attacks.
      bcrypt.compareSync(cleanPassword, DUMMY_BCRYPT_HASH);

      recordFailedLogin(ip, cleanEmail, broadcastAlertFn);

      await logAuditAction({
        organization_id: DEFAULT_ORG_ID,
        user_id: 'unknown',
        user_email: cleanEmail,
        user_role: 'unauthenticated',
        action: 'AUTH_LOGIN_FAILURE',
        resource_type: 'auth',
        details: {
          failure_reason: 'INVALID_CREDENTIALS',
          client_ip: ip
        },
        ip_address: ip,
        status: 'FAILURE'
      }).catch(err => console.warn('[AuthAudit] Failed logging login failure:', err));

      // Constant, non-enumerating error message
      return res.status(401).json({
        error: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS'
      });
    } catch (err: any) {
      console.error('[AuthRouter] Unexpected error during login:', err);
      return res.status(401).json({
        error: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS'
      });
    }
  });

  /**
   * POST /api/auth/register (or /api/auth/signup)
   * Hardened signup with:
   * - 12+ character minimum password length policy
   * - Leaked-password detection (HaveIBeenPwned)
   * - Enumeration prevention: existing users return an identical confirmation response
   */
  const handleSignup = async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const { email, password, fullName, orgName, role, accountType } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required.',
        code: 'MISSING_FIELDS'
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password);

    // Enforce real minimum password length (12+ characters per modern NIST 800-63B standards)
    if (cleanPassword.length < 12) {
      return res.status(400).json({
        error: 'Password policy requirement: Password must be at least 12 characters.',
        code: 'PASSWORD_TOO_SHORT',
        required_length: 12
      });
    }

    const assignedOrg = accountType === 'organization' ? (orgName?.trim() || 'Acme Cyber Defense SOC') : 'Personal Sandbox';
    const assignedRole: UserRole = role === 'admin' ? 'admin' : role === 'read_only' ? 'read_only' : 'analyst';

    try {
      const supabaseAdmin = getSupabaseAdminClient();
      const supabase = getSupabaseClient();

      if (supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: {
              full_name: fullName?.trim() || cleanEmail.split('@')[0],
              org_name: assignedOrg,
              role: assignedRole,
              account_type: accountType || 'personal'
            }
          }
        });

        if (error) {
          const errMsg = error.message.toLowerCase();
          // Leaked password detected by Supabase Auth (HaveIBeenPwned corpus)
          if (errMsg.includes('pwned') || errMsg.includes('compromised') || errMsg.includes('breach') || errMsg.includes('leaked')) {
            return res.status(400).json({
              error: 'Security Warning: This password has appeared in a known public data breach. Please choose a different, unique passphrase.',
              code: 'LEAKED_PASSWORD_DETECTED'
            });
          }

          // If the account already exists, DO NOT leak account existence.
          // Return the exact same confirmation response as a new signup.
          if (errMsg.includes('already registered') || errMsg.includes('already exists') || errMsg.includes('user already in use')) {
            return res.status(200).json({
              status: 'success',
              message: 'Verification link dispatched. Please check your email to confirm your account.',
              email: cleanEmail
            });
          }

          // Other valid Supabase error
          return res.status(400).json({
            error: error.message || 'Registration request could not be completed.',
            code: 'SIGNUP_ERROR'
          });
        }

        // If user created, ensure profile is initialized
        if (data.user && supabaseAdmin) {
          try {
            await supabaseAdmin.from('profiles').upsert({
              id: data.user.id,
              email: cleanEmail,
              organization_id: DEFAULT_ORG_ID,
              role: assignedRole,
              full_name: fullName?.trim() || cleanEmail.split('@')[0],
              account_type: accountType || 'personal',
              updated_at: new Date().toISOString()
            });
          } catch (pErr: any) {
            console.warn('[AuthRouter] Profile initialization notice:', pErr?.message);
          }
        }
      }

      await logAuditAction({
        organization_id: DEFAULT_ORG_ID,
        user_email: cleanEmail,
        user_role: assignedRole,
        action: 'AUTH_SIGNUP',
        resource_type: 'auth',
        details: {
          account_type: accountType || 'personal',
          client_ip: ip
        },
        ip_address: ip,
        status: 'SUCCESS'
      }).catch(err => console.warn('[AuthAudit] Failed logging signup:', err));

      return res.status(200).json({
        status: 'success',
        message: 'Verification link dispatched. Please check your email to confirm your account.',
        email: cleanEmail
      });
    } catch (err: any) {
      console.error('[AuthRouter] Signup error:', err);
      return res.status(500).json({
        error: 'An unexpected server error occurred during registration. Please try again later.',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  router.post('/register', handleSignup);
  router.post('/signup', handleSignup);

  /**
   * POST /api/auth/reset-password
   * Generic, non-enumerating password reset request.
   * Returns an identical response whether or not the account exists.
   */
  router.post('/reset-password', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({
        error: 'Email address is required.',
        code: 'MISSING_EMAIL'
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const origin = req.headers.origin || `https://${req.headers.host || 'localhost:3000'}`;
        await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${origin}/#reset-password`
        }).catch(err => {
          // Log internally, but never reveal failure to client
          console.warn('[AuthRouter] Supabase resetPasswordForEmail notice:', err?.message);
        });
      }

      await logAuditAction({
        organization_id: DEFAULT_ORG_ID,
        user_email: cleanEmail,
        user_role: 'user',
        action: 'AUTH_PASSWORD_RESET_REQUESTED',
        resource_type: 'auth',
        details: { client_ip: ip },
        ip_address: ip,
        status: 'SUCCESS'
      }).catch(err => console.warn('[AuthAudit] Failed logging password reset request:', err));

      // Uniform response for all inputs: zero account enumeration
      return res.status(200).json({
        status: 'success',
        message: 'If an account exists with this email, password recovery instructions have been sent. Please check your inbox.'
      });
    } catch (err: any) {
      console.error('[AuthRouter] Password reset exception:', err);
      return res.status(200).json({
        status: 'success',
        message: 'If an account exists with this email, password recovery instructions have been sent. Please check your inbox.'
      });
    }
  });

  /**
   * POST /api/auth/logout
   * Revokes the caller's active session and records audit event.
   */
  router.post('/logout', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const user = (req as AuthenticatedRequest).user;
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    try {
      const supabaseAdmin = getSupabaseAdminClient();
      if (supabaseAdmin && token) {
        // Invalidate Supabase JWT server-side
        await supabaseAdmin.auth.admin.signOut(token).catch(err => {
          console.warn('[AuthRouter] Server-side token invalidation notice:', err?.message);
        });
      }

      if (user) {
        await logAuditAction({
          organization_id: user.organizationId,
          user_id: user.userId,
          user_email: user.email,
          user_role: user.role,
          action: 'AUTH_LOGOUT',
          resource_type: 'auth',
          details: { client_ip: ip },
          ip_address: ip,
          status: 'SUCCESS'
        }).catch(err => console.warn('[AuthAudit] Failed logging logout:', err));
      }

      return res.json({
        status: 'success',
        message: 'Active session revoked.'
      });
    } catch (err: any) {
      return res.json({ status: 'success', message: 'Session cleared.' });
    }
  });

  /**
   * POST /api/auth/revoke-all-sessions
   * Signs out all other active sessions for the authenticated user.
   */
  router.post('/revoke-all-sessions', requireAuth, async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const user = (req as AuthenticatedRequest).user!;

    try {
      const supabaseAdmin = getSupabaseAdminClient();
      if (supabaseAdmin && user.userId) {
        // Revoke all active sessions for this user ID in Supabase
        await supabaseAdmin.auth.admin.signOut(user.userId, 'others').catch(err => {
          console.warn('[AuthRouter] Revoke others notice:', err?.message);
        });
      }

      await logAuditAction({
        organization_id: user.organizationId,
        user_id: user.userId,
        user_email: user.email,
        user_role: user.role,
        action: 'AUTH_REVOKE_ALL_SESSIONS',
        resource_type: 'auth',
        details: { client_ip: ip, scope: 'others' },
        ip_address: ip,
        status: 'SUCCESS'
      }).catch(err => console.warn('[AuthAudit] Failed logging revoke-all:', err));

      return res.json({
        status: 'success',
        message: 'All other active sessions have been successfully terminated.'
      });
    } catch (err: any) {
      console.error('[AuthRouter] Revoke all sessions error:', err);
      return res.status(500).json({
        error: 'Failed to revoke other sessions. Please try again.',
        code: 'REVOKE_ERROR'
      });
    }
  });

  /**
   * GET /api/auth/session
   * Authenticated session retrieval.
   * Returns the authenticated user profile if a valid token is provided.
   * Returns 401 Unauthorized if missing or invalid. NEVER generates fake unauthenticated tokens!
   */
  router.get('/session', (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({
        authenticated: false,
        error: 'No active authenticated session found. Please sign in.',
        code: 'ERR_UNAUTHORIZED'
      });
    }

    return res.json({
      authenticated: true,
      status: 'authenticated',
      user: {
        userId: user.userId,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
        authMethod: user.authMethod
      }
    });
  });

  // State for admin mandatory MFA enforcement (persisted per server lifecycle)
  let mandatoryAdminMfaState = true;

  /**
   * MFA (Multi-Factor Authentication) Endpoints
   */
  router.get('/mfa/status', requireAuth, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user!;
    const supabaseAdmin = getSupabaseAdminClient();

    let factors: any[] = [];
    if (supabaseAdmin && user.userId) {
      try {
        const { data } = await supabaseAdmin.auth.admin.mfa.listFactors({
          userId: user.userId
        });
        factors = data?.factors || [];
      } catch (err: any) {
        console.warn('[MFA] Failed fetching user factors:', err?.message);
      }
    }

    const hasTotp = factors.some(f => f.factor_type === 'totp' && f.status === 'verified');

    return res.json({
      userId: user.userId,
      role: user.role,
      mfaEnrolled: hasTotp,
      factorsCount: factors.length,
      mandatoryAdminMfa: mandatoryAdminMfaState,
      requiresMfa: user.role === 'admin' && mandatoryAdminMfaState
    });
  });

  router.get('/mfa/policy', async (_req: Request, res: Response) => {
    return res.json({
      mandatoryAdminMfa: mandatoryAdminMfaState,
      targetRole: 'admin',
      description: 'Mandatory TOTP MFA policy enforcement for SOC Lead and Admin accounts.'
    });
  });

  router.post('/mfa/policy', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user!;
    const ip = getClientIp(req);
    const { mandatoryAdminMfa } = req.body || {};

    if (typeof mandatoryAdminMfa !== 'boolean') {
      return res.status(400).json({ error: 'Invalid policy value. Expected boolean mandatoryAdminMfa.' });
    }

    mandatoryAdminMfaState = mandatoryAdminMfa;

    await logAuditAction({
      organization_id: user.organizationId,
      user_id: user.userId,
      user_email: user.email,
      user_role: user.role,
      action: mandatoryAdminMfa ? 'AUTH_MFA_POLICY_ENFORCED' : 'AUTH_MFA_POLICY_RELAXED',
      resource_type: 'mfa_policy',
      details: {
        mandatory_for_admins: mandatoryAdminMfa,
        configured_by: user.email,
        client_ip: ip
      },
      ip_address: ip,
      status: 'SUCCESS'
    }).catch(err => console.warn('[AuthAudit] MFA policy log failure:', err));

    return res.json({
      success: true,
      mandatoryAdminMfa: mandatoryAdminMfaState,
      updatedBy: user.email
    });
  });

  router.post('/mfa/enroll-log', requireAuth, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user!;
    const ip = getClientIp(req);
    const { status, factorType = 'totp', factorId } = req.body || {};

    await logAuditAction({
      organization_id: user.organizationId,
      user_id: user.userId,
      user_email: user.email,
      user_role: user.role,
      action: status === 'SUCCESS' ? 'AUTH_MFA_ENROLLED' : 'AUTH_MFA_CHALLENGE_FAILED',
      resource_type: 'mfa',
      resource_id: factorId,
      details: { factor_type: factorType, client_ip: ip },
      ip_address: ip,
      status: status === 'SUCCESS' ? 'SUCCESS' : 'FAILURE'
    }).catch(err => console.warn('[AuthAudit] MFA log failure:', err));

    return res.json({ status: 'recorded' });
  });

  router.post('/mfa/unenroll-log', requireAuth, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user!;
    const ip = getClientIp(req);
    const { factorId } = req.body || {};

    await logAuditAction({
      organization_id: user.organizationId,
      user_id: user.userId,
      user_email: user.email,
      user_role: user.role,
      action: 'AUTH_MFA_UNENROLLED',
      resource_type: 'mfa',
      resource_id: factorId,
      details: { factor_id: factorId, client_ip: ip },
      ip_address: ip,
      status: 'SUCCESS'
    }).catch(err => console.warn('[AuthAudit] MFA unenroll log failure:', err));

    return res.json({ status: 'recorded' });
  });

  return router;
}
