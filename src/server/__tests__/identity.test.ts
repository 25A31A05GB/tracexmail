import { describe, it, expect, beforeEach } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import {
  setOrgSsoConfig,
  isPasswordLoginForbiddenForEmail,
  provisionSsoUser
} from '../identity/sso';
import {
  generateScimToken,
  registerScimRoutes
} from '../identity/scim';
import {
  enrollMfa,
  verifyTotpCode,
  generateTotpCode,
  setOrgMfaRequirement,
  isMfaRequiredForOrg
} from '../identity/mfa';
import {
  createSession,
  listActiveSessions,
  revokeSession
} from '../identity/session';
import {
  createApiKey,
  authenticateApiKey
} from '../identity/apiKeys';
import {
  logAuditEvent,
  verifyAuditChain
} from '../audit/immutableLog';
import { requireAuth } from '../compliance';

describe('Enterprise Identity, SCIM, MFA & Immutable Audit Chain', () => {
  beforeEach(() => {
    // Reset configs
  });

  it('rejects password login for organizations with SSO enforced', () => {
    setOrgSsoConfig({
      orgId: 'org-enterprise-corp',
      protocol: 'saml',
      issuer: 'https://idp.enterprise.com',
      entryPointOrAuthUrl: 'https://idp.enterprise.com/sso',
      allowedDomains: ['enterprise.com'],
      enforceSso: true,
      defaultRole: 'analyst',
      enabled: true,
      updatedAt: new Date().toISOString()
    });

    // Email on enterprise.com domain must be forbidden from password login
    expect(isPasswordLoginForbiddenForEmail('alice@enterprise.com')).toBe(true);

    // Other non-SSO domain is allowed
    expect(isPasswordLoginForbiddenForEmail('bob@gmail.com')).toBe(false);
  });

  it('provisions JIT users via SSO with mapped roles', async () => {
    const user = await provisionSsoUser({
      email: 'secops@enterprise.com',
      name: 'SecOps Analyst',
      orgId: 'org-enterprise-corp',
      groups: ['Enterprise-Security-Admins']
    });

    expect(user.userId).toBeDefined();
    expect(user.role).toBe('admin');
    expect(user.orgId).toBe('org-enterprise-corp');
  });

  it('manages SCIM 2.0 lifecycle and deactivation', async () => {
    const app = express();
    app.use(express.json());
    registerScimRoutes(app);

    const { plaintextToken } = generateScimToken('org-scim-test');

    // 1. Create User via SCIM
    const createRes = await request(app)
      .post('/scim/v2/Users')
      .set('Authorization', `Bearer ${plaintextToken}`)
      .send({
        userName: 'scim.user@testorg.com',
        name: { formatted: 'SCIM User' },
        active: true
      });

    expect(createRes.status).toBe(201);
    const scimId = createRes.body.id;
    expect(scimId).toBeDefined();

    // 2. Query user via filter
    const listRes = await request(app)
      .get('/scim/v2/Users?filter=userName eq "scim.user@testorg.com"')
      .set('Authorization', `Bearer ${plaintextToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.totalResults).toBe(1);

    // 3. Deactivate user via SCIM PATCH
    const patchRes = await request(app)
      .patch(`/scim/v2/Users/${scimId}`)
      .set('Authorization', `Bearer ${plaintextToken}`)
      .send({
        Operations: [{ op: 'replace', path: 'active', value: false }]
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.active).toBe(false);
  });

  it('generates TOTP MFA secret and verifies time-based 6-digit codes', async () => {
    const enrollment = await enrollMfa('user_mfa_123', 'user@test.com');
    expect(enrollment.secret).toBeDefined();
    expect(enrollment.recoveryCodes.length).toBe(8);
    expect(enrollment.qrCodeDataUrl.startsWith('data:image/png;base64,')).toBe(true);

    // Generate valid TOTP code for current window
    const validCode = generateTotpCode(enrollment.secret);
    expect(validCode.length).toBe(6);

    const isValid = verifyTotpCode(enrollment.secret, validCode);
    expect(isValid).toBe(true);

    const isInvalid = verifyTotpCode(enrollment.secret, '000000');
    expect(isInvalid).toBe(false);
  });

  it('blocks access when org requires MFA and session lacks MFA verification', async () => {
    const orgId = 'org-mfa-strict';
    setOrgMfaRequirement(orgId, true);
    expect(isMfaRequiredForOrg(orgId)).toBe(true);

    const app = express();
    app.use((req: any, res, next) => {
      req.user = {
        userId: 'usr_no_mfa',
        email: 'user@strict.com',
        organizationId: orgId,
        role: 'analyst',
        mfaVerified: false
      };
      next();
    });
    app.get('/protected', requireAuth, (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/protected');
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('MFA_REQUIRED');
  });

  it('creates scoped API keys and authenticates hashed tokens', () => {
    const { plaintextKey, keyRecord } = createApiKey({
      name: 'CI Pipeline Key',
      organizationId: 'org-ci',
      userId: 'usr_ci',
      scopes: ['analyze:write', 'cases:read']
    });

    expect(plaintextKey.startsWith('txm_live_')).toBe(true);
    expect(keyRecord.keyHash).not.toBe(plaintextKey); // Hashed at rest

    const auth = authenticateApiKey(plaintextKey);
    expect(auth.valid).toBe(true);
    expect(auth.keyRecord?.organizationId).toBe('org-ci');
    expect(auth.keyRecord?.scopes).toContain('analyze:write');

    // Invalid key must fail
    const invalidAuth = authenticateApiKey('txm_live_wrongrandomtokenhere123456');
    expect(invalidAuth.valid).toBe(false);
  });

  it('maintains immutable audit log hash chain and detects tampering', async () => {
    // 1. Append valid audit entries
    const e1 = await logAuditEvent({
      actor: { id: 'usr_1', email: 'admin@acme.com', role: 'admin' },
      organizationId: 'org-audit-test',
      action: 'KEY_ROTATION',
      target: 'TOKEN_ENCRYPTION_ACTIVE_KEY_ID',
      result: 'success'
    });

    const e2 = await logAuditEvent({
      actor: { id: 'usr_2', email: 'analyst@acme.com', role: 'analyst' },
      organizationId: 'org-audit-test',
      action: 'QUARANTINE_EMAIL',
      target: 'msg_98765',
      result: 'success'
    });

    expect(e2.previousHash).toBe(e1.hash);

    // Pristine verification
    const pristineCheck = verifyAuditChain();
    expect(pristineCheck.valid).toBe(true);

    // 2. Tampering test: directly modify a record's action in memory
    const originalAction = e1.action;
    (e1 as any).action = 'UNAUTHORIZED_DATA_DUMP';

    const tamperedCheck = verifyAuditChain();
    expect(tamperedCheck.valid).toBe(false);
    expect(tamperedCheck.tamperedRecordId).toBe(e1.id);

    // Restore
    e1.action = originalAction;
  });
});
