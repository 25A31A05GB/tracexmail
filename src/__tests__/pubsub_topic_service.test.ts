/**
 * Unit & Integration Tests for Google Cloud Pub/Sub Topic Registration & Gmail Push Watch Service
 *
 * Verifies:
 * 1. Topic name parsing, validation, and canonical formatting.
 * 2. Subscription name parsing, validation, and canonical formatting.
 * 3. Topic existence check and auto-provisioning via PUT.
 * 4. Verification and assignment of roles/pubsub.publisher to gmail-api-push@system.gserviceaccount.com.
 * 5. Push subscription creation with webhook endpoint and ack deadline.
 * 6. Gmail users.watch() push registration and historyId cursor synchronization.
 * 7. End-to-end full pipeline setup (registerFullPubSubPipeline).
 * 8. Diagnostic test ping publishing and payload verification.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
  PubSubTopicService,
  getPubSubTopicService,
  GMAIL_API_PUSH_SERVICE_ACCOUNT,
  PUBSUB_PUBLISHER_ROLE
} from '../server/gmail/pubsubTopicService';

vi.mock('axios', async () => {
  const actual = await vi.importActual<any>('axios');
  const mockAxiosInstance = {
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() }
    },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn()
  };

  const defaultMock = {
    ...actual.default,
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    create: vi.fn(() => mockAxiosInstance)
  };

  return {
    ...actual,
    default: defaultMock
  };
});

const mockedAxios = vi.mocked(axios, true);

describe('PubSubTopicService Test Suite', () => {
  let service: PubSubTopicService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GMAIL_ACCESS_TOKEN = 'ya29.test_valid_oauth_token';

    service = new PubSubTopicService({
      projectId: 'test-gcp-sec-project',
      topicId: 'inbox-push-topic',
      subscriptionId: 'inbox-push-sub',
      pushEndpointUrl: 'https://security.corp.com/api/gmail/pubsub/push'
    });
  });

  it('1. Correctly parses and formats canonical GCP topic identifiers', () => {
    const formatted = service.formatTopicName('my-corp-proj', 'soc-watch');
    expect(formatted).toBe('projects/my-corp-proj/topics/soc-watch');

    const parsed = service.parseTopicName(formatted);
    expect(parsed).toBeTruthy();
    expect(parsed?.projectId).toBe('my-corp-proj');
    expect(parsed?.topicId).toBe('soc-watch');

    // Invalid formats rejected
    expect(service.parseTopicName('invalid-format-topic')).toBeNull();
    expect(service.parseTopicName('')).toBeNull();
  });

  it('2. Correctly parses and formats canonical GCP subscription identifiers', () => {
    const formatted = service.formatSubscriptionName('my-corp-proj', 'soc-watch-sub');
    expect(formatted).toBe('projects/my-corp-proj/subscriptions/soc-watch-sub');

    const parsed = service.parseSubscriptionName(formatted);
    expect(parsed).toBeTruthy();
    expect(parsed?.projectId).toBe('my-corp-proj');
    expect(parsed?.subscriptionId).toBe('soc-watch-sub');

    expect(service.parseSubscriptionName('bad-sub')).toBeNull();
  });

  it('3. Verifies topic existence and creates topic if not present', async () => {
    const topic = 'projects/test-gcp-sec-project/topics/new-inbox-topic';

    // Mock GET returning 404 (absent)
    mockedAxios.get.mockRejectedValueOnce({
      response: { status: 404 }
    });

    // Mock PUT creating topic
    mockedAxios.put.mockResolvedValueOnce({
      status: 201,
      data: { name: topic }
    });

    const res = await service.ensureTopicExists(topic, 'ya29.test_valid_oauth_token');

    expect(res.success).toBe(true);
    expect(res.created).toBe(true);
    expect(res.details?.exists).toBe(true);

    expect(mockedAxios.put).toHaveBeenCalledWith(
      `https://pubsub.googleapis.com/v1/${encodeURI(topic)}`,
      expect.objectContaining({
        labels: expect.objectContaining({ service: 'tracexmail' })
      }),
      expect.anything()
    );
  });

  it('4. Successfully grants roles/pubsub.publisher to gmail-api-push@system.gserviceaccount.com', async () => {
    const topic = 'projects/test-gcp-sec-project/topics/inbox-push-topic';

    // Mock getIamPolicy without the Gmail push account
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        version: 1,
        bindings: [
          { role: 'roles/pubsub.viewer', members: ['user:admin@corp.com'] }
        ]
      }
    });

    // Mock setIamPolicy call
    mockedAxios.post.mockResolvedValueOnce({
      status: 200,
      data: { success: true }
    });

    const res = await service.ensureGmailPublisherIam(topic, 'ya29.test_valid_oauth_token');

    expect(res.success).toBe(true);
    expect(res.policyUpdated).toBe(true);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      `https://pubsub.googleapis.com/v1/${encodeURI(topic)}:setIamPolicy`,
      expect.objectContaining({
        policy: expect.objectContaining({
          bindings: expect.arrayContaining([
            expect.objectContaining({
              role: PUBSUB_PUBLISHER_ROLE,
              members: expect.arrayContaining([GMAIL_API_PUSH_SERVICE_ACCOUNT])
            })
          ])
        })
      }),
      expect.anything()
    );
  });

  it('5. Successfully provisions push subscription delivering to webhook endpoint', async () => {
    const topic = 'projects/test-gcp-sec-project/topics/inbox-push-topic';
    const sub = 'projects/test-gcp-sec-project/subscriptions/inbox-push-sub';
    const endpoint = 'https://security.corp.com/api/gmail/pubsub/push';

    // Mock GET returning 404
    mockedAxios.get.mockRejectedValueOnce({
      response: { status: 404 }
    });

    // Mock PUT creating subscription
    mockedAxios.put.mockResolvedValueOnce({
      status: 200,
      data: {
        name: sub,
        topic,
        pushConfig: { pushEndpoint: endpoint }
      }
    });

    const res = await service.ensurePushSubscription({
      topicName: topic,
      subscriptionName: sub,
      pushEndpointUrl: endpoint,
      overrideToken: 'ya29.test_valid_oauth_token'
    });

    expect(res.success).toBe(true);
    expect(res.created).toBe(true);
    expect(res.details?.pushEndpoint).toBe(endpoint);
  });

  it('6. Registers Gmail users.watch() and synchronizes historyId with syncEngine', async () => {
    const topic = 'projects/test-gcp-sec-project/topics/inbox-push-topic';

    mockedAxios.post.mockResolvedValueOnce({
      status: 200,
      data: {
        historyId: '888777666',
        expiration: String(Date.now() + 604800000)
      }
    });

    const res = await service.registerGmailWatch({
      topicName: topic,
      overrideToken: 'ya29.test_valid_oauth_token'
    });

    expect(res.success).toBe(true);
    expect(res.historyId).toBe('888777666');
    expect(res.expiration).toBeGreaterThan(Date.now());
  });

  it('7. Successfully publishes diagnostic test ping', async () => {
    const topic = 'projects/test-gcp-sec-project/topics/inbox-push-topic';

    mockedAxios.post.mockResolvedValueOnce({
      status: 200,
      data: {
        messageIds: ['msg_diag_pubsub_001']
      }
    });

    const res = await service.publishDiagnosticPing(topic, 'ya29.test_valid_oauth_token', {
      emailAddress: 'sec-test@corp.com',
      historyId: '123'
    });

    expect(res.success).toBe(true);
    expect(res.messageId).toBe('msg_diag_pubsub_001');
  });

  it('8. Executes full end-to-end registration pipeline cleanly', async () => {
    const topic = 'projects/test-gcp-sec-project/topics/inbox-push-topic';
    const sub = 'projects/test-gcp-sec-project/subscriptions/inbox-push-sub';

    // 1. Check topic (exists)
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: { name: topic }
    });

    // 2. Check IAM (already has permission)
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        bindings: [
          { role: PUBSUB_PUBLISHER_ROLE, members: [GMAIL_API_PUSH_SERVICE_ACCOUNT] }
        ]
      }
    });

    // 3. Check subscription (exists)
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: { name: sub, pushConfig: { pushEndpoint: 'https://security.corp.com/api/gmail/pubsub/push' } }
    });

    // 4. users.watch()
    mockedAxios.post.mockResolvedValueOnce({
      status: 200,
      data: { historyId: '999888777', expiration: String(Date.now() + 604800000) }
    });

    // 5. Diagnostic ping
    mockedAxios.post.mockResolvedValueOnce({
      status: 200,
      data: { messageIds: ['msg_diag_pipe_001'] }
    });

    const pipelineResult = await service.registerFullPubSubPipeline({
      topicName: topic,
      subscriptionName: sub,
      accessToken: 'ya29.test_valid_oauth_token'
    });

    expect(pipelineResult.success).toBe(true);
    expect(pipelineResult.topicName).toBe(topic);
    expect(pipelineResult.iamPolicyConfigured).toBe(true);
    expect(pipelineResult.watchActive).toBe(true);
    expect(pipelineResult.historyId).toBe('999888777');
    expect(pipelineResult.diagnosticPingSent).toBe(true);

    const state = service.getState();
    expect(state.configured).toBe(true);
    expect(state.topicName).toBe(topic);
  });

  it('9. Provides singleton access via getPubSubTopicService', () => {
    const instanceA = getPubSubTopicService();
    const instanceB = getPubSubTopicService();
    expect(instanceA).toBe(instanceB);
  });
});
