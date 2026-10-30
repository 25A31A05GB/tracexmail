import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  parseDataSourcesRegistry,
  checkCorpusLicense,
  parseRfc822Message,
  runIngestionPipeline,
  CommonRecord
} from '../../scripts/ml/ingest_public_corpora';

describe('Machine Learning Public Corpora Ingestion Pipeline', () => {
  const testTmpDir = path.join(process.cwd(), 'data/raw_corpora_test_tmp');
  const testReportPath = path.join(process.cwd(), 'reports/test_ingest_report.json');
  const testOutputPath = path.join(process.cwd(), 'data/datasets/test_ingested_corpora.json');

  beforeEach(() => {
    if (fs.existsSync(testTmpDir)) fs.rmSync(testTmpDir, { recursive: true, force: true });
    fs.mkdirSync(testTmpDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testTmpDir)) fs.rmSync(testTmpDir, { recursive: true, force: true });
    if (fs.existsSync(testReportPath)) fs.unlinkSync(testReportPath);
    if (fs.existsSync(testOutputPath)) fs.unlinkSync(testOutputPath);
  });

  it('1. Successfully parses authoritative license registry from docs/ml/data-sources.md', () => {
    const registry = parseDataSourcesRegistry();
    expect(registry.size).toBeGreaterThan(0);
    expect(registry.has('nazario_phishing')).toBe(true);
    expect(registry.has('spamassassin_ham')).toBe(true);
    expect(registry.has('enron_ham')).toBe(true);

    const nazario = registry.get('nazario_phishing')!;
    expect(nazario.status).toBe('APPROVED');
    expect(nazario.license).toBeTruthy();
    expect(nazario.permittedLabels).toContain('Phishing');
  });

  it('2. Strictly refuses unlicensed or unknown corpora lacking entries in docs/ml/data-sources.md', () => {
    const registry = parseDataSourcesRegistry();

    // Unknown corpus with no license entry
    const unknownCheck = checkCorpusLicense('pirated_darkweb_dump_2026', registry);
    expect(unknownCheck.approved).toBe(false);
    expect(unknownCheck.reason).toContain('Refused: No license entry found');

    // Known unlicensed entry
    const unlicensedCheck = checkCorpusLicense('unlicensed_sample', registry);
    expect(unlicensedCheck.approved).toBe(false);
    expect(unlicensedCheck.reason).toContain('REFUSED');
  });

  it('3. Successfully approves valid corpora with matching licenses', () => {
    const registry = parseDataSourcesRegistry();

    const nazarioCheck = checkCorpusLicense('nazario_mbox_0.mbox', registry);
    expect(nazarioCheck.approved).toBe(true);
    expect(nazarioCheck.entry?.corpusId).toBe('nazario_phishing');

    const saCheck = checkCorpusLicense('spamassassin_easy_ham', registry);
    expect(saCheck.approved).toBe(true);
    expect(saCheck.entry?.corpusId).toBe('spamassassin_ham');
  });

  it('4. Correctly parses RFC 822 email format into common record structure', () => {
    const sampleRaw = `From: Security Team <alerts@paypal-security.com>
To: victim@example.org
Subject: Urgent: Verify Account Status
Date: Mon, 12 Oct 2026 14:30:00 +0000
Content-Type: text/plain

Dear Customer,
Please verify your banking credentials immediately to avoid account suspension.
Click https://portal.paypal-security.com/login now.`;

    const parsed = parseRfc822Message(sampleRaw);
    expect(parsed.subject).toBe('Urgent: Verify Account Status');
    expect(parsed.from).toBe('Security Team <alerts@paypal-security.com>');
    expect(parsed.fromDomain).toBe('paypal-security.com');
    expect(parsed.body).toContain('Please verify your banking credentials');
  });

  it('5. End-to-end ingestion pipeline imports approved corpora and logs refusal for unlicensed files', async () => {
    // Create an approved corpus folder (e.g. spamassassin_ham)
    const approvedDir = path.join(testTmpDir, 'spamassassin_ham');
    fs.mkdirSync(approvedDir, { recursive: true });
    fs.writeFileSync(
      path.join(approvedDir, '0001.txt'),
      `From: Linus Torvalds <torvalds@kernel.org>
To: linux-kernel@vger.kernel.org
Subject: Linux 6.14-rc1 release announcement
Date: Sun, 18 Oct 2026 18:00:00 -0700

So here is the next rc release. Everything looks fairly regular, mostly driver updates.
Please test and report any regressions.`
    );

    // Create an unlicensed corpus folder
    const unlicensedDir = path.join(testTmpDir, 'unlicensed_corporate_leak');
    fs.mkdirSync(unlicensedDir, { recursive: true });
    fs.writeFileSync(
      path.join(unlicensedDir, 'leak01.txt'),
      `From: anonymous@darkleak.onion\nSubject: Leaked internal emails\n\nConfidential internal dump.`
    );

    const { records, report } = await runIngestionPipeline({
      rawCorporaDir: testTmpDir,
      outputPath: testOutputPath,
      reportPath: testReportPath
    });

    // Verify approved records were imported
    expect(records.length).toBe(1);
    const rec = records[0];
    expect(rec.subject).toBe('Linux 6.14-rc1 release announcement');
    expect(rec.fromDomain).toBe('kernel.org');
    expect(rec.label).toBe('Legitimate');
    expect(rec.corpus).toBe('spamassassin_ham');
    expect(rec.license).toContain('Apache License');

    // Verify audit report recorded the refusal
    expect(report.totalRecordsIngested).toBe(1);
    expect(report.approvedCorporaCount).toBe(1);
    expect(report.refusedCorporaCount).toBe(1);
    expect(report.refusedCorpora[0].target).toBe('unlicensed_corporate_leak');
    expect(report.refusedCorpora[0].reason).toContain('Refused: No license entry found');

    // Verify files were written to disk
    expect(fs.existsSync(testOutputPath)).toBe(true);
    expect(fs.existsSync(testReportPath)).toBe(true);
  });
});
