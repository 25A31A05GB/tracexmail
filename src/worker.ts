import dotenv from 'dotenv';
dotenv.config();

import { logger } from './server/logger';
import { QUEUE_NAMES, gracefulShutdownQueues } from './server/queue/index';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import {
  processAnalyzeJob,
  processEnrichmentJob,
  processGmailSyncJob,
  processReportGenerationJob,
  processRetentionJob,
  processNotificationJob
} from './server/queue/workers';

logger.info('Starting TraceXMail Background Queue Worker...');

const redisUrl = process.env.REDIS_URL;
let activeWorkers: Worker[] = [];

if (redisUrl) {
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });

  const workerMap: Record<string, (job: any) => Promise<any>> = {
    'analyze': (j) => processAnalyzeJob({ id: j.id, queueName: 'analyze', status: 'active', progress: 0, data: j.data, organizationId: j.data.organizationId || 'default-org', attempts: j.attemptsMade, maxAttempts: 3, createdAt: j.timestamp, updatedAt: Date.now() }),
    'enrichment': (j) => processEnrichmentJob({ id: j.id, queueName: 'enrichment', status: 'active', progress: 0, data: j.data, organizationId: j.data.organizationId || 'default-org', attempts: j.attemptsMade, maxAttempts: 3, createdAt: j.timestamp, updatedAt: Date.now() }),
    'gmail-sync': (j) => processGmailSyncJob({ id: j.id, queueName: 'gmail-sync', status: 'active', progress: 0, data: j.data, organizationId: j.data.organizationId || 'default-org', attempts: j.attemptsMade, maxAttempts: 3, createdAt: j.timestamp, updatedAt: Date.now() }),
    'report-generation': (j) => processReportGenerationJob({ id: j.id, queueName: 'report-generation', status: 'active', progress: 0, data: j.data, organizationId: j.data.organizationId || 'default-org', attempts: j.attemptsMade, maxAttempts: 3, createdAt: j.timestamp, updatedAt: Date.now() }),
    'retention': (j) => processRetentionJob({ id: j.id, queueName: 'retention', status: 'active', progress: 0, data: j.data, organizationId: j.data.organizationId || 'default-org', attempts: j.attemptsMade, maxAttempts: 3, createdAt: j.timestamp, updatedAt: Date.now() }),
    'notifications': (j) => processNotificationJob({ id: j.id, queueName: 'notifications', status: 'active', progress: 0, data: j.data, organizationId: j.data.organizationId || 'default-org', attempts: j.attemptsMade, maxAttempts: 3, createdAt: j.timestamp, updatedAt: Date.now() })
  };

  for (const qName of QUEUE_NAMES) {
    const handler = workerMap[qName];
    if (handler) {
      const worker = new Worker(qName, handler, {
        connection,
        concurrency: qName === 'enrichment' ? 10 : 5
      });
      activeWorkers.push(worker);
      logger.info(`BullMQ Worker registered for queue: ${qName}`);
    }
  }
} else {
  logger.info('No REDIS_URL provided; background worker listening in development standby mode.');
}

// Graceful shutdown handling
let shuttingDown = false;
async function handleShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}. Shutting down worker gracefully...`);

  const shutdownTimeout = setTimeout(() => {
    logger.warn('Worker shutdown timed out, force terminating.');
    process.exit(1);
  }, 10000);

  try {
    for (const worker of activeWorkers) {
      await worker.close();
    }
    await gracefulShutdownQueues();
    clearTimeout(shutdownTimeout);
    logger.info('Worker shutdown completed cleanly.');
    process.exit(0);
  } catch (err: any) {
    logger.error({ error: err.message }, 'Error during worker shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
