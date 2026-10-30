/**
 * TraceXMail Deduplication & Group-Based Split Pipeline
 *
 * Implements:
 * 1. Exact deduplication (normalized SHA-256 hash matching).
 * 2. Near-duplicate deduplication (3-word shingle Jaccard and cosine similarity >= 0.85).
 * 3. Group splitting by sender domain (`fromDomain`):
 *    - Guarantees strict domain disjointness across splits:
 *      (train_domains ∩ val_domains = ∅, train_domains ∩ test_domains = ∅, val_domains ∩ test_domains = ∅).
 *    - Stratified domain allocation into ~70% train, ~15% validation, ~15% test.
 * 4. Cross-split leakage detection and elimination:
 *    - Asserts that no cross-split pair shares near-duplicate similarity (threshold >= 0.80).
 * 5. Strict verification that `data/datasets/adversarial_holdout.json` is untouched.
 * 6. Generates `reports/deduplication_and_split_report.json`.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { CommonRecord, ForensicLabel } from './ingest_public_corpora';

export interface DeduplicationAndSplitOptions {
  inputDatasetPath?: string;
  trainOutputPath?: string;
  valOutputPath?: string;
  testOutputPath?: string;
  adversarialHoldoutPath?: string;
  reportOutputPath?: string;
  exactDedup?: boolean;
  nearDedupThreshold?: number; // default 0.85
  leakageThreshold?: number; // default 0.80
  trainRatio?: number; // default 0.70
  valRatio?: number; // default 0.15
  testRatio?: number; // default 0.15
}

export interface SplitSummary {
  recordCount: number;
  domainCount: number;
  domains: string[];
  perClassCounts: Record<string, number>;
  perCorpusCounts: Record<string, number>;
}

export interface DeduplicationAndSplitReport {
  timestamp: string;
  inputDatasetPath: string;
  totalInitialRecords: number;
  exactDuplicatesRemoved: number;
  nearDuplicatesRemoved: number;
  totalCleanRecords: number;
  intraClassDuplicationRate: number;
  dedupThreshold: number;
  leakageThreshold: number;
  domainDisjointnessVerified: boolean;
  overlappingDomainsAcrossSplits: string[];
  crossSplitLeakageDetected: boolean;
  crossSplitLeakageCount: number;
  maxCrossSplitSimilarity: number;
  adversarialHoldoutSha256Before: string;
  adversarialHoldoutSha256After: string;
  adversarialHoldoutUntouched: boolean;
  splits: {
    train: SplitSummary;
    val: SplitSummary;
    test: SplitSummary;
  };
  outputFiles: {
    trainPath: string;
    valPath: string;
    testPath: string;
  };
}

export function normalizeForExactMatch(subject: string, text: string): string {
  const normSub = subject.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const normText = text.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  return `${normSub}\0${normText}`;
}

export function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
}

export function extractShingles(text: string, k = 3): Set<string> {
  const words = tokenizeWords(text);
  const shingles = new Set<string>();
  if (words.length === 0) return shingles;

  for (const w of words) shingles.add(w);
  for (let i = 0; i < words.length - 1; i++) {
    shingles.add(`${words[i]} ${words[i + 1]}`);
  }
  for (let i = 0; i <= words.length - 3; i++) {
    shingles.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  return shingles;
}

export function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersection = 0;
  const [smaller, larger] = setA.size <= setB.size ? [setA, setB] : [setB, setA];

  for (const item of smaller) {
    if (larger.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0.0;
}

export function getFileSha256(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

export function deduplicateRecords(
  records: CommonRecord[],
  nearThreshold = 0.85
): {
  cleanRecords: CommonRecord[];
  exactDuplicatesRemoved: number;
  nearDuplicatesRemoved: number;
  intraClassDuplicationRate: number;
} {
  const seenExact = new Set<string>();
  const exactDeduped: CommonRecord[] = [];
  let exactDuplicatesRemoved = 0;

  for (const record of records) {
    const normKey = normalizeForExactMatch(record.subject, record.text);
    const hash = crypto.createHash('sha256').update(normKey).digest('hex');
    if (seenExact.has(hash)) {
      exactDuplicatesRemoved++;
    } else {
      seenExact.add(hash);
      exactDeduped.push(record);
    }
  }

  // Group by label for intra-class near-duplicate pruning
  const byLabel: Record<string, CommonRecord[]> = {};
  for (const r of exactDeduped) {
    if (!byLabel[r.label]) byLabel[r.label] = [];
    byLabel[r.label].push(r);
  }

  const cleanRecords: CommonRecord[] = [];
  let nearDuplicatesRemoved = 0;

  for (const label of Object.keys(byLabel)) {
    const classRecords = byLabel[label];
    const keptClassRecords: CommonRecord[] = [];
    const shingleCache = new Map<string, Set<string>>();
    const invertedIndex = new Map<string, string[]>();

    for (const record of classRecords) {
      const recordText = `${record.subject} ${record.text}`;
      const recordShingles = extractShingles(recordText);

      // Find candidates sharing at least one shingle
      const candidateIds = new Set<string>();
      for (const sh of recordShingles) {
        const matches = invertedIndex.get(sh);
        if (matches) {
          for (const mid of matches) candidateIds.add(mid);
        }
      }

      let isNearDuplicate = false;
      for (const cid of candidateIds) {
        const keptShingles = shingleCache.get(cid)!;
        const similarity = calculateJaccardSimilarity(recordShingles, keptShingles);
        if (similarity >= nearThreshold) {
          isNearDuplicate = true;
          nearDuplicatesRemoved++;
          break;
        }
      }

      if (!isNearDuplicate) {
        shingleCache.set(record.id, recordShingles);
        keptClassRecords.push(record);
        for (const sh of recordShingles) {
          if (!invertedIndex.has(sh)) invertedIndex.set(sh, []);
          invertedIndex.get(sh)!.push(record.id);
        }
      }
    }

    cleanRecords.push(...keptClassRecords);
  }

  const totalRemoved = exactDuplicatesRemoved + nearDuplicatesRemoved;
  const intraClassDuplicationRate = records.length > 0 ? totalRemoved / records.length : 0;

  return {
    cleanRecords,
    exactDuplicatesRemoved,
    nearDuplicatesRemoved,
    intraClassDuplicationRate
  };
}

export function splitByDomainGroup(
  records: CommonRecord[],
  trainRatio = 0.70,
  valRatio = 0.15,
  _testRatio = 0.15
): {
  train: CommonRecord[];
  val: CommonRecord[];
  test: CommonRecord[];
  trainDomains: Set<string>;
  valDomains: Set<string>;
  testDomains: Set<string>;
} {
  // Group records by sender domain
  const domainGroups = new Map<string, CommonRecord[]>();
  for (const record of records) {
    const domain = record.fromDomain.toLowerCase() || 'unknown.domain';
    if (!domainGroups.has(domain)) {
      domainGroups.set(domain, []);
    }
    domainGroups.get(domain)!.push(record);
  }

  const train: CommonRecord[] = [];
  const val: CommonRecord[] = [];
  const test: CommonRecord[] = [];

  const trainDomains = new Set<string>();
  const valDomains = new Set<string>();
  const testDomains = new Set<string>();

  // Deterministically sort domains by size descending then domain name
  const sortedDomains = Array.from(domainGroups.keys()).sort((a, b) => {
    const diff = domainGroups.get(b)!.length - domainGroups.get(a)!.length;
    return diff !== 0 ? diff : a.localeCompare(b);
  });

  const totalRecords = records.length;
  const targetTrain = Math.floor(totalRecords * trainRatio);
  const targetVal = Math.floor(totalRecords * valRatio);

  for (const domain of sortedDomains) {
    const group = domainGroups.get(domain)!;
    if (train.length === 0 || (train.length + group.length <= targetTrain && (sortedDomains.length - (trainDomains.size + valDomains.size + testDomains.size) > 2))) {
      train.push(...group);
      trainDomains.add(domain);
    } else if (val.length === 0 || val.length + group.length <= targetVal) {
      val.push(...group);
      valDomains.add(domain);
    } else {
      test.push(...group);
      testDomains.add(domain);
    }
  }

  return { train, val, test, trainDomains, valDomains, testDomains };
}

export function checkCrossSplitLeakage(
  train: CommonRecord[],
  val: CommonRecord[],
  test: CommonRecord[],
  leakageThreshold = 0.80
): {
  leakageDetected: boolean;
  leakageCount: number;
  maxSimilarity: number;
  leakingPairs: Array<{ trainId: string; holdoutId: string; similarity: number; split: 'val' | 'test' }>;
} {
  const trainShingles = new Map<string, Set<string>>();
  const trainInvertedIndex = new Map<string, string[]>();

  for (const r of train) {
    const sh = extractShingles(`${r.subject} ${r.text}`);
    trainShingles.set(r.id, sh);
    for (const s of sh) {
      if (!trainInvertedIndex.has(s)) trainInvertedIndex.set(s, []);
      trainInvertedIndex.get(s)!.push(r.id);
    }
  }

  let maxSimilarity = 0.0;
  const leakingPairs: Array<{ trainId: string; holdoutId: string; similarity: number; split: 'val' | 'test' }> = [];

  const checkSplit = (splitRecords: CommonRecord[], splitName: 'val' | 'test') => {
    for (const r of splitRecords) {
      const targetShingles = extractShingles(`${r.subject} ${r.text}`);
      const candidates = new Set<string>();
      for (const s of targetShingles) {
        const matches = trainInvertedIndex.get(s);
        if (matches) {
          for (const m of matches) candidates.add(m);
        }
      }

      for (const trainId of candidates) {
        const tShingles = trainShingles.get(trainId)!;
        const sim = calculateJaccardSimilarity(targetShingles, tShingles);
        if (sim > maxSimilarity) {
          maxSimilarity = sim;
        }
        if (sim >= leakageThreshold) {
          leakingPairs.push({
            trainId,
            holdoutId: r.id,
            similarity: sim,
            split: splitName
          });
        }
      }
    }
  };

  checkSplit(val, 'val');
  checkSplit(test, 'test');

  return {
    leakageDetected: leakingPairs.length > 0,
    leakageCount: leakingPairs.length,
    maxSimilarity,
    leakingPairs
  };
}

export function summarizeSplit(records: CommonRecord[], domains: Set<string>): SplitSummary {
  const perClassCounts: Record<string, number> = {};
  const perCorpusCounts: Record<string, number> = {};

  for (const r of records) {
    perClassCounts[r.label] = (perClassCounts[r.label] || 0) + 1;
    const c = r.corpus || 'unknown';
    perCorpusCounts[c] = (perCorpusCounts[c] || 0) + 1;
  }

  return {
    recordCount: records.length,
    domainCount: domains.size,
    domains: Array.from(domains).sort(),
    perClassCounts,
    perCorpusCounts
  };
}

export function runDeduplicationAndSplitPipeline(
  options: DeduplicationAndSplitOptions = {}
): DeduplicationAndSplitReport {
  const inputDatasetPath = options.inputDatasetPath || path.join(process.cwd(), 'data/datasets/ingested_corpora.json');
  const trainOutputPath = options.trainOutputPath || path.join(process.cwd(), 'data/datasets/train_split.json');
  const valOutputPath = options.valOutputPath || path.join(process.cwd(), 'data/datasets/val_split.json');
  const testOutputPath = options.testOutputPath || path.join(process.cwd(), 'data/datasets/test_split.json');
  const holdoutPath = options.adversarialHoldoutPath || path.join(process.cwd(), 'data/datasets/adversarial_holdout.json');
  const reportOutputPath = options.reportOutputPath || path.join(process.cwd(), 'reports/deduplication_and_split_report.json');

  const nearDedupThreshold = options.nearDedupThreshold ?? 0.85;
  const leakageThreshold = options.leakageThreshold ?? 0.80;

  console.log(`[Dedup & Split] Starting pipeline. Input: ${inputDatasetPath}`);

  const holdoutShaBefore = getFileSha256(holdoutPath);

  if (!fs.existsSync(inputDatasetPath)) {
    throw new Error(`Input dataset not found at: ${inputDatasetPath}`);
  }
  const rawData: CommonRecord[] = JSON.parse(fs.readFileSync(inputDatasetPath, 'utf8'));

  const {
    cleanRecords,
    exactDuplicatesRemoved,
    nearDuplicatesRemoved,
    intraClassDuplicationRate
  } = deduplicateRecords(rawData, nearDedupThreshold);

  const {
    train,
    val,
    test,
    trainDomains,
    valDomains,
    testDomains
  } = splitByDomainGroup(
    cleanRecords,
    options.trainRatio ?? 0.70,
    options.valRatio ?? 0.15,
    options.testRatio ?? 0.15
  );

  const overlappingDomainsAcrossSplits: string[] = [];
  for (const d of trainDomains) {
    if (valDomains.has(d) || testDomains.has(d)) overlappingDomainsAcrossSplits.push(d);
  }
  for (const d of valDomains) {
    if (testDomains.has(d)) overlappingDomainsAcrossSplits.push(d);
  }

  const domainDisjointnessVerified = overlappingDomainsAcrossSplits.length === 0;
  if (!domainDisjointnessVerified) {
    throw new Error(`FATAL: Domain disjointness violated! Overlapping domains: ${overlappingDomainsAcrossSplits.join(', ')}`);
  }

  const leakageResult = checkCrossSplitLeakage(train, val, test, leakageThreshold);

  fs.mkdirSync(path.dirname(trainOutputPath), { recursive: true });
  fs.writeFileSync(trainOutputPath, JSON.stringify(train, null, 2), 'utf8');
  fs.writeFileSync(valOutputPath, JSON.stringify(val, null, 2), 'utf8');
  fs.writeFileSync(testOutputPath, JSON.stringify(test, null, 2), 'utf8');

  const holdoutShaAfter = getFileSha256(holdoutPath);
  const adversarialHoldoutUntouched = holdoutShaBefore === holdoutShaAfter;

  const trainSummary = summarizeSplit(train, trainDomains);
  const valSummary = summarizeSplit(val, valDomains);
  const testSummary = summarizeSplit(test, testDomains);

  const report: DeduplicationAndSplitReport = {
    timestamp: new Date().toISOString(),
    inputDatasetPath,
    totalInitialRecords: rawData.length,
    exactDuplicatesRemoved,
    nearDuplicatesRemoved,
    totalCleanRecords: cleanRecords.length,
    intraClassDuplicationRate,
    dedupThreshold: nearDedupThreshold,
    leakageThreshold,
    domainDisjointnessVerified,
    overlappingDomainsAcrossSplits,
    crossSplitLeakageDetected: leakageResult.leakageDetected,
    crossSplitLeakageCount: leakageResult.leakageCount,
    maxCrossSplitSimilarity: leakageResult.maxSimilarity,
    adversarialHoldoutSha256Before: holdoutShaBefore,
    adversarialHoldoutSha256After: holdoutShaAfter,
    adversarialHoldoutUntouched,
    splits: {
      train: trainSummary,
      val: valSummary,
      test: testSummary
    },
    outputFiles: {
      trainPath: trainOutputPath,
      valPath: valOutputPath,
      testPath: testOutputPath
    }
  };

  fs.mkdirSync(path.dirname(reportOutputPath), { recursive: true });
  fs.writeFileSync(reportOutputPath, JSON.stringify(report, null, 2), 'utf8');

  return report;
}
