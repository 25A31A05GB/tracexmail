import { Worker, Job } from 'bullmq';
import { logger } from '../logger';
import {
  StoredJobRecord,
  AnalyzeJobPayload,
  EnrichmentJobPayload,
  GmailSyncJobPayload,
  ReportGenerationJobPayload,
  RetentionJobPayload,
  NotificationJobPayload
} from './types';
import { updateJobStatus, sendToDlq, recordIdempotentGmailProcessing } from './index';
import { getProviderBreaker, getCachedEnrichment, setCachedEnrichment } from './circuitBreaker';

/**
 * Handles 'analyze' jobs
 */
export async function processAnalyzeJob(record: StoredJobRecord): Promise<any> {
  const payload = record.data as AnalyzeJobPayload;
  updateJobStatus(record.id, { status: 'active', progress: 15 });

  try {
    const { parseRawEmailToAnalysis } = await import('../forensicPipeline');
    updateJobStatus(record.id, { progress: 45 });

    const analysis = await parseRawEmailToAnalysis(payload.emailContent, payload.filename || 'uploaded.eml', undefined, {
      userId: payload.userId,
      organizationId: payload.organizationId
    });

    updateJobStatus(record.id, { progress: 90 });

    // Store in case store or records if appropriate
    updateJobStatus(record.id, {
      status: 'completed',
      progress: 100,
      result: analysis
    });

    return analysis;
  } catch (err: any) {
    logger.error({ jobId: record.id, error: err.message }, 'Analyze job failed');
    throw err;
  }
}

/**
 * Handles 'enrichment' jobs with circuit breaker and partial resilience
 */
export async function processEnrichmentJob(record: StoredJobRecord): Promise<any> {
  const payload = record.data as EnrichmentJobPayload;
  updateJobStatus(record.id, { status: 'active', progress: 20 });

  const results: Record<string, any> = {};
  const unavailableProviders: string[] = [];

  const providers = payload.providers || ['virustotal', 'abuseipdb', 'otx', 'rdap', 'dns'];

  for (const provider of providers) {
    const cacheKey = `enrich:${provider}:${payload.iocType}:${payload.value}`;
    const cached = getCachedEnrichment(cacheKey);
    if (cached) {
      results[provider] = cached;
      continue;
    }

    const breaker = getProviderBreaker(provider);
    if (breaker.getState() === 'OPEN') {
      unavailableProviders.push(provider);
      results[provider] = { available: false, reason: 'Circuit breaker OPEN' };
      continue;
    }

    try {
      const data = await breaker.execute(async () => {
        // Dynamic provider calls based on provider
        if (provider === 'virustotal') {
          const { checkVirusTotal } = await import('../virustotalService');
          return checkVirusTotal(payload.value, payload.iocType);
        } else if (provider === 'otx') {
          const { queryOtxDirect } = await import('../otxService');
          return queryOtxDirect(payload.value, payload.iocType);
        } else {
          return { provider, status: 'checked', value: payload.value };
        }
      });

      results[provider] = data;
      setCachedEnrichment(cacheKey, data, 3600); // 1 hr cache
    } catch (err: any) {
      unavailableProviders.push(provider);
      results[provider] = { available: false, error: err.message };
    }
  }

  const outcome = {
    ioc: payload.value,
    iocType: payload.iocType,
    results,
    unavailableProviders,
    partial: unavailableProviders.length > 0
  };

  updateJobStatus(record.id, {
    status: 'completed',
    progress: 100,
    result: outcome
  });

  return outcome;
}

/**
 * Handles 'gmail-sync' jobs with idempotency and DLQ support
 */
