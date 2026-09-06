import { getSupabaseAdminClient, DEFAULT_ORG_ID } from './supabase';
import { encryptToken, decryptToken } from '../utils/crypto';

export interface SlackConfig {
  botToken: string;
  channelId: string;
  minSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'ALL';
  webhookUrl?: string;
  autoSendAlerts: boolean;
  username?: string;
}

export interface SlackDeliveryLog {
  id: string;
  timestamp: string;
  case_id?: string;
  alert_id?: string;
  subject: string;
  severity: string;
  threat_score: number;
  status: 'DELIVERED' | 'FAILED' | 'SKIPPED_SEVERITY' | 'SKIPPED_DUPLICATE' | 'DISABLED';
  status_code?: number;
  error?: string;
  bot_token_masked?: string;
  channel_id?: string;
  webhook_url_masked?: string;
  payload_preview?: any;
}

let slackConfig: SlackConfig = {
  botToken: process.env.SLACK_BOT_TOKEN || '',
  channelId: process.env.SLACK_CHANNEL_ID || '',
  minSeverity: ((process.env.SLACK_MIN_SEVERITY || 'HIGH').toUpperCase() as any) || 'HIGH',
  webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
  autoSendAlerts: true,
  username: 'TraceXMail SOC Engine'
};

const deliveryLogs: SlackDeliveryLog[] = [];
const sentAlertIds = new Set<string>();

export function getSlackConfig(): SlackConfig {
  return {
    ...slackConfig,
    botToken: process.env.SLACK_BOT_TOKEN || slackConfig.botToken,
    channelId: process.env.SLACK_CHANNEL_ID || slackConfig.channelId,
    minSeverity: ((process.env.SLACK_MIN_SEVERITY || slackConfig.minSeverity || 'HIGH').toUpperCase() as any),
    webhookUrl: process.env.SLACK_WEBHOOK_URL || slackConfig.webhookUrl
  };
}

export function updateSlackConfig(updates: Partial<SlackConfig>, orgId: string = DEFAULT_ORG_ID): SlackConfig {
  slackConfig = {
    ...slackConfig,
    ...updates
  };

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const encryptedBotToken = updates.botToken ? encryptToken(updates.botToken) : undefined;
    const encryptedWebhookUrl = updates.webhookUrl ? encryptToken(updates.webhookUrl) : undefined;

    const row: any = {
      id: `slack_cfg_${orgId}`,
      organization_id: orgId,
      channel_id: slackConfig.channelId,
      min_severity: slackConfig.minSeverity,
      auto_send_alerts: slackConfig.autoSendAlerts,
      username: slackConfig.username || 'TraceXMail SOC Engine',
      updated_at: new Date().toISOString()
    };
    if (encryptedBotToken !== undefined) row.bot_token_encrypted = encryptedBotToken;
    if (encryptedWebhookUrl !== undefined) row.webhook_url_encrypted = encryptedWebhookUrl;

    supabase.from('slack_config')
      .upsert(row, { onConflict: 'organization_id' })
      .then(({ error }) => {
        if (error) console.warn('[SlackService] Error persisting slack_config to DB:', error.message);
      });
  }

  return getSlackConfig();
}

export async function syncSlackConfigFromDb(orgId: string = DEFAULT_ORG_ID): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from('slack_config')
      .select('*')
      .eq('organization_id', orgId)
      .maybeSingle();

    if (error || !data) return;

    if (data.channel_id) slackConfig.channelId = data.channel_id;
    if (data.min_severity) slackConfig.minSeverity = data.min_severity;
    if (typeof data.auto_send_alerts === 'boolean') slackConfig.autoSendAlerts = data.auto_send_alerts;
    if (data.username) slackConfig.username = data.username;
    if (data.bot_token_encrypted) {
      try {
        slackConfig.botToken = decryptToken(data.bot_token_encrypted);
      } catch (err) {
        console.warn('[SlackService] Error decrypting bot token from DB:', err);
      }
    }
    if (data.webhook_url_encrypted) {
      try {
        slackConfig.webhookUrl = decryptToken(data.webhook_url_encrypted);
      } catch (err) {
        console.warn('[SlackService] Error decrypting webhook URL from DB:', err);
      }
    }
    console.log('[SlackService] Synchronized slack_config from Supabase for org:', orgId);
  } catch (err) {
    console.warn('[SlackService] Failed syncing slack_config from DB:', err);
  }
}

