import { describe, it, expect } from 'vitest';
import { getStandardizedVerdict } from '../verdict';

describe('getStandardizedVerdict', () => {
  it('handles null/undefined analysis gracefully', () => {
    const verdict = getStandardizedVerdict(null);
    expect(verdict.hasScore).toBe(false);
    expect(verdict.score).toBe(0);
    expect(verdict.trustScore).toBe(100);
    expect(verdict.category).toBe('SUSPICIOUS');
    expect(verdict.isSuspicious).toBe(true);
    expect(verdict.severity).toBe('MEDIUM');
    expect(verdict.verdict).toBe('SUSPICIOUS');
  });

  it('correctly standardizes high threat score (>= 80) malicious phish', () => {
    const verdict = getStandardizedVerdict({
      threatScore: 88,
      verdict: 'MALICIOUS PHISH',
      classification: 'Phishing'
    });

    expect(verdict.hasScore).toBe(true);
    expect(verdict.score).toBe(88);
    expect(verdict.trustScore).toBe(12);
    expect(verdict.category).toBe('MALICIOUS');
    expect(verdict.isMalicious).toBe(true);
    expect(verdict.isSafe).toBe(false);
    expect(verdict.severity).toBe('CRITICAL');
    expect(verdict.severityLabel).toBe('CRITICAL EXPOSURE');
    expect(verdict.stamp.status).toBe('bad');
    expect(verdict.stamp.word).toBe('PHISH');
    expect(verdict.recommendedAction).toBe('BLOCK SENDER & PURGE INBOX');
  });

  it('correctly standardizes medium threat score (35-59) suspicious email', () => {
    const verdict = getStandardizedVerdict({
      threatScore: 45,
      verdict: 'SUSPICIOUS',
      classification: 'Suspicious'
    });

    expect(verdict.hasScore).toBe(true);
    expect(verdict.score).toBe(45);
    expect(verdict.trustScore).toBe(55);
    expect(verdict.category).toBe('SUSPICIOUS');
    expect(verdict.isSuspicious).toBe(true);
    expect(verdict.severity).toBe('MEDIUM');
    expect(verdict.severityLabel).toBe('ELEVATED RISK');
    expect(verdict.stamp.status).toBe('warn');
    expect(verdict.recommendedAction).toBe('ISOLATE AT GATEWAY & USER ALERT');
  });

  it('correctly standardizes clean email (<35 score)', () => {
    const verdict = getStandardizedVerdict({
      threatScore: 10,
      verdict: 'LEGITIMATE',
      classification: 'Legitimate'
    });

    expect(verdict.hasScore).toBe(true);
    expect(verdict.score).toBe(10);
    expect(verdict.trustScore).toBe(90);
    expect(verdict.category).toBe('SAFE');
    expect(verdict.isSafe).toBe(true);
    expect(verdict.severity).toBe('LOW');
    expect(verdict.severityLabel).toBe('LOW RISK');
    expect(verdict.stamp.status).toBe('good');
    expect(verdict.stamp.word).toBe('LEGITIMATE');
    expect(verdict.recommendedAction).toBe('ALLOW TRANSMISSION (CLEAN)');
  });

  it('falls back to riskScore if threatScore is absent', () => {
    const verdict = getStandardizedVerdict({
      riskScore: 75,
      verdict: 'MALICIOUS PHISH'
    });

    expect(verdict.hasScore).toBe(true);
    expect(verdict.score).toBe(75);
    expect(verdict.trustScore).toBe(25);
    expect(verdict.severity).toBe('CRITICAL');
  });

  it('correctly categorizes fraud-related verdicts', () => {
    const verdict = getStandardizedVerdict({
      threatScore: 92,
      verdict: 'FRAUD-RELATED',
      classification: 'Fraud-related'
    });

    expect(verdict.category).toBe('MALICIOUS');
    expect(verdict.stamp.word).toBe('FRAUD');
    expect(verdict.stamp.status).toBe('bad');
  });

  it('correctly categorizes impersonation verdicts', () => {
    const verdict = getStandardizedVerdict({
      threatScore: 85,
      verdict: 'IMPERSONATED',
      classification: 'Impersonated'
    });

    expect(verdict.category).toBe('MALICIOUS');
    expect(verdict.stamp.word).toBe('IMPERSONATED');
    expect(verdict.stamp.status).toBe('bad');
  });

  it('handles UNCERTAIN verdicts appropriately', () => {
    const verdict = getStandardizedVerdict({
      threatScore: 50,
      verdict: 'UNCERTAIN MARGIN'
    });

    expect(verdict.verdict).toBe('UNCERTAIN');
    expect(verdict.stamp.word).toBe('UNCERTAIN');
    expect(verdict.stamp.status).toBe('warn');
    expect(verdict.colors.text).toBe('text-purple-300');
  });
});
