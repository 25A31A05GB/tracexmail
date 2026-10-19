import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import crypto from 'crypto';
import { logger } from '../logger';
import {
  QueueName,
  AnalyzeJobPayload,
  EnrichmentJobPayload,
  GmailSyncJobPayload,
  ReportGenerationJobPayload,
  RetentionJobPayload,
  NotificationJobPayload,
  StoredJobRecord,
  JobStatus
} from './types';
import { broadcastWebSocketEvent } from '../websocket';

const isProduction = process.env.NODE_ENV === 'production';
const redisUrl = process.env.REDIS_URL;

if (isProduction && (!redisUrl || redisUrl.trim().length === 0)) {
  logger.warn(
    '[Queue Warning] REDIS_URL not configured in environment. Operating background queues in resilient in-process local mode. Provisioning a Redis instance is recommended for distributed worker scaling.'
  );
}

export const QUEUE_NAMES: QueueName[] = [
  'analyze',
  'enrichment',
  'gmail-sync',
  'report-generation',
  'retention',
  'notifications'
];

let redisConnection: IORedis | null = null;
const bullQueues = new Map<QueueName, Queue>();
const inMemoryJobs = new Map<string, StoredJobRecord>();
const processedGmailKeys = new Set<string>(); // `${messageId}:${historyId || ''}`
const dlqStore: StoredJobRecord[] = [];

// Initialize Redis if configured
if (redisUrl) {
  try {
    redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true
    });
    redisConnection.on('error', (err) => {
      logger.error({ error: err.message }, 'Redis connection error');
    });

    for (const qName of QUEUE_NAMES) {
      bullQueues.set(
        qName,
        new Queue(qName, {
          connection: redisConnection,
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000
            },
            removeOnComplete: 1000,
            removeOnFail: 5000
          }
        })
      );
    }
    logger.info('BullMQ initialized with Redis');
  } catch (err: any) {
    if (isProduction) {
      throw new Error(`Failed to initialize BullMQ Redis in production: ${err.message}`);
    } else {
      logger.warn({ error: err.message }, 'Redis initialization failed; falling back to in-process queue');
      redisConnection = null;
    }
  }
} else {
  logger.info('Running with in-process background job queues (dev mode)');
}

/**
 * Checks if a Gmail message has already been processed using idempotency key.
 * Returns true if new (safe to process), false if duplicate.
 */
export function recordIdempotentGmailProcessing(messageId: string, historyId?: string): boolean {
  const key = `${messageId}:${historyId || 'initial'}`;
  if (processedGmailKeys.has(key)) {
    return false;
  }
  processedGmailKeys.add(key);
  // Keep idempotency cache bounded
  if (processedGmailKeys.size > 10000) {
    const firstKey = processedGmailKeys.values().next().value;
    if (firstKey) processedGmailKeys.delete(firstKey);
  }
  return true;
}

/**
 * Helper to update job status and notify client via WebSocket.
 */
export function updateJobStatus(
  jobId: string,
  update: Partial<StoredJobRecord>
): StoredJobRecord | null {
  const job = inMemoryJobs.get(jobId);
  if (!job) return null;

  Object.assign(job, update, { updatedAt: Date.now() });

  if (update.status === 'completed') {
    job.completedAt = Date.now();
    job.progress = 100;
  } else if (update.status === 'failed') {
    job.failedAt = Date.now();
  }

  // Push progress event over WebSocket scoped to organization
  try {
    broadcastWebSocketEvent(job.organizationId, 'job:progress', {
      jobId: job.id,
      queueName: job.queueName,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error
    });
  } catch {
    // Ignore WebSocket push errors
  }

  return job;
}

/**
 * Move a job into Dead Letter Queue (DLQ).
 */
export function sendToDlq(job: StoredJobRecord, reason: string): void {
  job.status = 'failed';
  job.error = reason;
  job.failedAt = Date.now();
  dlqStore.push(job);
  logger.warn({ jobId: job.id, queue: job.queueName, reason }, 'Job moved to Dead-Letter Queue (DLQ)');
}

/**
 * Returns Dead Letter Queue records, optionally filtered by orgId.
 */
export function getDlqJobs(orgId?: string): StoredJobRecord[] {
  if (orgId) {
    return dlqStore.filter(j => j.organizationId === orgId);
  }
  return [...dlqStore];
}

/**
 * Retries a job from the Dead Letter Queue.
 */
