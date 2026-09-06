import { z, ZodError } from 'zod';
import type { Request, Response, NextFunction } from 'express';

// -----------------------------------------------------------------------------
// Dangerous Binary Magic Signatures (Prevent Executable Code Injection)
// -----------------------------------------------------------------------------
function containsDangerousBinaryHeader(buffer: Buffer): { dangerous: boolean; signature?: string } {
  if (buffer.length < 4) return { dangerous: false };

  // Windows PE Executable / DLL ('MZ')
  if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
    return { dangerous: true, signature: 'PE/DOS Executable (MZ)' };
  }

  // Linux ELF Binary ('\x7FELF')
  if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
    return { dangerous: true, signature: 'Linux ELF Executable' };
  }

  // Java .class Bytecode (0xCAFEBABE)
  if (buffer[0] === 0xCA && buffer[1] === 0xFE && buffer[2] === 0xBA && buffer[3] === 0xBE) {
    return { dangerous: true, signature: 'Java Class Bytecode' };
  }

  // WebAssembly Binary ('\0asm')
  if (buffer[0] === 0x00 && buffer[1] === 0x61 && buffer[2] === 0x73 && buffer[3] === 0x6D) {
    return { dangerous: true, signature: 'WebAssembly Binary' };
  }

  // Apple Mach-O binaries
  const magic32 = buffer.readUInt32BE(0);
  if (magic32 === 0xFEEDFACE || magic32 === 0xFEEDFACF || magic32 === 0xCEFAEDFE || magic32 === 0xCFFAEDFE) {
    return { dangerous: true, signature: 'Apple Mach-O Binary' };
  }

  return { dangerous: false };
}

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// RFC 822 Content Structural & Security Validator
// -----------------------------------------------------------------------------
export function validateRFC822EmailContent(content: string | Buffer): { isValid: boolean; reason?: string } {
  if (!content) {
    return { isValid: false, reason: 'Empty email content provided.' };
  }

  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');

  // 1. Guard against executable binary uploads disguised with .eml or text extensions
  const binCheck = containsDangerousBinaryHeader(buf);
  if (binCheck.dangerous) {
    return {
      isValid: false,
      reason: `Uploaded file contains dangerous ${binCheck.signature} binary executable code and is prohibited.`
    };
  }

  // 2. Check for Outlook Compound Document (.msg format: 0xD0CF11E0A1B11AE1)
  if (
    buf.length >= 8 &&
    buf[0] === 0xD0 && buf[1] === 0xCF && buf[2] === 0x11 && buf[3] === 0xE0 &&
    buf[4] === 0xA1 && buf[5] === 0xB1 && buf[6] === 0x1A && buf[7] === 0xE1
  ) {
    return { isValid: true };
  }

  const str = buf.toString('utf-8', 0, Math.min(buf.length, 16384));

  if (!str || str.trim().length === 0) {
    return { isValid: false, reason: 'Email content is blank or contains no readable text.' };
  }

  // Check for PHP or direct script injection tags at start
  const trimmed = str.trimStart();
  if (trimmed.startsWith('<?php') || trimmed.startsWith('<%') || trimmed.startsWith('#!/bin/sh') || trimmed.startsWith('#!/bin/bash')) {
    return { isValid: false, reason: 'Executable script syntax detected in upload payload.' };
  }

  // Extract header block (everything before first double newline or first 4KB)
  const headerBlock = str.split(/\r?\n\r?\n/)[0] || str.substring(0, 4096);

  // Structural header patterns for RFC 822 / RFC 5322
  const requiredHeaderRegex = /^(Received|From|To|Subject|Date|Message-ID|Return-Path|DKIM-Signature|Authentication-Results|MIME-Version|Content-Type|Delivered-To|X-Mailer|Reply-To|Sender|In-Reply-To|References):/im;

  if (!requiredHeaderRegex.test(headerBlock)) {
    return {
      isValid: false,
      reason: 'Provided file or text lacks valid RFC 822 email headers (missing Received, From, To, Subject, Message-ID, etc.).'
    };
  }

  // Syntax check: header lines must have standard "Header-Name: Value" syntax
  const headerLines = headerBlock.split(/\r?\n/);
  let validHeaderCount = 0;
  for (const line of headerLines) {
    if (/^[A-Za-z0-9-_]+:\s*.+/i.test(line)) {
      validHeaderCount++;
    }
  }

  if (validHeaderCount === 0) {
    return {
      isValid: false,
      reason: 'Header block does not conform to RFC 822 "Field-Name: Value" header specification.'
    };
  }

  return { isValid: true };
}

export function isPlausibleRfc822(content: string | Buffer): boolean {
  return validateRFC822EmailContent(content).isValid;
}

/**
 * Express middleware for post-upload validation of email files and payloads.
 * Checks for RFC 822 structure and verifies buffer content before any parsing logic runs.
 * Rejects invalid files immediately.
 */
