import pino from 'pino';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

export const REDACTION_PATHS = [
  'authorization',
  'cookie',
  'token',
  'secret',
  'password',
  'api_key',
  'apiKey',
  'refresh_token',
  'refreshToken',
  'access_token',
  'accessToken',
  'client_secret',
  'clientSecret',
  'private_key',
  'privateKey',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'headers.authorization',
  'headers.cookie',
  '*.authorization',
  '*.cookie',
  '*.token',
  '*.secret',
  '*.password',
  '*.api_key',
  '*.apiKey',
  '*.refresh_token',
  '*.refreshToken',
  '*.accessToken',
  '*.client_secret',
  '*.private_key'
];

export const logger = pino({
  level: logLevel,
  redact: {
    paths: REDACTION_PATHS,
    censor: '[REDACTED]'
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: (!isProduction && process.env.PINO_PRETTY !== 'false')
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:standard'
        }
      }
    : undefined
});

/**
 * Creates a child logger with bound contextual metadata (e.g. requestId, userId, orgId).
 */
export function createChildLogger(bindings: {
  requestId?: string;
  userId?: string;
  orgId?: string;
  module?: string;
  [key: string]: any;
}) {
  return logger.child(bindings);
}

/**
 * Redacts known sensitive fields from an arbitrary object recursively.
 * Useful before returning error responses or serializing state.
 */
export function redactSensitiveData<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;

  const SENSITIVE_KEYS = new Set([
    'authorization',
    'cookie',
    'token',
    'secret',
    'password',
    'api_key',
    'apikey',
    'refresh_token',
    'refreshtoken',
    'access_token',
    'accesstoken',
    'client_secret',
    'clientsecret',
    'private_key',
    'privatekey',
    'totpsecret',
    'totp_secret'
  ]);

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item)) as unknown as T;
  }

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      result[key] = redactSensitiveData(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Express middleware to propagate or assign x-request-id and attach scoped logger.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'] as string;
  const requestId = incomingId && incomingId.length <= 64 ? incomingId : crypto.randomUUID();

  // Set the response header
  res.setHeader('x-request-id', requestId);
  (req as any).requestId = requestId;

  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const user = (req as any).user;
    const orgId = user?.organizationId;
    const userId = user?.id || user?.userId;

    const logPayload = {
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: duration,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      ...(userId ? { userId } : {}),
      ...(orgId ? { orgId } : {})
    };

    const rawUrl = req.originalUrl || req.url;
    // Skip dev server internal assets, HMR, and source module requests
    const isDevAsset =
      rawUrl.startsWith('/@') ||
      rawUrl.startsWith('/src/') ||
      rawUrl.startsWith('/node_modules/') ||
      rawUrl.startsWith('/assets/') ||
      rawUrl.endsWith('.tsx') ||
      rawUrl.endsWith('.ts') ||
      rawUrl.endsWith('.css') ||
      rawUrl.endsWith('.js') ||
      rawUrl.endsWith('.map');

    if (isDevAsset && res.statusCode < 400) {
      return;
    }

    if (res.statusCode >= 500) {
      logger.error(logPayload, `HTTP ${req.method} ${rawUrl} failed with ${res.statusCode}`);
    } else if (res.statusCode >= 400) {
      logger.warn(logPayload, `HTTP ${req.method} ${rawUrl} client warning ${res.statusCode}`);
    } else if (!rawUrl.startsWith('/api/health')) {
      logger.info(logPayload, `HTTP ${req.method} ${rawUrl} completed ${res.statusCode}`);
    }
  });

  next();
}

export default logger;
