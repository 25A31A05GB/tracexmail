import axios, { AxiosInstance, AxiosError } from 'axios';
import crypto from 'crypto';
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
import { encrypt, decrypt, isEncrypted } from '../crypto/encryption';
import { logger } from '../logger';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

export interface M365TokenState {
  accessTokenEncrypted?: string;
  refreshTokenEncrypted?: string;
  expiresAt: number;
  tenantId?: string;
  clientId?: string;
  clientSecretEncrypted?: string;
  emailAddress?: string;
}

export class MicrosoftGraphProvider implements MailProvider {
  public readonly name = 'microsoft365' as const;
  public readonly orgId: string;

  private isConnected: boolean = false;
  private reconnectRequired: boolean = false;
  private quarantineEnabled: boolean = false;
  private quarantineFolderName: string = 'TraceXMail-Quarantine';
  private quarantineFolderId: string | null = null;
  private emailAddress: string = '';

  private tokenState: M365TokenState = {
    expiresAt: 0
  };

  private activeSubscriptions = new Map<string, { id: string; expiresAt: Date; clientState: string }>();

  constructor(orgId: string = 'default-org') {
    this.orgId = orgId;
  }

  /**
   * Connect with OAuth authorization code, refresh token, or client credentials.
   */
  async connect(config: ProviderConfig): Promise<boolean> {
    this.quarantineEnabled = config.quarantineEnabled ?? false;
    if (config.quarantineFolderName) {
      this.quarantineFolderName = config.quarantineFolderName;
    }
    if (config.emailAddress) {
      this.emailAddress = config.emailAddress;
    }

    if (config.accessToken) {
      this.tokenState.accessTokenEncrypted = encrypt(config.accessToken);
      this.tokenState.expiresAt = Date.now() + 3600 * 1000;
      this.isConnected = true;
      this.reconnectRequired = false;
    }

    if (config.refreshToken) {
      this.tokenState.refreshTokenEncrypted = encrypt(config.refreshToken);
    }

    if (config.tenantId) this.tokenState.tenantId = config.tenantId;
    if (config.clientId) this.tokenState.clientId = config.clientId;
    if (config.clientSecret) {
      this.tokenState.clientSecretEncrypted = encrypt(config.clientSecret);
    }

    // If client credentials provided, perform initial token exchange
    if (this.tokenState.tenantId && this.tokenState.clientId && this.tokenState.clientSecretEncrypted) {
      try {
        await this.refreshAccessToken();
        this.isConnected = true;
        this.reconnectRequired = false;
      } catch (err: any) {
        logger.error({ error: err.message }, 'Failed M365 client credentials token exchange');
        this.isConnected = false;
        this.reconnectRequired = true;
        return false;
      }
    }

    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.tokenState = { expiresAt: 0 };
    this.activeSubscriptions.clear();
    logger.info({ orgId: this.orgId }, 'Disconnected M365 provider');
  }

  /**
   * Returns a valid decrypted access token, automatically refreshing if expired or expiring soon.
   */
  public async getValidAccessToken(): Promise<string> {
    const now = Date.now();
    // Refresh 5 minutes before expiration
    if (now >= this.tokenState.expiresAt - 5 * 60 * 1000) {
      await this.refreshAccessToken();
    }

    if (!this.tokenState.accessTokenEncrypted) {
      throw new Error('M365 Access token not configured. Reconnect required.');
    }

    return decrypt(this.tokenState.accessTokenEncrypted);
  }

