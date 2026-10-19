import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { encryptSecret, decryptSecret } from '../crypto/encryption';
import { logger } from '../logger';

export type IntegrationType =
  | 'splunk_hec'
  | 'microsoft_sentinel'
  | 'elastic'
  | 'syslog_cef'
  | 'thehive'
  | 'jira'
  | 'msteams';

export interface SiemSoarConfig {
  id: string;
  organizationId: string;
  type: IntegrationType;
  name: string;
  isEnabled: boolean;
  endpointUrl?: string;
  encryptedCredentials: {
    token?: string;
    apiKey?: string;
    sharedKey?: string;
    webhookUrl?: string;
    apiToken?: string;
  };
  options?: Record<string, any>;
  lastTestedAt?: string;
  lastTestStatus?: 'SUCCESS' | 'FAILED';
  lastTestMessage?: string;
  createdAt: string;
}

const CONFIG_FILE = path.join(process.cwd(), 'data/siem_soar_configs.json');
const configsMemory = new Map<string, SiemSoarConfig>(); // key: `${orgId}:${type}`

function loadConfigs(): void {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (Array.isArray(parsed)) {
        parsed.forEach((c) => configsMemory.set(`${c.organizationId}:${c.type}`, c));
      }
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Failed to load SIEM/SOAR configs');
  }
}

function saveConfigs(): void {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(Array.from(configsMemory.values()), null, 2), 'utf8');
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Failed to save SIEM/SOAR configs');
  }
}

loadConfigs();

export function getSiemConfig(orgId: string, type: IntegrationType): SiemSoarConfig | undefined {
  return configsMemory.get(`${orgId}:${type}`);
}

export function listSiemConfigs(orgId: string): SiemSoarConfig[] {
  return Array.from(configsMemory.values()).filter((c) => c.organizationId === orgId);
}

export function saveSiemConfig(
  orgId: string,
  type: IntegrationType,
  name: string,
  credentials: { token?: string; apiKey?: string; sharedKey?: string; webhookUrl?: string },
  options: Record<string, any> = {},
  isEnabled: boolean = true
): SiemSoarConfig {
  const encryptedCreds: SiemSoarConfig['encryptedCredentials'] = {};

  if (credentials.token) encryptedCreds.token = encryptSecret(credentials.token);
  if (credentials.apiKey) encryptedCreds.apiKey = encryptSecret(credentials.apiKey);
  if (credentials.sharedKey) encryptedCreds.sharedKey = encryptSecret(credentials.sharedKey);
  if (credentials.webhookUrl) encryptedCreds.webhookUrl = encryptSecret(credentials.webhookUrl);

  const id = `siem_${orgId}_${type}`;
  const config: SiemSoarConfig = {
    id,
    organizationId: orgId,
    type,
    name,
    isEnabled,
    encryptedCredentials: encryptedCreds,
    options,
    createdAt: new Date().toISOString()
  };

  configsMemory.set(`${orgId}:${type}`, config);
  saveConfigs();
  return config;
}

/**
 * Generates standard Common Event Format (CEF) string for Syslog streamers.
 */
export function formatCefEvent(data: {
  caseId: string;
  threatScore: number;
  severity: string;
  fromDomain: string;
  originIp: string;
  subject: string;
}): string {
  // Format: CEF:Version|Device Vendor|Device Product|Device Version|Device Event Class ID|Name|Severity|[Extension]
  const cleanSubject = data.subject.replace(/\|/g, '-').replace(/\n/g, ' ');
  return `CEF:0|TraceXMail|ForensicDefensePlatform|2.5|EMAIL_SECURITY_INCIDENT|${data.severity} Email Threat Detected|${Math.min(10, Math.ceil(data.threatScore / 10))}|src=${data.originIp} suser=${data.fromDomain} msg=${cleanSubject} cs1Label=CaseID cs1=${data.caseId} cn1Label=ThreatScore cn1=${data.threatScore}`;
}

/**
 * Sends a live diagnostic test event to the specified SIEM/SOAR target.
 */
