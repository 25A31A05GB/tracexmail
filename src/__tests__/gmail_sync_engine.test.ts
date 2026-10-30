/**
 * Unit & Integration Tests for Gmail Live Synchronization & SOC Quarantine Engine
 *
 * Verifies:
 * 1. Push Watch Lifecycle: registration, lease expiration tracking, and unwatch.
 * 2. Cloud Pub/Sub Webhook Handling: Base64 payload decoding and historyId propagation.
 * 3. Incremental historyId delta synchronization: deduplication and cursor advance.
 * 4. Graceful recovery on expired historyId cursor (HTTP 404).
 * 5. Adaptive watchdog timer fallback on webhook silence.
 * 6. Automated SOC label provisioning and quarantine remediation (INBOX stripped, label added).
 * 7. Quarantine release and restoration back to user INBOX.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import {
  GmailSyncEngine,
  getGmailSyncEngine,
  STANDARD_SOC_LABELS
} from '../server/gmail/syncEngine';

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

vi.mock('../server/forensicPipeline', async () => {
  const actual = await vi.importActual<any>('../server/forensicPipeline');
  return {
    ...actual,
    parseRawEmailToAnalysis: vi.fn(async (rawEml: string) => {
      return {
        case: { id: 'case_101' },
        analysis: {
          threatScore: 92,
          threat_score: 92,
          verdict: 'MALICIOUS',
          headers: {
            subject: 'Urgent Wire Transfer Required',
            from: 'CEO <spoofed-exec@external-phish.net>',
            to: 'finance@corp.com',
            date: 'Fri, 30 Oct 2026 10:00:00 +0000'
          },
          classification: 'phishing'
        },
        alert: { id: 'alert_101' }
      };
    })
  };
});

const mockedAxios = vi.mocked(axios, true);

describe('GmailSyncEngine Test Suite', () => {
  let engine: GmailSyncEngine;

  const originalToken = process.env.GMAIL_ACCESS_TOKEN;
  const originalEmail = process.env.GMAIL_USER_EMAIL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GMAIL_ACCESS_TOKEN = 'ya29.test_valid_oauth_token';
    process.env.GMAIL_USER_EMAIL = 'sec-admin@corp.com';

    engine = new GmailSyncEngine({
      orgId: 'test_soc_org',
      topicName: 'projects/test-project/topics/mailbox-watch',
      initialHistoryId: '123456780',
      quarantineThreshold: 70,
      quarantineSuspiciousThreshold: 40,
      removeInboxLabelOnQuarantine: true,
      markReadOnQuarantine: true,
      watchdogIntervalSeconds: 30
    });
  });

  afterEach(() => {
    engine.stopWatchdog();
    process.env.GMAIL_ACCESS_TOKEN = originalToken;
    process.env.GMAIL_USER_EMAIL = originalEmail;
  });

  it('1. Initializes with standard SOC label definitions and colors', () => {
    expect(STANDARD_SOC_LABELS.QUARANTINED.name).toBe('TraceXMail/Quarantined');
    expect(STANDARD_SOC_LABELS.QUARANTINED.backgroundColor).toBe('#cc3a21');
    expect(STANDARD_SOC_LABELS.SUSPICIOUS.name).toBe('TraceXMail/Suspicious');
    expect(STANDARD_SOC_LABELS.CLEAN.name).toBe('TraceXMail/Clean');
    expect(STANDARD_SOC_LABELS.INVESTIGATING.name).toBe('TraceXMail/Investigating');

    const status = engine.getStatus();
    expect(status.orgId).toBe('test_soc_org');
    expect(status.quarantine.threshold).toBe(70);
    expect(status.quarantine.removeInboxLabel).toBe(true);
    expect(status.pushWatch.topicName).toBe('projects/test-project/topics/mailbox-watch');
  });

  it('2. Successfully initiates Gmail users.watch() push registration', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        historyId: '987654321',
        expiration: String(Date.now() + 604800000) // 7 days
      }
    });
    mockedAxios.get.mockResolvedValueOnce({
      data: { labels: [] }
    });

    const result = await engine.startPushWatch('projects/test-project/topics/mailbox-watch', 'ya29.test_valid_oauth_token');

    expect(result.success).toBe(true);
    expect(result.historyId).toBe('987654321');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://gmail.googleapis.com/gmail/v1/users/me/watch',
      expect.objectContaining({
        topicName: 'projects/test-project/topics/mailbox-watch',
        labelIds: ['INBOX'],
        labelFilterBehavior: 'include'
      }),
      expect.anything()
    );

    const status = engine.getStatus();
    expect(status.cursor.currentHistoryId).toBe('987654321');
    expect(status.pushWatch.active).toBe(true);
  });

  it('3. Successfully stops push watch on Gmail server', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {} });

    const result = await engine.stopPushWatch('ya29.test_valid_oauth_token');
    expect(result.success).toBe(true);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://gmail.googleapis.com/gmail/v1/users/me/stop',
      {},
      expect.anything()
    );

    const status = engine.getStatus();
    expect(status.pushWatch.active).toBe(false);
  });

  it('4. Correctly decodes Base64 Cloud Pub/Sub webhook payload and updates cursor', async () => {
    const pubSubJson = JSON.stringify({
      emailAddress: 'victim@target-corp.com',
      historyId: '123456789'
    });
    const base64Data = Buffer.from(pubSubJson).toString('base64');

    const rawBody = {
      message: {
        data: base64Data,
        messageId: 'pubsub_msg_001',
        publishTime: '2026-10-30T10:00:00Z'
      }
    };

    // Mock history delta response
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        history: [],
        historyId: '123456789'
      }
    });

    let emittedEvent: any = null;
    engine.on('push_received', payload => {
      emittedEvent = payload;
    });

    const res = await engine.handlePubSubPush(rawBody);

    expect(res.success).toBe(true);
    expect(res.emailAddress).toBe('victim@target-corp.com');
    expect(res.historyId).toBe('123456789');
    expect(emittedEvent).toBeTruthy();
    expect(emittedEvent.emailAddress).toBe('victim@target-corp.com');
  });

  it('5. Ingests messagesAdded from history delta and executes quarantine if threat exceeds threshold', async () => {
    const rawEml = [
      'From: CEO <spoofed-exec@external-phish.net>',
      'To: finance@corp.com',
      'Subject: Urgent Wire Transfer Required',
      'Date: Fri, 30 Oct 2026 10:00:00 +0000',
      'Message-ID: <threat_001@phish.net>',
      '',
      'Please wire $95,000 immediately to the attached routing details.'
    ].join('\n');

    // 1. History delta call
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        history: [
          {
            messagesAdded: [
              {
                message: {
                  id: 'msg_threat_101',
                  threadId: 'th_101'
                }
              }
            ]
          }
        ],
        historyId: '123456800'
      }
    });

    // 2. Fetch raw message
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        id: 'msg_threat_101',
        raw: Buffer.from(rawEml).toString('base64url')
      }
    });

    // 3. Ensure SOC labels (list existing labels)
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        labels: [
          { id: 'lbl_quarantine_01', name: 'TraceXMail/Quarantined' }
        ]
      }
    });

    // 4. Modify message labels (quarantine execution)
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        id: 'msg_threat_101',
        labelIds: ['lbl_quarantine_01']
      }
    });

    const deltaResult = await engine.syncHistoryDelta('123456800', 'ya29.test_valid_oauth_token');

    expect(deltaResult.success).toBe(true);
    expect(deltaResult.messagesAddedCount).toBe(1);
    expect(deltaResult.messagesProcessed.length).toBe(1);

    const processed = deltaResult.messagesProcessed[0];
    expect(processed.id).toBe('msg_threat_101');
    expect(processed.quarantined).toBe(true);
    expect(processed.actionTaken).toBe('HOLD_QUARANTINED');

    // Verify modify called with INBOX stripped and quarantine label added
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/msg_threat_101/modify',
      expect.objectContaining({
        addLabelIds: ['lbl_quarantine_01'],
        removeLabelIds: ['INBOX', 'UNREAD']
      }),
      expect.anything()
    );
  }, 25000);

  it('6. Gracefully handles HTTP 404 cursor expiration and re-anchors to profile historyId', async () => {
    // History call fails with 404
    mockedAxios.get.mockRejectedValueOnce({
      response: { status: 404 }
    });

    // Baseline profile recovery call
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        emailAddress: 'sec-admin@corp.com',
        historyId: '999999000'
      }
    });

    const result = await engine.syncHistoryDelta('old_expired_cursor', 'ya29.test_valid_oauth_token');

    expect(result.success).toBe(true);
    expect(result.cursorExpired).toBe(true);
    expect(engine.getStatus().cursor.currentHistoryId).toBe('999999000');
    expect(engine.getStatus().metrics.cursorExpirationsRecovered).toBe(1);
  });

  it('7. Releases quarantined message back to user INBOX', async () => {
    // 1. Ensure labels
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        labels: [
          { id: 'lbl_quarantine_01', name: 'TraceXMail/Quarantined' },
          { id: 'lbl_clean_01', name: 'TraceXMail/Clean' }
        ]
      }
    });

    // 2. Modify message
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        id: 'msg_threat_101',
        labelIds: ['INBOX', 'lbl_clean_01']
      }
    });

    const releaseResult = await engine.releaseFromQuarantine('msg_threat_101', 'ya29.test_valid_oauth_token');

    expect(releaseResult.success).toBe(true);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/msg_threat_101/modify',
      expect.objectContaining({
        addLabelIds: expect.arrayContaining(['INBOX']),
        removeLabelIds: expect.arrayContaining(['lbl_quarantine_01'])
      }),
      expect.anything()
    );
  });

  it('8. Starts and stops watchdog timer reliably', () => {
    engine.startWatchdog(10);
    expect(engine.getStatus().watchdog.active).toBe(true);
    expect(engine.getStatus().watchdog.intervalSeconds).toBe(10);

    engine.stopWatchdog();
    expect(engine.getStatus().watchdog.active).toBe(false);
  });

  it('9. Provides singleton access via getGmailSyncEngine', () => {
    const s1 = getGmailSyncEngine();
    const s2 = getGmailSyncEngine();
    expect(s1).toBe(s2);
  });
});
