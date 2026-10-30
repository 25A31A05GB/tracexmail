/**
 * TraceXMail Gmail Live Synchronization & Automated SOC Quarantine Engine
 *
 * Implements:
 * 1. Cloud Pub/Sub Push Watch Lifecycle:
 *    - Registers/unregisters Gmail `users.watch` API for sub-second webhook notifications.
 *    - Auto-renews watch leases before the 7-day Google expiration threshold.
 *    - Decodes incoming Base64 Pub/Sub push payloads into structured events.
 * 2. Incremental `historyId` Delta Synchronization:
 *    - Queries `users.history.list` using atomic `startHistoryId` cursors.
 *    - Filters and ingests strictly delta events (`messagesAdded`, `labelsAdded`),
 *      eliminating full inbox re-scans and protecting API quota.
 *    - Recovers gracefully from HTTP 404 historyId expiration via mailbox profile re-anchoring.
 * 3. Adaptive Watchdog Fallback:
 *    - 30-second background watchdog timer to poll deltas when webhooks are paused or delayed.
 *    - Strict concurrency locks (`isSyncing`) preventing parallel race conditions.
 * 4. Label-Based SOC Quarantine Processing:
 *    - Deterministically initializes colored SOC labels in Gmail:
 *      - `TraceXMail/Quarantined` (Red `#cc3a21`)
 *      - `TraceXMail/Suspicious` (Amber `#e0771a`)
 *      - `TraceXMail/Clean` (Emerald `#137333`)
 *      - `TraceXMail/Investigating` (Indigo `#3949ab`)
 *    - Atomic remediation via `users.messages.modify`: strips `INBOX` and `UNREAD`, applies quarantine label.
 *    - Real-time WebSocket broadcasting and audit log recording.
 */

import axios from 'axios';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import {
  acquireGmailQuota,
  GMAIL_QUOTA_COSTS,
  ensureFreshAccessToken,
  getGmailStatus,
  fetchGmailMessageRaw,
  recordSyncedEmail,
  gmailEvents,
  type SyncedGmailEmail
} from '../gmailService';
import { parseRawEmailToAnalysis } from '../forensicPipeline';
import { broadcastWebSocketEvent, broadcastAlert } from '../websocket';
import { getSupabaseAdminClient, DEFAULT_ORG_ID } from '../supabase';

// -----------------------------------------------------------------------------
// Standard SOC Label Definitions
// -----------------------------------------------------------------------------
export interface SocLabelDefinition {
  name: string;
  backgroundColor: string;
  textColor: string;
  labelListVisibility: 'labelShow' | 'labelHide';
  messageListVisibility: 'show' | 'hide';
  description: string;
}

export const STANDARD_SOC_LABELS: Record<string, SocLabelDefinition> = {
  QUARANTINED: {
    name: 'TraceXMail/Quarantined',
    backgroundColor: '#cc3a21', // Dark Red
    textColor: '#ffffff',
    labelListVisibility: 'labelShow',
    messageListVisibility: 'show',
    description: 'High-risk or malicious email isolated from user inbox'
  },
  SUSPICIOUS: {
    name: 'TraceXMail/Suspicious',
    backgroundColor: '#e0771a', // Amber/Orange
    textColor: '#ffffff',
    labelListVisibility: 'labelShow',
    messageListVisibility: 'show',
    description: 'Suspicious email under automated security inspection'
  },
  CLEAN: {
    name: 'TraceXMail/Clean',
    backgroundColor: '#137333', // Forest Green
    textColor: '#ffffff',
    labelListVisibility: 'labelShow',
    messageListVisibility: 'show',
    description: 'Inspected email verified clean by ML and forensic pipeline'
  },
  INVESTIGATING: {
    name: 'TraceXMail/Investigating',
    backgroundColor: '#3949ab', // Indigo
    textColor: '#ffffff',
    labelListVisibility: 'labelShow',
    messageListVisibility: 'show',
    description: 'Active SOC analyst triage ticket open on message'
  }
};

// -----------------------------------------------------------------------------
// Engine Configuration & Status Interfaces
// -----------------------------------------------------------------------------
export interface SyncEngineConfig {
  orgId: string;
  topicName: string;
  initialHistoryId?: string;
  quarantineThreshold: number; // 0-100 (Default 70)
  quarantineSuspiciousThreshold: number; // 0-100 (Default 40)
  removeInboxLabelOnQuarantine: boolean; // Default true
  markReadOnQuarantine: boolean; // Default true
  watchdogIntervalSeconds: number; // Default 30s
  watchRenewalMarginHours: number; // Default 24h
  adminWebhookUrl: string;
}

export interface SyncEngineMetrics {
  currentHistoryId: string | null;
  lastSyncAt: string | null;
  lastPushReceivedAt: string | null;
  lastWatchdogTickAt: string | null;
  messagesIngestedTotal: number;
  messagesQuarantinedTotal: number;
  deltasProcessedTotal: number;
  watchdogChecksTotal: number;
  pushNotificationsHandledTotal: number;
  cursorExpirationsRecovered: number;
  activeWatchExpiration: number | null;
}

