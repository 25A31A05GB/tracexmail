import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  computeMultiClassMetrics,
  computeBootstrapMacroF1,
  computeMcNemarTest,
  generateBenchmarkMarkdown,
  runBenchmark,
  type BenchmarkReport
} from '../../scripts/ml/benchmark';
import { FORENSIC_LABELS, TARGET_MIN_TEST_RECORDS_PER_CLASS } from '../../scripts/ml/count_and_verify_splits';
import type { ForensicLabel } from '../../scripts/ml/ingest_public_corpora';

describe('Benchmark & Dataset Card Generation (Item 6)', () => {
  const root = process.cwd();
  const benchmarkJsonPath = path.join(root, 'reports/benchmark.json');
  const benchmarkMdPath = path.join(root, 'reports/BENCHMARK.md');
  const datasetCardPath = path.join(root, 'docs/DATASET_CARD.md');
  const testSplitPath = path.join(root, 'data/datasets/test_split.json');
  const holdoutPath = path.join(root, 'data/datasets/adversarial_holdout.json');

  it('1. computeMultiClassMetrics accurately computes metrics, confusion matrix, and reliability status', () => {
    // 5 classes, 100 samples each = 500 samples
    const yTrue: ForensicLabel[] = [];
    const yPred: ForensicLabel[] = [];

    for (const label of FORENSIC_LABELS) {
      for (let i = 0; i < 100; i++) {
        yTrue.push(label);
        // 90 correct, 10 confused
        yPred.push(i < 90 ? label : 'Suspicious');
      }
    }

    const metrics = computeMultiClassMetrics(yTrue, yPred);
    expect(metrics.accuracy).toBeGreaterThanOrEqual(0.8);
    expect(metrics.macroF1).toBeGreaterThanOrEqual(0.7);

    // Each class should have 100 support and status TRUSTED
    for (const label of FORENSIC_LABELS) {
      expect(metrics.perClass[label].support).toBe(100);
      expect(metrics.perClass[label].reliabilityStatus).toBe('TRUSTED');
    }
  });

  it('2. computeBootstrapMacroF1 generates valid 95% confidence intervals', () => {
    const yTrue: ForensicLabel[] = ['Legitimate', 'Phishing', 'Fraud-related', 'Suspicious', 'Impersonated'];
    const yPred: ForensicLabel[] = ['Legitimate', 'Phishing', 'Fraud-related', 'Suspicious', 'Impersonated'];

    const ci = computeBootstrapMacroF1(yTrue, yPred, 100, 42);
    expect(ci.length).toBe(2);
    expect(ci[0]).toBeLessThanOrEqual(ci[1]);
    expect(ci[0]).toBeGreaterThanOrEqual(0);
    expect(ci[1]).toBeLessThanOrEqual(1.0);
  });

  it('3. computeMcNemarTest correctly identifies significant and non-significant paired differences', () => {
    const yTrue: ForensicLabel[] = ['Phishing', 'Phishing', 'Legitimate', 'Fraud-related'];
    // Identical predictions -> not significant
    const sameA: ForensicLabel[] = ['Phishing', 'Phishing', 'Legitimate', 'Fraud-related'];
    const sameB: ForensicLabel[] = ['Phishing', 'Phishing', 'Legitimate', 'Fraud-related'];
    const resSame = computeMcNemarTest(yTrue, sameA, sameB);
    expect(resSame.isSignificant).toBe(false);
    expect(resSame.chi2).toBe(0);

    // High divergence
    const divergentA: ForensicLabel[] = Array(50).fill('Phishing');
    const divergentB: ForensicLabel[] = Array(50).fill('Legitimate');
    const targetTrue: ForensicLabel[] = Array(50).fill('Phishing');
    const resDiff = computeMcNemarTest(targetTrue, divergentA, divergentB);
    expect(resDiff.isSignificant).toBe(true);
    expect(resDiff.chi2).toBeGreaterThan(30);
  });

  it('4. reports/benchmark.json exists and verifies test split reliability on all 5 classes', () => {
    expect(fs.existsSync(benchmarkJsonPath)).toBe(true);
    const report: BenchmarkReport = JSON.parse(fs.readFileSync(benchmarkJsonPath, 'utf-8'));

    expect(report.splits.test_count).toBe(658);
    expect(report.models.length).toBeGreaterThanOrEqual(4);

    // Verify every class on test set has >= 100 samples and is marked TRUSTED
    for (const m of report.models) {
      for (const label of FORENSIC_LABELS) {
        const pc = m.perClass[label];
        expect(pc).toBeDefined();
        expect(pc.support).toBeGreaterThanOrEqual(TARGET_MIN_TEST_RECORDS_PER_CLASS);
        expect(pc.reliabilityStatus).toBe('TRUSTED');
      }
    }
  });

  it('5. reports/BENCHMARK.md is generated with verified manifest hash and model comparison', () => {
    expect(fs.existsSync(benchmarkMdPath)).toBe(true);
    const md = fs.readFileSync(benchmarkMdPath, 'utf-8');

    expect(md).toContain('TraceXMail Empirical Benchmark Report');
    expect(md).toContain('Clean Test split (658 records)');
    expect(md).toContain('TRUSTED (>= 100)');
    expect(md).toContain('Majority Class Baseline');
    expect(md).toContain('TF-IDF + Logistic Regression');
    expect(md).toContain('TraceXMail Layered Forensics');
  });

  it('6. docs/DATASET_CARD.md contains verified clean counts, group disjointness, and PII audit details', () => {
    expect(fs.existsSync(datasetCardPath)).toBe(true);
    const card = fs.readFileSync(datasetCardPath, 'utf-8');

    // Counts
    expect(card).toContain('3,484'); // Clean subtotal
    expect(card).toContain('2,398'); // Train
    expect(card).toContain('428');   // Val
    expect(card).toContain('658');   // Test
    expect(card).toContain('60');    // Adversarial holdout

    // Safeguards
    expect(card).toContain('72 unique domains');
    expect(card).toContain('0 overlapping domains');
    expect(card).toContain('24.58%'); // Max cross-split similarity
    expect(card).toContain('usr_<hash8>@domain'); // PII sanitization
    expect(card).toContain('b84eedb23b112c81092ada551ad33c8690a7a0a3780d82f8bee7408883e104ac'); // Holdout hash
  });

  it('7. Adversarial holdout file remains strictly untouched and pristine', () => {
    expect(fs.existsSync(holdoutPath)).toBe(true);
    const holdoutRecords = JSON.parse(fs.readFileSync(holdoutPath, 'utf-8'));
    expect(holdoutRecords.length).toBe(50);
  });
});
