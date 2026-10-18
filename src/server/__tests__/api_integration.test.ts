import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { signUserToken, resolveMasterSecret } from '../compliance';
import { initializeLocalEmbeddingModel } from '../semanticSimilarity';
import type { Express } from 'express';

describe('API Integration Test Suite', () => {
  let app: Express;

  const validAdminToken = signUserToken({
    userId: 'usr_admin_1',
    email: 'admin@org-alpha.sec',
    role: 'admin',
    organizationId: 'org_alpha'
  });

  const validAnalystToken = signUserToken({
    userId: 'usr_analyst_1',
    email: 'analyst@org-alpha.sec',
    role: 'analyst',
    organizationId: 'org_alpha'
  });

  const validReadOnlyToken = signUserToken({
    userId: 'usr_ro_1',
    email: 'viewer@org-alpha.sec',
    role: 'read_only',
    organizationId: 'org_alpha'
  });

  const orgBetaAnalystToken = signUserToken({
    userId: 'usr_beta_1',
    email: 'analyst@org-beta.sec',
    role: 'analyst',
    organizationId: 'org_beta'
  });

  const expiredToken = jwt.sign(
    {
      sub: 'usr_exp',
      email: 'expired@org-alpha.sec',
      organization_id: 'org_alpha',
      role: 'analyst'
    },
    process.env.JWT_SECRET?.trim() || resolveMasterSecret(),
    { expiresIn: -10 }
  );

  beforeAll(async () => {
    app = (await createApp({ skipVite: true })) as Express;
    await initializeLocalEmbeddingModel().catch(() => {});
  }, 40000);

  describe('1. Authentication Security', () => {
    it('accepts valid token on protected route', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('admin@org-alpha.sec');
      expect(res.body.user.organizationId).toBe('org_alpha');
    });

    it('rejects forged / invalid token with 401', async () => {
      const forgedToken = validAdminToken.slice(0, -10) + 'invalid123';
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`);
      expect(res.status).toBe(401);
    });

    it('rejects expired token with 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
    });

    it('rejects or ignores header spoofing attempt without valid credentials', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('x-user-id', 'admin')
        .set('x-organization-id', 'super_secret_org');
      expect(res.status).toBe(401);
    });
  });

  describe('2. Role-Based Access Control (RBAC)', () => {
    it('forbids read_only role from creating cases (403)', async () => {
      const res = await request(app)
        .post('/api/cases')
        .set('Authorization', `Bearer ${validReadOnlyToken}`)
        .send({
          title: 'Unauthorized Case by ReadOnly User',
          severity: 'HIGH'
        });
      expect(res.status).toBe(403);
    });

    it('allows analyst role to create cases (200 or 201)', async () => {
      const res = await request(app)
        .post('/api/cases')
        .set('Authorization', `Bearer ${validAnalystToken}`)
        .send({
          title: 'Legitimate Analyst Incident Case',
          severity: 'HIGH'
        });
      expect([200, 201]).toContain(res.status);
    });

    it('forbids read_only role from creating campaigns (403)', async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${validReadOnlyToken}`)
        .send({ name: 'Blocked Campaign' });
      expect(res.status).toBe(403);
    });

    it('forbids analyst from running retention purge (admin-only route)', async () => {
      const res = await request(app)
        .post('/api/compliance/retention/run')
        .set('Authorization', `Bearer ${validAnalystToken}`)
        .send({ retention_days: 90 });
      expect(res.status).toBe(403);
    });

    it('allows admin to run retention purge', async () => {
      const res = await request(app)
        .post('/api/compliance/retention/run')
        .set('Authorization', `Bearer ${validAdminToken}`)
        .send({ retention_days: 90 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('3. Multi-Tenant Isolation', () => {
    it('isolates cases created by Org Alpha from Org Beta', async () => {
      // Org Alpha creates a unique case
      const alphaCaseRes = await request(app)
        .post('/api/cases')
        .set('Authorization', `Bearer ${validAnalystToken}`)
        .send({
          id: `case_alpha_tenant_${Date.now()}`,
          title: 'Top Secret Alpha Threat',
          severity: 'CRITICAL'
        });
      expect([200, 201]).toContain(alphaCaseRes.status);
      const alphaCaseId = alphaCaseRes.body.id;

      // Org Beta tries to access Org Alpha's specific case
      const betaAccessRes = await request(app)
        .get(`/api/cases/${alphaCaseId}`)
        .set('Authorization', `Bearer ${orgBetaAnalystToken}`);
      
      // Should not find the case or should be 404
      expect(betaAccessRes.status).toBe(404);
    });
  });

  describe('4. Forensic Analyze Pipeline', () => {
    it('analyzes bec_wire_fraud.eml successfully', async () => {
      const filePath = path.join(process.cwd(), 'data/demo_emails/bec_wire_fraud.eml');
      expect(fs.existsSync(filePath)).toBe(true);
      const rawContent = fs.readFileSync(filePath, 'utf8');

      const res = await request(app)
        .post('/api/analyze')
        .send({ raw_email: rawContent });

      expect([200, 202]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.analysis).toBeDefined();
        expect(res.body.analysis.threatScore).toBeGreaterThanOrEqual(0);
        expect(res.body.analysis.hops).toBeDefined();
      } else {
        expect(res.body.jobId).toBeDefined();
      }
    }, 20000);

    it('handles malformed EML upload gracefully without crashing', async () => {
      const res = await request(app)
        .post('/api/analyze')
        .send({ raw_email: 'INVALID NON-MIME GARBAGE CONTENT !@#$%^&*()' });

      expect([200, 400]).toContain(res.status);
    });
  });

  describe('5. Upload Validation & Security Gates', () => {
    it('rejects unauthorized files and disallows bad extensions on upload endpoint', async () => {
      const res = await request(app)
        .post('/api/analyze')
        .set('Authorization', `Bearer ${validAnalystToken}`)
        .attach('files', Buffer.from('MZ... executable header'), 'malware.exe');

      expect([400, 415]).toContain(res.status);
    });
  });

  describe('6. OAuth Redirect & CSRF Validation', () => {
    it('rejects disallowed redirect_uri on /api/gmail/oauth/start', async () => {
      const res = await request(app)
        .get('/api/gmail/oauth/start?redirect_uri=https://evil-hacker.com/steal-creds');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_request');
    });

    it('rejects non-HTTPS redirect URI when in production', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const res = await request(app)
          .get('/api/gmail/oauth/start?redirect_uri=http://attacker.org/callback');
        expect(res.status).toBe(400);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('7. Cloud Pub/Sub Push Verification', () => {
    it('rejects unverified Google Pub/Sub push requests', async () => {
      const res = await request(app)
        .post('/api/gmail/pubsub/push')
        .send({
          message: {
            data: Buffer.from(JSON.stringify({ test: 'spoofed' })).toString('base64')
          }
        });

      // When secret token is configured, missing or invalid token must return 401
      if (process.env.GMAIL_PUBSUB_VERIFICATION_TOKEN) {
        expect(res.status).toBe(401);
      } else {
        expect([200, 401]).toContain(res.status);
      }
    });
  });
});
