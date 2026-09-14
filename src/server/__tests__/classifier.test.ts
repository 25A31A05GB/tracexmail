import { describe, it, expect } from 'vitest';
import { classifyEmailForensics } from '../classifier';

describe('classifyEmailForensics', () => {
  it('classifies legitimate emails with low threat score and clean breakdown', () => {
    const result = classifyEmailForensics({
      from: 'alex@acme-corp.com',
      fromDomain: 'acme-corp.com',
      to: 'security@company.org',
      subject: 'Quarterly Financial Review Meeting Agenda',
      bodyText: 'Hi Security Team, attached is the revised agenda for our quarterly sync.',
      auth: {
        spf: { status: 'PASS' },
        dkim: { status: 'PASS' },
        dmarc: { status: 'PASS', policy: 'reject' }
      },
      hops: [
        { fromIp: '198.51.100.25', isPrivate: false, isTor: false, abuseScore: 0 }
      ],
      domainIntelligence: {
        status: 'active',
        is_newly_registered: false,
        domain_age_days: 1200,
        dns: {
          spf: 'v=spf1 include:_spf.google.com ~all',
          dmarc: 'v=DMARC1; p=reject;'
        }
      }
    });

    expect(result.threatScore).toBeLessThan(35);
    expect(result.severity).toBe('CLEAN');
    expect(result.verdict).toBe('LEGITIMATE');
    expect(result.threatScoreBreakdown).toBeDefined();
    expect(result.threatScoreBreakdown.components.authentication.score).toBe(0);
    expect(result.threatScoreBreakdown.components.domainRisk.score).toBe(0);
  });

  it('classifies spoofed/phishing email with high threat score when auth hard-fails', () => {
    const result = classifyEmailForensics({
      from: 'billing-alert@paypa1-security-notice.com',
      fromDomain: 'paypa1-security-notice.com',
      to: 'user@victim-corp.com',
      subject: 'URGENT: Immediate Account Suspension - Verify Credentials Now',
      bodyText: 'Dear Customer, Your account has been locked. Click here immediately to enter your password and wire funds.',
      replyTo: 'hacker@attacker-domain.org',
      auth: {
        spf: { status: 'FAIL' },
        dkim: { status: 'FAIL' },
        dmarc: { status: 'FAIL', policy: 'reject' }
      },
      domainIntelligence: {
        status: 'active',
        is_newly_registered: true,
        domain_age_days: 3,
        typosquatting: {
          is_typosquat: true,
          target_brand: 'PayPal',
          technique: 'homoglyph_substitution'
        }
      }
    });

    expect(result.threatScore).toBeGreaterThanOrEqual(70);
    expect(['CRITICAL', 'HIGH']).toContain(result.severity);
    expect(['MALICIOUS PHISH', 'IMPERSONATED', 'FRAUD-RELATED', 'PHISHING']).toContain(result.verdict.toUpperCase());
    expect(result.threatScoreBreakdown.components.authentication.score).toBeGreaterThan(0);
    expect(result.threatScoreBreakdown.components.domainRisk.score).toBeGreaterThan(0);
  });

  it('detects Tor exit nodes in hop routing and penalizes infrastructure score', () => {
    const result = classifyEmailForensics({
      from: 'info@unverified-relay.org',
      fromDomain: 'unverified-relay.org',
      subject: 'Notification regarding recent transaction',
      bodyText: 'Please review your recent activity report attached below.',
      auth: {
        spf: { status: 'SOFTFAIL' },
        dkim: { status: 'NONE' }
      },
      hops: [
        { fromIp: '185.220.101.5', isPrivate: false, isTor: true, abuseScore: 90 }
      ]
    });

    expect(result.threatScoreBreakdown.components.infrastructureRisk.score).toBeGreaterThan(0);
    expect(result.features.some(f => f.category === 'INFRASTRUCTURE' && f.triggered)).toBe(true);
  });

  it('handles missing optional fields gracefully without throwing errors', () => {
    const result = classifyEmailForensics({
      from: 'sender@example.com',
      fromDomain: 'example.com',
      subject: 'Simple Test Subject'
    });

    expect(result).toBeDefined();
    expect(typeof result.threatScore).toBe('number');
    expect(result.threatScore).toBeGreaterThanOrEqual(0);
    expect(result.threatScore).toBeLessThanOrEqual(100);
    expect(result.threatScoreBreakdown.total).toBe(result.threatScore);
  });
});
