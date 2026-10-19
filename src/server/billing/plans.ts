import fs from 'fs';
import path from 'path';
import { logger } from '../logger';

export interface PlanLimits {
  analysesPerMonth: number;
  connectedMailboxes: number;
  seats: number;
  retentionDays: number;
  ssoEnabled: boolean;
  scimEnabled: boolean;
  apiAccess: boolean;
  enrichmentProviders: string[];
  llmAnalysisEnabled: boolean;
  monthlyCostBudgetUsd: number;
}

export interface PlanDefinition {
  id: 'free' | 'team' | 'enterprise';
  name: string;
  priceMonthlyUsd: number;
  priceYearlyUsd: number;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  limits: PlanLimits;
  features: string[];
}

let plansCache: Record<string, PlanDefinition> | null = null;

export function loadPlans(): Record<string, PlanDefinition> {
  if (plansCache) return plansCache;
  try {
    const plansPath = path.join(process.cwd(), 'config/plans.json');
    if (fs.existsSync(plansPath)) {
      const data = JSON.parse(fs.readFileSync(plansPath, 'utf8'));
      plansCache = data.plans;
      return plansCache!;
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Failed to read config/plans.json, using fallback');
  }

  // Fallback defaults
  plansCache = {
    free: {
      id: 'free',
      name: 'Community Tier',
      priceMonthlyUsd: 0,
      priceYearlyUsd: 0,
      limits: {
        analysesPerMonth: 50,
        connectedMailboxes: 0,
        seats: 1,
        retentionDays: 7,
        ssoEnabled: false,
        scimEnabled: false,
        apiAccess: false,
        enrichmentProviders: ['maxmind'],
        llmAnalysisEnabled: true,
        monthlyCostBudgetUsd: 5
      },
      features: ['50 analyses/month', '7-day retention']
    },
    team: {
      id: 'team',
      name: 'SOC Pro Team',
      priceMonthlyUsd: 199,
      priceYearlyUsd: 1990,
      limits: {
        analysesPerMonth: 2500,
        connectedMailboxes: 5,
        seats: 5,
        retentionDays: 90,
        ssoEnabled: true,
        scimEnabled: false,
        apiAccess: true,
        enrichmentProviders: ['maxmind', 'abuseipdb', 'virustotal', 'otx'],
        llmAnalysisEnabled: true,
        monthlyCostBudgetUsd: 100
      },
      features: ['2,500 analyses/month', '5 connected mailboxes', 'SSO']
    },
    enterprise: {
      id: 'enterprise',
      name: 'Enterprise Shield',
      priceMonthlyUsd: 999,
      priceYearlyUsd: 9990,
      limits: {
        analysesPerMonth: 50000,
        connectedMailboxes: 100,
        seats: 50,
        retentionDays: 365,
        ssoEnabled: true,
        scimEnabled: true,
        apiAccess: true,
        enrichmentProviders: ['maxmind', 'abuseipdb', 'virustotal', 'otx', 'rdap'],
        llmAnalysisEnabled: true,
        monthlyCostBudgetUsd: 1000
      },
      features: ['50,000 analyses/month', '100 connected mailboxes', 'SCIM', 'SIEM']
    }
  };

  return plansCache;
}

export function getPlan(planId: string = 'free'): PlanDefinition {
  const plans = loadPlans();
  return plans[planId.toLowerCase()] || plans['free'];
}