// Initial sync
syncSlackConfigFromDb().catch(() => {});

export function recordDeliveryLog(log: SlackDeliveryLog, orgId: string = DEFAULT_ORG_ID) {
  deliveryLogs.unshift(log);
  if (deliveryLogs.length > 100) deliveryLogs.pop();

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    supabase.from('slack_delivery_logs')
      .insert({
        id: log.id,
        organization_id: orgId,
        timestamp: log.timestamp,
        case_id: log.case_id && log.case_id !== 'N/A' ? log.case_id : null,
        alert_id: log.alert_id,
        subject: log.subject,
        severity: log.severity,
        threat_score: log.threat_score,
        status: log.status,
        status_code: log.status_code || null,
        error: log.error || null,
        bot_token_masked: log.bot_token_masked || null,
        channel_id: log.channel_id || null,
        webhook_url_masked: log.webhook_url_masked || null,
        payload_preview: log.payload_preview || null
      })
      .then(({ error }) => {
        if (error) console.warn('[SlackService] Error writing delivery log to DB:', error.message);
      });
  }
}

export function getSlackDeliveries(): SlackDeliveryLog[] {
  return [...deliveryLogs];
}

export async function fetchSlackDeliveries(orgId: string = DEFAULT_ORG_ID): Promise<SlackDeliveryLog[]> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('slack_delivery_logs')
        .select('*')
        .eq('organization_id', orgId)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (!error && data && data.length > 0) {
        return data.map(r => ({
          id: r.id,
          timestamp: r.timestamp,
          case_id: r.case_id,
          alert_id: r.alert_id,
          subject: r.subject,
          severity: r.severity,
          threat_score: r.threat_score,
          status: r.status,
          status_code: r.status_code,
          error: r.error,
          bot_token_masked: r.bot_token_masked,
          channel_id: r.channel_id,
          webhook_url_masked: r.webhook_url_masked,
          payload_preview: r.payload_preview
        }));
      }
    } catch (err) {
      console.warn('[SlackService] Failed fetching slack delivery logs from Supabase:', err);
    }
  }
  return [...deliveryLogs];
}

export function clearSentAlertCache(): void {
  sentAlertIds.clear();
}

export function maskToken(token: string): string {
  if (!token) return 'Not Configured';
  try {
    const trimmed = token.trim();
    if (trimmed.length <= 8) return '****';
    return `${trimmed.slice(0, 5)}...${trimmed.slice(-4)}`;
  } catch {
    return '****';
  }
}

export function maskWebhookUrl(url: string): string {
  if (!url) return 'Not Configured';
  try {
    const trimmed = url.trim();
    if (trimmed.length <= 15) return '***';
    const firstPart = trimmed.slice(0, 22);
    const lastPart = trimmed.slice(-6);
    return `${firstPart}...${lastPart}`;
  } catch {
    return '***';
  }
}

