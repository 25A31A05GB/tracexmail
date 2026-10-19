import fs from 'fs';
import path from 'path';
import { UrlAnalysisReport } from './urlAnalyzer';
import { AttachmentAnalysisReport } from './attachmentAnalyzer';
import { getSupabaseAdminClient } from '../supabase';
import { logger } from '../logger';

export interface OrgDetectionPolicy {
  organizationId: string;
  quarantineOnDangerousAttachment: boolean;
  quarantineOnHighRiskUrl: boolean;
  quarantineOnLookalikeDomain: boolean;
  quarantineThreshold: number; // 0 to 100
  blockedExtensions: string[];
  dryRunMode: boolean; // Simulates action without taking real mailbox action
  updatedAt: string;
}

const DEFAULT_POLICY: Omit<OrgDetectionPolicy, 'organizationId'> = {
  quarantineOnDangerousAttachment: true,
  quarantineOnHighRiskUrl: true,
  quarantineOnLookalikeDomain: true,
  quarantineThreshold: 70,
  blockedExtensions: ['exe', 'vbs', 'bat', 'cmd', 'ps1', 'js', 'scr', 'hta', 'iso', 'lnk', 'pif'],
  dryRunMode: false,
  updatedAt: new Date().toISOString()
};

const policyCache = new Map<string, OrgDetectionPolicy>();

const POLICIES_FILE = path.join(process.cwd(), 'data/org_detection_policies.json');

function loadPoliciesFromDisk(): Map<string, OrgDetectionPolicy> {
  try {
    if (fs.existsSync(POLICIES_FILE)) {
      const raw = fs.readFileSync(POLICIES_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((p) => {
          if (p && p.organizationId) {
            policyCache.set(p.organizationId, p);
          }
        });
      }
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Failed to read org detection policies from disk');
  }
  return policyCache;
}

function savePoliciesToDisk(): void {
  try {
    const dir = path.dirname(POLICIES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(POLICIES_FILE, JSON.stringify(Array.from(policyCache.values()), null, 2), 'utf8');
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Failed to persist org detection policies to disk');
  }
}

// Initial load
loadPoliciesFromDisk();

export function getOrgDetectionPolicy(orgId: string): OrgDetectionPolicy {
  if (policyCache.has(orgId)) {
    return policyCache.get(orgId)!;
  }
  const defaultPolicy: OrgDetectionPolicy = {
    ...DEFAULT_POLICY,
    organizationId: orgId,
    updatedAt: new Date().toISOString()
  };
  policyCache.set(orgId, defaultPolicy);
  return defaultPolicy;
}

export function updateOrgDetectionPolicy(
  orgId: string,
  updates: Partial<Omit<OrgDetectionPolicy, 'organizationId'>>
): OrgDetectionPolicy {
  const current = getOrgDetectionPolicy(orgId);
  const updated: OrgDetectionPolicy = {
    ...current,
    ...updates,
    organizationId: orgId,
    updatedAt: new Date().toISOString()
  };
  policyCache.set(orgId, updated);
  savePoliciesToDisk();
  return updated;
}

export interface PolicyEvaluationResult {
  shouldQuarantine: boolean;
  actionTaken: 'QUARANTINE' | 'PASS' | 'SIMULATE_QUARANTINE';
  triggeredRules: string[];
  dryRun: boolean;
}

/**
 * Evaluates inbound email telemetry against organization detection policies.
 */
export function evaluateOrgPolicies(
  orgId: string,
  signals: {
    threatScore: number;
    urlReport?: UrlAnalysisReport;
    attachmentReport?: AttachmentAnalysisReport;
  }
): PolicyEvaluationResult {
  const policy = getOrgDetectionPolicy(orgId);
  const triggeredRules: string[] = [];

  // 1. Dangerous attachment check
  if (policy.quarantineOnDangerousAttachment && signals.attachmentReport?.hasDangerousAttachments) {
    triggeredRules.push('Quarantine Policy: Inbound email contains confirmed dangerous attachment payload');
  }

  // 2. High risk URL verdict
  if (policy.quarantineOnHighRiskUrl && signals.urlReport?.overallVerdict === 'MALICIOUS') {
    triggeredRules.push('Quarantine Policy: Inbound email contains malicious URL destination');
  }

  // 3. Lookalike domain hit
  if (policy.quarantineOnLookalikeDomain && signals.urlReport?.hasLookalikeDomains) {
    triggeredRules.push('Quarantine Policy: Brand impersonation / lookalike homoglyph domain detected in URL');
  }

  // 4. Custom blocked extensions
  if (signals.attachmentReport?.attachments) {
    for (const att of signals.attachmentReport.attachments) {
      const ext = path.extname(att.metadata.filename).toLowerCase().replace(/^\./, '');
      if (policy.blockedExtensions.includes(ext)) {
        triggeredRules.push(`Quarantine Policy: Attachment extension '.${ext}' is explicitly prohibited by org policy`);
      }
    }
  }

  // 5. Threat Score threshold
  if (signals.threatScore >= policy.quarantineThreshold) {
    triggeredRules.push(`Quarantine Policy: Forensic threat score (${signals.threatScore}/100) exceeds org threshold (${policy.quarantineThreshold})`);
  }

  const shouldQuarantine = triggeredRules.length > 0;
  const actionTaken = shouldQuarantine
    ? policy.dryRunMode
      ? 'SIMULATE_QUARANTINE'
      : 'QUARANTINE'
    : 'PASS';

  return {
    shouldQuarantine,
    actionTaken,
    triggeredRules,
    dryRun: policy.dryRunMode
  };
}
