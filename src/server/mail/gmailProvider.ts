import {
  MailProvider,
  ProviderConfig,
  ProviderStatus,
  ProviderHealth,
  MailMessageSummary,
  RawEmailData,
  QuarantineResult,
  SubscriptionResult
} from './provider';
import {
  getGmailStatus,
  quarantineMessage,
  releaseFromQuarantine as gmailReleaseQuarantine,
  deleteGmailMessage,
  fetchRawMessageDirect,
  testGmailConnection,
  setupGmailWatch,
  stopGmailWatch
} from '../gmailService';
import { logger } from '../logger';

export class GmailProvider implements MailProvider {
  public readonly name = 'gmail' as const;
  public readonly orgId: string;

  constructor(orgId: string = 'default-org') {
    this.orgId = orgId;
  }

  async connect(config: ProviderConfig): Promise<boolean> {
    const health = await this.healthCheck();
    return health.ok;
  }

  async disconnect(): Promise<void> {
    await stopGmailWatch();
  }

  async listMessages(since?: Date, limit: number = 20): Promise<MailMessageSummary[]> {
    return [];
  }

  async getRawMessage(id: string): Promise<RawEmailData> {
    const raw = await fetchRawMessageDirect(id);
    return {
      id,
      rawMime: raw || '',
      headers: {},
      date: new Date()
    };
  }

  async applyQuarantine(id: string): Promise<QuarantineResult> {
    try {
      const res = await quarantineMessage(id);
      return {
        success: res.success,
        quarantineId: id,
        originalFolderId: 'INBOX'
      };
    } catch (err: any) {
      return { success: false, quarantineId: id, error: err.message };
    }
  }

  async releaseFromQuarantine(id: string, originalFolderId?: string): Promise<{ success: boolean }> {
    try {
      const res = await gmailReleaseQuarantine(id);
      return { success: res.success };
    } catch {
      return { success: false };
    }
  }

  async deleteMessage(id: string): Promise<boolean> {
    return deleteGmailMessage(id);
  }

  async subscribe(webhookUrl: string): Promise<SubscriptionResult> {
    const res = await setupGmailWatch();
    return {
      subscriptionId: res.historyId || 'gmail_watch',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    await stopGmailWatch();
  }

  async healthCheck(): Promise<ProviderHealth> {
    const st = getGmailStatus();
    if (!st.isConnected) {
      return { ok: false, latencyMs: 0, reconnectRequired: true };
    }
    const test = await testGmailConnection();
    return {
      ok: test.ok,
      latencyMs: test.latencyMs || 50,
      reconnectRequired: !test.ok,
      error: test.error
    };
  }

  getStatus(): ProviderStatus {
    const st = getGmailStatus();
    return {
      name: 'gmail',
      isConnected: st.isConnected,
      emailAddress: st.emailAddress,
      reconnectRequired: st.reconnectRequired || !st.isConnected,
      expiresAt: st.tokenExpiresAt,
      lastSyncAt: st.lastPolledAt,
      quarantineEnabled: (st as any).quarantine?.enabled ?? false,
      watchActive: (st as any).watch?.active ?? false
    };
  }
}
