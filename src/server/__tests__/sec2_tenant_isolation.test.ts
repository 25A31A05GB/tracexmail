import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { generateMockToken } from '../compliance';
import { upsertPersistedCase } from '../caseStore';
import { addAnalyzeJob } from '../queue';
import { createOrgUser } from '../orgUserStore';

describe('SEC-2 Tenant Isolation Test Suite', () => {
  let app: any;
  let userTokenOrgA: string;
  let adminTokenOrgA: string;
  let userTokenOrgB: string;
  let adminTokenOrgB: string;

  const ORG_A = 'org_sec2_alpha';
  const ORG_B = 'org_sec2_beta';

  beforeAll(async () => {
    app = await createApp({ skipVite: true });

    userTokenOrgA = generateMockToken({
      userId: 'usr_alpha_analyst',
      email: 'analyst@alpha.corp',
      role: 'analyst',
      organizationId: ORG_A
    });

    adminTokenOrgA = generateMockToken({
      userId: 'usr_alpha_admin',
      email: 'admin@alpha.corp',
      role: 'admin',
      organizationId: ORG_A
    });

    userTokenOrgB = generateMockToken({
      userId: 'usr_beta_analyst',
      email: 'analyst@beta.corp',
      role: 'analyst',
      organizationId: ORG_B
    });

    adminTokenOrgB = generateMockToken({
      userId: 'usr_beta_admin',
      email: 'admin@beta.corp',
      role: 'admin',
      organizationId: ORG_B
    });
  });

  describe('1. Case Listing & Single Resource Isolation', () => {
    const caseIdA = `case_test_alpha_${Date.now()}`;

    beforeAll(() => {
      upsertPersistedCase({
        id: caseIdA,
        organization_id: ORG_A,
        title: 'Confidential Threat Case Alpha',
        severity: 'HIGH',
        threat_score: 91,
        from_domain: 'malicious-alpha.xyz',
        origin_ip: '198.51.100.12',
        created_at: new Date().toISOString(),
        evidence_chain: [
          {
            id: `evi_${caseIdA}_1`,
            type: 'HEADER',
            name: 'DKIM Fail Proof',
            timestamp: new Date().toISOString(),
            hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          }
        ]
      } as any);
    });

    it('Org A user can list their own case', async () => {
      const res = await request(app)
        .get('/api/cases')
        .set('Authorization', `Bearer ${userTokenOrgA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((c: any) => c.id === caseIdA);
      expect(found).toBeDefined();
    });

    it('Org B user CANNOT see Org A case in listing', async () => {
      const res = await request(app)
        .get('/api/cases')
        .set('Authorization', `Bearer ${userTokenOrgB}`);

      expect(res.status).toBe(200);
      const found = res.body.find((c: any) => c.id === caseIdA);
      expect(found).toBeUndefined();
    });

    it('Org B user CANNOT see Org A case even with spoofed x-organization-id header', async () => {
      const res = await request(app)
        .get('/api/cases')
        .set('Authorization', `Bearer ${userTokenOrgB}`)
        .set('x-organization-id', ORG_A);

      expect(res.status).toBe(200);
      const found = res.body.find((c: any) => c.id === caseIdA);
      expect(found).toBeUndefined();
    });

    it('Org B user requesting single case returns 404', async () => {
      const res = await request(app)
        .get(`/api/cases/${caseIdA}`)
        .set('Authorization', `Bearer ${userTokenOrgB}`);

      expect(res.status).toBe(404);
    });

    it('Org B user requesting single case with spoofed x-organization-id still returns 404', async () => {
      const res = await request(app)
        .get(`/api/cases/${caseIdA}`)
        .set('Authorization', `Bearer ${userTokenOrgB}`)
        .set('x-organization-id', ORG_A);

      expect(res.status).toBe(404);
    });

    it('Org B user requesting case sub-resources returns 404', async () => {
      // Correlation
      const resCorr = await request(app)
        .get(`/api/cases/${caseIdA}/correlation`)
        .set('Authorization', `Bearer ${userTokenOrgB}`);
      expect(resCorr.status).toBe(404);

      // SOC Report
      const resSoc = await request(app)
        .get(`/api/cases/${caseIdA}/soc-report`)
        .set('Authorization', `Bearer ${userTokenOrgB}`);
      expect(resSoc.status).toBe(404);

      // Relationship Graph
      const resGraph = await request(app)
        .get(`/api/cases/${caseIdA}/graph`)
        .set('Authorization', `Bearer ${userTokenOrgB}`);
      expect(resGraph.status).toBe(404);

      // PDF Report
      const resPdf = await request(app)
        .get(`/api/cases/${caseIdA}/report.pdf`)
        .set('Authorization', `Bearer ${userTokenOrgB}`);
      expect(resPdf.status).toBe(404);

      // Evidence List
      const resEvidence = await request(app)
        .get(`/api/cases/${caseIdA}/evidence`)
        .set('Authorization', `Bearer ${userTokenOrgB}`);
      expect(resEvidence.status).toBe(404);

      // Evidence Verification
      const resVer = await request(app)
        .get(`/api/evidence/evi_${caseIdA}_1/verify`)
        .set('Authorization', `Bearer ${userTokenOrgB}`);
      expect(resVer.status).toBe(404);
    });
  });

  describe('2. Queue Job Isolation', () => {
    let jobIdA: string;

    beforeAll(async () => {
      const job = await addAnalyzeJob({
        emailContent: 'From: test@alpha.corp\r\n\r\nTest',
        filename: 'test.eml',
        size: 32,
        organizationId: ORG_A
      });
      jobIdA = job.id;
    });

    it('Org A user can query their own job status', async () => {
      const res = await request(app)
        .get(`/api/jobs/${jobIdA}`)
        .set('Authorization', `Bearer ${userTokenOrgA}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(jobIdA);
    });

    it('Org B user querying Org A job returns 404', async () => {
      const res = await request(app)
        .get(`/api/jobs/${jobIdA}`)
        .set('Authorization', `Bearer ${userTokenOrgB}`);

      expect(res.status).toBe(404);
    });

    it('Org B user querying Org A job with spoofed header still returns 404', async () => {
      const res = await request(app)
        .get(`/api/jobs/${jobIdA}`)
        .set('Authorization', `Bearer ${userTokenOrgB}`)
        .set('x-organization-id', ORG_A);

      expect(res.status).toBe(404);
    });
  });

  describe('3. Team & Member Isolation', () => {
    let memberIdA: string;

    beforeAll(async () => {
      const { user } = await createOrgUser({
        organizationId: ORG_A,
        name: 'Alpha Operator',
        email: `alpha_op_${Date.now()}@alpha.corp`,
        role: 'analyst'
      });
      memberIdA = user.id;
    });

    it('Org B admin cannot delete Org A team member (returns 404)', async () => {
      const res = await request(app)
        .delete(`/api/team/members/${memberIdA}`)
        .set('Authorization', `Bearer ${adminTokenOrgB}`);

      expect(res.status).toBe(404);
    });

    it('Org B admin cannot update Org A team member role (returns 404)', async () => {
      const res = await request(app)
        .patch(`/api/team/members/${memberIdA}/role`)
        .set('Authorization', `Bearer ${adminTokenOrgB}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(404);
    });

    it('Org B admin cannot list Org A team members', async () => {
      const res = await request(app)
        .get('/api/team/members')
        .set('Authorization', `Bearer ${adminTokenOrgB}`);

      expect(res.status).toBe(200);
      const found = res.body.find((m: any) => m.id === memberIdA);
      expect(found).toBeUndefined();
    });
  });

  describe('4. CORS Header Whitelist (Tenant Headers Excluded)', () => {
    it('Preflight request confirms x-organization-id is not an allowed header', async () => {
      const res = await request(app)
        .options('/api/cases')
        .set('Origin', 'https://tracexmail.vercel.app')
        .set('Access-Control-Request-Headers', 'x-organization-id');

      const allowedHeaders = (res.headers['access-control-allow-headers'] || '').toLowerCase();
      expect(allowedHeaders).not.toContain('x-organization-id');
      expect(allowedHeaders).not.toContain('x-user-id');
      expect(allowedHeaders).not.toContain('x-user-email');
    });
  });
});
