import type { Request, Response, NextFunction, RequestHandler } from 'express';
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

// -----------------------------------------------------------------------------
// Configurable Thresholds from Environment Variables (with secure fallbacks)
// -----------------------------------------------------------------------------
export const getRateLimitConfig = () => ({
  // Authentication Routes (stricter + exponential backoff)
  authWindowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  authBaseAttempts: Number(process.env.RATE_LIMIT_AUTH_BASE_ATTEMPTS) || 5, // free attempts before delay starts
  authMaxAttempts: Number(process.env.RATE_LIMIT_AUTH_MAX) || 15, // hard cap per window
  authInitialDelaySec: Number(process.env.RATE_LIMIT_AUTH_INITIAL_DELAY_SEC) || 2, // 2s start
  authBackoffFactor: Number(process.env.RATE_LIMIT_AUTH_BACKOFF_FACTOR) || 2, // doubles each time: 2s, 4s, 8s, 16s...
  authMaxDelaySec: Number(process.env.RATE_LIMIT_AUTH_MAX_DELAY_SEC) || 300, // max 5 minutes delay

  // Public Endpoints (moderate - sized for multi-tab SOC dashboard polling)
  publicWindowMs: Number(process.env.RATE_LIMIT_PUBLIC_WINDOW_MS) || 15 * 60 * 1000,
  publicMax: Number(process.env.RATE_LIMIT_PUBLIC_MAX) || 300,

  // Authenticated User Endpoints (high volume for active analyst workflows)
  authedWindowMs: Number(process.env.RATE_LIMIT_AUTHED_WINDOW_MS) || 15 * 60 * 1000,
  authedMax: Number(process.env.RATE_LIMIT_AUTHED_MAX) || 2000
});

// -----------------------------------------------------------------------------
// In-Memory Exponential Backoff Tracker for Authentication
// -----------------------------------------------------------------------------
interface AuthAttemptRecord {
  attempts: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
  nextAllowedAt: number;
  currentDelaySec: number;
}

const authIpStore = new Map<string, AuthAttemptRecord>();
const authAccountStore = new Map<string, AuthAttemptRecord>();

