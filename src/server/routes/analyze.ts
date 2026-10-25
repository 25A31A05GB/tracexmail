import express, { Request, Response, NextFunction } from 'express';
import { authenticatedLimiter, publicLimiter } from '../rateLimiter';
import { uploadEmailFiles, postUploadRfc822Validator } from '../middleware/uploads';
import { isPlausibleRfc822 } from '../validation';
import { parseRawEmailToAnalysis } from '../forensicPipeline';
import { type AuthenticatedRequest, requireAuth } from '../compliance';
import { logger } from '../logger';
import { addAnalyzeJob, getJob, getDlqJobs, retryDlqJob } from '../queue/index';

const SYNC_TIME_BUDGET_MS = parseInt(process.env.SYNC_ANALYSIS_TIMEOUT_MS || '10000', 10);

export function registerAnalyzeRoutes(app: express.Express): void {
  const allowPublicAnalyze = process.env.ALLOW_PUBLIC_ANALYZE === 'true' || process.env.NODE_ENV !== 'production';

  const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (allowPublicAnalyze) {
      return next();
    }
    return requireAuth(req, res, next);
  };

  const handleAnalyze = async (req: Request, res: Response, next: NextFunction) => {
    try {
      let rawContent = req.body?.raw_email || req.body?.raw_content || req.body?.rawEml || req.body?.email || '';
      let fileName = req.body?.filename || 'manual_submission.eml';
      const requestId = req.body?.requestId || req.body?.request_id || (req.query?.requestId as string) || undefined;
      const forceAsync = req.query?.async === 'true' || req.body?.async === true;

      if (req.file) {
        rawContent = req.file.buffer.toString('utf-8');
        fileName = req.file.originalname || fileName;
      }

      if (!rawContent || typeof rawContent !== 'string') {
        return res.status(400).json({
          status: 'error',
          code: 'MISSING_EMAIL_CONTENT',
          error: 'No raw email content or EML file was provided for forensic analysis.'
        });
      }

      if (!isPlausibleRfc822(rawContent)) {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_RFC822_FORMAT',
          error: 'Provided content or file does not contain valid RFC 822 email header structures.'
        });
      }

      const user = (req as AuthenticatedRequest).user;
      const orgId = user?.organizationId;
      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized: missing verified organization context' });
      }
      const userId = user?.userId;

      // If async explicitly requested, offload directly to queue
      if (forceAsync) {
        const job = await addAnalyzeJob({
          emailContent: rawContent,
          filename: fileName,
          size: Buffer.byteLength(rawContent),
          organizationId: orgId,
          userId,
          clientIp: req.ip
        });

        return res.status(202).json({
          status: 'queued',
          jobId: job.id,
          message: 'Analysis dispatched to background queue',
          pollUrl: `/api/jobs/${job.id}`
        });
      }

      // Race sync execution against the time budget
      const syncPromise = parseRawEmailToAnalysis(rawContent, fileName, requestId, user ? {
        userId: user.userId,
        userEmail: user.email,
        organizationId: user.organizationId
      } : undefined);

      let timeoutHandle: any;
      const timeoutPromise = new Promise<'TIMEOUT'>((resolve) => {
        timeoutHandle = setTimeout(() => resolve('TIMEOUT'), SYNC_TIME_BUDGET_MS);
      });

      const raced = await Promise.race([syncPromise, timeoutPromise]);
      clearTimeout(timeoutHandle);

      if (raced === 'TIMEOUT') {
        // Time budget exceeded; offload to queue and return 202 Accepted
        const job = await addAnalyzeJob({
          emailContent: rawContent,
          filename: fileName,
          size: Buffer.byteLength(rawContent),
          organizationId: orgId,
          userId,
          clientIp: req.ip
        });

        logger.info({ jobId: job.id, fileName }, 'Analysis exceeded synchronous budget; offloaded to background job');

        return res.status(202).json({
          status: 'queued',
          jobId: job.id,
          message: 'Analysis exceeded synchronous time budget and was queued for background processing',
          pollUrl: `/api/jobs/${job.id}`
        });
      }

      // Completed within time budget
      res.json({
        success: true,
        status: 'success',
        case: raced.case,
        analysis: raced.analysis,
        ...raced.analysis,
        isOfflineFallback: false
      });
    } catch (err: any) {
      logger.error({ error: err?.message }, '[Analyze] Email analysis error');
      next(err);
    }
  };

  const handleAnalyzeBatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files: Express.Multer.File[] = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
      if (!files || files.length === 0) {
        return handleAnalyze(req, res, next);
      }

      const user = (req as AuthenticatedRequest).user;
      const orgId = user?.organizationId;
      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized: missing verified organization context' });
      }
      const userId = user?.userId;

      // Batch uploads always return 202 Accepted with jobIds
      const queuedJobs = [];
      for (const file of files) {
        const rawContent = file.buffer.toString('utf-8');
        if (!isPlausibleRfc822(rawContent)) {
          return res.status(400).json({
            status: 'error',
            code: 'INVALID_RFC822_FORMAT',
            error: `File '${file.originalname}' does not contain valid RFC 822 email header structures.`
          });
        }

        const job = await addAnalyzeJob({
          emailContent: rawContent,
          filename: file.originalname || 'batch_file.eml',
          size: file.size,
          organizationId: orgId,
          userId,
          clientIp: req.ip
        });
        queuedJobs.push({ filename: file.originalname, jobId: job.id });
      }

      res.status(202).json({
        status: 'queued',
        count: queuedJobs.length,
        jobs: queuedJobs,
        message: 'Batch upload successfully enqueued for background processing'
      });
    } catch (err: any) {
      logger.error({ error: err?.message }, '[AnalyzeBatch] Email batch analysis error');
      next(err);
    }
  };

  // Job status polling endpoint scoped to caller's organization
  const handleGetJob = async (req: Request, res: Response) => {
    const jobId = req.params.jobId;
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized: missing verified organization context' });
    }

    const job = getJob(jobId, orgId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      id: job.id,
      queueName: job.queueName,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt
    });
  };

  // Routes
  app.post('/api/v1/analyze', authenticatedLimiter, authMiddleware, uploadEmailFiles, postUploadRfc822Validator, handleAnalyze);
  app.post('/api/v1/analyze/batch', authenticatedLimiter, authMiddleware, uploadEmailFiles, postUploadRfc822Validator, handleAnalyzeBatch);
  app.post('/api/analyze/raw', authenticatedLimiter, authMiddleware, uploadEmailFiles, postUploadRfc822Validator, handleAnalyze);
  app.post('/api/analyze/batch', authenticatedLimiter, authMiddleware, uploadEmailFiles, postUploadRfc822Validator, handleAnalyzeBatch);
  app.post('/api/analyze', authenticatedLimiter, authMiddleware, uploadEmailFiles, postUploadRfc822Validator, handleAnalyze);

  app.get('/api/jobs/:jobId', publicLimiter, handleGetJob);
  app.get('/api/v1/jobs/:jobId', publicLimiter, handleGetJob);

  // Dead Letter Queue Admin View & Retry
  app.get('/api/admin/dlq', publicLimiter, (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId;
    const items = getDlqJobs(orgId);
    res.json({ count: items.length, items });
  });

  app.post('/api/admin/dlq/retry/:jobId', publicLimiter, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const orgId = user?.organizationId;
    const success = await retryDlqJob(req.params.jobId, orgId);
    if (!success) {
      return res.status(404).json({ error: 'DLQ job not found' });
    }
    res.json({ success: true, message: 'Job requeued successfully' });
  });
}
