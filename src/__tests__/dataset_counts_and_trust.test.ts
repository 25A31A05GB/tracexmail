import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  evaluateTestReliability,
  computeDatasetCounts,
  generateMarkdownReport,
  runCountAndVerify,
  FORENSIC_LABELS,
  TARGET_MIN_TOTAL_RECORDS,
  TARGET_MIN_CLASS_TOTAL,
  TARGET_MIN_TEST_RECORDS_PER_CLASS,
  UNTRUSTED_METRIC_LABEL
} from '../../scripts/ml/count_and_verify_splits';
import type { CommonRecord } from '../../scripts/ml/ingest_public_corpora';

describe('Dataset Counts & Metric Reliability Verification (Item 4)', () => {
  const testTmpDir = path.join(process.cwd(), 'data/test_counts_tmp');
  const testTrainPath = path.join(testTmpDir, 'train.json');
  const testValPath = path.join(testTmpDir, 'val.json');
  const testTestPath = path.join(testTmpDir, 'test.json');
  const testJsonReport = path.join(testTmpDir, 'report.json');
  const testMdReport = path.join(testTmpDir, 'report.md');

  beforeEach(() => {
    if (fs.existsSync(testTmpDir)) fs.rmSync(testTmpDir, { recursive: true, force: true });
    fs.mkdirSync(testTmpDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testTmpDir)) fs.rmSync(testTmpDir, { recursive: true, force: true });
  });

  it('1. Correctly identifies classes with < 100 test samples and marks them "too small to trust"', () => {
    // 99 samples (< 100) -> too small to trust
    const untrustedCheck = evaluateTestReliability(99, 'Phishing');
    expect(untrustedCheck.isTrusted).toBe(false);
    expect(untrustedCheck.status).toBe(UNTRUSTED_METRIC_LABEL);
    expect(untrustedCheck.note).toContain(UNTRUSTED_METRIC_LABEL);

    // 0 samples -> too small to trust
    const zeroCheck = evaluateTestReliability(0, 'Fraud-related');
    expect(zeroCheck.isTrusted).toBe(false);
    expect(zeroCheck.status).toBe(UNTRUSTED_METRIC_LABEL);

    // 100 samples -> TRUSTED
    const thresholdCheck = evaluateTestReliability(100, 'Legitimate');
    expect(thresholdCheck.isTrusted).toBe(true);
    expect(thresholdCheck.status).toBe('TRUSTED');

    // 150 samples -> TRUSTED
    const trustedCheck = evaluateTestReliability(150, 'Suspicious');
    expect(trustedCheck.isTrusted).toBe(true);
    expect(trustedCheck.status).toBe('TRUSTED');
  });

  it('2. Evaluates simulated dataset where one class is below 100 test records', () => {
    // Generate synthetic mock records
    const train: CommonRecord[] = [];
    const val: CommonRecord[] = [];
    const test: CommonRecord[] = [];

    // All classes have 250 in train, 50 in val
    for (const label of FORENSIC_LABELS) {
      for (let i = 0; i < 250; i++) {
        train.push({
          id: `train_${label}_${i}`,
          subject: `${label} subject`,
          text: `${label} text body`,
          from: `user@domain-${label}.com`,
          fromDomain: `domain-${label}.com`,
          label,
          source: 'Simulated Source',
          corpus: 'sim_corpus',
          license: 'MIT',
          ingestedAt: new Date().toISOString()
        });
      }
      for (let i = 0; i < 50; i++) {
        val.push({
          id: `val_${label}_${i}`,
          subject: `${label} subject`,
          text: `${label} text body`,
          from: `user@domain-${label}.com`,
          fromDomain: `domain-${label}.com`,
          label,
          source: 'Simulated Source',
          corpus: 'sim_corpus',
          license: 'MIT',
          ingestedAt: new Date().toISOString()
        });
      }
    }

    // In test: 4 classes have 120 samples, but 'Fraud-related' has only 85 samples (< 100)
    for (const label of FORENSIC_LABELS) {
      const testCount = label === 'Fraud-related' ? 85 : 120;
      for (let i = 0; i < testCount; i++) {
        test.push({
          id: `test_${label}_${i}`,
          subject: `${label} subject`,
          text: `${label} text body`,
          from: `user@domain-${label}.com`,
          fromDomain: `domain-${label}.com`,
          label,
          source: 'Simulated Source',
          corpus: 'sim_corpus',
          license: 'MIT',
          ingestedAt: new Date().toISOString()
        });
      }
    }

    fs.writeFileSync(testTrainPath, JSON.stringify(train, null, 2));
    fs.writeFileSync(testValPath, JSON.stringify(val, null, 2));
    fs.writeFileSync(testTestPath, JSON.stringify(test, null, 2));

    const report = computeDatasetCounts({
      trainPath: testTrainPath,
      valPath: testValPath,
      testPath: testTestPath
    });

    expect(report.targets.totalRecordsTargetMet).toBe(true);
    expect(report.targets.perClassTotalTargetMet).toBe(true);
    expect(report.targets.allClassesMeetTestReliability).toBe(false);
    expect(report.classesMarkedTooSmallToTrust).toContain('Fraud-related');
    expect(report.perClassCounts['Fraud-related'].testReliabilityStatus).toBe(UNTRUSTED_METRIC_LABEL);
    expect(report.perClassCounts['Legitimate'].testReliabilityStatus).toBe('TRUSTED');

    const mdReport = generateMarkdownReport(report);
    expect(mdReport).toContain(UNTRUSTED_METRIC_LABEL);
    expect(mdReport).toContain('Fraud-related');
  });

  it('3. Computes accurate counts from actual project split datasets and verifies all targets', () => {
    const report = runCountAndVerify({
      jsonReportPath: testJsonReport,
      mdReportPath: testMdReport
    });

    // 1. Verify target >= 2,000 records
    expect(report.totalRecordsAcrossSplits).toBeGreaterThanOrEqual(TARGET_MIN_TOTAL_RECORDS);
    expect(report.targets.totalRecordsTargetMet).toBe(true);

    // 2. Verify target >= 200 records per class across the dataset
    expect(report.targets.perClassTotalTargetMet).toBe(true);
    for (const label of FORENSIC_LABELS) {
      const classSummary = report.perClassCounts[label];
      expect(classSummary.total).toBeGreaterThanOrEqual(TARGET_MIN_CLASS_TOTAL);
    }

    // 3. Verify test set reliability: all 5 classes have >= 100 test records
    expect(report.targets.allClassesMeetTestReliability).toBe(true);
    expect(report.classesMarkedTooSmallToTrust.length).toBe(0);
    for (const label of FORENSIC_LABELS) {
      const classSummary = report.perClassCounts[label];
      expect(classSummary.test).toBeGreaterThanOrEqual(TARGET_MIN_TEST_RECORDS_PER_CLASS);
      expect(classSummary.testReliabilityStatus).toBe('TRUSTED');
    }

    // 4. Verify per-source counts exist and sum to total
    expect(Object.keys(report.perSourceCounts).length).toBeGreaterThan(0);
    let totalFromSources = 0;
    for (const src of Object.values(report.perSourceCounts)) {
      totalFromSources += src.total;
    }
    expect(totalFromSources).toBe(report.totalRecordsAcrossSplits);

    // 5. Verify generated report files
    expect(fs.existsSync(testJsonReport)).toBe(true);
    expect(fs.existsSync(testMdReport)).toBe(true);

    const jsonParsed = JSON.parse(fs.readFileSync(testJsonReport, 'utf8'));
    expect(jsonParsed.totalRecordsAcrossSplits).toBe(report.totalRecordsAcrossSplits);

    const mdContent = fs.readFileSync(testMdReport, 'utf8');
    expect(mdContent).toContain('TraceXMail Machine Learning Dataset Counts');
    expect(mdContent).toContain('ALL TRUSTED');
  });
});
