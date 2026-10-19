import multer from 'multer';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { isPlausibleRfc822 } from '../validation';

export const ALLOWED_EMAIL_MIME_TYPES = new Set([
  'message/rfc822',
  'application/vnd.ms-outlook',
  'text/plain',
  'text/x-mail',
  'text/x-eml',
  'multipart/mixed',
  'multipart/alternative',
  'multipart/related',
  'multipart/signed',
  'multipart/encrypted',
  'application/octet-stream' // Permitted only in combination with email extensions (.eml, .msg, .rfc822, .mime, .txt, .emlx)
]);

export const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_UPLOAD_FILE_COUNT = 10;

const uploadStorage = multer.memoryStorage();

const multerInstance = multer({
  storage: uploadStorage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
    files: MAX_UPLOAD_FILE_COUNT,
    fieldSize: MAX_UPLOAD_SIZE_BYTES,
    fields: 30,
    parts: 100
  },
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = /\.(eml|msg|txt|mime|rfc822|emlx)$/i;
    const normalizedMime = (file.mimetype || '').toLowerCase().trim();

    // 1. Strictly reject non-email MIME types
    if (!ALLOWED_EMAIL_MIME_TYPES.has(normalizedMime)) {
      const error: any = new Error(
        `Rejected non-email MIME type '${file.mimetype}'. Only email MIME types (e.g., message/rfc822, application/vnd.ms-outlook, text/plain) are permitted.`
      );
      error.code = 'INVALID_FILE_TYPE';
      error.status = 400;
      return cb(error);
    }

    // 2. Reject non-email file extensions
    if (!allowedExtensions.test(file.originalname)) {
      const error: any = new Error(
        `Rejected file with invalid extension '${file.originalname}'. Only email files (.eml, .msg, .txt, .mime, .rfc822) are permitted.`
      );
      error.code = 'INVALID_FILE_TYPE';
      error.status = 400;
      return cb(error);
    }

    cb(null, true);
  }
});

// Explicitly typed multer middleware for array of email files
export const uploadEmailFiles: RequestHandler = multerInstance.array('files', MAX_UPLOAD_FILE_COUNT) as unknown as RequestHandler;

// Middleware that validates uploaded buffers are plausible RFC 822 format
export const postUploadRfc822Validator: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const files: Express.Multer.File[] = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
  for (const f of files) {
    if (f.buffer) {
      const content = f.buffer.toString('utf-8');
      if (!isPlausibleRfc822(content)) {
        res.status(400).json({
          status: 'error',
          code: 'INVALID_RFC822_FORMAT',
          error: `File '${f.originalname}' does not contain valid RFC 822 email header structures.`
        });
        return;
      }
    }
  }
  next();
};
