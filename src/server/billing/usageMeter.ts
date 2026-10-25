import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { getPlan, PlanLimits } from './plans';
import { logger } from '../logger';

export interface OrgUsageRecord {
  organizationId: string;
  month: string; // 'YYYY-MM'
  planId: string;
  analysesCount: number;
  enrichmentCalls: number;
  llmTokens: number;
  storageBytes: number;
  estimatedCostUsd: number;
  warning80Sent: boolean;
  warning100Sent: boolean;
  costBudgetExceeded: boolean;
  updatedAt: string;
}

const USAGE_FILE = path.join(process.cwd(), 'data/org_usage_records.json');
const usageMemory = new Map<string, OrgUsageRecord>(); // key: `${orgId}:${month}`

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function loadUsageFromDisk(): void {
  try {
    if (fs.existsSync(USAGE_FILE)) {
      const raw = fs.readFileSync(USAGE_FILE, 'utf8');
      const records = JSON.parse(raw);
      if (Array.isArray(records)) {
        records.forEach((r) => {
          if (r && r.organizationId && r.month) {
            usageMemory.set(`${r.organizationId}:${r.month}`, r);
          }
        });
      }
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Failed to load usage records from disk');
  }
}

function saveUsageToDisk(): void {
  try {
    const dir = path.dirname(USAGE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USAGE_FILE, JSON.stringify(Array.from(usageMemory.values()), null, 2), 'utf8');
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Failed to save usage records to disk');
  }
}

// Initial load
loadUsageFromDisk();

export function getOrCreateUsage(orgId: string, month: string = getCurrentMonthKey(), planId: string = 'free'): OrgUsageRecord {
  const key = `${orgId}:${month}`;
  if (usageMemory.has(key)) {
    return usageMemory.get(key)!;
  }

  const newRecord: OrgUsageRecord = {
    organizationId: orgId,
    month,
    planId,
    analysesCount: 0,
    enrichmentCalls: 0,
    llmTokens: 0,
    storageBytes: 0,
    estimatedCostUsd: 0,
    warning80Sent: false,
    warning100Sent: false,
    costBudgetExceeded: false,
    updatedAt: new Date().toISOString()
  };

  usageMemory.set(key, newRecord);
  return newRecord;
}

/**
 * Increments usage metrics for an organization.
 */
export function recordUsageEvent(
  orgId: string,
  event: {
    type: 'analysis' | 'enrichment' | 'llm_tokens' | 'storage';
    amount?: number;
    estimatedCostUsd?: number;
  }
): OrgUsageRecord {
  const month = getCurrentMonthKey();
  const usage = getOrCreateUsage(orgId, month);
  const amount = event.amount || 1;

  if (event.type === 'analysis') {
    usage.analysesCount += amount;
  } else if (event.type === 'enrichment') {
    usage.enrichmentCalls += amount;
  } else if (event.type === 'llm_tokens') {
    usage.llmTokens += amount;
  } else if (event.type === 'storage') {
    usage.storageBytes += amount;
  }

  if (event.estimatedCostUsd) {
    usage.estimatedCostUsd += event.estimatedCostUsd;
  }

  // Cost budget enforcement check
  const plan = getPlan(usage.planId);
  if (usage.estimatedCostUsd >= plan.limits.monthlyCostBudgetUsd) {
    if (!usage.costBudgetExceeded) {
      usage.costBudgetExceeded = true;
      logger.warn({ orgId, spend: usage.estimatedCostUsd, budget: plan.limits.monthlyCostBudgetUsd }, 'Tenant cost budget exceeded. Degrading to cached/cheaper paths.');
    }
  }

  usage.updatedAt = new Date().toISOString();
  saveUsageToDisk();
  return usage;
}

/**
 * Evaluates whether an organization can perform an analysis under their plan limits.
 */
export function checkAnalysisQuota(
  orgId: string,
  planId: string = 'free'
): {
  allowed: boolean;
  current: number;
  limit: number;
  usageRatio: number;
  is80Percent: boolean;
  is100Percent: boolean;
  degradeToCachedPath: boolean;
} {
  const month = getCurrentMonthKey();
  const usage = getOrCreateUsage(orgId, month, planId);
  const plan = getPlan(planId);
  const limit = plan.limits.analysesPerMonth;
  const current = usage.analysesCount;
  const ratio = current / limit;

  const is80Percent = ratio >= 0.80 && ratio < 1.0;
  const is100Percent = ratio >= 1.0;

  // Send warning log / telemetry if hitting thresholds
  if (is80Percent && !usage.warning80Sent) {
    usage.warning80Sent = true;
    logger.warn({ orgId, current, limit }, `Organization reached 80% of monthly analysis quota`);
    saveUsageToDisk();
  } else if (is100Percent && !usage.warning100Sent) {
    usage.warning100Sent = true;
    logger.warn({ orgId, current, limit }, `Organization reached 100% of monthly analysis quota`);
    saveUsageToDisk();
  }

  return {
    allowed: current < limit,
    current,
    limit,
    usageRatio: ratio,
    is80Percent,
    is100Percent,
    degradeToCachedPath: usage.costBudgetExceeded
  };
}

/**
 * Express middleware to enforce plan analysis limits.
 * Returns HTTP 402 Payment Required with an upgrade prompt when quota is exhausted.
 */
export function enforceUsageLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  const orgId = user?.organizationId;
  if (!orgId) {
    return next();
  }
  const planId = user?.planId || 'free';

  const quota = checkAnalysisQuota(orgId, planId);

  // Set standard RateLimit headers for quota awareness
  res.setHeader('X-Quota-Limit', String(quota.limit));
  res.setHeader('X-Quota-Remaining', String(Math.max(0, quota.limit - quota.current)));
  res.setHeader('X-Quota-Used', String(quota.current));

  if (!quota.allowed) {
    res.status(402).json({
      type: 'https://tracexmail.com/errors/quota-exceeded',
      title: 'Monthly Analysis Quota Exceeded',
      status: 402,
      detail: `Your organization has analyzed ${quota.current}/${quota.limit} emails this month under the '${planId}' plan. Please upgrade to Team or Enterprise to continue automated processing.`,
      quota: {
        limit: quota.limit,
        used: quota.current,
        resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
      },
      upgradeUrl: '/settings?tab=subscription'
    });
    return;
  }

  next();
}

/**
 * Aggregates platform-wide metrics for platform super admins.
 */
export function getPlatformAdminStats(): {
  activeOrganizations: number;
  totalMonthlyRevenueUsd: number;
  totalAnalysesThisMonth: number;
  totalEstimatedCostUsd: number;
  organizations: Array<{ orgId: string; planId: string; analyses: number; spendUsd: number }>;
} {
  const month = getCurrentMonthKey();
  let mrr = 0;
  let totalAnalyses = 0;
  let totalCost = 0;
  const orgList: Array<{ orgId: string; planId: string; analyses: number; spendUsd: number }> = [];

  for (const record of usageMemory.values()) {
    if (record.month === month) {
      const plan = getPlan(record.planId);
      mrr += plan.priceMonthlyUsd;
      totalAnalyses += record.analysesCount;
      totalCost += record.estimatedCostUsd;
      orgList.push({
        orgId: record.organizationId,
        planId: record.planId,
        analyses: record.analysesCount,
        spendUsd: record.estimatedCostUsd
      });
    }
  }

  return {
    activeOrganizations: orgList.length,
    totalMonthlyRevenueUsd: mrr,
    totalAnalysesThisMonth: totalAnalyses,
    totalEstimatedCostUsd: Number(totalCost.toFixed(2)),
    organizations: orgList
  };
}
