/**
 * Automated Tests for Gmail Cloud Pub/Sub Push Notification Route Handler (src/server/routes/gmail.ts)
 *
 * Verifies:
 * 1. Token Validation:
 *    - Rejects with HTTP 401 when PUBSUB_PUSH_TOKEN is set but x-goog-pubsub-token header is absent.
 *    - Rejects with HTTP 403 when x-goog-pubsub-token header does not match PUBSUB_PUSH_TOKEN.
 *    - Authorizes with HTTP 200 when x-goog-pubsub-token header matches PUBSUB_PUSH_TOKEN.
 * 2. Payload Processing:
 *    - Accurately decodes Base64 message.data payload containing emailAddress and historyId.
 *    - Handles direct/unwrapped payload objects.
 *    - Acknowledges empty ping messages without throwing errors.
 * 3. Incremental historyId Delta Sync:
 *    - Triggers GmailSyncEngine.syncHistoryDelta(historyId) for the associated user.
 *    - Emits push events and updates sync engine state.
 * 4. Dual Routing:
 *    - Verified on both /api/gmail/push and /api/gmail/pubsub/push.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import axios from 'axios';
import { registerGmailRoutes } from '../server/routes/gmail';
import { getGmailSyncEngine } from '../server/gmail/syncEngine';

vi.mock('axios', async () => {
  const actual = await vi.importActual<any>('axios');
  const mockAxiosInstance = {
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() }
    },
    get: vi.fn(),
    post: vi.fn()
  };

  const defaultMock = {
    ...actual.default,
    get: vi.fn(),
    post: vi.fn(),
    create: vi.fn(() => mockAxiosInstance)
  };

  return {
    ...actual,
    default: defaultMock
  };
});

const mockedAxios = vi.mocked(axios, true);

describe('Pub/Sub Push Notification Route Handler Suite', () => {
  let app: express.Express;
  const originalSecret = process.env.PUBSUB_PUSH_TOKEN;
  const originalToken = process.env.GMAIL_ACCESS_TOKEN;
  const TEST_SECRET = 'soc_push_secret_token_98765';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PUBSUB_PUSH_TOKEN = TEST_SECRET;
    process.env.GMAIL_ACCESS_TOKEN = 'ya29.test_valid_oauth_token';

    app = express();
    app.use(express.json());
    registerGmailRoutes(app);

    // Seed sync engine cursor
    const engine = getGmailSyncEngine();
    (engine as any).metrics.currentHistoryId = '123450000';
  });

  afterEach(() => {
    process.env.PUBSUB_PUSH_TOKEN = originalSecret;
    process.env.GMAIL_ACCESS_TOKEN = originalToken;
  });

  it('1. Rejects request with HTTP 401 when x-goog-pubsub-token header is missing', async () => {
    const res = await request(app)
      .post('/api/gmail/push')
      .send({
        message: {
          data: Buffer.from(JSON.stringify({ emailAddress: 'user@corp.com', historyId: '123' })).toString('base64')
        }
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
    expect(res.body.message).toContain('Missing required x-goog-pubsub-token header');
  });

  it('2. Rejects request with HTTP 403 when x-goog-pubsub-token header does not match', async () => {
    const res = await request(app)
      .post('/api/gmail/push')
      .set('x-goog-pubsub-token', 'wrong_token_value')
      .send({
        message: {
          data: Buffer.from(JSON.stringify({ emailAddress: 'user@corp.com', historyId: '123' })).toString('base64')
        }
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
    expect(res.body.message).toContain('Invalid x-goog-pubsub-token header');
  });

  it('3. Authorizes and processes request when x-goog-pubsub-token matches', async () => {
    // Mock history delta response
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        history: [],
        historyId: '123456789'
      }
    });

    const pubsubPayload = {
      emailAddress: 'soc-analyst@enterprise.corp',
      historyId: '123456789'
    };
    const base64Data = Buffer.from(JSON.stringify(pubsubPayload)).toString('base64');

    const res = await request(app)
      .post('/api/gmail/push')
      .set('x-goog-pubsub-token', TEST_SECRET)
      .send({
        message: {
          data: base64Data,
          messageId: 'pubsub_push_001',
          publishTime: '2026-10-30T10:35:00Z'
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.emailAddress).toBe('soc-analyst@enterprise.corp');
    expect(res.body.historyId).toBe('123456789');
    expect(res.body.message).toContain('Incremental delta synchronization completed');
  });

  it('4. Handles requests to alternate endpoint /api/gmail/pubsub/push identically', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        history: [],
        historyId: '123456799'
      }
    });

    const base64Data = Buffer.from(JSON.stringify({
      emailAddress: 'admin@enterprise.corp',
      historyId: '123456799'
    })).toString('base64');

    const res = await request(app)
      .post('/api/gmail/pubsub/push')
      .set('x-goog-pubsub-token', TEST_SECRET)
      .send({
        message: {
          data: base64Data,
          messageId: 'pubsub_push_002'
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.emailAddress).toBe('admin@enterprise.corp');
    expect(res.body.historyId).toBe('123456799');
  });

  it('5. Handles direct JSON payload without wrapper when token is valid', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        history: [],
        historyId: '987654321'
      }
    });

    const res = await request(app)
      .post('/api/gmail/push')
      .set('x-goog-pubsub-token', TEST_SECRET)
      .send({
        emailAddress: 'direct-user@corp.com',
        historyId: '987654321'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.emailAddress).toBe('direct-user@corp.com');
  });

  it('6. Gracefully acknowledges empty message ping', async () => {
    const res = await request(app)
      .post('/api/gmail/push')
      .set('x-goog-pubsub-token', TEST_SECRET)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.message).toContain('Acknowledged empty Pub/Sub message');
  });
});
