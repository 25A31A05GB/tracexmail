import { z, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';

// RFC 822 Content Structural Validator
export function validateRFC822EmailContent(content: string | Buffer): { isValid: boolean; reason?: string } {
  if (!content) {
    return { isValid: false, reason: 'Empty email content provided.' };
  }

  const str = typeof content === 'string'
    ? content
    : content.toString('utf-8', 0, Math.min(content.length, 16384));

  if (!str || str.trim().length === 0) {
    return { isValid: false, reason: 'Email content is blank or contains no readable text.' };
  }

  // Extract header block (everything before first double newline or first 4KB)
  const headerBlock = str.split(/\r?\n\r?\n/)[0] || str.substring(0, 4096);

  // Structural header patterns for RFC 822
  const requiredHeaderRegex = /^(Received|From|To|Subject|Date|Message-ID|Return-Path|DKIM-Signature|Authentication-Results|MIME-Version|Content-Type):/im;

  if (!requiredHeaderRegex.test(headerBlock)) {
    return {
      isValid: false,
      reason: 'Provided file or text lacks RFC 822 email headers (missing Received, From, Subject, Message-ID, etc.).'
    };
  }

  return { isValid: true };
}

// Zod Middleware Helper
export function validateRequest(schemas: {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as any;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as any;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message
        }));
        return res.status(400).json({
          error: 'Validation failed: Invalid request payload.',
          details: issues
        });
      }
      return res.status(400).json({ error: 'Invalid request format.' });
    }
  };
}

// Schemas for API Routes

export const authLoginSchema = z.object({
  email: z.string().email('Valid email address required'),
  password: z.string().min(1, 'Password is required')
});

export const authSignupSchema = z.object({
  email: z.string().email('Valid email address required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
  role: z.enum(['ADMIN', 'ANALYST', 'AUDITOR']).optional()
});

export const authResetPasswordSchema = z.object({
  email: z.string().email('Valid email address required')
});

export const analyzeTextSchema = z.object({
  raw_email: z.string().min(10, 'Email raw text must be at least 10 characters').optional(),
  email_text: z.string().min(10).optional(),
  force_refresh: z.boolean().optional().default(false)
}).refine((data) => !!(data.raw_email || data.email_text), {
  message: 'Either raw_email or email_text field is required for analysis.'
});

export const analyzeUrlSchema = z.object({
  url: z.string().url('A valid URL is required'),
  force_refresh: z.boolean().optional().default(false)
});

export const createCaseSchema = z.object({
  title: z.string().min(3, 'Case title must be at least 3 characters').max(200),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional().default('OPEN'),
  assignedTo: z.string().optional(),
  tags: z.array(z.string()).optional()
});

export const updateCaseSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  assignedTo: z.string().optional(),
  tags: z.array(z.string()).optional(),
  verdict: z.string().optional()
});

export const lookupIpSchema = z.object({
  ip: z.string().refine((val) => {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(val) || ipv6Regex.test(val);
  }, 'Valid IPv4 or IPv6 address required')
});

export const lookupDomainSchema = z.object({
  domain: z.string().min(3, 'Domain name required')
});

export const lookupHashSchema = z.object({
  hash: z.string().refine((val) => {
    return /^[a-fA-F0-9]{32}$/.test(val) || /^[a-fA-F0-9]{40}$/.test(val) || /^[a-fA-F0-9]{64}$/.test(val);
  }, 'Valid MD5, SHA-1, or SHA-256 hex string required')
});

export const virustotalUrlSchema = analyzeUrlSchema;
export const virustotalFileSchema = lookupHashSchema;
export const ipParamSchema = lookupIpSchema;
export const domainParamSchema = lookupDomainSchema;
export const caseIdParamSchema = z.object({ caseId: z.string().min(1) });
export const campaignIdParamSchema = z.object({ campaignId: z.string().min(1) });
export const correctionSchema = z.object({
  case_id: z.string().optional(),
  analyst_verdict: z.string().optional(),
  label: z.string().optional()
});
export const slackConfigSchema = z.object({
  webhook_url: z.string().optional(),
  enabled: z.boolean().optional()
});
export const emailTestAlertSchema = z.object({ recipientEmail: z.string().email() });

export function isPlausibleRfc822(content: string | Buffer): boolean {
  return validateRFC822EmailContent(content).isValid;
}
