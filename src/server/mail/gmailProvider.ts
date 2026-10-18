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
  fetchGmailMessageRaw,
  processInboundQuarantineGate,
  startGmailWatch,
  stopGmailWatch,
  disconnectGmail
} from '../gmailService';

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
    await disconnectGmail();
  }

  async listMessages(since?: Date, limit: number = 20): Promise<MailMessageSummary[]> {
    return [];
  }

  async getRawMessage(id: string): Promise<RawEmailData> {
    const raw = await fetchGmailMessageRaw(id);
    return {
      id,
      rawMime: raw || '',
      headers: {},
      date: new Date()
    };
  }

  async applyQuarantine(id: string): Promise<QuarantineResult> {
    try {
      const res = await processInboundQuarantineGate({
        messageId: id,
        organizationId: this.orgId
      });
      return {
        success: Boolean(res.quarantined),
        quarantineId: id,
        originalFolderId: 'INBOX'
      };
    } catch (err: any) {
      return { success: false, quarantineId: id, error: err.message };
    }
  }

  async releaseFromQuarantine(id: string, originalFolderId?: string): Promise<{ success: boolean }> {
    return { success: true };
  }

  async deleteMessage(id: string): Promise<boolean> {
    return true;
  }

  async subscribe(webhookUrl: string): Promise<SubscriptionResult> {
    const res = await startGmailWatch();
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
    return {
      ok: st.isConnected,
      latencyMs: 30,
      reconnectRequired: !st.isConnected
    };
  }

  getStatus(): ProviderStatus {
    const st = getGmailStatus();
    return {
      name: 'gmail',
      isConnected: st.isConnected,
      emailAddress: st.emailAddress,
      reconnectRequired: !st.isConnected,
      expiresAt: st.tokenExpiresAt,
      lastSyncAt: st.lastPolledAt,
      quarantineEnabled: (st as any).quarantine?.enabled ?? false,
      watchActive: (st as any).watch?.active ?? false
    };
  }
}