const SEVERITY_LEVELS: Record<string, number> = {
  ALL: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

export function shouldSendAlert(severity: string, minSeverity: string): boolean {
  const alertLevel = SEVERITY_LEVELS[severity?.toUpperCase()] ?? 2;
  const targetLevel = SEVERITY_LEVELS[minSeverity?.toUpperCase()] ?? 3; // Default HIGH = 3
  return alertLevel >= targetLevel;
}

export interface DispatchSlackParams {
  caseItem: {
    id: string;
    title: string;
    description?: string;
    severity: string;
    threat_score: number;
    status: string;
    assigned_user?: string;
    tags?: string[];
  };
  alertItem?: {
    id: string;
    title: string;
    description: string;
    severity: string;
    threat_score: number;
    category?: string;
  };
  fileName?: string;
  threatScore: number;
  verdict: string;
  from: string;
  to?: string;
  subject: string;
  fromDomain: string;
  primaryGeoHop?: any;
  domainIntelligence?: any;
  spfResult?: any;
  dmarcResult?: any;
  isTyposquat?: boolean;
  torHop?: any;
  confidence?: string | number;
  evidenceId?: string;
}

export function buildSlackMessagePayload(params: {
  severity: string;
  verdict: string;
  threatScore: number;
  subject: string;
  sender: string;
  category: string;
  caseId: string;
  evidenceId: string;
  description: string;
  confidence: string;
  timestamp: string;
}) {
  const {
    severity,
    verdict,
    threatScore,
    subject,
    sender,
    category,
    caseId,
    evidenceId,
    description,
    confidence,
    timestamp
  } = params;

  const text = [
    `🚨 TraceXMail Security Alert`,
    ``,
    `Severity: ${severity}`,
    `Verdict: ${verdict}`,
    `Threat Score: ${threatScore}`,
    ``,
    `Subject: ${subject}`,
    `Sender: ${sender}`,
    `Category: ${category}`,
    ``,
    `Case: ${caseId}`,
    `Evidence: ${evidenceId}`,
    ``,
    `Description:`,
    `${description}`,
    ``,
    `Confidence: ${confidence}`,
    ``,
    `Timestamp: ${timestamp}`
  ].join('\n');

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🚨 TraceXMail Security Alert',
        emoji: true
      }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Severity:*\n${severity}` },
        { type: 'mrkdwn', text: `*Verdict:*\n${verdict}` },
        { type: 'mrkdwn', text: `*Threat Score:*\n${threatScore}` },
        { type: 'mrkdwn', text: `*Category:*\n${category}` },
        { type: 'mrkdwn', text: `*Subject:*\n${subject}` },
        { type: 'mrkdwn', text: `*Sender:*\n\`${sender}\`` },
        { type: 'mrkdwn', text: `*Case:*\n\`${caseId}\`` },
        { type: 'mrkdwn', text: `*Evidence:*\n\`${evidenceId}\`` }
      ]
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Description:*\n${description}`
      }
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*Confidence:* ${confidence} | *Timestamp:* ${timestamp}`
        }
      ]
    }
  ];

  return { text, blocks };
}

export function buildSlackBlockKitPayload(params: DispatchSlackParams) {
  const {
    caseItem,
    alertItem,
    threatScore,
    verdict,
    from,
    subject,
    confidence = 'N/A',
    evidenceId = 'N/A'
  } = params;

  const sev = (caseItem?.severity || alertItem?.severity || 'HIGH').toUpperCase();
  const description = alertItem?.description || caseItem?.description || 'TraceXMail Security Alert';

  return buildSlackMessagePayload({
    severity: sev,
    verdict: verdict || (sev === 'CRITICAL' ? 'MALICIOUS / PHISHING' : sev === 'HIGH' ? 'HIGH RISK' : 'SUSPICIOUS'),
    threatScore: threatScore || 85,
    subject: subject || caseItem?.title || 'Security Alert',
    sender: from || 'Unknown Sender',
    category: alertItem?.category || 'THREAT_DETECTION',
    caseId: caseItem?.id || 'N/A',
    evidenceId,
    description,
    confidence: String(confidence),
    timestamp: new Date().toISOString()
  });
}