export function postUploadRfc822Validator(req: Request, res: Response, next: NextFunction) {
  let files: Express.Multer.File[] = [];
  if (Array.isArray(req.files)) {
    files = req.files;
  } else if (req.files && typeof req.files === 'object') {
    files = Object.values(req.files).flat() as Express.Multer.File[];
  } else if (req.file) {
    files = [req.file];
  }

  if (files && files.length > 0) {
    for (const file of files) {
      if (!file.buffer || file.buffer.length === 0) {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_RFC822_FORMAT',
          error: `File '${file.originalname || 'upload'}' is empty and cannot be processed as an RFC 822 email.`,
          filename: file.originalname,
          details: 'Empty buffer provided.'
        });
      }

      const validation = validateRFC822EmailContent(file.buffer);
      if (!validation.isValid) {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_RFC822_FORMAT',
          error: `File '${file.originalname || 'upload'}' failed RFC 822 structure validation: ${validation.reason}`,
          filename: file.originalname,
          details: validation.reason
        });
      }
    }
    return next();
  }

  // If no files uploaded via multipart, check for raw email in request body
  const rawBodyContent = req.body?.raw_email || req.body?.raw_content || req.body?.rawEml || req.body?.email;
  if (rawBodyContent && typeof rawBodyContent === 'string' && rawBodyContent.trim().length > 0) {
    const validation = validateRFC822EmailContent(rawBodyContent);
    if (!validation.isValid) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_RFC822_FORMAT',
        error: `Provided email payload failed RFC 822 structure validation: ${validation.reason}`,
        details: validation.reason
      });
    }
  }

  next();
}

// -----------------------------------------------------------------------------
// Zod Middleware Helper with Strict Rejection & Generic Error Response
// -----------------------------------------------------------------------------
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
          code: 'VALIDATION_FAILED',
          details: issues
        });
      }
      return res.status(400).json({
        error: 'Invalid request format.',
        code: 'INVALID_REQUEST'
      });
    }
  };
}

// -----------------------------------------------------------------------------
// Strict Schemas for All API Routes
// -----------------------------------------------------------------------------

export const authLoginSchema = z.object({
  email: z.string().trim().email('Valid email address required').max(254),
  password: z.string().min(1, 'Password is required').max(256)
}).strict();

export const authSignupSchema = z.object({
  email: z.string().trim().email('Valid email address required').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(256),
  name: z.string().trim().min(1).max(100).optional(),
  fullName: z.string().trim().min(1).max(100).optional(),
  role: z.enum(['admin', 'analyst', 'read_only', 'ADMIN', 'ANALYST', 'AUDITOR']).optional()
}).strict();

export const authResetPasswordSchema = z.object({
  email: z.string().trim().email('Valid email address required').max(254)
}).strict();

export const analyzeTextSchema = z.object({
  raw_email: z.string().min(10, 'Email raw text must be at least 10 characters').max(10 * 1024 * 1024).optional(),
  email_text: z.string().min(10, 'Email text must be at least 10 characters').max(10 * 1024 * 1024).optional(),
  force_refresh: z.boolean().optional().default(false)
}).refine((data) => !!(data.raw_email || data.email_text), {
  message: 'Either raw_email or email_text field is required for analysis.'
});

export const analyzeUrlSchema = z.object({
  url: z.string().trim().url('A valid HTTP/HTTPS URL is required').max(2048),
  force_refresh: z.boolean().optional().default(false)
}).strict();

export const createCaseSchema = z.object({
  title: z.string().trim().min(3, 'Case title must be at least 3 characters').max(200),
  description: z.string().max(10000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional().default('OPEN'),
  assignedTo: z.string().trim().max(100).optional(),
  tags: z.array(z.string().trim().max(50)).max(20).optional(),
  organization_id: z.string().trim().max(100).optional(),
  verdict: z.string().trim().max(100).optional(),
  threatScore: z.number().min(0).max(100).optional()
});

export const updateCaseSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().max(10000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  assignedTo: z.string().trim().max(100).optional(),
  tags: z.array(z.string().trim().max(50)).max(20).optional(),
  verdict: z.string().trim().max(100).optional()
}).strict();

export const caseStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
}).strict();

export const caseNotesSchema = z.object({
  notes: z.string().max(10000)
}).strict();

export const createCampaignSchema = z.object({
  name: z.string().trim().min(3, 'Campaign name must be at least 3 characters').max(200),
  threat_actor: z.string().trim().max(100).optional(),
  target_industry: z.string().trim().max(100).optional(),
  notes: z.string().max(5000).optional(),
  organization_id: z.string().trim().max(100).optional()
});

export const lookupIpSchema = z.object({
  ip: z.string().trim().refine((val) => {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (ipv4Regex.test(val)) {
      const parts = val.split('.').map(Number);
      return parts.every(p => p >= 0 && p <= 255);
    }
    return ipv6Regex.test(val);
  }, 'Valid IPv4 or IPv6 address required')
});

export const lookupDomainSchema = z.object({
  domain: z.string().trim().min(3).max(253).regex(
    /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/,
    'Valid fully-qualified domain name required (e.g. example.com)'
  )
});

export const lookupHashSchema = z.object({
  hash: z.string().trim().regex(
    /^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$|^[a-fA-F0-9]{64}$/,
    'Valid MD5 (32-hex), SHA-1 (40-hex), or SHA-256 (64-hex) hash string required'
  )
});

export const virustotalUrlSchema = analyzeUrlSchema;
export const virustotalFileSchema = lookupHashSchema;
export const ipParamSchema = lookupIpSchema;
export const domainParamSchema = lookupDomainSchema;

export const caseIdParamSchema = z.object({
  caseId: z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Alphanumeric case ID required')
});

export const campaignIdParamSchema = z.object({
  campaignId: z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Alphanumeric campaign ID required')
});

export const correctionSchema = z.object({
  case_id: z.string().trim().max(100).optional(),
  analyst_verdict: z.string().trim().max(50).optional(),
  label: z.string().trim().max(50).optional()
}).strict();

export const slackConfigSchema = z.object({
  webhook_url: z.string().trim().url().max(500).optional().or(z.literal('')),
  enabled: z.boolean().optional()
}).strict();

export const emailTestAlertSchema = z.object({
  recipientEmail: z.string().trim().email().max(254)
}).strict();

export const searchQuerySchema = z.object({
  q: z.string().trim().max(200).optional()
});
