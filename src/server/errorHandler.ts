import { Request, Response, NextFunction } from 'express';
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

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const correlationId = err.correlationId || (req as any).correlationId || generateCorrelationId();

  // Multer File Limit Error handling
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File upload size exceeds the maximum allowed limit (10MB).',
      code: 'MAX_FILE_SIZE_EXCEEDED',
      correlationId
    });
  }

  // Multer / Upload file type filter error
  if (err.code === 'INVALID_FILE_TYPE' || err.message?.includes('Only email files')) {
    return res.status(400).json({
      error: err.message || 'Invalid file type. Only email files (.eml, .msg, .txt) are permitted.',
      code: 'INVALID_FILE_TYPE',
      correlationId
    });
  }

  // Zod Validation Error handling
  if (err instanceof ZodError) {
    const issues = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
    return res.status(400).json({
      error: 'Validation failed: Invalid request parameters.',
      details: issues,
      correlationId
    });
  }

  // Known public status codes (e.g. 400, 401, 403, 404, 429)
  const statusCode = err.statusCode || (res.statusCode && res.statusCode >= 400 && res.statusCode < 600 ? res.statusCode : 500);

  // Server-side detailed log
  console.error(`[ERROR][${correlationId}] ${req.method} ${req.path} - ${statusCode}`);
  console.error(err.stack || err.message || err);

  // Safe client response - no internal stack traces or raw error strings
  const clientMessage = (err.isPublic && err.message)
    ? err.message
    : (statusCode < 500 ? (err.message || 'Invalid request.') : 'An unexpected server error occurred while processing your request.');

  return res.status(statusCode).json({
    error: clientMessage,
    correlationId
  });
}