// Periodic pruning of expired backoff records
setInterval(() => {
  const now = Date.now();
  const windowMs = getRateLimitConfig().authWindowMs;

  for (const [key, record] of authIpStore.entries()) {
    if (now - record.lastAttemptAt > windowMs) {
      authIpStore.delete(key);
    }
  }
  for (const [key, record] of authAccountStore.entries()) {
    if (now - record.lastAttemptAt > windowMs) {
      authAccountStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown-ip';
}

function getAccountIdentifier(req: Request): string | null {
  const body = req.body;
  if (!body || typeof body !== 'object') return null;
  const raw = body.email || body.username || body.account || body.user;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.toLowerCase().trim();
  }
  return null;
}

function checkAndRecordAttempt(
  store: Map<string, AuthAttemptRecord>,
  key: string,
  config: ReturnType<typeof getRateLimitConfig>
): { allowed: boolean; retryAfterSeconds: number; attempts: number } {
  const now = Date.now();
  let record = store.get(key);

  if (!record || now - record.lastAttemptAt > config.authWindowMs) {
    record = {
      attempts: 1,
      firstAttemptAt: now,
      lastAttemptAt: now,
      nextAllowedAt: 0,
      currentDelaySec: 0
    };
    store.set(key, record);
    return { allowed: true, retryAfterSeconds: 0, attempts: 1 };
  }

  // If currently within an enforced exponential backoff interval
  if (now < record.nextAllowedAt) {
    const retryAfter = Math.ceil((record.nextAllowedAt - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfter), attempts: record.attempts };
  }

  // Check if reached max attempts for the window
  if (record.attempts >= config.authMaxAttempts) {
    const windowRemainingSec = Math.ceil((record.firstAttemptAt + config.authWindowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, windowRemainingSec), attempts: record.attempts };
  }

  // Record new attempt
  record.attempts += 1;
  record.lastAttemptAt = now;

  // Calculate exponential backoff once past base attempts threshold
  if (record.attempts > config.authBaseAttempts) {
    const exponent = record.attempts - config.authBaseAttempts;
    const computedDelay = Math.min(
      config.authMaxDelaySec,
      Math.round(config.authInitialDelaySec * Math.pow(config.authBackoffFactor, exponent - 1))
    );
    record.currentDelaySec = computedDelay;
    record.nextAllowedAt = now + computedDelay * 1000;
  }

  return { allowed: true, retryAfterSeconds: 0, attempts: record.attempts };
}

/**
 * Reset attempt count on successful authentication
 */
export function resetAuthRateLimit(req: Request) {
  const ip = getClientIp(req);
  const account = getAccountIdentifier(req);
  if (ip) authIpStore.delete(ip);
  if (account) authAccountStore.delete(account);
}

// -----------------------------------------------------------------------------
// Authentication Rate Limiting Middleware (Per-IP + Per-Account + Exponential Backoff)
// -----------------------------------------------------------------------------
export const authRateLimiter: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const config = getRateLimitConfig();
  const ip = getClientIp(req);
  const account = getAccountIdentifier(req);

  // 1. Check IP-level limits
  const ipCheck = checkAndRecordAttempt(authIpStore, ip, config);
  if (!ipCheck.allowed) {
    res.setHeader('Retry-After', ipCheck.retryAfterSeconds);
    return res.status(429).json({
      error: 'Too many authentication attempts from your network. Progressive backoff is active.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED_IP',
      retryAfterSeconds: ipCheck.retryAfterSeconds,
      attempts: ipCheck.attempts
    });
  }

  // 2. Check Account-level limits if account provided (protects individual accounts against distributed attacks)
  if (account) {
    const accountCheck = checkAndRecordAttempt(authAccountStore, account, config);
    if (!accountCheck.allowed) {
      res.setHeader('Retry-After', accountCheck.retryAfterSeconds);
      return res.status(429).json({
        error: `Too many authentication attempts for this account. Progressive backoff is active.`,
        code: 'AUTH_RATE_LIMIT_EXCEEDED_ACCOUNT',
        retryAfterSeconds: accountCheck.retryAfterSeconds,
        attempts: accountCheck.attempts
      });
    }
  }

  // Auto-reset rate limits on HTTP 200/201 responses
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      resetAuthRateLimit(req);
    }
  });

  next();
};

// -----------------------------------------------------------------------------
// Moderate Rate Limiter for Public Endpoints
// -----------------------------------------------------------------------------
export const publicRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: getRateLimitConfig().publicWindowMs,
  max: getRateLimitConfig().publicMax,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req: Request) => getClientIp(req),
  handler: (_req: Request, res: Response) => {
    const config = getRateLimitConfig();
    const retrySec = Math.ceil(config.publicWindowMs / 1000);
    res.setHeader('Retry-After', retrySec);
    res.status(429).json({
      error: 'Public rate limit exceeded. Please wait before making more requests.',
      code: 'PUBLIC_RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: retrySec
    });
  }
});

// -----------------------------------------------------------------------------
// Looser Rate Limiter for Authenticated User Actions
// -----------------------------------------------------------------------------
export const authenticatedRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: getRateLimitConfig().authedWindowMs,
  max: getRateLimitConfig().authedMax,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req: Request) => {
    const user = (req as any).user;
    if (user && (user.id || user.userId || user.sub)) {
      return `usr_${user.id || user.userId || user.sub}`;
    }
    return getClientIp(req);
  },
  handler: (_req: Request, res: Response) => {
    const config = getRateLimitConfig();
    const retrySec = Math.ceil(config.authedWindowMs / 1000);
    res.setHeader('Retry-After', retrySec);
    res.status(429).json({
      error: 'User action quota temporarily reached. Please retry shortly.',
      code: 'AUTHED_RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: retrySec
    });
  }
});

