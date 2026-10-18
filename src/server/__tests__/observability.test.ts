import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { requestLogger, redactSensitiveData } from '../logger';
import { registerHealthRoutes, checkDatabaseReadiness, checkRedisReadiness } from '../routes/health';
import { register } from '../telemetry/metrics';

describe('Observability Subsystem (Logging, Metrics, Readiness)', () => {
  let app: express.Express;

  beforeEach(() => {
    delete process.env.__TEST_FORCE_DB_DOWN;
    delete process.env.__TEST_FORCE_REDIS_DOWN;

    app = express();
    app.use(express.json());
    app.use(requestLogger);
    registerHealthRoutes(app);
  });

  afterEach(() => {
    delete process.env.__TEST_FORCE_DB_DOWN;
    delete process.env.__TEST_FORCE_REDIS_DOWN;
  });

  it('generates and propagates x-request-id header across requests', async () => {
    // 1. When client provides an x-request-id, the server echoes it back
    const clientReqId = 'req-custom-trace-12345';
    const res1 = await request(app)
      .get('/api/health/live')
      .set('x-request-id', clientReqId);

    expect(res1.status).toBe(200);
    expect(res1.headers['x-request-id']).toBe(clientReqId);

    // 2. When client omits x-request-id, server generates a unique UUID
    const res2 = await request(app).get('/api/health/live');
    expect(res2.status).toBe(200);
    expect(res2.headers['x-request-id']).toBeDefined();
    expect(res2.headers['x-request-id'].length).toBeGreaterThanOrEqual(16);
  });

  it('redacts sensitive credentials in logs and error objects', () => {
    const input = {
      user: 'analyst@enterprise.com',
      authorization: 'Bearer eyJhbGciOi...',
      cookie: 'session=secretCookie',
      token: 'sensitive_jwt_token',
      secret: 'kms_secret',
      password: 'plain_password',
      api_key: 'txm_live_abcdef',
      refresh_token: '1//refresh_token_here'
    };

    const sanitized = redactSensitiveData(input);
    expect(sanitized.authorization).toBe('[REDACTED]');
    expect(sanitized.cookie).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.secret).toBe('[REDACTED]');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.api_key).toBe('[REDACTED]');
    expect(sanitized.refresh_token).toBe('[REDACTED]');
    expect(sanitized.user).toBe('analyst@enterprise.com');
  });

  it('readiness check returns 503 Service Unavailable when dependency is down', async () => {
    // Simulate database outage
    process.env.__TEST_FORCE_DB_DOWN = 'true';

    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.dependencies.database.status).toBe('down');
  });

  it('exposes Prometheus metrics endpoint at /metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('tracexmail_');
  });
});
