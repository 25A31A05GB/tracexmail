/**
 * Client Service for Google Cloud Pub/Sub Topic Registration & Gmail Push Synchronization
 *
 * Provides typed frontend methods to:
 * - Provision and register Google Cloud Pub/Sub topics for mailbox push interception.
 * - Verify and configure IAM policies granting roles/pubsub.publisher to gmail-api-push@system.gserviceaccount.com.
 * - Trigger diagnostic pings to verify end-to-end webhook delivery.
 * - Query current Pub/Sub integration status and historyId delta synchronizer health.
 */

import { API_URL as API_BASE_URL, apiFetch } from '../lib/api';

export interface PubSubSetupOptions {
  projectId?: string;
  topicId?: string;
  topicName?: string;
  subscriptionId?: string;
  subscriptionName?: string;
  pushEndpointUrl?: string;
  accessToken?: string;
  grantGmailPermissions?: boolean;
  createSubscription?: boolean;
  startWatchImmediately?: boolean;
  labelIds?: string[];
}

export interface PubSubSetupResponse {
  success: boolean;
  topicName: string;
  subscriptionName?: string;
  gmailPushAccount: string;
  iamPolicyConfigured: boolean;
  watchActive: boolean;
  historyId?: string;
  expiration?: number;
  diagnosticPingSent?: boolean;
  message: string;
  error?: string;
  details?: Record<string, any>;
}

export interface PubSubStatusResponse {
  configured: boolean;
  topicName: string | null;
  subscriptionName: string | null;
  pushEndpointUrl: string | null;
  gmailPublisherGranted: boolean;
  lastVerifiedAt: string | null;
  lastWatchRegisteredAt: string | null;
  activeWatchExpiration: number | null;
  currentHistoryId: string | null;
  totalPushesHandled: number;
  lastDiagnosticPing: {
    messageId?: string;
    timestamp?: string;
    success: boolean;
  } | null;
}

/**
 * Registers the Cloud Pub/Sub topic and provisions the full Gmail push watch pipeline.
 */
export async function setupPubSubTopic(options?: PubSubSetupOptions): Promise<PubSubSetupResponse> {
  const token = options?.accessToken || localStorage.getItem('gmail_access_token') || undefined;
  const res = await apiFetch('/api/gmail/pubsub/setup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(options || {})
  });

  return res.json();
}

/**
 * Fetches current Cloud Pub/Sub topic and pipeline status.
 */
export async function fetchPubSubStatus(): Promise<PubSubStatusResponse> {
  const res = await apiFetch('/api/gmail/pubsub/status');
  return res.json();
}

/**
 * Verifies or fixes IAM policy granting publisher rights to Gmail's system service account.
 */
export async function verifyGmailPublisherIam(topicName?: string, accessToken?: string): Promise<{ success: boolean; policyUpdated: boolean; error?: string }> {
  const token = accessToken || localStorage.getItem('gmail_access_token') || undefined;
  const res = await apiFetch('/api/gmail/pubsub/verify-iam', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ topicName })
  });

  return res.json();
}

/**
 * Publishes a diagnostic ping to test end-to-end delivery through Cloud Pub/Sub to the webhook.
 */
export async function sendDiagnosticPing(topicName?: string, accessToken?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const token = accessToken || localStorage.getItem('gmail_access_token') || undefined;
  const res = await apiFetch('/api/gmail/pubsub/ping', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ topicName })
  });

  return res.json();
}