export async function retryDlqJob(jobId: string): Promise<boolean> {
  const idx = dlqStore.findIndex(j => j.id === jobId);
  if (idx === -1) return false;

  const [job] = dlqStore.splice(idx, 1);
  job.status = 'queued';
  job.attempts = 0;
  job.error = undefined;
  inMemoryJobs.set(job.id, job);

  // Re-enqueue
  await enqueueJob(job.queueName, job.data, job.organizationId, job.id);
  return true;
}

/**
 * Base enqueuer that supports both BullMQ and in-process fallback.
 */
async function enqueueJob<T>(
  queueName: QueueName,
  data: T,
  organizationId: string,
  explicitId?: string
): Promise<StoredJobRecord> {
  const jobId = explicitId || crypto.randomUUID();
  const record: StoredJobRecord = {
    id: jobId,
    queueName,
    status: 'queued',
    progress: 0,
    data,
    organizationId,
    attempts: 0,
    maxAttempts: 3,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  inMemoryJobs.set(jobId, record);

  const bullQueue = bullQueues.get(queueName);
  if (bullQueue && redisConnection) {
    try {
      await bullQueue.add(queueName, data, { jobId });
      return record;
    } catch (err: any) {
      logger.warn({ queueName, error: err.message }, 'Failed adding to BullMQ queue, falling back to local runner');
    }
  }

  // Trigger local in-process worker handler asynchronously
  setImmediate(async () => {
    try {
      const { processLocalJob } = await import('./workers');
      await processLocalJob(record);
    } catch (err: any) {
      logger.error({ jobId, error: err.message }, 'In-process job execution failed');
      updateJobStatus(jobId, { status: 'failed', error: err.message });
      sendToDlq(record, err.message);
    }
  });

  return record;
}

// Public Enqueue Helpers
export async function addAnalyzeJob(payload: AnalyzeJobPayload): Promise<StoredJobRecord> {
  return enqueueJob('analyze', payload, payload.organizationId);
}

export async function addEnrichmentJob(payload: EnrichmentJobPayload): Promise<StoredJobRecord> {
  return enqueueJob('enrichment', payload, payload.organizationId);
}

export async function addGmailSyncJob(payload: GmailSyncJobPayload): Promise<StoredJobRecord> {
  return enqueueJob('gmail-sync', payload, payload.organizationId);
}

export async function addReportGenerationJob(payload: ReportGenerationJobPayload): Promise<StoredJobRecord> {
  return enqueueJob('report-generation', payload, payload.organizationId);
}

export async function addRetentionJob(payload: RetentionJobPayload): Promise<StoredJobRecord> {
  return enqueueJob('retention', payload, payload.organizationId);
}

export async function addNotificationJob(payload: NotificationJobPayload): Promise<StoredJobRecord> {
  return enqueueJob('notifications', payload, payload.organizationId);
}

/**
 * Retrieves a job status record, enforcing tenant organization isolation.
 */
export function getJob(jobId: string, organizationId?: string): StoredJobRecord | null {
  const job = inMemoryJobs.get(jobId);
  if (!job) return null;
  if (organizationId && job.organizationId !== organizationId && job.organizationId !== 'default-org') {
    return null; // Tenant isolation: access denied
  }
  return job;
}

/**
 * Returns queue depth and metrics.
 */
export async function getQueueMetrics(): Promise<{ [key in QueueName]?: { waiting: number; active: number; failed: number } }> {
  const metrics: any = {};
  for (const qName of QUEUE_NAMES) {
    const q = bullQueues.get(qName);
    if (q) {
      try {
        const counts = await q.getJobCounts('waiting', 'active', 'failed');
        metrics[qName] = counts;
      } catch {
        metrics[qName] = { waiting: 0, active: 0, failed: 0 };
      }
    } else {
      // In-memory count
      const matching = Array.from(inMemoryJobs.values()).filter(j => j.queueName === qName);
      metrics[qName] = {
        waiting: matching.filter(j => j.status === 'queued').length,
        active: matching.filter(j => j.status === 'active').length,
        failed: matching.filter(j => j.status === 'failed').length
      };
    }
  }
  return metrics;
}

/**
 * Graceful shutdown for worker and api instances.
 */
export async function gracefulShutdownQueues(): Promise<void> {
  logger.info('Initiating graceful shutdown of queues and connections...');
  for (const [name, queue] of bullQueues.entries()) {
    try {
      await queue.close();
      logger.info(`Closed queue ${name}`);
    } catch (err: any) {
      logger.warn({ queue: name, error: err.message }, 'Error closing queue');
    }
  }
  if (redisConnection) {
    try {
      await redisConnection.quit();
      logger.info('Closed Redis connection');
    } catch {
      redisConnection.disconnect();
    }
  }
}
