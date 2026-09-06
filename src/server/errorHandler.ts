import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  correlationId?: string;
  isPublic?: boolean;
  code?: string;
}

export function generateCorrelationId(): string {
  return `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Strips internal paths, SQL queries, or sensitive stack details from any error message
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return 'An unexpected error occurred.';
  
  // Strip filesystem paths like /app/..., /home/..., /usr/..., C:\...
  let clean = message.replace(/(?:\/[a-zA-Z0-9_.-]+)+/g, '[path]');
  clean = clean.replace(/[a-zA-Z]:\\[a-zA-Z0-9_.\\]+/g, '[path]');
  
  // Detect database / SQL keywords and replace with generic message
  const dbPatterns = /(?:syntax error at or near|relation ".*" does not exist|column ".*" does not exist|duplicate key value violates unique constraint|violates foreign key constraint|PostgresError|supabase|pg_catalog|SQLSTATE)/i;
  if (dbPatterns.test(clean)) {
    return 'A database operation failed. The incident has been logged.';
  }

  return clean;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const correlationId = err.correlationId || (req as any).correlationId || generateCorrelationId();

  // 1. Multer File Limit Error handling
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File upload size exceeds the maximum allowed limit of 20MB.',
      code: 'MAX_FILE_SIZE_EXCEEDED',
      correlationId
    });
  }

  // 2. Multer / Upload file type filter error
  if (
    err.code === 'INVALID_FILE_TYPE' ||
    err.message?.includes('Only email files') ||
    err.message?.includes('dangerous') ||
    err.message?.includes('binary executable') ||
    err.message?.includes('non-email MIME type')
  ) {
    return res.status(400).json({
      error: err.message || 'Invalid file upload. Only verified RFC 822 email files (.eml, .msg, .txt) with email MIME types and without binary executable headers are permitted.',
      code: 'INVALID_FILE_TYPE',
      correlationId
    });
  }

  // 3. Zod Validation Error handling
  if (err instanceof ZodError) {
    const issues = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
    return res.status(400).json({
      error: 'Validation failed: Invalid request parameters.',
      code: 'VALIDATION_FAILED',
      details: issues,
      correlationId
    });
  }

  // 4. Rate Limiting / 429 errors
  if (err.statusCode === 429 || (err as any).status === 429) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Please wait before retrying.',
      code: err.code || 'RATE_LIMIT_EXCEEDED',
      correlationId
    });
  }

  const statusCode = err.statusCode || (res.statusCode && res.statusCode >= 400 && res.statusCode < 600 ? res.statusCode : 500);

  // 5. Server-side detailed logging with full stack and correlationId for diagnostics
  console.error(`[SERVER_ERROR][${correlationId}] ${req.method} ${req.path} - HTTP ${statusCode}`);
  console.error(err.stack || err.message || err);

  // 6. Generic sanitized client response: no stack traces, no internal paths, no raw SQL
  let clientMessage: string;
  if (statusCode < 500) {
    // 4xx client errors: return sanitized message
    clientMessage = sanitizeErrorMessage(err.message || 'Invalid request.');
  } else {
    // 5xx server errors: NEVER return raw server exception to user
    clientMessage = 'An unexpected server error occurred while processing your request. Please contact support with the correlation ID.';
  }

  return res.status(statusCode).json({
    error: clientMessage,
    code: err.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
    correlationId
  });
}