// -----------------------------------------------------------------------------
// Strict Rate Limiter for Sensitive Control Operations (Gmail Disconnect, Key Revocations)
// -----------------------------------------------------------------------------
export const strictRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 20, // Strict cap of 20 requests per 15 minutes to prevent rapid hammering / flapping
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req: Request) => {
    const user = (req as any).user;
    if (user && (user.id || user.userId || user.sub)) {
      return `strict_usr_${user.id || user.userId || user.sub}`;
    }
    return `strict_ip_${getClientIp(req)}`;
  },
  handler: (_req: Request, res: Response) => {
    const retrySec = 60;
    res.setHeader('Retry-After', retrySec);
    res.status(429).json({
      error: 'Strict security rate limit active. Please slow down requests to this security endpoint.',
      code: 'STRICT_RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: retrySec
    });
  }
});

// -----------------------------------------------------------------------------
// Generic Token Bucket Algorithm Implementation
// -----------------------------------------------------------------------------
export class TokenBucket {
  private capacity: number;
  private tokens: number;
  private refillRatePerMs: number;
  private lastRefillAt: number;

  constructor(options: { capacity: number; refillTokensPerSecond: number; initialTokens?: number }) {
    this.capacity = Math.max(1, options.capacity);
    this.refillRatePerMs = Math.max(0.000001, options.refillTokensPerSecond / 1000);
    this.tokens = options.initialTokens !== undefined ? Math.min(this.capacity, options.initialTokens) : this.capacity;
    this.lastRefillAt = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedMs = Math.max(0, now - this.lastRefillAt);
    if (elapsedMs > 0) {
      const addedTokens = elapsedMs * this.refillRatePerMs;
      this.tokens = Math.min(this.capacity, this.tokens + addedTokens);
      this.lastRefillAt = now;
    }
  }

  public getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public consume(cost: number = 1): {
    allowed: boolean;
    remainingTokens: number;
    retryAfterMs: number;
    retryAfterSeconds: number;
  } {
    this.refill();
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return {
        allowed: true,
        remainingTokens: Math.floor(this.tokens),
        retryAfterMs: 0,
        retryAfterSeconds: 0
      };
    }

    const deficit = cost - this.tokens;
    const retryAfterMs = Math.ceil(deficit / this.refillRatePerMs);
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

    return {
      allowed: false,
      remainingTokens: Math.floor(this.tokens),
      retryAfterMs,
      retryAfterSeconds
    };
  }

  public reset(): void {
    this.tokens = this.capacity;
    this.lastRefillAt = Date.now();
  }
}

// -----------------------------------------------------------------------------
// Sliding Window Rate Limiter Implementation
// -----------------------------------------------------------------------------
export class SlidingWindowLimiter {
  private windowMs: number;
  private maxRequests: number;
  private requestBuckets = new Map<string, number[]>();

  constructor(options: { windowMs: number; maxRequests: number }) {
    this.windowMs = Math.max(1000, options.windowMs);
    this.maxRequests = Math.max(1, options.maxRequests);
  }