export interface QuarantineExecutionResult {
  success: boolean;
  messageId: string;
  appliedLabel: string;
  labelsAdded: string[];
  labelsRemoved: string[];
  inboxBypassed: boolean;
  adminWebhookDispatched: boolean;
  auditLogId: string;
  error?: string;
}

export interface DeltaSyncResult {
  success: boolean;
  startHistoryId: string;
  latestHistoryId: string;
  messagesAddedCount: number;
  messagesProcessed: Array<{
    id: string;
    subject: string;
    from: string;
    threatScore: number;
    verdict: string;
    quarantined: boolean;
    actionTaken: string;
  }>;
  cursorExpired: boolean;
  durationMs: number;
  error?: string;
}

// -----------------------------------------------------------------------------
// TraceXMail Gmail Live Synchronization Engine
// -----------------------------------------------------------------------------
export class GmailSyncEngine extends EventEmitter {
  private config: SyncEngineConfig;
  private metrics: SyncEngineMetrics;
  private watchdogTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private labelCache = new Map<string, { id: string; name: string }>();
  private processedMessageIds = new Set<string>();
  private processedMessageQueue: string[] = []; // Circular tracking for memory bounding (max 2000)

  constructor(customConfig?: Partial<SyncEngineConfig>) {
    super();

    this.config = {
      orgId: customConfig?.orgId || DEFAULT_ORG_ID,
      topicName:
        customConfig?.topicName ||
        process.env.GMAIL_PUBSUB_TOPIC ||
        'projects/tracexmail-enterprise/topics/inbox-watch',
      initialHistoryId: customConfig?.initialHistoryId,
      quarantineThreshold: customConfig?.quarantineThreshold ?? 70,
      quarantineSuspiciousThreshold: customConfig?.quarantineSuspiciousThreshold ?? 40,
      removeInboxLabelOnQuarantine: customConfig?.removeInboxLabelOnQuarantine ?? true,
      markReadOnQuarantine: customConfig?.markReadOnQuarantine ?? true,
      watchdogIntervalSeconds: customConfig?.watchdogIntervalSeconds ?? 30,
      watchRenewalMarginHours: customConfig?.watchRenewalMarginHours ?? 24,
      adminWebhookUrl: customConfig?.adminWebhookUrl || process.env.SOC_ADMIN_WEBHOOK_URL || ''
    };

    this.metrics = {
      currentHistoryId: customConfig?.initialHistoryId || null,
      lastSyncAt: null,
      lastPushReceivedAt: null,
      lastWatchdogTickAt: null,
      messagesIngestedTotal: 0,
      messagesQuarantinedTotal: 0,
      deltasProcessedTotal: 0,
      watchdogChecksTotal: 0,
      pushNotificationsHandledTotal: 0,
      cursorExpirationsRecovered: 0,
      activeWatchExpiration: null
    };

    // Forward internal events to global gmailEvents
    this.on('push_received', payload => gmailEvents.emit('inbound_mail_push', payload));
    this.on('quarantine_executed', result => gmailEvents.emit('email_quarantined', result));
  }

  /**
   * Resolves the best available OAuth token: explicitly passed override,
   * fresh token from OAuth database, or environment fallback.
   */
  private async resolveToken(overrideToken?: string): Promise<string | null> {
    if (overrideToken) return overrideToken;
    const token = await ensureFreshAccessToken(this.config.orgId);
    if (token) return token;
    if (process.env.GMAIL_ACCESS_TOKEN) return process.env.GMAIL_ACCESS_TOKEN;
    return null;
  }

  // ===========================================================================
  // 1. Cloud Pub/Sub Push Watch Lifecycle
  // ===========================================================================