  /**
   * Refreshes access token via OAuth refresh_token or client_credentials.
   */
  public async refreshAccessToken(): Promise<void> {
    // 1. Client Credentials flow (tenant-wide deployment)
    if (this.tokenState.tenantId && this.tokenState.clientId && this.tokenState.clientSecretEncrypted) {
      const secret = decrypt(this.tokenState.clientSecretEncrypted);
      const tokenUrl = `https://login.microsoftonline.com/${this.tokenState.tenantId}/oauth2/v2.0/token`;

      const scopes = this.quarantineEnabled
        ? 'https://graph.microsoft.com/.default'
        : 'https://graph.microsoft.com/.default';

      try {
        const res = await axios.post(
          tokenUrl,
          new URLSearchParams({
            client_id: this.tokenState.clientId,
            client_secret: secret,
            grant_type: 'client_credentials',
            scope: scopes
          }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        this.tokenState.accessTokenEncrypted = encrypt(res.data.access_token);
        this.tokenState.expiresAt = Date.now() + (res.data.expires_in || 3600) * 1000;
        this.isConnected = true;
        this.reconnectRequired = false;
        return;
      } catch (err: any) {
        if (err.response?.status === 400 || err.response?.status === 401) {
          this.reconnectRequired = true;
        }
        throw new Error(`M365 client_credentials refresh failed: ${err.message}`);
      }
    }

    // 2. User Mailbox Refresh Token flow
    if (this.tokenState.refreshTokenEncrypted && this.tokenState.clientId) {
      const refreshToken = decrypt(this.tokenState.refreshTokenEncrypted);
      const tenant = this.tokenState.tenantId || 'common';
      const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

      const scopes = [
        'offline_access',
        this.quarantineEnabled ? 'Mail.ReadWrite' : 'Mail.Read'
      ].join(' ');

      try {
        const res = await axios.post(
          tokenUrl,
          new URLSearchParams({
            client_id: this.tokenState.clientId,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            scope: scopes
          }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        this.tokenState.accessTokenEncrypted = encrypt(res.data.access_token);
        if (res.data.refresh_token) {
          this.tokenState.refreshTokenEncrypted = encrypt(res.data.refresh_token);
        }
        this.tokenState.expiresAt = Date.now() + (res.data.expires_in || 3600) * 1000;
        this.isConnected = true;
        this.reconnectRequired = false;
        return;
      } catch (err: any) {
        if (err.response?.data?.error === 'invalid_grant' || err.response?.status === 400) {
          this.reconnectRequired = true;
          logger.warn({ orgId: this.orgId }, 'M365 consent revoked or refresh token expired; reconnect required');
        }
        throw new Error(`M365 refresh token exchange failed: ${err.message}`);
      }
    }

    throw new Error('Insufficient credentials configured to refresh M365 token');
  }

  /**
   * HTTP client helper with automatic throttling retry (429 Retry-After)
   */
  public async requestGraph<T>(config: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    url: string;
    data?: any;
    headers?: Record<string, string>;
    responseType?: any;
  }): Promise<T> {
    const token = await this.getValidAccessToken();
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const res = await axios({
          method: config.method,
          url: config.url.startsWith('http') ? config.url : `${GRAPH_BASE_URL}${config.url}`,
          data: config.data,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(config.headers || {})
          },
          responseType: config.responseType
        });
        return res.data;
      } catch (err: any) {
        const axiosErr = err as AxiosError;
        // Handle Graph 429 Throttling
        if (axiosErr.response?.status === 429 && attempts < maxAttempts) {
          const retryAfterSec = parseInt(axiosErr.response.headers['retry-after'] || '2', 10);
          logger.warn({ retryAfterSec, attempt: attempts }, 'Graph API 429 throttled. Backing off...');
          await new Promise(r => setTimeout(r, (retryAfterSec || 2) * 1000));
          continue;
        }

        // Handle Revoked Consent / 401
        if (axiosErr.response?.status === 401) {
          this.reconnectRequired = true;
          logger.warn('Graph API 401 Unauthorized; reconnect required');
        }

        throw err;
      }
    }

    throw new Error('Graph request exceeded retry attempts');
  }

  /**
   * Lists messages with pagination and optional delta-query fallback.
   */
  async listMessages(since?: Date, limit: number = 25): Promise<MailMessageSummary[]> {
    let url = `/me/messages?$top=${limit}&$select=id,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview,parentFolderId&$orderby=receivedDateTime desc`;
    if (since) {
      url += `&$filter=receivedDateTime ge ${since.toISOString()}`;
    }

    const data: any = await this.requestGraph({ method: 'GET', url });
    const messages = data?.value || [];

    return messages.map((m: any) => ({
      id: m.id,
      threadId: m.conversationId,
      from: m.from?.emailAddress?.address || '',
      to: (m.toRecipients || []).map((r: any) => r.emailAddress?.address || ''),
      subject: m.subject || '',
      date: new Date(m.receivedDateTime),
      snippet: m.bodyPreview,
      folderId: m.parentFolderId
    }));
  }

  /**
   * Fetches raw RFC 822 MIME message using /$value endpoint.
   */
  async getRawMessage(id: string): Promise<RawEmailData> {
    const rawMime = await this.requestGraph<string>({
      method: 'GET',
      url: `/me/messages/${id}/$value`,
      responseType: 'text'
    });

    return {
      id,
      rawMime,
      headers: {},
      date: new Date()
    };
  }

  /**
   * Ensures the TraceXMail-Quarantine folder exists.
   */
  private async ensureQuarantineFolder(): Promise<string> {
    if (this.quarantineFolderId) return this.quarantineFolderId;

    try {
      const folders: any = await this.requestGraph({
        method: 'GET',
        url: `/me/mailFolders?$filter=displayName eq '${this.quarantineFolderName}'`
      });

      if (folders.value && folders.value.length > 0) {
        this.quarantineFolderId = folders.value[0].id;
        return this.quarantineFolderId!;
      }

      // Create folder
      const created: any = await this.requestGraph({
        method: 'POST',
        url: '/me/mailFolders',
        data: { displayName: this.quarantineFolderName }
      });

      this.quarantineFolderId = created.id;
      return this.quarantineFolderId!;
    } catch (err: any) {
      logger.error({ error: err.message }, 'Failed ensuring quarantine folder in M365');
      throw err;
    }
  }