  public check(key: string): {
    allowed: boolean;
    count: number;
    limit: number;
    remaining: number;
    resetAfterMs: number;
    resetAfterSeconds: number;
  } {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    let timestamps = this.requestBuckets.get(key) || [];

    // Prune entries older than sliding window
    timestamps = timestamps.filter(t => t > windowStart);

    if (timestamps.length >= this.maxRequests) {
      this.requestBuckets.set(key, timestamps);
      const oldestInWindow = timestamps[0] || now;
      const resetAfterMs = Math.max(0, (oldestInWindow + this.windowMs) - now);
      const resetAfterSeconds = Math.max(1, Math.ceil(resetAfterMs / 1000));
      return {
        allowed: false,
        count: timestamps.length,
        limit: this.maxRequests,
        remaining: 0,
        resetAfterMs,
        resetAfterSeconds
      };
    }

    timestamps.push(now);
    this.requestBuckets.set(key, timestamps);
    const oldestInWindow = timestamps[0] || now;
    const resetAfterMs = Math.max(0, (oldestInWindow + this.windowMs) - now);
    const resetAfterSeconds = Math.max(1, Math.ceil(resetAfterMs / 1000));

    return {
      allowed: true,
      count: timestamps.length,
      limit: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - timestamps.length),
      resetAfterMs,
      resetAfterSeconds
    };
  }

  public reset(key?: string): void {
    if (key) {
      this.requestBuckets.delete(key);
    } else {
      this.requestBuckets.clear();
    }
  }

  public prune(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    for (const [key, timestamps] of this.requestBuckets.entries()) {
      const filtered = timestamps.filter(t => t > windowStart);
      if (filtered.length === 0) {
        this.requestBuckets.delete(key);
      } else {
        this.requestBuckets.set(key, filtered);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Dedicated Token-Bucket + Sliding Window Limiter for Gmail Disconnect
// -----------------------------------------------------------------------------
// 1. Sliding Window: max 5 disconnect attempts per 5 minutes (300,000 ms)
const disconnectSlidingWindow = new SlidingWindowLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 5
});

// 2. Token Bucket: capacity of 3 tokens, refilling 1 token every 60 seconds (0.0166 tokens/sec)
const disconnectTokenBuckets = new Map<string, TokenBucket>();

function getDisconnectTokenBucket(key: string): TokenBucket {
  let bucket = disconnectTokenBuckets.get(key);
  if (!bucket) {
    bucket = new TokenBucket({
      capacity: 3,
      refillTokensPerSecond: 1 / 60, // 1 token every 60 seconds
      initialTokens: 3
    });
    disconnectTokenBuckets.set(key, bucket);
  }
  return bucket;
}

// Periodic cleanup of stale disconnect rate limiter state
setInterval(() => {
  disconnectSlidingWindow.prune();
}, 5 * 60 * 1000).unref();

export const gmailDisconnectRateLimiter: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const ip = getClientIp(req);
  const identifier = user?.organizationId 
    ? `org_${user.organizationId}` 
    : (user?.id || user?.userId ? `usr_${user.id || user.userId}` : `ip_${ip}`);

  // 1. Check sliding window limit (max 5 in 5m)
  const windowResult = disconnectSlidingWindow.check(identifier);
  if (!windowResult.allowed) {
    res.setHeader('Retry-After', windowResult.resetAfterSeconds);
    res.setHeader('X-RateLimit-Limit', '5');
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() + windowResult.resetAfterMs) / 1000));
    return res.status(429).json({
      error: 'Too many Gmail disconnect attempts in a short timeframe. Sliding window rate limit active to prevent integration flapping.',
      code: 'GMAIL_DISCONNECT_RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: windowResult.resetAfterSeconds,
      retryAfterMs: windowResult.resetAfterMs,
      limit: 5,
      windowMinutes: 5
    });
  }

  // 2. Check token bucket limit (burst protection: capacity 3, 1 token/min)
  const tokenBucket = getDisconnectTokenBucket(identifier);
  const bucketResult = tokenBucket.consume(1);
  if (!bucketResult.allowed) {
    res.setHeader('Retry-After', bucketResult.retryAfterSeconds);
    res.setHeader('X-RateLimit-Limit', '3');
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() + bucketResult.retryAfterMs) / 1000));
    return res.status(429).json({
      error: 'Gmail disconnect burst quota exhausted. Token bucket replenishment active to protect Google API quotas.',
      code: 'GMAIL_DISCONNECT_BURST_EXCEEDED',
      retryAfterSeconds: bucketResult.retryAfterSeconds,
      retryAfterMs: bucketResult.retryAfterMs
    });
  }

  res.setHeader('X-RateLimit-Limit', '5');
  res.setHeader('X-RateLimit-Remaining', windowResult.remaining.toString());
  next();
};

// Aliases for backwards compatibility
export const authLimiter = authRateLimiter;
export const publicLimiter = publicRateLimiter;
export const authenticatedLimiter = authenticatedRateLimiter;
export const strictLimiter = strictRateLimiter;
export const gmailDisconnectLimiter = gmailDisconnectRateLimiter;

