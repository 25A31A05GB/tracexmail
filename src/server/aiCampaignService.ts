/**
 * TraceXMail Gemini-Assisted Campaign Narrative & Detection Service
 * 
 * Takes deterministic campaign clusters computed by correlationEngine.ts (source of truth)
 * and generates AI-assisted campaign narratives, shared TTP explanations, and likely adversary objectives.
 * 
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. The deterministic correlation engine is the STRICT source of truth for email-to-campaign membership.
 * 2. Gemini NEVER modifies or adds emails to clusters that the correlation engine did not link.
 * 3. Requires at least 2 forensic cases to form a campaign narrative.
 */

import { GoogleGenAI } from '@google/genai';
import { 
  correlateEmails, 
  extractForensicRecord, 
  CampaignCluster, 
  EmailForensicRecord,
  CorrelationEvidence 
} from './correlationEngine';

export interface CampaignAiNarrative {
  campaignId: string;
  campaignName: string;
  campaignNarrative: string;
  sharedTtps: string[];
  likelyObjective: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  explanation: string;
  deterministicCluster: {
    totalEmails: number;
    memberEmailIds: string[];
    sharedEvidence: CorrelationEvidence[];
    firstSeen: string;
    lastSeen: string;
  };
  metadata: {
    modelUsed: string;
    generatedAt: string;
    analystReviewRequired: boolean;
  };
}

const CAMPAIGN_SYSTEM_PROMPT = `You are a Principal Threat Intelligence Analyst specializing in email threat cluster analysis and cyber adversary campaign attribution.

You will receive deterministically linked email cases and their verified shared indicators (shared URLs, infrastructure IPs, ASN reuse, SPF/DKIM authentication patterns, and lure templates).

RULES:
1. You MUST reason strictly over the provided evidence and clusters.
2. You CANNOT add or suggest extra emails that are not in the provided cluster.
3. Formulate a realistic, actionable campaign narrative describing the campaign flight path, shared TTPs, likely attacker objectives (e.g. Credential Harvesting, Financial Diversion, Malware Delivery), and an explanation of why these cases form a linked campaign.
4. Output valid RAW JSON only matching this schema:
{
  "campaignName": string,
  "campaignNarrative": string,
  "sharedTtps": string[],
  "likelyObjective": string,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "explanation": string
}`;

/**
 * Generates an AI narrative for a single deterministic campaign cluster
 */
