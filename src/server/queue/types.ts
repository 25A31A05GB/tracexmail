import { z } from 'zod';

export const QueueNameSchema = z.enum([
  'analyze',
  'enrichment',
  'gmail-sync',
  'report-generation',
  'retention',
  'notifications'
]);
export type QueueName = z.infer<typeof QueueNameSchema>;

export const AnalyzeJobPayloadSchema = z.object({
  emailContent: z.string().min(1),
  filename: z.string().default('upload.eml'),
  size: z.number().optional(),
  organizationId: z.string().default('default-org'),
  userId: z.string().optional(),
  clientIp: z.string().optional(),
  metadata: z.record(z.any()).optional()
});
export type AnalyzeJobPayload = z.infer<typeof AnalyzeJobPayloadSchema>;

export const EnrichmentJobPayloadSchema = z.object({
  iocType: z.enum(['ip', 'domain', 'url', 'hash']),
  value: z.string().min(1),
  organizationId: z.string().default('default-org'),
  providers: z.array(z.string()).default(['virustotal', 'abuseipdb', 'otx', 'rdap', 'dns'])
});
export type EnrichmentJobPayload = z.infer<typeof EnrichmentJobPayloadSchema>;

export const GmailSyncJobPayloadSchema = z.object({
  organizationId: z.string().default('default-org'),
  messageId: z.string(),
  historyId: z.string().optional(),
  action: z.enum(['sync', 'quarantine', 'poll', 'pubsub_push']).default('sync'),
  rawMime: z.string().optional()
});
export type GmailSyncJobPayload = z.infer<typeof GmailSyncJobPayloadSchema>;

export const ReportGenerationJobPayloadSchema = z.object({
  organizationId: z.string().default('default-org'),
  caseId: z.string(),
  reportType: z.enum(['executive_pdf', 'technical_json', 'compliance_audit']).default('technical_json'),
  requestedBy: z.string().optional()
});
export type ReportGenerationJobPayload = z.infer<typeof ReportGenerationJobPayloadSchema>;

export const RetentionJobPayloadSchema = z.object({
  organizationId: z.string().default('default-org'),
  olderThanDays: z.number().int().positive().default(90),
  dryRun: z.boolean().default(false)
});
export type RetentionJobPayload = z.infer<typeof RetentionJobPayloadSchema>;

export const NotificationJobPayloadSchema = z.object({
  organizationId: z.string().default('default-org'),
  channel: z.enum(['slack', 'email', 'webhook']),
  recipient: z.string().optional(),
  payload: z.record(z.any()),
  severity: z.string().optional()
});
export type NotificationJobPayload = z.infer<typeof NotificationJobPayloadSchema>;

export type JobStatus = 'queued' | 'active' | 'completed' | 'failed';

export interface StoredJobRecord {
  id: string;
  queueName: QueueName;
  status: JobStatus;
  progress: number; // 0 to 100
  data: any;
  result?: any;
  error?: string;
  organizationId: string;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  failedAt?: number;
}