  /**
   * Quarantines message by moving it to the dedicated TraceXMail-Quarantine folder.
   */
  async applyQuarantine(id: string): Promise<QuarantineResult> {
    try {
      // 1. Fetch current folder for restoration record
      const message: any = await this.requestGraph({
        method: 'GET',
        url: `/me/messages/${id}?$select=parentFolderId`
      });
      const originalFolderId = message.parentFolderId || 'inbox';

      // 2. Ensure quarantine folder
      const destFolderId = await this.ensureQuarantineFolder();

      // 3. Move message
      const moved: any = await this.requestGraph({
        method: 'POST',
        url: `/me/messages/${id}/move`,
        data: { destinationId: destFolderId }
      });

      logger.info({ messageId: id, movedId: moved.id, originalFolderId }, 'M365 message moved to quarantine');

      return {
        success: true,
        quarantineId: moved.id || id,
        originalFolderId
      };
    } catch (err: any) {
      logger.error({ id, error: err.message }, 'Failed to quarantine M365 message');
      return { success: false, quarantineId: id, error: err.message };
    }
  }

  /**
   * Releases message back to original folder.
   */
  async releaseFromQuarantine(id: string, originalFolderId: string = 'inbox'): Promise<{ success: boolean }> {
    try {
      await this.requestGraph({
        method: 'POST',
        url: `/me/messages/${id}/move`,
        data: { destinationId: originalFolderId }
      });
      logger.info({ id, originalFolderId }, 'Released M365 message from quarantine');
      return { success: true };
    } catch (err: any) {
      logger.error({ id, error: err.message }, 'Failed to release M365 message');
      return { success: false };
    }
  }

  async deleteMessage(id: string): Promise<boolean> {
    try {
      await this.requestGraph({ method: 'DELETE', url: `/me/messages/${id}` });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Creates a webhook subscription with validation and clientState security.
   */
  async subscribe(webhookUrl: string): Promise<SubscriptionResult> {
    const clientState = crypto.randomBytes(16).toString('hex');
    // Graph subscriptions for mail max 4230 minutes (~2.9 days)
    const expirationDateTime = new Date(Date.now() + 4200 * 60 * 1000).toISOString();

    const payload = {
      changeType: 'created',
      notificationUrl: webhookUrl,
      resource: '/me/mailFolders(\'Inbox\')/messages',
      expirationDateTime,
      clientState
    };

    const res: any = await this.requestGraph({
      method: 'POST',
      url: '/subscriptions',
      data: payload
    });

    const subResult: SubscriptionResult = {
      subscriptionId: res.id,
      expiresAt: new Date(res.expirationDateTime),
      clientState
    };

    this.activeSubscriptions.set(res.id, {
      id: res.id,
      expiresAt: subResult.expiresAt,
      clientState
    });

    logger.info({ subId: res.id, expiresAt: res.expirationDateTime }, 'Created M365 webhook subscription');
    return subResult;
  }

  /**
   * Automatically renews subscription before expiration.
   */
  async renewSubscription(subscriptionId: string): Promise<SubscriptionResult> {
    const newExpiration = new Date(Date.now() + 4200 * 60 * 1000).toISOString();

    const res: any = await this.requestGraph({
      method: 'PATCH',
      url: `/subscriptions/${subscriptionId}`,
      data: { expirationDateTime: newExpiration }
    });

    const renewed: SubscriptionResult = {
      subscriptionId,
      expiresAt: new Date(res.expirationDateTime)
    };

    const existing = this.activeSubscriptions.get(subscriptionId);
    if (existing) {
      existing.expiresAt = renewed.expiresAt;
    }

    logger.info({ subscriptionId, newExpiration }, 'Renewed M365 webhook subscription');
    return renewed;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    try {
      await this.requestGraph({ method: 'DELETE', url: `/subscriptions/${subscriptionId}` });
      this.activeSubscriptions.delete(subscriptionId);
    } catch (err: any) {
      logger.warn({ subscriptionId, error: err.message }, 'Failed deleting M365 subscription');
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    if (!this.isConnected) {
      return { ok: false, latencyMs: 0, reconnectRequired: this.reconnectRequired };
    }

    const start = Date.now();
    try {
      await this.requestGraph({ method: 'GET', url: '/me?$select=id,mail,userPrincipalName' });
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        reconnectRequired: this.reconnectRequired,
        error: err.message
      };
    }
  }

  getStatus(): ProviderStatus {
    return {
      name: 'microsoft365',
      isConnected: this.isConnected,
      emailAddress: this.emailAddress,
      reconnectRequired: this.reconnectRequired,
      expiresAt: this.tokenState.expiresAt,
      quarantineEnabled: this.quarantineEnabled,
      watchActive: this.activeSubscriptions.size > 0
    };
  }
}