export async function generateCampaignNarrative(
  cluster: CampaignCluster,
  memberCases?: any[]
): Promise<CampaignAiNarrative> {
  if (!cluster || !Array.isArray(cluster.memberEmailIds) || cluster.memberEmailIds.length < 2) {
    throw new Error('Campaign analysis requires at least 2 linked cases to generate an AI campaign narrative.');
  }

  const promptInput = {
    campaignId: cluster.id,
    currentName: cluster.name,
    threatActor: cluster.threatActor,
    totalEmails: cluster.totalEmails,
    memberEmailIds: cluster.memberEmailIds,
    firstSeen: cluster.firstSeen,
    lastSeen: cluster.lastSeen,
    sharedEvidence: cluster.sharedEvidence,
    sampleMemberCases: memberCases?.slice(0, 10).map((c: any) => ({
      id: c.id,
      subject: c.subject,
      from: c.from,
      senderDomain: c.fromDomain || (c.from?.includes('@') ? c.from.split('@')[1] : ''),
      originIp: c.originIp,
      threatScore: c.threatScore,
      threatVerdict: c.threatVerdict
    }))
  };

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  // If Gemini key is not configured, synthesize a high-fidelity deterministic narrative
  if (!apiKey || apiKey.includes('placeholder')) {
    const sharedRules = cluster.sharedEvidence.map(e => e.description).join('; ');
    const fallbackNarrative: CampaignAiNarrative = {
      campaignId: cluster.id,
      campaignName: cluster.name,
      campaignNarrative: `Coordinated email campaign cluster comprising ${cluster.totalEmails} observed incident cases. Technical correlation identified persistent indicator reuse across ${sharedRules || 'infrastructure relays and lure patterns'}.`,
      sharedTtps: [
        'T1566.002 - Spearphishing Link / Infrastructure Reuse',
        'T1586.002 - Email Account Impersonation / Lookalike Domain'
      ],
      likelyObjective: cluster.name.toLowerCase().includes('invoice') 
        ? 'Financial Payment Diversion / Wire Fraud'
        : 'Credential Harvesting & Enterprise Access Acquisition',
      confidence: cluster.sharedEvidence.some(e => e.strength === 'STRONG') ? 'HIGH' : 'MEDIUM',
      explanation: `Cases are deterministically correlated via verifiable indicators: ${sharedRules || 'matching envelope and infrastructure telemetry'}. Shared hyperscaler false-positives have been filtered out.`,
      deterministicCluster: {
        totalEmails: cluster.totalEmails,
        memberEmailIds: cluster.memberEmailIds,
        sharedEvidence: cluster.sharedEvidence,
        firstSeen: cluster.firstSeen,
        lastSeen: cluster.lastSeen
      },
      metadata: {
        modelUsed: 'deterministic-correlation-synthesizer',
        generatedAt: new Date().toISOString(),
        analystReviewRequired: true
      }
    };
    return fallbackNarrative;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let lastError: any = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const model = candidateModels[i];
    try {
      const response = await ai.models.generateContent({
        model,
        contents: `Analyze this deterministic campaign cluster and synthesize the campaign narrative and TTPs:\n\n${JSON.stringify(promptInput, null, 2)}`,
        config: {
          systemInstruction: CAMPAIGN_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      });

      const raw = response.text || '';
      if (!raw) throw new Error(`Empty response from Gemini model ${model}`);

      const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const validConfidences = ['HIGH', 'MEDIUM', 'LOW'] as const;
      const confidence = validConfidences.includes(parsed.confidence) ? parsed.confidence : 'MEDIUM';

      const narrativeResult: CampaignAiNarrative = {
        campaignId: cluster.id,
        campaignName: parsed.campaignName || cluster.name,
        campaignNarrative: parsed.campaignNarrative || `Observed multi-case campaign link involving ${cluster.totalEmails} incidents.`,
        sharedTtps: Array.isArray(parsed.sharedTtps) ? parsed.sharedTtps.map(String) : ['T1566.002 - Spearphishing Link'],
        likelyObjective: parsed.likelyObjective || 'Credential Harvesting & Account Takeover',
        confidence,
        explanation: parsed.explanation || 'Deterministic evidence linkages across observed sending infrastructure and malicious URLs.',
        deterministicCluster: {
          totalEmails: cluster.totalEmails,
          memberEmailIds: cluster.memberEmailIds, // Strict preservation of deterministic members
          sharedEvidence: cluster.sharedEvidence,
          firstSeen: cluster.firstSeen,
          lastSeen: cluster.lastSeen
        },
        metadata: {
          modelUsed: model,
          generatedAt: new Date().toISOString(),
          analystReviewRequired: true
        }
      };

      return narrativeResult;
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      const isTransient =
        err?.status === 503 ||
        err?.code === 503 ||
        errMsg.includes('503') ||
        errMsg.includes('high demand') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('429') ||
        err?.status === 429;

      if (isTransient && i < candidateModels.length - 1) {
        await new Promise(res => setTimeout(res, 350 * (i + 1)));
        continue;
      }
      if (!isTransient) {
        throw err;
      }
    }
  }

  throw lastError || new Error('All Gemini candidate models exhausted during campaign narrative synthesis');
}

/**
 * Runs full AI-assisted campaign detection across a set of raw or normalized cases
 */
export async function detectCampaignsWithAi(cases: any[]): Promise<{
  totalCasesEvaluated: number;
  totalCampaignsFound: number;
  campaigns: Array<CampaignCluster & { aiNarrative?: CampaignAiNarrative }>;
}> {
  if (!Array.isArray(cases) || cases.length < 2) {
    throw new Error('Campaign detection requires at least 2 cases to correlate.');
  }

  // Convert raw cases to normalized forensic records
  const records: EmailForensicRecord[] = cases.map(c => extractForensicRecord(c));

  // Run deterministic correlation (source of truth)
  const clusters = correlateEmails(records);

  // For each cluster with >= 2 members, attach AI narrative
  const enrichedClusters = await Promise.all(
    clusters.map(async cluster => {
      try {
        const clusterCases = cases.filter(c => cluster.memberEmailIds.includes(c.id || c.caseId));
        const aiNarrative = await generateCampaignNarrative(cluster, clusterCases);
        return {
          ...cluster,
          aiNarrative
        };
      } catch (e) {
        console.warn(`[AiCampaign] Narrative generation skipped for cluster ${cluster.id}:`, e);
        return cluster;
      }
    })
  );

  return {
    totalCasesEvaluated: cases.length,
    totalCampaignsFound: enrichedClusters.length,
    campaigns: enrichedClusters
  };
}