  /**
   * Registers mailbox push notifications with Google Cloud Pub/Sub using users.watch().
   */
  public async startPushWatch(
    overrideTopic?: string,
    overrideToken?: string
  ): Promise<{
    success: boolean;
    historyId?: string;
    expiration?: number;
    error?: string;
  }> {
    const token = await this.resolveToken(overrideToken);
    if (!token) {
      const msg = 'Valid Gmail OAuth access token required to start push watch.';
      console.warn(`[GmailSyncEngine] ${msg}`);
      return { success: false, error: msg };
    }

    const topic = overrideTopic || this.config.topicName;

    try {
      await acquireGmailQuota(GMAIL_QUOTA_COSTS.WATCH_START, 'users.watch');

      const response = await axios.post(
        'https://gmail.googleapis.com/gmail/v1/users/me/watch',
        {
          topicName: topic,
          labelIds: ['INBOX'],
          labelFilterBehavior: 'include'
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const returnedHistoryId = String(response.data?.historyId || Date.now());
      const expirationMs = Number(response.data?.expiration) || Date.now() + 7 * 24 * 60 * 60 * 1000;

      this.metrics.currentHistoryId = returnedHistoryId;
      this.metrics.activeWatchExpiration = expirationMs;

      console.log(`[GmailSyncEngine] Push watch active on topic ${topic}. HistoryId: ${returnedHistoryId}, expires: ${new Date(expirationMs).toISOString()}`);

      broadcastWebSocketEvent({
        type: 'GMAIL_WATCH_STARTED',
        topic,
        historyId: returnedHistoryId,
        expiration: expirationMs,
        timestamp: new Date().toISOString()
      }, this.config.orgId);

      this.emit('watch_started', {
        topic,
        historyId: returnedHistoryId,
        expiration: expirationMs
      });

      // Ensure SOC labels are initialized in mailbox
      this.ensureSocLabels(token).catch(err => {
        console.warn('[GmailSyncEngine] Background SOC label setup notice:', err?.message);
      });

      return {
        success: true,
        historyId: returnedHistoryId,
        expiration: expirationMs
      };
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error?.message || err?.message || 'Failed calling users.watch()';
      console.error('[GmailSyncEngine] Error starting push watch:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Stops Gmail users.watch() notifications.
   */
  public async stopPushWatch(overrideToken?: string): Promise<{ success: boolean; error?: string }> {
    const token = await this.resolveToken(overrideToken);
    if (!token) {
      return { success: false, error: 'Valid Gmail OAuth access token required.' };
    }

    try {
      await acquireGmailQuota(GMAIL_QUOTA_COSTS.WATCH_STOP, 'users.stop');

      await axios.post(
        'https://gmail.googleapis.com/gmail/v1/users/me/stop',
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 8000
        }
      );

      this.metrics.activeWatchExpiration = null;
      console.log('[GmailSyncEngine] Push watch stopped on Gmail server.');

      broadcastWebSocketEvent({
        type: 'GMAIL_WATCH_STOPPED',
        timestamp: new Date().toISOString()
      }, this.config.orgId);

      return { success: true };
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error?.message || err?.message;
      console.warn('[GmailSyncEngine] Error stopping push watch:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Automatically renews push watch lease if expiring within the configured margin (default 24h).
   */
  public async checkWatchRenewal(token?: string): Promise<boolean> {
    if (!this.metrics.activeWatchExpiration) return false;

    const remainingMs = this.metrics.activeWatchExpiration - Date.now();
    const marginMs = this.config.watchRenewalMarginHours * 60 * 60 * 1000;

    if (remainingMs < marginMs) {
      console.log(`[GmailSyncEngine] Watch lease expiring in ${Math.round(remainingMs / 3600000)}h; renewing lease...`);
      const renewResult = await this.startPushWatch(this.config.topicName, token);
      return renewResult.success;
    }
    return false;
  }

  /**
   * Receives and decodes Cloud Pub/Sub push notification HTTP webhook payloads.
   */
  public async handlePubSubPush(
    rawBody: any,
    overrideToken?: string
  ): Promise<{
    success: boolean;
    historyId?: string;
    emailAddress?: string;
    messagesAddedCount?: number;
    error?: string;
  }> {
    this.metrics.lastPushReceivedAt = new Date().toISOString();
    this.metrics.pushNotificationsHandledTotal++;

    let pushData: { emailAddress?: string; historyId?: string; threadId?: string } = {};

    try {
      if (rawBody?.message?.data) {
        // Pub/Sub messages contain a Base64-encoded JSON string in message.data
        const decodedStr = Buffer.from(rawBody.message.data, 'base64').toString('utf8');
        try {
          pushData = JSON.parse(decodedStr);
        } catch {
          console.warn('[GmailSyncEngine] Failed parsing inner Pub/Sub JSON:', decodedStr);
        }
      } else if (rawBody?.emailAddress || rawBody?.historyId) {
        pushData = rawBody;
      }

      const emailAddress = pushData.emailAddress || 'user@gmail.com';
      const historyId = pushData.historyId ? String(pushData.historyId) : null;

      console.log(`[GmailSyncEngine] Processing Pub/Sub webhook for ${emailAddress} (historyId: ${historyId || 'none'})`);

      this.emit('push_received', {
        emailAddress,
        historyId,
        timestamp: this.metrics.lastPushReceivedAt
      });

      broadcastWebSocketEvent({
        type: 'GMAIL_PUSH_RECEIVED',
        emailAddress,
        historyId,
        timestamp: this.metrics.lastPushReceivedAt
      }, this.config.orgId);

      // Trigger incremental delta sync using historyId
      const deltaResult = await this.syncHistoryDelta(historyId || undefined, overrideToken);

      return {
        success: deltaResult.success,
        historyId: deltaResult.latestHistoryId,
        emailAddress,
        messagesAddedCount: deltaResult.messagesAddedCount
      };
    } catch (err: any) {
      console.error('[GmailSyncEngine] Error in handlePubSubPush:', err?.message);
      return { success: false, error: err?.message };
    }
  }

  // ===========================================================================
  // 2. Incremental historyId Delta Synchronization
  // ===========================================================================

  /**
   * Queries users.history.list using an atomic startHistoryId cursor to ingest
   * strictly new message events and label modifications.
   */
  public async syncHistoryDelta(targetHistoryId?: string, forceAccessToken?: string): Promise<DeltaSyncResult> {
    if (this.isSyncing) {
      console.log('[GmailSyncEngine] Sync cycle already in progress; skipping duplicate run.');
      return {
        success: true,
        startHistoryId: this.metrics.currentHistoryId || '0',
        latestHistoryId: this.metrics.currentHistoryId || '0',
        messagesAddedCount: 0,
        messagesProcessed: [],
        cursorExpired: false,
        durationMs: 0
      };
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      const token = await this.resolveToken(forceAccessToken);
      if (!token) {
        return {
          success: false,
          startHistoryId: this.metrics.currentHistoryId || '0',
          latestHistoryId: this.metrics.currentHistoryId || '0',
          messagesAddedCount: 0,
          messagesProcessed: [],
          cursorExpired: false,
          durationMs: Date.now() - startTime,
          error: 'No active Gmail OAuth access token available.'
        };
      }

      // Check if we need to renew push watch
      await this.checkWatchRenewal(token);

      // Anchor cursor: If no current historyId, fetch profile metadata to initialize baseline
      if (!this.metrics.currentHistoryId) {
        await this.anchorBaselineHistoryId(token);
      }

      const startHistoryId = this.metrics.currentHistoryId!;
      console.log(`[GmailSyncEngine] Querying users.history.list starting at cursor: ${startHistoryId}`);

      await acquireGmailQuota(GMAIL_QUOTA_COSTS.HISTORY_LIST, 'users.history.list');

      let historyRecords: any[] = [];
      let nextHistoryId = startHistoryId;
      let pageToken: string | undefined = undefined;
      let cursorExpired = false;

      try {
        do {
          const url: string = `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${encodeURIComponent(startHistoryId)}&historyTypes=messageAdded&historyTypes=labelAdded${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;

          const res = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000
          });

          if (Array.isArray(res.data?.history)) {
            historyRecords.push(...res.data.history);
          }
          if (res.data?.historyId) {
            nextHistoryId = String(res.data.historyId);
          }
          pageToken = res.data?.nextPageToken;
        } while (pageToken);
      } catch (historyErr: any) {
        const httpStatus = historyErr?.response?.status;
        if (httpStatus === 404) {
          // HTTP 404 indicates startHistoryId is out of bounds or expired
          console.warn(`[GmailSyncEngine] HistoryId cursor ${startHistoryId} expired (HTTP 404). Re-anchoring...`);
          cursorExpired = true;
          this.metrics.cursorExpirationsRecovered++;
          await this.anchorBaselineHistoryId(token);
          nextHistoryId = this.metrics.currentHistoryId || startHistoryId;
        } else {
          throw historyErr;
        }
      }

      // Extract unique new message IDs added
      const addedMessageMap = new Map<string, string>(); // messageId -> threadId
      for (const h of historyRecords) {
        if (Array.isArray(h.messagesAdded)) {
          for (const item of h.messagesAdded) {
            const m = item?.message;
            if (m?.id && !this.processedMessageIds.has(m.id)) {
              addedMessageMap.set(m.id, m.threadId || m.id);
            }
          }
        }
      }

      const addedIds = Array.from(addedMessageMap.keys());
      console.log(`[GmailSyncEngine] Delta list returned ${addedIds.length} new unique message(s) to inspect.`);

      const messagesProcessed: DeltaSyncResult['messagesProcessed'] = [];

      // Ingest and score each new message through the forensic analysis pipeline
      for (const msgId of addedIds) {
        this.markMessageAsProcessed(msgId);

        try {
          // Fetch raw RFC 822 content
          const rawEml = await fetchGmailMessageRaw(msgId, token);
          if (!rawEml) {
            console.warn(`[GmailSyncEngine] Could not retrieve raw EML for message ${msgId}`);
            continue;
          }

          // Run deterministic forensic analysis & ML classification
          const analysisResult = await parseRawEmailToAnalysis(rawEml, `gmail_${msgId}.eml`, undefined, {
            isPushInterception: true,
            deliveryStage: 'pre-delivery-hold',
            organizationId: this.config.orgId
          });

          const { analysis, alert, case: caseItem } = analysisResult;
          const threatScore = analysis?.threatScore ?? analysis?.threat_score ?? 0;
          const verdict = analysis?.verdict || 'SUSPICIOUS';
          const subject = analysis?.headers?.subject || '(No Subject)';
          const from = analysis?.headers?.from || 'unknown@sender';

          let quarantined = false;
          let actionTaken = 'INSPECTED_CLEAN';

          // Automated SOC quarantine trigger: if threatScore >= threshold, isolate message
          if (threatScore >= this.config.quarantineThreshold) {
            const qResult = await this.quarantineMessage({
              messageId: msgId,
              threatScore,
              verdict,
              subject,
              from,
              classification: analysis?.classification
            }, token);

            quarantined = qResult.success;
            actionTaken = quarantined ? 'HOLD_QUARANTINED' : 'QUARANTINE_FAILED';
            this.metrics.messagesQuarantinedTotal++;
          } else if (threatScore >= this.config.quarantineSuspiciousThreshold) {
            // Apply Suspicious label without removing from inbox
            await this.applySocLabel(msgId, STANDARD_SOC_LABELS.SUSPICIOUS.name, token);
            actionTaken = 'SUSPICIOUS_LABELED';
          } else {
            // Verified Clean
            await this.applySocLabel(msgId, STANDARD_SOC_LABELS.CLEAN.name, token);
            actionTaken = 'CLEAN_LABELED';
          }

          // Record analyzed email in state and buffer
          const syncedRecord: SyncedGmailEmail = {
            id: msgId,
            messageId: msgId,
            subject,
            from,
            to: analysis?.headers?.to || '',
            date: analysis?.headers?.date || new Date().toISOString(),
            timestamp: new Date().toISOString(),
            threatScore,
            threatCategory: threatScore >= 70 ? 'MALICIOUS' : threatScore >= 40 ? 'SUSPICIOUS' : 'CLEAN',
            verdict,
            deliveryStage: 'pre-delivery-hold',
            actionTaken: quarantined ? 'HOLD_QUARANTINED' : 'INSPECTED_CLEAN',
            isQuarantined: quarantined,
            appliedLabel: quarantined ? STANDARD_SOC_LABELS.QUARANTINED.name : undefined,
            authResults: {
              spf: analysis?.auth?.spf || { status: 'NONE' },
              dkim: analysis?.auth?.dkim || { status: 'NONE' },
              dmarc: analysis?.auth?.dmarc || { status: 'NONE' },
              arc: analysis?.auth?.arc
            },
            securitySignals: analysis?.findings?.map((f: any) => f.title) || [],
            whyNarrative: analysis?.summary || '',
            linksCount: analysis?.links?.length || 0,
            attachmentsCount: analysis?.attachments?.length || 0,
            caseId: caseItem?.id,
            fullAnalysis: analysis
          };

          recordSyncedEmail(syncedRecord);

          messagesProcessed.push({
            id: msgId,
            subject,
            from,
            threatScore,
            verdict,
            quarantined,
            actionTaken
          });

          this.metrics.messagesIngestedTotal++;
        } catch (msgErr: any) {
          console.error(`[GmailSyncEngine] Error processing delta message ${msgId}:`, msgErr?.message);
        }
      }

      // Advance historyId cursor
      if (targetHistoryId && Number(targetHistoryId) > Number(nextHistoryId)) {
        this.metrics.currentHistoryId = targetHistoryId;
      } else {
        this.metrics.currentHistoryId = nextHistoryId;
      }

      this.metrics.lastSyncAt = new Date().toISOString();
      this.metrics.deltasProcessedTotal++;

      const durationMs = Date.now() - startTime;

      broadcastWebSocketEvent({
        type: 'GMAIL_DELTA_SYNC_COMPLETED',
        startHistoryId,
        latestHistoryId: this.metrics.currentHistoryId,
        messagesAddedCount: addedIds.length,
        durationMs,
        timestamp: this.metrics.lastSyncAt
      }, this.config.orgId);

      return {
        success: true,
        startHistoryId,
        latestHistoryId: this.metrics.currentHistoryId,
        messagesAddedCount: addedIds.length,
        messagesProcessed,
        cursorExpired,
        durationMs
      };
    } catch (err: any) {
      console.error('[GmailSyncEngine] Delta synchronization failed:', err?.message);
      return {
        success: false,
        startHistoryId: this.metrics.currentHistoryId || '0',
        latestHistoryId: this.metrics.currentHistoryId || '0',
        messagesAddedCount: 0,
        messagesProcessed: [],
        cursorExpired: false,
        durationMs: Date.now() - startTime,
        error: err?.message
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Anchors baseline historyId from users.getProfile() when initializing.
   */
  private async anchorBaselineHistoryId(token: string): Promise<string> {
    try {
      await acquireGmailQuota(GMAIL_QUOTA_COSTS.MESSAGES_GET_METADATA, 'users.getProfile');
      const res = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000
      });
      const profileHistoryId = String(res.data?.historyId || Date.now());
      this.metrics.currentHistoryId = profileHistoryId;
      console.log(`[GmailSyncEngine] Anchored baseline historyId cursor: ${profileHistoryId}`);
      return profileHistoryId;
    } catch (err: any) {
      const fallback = String(Date.now());
      this.metrics.currentHistoryId = fallback;
      console.warn(`[GmailSyncEngine] Failed fetching profile historyId; using timestamp fallback: ${fallback}`);
      return fallback;
    }
  }

  /**
   * Tracks processed message IDs with memory bounded queue.
   */
  private markMessageAsProcessed(messageId: string): void {
    if (this.processedMessageIds.has(messageId)) return;
    this.processedMessageIds.add(messageId);
    this.processedMessageQueue.push(messageId);

    // Limit in-memory cache to 2,000 entries
    if (this.processedMessageQueue.length > 2000) {
      const oldestId = this.processedMessageQueue.shift();
      if (oldestId) this.processedMessageIds.delete(oldestId);
    }
  }

  // ===========================================================================
  // 3. Adaptive Watchdog Fallback Timer
  // ===========================================================================

  /**
   * Starts the 30-second automated watchdog loop.
   */
  public startWatchdog(intervalSeconds?: number): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
    }

    if (intervalSeconds) {
      this.config.watchdogIntervalSeconds = intervalSeconds;
    }

    const interval = this.config.watchdogIntervalSeconds * 1000;

    this.watchdogTimer = setInterval(async () => {
      this.metrics.lastWatchdogTickAt = new Date().toISOString();
      this.metrics.watchdogChecksTotal++;

      try {
        const status = getGmailStatus();
        if (!status.is_connected) {
          return; // Skip when not connected
        }

        // Check if watch has expired or push is delayed
        const now = Date.now();
        const lastPush = this.metrics.lastPushReceivedAt ? new Date(this.metrics.lastPushReceivedAt).getTime() : 0;
        const pushSilenceSeconds = Math.round((now - lastPush) / 1000);

        // If no push has arrived for > 45 seconds or watch is inactive, execute watchdog delta poll
        if (pushSilenceSeconds > 45 || !this.metrics.activeWatchExpiration) {
          console.log(`[GmailSyncEngine] Watchdog tick: Push silence of ${pushSilenceSeconds}s detected. Polling history delta...`);
          await this.syncHistoryDelta();
        }
      } catch (err: any) {
        console.warn('[GmailSyncEngine] Watchdog tick warning:', err?.message);
      }
    }, interval);

    console.log(`[GmailSyncEngine] Adaptive watchdog active (${this.config.watchdogIntervalSeconds}s interval).`);
  }

  /**
   * Stops the automated watchdog loop.
   */
  public stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
      console.log('[GmailSyncEngine] Adaptive watchdog stopped.');
    }
  }

  // ===========================================================================
  // 4. Label-Based SOC Quarantine Processing
  // ===========================================================================

  /**
   * Initializes and colorizes all standard SOC triage labels in Gmail.
   */
  public async ensureSocLabels(overrideToken?: string): Promise<Map<string, string>> {
    const token = await this.resolveToken(overrideToken);
    if (!token) {
      return new Map();
    }

    try {
      await acquireGmailQuota(GMAIL_QUOTA_COSTS.LABELS_LIST, 'users.labels.list');

      const listRes = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000
      });

      const existingLabels = listRes.data?.labels || [];
      const labelNameToId = new Map<string, string>();

      for (const l of existingLabels) {
        if (l.name && l.id) {
          labelNameToId.set(l.name.toLowerCase(), l.id);
          this.labelCache.set(l.name.toLowerCase(), { id: l.id, name: l.name });
        }
      }

      // Check and create missing standard SOC labels
      for (const [key, def] of Object.entries(STANDARD_SOC_LABELS)) {
        const lowerName = def.name.toLowerCase();
        if (!labelNameToId.has(lowerName)) {
          try {
            await acquireGmailQuota(GMAIL_QUOTA_COSTS.LABELS_CREATE, 'users.labels.create');

            const createRes = await axios.post(
              'https://gmail.googleapis.com/gmail/v1/users/me/labels',
              {
                name: def.name,
                labelListVisibility: def.labelListVisibility,
                messageListVisibility: def.messageListVisibility,
                color: {
                  backgroundColor: def.backgroundColor,
                  textColor: def.textColor
                }
              },
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                timeout: 8000
              }
            );

            const newId = createRes.data?.id;
            if (newId) {
              labelNameToId.set(lowerName, newId);
              this.labelCache.set(lowerName, { id: newId, name: def.name });
              console.log(`[GmailSyncEngine] Created standard SOC label: ${def.name} (${newId})`);
            }
          } catch (createErr: any) {
            console.warn(`[GmailSyncEngine] Could not create SOC label "${def.name}":`, createErr?.response?.data?.error?.message || createErr?.message);
          }
        }
      }

      return labelNameToId;
    } catch (err: any) {
      console.warn('[GmailSyncEngine] Error ensuring SOC labels:', err?.message);
      return new Map();
    }
  }

  /**
   * Applies an arbitrary SOC label to a message.
   */
  public async applySocLabel(messageId: string, labelName: string, overrideToken?: string): Promise<boolean> {
    const token = await this.resolveToken(overrideToken);
    if (!token) return false;

    let labelId = this.labelCache.get(labelName.toLowerCase())?.id;
    if (!labelId) {
      const refreshedMap = await this.ensureSocLabels(token);
      labelId = refreshedMap.get(labelName.toLowerCase());
    }

    if (!labelId) {
      console.warn(`[GmailSyncEngine] Target label "${labelName}" not found in Gmail.`);
      return false;
    }

    try {
      await acquireGmailQuota(GMAIL_QUOTA_COSTS.MESSAGES_MODIFY, 'users.messages.modify');

      await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/modify`,
        { addLabelIds: [labelId] },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 8000
        }
      );
      return true;
    } catch (err: any) {
      console.warn(`[GmailSyncEngine] Error adding label ${labelName} to message ${messageId}:`, err?.message);
      return false;
    }
  }

  /**
   * Quarantines a malicious email by stripping INBOX, adding TraceXMail/Quarantined label,
   * sending admin webhook notification, and recording audit entries.
   */
  public async quarantineMessage(
    params: {
      messageId: string;
      threatScore: number;
      verdict: string;
      subject?: string;
      from?: string;
      classification?: string;
      reason?: string;
    },
    overrideToken?: string
  ): Promise<QuarantineExecutionResult> {
    const auditLogId = `qlog_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const token = await this.resolveToken(overrideToken);

    if (!token) {
      return {
        success: false,
        messageId: params.messageId,
        appliedLabel: STANDARD_SOC_LABELS.QUARANTINED.name,
        labelsAdded: [],
        labelsRemoved: [],
        inboxBypassed: false,
        adminWebhookDispatched: false,
        auditLogId,
        error: 'No active Gmail OAuth credentials.'
      };
    }

    try {
      // 1. Ensure quarantine label exists
      let quarantineLabelId = this.labelCache.get(STANDARD_SOC_LABELS.QUARANTINED.name.toLowerCase())?.id;
      if (!quarantineLabelId) {
        const labels = await this.ensureSocLabels(token);
        quarantineLabelId = labels.get(STANDARD_SOC_LABELS.QUARANTINED.name.toLowerCase());
      }

      const addLabelIds: string[] = quarantineLabelId ? [quarantineLabelId] : [];
      const removeLabelIds: string[] = [];

      if (this.config.removeInboxLabelOnQuarantine) {
        removeLabelIds.push('INBOX');
      }
      if (this.config.markReadOnQuarantine) {
        removeLabelIds.push('UNREAD');
      }

      await acquireGmailQuota(GMAIL_QUOTA_COSTS.MESSAGES_MODIFY, 'users.messages.modify');

      // 2. Execute atomic label swap via Gmail API
      await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(params.messageId)}/modify`,
        {
          addLabelIds,
          removeLabelIds
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log(`[GmailSyncEngine] Message ${params.messageId} successfully quarantined. Stripped: [${removeLabelIds.join(', ')}], Added: [${addLabelIds.join(', ')}]`);

      // 3. Dispatch Admin Webhook if URL configured
      let adminWebhookDispatched = false;
      if (this.config.adminWebhookUrl) {
        adminWebhookDispatched = await this.dispatchAdminWebhook({
          event: 'SOC_EMAIL_QUARANTINED',
          timestamp: new Date().toISOString(),
          messageId: params.messageId,
          subject: params.subject,
          from: params.from,
          threatScore: params.threatScore,
          verdict: params.verdict,
          classification: params.classification,
          action: 'HOLD_QUARANTINED',
          appliedLabel: STANDARD_SOC_LABELS.QUARANTINED.name
        });
      }

      // 4. Record to Supabase audit log
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        supabase
          .from('quarantine_audit_log')
          .insert({
            id: auditLogId,
            organization_id: this.config.orgId,
            timestamp: new Date().toISOString(),
            message_id: params.messageId,
            subject: params.subject || '(No Subject)',
            from_address: params.from || 'unknown@sender',
            threat_score: params.threatScore,
            verdict: params.verdict,
            action: 'HOLD_QUARANTINED',
            delivery_stage: 'pre-delivery-hold',
            admin_webhook_dispatched: adminWebhookDispatched,
            applied_label: STANDARD_SOC_LABELS.QUARANTINED.name,
            raw_details: {
              labelsAdded: addLabelIds,
              labelsRemoved: removeLabelIds,
              quarantineThreshold: this.config.quarantineThreshold
            }
          })
          .then(({ error }) => {
            if (error) console.warn('[GmailSyncEngine] Audit log write notice:', error.message);
          });
      }

      // 5. Broadcast real-time WebSocket event
      broadcastWebSocketEvent({
        type: 'QUARANTINE_ACTION',
        messageId: params.messageId,
        subject: params.subject,
        from: params.from,
        threatScore: params.threatScore,
        verdict: params.verdict,
        appliedLabel: STANDARD_SOC_LABELS.QUARANTINED.name,
        timestamp: new Date().toISOString()
      }, this.config.orgId);

      const result: QuarantineExecutionResult = {
        success: true,
        messageId: params.messageId,
        appliedLabel: STANDARD_SOC_LABELS.QUARANTINED.name,
        labelsAdded: addLabelIds,
        labelsRemoved: removeLabelIds,
        inboxBypassed: removeLabelIds.includes('INBOX'),
        adminWebhookDispatched,
        auditLogId
      };

      this.emit('quarantine_executed', result);
      return result;
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error?.message || err?.message;
      console.error(`[GmailSyncEngine] Failed quarantining message ${params.messageId}:`, errorMsg);
      return {
        success: false,
        messageId: params.messageId,
        appliedLabel: STANDARD_SOC_LABELS.QUARANTINED.name,
        labelsAdded: [],
        labelsRemoved: [],
        inboxBypassed: false,
        adminWebhookDispatched: false,
        auditLogId,
        error: errorMsg
      };
    }
  }

  /**
   * Releases a quarantined message back to the INBOX.
   */
  public async releaseFromQuarantine(messageId: string, overrideToken?: string): Promise<{ success: boolean; error?: string }> {
    const token = await this.resolveToken(overrideToken);
    if (!token) {
      return { success: false, error: 'Valid Gmail OAuth access token required.' };
    }

    try {
      let quarantineLabelId = this.labelCache.get(STANDARD_SOC_LABELS.QUARANTINED.name.toLowerCase())?.id;
      let cleanLabelId = this.labelCache.get(STANDARD_SOC_LABELS.CLEAN.name.toLowerCase())?.id;

      if (!quarantineLabelId || !cleanLabelId) {
        const labelsMap = await this.ensureSocLabels(token);
        quarantineLabelId = quarantineLabelId || labelsMap.get(STANDARD_SOC_LABELS.QUARANTINED.name.toLowerCase());
        cleanLabelId = cleanLabelId || labelsMap.get(STANDARD_SOC_LABELS.CLEAN.name.toLowerCase());
      }

      const removeLabelIds: string[] = quarantineLabelId ? [quarantineLabelId] : [];
      const addLabelIds: string[] = ['INBOX'];
      if (cleanLabelId) addLabelIds.push(cleanLabelId);

      await acquireGmailQuota(GMAIL_QUOTA_COSTS.MESSAGES_MODIFY, 'users.messages.modify');

      await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/modify`,
        { addLabelIds, removeLabelIds },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 8000
        }
      );

      console.log(`[GmailSyncEngine] Released message ${messageId} back to INBOX.`);

      broadcastWebSocketEvent({
        type: 'QUARANTINE_RELEASED',
        messageId,
        timestamp: new Date().toISOString()
      }, this.config.orgId);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  }

  /**
   * Sends HTTP POST webhook alert to SOC endpoint.
   */
  private async dispatchAdminWebhook(payload: Record<string, any>): Promise<boolean> {
    if (!this.config.adminWebhookUrl) return false;
    try {
      const res = await axios.post(this.config.adminWebhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TraceXMail-SOAR-Webhook/2.5'
        },
        timeout: 5000
      });
      return res.status >= 200 && res.status < 300;
    } catch (err: any) {
      console.warn('[GmailSyncEngine] Admin webhook delivery warning:', err?.message);
      return false;
    }
  }

  // ===========================================================================
  // 5. Diagnostics & Status
  // ===========================================================================

  public getStatus() {
    const gmailState = getGmailStatus();

    return {
      orgId: this.config.orgId,
      isConnected: gmailState.is_connected,
      emailAddress: gmailState.email_address,
      cursor: {
        currentHistoryId: this.metrics.currentHistoryId,
        lastSyncAt: this.metrics.lastSyncAt,
        isSyncing: this.isSyncing
      },
      pushWatch: {
        active: Boolean(this.metrics.activeWatchExpiration && Date.now() < this.metrics.activeWatchExpiration),
        topicName: this.config.topicName,
        expiration: this.metrics.activeWatchExpiration,
        lastPushReceivedAt: this.metrics.lastPushReceivedAt
      },
      watchdog: {
        active: Boolean(this.watchdogTimer),
        intervalSeconds: this.config.watchdogIntervalSeconds,
        lastTickAt: this.metrics.lastWatchdogTickAt,
        checksTotal: this.metrics.watchdogChecksTotal
      },
      quarantine: {
        threshold: this.config.quarantineThreshold,
        removeInboxLabel: this.config.removeInboxLabelOnQuarantine,
        markRead: this.config.markReadOnQuarantine,
        totalQuarantined: this.metrics.messagesQuarantinedTotal
      },
      metrics: { ...this.metrics }
    };
  }

  public updateConfig(newConfig: Partial<SyncEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.watchdogIntervalSeconds && this.watchdogTimer) {
      this.startWatchdog(newConfig.watchdogIntervalSeconds);
    }
  }
}

// Global Singleton Instance
let singletonEngine: GmailSyncEngine | null = null;

export function getGmailSyncEngine(config?: Partial<SyncEngineConfig>): GmailSyncEngine {
  if (!singletonEngine) {
    singletonEngine = new GmailSyncEngine(config);
  } else if (config) {
    singletonEngine.updateConfig(config);
  }
  return singletonEngine;
}
