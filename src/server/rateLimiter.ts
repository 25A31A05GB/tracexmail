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

  // Public Endpoints (moderate)
  publicWindowMs: Number(process.env.RATE_LIMIT_PUBLIC_WINDOW_MS) || 15 * 60 * 1000,
  publicMax: Number(process.env.RATE_LIMIT_PUBLIC_MAX) || 100,

  // Authenticated User Endpoints (looser)
  authedWindowMs: Number(process.env.RATE_LIMIT_AUTHED_WINDOW_MS) || 15 * 60 * 1000,
  authedMax: Number(process.env.RATE_LIMIT_AUTHED_MAX) || 1000
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

function getClientIp(req: Request): string {
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

// Aliases for backwards compatibility
export const authLimiter = authRateLimiter;
export const publicLimiter = publicRateLimiter;
export const authenticatedLimiter = authenticatedRateLimiter;
