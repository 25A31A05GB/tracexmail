import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateAndSanitizeSocReport, generateSocReport } from '../socReportService';

describe('SOC Analyst Report Service & Schema Validation', () => {
  const sampleEvidence = {
    ips: ['198.51.100.25', '192.0.2.1'],
    domains: ['spoofed-bank-security.net', 'legit-vendor.corp'],
    urls: ['https://spoofed-bank-security.net/auth/login']
  };

  it('validates a complete SOC report structure and preserves verified evidence', () => {
    const rawReport = {
      executiveSummary: 'Coordinated spearphishing attempt targeting corporate financial credentials.',
      threatActorProfile: 'Observed sending infrastructure aligns with known credential harvesting syndicates.',
      attributionHypothesis: {
        confidence: 'HIGH',
        confidenceScore: 0.9,
        evidenceIds: ['EVID-01', 'EVID-02'],
        hypothesisText: 'Observed sending infrastructure routed via untrusted mail relay with invalid SPF alignment.'
      },
      originInfrastructure: 'Origin relay IP 198.51.100.25 hosted on Autonomous System AS200548.',
      remediationPlaybook: [
        {
          stepNumber: 1,
          title: 'Quarantine Email',
          action: 'Isolate message across all tenant inboxes.',
          priority: 'CRITICAL'
        }
      ],
      defensiveRules: {
        m365MailFlowRule: 'New-TransportRule -SenderDomainIs "spoofed-bank-security.net" -Action DeleteMessage',
        snortOrSuricataRule: 'drop tcp any any -> any 25 (msg:"TRACEXMAIL Block 198.51.100.25"; sid:9001;)',
        postfixBlock: 'spoofed-bank-security.net REJECT Malicious sender domain'
      },
      evidenceFindings: [
        {
          finding: 'SPF authentication failed for envelope domain.',
          category: 'AUTH_FAILURE',
          evidenceRef: 'EVID-01'
        }
      ],
      mitreAttacks: [
        {
          id: 'T1566.002',
          name: 'Spearphishing Link',
          tactic: 'Initial Access',
          explanation: 'User lure directed to external authentication portal.'
        }
      ]
    };

    const { valid, report, errors } = validateAndSanitizeSocReport(rawReport, sampleEvidence);
    expect(valid).toBe(true);
    expect(errors.length).toBe(0);
    expect(report.executiveSummary).toContain('spearphishing');
    expect(report.attributionHypothesis.confidence).toBe('HIGH');
    expect(report.attributionHypothesis.evidenceIds).toContain('EVID-01');
    expect(report.metadata.analystReviewRequired).toBe(true);
    expect(report.metadata.promptVersion).toBe('soc_report_v1.0');
  });

  it('synthesizes actionable fallback defensive rules when model returns empty rules', () => {
    const incompleteReport = {
      executiveSummary: 'Phishing campaign detected.',
      threatActorProfile: 'Unattributed infrastructure cluster.',
      attributionHypothesis: {
        confidence: 'MEDIUM',
        confidenceScore: 0.7,
        evidenceIds: ['EVID-01'],
        hypothesisText: 'Observed relay characteristics.'
      },
      originInfrastructure: 'Relay infrastructure.',
      remediationPlaybook: [],
      defensiveRules: {
        m365MailFlowRule: '',
        snortOrSuricataRule: '',
        postfixBlock: ''
      },
      evidenceFindings: [],
      mitreAttacks: []
    };

    const { valid, report } = validateAndSanitizeSocReport(incompleteReport, sampleEvidence);
    expect(valid).toBe(true);
    expect(report.defensiveRules.m365MailFlowRule).toContain('spoofed-bank-security.net');
    expect(report.defensiveRules.snortOrSuricataRule).toContain('198.51.100.25');
    expect(report.defensiveRules.postfixBlock).toContain('REJECT');
    expect(report.remediationPlaybook.length).toBeGreaterThan(0);
  });
});