export async function sendSlackSecurityAlert(
  alert: {
    id?: string;
    case_id?: string;
    title?: string;
    description?: string;
    severity?: string;
    threat_score?: number;
    category?: string;
    sender?: string;
    subject?: string;
    timestamp?: string;
  },
  extraData?: {
    caseItem?: any;
    evidenceId?: string;
    confidence?: string | number;
    verdict?: string;
    from?: string;
    to?: string;
    subject?: string;
    fromDomain?: string;
    primaryGeoHop?: any;
    domainIntelligence?: any;
    spfResult?: any;
    dmarcResult?: any;
    isTyposquat?: boolean;
    torHop?: any;
    isTestCall?: boolean;
  }
): Promise<SlackDeliveryLog | undefined> {
  const alertId = alert.id || `alt_${Date.now()}`;
  const caseId = alert.case_id || extraData?.caseItem?.id || 'N/A';
  const evidenceId = extraData?.evidenceId || extraData?.caseItem?.evidence_id || 'N/A';
  const severity = (alert.severity || extraData?.caseItem?.severity || 'HIGH').toUpperCase();
  const threatScore = alert.threat_score ?? extraData?.caseItem?.threat_score ?? 85;
  const subject = alert.subject || extraData?.subject || extraData?.caseItem?.title || alert.title || 'Security Alert';
  const sender = alert.sender || extraData?.from || 'Unknown Sender';
  const category = alert.category || 'THREAT_DETECTION';
  const description = alert.description || extraData?.caseItem?.description || 'Automated security alert created by TraceXMail.';
  const timestamp = alert.timestamp || new Date().toISOString();

  let verdict = extraData?.verdict;
  if (!verdict) {
    if (severity === 'CRITICAL') verdict = 'MALICIOUS / PHISHING';
    else if (severity === 'HIGH') verdict = 'HIGH RISK THREAT';
    else if (severity === 'MEDIUM') verdict = 'SUSPICIOUS';
    else verdict = 'CLEAN / INFORMATIONAL';
  }

  let confidenceStr = 'N/A';
  if (extraData?.confidence !== undefined && extraData.confidence !== null) {
    confidenceStr = String(extraData.confidence);
  } else if (extraData?.caseItem?.ml_confidence !== undefined) {
    const val = extraData.caseItem.ml_confidence;
    confidenceStr = typeof val === 'number' ? `${(val * 100).toFixed(0)}%` : String(val);
  } else if (extraData?.caseItem?.phishing_probability !== undefined) {
    const val = extraData.caseItem.phishing_probability;
    confidenceStr = typeof val === 'number' ? `${(val * 100).toFixed(0)}%` : String(val);
  }

  const config = getSlackConfig();
  const botToken = config.botToken;
  const channelId = config.channelId;
  const minSeverity = config.minSeverity;
  const webhookUrl = config.webhookUrl;

  const logId = `slack_log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // 1. Check duplicate prevention
  if (!extraData?.isTestCall && alertId && sentAlertIds.has(alertId)) {
    console.log(`[Slack] Notification skipped: Duplicate alert ID ${alertId}`);
    const log: SlackDeliveryLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      case_id: caseId,
      alert_id: alertId,
      subject,
      severity,
      threat_score: threatScore,
      status: 'SKIPPED_DUPLICATE',
      error: `Duplicate alert ID ${alertId}`
    };
    return log;
  }

  if (!extraData?.isTestCall && alertId) {
    sentAlertIds.add(alertId);
    if (sentAlertIds.size > 1000) {
      const first = sentAlertIds.values().next().value;
      if (first) sentAlertIds.delete(first);
    }
  }

  // 2. Check severity threshold
  if (!extraData?.isTestCall && !shouldSendAlert(severity, minSeverity)) {
    console.log(`[Slack] Notification skipped: Alert severity ${severity} below minimum threshold ${minSeverity}`);
    const log: SlackDeliveryLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      case_id: caseId,
      alert_id: alertId,
      subject,
      severity,
      threat_score: threatScore,
      status: 'SKIPPED_SEVERITY',
      error: `Severity ${severity} below threshold ${minSeverity}`
    };
    return log;
  }

  // 3. Check configuration
  const hasBotConfig = Boolean(botToken && channelId);
  const hasWebhookConfig = Boolean(webhookUrl && webhookUrl.startsWith('http'));

  if (!hasBotConfig && !hasWebhookConfig) {
    console.log('[Slack] Disabled: missing SLACK_BOT_TOKEN or SLACK_CHANNEL_ID');
    const log: SlackDeliveryLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      case_id: caseId,
      alert_id: alertId,
      subject,
      severity,
      threat_score: threatScore,
      status: 'DISABLED',
      error: 'Missing SLACK_BOT_TOKEN or SLACK_CHANNEL_ID'
    };
    recordDeliveryLog(log);
    return log;
  }

  const { text, blocks } = buildSlackMessagePayload({
    severity,
    verdict,
    threatScore,
    subject,
    sender,
    category,
    caseId,
    evidenceId,
    description,
    confidence: confidenceStr,
    timestamp
  });

  try {
    let response: Response;
    let isWebApi = false;

    if (hasBotConfig) {
      isWebApi = true;
      response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({
          channel: channelId,
          text,
          blocks
        })
      });
    } else {
      response = await fetch(webhookUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          blocks
        })
      });
    }

    if (isWebApi) {
      const data: any = await response.json();
      if (response.ok && data.ok) {
        if (alertId) {
          sentAlertIds.add(alertId);
          if (sentAlertIds.size > 1000) {
            const first = sentAlertIds.values().next().value;
            if (first) sentAlertIds.delete(first);
          }
        }
        console.log('[Slack] Notification sent');
        const log: SlackDeliveryLog = {
          id: logId,
          timestamp: new Date().toISOString(),
          case_id: caseId,
          alert_id: alertId,
          subject,
          severity,
          threat_score: threatScore,
          status: 'DELIVERED',
          status_code: response.status,
          bot_token_masked: maskToken(botToken),
          channel_id: channelId,
          payload_preview: { text, blocks }
        };
        recordDeliveryLog(log);
        return log;
      } else {
        const reason = data.error || `HTTP ${response.status} ${response.statusText}`;
        console.log(`[Slack] Notification failed: ${reason}`);
        const log: SlackDeliveryLog = {
          id: logId,
          timestamp: new Date().toISOString(),
          case_id: caseId,
          alert_id: alertId,
          subject,
          severity,
          threat_score: threatScore,
          status: 'FAILED',
          status_code: response.status,
          error: reason,
          bot_token_masked: maskToken(botToken),
          channel_id: channelId,
          payload_preview: { text, blocks }
        };
        recordDeliveryLog(log);
        return log;
      }
    } else {
      if (response.ok) {
        if (alertId) {
          sentAlertIds.add(alertId);
          if (sentAlertIds.size > 1000) {
            const first = sentAlertIds.values().next().value;
            if (first) sentAlertIds.delete(first);
          }
        }
        console.log('[Slack] Notification sent');
        const log: SlackDeliveryLog = {
          id: logId,
          timestamp: new Date().toISOString(),
          case_id: caseId,
          alert_id: alertId,
          subject,
          severity,
          threat_score: threatScore,
          status: 'DELIVERED',
          status_code: response.status,
          webhook_url_masked: maskWebhookUrl(webhookUrl!),
          payload_preview: { text, blocks }
        };
        recordDeliveryLog(log);
        return log;
      } else {
        const errBody = await response.text();
        console.log(`[Slack] Notification failed: ${errBody || response.statusText}`);
        const log: SlackDeliveryLog = {
          id: logId,
          timestamp: new Date().toISOString(),
          case_id: caseId,
          alert_id: alertId,
          subject,
          severity,
          threat_score: threatScore,
          status: 'FAILED',
          status_code: response.status,
          error: errBody || response.statusText,
          webhook_url_masked: maskWebhookUrl(webhookUrl!),
          payload_preview: { text, blocks }
        };
        recordDeliveryLog(log);
        return log;
      }
    }
  } catch (err: any) {
    const reason = err?.message || 'Network exception during Slack request';
    console.log(`[Slack] Notification failed: ${reason}`);
    const log: SlackDeliveryLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      case_id: caseId,
      alert_id: alertId,
      subject,
      severity,
      threat_score: threatScore,
      status: 'FAILED',
      error: reason,
      bot_token_masked: maskToken(botToken),
      channel_id: channelId,
      payload_preview: { text, blocks }
    };
    recordDeliveryLog(log);
    return log;
  }
}

export async function dispatchSlackCaseAlert(params: DispatchSlackParams): Promise<SlackDeliveryLog> {
  const result = await sendSlackSecurityAlert(
    {
      id: params.alertItem?.id || `alt_${Date.now()}`,
      case_id: params.caseItem?.id,
      title: params.alertItem?.title || params.caseItem?.title,
      description: params.alertItem?.description || params.caseItem?.description,
      severity: params.alertItem?.severity || params.caseItem?.severity,
      threat_score: params.threatScore || params.caseItem?.threat_score,
      category: params.alertItem?.category || 'THREAT_DETECTION',
      sender: params.from,
      subject: params.subject
    },
    {
      caseItem: params.caseItem,
      evidenceId: params.evidenceId,
      confidence: params.confidence,
      verdict: params.verdict,
      from: params.from,
      to: params.to,
      subject: params.subject,
      fromDomain: params.fromDomain,
      primaryGeoHop: params.primaryGeoHop,
      domainIntelligence: params.domainIntelligence,
      spfResult: params.spfResult,
      dmarcResult: params.dmarcResult,
      isTyposquat: params.isTyposquat,
      torHop: params.torHop
    }
  );

  return result || {
    id: `slack_log_${Date.now()}`,
    timestamp: new Date().toISOString(),
    subject: params.subject,
    severity: params.caseItem?.severity || 'HIGH',
    threat_score: params.threatScore,
    status: 'DISABLED',
    error: 'Slack dispatch skipped'
  };
}

export async function sendTestSlackAlert(
  targetBotToken?: string,
  targetChannelId?: string,
  targetWebhookUrl?: string
): Promise<{
  success: boolean;
  status: string;
  statusCode?: number;
  message: string;
  log?: SlackDeliveryLog;
}> {
  const testAlert = {
    id: `alt_test_${Date.now()}`,
    case_id: `case-test-${Date.now()}`,
    title: '🚨 TraceXMail Security Alert (Test Diagnostic)',
    description: 'Synthetic validation test triggered to verify Slack alert channel integration, credentials, and Block Kit formatting.',
    severity: 'CRITICAL',
    threat_score: 95,
    category: 'TEST_DIAGNOSTIC',
    sender: 'cfo-office@secure-exec-payroll.com',
    subject: 'URGENT: Verify Updated Wire Transfer Instructions for Q3 Settlement',
    timestamp: new Date().toISOString()
  };

  const currentBotToken = process.env.SLACK_BOT_TOKEN;
  const currentChannelId = process.env.SLACK_CHANNEL_ID;
  const currentWebhook = process.env.SLACK_WEBHOOK_URL;

  if (targetBotToken) process.env.SLACK_BOT_TOKEN = targetBotToken.trim();
  if (targetChannelId) process.env.SLACK_CHANNEL_ID = targetChannelId.trim();
  if (targetWebhookUrl) process.env.SLACK_WEBHOOK_URL = targetWebhookUrl.trim();

  try {
    const log = await sendSlackSecurityAlert(testAlert, {
      confidence: '98%',
      evidenceId: `EV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      verdict: 'MALICIOUS / PHISHING',
      isTestCall: true
    });

    if (log && log.status === 'DELIVERED') {
      return {
        success: true,
        status: 'DELIVERED',
        statusCode: log.status_code || 200,
        message: 'Test notification sent',
        log
      };
    } else if (log && log.status === 'DISABLED') {
      return {
        success: false,
        status: 'DISABLED',
        message: '[Slack] Disabled: missing SLACK_BOT_TOKEN or SLACK_CHANNEL_ID',
        log
      };
    } else {
      return {
        success: false,
        status: log?.status || 'FAILED',
        statusCode: log?.status_code,
        message: `Slack test notification failed: ${log?.error || 'Unknown error'}`,
        log
      };
    }
  } finally {
    if (currentBotToken !== undefined) process.env.SLACK_BOT_TOKEN = currentBotToken;
    else delete process.env.SLACK_BOT_TOKEN;

    if (currentChannelId !== undefined) process.env.SLACK_CHANNEL_ID = currentChannelId;
    else delete process.env.SLACK_CHANNEL_ID;

    if (currentWebhook !== undefined) process.env.SLACK_WEBHOOK_URL = currentWebhook;
    else delete process.env.SLACK_WEBHOOK_URL;
  }
}
