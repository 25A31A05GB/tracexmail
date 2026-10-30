import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { MicrosoftGraphProvider } from '../mail/microsoftGraphProvider';
import { GmailProvider } from '../mail/gmailProvider';
import {
  registerMailProvider,
  getMailProvider,
  listMailProvidersForOrg
} from '../mail/provider';
import { recordIdempotentGmailProcessing } from '../queue/index';

vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  };
  const mockAxios: any = vi.fn(() => Promise.resolve({ data: {} }));
  mockAxios.create = vi.fn(() => mockAxiosInstance);
  mockAxios.get = vi.fn();
  mockAxios.post = vi.fn();
  mockAxios.patch = vi.fn();
  mockAxios.delete = vi.fn();
  mockAxios.interceptors = {
    request: { use: vi.fn(), eject: vi.fn() },
    response: { use: vi.fn(), eject: vi.fn() },
  };
  return {
    default: mockAxios,
    ...mockAxios,
  };
});

describe('Microsoft 365 Mailbox Connector & Common MailProvider Interface', () => {
  let provider: MicrosoftGraphProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new MicrosoftGraphProvider('org-m365-test');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('implements the common MailProvider interface alongside Gmail', () => {
    const gmail = new GmailProvider('org-m365-test');
    registerMailProvider('org-m365-test', gmail);
    registerMailProvider('org-m365-test', provider);

    const lookupGmail = getMailProvider('org-m365-test', 'gmail');
    const lookupM365 = getMailProvider('org-m365-test', 'microsoft365');

    expect(lookupGmail?.name).toBe('gmail');
    expect(lookupM365?.name).toBe('microsoft365');

    const statuses = listMailProvidersForOrg('org-m365-test');
    expect(statuses.length).toBe(2);
    expect(statuses.some(s => s.name === 'microsoft365')).toBe(true);
    expect(statuses.some(s => s.name === 'gmail')).toBe(true);
  });

  it('creates and automatically renews Graph webhook change subscriptions', async () => {
    await provider.connect({
      orgId: 'org-m365-test',
      accessToken: 'mock_m365_access_token'
    });

    const mockSubId = 'sub_graph_12345';
    const futureExpiry = new Date(Date.now() + 4000 * 60 * 1000).toISOString();

    // 1. Mock create subscription
    (axios as any).mockResolvedValueOnce({
      data: {
        id: mockSubId,
        expirationDateTime: futureExpiry
      }
    });

    const sub = await provider.subscribe('https://app.tracexmail.com/api/mail/m365/webhook');
    expect(sub.subscriptionId).toBe(mockSubId);
    expect(sub.clientState).toBeDefined();

    // 2. Mock renew subscription
    const renewedExpiry = new Date(Date.now() + 4200 * 60 * 1000).toISOString();
    (axios as any).mockResolvedValueOnce({
      data: {
        id: mockSubId,
        expirationDateTime: renewedExpiry
      }
    });

    const renewed = await provider.renewSubscription!(mockSubId);
    expect(renewed.subscriptionId).toBe(mockSubId);
    expect(renewed.expiresAt.toISOString()).toBe(renewedExpiry);
  });

  it('handles Microsoft Graph 429 throttling with Retry-After backoff', async () => {
    await provider.connect({
      orgId: 'org-m365-test',
      accessToken: 'mock_m365_access_token'
    });

    // First call returns 429 with Retry-After: 0
    (axios as any)
      .mockRejectedValueOnce({
        response: {
          status: 429,
          headers: { 'retry-after': '0' }
        }
      })
      // Second call succeeds
      .mockResolvedValueOnce({
        data: {
          value: [{ id: 'msg_1', subject: 'Urgent Wire', from: { emailAddress: { address: 'bad@evil.com' } } }]
        }
      });

    const messages = await provider.listMessages();
    expect(messages.length).toBe(1);
    expect(messages[0].id).toBe('msg_1');
    expect(axios).toHaveBeenCalledTimes(2);
  });

  it('fetches raw MIME RFC 822 message for forensic header analysis', async () => {
    await provider.connect({
      orgId: 'org-m365-test',
      accessToken: 'mock_m365_access_token'
    });

    const rawRfc822 = 'From: attacker@phish.com\nTo: victim@company.com\nSubject: Password Reset\n\nReset now';
    (axios as any).mockResolvedValueOnce({
      data: rawRfc822
    });

    const raw = await provider.getRawMessage('msg_raw_777');
    expect(raw.rawMime).toBe(rawRfc822);
    expect(raw.id).toBe('msg_raw_777');
  });

  it('performs quarantine and release round trip in M365', async () => {
    await provider.connect({
      orgId: 'org-m365-test',
      accessToken: 'mock_m365_access_token',
      quarantineEnabled: true
    });

    // Mock 1: get original parent folder
    (axios as any).mockResolvedValueOnce({
      data: { parentFolderId: 'folder_inbox_id' }
    });
    // Mock 2: search for quarantine folder (returns empty to trigger creation)
    (axios as any).mockResolvedValueOnce({
      data: { value: [] }
    });
    // Mock 3: create TraceXMail-Quarantine folder
    (axios as any).mockResolvedValueOnce({
      data: { id: 'folder_quarantine_id', displayName: 'TraceXMail-Quarantine' }
    });
    // Mock 4: move message to quarantine
    (axios as any).mockResolvedValueOnce({
      data: { id: 'moved_msg_id' }
    });

    const qResult = await provider.applyQuarantine('msg_to_quarantine_99');
    expect(qResult.success).toBe(true);
    expect(qResult.originalFolderId).toBe('folder_inbox_id');

    // Release mock: move back to folder_inbox_id
    (axios as any).mockResolvedValueOnce({
      data: { id: 'restored_msg_id' }
    });

    const releaseResult = await provider.releaseFromQuarantine('moved_msg_id', qResult.originalFolderId);
    expect(releaseResult.success).toBe(true);
  });

  it('enforces idempotent processing for mailbox messages', () => {
    const isFirst = recordIdempotentGmailProcessing('m365_msg_1001', 'rev_1');
    expect(isFirst).toBe(true);

    const isDuplicate = recordIdempotentGmailProcessing('m365_msg_1001', 'rev_1');
    expect(isDuplicate).toBe(false);
  });
});
