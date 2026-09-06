/**
 * Gmail Cloud Pub/Sub Push Subscription Management & Auto-Renewal Service
 *
 * Handles push-subscription lifecycle and automated renewal logic required
 * for near-instant, sub-second Gmail message interception and pre-delivery quarantine.
 *
 * Google Cloud Pub/Sub push subscriptions registered via Gmail's users.watch()
 * have a maximum time-to-live of 7 days. This service monitors the expiration window
 * and orchestrates automatic renewal before the subscription expires.
 */

const API_BASE_URL = (
  (import.meta as any).env?.VITE_API_URL ||
  ''
).replace(/\/$/, '');

export interface WatchSubscriptionState {
  active: boolean;
  enabled: boolean;
  topicName: string;
  historyId?: string | null;
  expiration: number | null;
  expirationDateFormatted?: string;
  timeRemaining?: string;
  isExpiringSoon?: boolean;
  lastRenewedAt?: string | null;
  lastPushReceivedAt?: string | null;
  error?: string | null;
}

export interface WatchResponse {
  status: 'ok' | 'error';
  success: boolean;
  active: boolean;
  historyId?: string;
  expiration?: number;
  topicName?: string;
  message?: string;
  error?: string;
}

type WatchEventListener = (state: WatchSubscriptionState) => void;

class GmailPubSubService {
  private currentState: WatchSubscriptionState = {
    active: false,
    enabled: false,
    topicName: 'projects/tracexmail-enterprise/topics/inbox-watch',
    expiration: null,
    lastRenewedAt: null,
    lastPushReceivedAt: null
  };

  private renewalTimer: any = null;
  private checkIntervalTimer: any = null;
  private countdownTickerTimer: any = null;
  private listeners: Set<WatchEventListener> = new Set();
  private isRenewing = false;

  constructor() {
    // Start periodic check for auto-renewal (checks every 30 minutes)
    this.startPeriodicExpirationCheck();
    // Start 60-second countdown ticker to continuously update remaining time
    this.startCountdownTicker();
  }

