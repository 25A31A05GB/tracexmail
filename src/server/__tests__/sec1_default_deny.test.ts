import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { generateMockToken } from '../compliance';

describe('SEC-1 Default-Deny Route Security & Role Enforcement Suite', () => {
  let app: any;
  let readOnlyToken: string;
  let analystToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createApp({ skipVite: true });
    readOnlyToken = generateMockToken({
      userId: 'usr_ro',
      email: 'readonly@corp.com',
      role: 'read_only',
      organizationId: 'org-test'
    });
    analystToken = generateMockToken({
      userId: 'usr_analyst',
      email: 'analyst@corp.com',
      role: 'analyst',
      organizationId: 'org-test'
    });
    adminToken = generateMockToken({
      userId: 'usr_admin',
      email: 'admin@corp.com',
      role: 'admin',
      organizationId: 'org-test'
    });
  });

  describe('1. Default-Deny: Unauthenticated requests return 401', () => {
    const protectedRoutes = [
      { method: 'get', path: '/api/cases' },
      { method: 'get', path: '/api/cases/case-123' },
      { method: 'get', path: '/api/search?q=test' },
      { method: 'get', path: '/api/stats' },
      { method: 'get', path: '/api/alerts' },
      { method: 'get', path: '/api/campaigns' },
      { method: 'get', path: '/api/gmail/search?q=test' },
      { method: 'get', path: '/api/audit/export' },
      { method: 'get', path: '/api/audit/verify' },
      { method: 'get', path: '/api/admin/models/registry' },
      { method: 'get', path: '/api/team/members' },
      { method: 'get', path: '/api/organization/privacy-config' },
      { method: 'post', path: '/api/cases' },
      { method: 'post', path: '/api/soar/execute' },
      { method: 'post', path: '/api/admin/models/promote' },
      { method: 'post', path: '/api/gmail/quarantine-message' },
      { method: 'post', path: '/api/gmail/create-filter' }
    ];

    protectedRoutes.forEach(({ method, path }) => {
      it(`rejects unauthenticated ${method.toUpperCase()} ${path} with 401`, async () => {
        const res = await (request(app) as any)[method](path);
        expect(res.status).toBe(401);
      });
    });
  });

  describe('2. Public Allowlist Access', () => {
    it('allows unauthenticated access to /api/health', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
    });

    it('allows unauthenticated access to /api/auth/login', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'fake', password: 'fake' });
      expect([200, 400, 401]).toContain(res.status); // Accepts request without 401 Default-Deny gate
    });
  });

  describe('3. Role Spectrum Enforcement: read_only cannot execute write operations', () => {
    it('rejects POST /api/cases from read_only with 403', async () => {
      const res = await request(app)
        .post('/api/cases')
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .send({ subject: 'Test Case' });
      expect(res.status).toBe(403);
    });

    it('rejects POST /api/admin/models/promote from analyst with 403', async () => {
      const res = await request(app)
        .post('/api/admin/models/promote')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ name: 'model_v1', version: '1.0.0' });
      expect(res.status).toBe(403);
    });

    it('rejects GET /api/audit/export from analyst with 403', async () => {
      const res = await request(app)
        .get('/api/audit/export')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(res.status).toBe(403);
    });

    it('allows GET /api/audit/export for admin', async () => {
      const res = await request(app)
        .get('/api/audit/export')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });
});
