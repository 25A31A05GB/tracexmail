import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  createPrng,
  escapeCsvField,
  createTextSnippet,
  sampleRecordsForAudit,
  formatAuditCsv,
  generateLabelAudit,
  type SplitRecord
} from '../../scripts/ml/label_audit';
import {
  parseRfc4180Csv,
  parseAuditCsv,
  isValidForensicLabel,
  applyLabelCorrections,
  computeFileSha256
} from '../../scripts/ml/apply_label_corrections';
import { FORENSIC_LABELS } from '../../scripts/ml/count_and_verify_splits';
import type { CommonRecord, ForensicLabel } from '../../scripts/ml/ingest_public_corpora';

describe('Label Audit & Corrections Engine (Item 5)', () => {
  const testTmpDir = path.join(process.cwd(), 'data/test_audit_tmp');
  const testTrainPath = path.join(testTmpDir, 'train.json');
  const testValPath = path.join(testTmpDir, 'val.json');
  const testTestPath = path.join(testTmpDir, 'test.json');
  const testHoldoutPath = path.join(testTmpDir, 'adversarial_holdout.json');
  const testCsvPath = path.join(testTmpDir, 'label_audit.csv');
  const testSummaryPath = path.join(testTmpDir, 'label_audit_summary.json');
  const testCorrectionsPath = path.join(testTmpDir, 'reviewed_corrections.json');
  const testReportPath = path.join(testTmpDir, 'label_corrections_report.json');

  // Helper to generate mock CommonRecords
  const makeMockRecord = (id: string, label: ForensicLabel, splitName: 'train' | 'val' | 'test'): SplitRecord => ({
    id,
    subject: `Subject for ${id} with "quotes", commas, and alerts`,
    text: `Body text for ${id}. Detailed security alert information. Please verify immediate urgency.`,
    from: `Auditor <usr_${id}@domain-${id}.org>`,
    fromDomain: `domain-${id}.org`,
    label,
    source: 'test_audit_suite',
    corpus: 'test_corpus',
    license: 'MIT',
    ingestedAt: new Date().toISOString(),
    splitName
  });

  beforeEach(() => {
    if (fs.existsSync(testTmpDir)) fs.rmSync(testTmpDir, { recursive: true, force: true });
    fs.mkdirSync(testTmpDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testTmpDir)) fs.rmSync(testTmpDir, { recursive: true, force: true });
  });

  it('1. PRNG produces deterministic sequences for reproducible sampling', () => {
    const prng1 = createPrng(42);
    const prng2 = createPrng(42);
    const seq1 = [prng1(), prng1(), prng1()];
    const seq2 = [prng2(), prng2(), prng2()];
    expect(seq1).toEqual(seq2);
    expect(seq1[0]).toBeGreaterThanOrEqual(0);
    expect(seq1[0]).toBeLessThan(1);
  });

  it('2. RFC-4180 CSV escaping handles quotes, commas, newlines, and special characters', () => {
    expect(escapeCsvField('simple')).toBe('simple');
    expect(escapeCsvField('hello, world')).toBe('"hello, world"');
    expect(escapeCsvField('He said "urgent" today')).toBe('"He said ""urgent"" today"');
    expect(escapeCsvField('line 1\nline 2')).toBe('"line 1\nline 2"');
    expect(escapeCsvField('comma, and "quote"')).toBe('"comma, and ""quote"""');
    expect(escapeCsvField(undefined)).toBe('');
    expect(escapeCsvField(null)).toBe('');
  });

  it('3. sampleRecordsForAudit selects exactly 30 records per class across all 5 classes', () => {
    const records: SplitRecord[] = [];
    let counter = 0;

    // Create 50 records per class (total 250 records)
    for (const label of FORENSIC_LABELS) {
      for (let i = 0; i < 50; i++) {
        counter++;
        const split = i < 35 ? 'train' : i < 42 ? 'val' : 'test';
        records.push(makeMockRecord(`rec_${counter}`, label, split));
      }
    }

    const sampled = sampleRecordsForAudit(records, 30, 42);

    // Expect exactly 30 * 5 = 150 records
    expect(sampled.length).toBe(150);

    const counts: Record<string, number> = {};
    for (const r of sampled) {
      counts[r.label] = (counts[r.label] || 0) + 1;
    }

    for (const label of FORENSIC_LABELS) {
      expect(counts[label]).toBe(30);
    }
  });

  it('4. formatAuditCsv outputs RFC-4180 CSV with correct headers and blank review columns', () => {
    const records: SplitRecord[] = [
      makeMockRecord('rec_1', 'Phishing', 'train'),
      makeMockRecord('rec_2', 'Legitimate', 'test')
    ];

    const csv = formatAuditCsv(records);
    const lines = csv.trim().split('\n');

    expect(lines[0]).toBe('id,split,current_label,reviewed_label,confidence_review,reviewer_notes,from_domain,from_address,subject,text_snippet,source');
    expect(lines.length).toBe(3);

    const parsed = parseAuditCsv(csv);
    expect(parsed.length).toBe(2);
    expect(parsed[0].id).toBe('rec_1');
    expect(parsed[0].current_label).toBe('Phishing');
    expect(parsed[0].reviewed_label).toBe('');
    expect(parsed[0].confidence_review).toBe('');
    expect(parsed[0].reviewer_notes).toBe('');
  });

  it('5. parseRfc4180Csv correctly handles quoted fields with internal commas, quotes, and newlines', () => {
    const rawCsv = `id,subject,body\n1,"Hello, World!","Paragraph 1\n\nParagraph 2 with ""nested quotes"""\n2,Normal,SingleLine`;
    const parsed = parseRfc4180Csv(rawCsv);

    expect(parsed.length).toBe(3);
    expect(parsed[1][0]).toBe('1');
    expect(parsed[1][1]).toBe('Hello, World!');
    expect(parsed[1][2]).toBe('Paragraph 1\n\nParagraph 2 with "nested quotes"');
    expect(parsed[2][0]).toBe('2');
    expect(parsed[2][1]).toBe('Normal');
    expect(parsed[2][2]).toBe('SingleLine');
  });

  it('6. isValidForensicLabel validates against permitted taxonomy', () => {
    expect(isValidForensicLabel('Legitimate')).toBe(true);
    expect(isValidForensicLabel('Suspicious')).toBe(true);
    expect(isValidForensicLabel('Impersonated')).toBe(true);
    expect(isValidForensicLabel('Phishing')).toBe(true);
    expect(isValidForensicLabel('Fraud-related')).toBe(true);

    expect(isValidForensicLabel('Spam')).toBe(false);
    expect(isValidForensicLabel('Malware')).toBe(false);
    expect(isValidForensicLabel('unknown')).toBe(false);
  });

  it('7. applyLabelCorrections validates labels strictly and throws on invalid classes', () => {
    const mockTrain: CommonRecord[] = [
      makeMockRecord('rec_test_1', 'Suspicious', 'train')
    ];
    fs.writeFileSync(testTrainPath, JSON.stringify(mockTrain, null, 2), 'utf-8');
    fs.writeFileSync(testValPath, JSON.stringify([], null, 2), 'utf-8');
    fs.writeFileSync(testTestPath, JSON.stringify([], null, 2), 'utf-8');
    fs.writeFileSync(testHoldoutPath, JSON.stringify([{ id: 'h1', text: 'holdout' }], null, 2), 'utf-8');

    // Create CSV with an illegal label "Malicious"
    const badCsv = `id,split,current_label,reviewed_label,confidence_review,reviewer_notes,from_domain,from_address,subject,text_snippet,source\nrec_test_1,train,Suspicious,Malicious,HIGH,Invalid tag,example.com,a@example.com,Subject,Snippet,source`;
    fs.writeFileSync(testCsvPath, badCsv, 'utf-8');

    expect(() => {
      applyLabelCorrections({
        csvPath: testCsvPath,
        trainPath: testTrainPath,
        valPath: testValPath,
        testPath: testTestPath,
        holdoutPath: testHoldoutPath,
        reviewedCorrectionsPath: testCorrectionsPath,
        outReportPath: testReportPath
      });
    }).toThrow(/Invalid label "Malicious"/);
  });

  it('8. applyLabelCorrections applies valid manual corrections, updates splits, and leaves holdout untouched', () => {
    const mockTrain: CommonRecord[] = [
      makeMockRecord('rec_train_1', 'Suspicious', 'train'),
      makeMockRecord('rec_train_2', 'Legitimate', 'train')
    ];
    const mockVal: CommonRecord[] = [
      makeMockRecord('rec_val_1', 'Phishing', 'val')
    ];
    const mockTest: CommonRecord[] = [
      makeMockRecord('rec_test_1', 'Fraud-related', 'test')
    ];
    const mockHoldout = [{ id: 'holdout_1', text: 'critical untouched holdout' }];

    fs.writeFileSync(testTrainPath, JSON.stringify(mockTrain, null, 2), 'utf-8');
    fs.writeFileSync(testValPath, JSON.stringify(mockVal, null, 2), 'utf-8');
    fs.writeFileSync(testTestPath, JSON.stringify(mockTest, null, 2), 'utf-8');
    fs.writeFileSync(testHoldoutPath, JSON.stringify(mockHoldout, null, 2), 'utf-8');

    const holdoutHashBefore = computeFileSha256(testHoldoutPath);

    // Reviewer corrects rec_train_1 from Suspicious -> Phishing
    // Confirms rec_train_2 as Legitimate (reviewed_label: Legitimate)
    // Leaves rec_val_1 blank (no change)
    // Corrects rec_test_1 from Fraud-related -> Impersonated
    const auditCsv = [
      'id,split,current_label,reviewed_label,confidence_review,reviewer_notes,from_domain,from_address,subject,text_snippet,source',
      'rec_train_1,train,Suspicious,Phishing,HIGH,Urgent credential harvest link confirmed,domain-1.org,usr@domain-1.org,Subject 1,Snippet 1,source1',
      'rec_train_2,train,Legitimate,Legitimate,HIGH,Confirmed standard AWS notification,domain-2.org,usr@domain-2.org,Subject 2,Snippet 2,source2',
      'rec_val_1,val,Phishing,"",,,domain-3.org,usr@domain-3.org,Subject 3,Snippet 3,source3',
      'rec_test_1,test,Fraud-related,Impersonated,HIGH,Executive spoofing pretext,domain-4.org,usr@domain-4.org,Subject 4,Snippet 4,source4'
    ].join('\n') + '\n';

    fs.writeFileSync(testCsvPath, auditCsv, 'utf-8');

    const result = applyLabelCorrections({
      csvPath: testCsvPath,
      trainPath: testTrainPath,
      valPath: testValPath,
      testPath: testTestPath,
      holdoutPath: testHoldoutPath,
      reviewedCorrectionsPath: testCorrectionsPath,
      outReportPath: testReportPath
    });

    expect(result.total_rows_inspected).toBe(4);
    expect(result.blank_reviewed_rows).toBe(1);
    expect(result.confirmed_unchanged_rows).toBe(1);
    expect(result.corrections_applied_count).toBe(2);
    expect(result.adversarial_holdout_untouched).toBe(true);

    // Verify holdout hash was not changed
    const holdoutHashAfter = computeFileSha256(testHoldoutPath);
    expect(holdoutHashAfter).toBe(holdoutHashBefore);

    // Verify train split file was updated
    const updatedTrain: CommonRecord[] = JSON.parse(fs.readFileSync(testTrainPath, 'utf-8'));
    expect(updatedTrain[0].label).toBe('Phishing');
    expect(updatedTrain[0].metadata?.auditCorrection?.previousLabel).toBe('Suspicious');
    expect(updatedTrain[0].metadata?.auditCorrection?.reviewerNotes).toBe('Urgent credential harvest link confirmed');
    expect(updatedTrain[1].label).toBe('Legitimate');

    // Verify test split file was updated
    const updatedTest: CommonRecord[] = JSON.parse(fs.readFileSync(testTestPath, 'utf-8'));
    expect(updatedTest[0].label).toBe('Impersonated');
    expect(updatedTest[0].metadata?.auditCorrection?.previousLabel).toBe('Fraud-related');

    // Verify report was created
    expect(fs.existsSync(testReportPath)).toBe(true);
    const reportData = JSON.parse(fs.readFileSync(testReportPath, 'utf-8'));
    expect(reportData.corrections_applied_count).toBe(2);
    expect(reportData.adversarial_holdout_untouched).toBe(true);

    // Verify reviewed_corrections.json was updated with history
    expect(fs.existsSync(testCorrectionsPath)).toBe(true);
    const reviewedCorrections = JSON.parse(fs.readFileSync(testCorrectionsPath, 'utf-8'));
    expect(reviewedCorrections.length).toBe(2);
    expect(reviewedCorrections[0].label).toBe('Phishing');
    expect(reviewedCorrections[1].label).toBe('Impersonated');
  });

  it('9. Real splits sampling test: samples exactly 30 records per class (150 total) from actual dataset', () => {
    const summary = generateLabelAudit({
      outCsvPath: testCsvPath,
      outSummaryPath: testSummaryPath,
      sampleSizePerClass: 30
    });

    expect(summary.summary.total_sampled).toBe(150);
    for (const label of FORENSIC_LABELS) {
      expect(summary.summary.samples_per_class[label]).toBe(30);
    }

    expect(fs.existsSync(testCsvPath)).toBe(true);
    expect(fs.existsSync(testSummaryPath)).toBe(true);

    // Verify CSV content parsing
    const content = fs.readFileSync(testCsvPath, 'utf-8');
    const parsed = parseAuditCsv(content);
    expect(parsed.length).toBe(150);

    // Verify each class has 30 rows
    const classCount: Record<string, number> = {};
    for (const r of parsed) {
      classCount[r.current_label] = (classCount[r.current_label] || 0) + 1;
      expect(r.reviewed_label).toBe(''); // Initially empty for user review
    }

    for (const label of FORENSIC_LABELS) {
      expect(classCount[label]).toBe(30);
    }
  });
});
