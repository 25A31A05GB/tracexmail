import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  normalizeForExactMatch,
  extractShingles,
  calculateJaccardSimilarity,
  deduplicateRecords,
  splitByDomainGroup,
  checkCrossSplitLeakage,
  runDeduplicationAndSplitPipeline,
  getFileSha256
} from '../../scripts/ml/deduplicate_and_split';
import type { CommonRecord } from '../../scripts/ml/ingest_public_corpora';

describe('Deduplication, Domain Group Splitting & Leakage Tests (Item 3)', () => {
  const testTmpDir = path.join(process.cwd(), 'data/test_splits_tmp');
  const testInputPath = path.join(testTmpDir, 'test_input.json');
  const testTrainPath = path.join(testTmpDir, 'train.json');
  const testValPath = path.join(testTmpDir, 'val.json');
  const testTestPath = path.join(testTmpDir, 'test.json');
  const testReportPath = path.join(testTmpDir, 'report.json');
  const actualHoldoutPath = path.join(process.cwd(), 'data/datasets/adversarial_holdout.json');

  beforeEach(() => {
    if (fs.existsSync(testTmpDir)) fs.rmSync(testTmpDir, { recursive: true, force: true });
    fs.mkdirSync(testTmpDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testTmpDir)) fs.rmSync(testTmpDir, { recursive: true, force: true });
  });

  it('1. Correctly removes exact duplicate emails using normalized hashing', () => {
    const records: CommonRecord[] = [
      {
        id: 'rec_1',
        subject: 'Urgent Wire Transfer Request',
        text: 'Please send $45,000 to vendor account immediately.',
        from: 'CEO <ceo@exec-corp.com>',
        fromDomain: 'exec-corp.com',
        label: 'Fraud-related',
        source: 'test',
        corpus: 'test',
        license: 'MIT',
        ingestedAt: new Date().toISOString()
      },
      {
        id: 'rec_2',
        subject: 'urgent wire transfer request  ',
        text: 'Please send $45,000   to vendor account immediately.   ',
        from: 'CEO <ceo@exec-corp.com>',
        fromDomain: 'exec-corp.com',
        label: 'Fraud-related',
        source: 'test',
        corpus: 'test',
        license: 'MIT',
        ingestedAt: new Date().toISOString()
      },
      {
        id: 'rec_3',
        subject: 'Quarterly Financial Review',
        text: 'The Q3 earnings report has been uploaded to the investor relation portal.',
        from: 'IR <ir@exec-corp.com>',
        fromDomain: 'exec-corp.com',
        label: 'Legitimate',
        source: 'test',
        corpus: 'test',
        license: 'MIT',
        ingestedAt: new Date().toISOString()
      }
    ];

    const { cleanRecords, exactDuplicatesRemoved } = deduplicateRecords(records, 0.85);

    expect(exactDuplicatesRemoved).toBe(1);
    expect(cleanRecords.length).toBe(2);
    expect(cleanRecords.map(r => r.id)).toContain('rec_1');
    expect(cleanRecords.map(r => r.id)).toContain('rec_3');
    expect(cleanRecords.map(r => r.id)).not.toContain('rec_2');
  });

  it('2. Correctly prunes near-duplicate records within class when similarity >= 0.85', () => {
    const baseText = 'Your Microsoft 365 business license subscription for domain enterprise-cloud.org expires in 24 hours. The IT security team requires immediate re-verification. Click here to verify payment method and prevent permanent email suspension and account disruption.';
    const nearDupText = 'Your Microsoft 365 business license subscription for domain enterprise-cloud.org expires in 48 hours. The IT security team requires immediate re-verification. Click here to verify payment method and prevent permanent email suspension and account disruption.';
    const differentText = 'Notice of building maintenance: power generators will be tested on Sunday morning from 6am to 9am.';

    const records: CommonRecord[] = [
      {
        id: 'phish_1',
        subject: 'Microsoft 365 Notice',
        text: baseText,
        from: 'Support <support@ms-verify.com>',
        fromDomain: 'ms-verify.com',
        label: 'Phishing',
        source: 'test',
        corpus: 'test',
        license: 'MIT',
        ingestedAt: new Date().toISOString()
      },
      {
        id: 'phish_2',
        subject: 'Microsoft 365 Notice',
        text: nearDupText,
        from: 'Support <support@ms-verify.com>',
        fromDomain: 'ms-verify.com',
        label: 'Phishing',
        source: 'test',
        corpus: 'test',
        license: 'MIT',
        ingestedAt: new Date().toISOString()
      },
      {
        id: 'legit_1',
        subject: 'Building Notice',
        text: differentText,
        from: 'Facilities <facilities@company.internal>',
        fromDomain: 'company.internal',
        label: 'Legitimate',
        source: 'test',
        corpus: 'test',
        license: 'MIT',
        ingestedAt: new Date().toISOString()
      }
    ];

    const { cleanRecords, nearDuplicatesRemoved } = deduplicateRecords(records, 0.85);

    expect(nearDuplicatesRemoved).toBe(1);
    expect(cleanRecords.length).toBe(2);
    expect(cleanRecords.find(r => r.id === 'phish_1')).toBeDefined();
    expect(cleanRecords.find(r => r.id === 'phish_2')).toBeUndefined();
    expect(cleanRecords.find(r => r.id === 'legit_1')).toBeDefined();
  });

  it('3. Strictly enforces group domain disjointness (trainDomains ∩ valDomains ∩ testDomains = ∅)', () => {
    // Construct test records across 6 distinct domains
    const domains = [
      'aws-infra.com',
      'github-dev.com',
      'google-cloud.com',
      'phish-portal-a.net',
      'phish-portal-b.net',
      'phish-portal-c.net'
    ];

    const records: CommonRecord[] = [];
    domains.forEach((dom, dIdx) => {
      for (let i = 0; i < 20; i++) {
        records.push({
          id: `rec_${dom}_${i}`,
          subject: `Subject from ${dom} #${i}`,
          text: `Body content for item ${i} from unique sender organization domain ${dom}. Unique text sequence ${Math.random()}`,
          from: `sender@${dom}`,
          fromDomain: dom,
          label: dIdx < 3 ? 'Legitimate' : 'Phishing',
          source: 'test',
          corpus: 'test',
          license: 'MIT',
          ingestedAt: new Date().toISOString()
        });
      }
    });

    const {
      train,
      val,
      test,
      trainDomains,
      valDomains,
      testDomains
    } = splitByDomainGroup(records, 0.70, 0.15, 0.15);

    expect(train.length).toBeGreaterThan(0);
    expect(val.length).toBeGreaterThan(0);
    expect(test.length).toBeGreaterThan(0);

    // Assert disjointness: NO domain in train appears in val or test
    for (const dom of trainDomains) {
      expect(valDomains.has(dom)).toBe(false);
      expect(testDomains.has(dom)).toBe(false);
    }

    // NO domain in val appears in test
    for (const dom of valDomains) {
      expect(testDomains.has(dom)).toBe(false);
    }

    // Verify all records in each split match only their assigned domains
    for (const r of train) {
      expect(trainDomains.has(r.fromDomain)).toBe(true);
      expect(valDomains.has(r.fromDomain)).toBe(false);
      expect(testDomains.has(r.fromDomain)).toBe(false);
    }
    for (const r of val) {
      expect(valDomains.has(r.fromDomain)).toBe(true);
      expect(trainDomains.has(r.fromDomain)).toBe(false);
      expect(testDomains.has(r.fromDomain)).toBe(false);
    }
    for (const r of test) {
      expect(testDomains.has(r.fromDomain)).toBe(true);
      expect(trainDomains.has(r.fromDomain)).toBe(false);
      expect(valDomains.has(r.fromDomain)).toBe(false);
    }
  });

  it('4. Leakage test fails if any near-duplicate pair crosses splits', () => {
    const identicalText = 'CRITICAL ALERT: Your corporate credentials have been flagged for unusual sign-in activity from foreign IP.';

    const trainRecord: CommonRecord = {
      id: 'train_1',
      subject: 'Security Alert',
      text: identicalText,
      from: 'Security <alerts@domain-a.com>',
      fromDomain: 'domain-a.com',
      label: 'Phishing',
      source: 'test',
      corpus: 'test',
      license: 'MIT',
      ingestedAt: new Date().toISOString()
    };

    const leakingValRecord: CommonRecord = {
      id: 'val_leaking_1',
      subject: 'Security Alert',
      text: identicalText,
      from: 'Security <alerts@domain-b.com>',
      fromDomain: 'domain-b.com',
      label: 'Phishing',
      source: 'test',
      corpus: 'test',
      license: 'MIT',
      ingestedAt: new Date().toISOString()
    };

    const cleanTestRecord: CommonRecord = {
      id: 'test_clean_1',
      subject: 'Quarterly Offsite Meeting Logistics',
      text: 'Here is the agenda for next week offsite in Denver Colorado with lodging details.',
      from: 'Events <events@domain-c.com>',
      fromDomain: 'domain-c.com',
      label: 'Legitimate',
      source: 'test',
      corpus: 'test',
      license: 'MIT',
      ingestedAt: new Date().toISOString()
    };

    const leakage = checkCrossSplitLeakage([trainRecord], [leakingValRecord], [cleanTestRecord], 0.80);

    // Leakage MUST be detected because train_1 and val_leaking_1 share identical text
    expect(leakage.leakageDetected).toBe(true);
    expect(leakage.leakageCount).toBeGreaterThan(0);
    expect(leakage.maxSimilarity).toBeGreaterThanOrEqual(0.80);
    expect(leakage.leakingPairs[0].trainId).toBe('train_1');
    expect(leakage.leakingPairs[0].holdoutId).toBe('val_leaking_1');
  });

  it('5. Verifies data/datasets/adversarial_holdout.json is completely untouched', () => {
    expect(fs.existsSync(actualHoldoutPath)).toBe(true);

    const hash = getFileSha256(actualHoldoutPath);
    // Baseline SHA-256 hash established in EVAL_DATASET.md
    const expectedHash = '9752514ef29a99aeb5dba67dda84027c10584f241474476fb6b6451b2526843c';
    expect(hash).toBe(expectedHash);

    const holdoutData = JSON.parse(fs.readFileSync(actualHoldoutPath, 'utf8'));
    expect(Array.isArray(holdoutData)).toBe(true);
    expect(holdoutData.length).toBe(50);
  });

  it('6. End-to-end deduplicate and split pipeline execution passes all leakage and disjointness criteria', () => {
    const report = runDeduplicationAndSplitPipeline({
      inputDatasetPath: path.join(process.cwd(), 'data/datasets/ingested_corpora.json'),
      trainOutputPath: path.join(testTmpDir, 'train_split.json'),
      valOutputPath: path.join(testTmpDir, 'val_split.json'),
      testOutputPath: path.join(testTmpDir, 'test_split.json'),
      adversarialHoldoutPath: actualHoldoutPath,
      reportOutputPath: path.join(testTmpDir, 'test_report.json')
    });

    expect(report.totalCleanRecords).toBeGreaterThan(2000);
    expect(report.domainDisjointnessVerified).toBe(true);
    expect(report.overlappingDomainsAcrossSplits.length).toBe(0);
    expect(report.crossSplitLeakageDetected).toBe(false);
    expect(report.crossSplitLeakageCount).toBe(0);
    expect(report.maxCrossSplitSimilarity).toBeLessThan(0.80);
    expect(report.adversarialHoldoutUntouched).toBe(true);
    expect(report.adversarialHoldoutSha256After).toBe('9752514ef29a99aeb5dba67dda84027c10584f241474476fb6b6451b2526843c');

    // Check that every class has sufficient records in every split
    for (const splitName of ['train', 'val', 'test'] as const) {
      const summary = report.splits[splitName];
      expect(summary.recordCount).toBeGreaterThan(0);
      expect(summary.domainCount).toBeGreaterThan(0);
      expect(summary.perClassCounts['Legitimate']).toBeGreaterThan(0);
      expect(summary.perClassCounts['Suspicious']).toBeGreaterThan(0);
      expect(summary.perClassCounts['Impersonated']).toBeGreaterThan(0);
      expect(summary.perClassCounts['Phishing']).toBeGreaterThan(0);
      expect(summary.perClassCounts['Fraud-related']).toBeGreaterThan(0);
    }
  }, 60000);
});