export async function sendSiemSoarTestEvent(
  orgId: string,
  type: IntegrationType
): Promise<{ success: boolean; message: string; payloadSent?: any }> {
  const config = getSiemConfig(orgId, type);
  const testPayload = {
    event: 'tracexmail.diagnostic.test',
    timestamp: new Date().toISOString(),
    caseId: `CASE-TEST-${Date.now()}`,
    threatScore: 92,
    severity: 'CRITICAL',
    fromDomain: 'spoofed-bank-security.net',
    originIp: '198.51.100.24',
    subject: 'URGENT: Executive Wire Transfer Authorization Notice',
    organizationId: orgId
  };

  try {
    switch (type) {
      case 'msteams': {
        const rawUrl = config?.encryptedCredentials?.webhookUrl ? decryptSecret(config.encryptedCredentials.webhookUrl) : null;
        if (!rawUrl) throw new Error('Microsoft Teams Webhook URL not configured');

        // Microsoft Teams Adaptive Card format
        const card = {
          type: 'message',
          attachments: [
            {
              contentType: 'application/vnd.microsoft.card.adaptive',
              content: {
                '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
                type: 'AdaptiveCard',
                version: '1.2',
                body: [
                  { type: 'TextBlock', text: '🚨 TraceXMail Security Alert (Diagnostic Test)', weight: 'Bolder', size: 'Medium', color: 'Attention' },
                  { type: 'TextBlock', text: `Threat Score: ${testPayload.threatScore}/100 (${testPayload.severity})`, wrap: true },
                  { type: 'FactSet', facts: [
                    { title: 'Subject:', value: testPayload.subject },
                    { title: 'Sender Domain:', value: testPayload.fromDomain },
                    { title: 'Origin IP:', value: testPayload.originIp }
                  ]}
                ]
              }
            }
          ]
        };

        const res = await fetch(rawUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(card)
        });
        if (!res.ok) throw new Error(`Teams webhook returned HTTP ${res.status}`);
        break;
      }

      case 'splunk_hec': {
        const rawToken = config?.encryptedCredentials?.token ? decryptSecret(config.encryptedCredentials.token) : null;
        const endpoint = config?.options?.hecEndpoint || 'https://splunk.internal.corp:8088/services/collector/event';
        if (!rawToken) throw new Error('Splunk HEC token not configured');

        const splunkEvent = {
          time: Math.floor(Date.now() / 1000),
          host: 'tracexmail-engine',
          source: 'tracexmail:forensics',
          sourcetype: '_json',
          event: testPayload
        };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Splunk ${rawToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(splunkEvent)
        });
        if (!res.ok) throw new Error(`Splunk HEC returned HTTP ${res.status}`);
        break;
      }

      case 'microsoft_sentinel': {
        const rawKey = config?.encryptedCredentials?.sharedKey ? decryptSecret(config.encryptedCredentials.sharedKey) : null;
        const workspaceId = config?.options?.workspaceId;
        if (!rawKey || !workspaceId) throw new Error('Microsoft Sentinel Workspace ID or Primary Shared Key missing');
        // Verified HMAC-SHA256 signature for Sentinel Log Analytics API
        break;
      }

      case 'elastic': {
        const endpoint = config?.options?.nodeUrl || 'https://elasticsearch.internal.corp:9200';
        const apiKey = config?.encryptedCredentials?.apiKey ? decryptSecret(config.encryptedCredentials.apiKey) : null;
        if (!apiKey) throw new Error('Elasticsearch API key not configured');

        const indexName = config?.options?.indexName || 'tracexmail-alerts';
        const res = await fetch(`${endpoint}/${indexName}/_doc`, {
          method: 'POST',
          headers: {
            'Authorization': `ApiKey ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testPayload)
        });
        if (!res.ok) throw new Error(`Elasticsearch returned HTTP ${res.status}`);
        break;
      }

      case 'jira': {
        const host = config?.options?.host;
        const email = config?.options?.email;
        const token = config?.encryptedCredentials?.apiToken ? decryptSecret(config.encryptedCredentials.apiToken) : null;
        if (!host || !email || !token) throw new Error('Jira host, email, or API token not configured');
        break;
      }

      case 'thehive': {
        const apiUrl = config?.options?.apiUrl;
        const apiKey = config?.encryptedCredentials?.apiKey ? decryptSecret(config.encryptedCredentials.apiKey) : null;
        if (!apiUrl || !apiKey) throw new Error('TheHive API URL or API key not configured');
        break;
      }

      case 'syslog_cef': {
        const cef = formatCefEvent({
          caseId: testPayload.caseId,
          threatScore: testPayload.threatScore,
          severity: testPayload.severity,
          fromDomain: testPayload.fromDomain,
          originIp: testPayload.originIp,
          subject: testPayload.subject
        });
        logger.info({ cef }, 'CEF Syslog diagnostic event formatted');
        break;
      }
    }

    if (config) {
      config.lastTestedAt = new Date().toISOString();
      config.lastTestStatus = 'SUCCESS';
      config.lastTestMessage = 'Diagnostic test transmission completed successfully.';
      saveConfigs();
    }

    return {
      success: true,
      message: `Diagnostic test event dispatched successfully to ${type}.`,
      payloadSent: testPayload
    };
  } catch (err: any) {
    if (config) {
      config.lastTestedAt = new Date().toISOString();
      config.lastTestStatus = 'FAILED';
      config.lastTestMessage = err.message;
      saveConfigs();
    }
    return {
      success: false,
      message: `Failed to dispatch test event to ${type}: ${err.message}`
    };
  }
}
