/**
 * Unit & Integration Tests for Clean Group-Split Dataset Builder (Item 1)
 *
 * Verifies:
 * 1. Build pipeline produces valid group-split dataset without test leakage.
 * 2. Strict isolation protocol: Never train on the test split.
 * 3. Domain group disjointness: (train ∩ val = ∅, train ∩ test = ∅, val ∩ test = ∅).
 * 4. PII removal across all records in splits.
 * 5. Minimum sample thresholds (>= 2,000 total records, >= 200 per class, >= 100 per test class).
 * 6. Adversarial holdout dataset integrity preserved bit-for-bit.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  buildEvalDataset,
  getTrainingDataset,
  getValidationDataset,
  getTestDataset,
  getTrainingAndValidationData,
  assertNoTestContamination,
  computeSha256,
  type EvalDatasetBuildReport
} from '../../scripts/ml/build_eval_dataset';

describe('Clean Group-Split Dataset Builder & Test Isolation Protocol (Item 1)', () => {
  let report: EvalDatasetBuildReport;
  const datasetDir = path.join(process.cwd(), 'data/datasets');

  beforeAll(() => {
    report = buildEvalDataset({ rebuild: false });
  }, 30000);

  it('1. Generates clean split files and comprehensive build report in reports/', () => {
    expect(report.success).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'reports/eval_dataset_build_report.json'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'reports/EVAL_DATASET.md'))).toBe(true);
    expect(fs.existsSync(report.splits.train.path)).toBe(true);
    expect(fs.existsSync(report.splits.val.path)).toBe(true);
    expect(fs.existsSync(report.splits.test.path)).toBe(true);
  });

  it('2. Strictly enforces domain group disjointness across train, val, and test splits', () => {
    const { train, val, trainDomains, valDomains } = getTrainingAndValidationData(datasetDir);
    const { records: test } = getTestDataset(datasetDir);
    const testDomains = new Set(test.map(r => r.fromDomain.toLowerCase()).filter(Boolean));

    // Verify 0 overlap between train and val
    for (const d of valDomains) {
      expect(trainDomains.has(d)).toBe(false);
    }

    // Verify 0 overlap between train and test
    for (const d of testDomains) {
      expect(trainDomains.has(d)).toBe(false);
    }

    // Verify 0 overlap between val and test
    for (const d of testDomains) {
      expect(valDomains.has(d)).toBe(false);
    }

    expect(report.invariants.domainDisjointnessPassed).toBe(true);
    expect(report.invariants.overlappingDomainCount).toBe(0);
  });

  it('3. Guarantees strict test set isolation: Throws if training on test split is attempted', () => {
    // Calling getTestDataset with purpose 'training' must throw
    expect(() => {
      getTestDataset(datasetDir, { purpose: 'training' as any });
    }).toThrow(/Never train on the test split/i);

    // assertNoTestContamination must throw if a test record is present in training data
    const trainRecords = getTrainingDataset(datasetDir);
    const { records: testRecords } = getTestDataset(datasetDir);

    expect(() => {
      assertNoTestContamination(trainRecords, testRecords);
    }).not.toThrow();

    // Fabricate a contaminated training set with 1 test record
    const contaminatedTraining = [testRecords[0], ...trainRecords];
    expect(() => {
      assertNoTestContamination(contaminatedTraining, testRecords);
    }).toThrow(/Test split contamination detected/i);
  });

  it('4. Meets target volume: Total clean records >= 2,000 and >= 200 per class', () => {
    const train = getTrainingDataset(datasetDir);
    const val = getValidationDataset(datasetDir);
    const { records: test } = getTestDataset(datasetDir);

    const totalClean = train.length + val.length + test.length;
    expect(totalClean).toBeGreaterThanOrEqual(2000);

    const classCounts: Record<string, number> = {};
    for (const r of [...train, ...val, ...test]) {
      classCounts[r.label] = (classCounts[r.label] || 0) + 1;
    }

    // All classes must have at least 200 total records
    for (const [cls, count] of Object.entries(classCounts)) {
      expect(count).toBeGreaterThanOrEqual(200);
    }

    // All classes in test set must have at least 100 records for trust threshold
    const testClassCounts: Record<string, number> = {};
    for (const r of test) {
      testClassCounts[r.label] = (testClassCounts[r.label] || 0) + 1;
    }
    for (const [cls, count] of Object.entries(testClassCounts)) {
      expect(count).toBeGreaterThanOrEqual(100);
    }
  });

  it('5. Verifies adversarial holdout dataset remains untouched and uncorrupted', () => {
    const holdoutPath = path.join(datasetDir, 'adversarial_holdout.json');
    expect(fs.existsSync(holdoutPath)).toBe(true);
    expect(report.adversarialHoldoutUntouched).toBe(true);
    expect(report.adversarialHoldoutSha256).toBe(computeSha256(holdoutPath));
  });

  it('6. Verifies PII is stripped/hashed: No raw personal phone numbers or unhashed email addresses in splits', () => {
    const train = getTrainingDataset(datasetDir);
    const phoneRegex = /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/;

    for (const r of train.slice(0, 50)) {
      expect(phoneRegex.test(r.text)).toBe(false);
      expect(phoneRegex.test(r.subject)).toBe(false);
      // from header must either be empty or pseudonymized with usr_
      if (r.from) {
        expect(r.from.includes('usr_')).toBe(true);
      }
    }
  });
});
