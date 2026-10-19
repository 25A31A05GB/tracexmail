import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../logger';

export type WebhookEventName =
  | 'case.created'
  | 'verdict.high_risk'
  | 'quarantine.held'
  | 'quarantine.released'
  | 'campaign.detected';

export interface WebhookEndpoint {
  id: string;
  organizationId: string;
  url: string;
  events: WebhookEventName[];
  secret: string; // HMAC secret
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface WebhookDeliveryLog {
  id: string;
  webhookId: string;
  organizationId: string;
  event: WebhookEventName;
  payload: any;
  statusCode?: number;
  success: boolean;
  attempt: number;
  latencyMs: number;
  error?: string;
  createdAt: string;
}

const WEBHOOKS_FILE = path.join(process.cwd(), 'data/outbound_webhooks.json');
const DELIVERIES_FILE = path.join(process.cwd(), 'data/webhook_deliveries.json');

const endpointsMemory = new Map<string, WebhookEndpoint>();
const deliveriesMemory: WebhookDeliveryLog[] = [];

function loadFromDisk(): void {
  try {
    if (fs.existsSync(WEBHOOKS_FILE)) {
      const data = JSON.parse(fs.readFileSync(WEBHOOKS_FILE, 'utf8'));
      if (Array.isArray(data)) {
        data.forEach((w) => endpointsMemory.set(w.id, w));
      }
    }
    if (fs.existsSync(DELIVERIES_FILE)) {
      const data = JSON.parse(fs.readFileSync(DELIVERIES_FILE, 'utf8'));
      if (Array.isArray(data)) {
        deliveriesMemory.push(...data);
      }
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Failed to load webhooks from disk');
  }
}

function saveToDisk(): void {
  try {
    const dir = path.dirname(WEBHOOKS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(WEBHOOKS_FILE, JSON.stringify(Array.from(endpointsMemory.values()), null, 2), 'utf8');
    fs.writeFileSync(DELIVERIES_FILE, JSON.stringify(deliveriesMemory.slice(-200), null, 2), 'utf8');
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Failed to save webhooks to disk');
  }
}

loadFromDisk();

export function registerWebhook(params: {
  organizationId: string;
  url: string;
  events: WebhookEventName[];
  description?: string;
}): WebhookEndpoint {
  const id = `wh_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

  const endpoint: WebhookEndpoint = {
    id,
    organizationId: params.organizationId,
    url: params.url,
    events: params.events,
    secret,
    description: params.description,
    isActive: true,
    createdAt: new Date().toISOString()
  };

  endpointsMemory.set(id, endpoint);
  saveToDisk();
  return endpoint;
}

export function listOrgWebhooks(orgId: string): WebhookEndpoint[] {
  return Array.from(endpointsMemory.values()).filter((w) => w.organizationId === orgId);
}

export function deleteWebhook(id: string, orgId: string): boolean {
  const endpoint = endpointsMemory.get(id);
  if (endpoint && endpoint.organizationId === orgId) {
    endpointsMemory.delete(id);
    saveToDisk();
    return true;
  }
  return false;
}

export function getWebhookDeliveries(orgId: string): WebhookDeliveryLog[] {
  return deliveriesMemory.filter((d) => d.organizationId === orgId).slice(-50);
}

/**
 * Signs payload and dispatches with exponential backoff.
 */
export async function dispatchWebhookEvent(
  organizationId: string,
  event: WebhookEventName,
  data: any
): Promise<void> {
  const matchingEndpoints = Array.from(endpointsMemory.values()).filter(
    (w) => w.organizationId === organizationId && w.isActive && w.events.includes(event)
  );

  for (const endpoint of matchingEndpoints) {
    deliverWithRetry(endpoint, event, data, 1);
  }
}

async function deliverWithRetry(
  endpoint: WebhookEndpoint,
  event: WebhookEventName,
  data: any,
  attempt: number,
  maxAttempts: number = 3
): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadString = JSON.stringify({
    id: `evt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
    event,
    createdAt: new Date().toISOString(),
    data
  });

  const signature = crypto
    .createHmac('sha256', endpoint.secret)
    .update(`${timestamp}.${payloadString}`)
    .digest('hex');

  const signatureHeader = `t=${timestamp},v1=${signature}`;
  const startTime = Date.now();
  let statusCode = 0;
  let success = false;
  let errorMsg: string | undefined;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TraceXMail-Webhooks/1.0',
        'X-TraceXMail-Signature': signatureHeader
      },
      body: payloadString,
      signal: controller.signal
    });
    clearTimeout(timer);

    statusCode = res.status;
    success = res.ok;
  } catch (err: any) {
    errorMsg = err.message || 'Network request failed';
  }

  const latencyMs = Date.now() - startTime;

  const log: WebhookDeliveryLog = {
    id: `dlv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    webhookId: endpoint.id,
    organizationId: endpoint.organizationId,
    event,
    payload: data,
    statusCode,
    success,
    attempt,
    latencyMs,
    error: errorMsg,
    createdAt: new Date().toISOString()
  };

  deliveriesMemory.push(log);
  saveToDisk();

  // Retry on 5xx or network errors with exponential backoff
  if (!success && attempt < maxAttempts) {
    const backoffMs = Math.pow(2, attempt) * 1000;
    setTimeout(() => {
      deliverWithRetry(endpoint, event, data, attempt + 1, maxAttempts);
    }, backoffMs);
  }
}

/**
 * Manual replay of a previous delivery log.
 */
export async function replayWebhookDelivery(deliveryId: string, orgId: string): Promise<boolean> {
  const dlv = deliveriesMemory.find((d) => d.id === deliveryId && d.organizationId === orgId);
  if (!dlv) return false;

  const endpoint = endpointsMemory.get(dlv.webhookId);
  if (!endpoint) return false;

  await deliverWithRetry(endpoint, dlv.event, dlv.payload, 1, 1);
  return true;
}