  /**
   * Subscribe to watch state changes
   */
  public subscribe(listener: WatchEventListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.warn('[GmailPubSub] Error in watch state listener:', err);
      }
    }
  }

  private startCountdownTicker(): void {
    if (this.countdownTickerTimer) clearInterval(this.countdownTickerTimer);
    this.countdownTickerTimer = setInterval(() => {
      if (this.currentState.active && this.currentState.expiration) {
        this.notifyListeners();
      }
    }, 60 * 1000);
  }

  /**
   * Returns current snapshot of watch subscription state with formatted dates and timers
   */
  public getState(): WatchSubscriptionState {
    const exp = this.currentState.expiration;
    const now = Date.now();
    const remainingMs = exp ? Math.max(0, exp - now) : 0;
    
    // Deemed expiring soon if less than 24 hours remaining
    const isExpiringSoon = Boolean(exp && remainingMs > 0 && remainingMs < 24 * 60 * 60 * 1000);

    return {
      ...this.currentState,
      expirationDateFormatted: exp ? this.formatExpirationDate(exp) : undefined,
      timeRemaining: exp ? this.formatTimeRemaining(remainingMs) : undefined,
      isExpiringSoon
    };
  }

  /**
   * Triggers the Gmail users.watch() API call to start or renew the Cloud Pub/Sub subscription.
   */
  public async startWatch(options?: {
    topicName?: string;
    labelIds?: string[];
    labelFilterAction?: 'include' | 'exclude';
    accessToken?: string;
  }): Promise<WatchResponse> {
    try {
      this.isRenewing = true;
      const topic = options?.topicName || this.currentState.topicName;
      const res = await fetch(`${API_BASE_URL}/api/gmail/watch/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options?.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {})
        },
        body: JSON.stringify({
          topicName: topic,
          labelIds: options?.labelIds || ['INBOX'],
          labelFilterAction: options?.labelFilterAction || 'include'
        })
      });

      const data: WatchResponse = await res.json();
      if (res.ok && data.success !== false) {
        const exp = data.expiration ? Number(data.expiration) : Date.now() + 7 * 24 * 60 * 60 * 1000;
        this.currentState = {
          active: true,
          enabled: true,
          topicName: data.topicName || topic,
          historyId: data.historyId || this.currentState.historyId,
          expiration: exp,
          lastRenewedAt: new Date().toISOString(),
          error: null
        };
        this.scheduleAutoRenewal(exp);
        this.notifyListeners();
        return data;
      } else {
        const errMsg = data.error || 'Failed to start Gmail watch() subscription';
        this.currentState.error = errMsg;
        this.notifyListeners();
        return {
          status: 'error',
          success: false,
          active: false,
          error: errMsg
        };
      }
    } catch (err: any) {
      const errMsg = err.message || 'Network failure communicating with Gmail watch API';
      this.currentState.error = errMsg;
      this.notifyListeners();
      return {
        status: 'error',
        success: false,
        active: false,
        error: errMsg
      };
    } finally {
      this.isRenewing = false;
    }
  }

  /**
   * Stops the Gmail users.watch() push subscription via users.stop().
   */
  public async stopWatch(options?: { accessToken?: string }): Promise<WatchResponse> {
    try {
      this.cancelScheduledRenewal();
      const res = await fetch(`${API_BASE_URL}/api/gmail/watch/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options?.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {})
        },
        body: JSON.stringify({})
      });

      const data: WatchResponse = await res.json();
      this.currentState = {
        ...this.currentState,
        active: false,
        enabled: false,
        expiration: null,
        error: null
      };
      this.notifyListeners();
      return data;
    } catch (err: any) {
      const errMsg = err.message || 'Failed to stop Gmail watch subscription';
      this.currentState.error = errMsg;
      this.notifyListeners();
      return {
        status: 'error',
        success: false,
        active: false,
        error: errMsg
      };
    }
  }

  /**
   * Fetches latest watch status from backend and synchronizes renewal timer
   */
  public async fetchStatus(): Promise<WatchSubscriptionState> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/gmail/status`);
      if (res.ok) {
        const data = await res.json();
        const watch = data.watch || {};
        this.currentState = {
          active: Boolean(watch.active),
          enabled: Boolean(watch.enabled),
          topicName: watch.topic_name || this.currentState.topicName,
          expiration: watch.expiration ? Number(watch.expiration) : null,
          lastPushReceivedAt: watch.last_push_received_at || null,
          error: null
        };
        if (this.currentState.active && this.currentState.expiration) {
          this.scheduleAutoRenewal(this.currentState.expiration);
        }
        this.notifyListeners();
      }
    } catch (err: any) {
      console.warn('[GmailPubSub] Failed to fetch watch status:', err?.message);
    }
    return this.getState();
  }

  /**
   * Schedules automated renewal 1 day (24 hours) prior to Google's 7-day expiration timestamp.
   */
  private scheduleAutoRenewal(expirationMs: number): void {
    this.cancelScheduledRenewal();

    const now = Date.now();
    // Renew 24 hours before expiration, or in 1 hour if already within 24 hours
    const renewInMs = Math.max(10 * 60 * 1000, expirationMs - now - (24 * 60 * 60 * 1000));

    console.log(`[GmailPubSub] Scheduled push-subscription auto-renewal in ${Math.round(renewInMs / (1000 * 60))} minutes.`);

    this.renewalTimer = setTimeout(async () => {
      if (this.currentState.active && !this.isRenewing) {
        console.log('[GmailPubSub] Executing scheduled users.watch() renewal cycle...');
        await this.startWatch({ topicName: this.currentState.topicName });
      }
    }, renewInMs);
  }

  /**
   * Periodic safety check running every 30 minutes to ensure subscription doesn't expire unnoticed
   */
  private startPeriodicExpirationCheck(): void {
    if (this.checkIntervalTimer) clearInterval(this.checkIntervalTimer);

    this.checkIntervalTimer = setInterval(async () => {
      if (this.currentState.active && this.currentState.expiration) {
        const remainingMs = this.currentState.expiration - Date.now();
        // If within 12 hours of expiration and not actively renewing, renew immediately
        if (remainingMs < 12 * 60 * 60 * 1000 && !this.isRenewing) {
          console.log('[GmailPubSub] Subscription is within 12 hours of expiry. Triggering proactive renewal.');
          await this.startWatch({ topicName: this.currentState.topicName });
        }
      }
    }, 30 * 60 * 1000);
  }

  private cancelScheduledRenewal(): void {
    if (this.renewalTimer) {
      clearTimeout(this.renewalTimer);
      this.renewalTimer = null;
    }
  }

  public formatExpirationDate(expirationMs: number): string {
    const d = new Date(expirationMs);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  }

  public formatTimeRemaining(remainingMs: number): string {
    if (remainingMs <= 0) return 'Expired (renewal required)';
    const totalSeconds = Math.floor(remainingMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h remaining`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  }
}

export const gmailPubSub = new GmailPubSubService();
