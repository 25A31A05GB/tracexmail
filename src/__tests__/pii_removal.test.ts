import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  hashEmailAddress,
  sanitizeDisplayName,
  sanitizeBodyText,
  sanitizeEmailRecord,
  PiiSanitizationStats
} from '../../scripts/ml/pii_sanitizer';
import { runIngestionPipeline } from '../../scripts/ml/ingest_public_corpora';

describe('PII Removal & Anonymization Engine (Item 2)', () => {
  const testTmpDir = path.join(process.cwd(), 'data/raw_corpora_pii_test_tmp');
  const testReportPath = path.join(process.cwd(), 'reports/test_pii_ingest_report.json');
  const testOutputPath = path.join(process.cwd(), 'data/datasets/test_pii_ingested_corpora.json');

  beforeEach(() => {
    if (fs.existsSync(testTmpDir)) fs.rmSync(testTmpDir, { recursive: true, force: true });
    fs.mkdirSync(testTmpDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testTmpDir)) fs.rmSync(testTmpDir, { recursive: true, force: true });
    if (fs.existsSync(testOutputPath)) fs.unlinkSync(testOutputPath);
    if (fs.existsSync(testReportPath)) fs.unlinkSync(testReportPath);
  });

  it('1. Hashes personal local-parts while preserving sender domain for threat analysis', () => {
    const rawEmail = 'john.doe@enron.com';
    const hashed = hashEmailAddress(rawEmail);

    expect(hashed).not.toContain('john.doe');
    expect(hashed).toMatch(/^usr_[a-f0-9]{8}@enron\.com$/);

    // Deterministic hashing: same input yields same pseudonymized token
    const hashedAgain = hashEmailAddress(rawEmail);
    expect(hashedAgain).toBe(hashed);

    // Preserves essential domain features
    expect(hashed.endsWith('@enron.com')).toBe(true);
  });

  it('2. Retains standard enterprise role-based accounts (security, alerts, no-reply)', () => {
    expect(hashEmailAddress('security@paypal.com')).toBe('security@paypal.com');
    expect(hashEmailAddress('no-reply@amazon.com')).toBe('no-reply@amazon.com');
    expect(hashEmailAddress('alerts@internal-soc.org')).toBe('alerts@internal-soc.org');
    expect(hashEmailAddress('billing@stripe.com')).toBe('billing@stripe.com');
  });

  it('3. Strips personal names from display headers while preserving brand entities', () => {
    // Personal individual name -> redacted
    expect(sanitizeDisplayName('Kenneth Lay')).toBe('[NAME_REDACTED]');
    expect(sanitizeDisplayName('Alice M. Cooper')).toBe('[NAME_REDACTED]');

    // Corporate brand & security operations -> preserved
    expect(sanitizeDisplayName('PayPal Security')).toBe('PayPal Security');
    expect(sanitizeDisplayName('Google Workspace')).toBe('Google Workspace');
    expect(sanitizeDisplayName('AWS Billing')).toBe('AWS Billing');
    expect(sanitizeDisplayName('IT Support')).toBe('IT Support');
  });

  it('4. Redacts telephone numbers in body text across US and international formats', () => {
    const stats: PiiSanitizationStats = {
      emailsHashed: 0,
      phoneNumbersRedacted: 0,
      namesRedacted: 0,
      financialIdsRedacted: 0
    };

    const textWithPhones = `
      Call me at (555) 123-4567 or on my mobile +1-800-555-0199.
      International direct line: +44 20 7946 0958 or 555.234.5678.
    `;

    const cleaned = sanitizeBodyText(textWithPhones, stats);

    expect(cleaned).not.toContain('(555) 123-4567');
    expect(cleaned).not.toContain('+1-800-555-0199');
    expect(cleaned).not.toContain('555.234.5678');
    expect(cleaned).toContain('[PHONE_REDACTED]');
    expect(stats.phoneNumbersRedacted).toBeGreaterThanOrEqual(3);
  });

  it('5. Redacts inline email addresses and personal salutations/signoffs in body text', () => {
    const stats: PiiSanitizationStats = {
      emailsHashed: 0,
      phoneNumbersRedacted: 0,
      namesRedacted: 0,
      financialIdsRedacted: 0
    };

    const body = `
Dear Jeffrey Skilling,

Please confirm whether the wire authorization request was sent by you.
You can reply to executive.assistant@corp-enron.com or reach out directly.

Sincerely,
Andrew Fastow
    `;

    const cleaned = sanitizeBodyText(body, stats);

    // Salutation personal name redacted
    expect(cleaned).not.toContain('Dear Jeffrey Skilling');
    expect(cleaned).toContain('Dear [NAME_REDACTED],');

    // Inline email redacted while domain preserved
    expect(cleaned).not.toContain('executive.assistant@corp-enron.com');
    expect(cleaned).toContain('[EMAIL_REDACTED]@corp-enron.com');

    // Signoff personal name redacted
    expect(cleaned).not.toContain('Andrew Fastow');
    expect(cleaned).toContain('[NAME_REDACTED]');

    // Attack keywords and linguistic indicators preserved
    expect(cleaned).toContain('wire authorization request');
  });

  it('6. Redacts Social Security Numbers and Credit Card numbers', () => {
    const stats: PiiSanitizationStats = {
      emailsHashed: 0,
      phoneNumbersRedacted: 0,
      namesRedacted: 0,
      financialIdsRedacted: 0
    };

    const text = `
      Customer SSN is 123-45-6789.
      Please verify card 4532 0150 9823 4410 on file.
    `;

    const cleaned = sanitizeBodyText(text, stats);

    expect(cleaned).not.toContain('123-45-6789');
    expect(cleaned).not.toContain('4532 0150 9823 4410');
    expect(cleaned).toContain('[SSN_REDACTED]');
    expect(cleaned).toContain('[CREDIT_CARD_REDACTED]');
    expect(stats.financialIdsRedacted).toBe(2);
  });

  it('7. Integrates with end-to-end ingestion pipeline to ensure stored records are sanitized', async () => {
    // Create an approved corpus with personal data
    const saDir = path.join(testTmpDir, 'spamassassin_ham');
    fs.mkdirSync(saDir, { recursive: true });
    fs.writeFileSync(
      path.join(saDir, '0002.txt'),
      `From: "David S. Miller" <davem@davemloft.net>
To: netdev@vger.kernel.org
Subject: Patch Review for IPsec Tunneling
Date: Wed, 21 Oct 2026 10:15:00 -0400

Hi Eric Dumazet,

Can you review the attached patch?
If you have questions, call me at 415-555-8822 or email davem.personal@gmail.com.

Best regards,
David Miller`
    );

    const { records, report } = await runIngestionPipeline({
      rawCorporaDir: testTmpDir,
      outputPath: testOutputPath,
      reportPath: testReportPath,
      sanitizePii: true
    });

    expect(records.length).toBe(1);
    const rec = records[0];

    // From header sanitized
    expect(rec.from).not.toContain('David S. Miller');
    expect(rec.from).not.toContain('davem@');
    expect(rec.fromDomain).toBe('davemloft.net');

    // Body text sanitized
    expect(rec.text).not.toContain('Eric Dumazet');
    expect(rec.text).not.toContain('415-555-8822');
    expect(rec.text).not.toContain('davem.personal@gmail.com');
    expect(rec.text).not.toContain('David Miller');

    expect(rec.text).toContain('[NAME_REDACTED]');
    expect(rec.text).toContain('[PHONE_REDACTED]');
    expect(rec.text).toContain('[EMAIL_REDACTED]@gmail.com');

    // Key features retained
    expect(rec.subject).toContain('Patch Review for IPsec Tunneling');
    expect(rec.label).toBe('Legitimate');

    // PII sanitization metrics recorded
    expect(report.piiSanitizationStats.emailsHashed).toBeGreaterThan(0);
    expect(report.piiSanitizationStats.phoneNumbersRedacted).toBeGreaterThan(0);
    expect(report.piiSanitizationStats.namesRedacted).toBeGreaterThan(0);
  });
});