export async function processGmailSyncJob(record: StoredJobRecord): Promise<any> {
  const payload = record.data as GmailSyncJobPayload;
  updateJobStatus(record.id, { status: 'active', progress: 25 });

  // Idempotency check: prevent double processing the same message + history
  const isNew = recordIdempotentGmailProcessing(payload.messageId, payload.historyId);
  if (!isNew) {
    logger.info({ messageId: payload.messageId }, 'Skipping already processed Gmail message (idempotency key matched)');
    const skipped = { status: 'skipped', reason: 'already_processed', messageId: payload.messageId };
    updateJobStatus(record.id, { status: 'completed', progress: 100, result: skipped });
    return skipped;
  }

  try {
    const { getGmailService } = await import('../gmailService');
    const service = getGmailService();

    let rawEmail = payload.rawMime;
    if (!rawEmail) {
      rawEmail = await service.fetchRawMessage(payload.messageId);
    }

    updateJobStatus(record.id, { progress: 60 });

    if (rawEmail) {
      const { parseRawEmailToAnalysis } = await import('../forensicPipeline');
      const analysisResult = await parseRawEmailToAnalysis(rawEmail, `gmail_${payload.messageId}.eml`, undefined, {
        organizationId: payload.organizationId
      });
      const analysis = analysisResult.analysis;

      // Quarantine check
      if (analysis.riskScore >= 75) {
        await service.quarantineMessage(payload.messageId);
        logger.warn({ messageId: payload.messageId, score: analysis.riskScore }, 'Quarantined high risk Gmail message');
      }

      updateJobStatus(record.id, { status: 'completed', progress: 100, result: analysis });
      return analysis;
    }

    updateJobStatus(record.id, { status: 'completed', progress: 100, result: { success: true } });
    return { success: true };
  } catch (err: any) {
    logger.error({ messageId: payload.messageId, error: err.message }, 'Gmail sync worker job failed');
    throw err;
  }
}

/**
 * Handles 'report-generation' jobs
 */
export async function processReportGenerationJob(record: StoredJobRecord): Promise<any> {
  const payload = record.data as ReportGenerationJobPayload;
  updateJobStatus(record.id, { status: 'active', progress: 30 });

  const { getCaseById } = await import('../caseStore');
  const caseItem = await getCaseById(payload.caseId);

  updateJobStatus(record.id, { progress: 80 });

  const result = {
    caseId: payload.caseId,
    reportType: payload.reportType,
    generatedAt: new Date().toISOString(),
    caseSummary: caseItem ? { title: caseItem.title, severity: caseItem.severity, riskScore: caseItem.risk_score } : null
  };

  updateJobStatus(record.id, { status: 'completed', progress: 100, result });
  return result;
}

/**
 * Handles 'retention' jobs
 */
export async function processRetentionJob(record: StoredJobRecord): Promise<any> {
  const payload = record.data as RetentionJobPayload;
  updateJobStatus(record.id, { status: 'active', progress: 50 });

  const { purgeExpiredEvidence } = await import('../compliance');
  const stats = await purgeExpiredEvidence(payload.organizationId, payload.olderThanDays, payload.dryRun);

  updateJobStatus(record.id, { status: 'completed', progress: 100, result: stats });
  return stats;
}

/**
 * Handles 'notifications' jobs
 */
export async function processNotificationJob(record: StoredJobRecord): Promise<any> {
  const payload = record.data as NotificationJobPayload;
  updateJobStatus(record.id, { status: 'active', progress: 50 });

  if (payload.channel === 'slack') {
    const { sendSlackNotification } = await import('../slackService');
    await sendSlackNotification(payload.payload as any);
  } else if (payload.channel === 'email') {
    const { sendEmailAlert } = await import('../emailAlertService');
    await sendEmailAlert(payload.payload as any);
  }

  const result = { sent: true, channel: payload.channel, timestamp: Date.now() };
  updateJobStatus(record.id, { status: 'completed', progress: 100, result });
  return result;
}

/**
 * Dispatcher for local in-process job execution with retries and DLQ
 */
export async function processLocalJob(record: StoredJobRecord): Promise<void> {
  let attempt = 0;
  const maxAttempts = record.maxAttempts || 3;

  while (attempt < maxAttempts) {
    attempt++;
    record.attempts = attempt;

    try {
      switch (record.queueName) {
        case 'analyze':
          await processAnalyzeJob(record);
          return;
        case 'enrichment':
          await processEnrichmentJob(record);
          return;
        case 'gmail-sync':
          await processGmailSyncJob(record);
          return;
        case 'report-generation':
          await processReportGenerationJob(record);
          return;
        case 'retention':
          await processRetentionJob(record);
          return;
        case 'notifications':
          await processNotificationJob(record);
          return;
        default:
          throw new Error(`Unknown queue name: ${record.queueName}`);
      }
    } catch (err: any) {
      logger.warn(
        { jobId: record.id, queue: record.queueName, attempt, maxAttempts, error: err.message },
        `Job attempt ${attempt} failed`
      );

      if (attempt >= maxAttempts) {
        updateJobStatus(record.id, { status: 'failed', error: err.message });
        sendToDlq(record, err.message);
        return;
      }

      // Exponential backoff
      const delayMs = Math.min(1000 * Math.pow(2, attempt), 8000);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}
