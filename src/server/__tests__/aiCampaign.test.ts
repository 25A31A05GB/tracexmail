import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateCampaignNarrative, detectCampaignsWithAi } from '../aiCampaignService';
import { CampaignCluster } from '../correlationEngine';

describe('AI Campaign Narrative & Detection Service', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejects campaign analysis when fewer than 2 cases are provided', async () => {
    const singleCaseCluster: CampaignCluster = {
      id: 'cluster-01',
      name: 'Single Case Cluster',
      threatActor: 'Unknown',
      status: 'ACTIVE',
      targetIndustry: 'Retail',
      totalEmails: 1,
      memberEmailIds: ['case-01'],
      sharedEvidence: [],
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      notes: ''
    };

    await expect(generateCampaignNarrative(singleCaseCluster)).rejects.toThrow(
      /at least 2 linked cases/i
    );

    await expect(detectCampaignsWithAi([ { id: 'case-01' } ])).rejects.toThrow(
      /at least 2 cases/i
    );
  });

  it('strictly preserves deterministic cluster members without inventing unlinked cases', async () => {
    const deterministicCluster: CampaignCluster = {
      id: 'cluster-paypal-phish',
      name: 'PayPal Phishing Cluster',
      threatActor: 'FIN-ACTOR-409',
      status: 'ACTIVE',
      targetIndustry: 'Financial',
      totalEmails: 2,
      memberEmailIds: ['case-paypal-01', 'case-paypal-02'],
      sharedEvidence: [
        {
          rule: 'same_specific_sender_domain',
          strength: 'STRONG',
          description: 'Shared sending domain: paypal-security-update.com',
          value: 'paypal-security-update.com',
          autoMergeEligible: true
        }
      ],
      firstSeen: '2026-09-01T10:00:00Z',
      lastSeen: '2026-09-02T14:00:00Z',
      notes: 'Phishing campaign targeting PayPal credentials'
    };

    const narrative = await generateCampaignNarrative(deterministicCluster);

    expect(narrative.campaignId).toBe('cluster-paypal-phish');
    expect(narrative.deterministicCluster.totalEmails).toBe(2);
    // Strict invariant: member IDs match exactly the deterministic cluster members
    expect(narrative.deterministicCluster.memberEmailIds).toEqual(['case-paypal-01', 'case-paypal-02']);
    expect(narrative.sharedTtps.length).toBeGreaterThan(0);
    expect(narrative.likelyObjective).toBeDefined();
    expect(narrative.metadata.analystReviewRequired).toBe(true);
  });

  it('runs detectCampaignsWithAi on correlated multi-case list', async () => {
    const cases = [
      {
        id: 'case-01',
        title: 'Account Verification Required',
        from: 'service@secure-paypal-portal.com',
        origin_ip: '185.220.101.5',
        urls: ['https://secure-paypal-portal.com/login']
      },
      {
        id: 'case-02',
        title: 'Urgent Security Alert',
        from: 'alerts@secure-paypal-portal.com',
        origin_ip: '185.220.101.5',
        urls: ['https://secure-paypal-portal.com/login']
      }
    ];

    const result = await detectCampaignsWithAi(cases);
    expect(result.totalCasesEvaluated).toBe(2);
    expect(result.totalCampaignsFound).toBeGreaterThanOrEqual(1);
    const campaign = result.campaigns[0];
    expect(campaign.memberEmailIds).toContain('case-01');
    expect(campaign.memberEmailIds).toContain('case-02');
  });
});
