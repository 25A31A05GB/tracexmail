import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { signUserToken } from '../compliance';
import type { Express } from 'express';

describe('Alerts Route Security Regression Tests', () => {
  let app: Express;

  const FAKE_RESEND_KEY = 're_fake_test_secret_key_abcdef123456';
  const FAKE_SMTP_PASS = 'fake_smtp_super_secret_pass_789012';

  const adminToken = signUserToken({
    userId: 'usr_sec_admin',
    email: 'admin@secops.internal',
    role: 'admin',
    organizationId: 'org_safe_123'
  });

  const analystToken = signUserToken({
    userId: 'usr_sec_analyst',
    email: 'analyst@secops.internal',
    role: 'analyst',
    organizationId: 'org_safe_123'
  });

  const readOnlyToken = signUserToken({
    userId: 'usr_sec_auditor',
    email: 'auditor@secops.internal',
    role: 'read_only',
    organizationId: 'org_safe_123'
  });

  const injectionOrgToken = signUserToken({
    userId: 'usr_sec_attacker',
    email: 'attacker@secops.internal',
    role: 'analyst',
    organizationId: 'a,organization_id.not.is.null'
  });

  beforeAll(async () => {
    process.env.RESEND_API_KEY = FAKE_RESEND_KEY;
    process.env.SMTP_PASSWORD = FAKE_SMTP_PASS;
    process.env.SMTP_HOST = 'smtp.fake-mail-relay.internal';
    process.env.SMTP_USER = 'fake_user';

    app = (await createApp({ skipVite: true })) as Express;
  }, 40000);

  describe('1. Unauthenticated endpoints return 401', () => {
    it('returns 401 for unauthenticated GET /api/alerts', async () => {
      const res = await request(app).get('/api/alerts');
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated PATCH /api/alerts/:alertId/read', async () => {
      const res = await request(app).patch('/api/alerts/alt_test_1/read');
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated POST /api/soar/execute', async () => {
      const res = await request(app).post('/api/soar/execute').send({ action: 'BLOCK_IP' });
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated GET /api/alerts/email/config', async () => {
      const res = await request(app).get('/api/alerts/email/config');
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated GET /api/alerts/email/logs', async () => {
      const res = await request(app).get('/api/alerts/email/logs');
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated GET /api/slack/deliveries', async () => {
      const res = await request(app).get('/api/slack/deliveries');
      expect(res.status).toBe(401);
    });
  });

  describe('2. Header spoofing protection', () => {
    it('x-organization-id header alone does not authenticate requests', async () => {
      const res = await request(app)
        .get('/api/alerts')
        .set('x-organization-id', 'org_victim_tenant');
      expect(res.status).toBe(401);
    });
  });

  describe('3. Email alert configuration sanitization', () => {
    it('email/config response never contains fake resend key or smtp password', async () => {
      const res = await request(app)
        .get('/api/alerts/email/config')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('enabled');
      expect(res.body).toHaveProperty('provider');
      expect(res.body).toHaveProperty('smtpHost');
      expect(res.body).toHaveProperty('smtpPort');
      expect(res.body).toHaveProperty('smtpFrom');
      expect(res.body).toHaveProperty('hasResendKey');
      expect(res.body).toHaveProperty('hasSmtpCredentials');
      expect(res.body).toHaveProperty('recipientCount');

      expect((res.body as any).resendApiKey).toBeUndefined();
      expect((res.body as any).smtpPass).toBeUndefined();
      expect((res.body as any).smtpPassword).toBeUndefined();
      expect((res.body as any).smtpUser).toBeUndefined();

      const rawJson = JSON.stringify(res.body);
      expect(rawJson).not.toContain(FAKE_RESEND_KEY);
      expect(rawJson).not.toContain(FAKE_SMTP_PASS);
    });
  });

  describe('4. Role-based access control (RBAC)', () => {
    it('analyst gets 403 on email/config', async () => {
      const res = await request(app)
        .get('/api/alerts/email/config')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(res.status).toBe(403);
    });

    it('read_only gets 403 on soar execution', async () => {
      const res = await request(app)
        .post('/api/soar/execute')
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .send({ action: 'BLOCK_IP' });
      expect(res.status).toBe(403);
    });

    it('soar returns 501 not_implemented for an analyst', async () => {
      const res = await request(app)
        .post('/api/soar/execute')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ action: 'BLOCK_IP' });

      expect(res.status).toBe(501);
      expect(res.body.status).toBe('not_implemented');
      expect(res.body.status).not.toBe('executed');
      expect(res.body.error).toBe(
        'Automated containment is not connected to any firewall, mail gateway or identity provider. No action was taken.'
      );
    });
  });

  describe('5. Organization ID validation & injection prevention', () => {
    it('an organizationId like "a,organization_id.not.is.null" gets 400 on GET /api/alerts', async () => {
      const res = await request(app)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${injectionOrgToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid organization ID');
    });
  });
});
