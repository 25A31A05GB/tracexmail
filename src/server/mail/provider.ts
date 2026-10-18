export interface MailMessageSummary {
  id: string;
  threadId?: string;
  from: string;
  to: string[];
  subject: string;
  date: Date;
  snippet?: string;
  folderId?: string;
}

export interface RawEmailData {
  id: string;
  rawMime: string;
  headers: Record<string, string>;
  subject?: string;
  from?: string;
  to?: string[];
  date?: Date;
  folderId?: string;
}

export interface QuarantineResult {
  success: boolean;
  quarantineId: string;
  originalFolderId?: string;
  error?: string;
}

export interface SubscriptionResult {
  subscriptionId: string;
  expiresAt: Date;
  clientState?: string;
}

export interface ProviderHealth {
  ok: boolean;
  latencyMs: number;
  reconnectRequired?: boolean;
  error?: string;
}

export interface ProviderConfig {
  orgId: string;
  emailAddress?: string;
  accessToken?: string;
  refreshToken?: string;
  tenantId?: string; // M365
  clientId?: string;
  clientSecret?: string;
  quarantineEnabled?: boolean;
  quarantineThreshold?: number;
  quarantineFolderName?: string;
}

export interface ProviderStatus {
  name: 'gmail' | 'microsoft365';
  isConnected: boolean;
  emailAddress?: string;
  reconnectRequired?: boolean;
  expiresAt?: number;
  lastSyncAt?: string;
  quarantineEnabled: boolean;
  watchActive: boolean;
}

/**
 * Common MailProvider interface abstracting both Gmail and Microsoft 365 (Graph)
 */
export interface MailProvider {
  readonly name: 'gmail' | 'microsoft365';
  readonly orgId: string;

  connect(config: ProviderConfig): Promise<boolean>;
  disconnect(): Promise<void>;

  listMessages(since?: Date, limit?: number): Promise<MailMessageSummary[]>;
  getRawMessage(id: string): Promise<RawEmailData>;

  applyQuarantine(id: string): Promise<QuarantineResult>;
  releaseFromQuarantine(id: string, originalFolderId?: string): Promise<{ success: boolean }>;
  deleteMessage(id: string): Promise<boolean>;

  subscribe(webhookUrl: string): Promise<SubscriptionResult>;
  unsubscribe(subscriptionId: string): Promise<void>;
  renewSubscription?(subscriptionId: string): Promise<SubscriptionResult>;

  healthCheck(): Promise<ProviderHealth>;
  getStatus(): ProviderStatus;
}

// Registry of configured mail providers per organization
const providerRegistry = new Map<string, Map<string, MailProvider>>();

export function registerMailProvider(orgId: string, provider: MailProvider): void {
  let orgMap = providerRegistry.get(orgId);
  if (!orgMap) {
    orgMap = new Map();
    providerRegistry.set(orgId, orgMap);
  }
  orgMap.set(provider.name, provider);
}

export function getMailProvider(orgId: string, providerName: 'gmail' | 'microsoft365' = 'gmail'): MailProvider | null {
  const orgMap = providerRegistry.get(orgId);
  if (orgMap && orgMap.has(providerName)) {
    return orgMap.get(providerName)!;
  }
  return null;
}

export function listMailProvidersForOrg(orgId: string): ProviderStatus[] {
  const orgMap = providerRegistry.get(orgId);
  if (!orgMap) return [];
  return Array.from(orgMap.values()).map(p => p.getStatus());
}
