import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';

// Read threshold environment variables with fallback defaults
const AUTH_WINDOW_MS = Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes default
const AUTH_MAX = Number(process.env.RATE_LIMIT_AUTH_MAX) || 10; // 10 attempts per window

const PUBLIC_WINDOW_MS = Number(process.env.RATE_LIMIT_PUBLIC_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes default
const PUBLIC_MAX = Number(process.env.RATE_LIMIT_PUBLIC_MAX) || 100; // 100 requests per window

const AUTHED_WINDOW_MS = Number(process.env.RATE_LIMIT_AUTHED_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes default
const AUTHED_MAX = Number(process.env.RATE_LIMIT_AUTHED_MAX) || 500; // 500 requests per window

// Rate limiter for Auth endpoints (login, signup, reset password)
// Combines per-IP and per-account (email/username from body)
export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  max: AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req: Request) => {
    const email = req.body?.email || req.body?.username || req.body?.account;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown-ip';
    return email ? `${clientIp}:${String(email).toLowerCase().trim()}` : String(clientIp);
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many authentication attempts from this IP/account. Please try again later.',
      retryAfterSeconds: Math.ceil(AUTH_WINDOW_MS / 1000)
    });
  }
});

// Rate limiter for public unauthenticated endpoints
export const publicRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: PUBLIC_WINDOW_MS,
  max: PUBLIC_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Rate limit exceeded for public requests. Please try again later.',
      retryAfterSeconds: Math.ceil(PUBLIC_WINDOW_MS / 1000)
    });
  }
});

// Scoped per-user via req.user.userId / req.user.id if authenticated, falling back to IP
export const authenticatedRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: AUTHED_WINDOW_MS,
  max: AUTHED_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req: Request) => {
    const user = (req as any).user;
    if (user && (user.id || user.userId || user.sub)) {
      return `user:${user.id || user.userId || user.sub}`;
    }
    return req.ip || String(req.headers['x-forwarded-for']) || 'unknown-ip';
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests. Scoped user rate limit reached.',
      retryAfterSeconds: Math.ceil(AUTHED_WINDOW_MS / 1000)
    });
  }
});

// Export aliases for backwards compatibility
export const authLimiter = authRateLimiter;
export const publicLimiter = publicRateLimiter;
export const authenticatedLimiter = authenticatedRateLimiter;

