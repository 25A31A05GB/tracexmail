/**
 * TraceXMail Label Audit Engine (Item 5)
 *
 * Requirements:
 * - Deterministically samples exactly 30 records per class (30 * 5 = 150 records)
 *   from train, val, and test splits into `reports/label_audit.csv`.
 * - Provides standard RFC-4180 CSV with clean escaping for manual human-in-the-loop audit.
 * - Leaves `reviewed_label`, `confidence_review`, and `reviewer_notes` blank for human auditor input.
 * - Generates structured metadata report in `reports/label_audit_summary.json`.
 */

import fs from 'fs';
import path from 'path';
import type { CommonRecord, ForensicLabel } from './ingest_public_corpora';
import { FORENSIC_LABELS } from './count_and_verify_splits';

export interface AuditRecordRow {
  id: string;
  split: 'train' | 'val' | 'test';
  current_label: ForensicLabel;
  reviewed_label: string;
  confidence_review: string;
  reviewer_notes: string;
  from_domain: string;
  from_address: string;
  subject: string;
  text_snippet: string;
  source: string;
}

export interface SplitRecord extends CommonRecord {
  splitName: 'train' | 'val' | 'test';
}

export interface LabelAuditOptions {
  trainPath?: string;
  valPath?: string;
  testPath?: string;
  outCsvPath?: string;
  outSummaryPath?: string;
  sampleSizePerClass?: number; // default: 30
  randomSeed?: number;        // default: 42 (deterministic PRNG)
}

export interface LabelAuditSummary {
  generated_at: string;
  target_sample_size_per_class: number;
  total_sampled: number;
  classes: ForensicLabel[];
  samples_per_class: Record<ForensicLabel, number>;
  samples_per_split: Record<'train' | 'val' | 'test', number>;
  class_split_matrix: Record<ForensicLabel, Record<'train' | 'val' | 'test', number>>;
  csv_file: string;
  instructions: string;
}

/**
 * Deterministic pseudo-random number generator (Mulberry32)
 */
export function createPrng(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Escapes a string field for RFC-4180 CSV compliance
 */
export function escapeCsvField(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  // If field contains double quotes, commas, or line breaks, enclose in quotes and escape quotes with ""
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Creates clean text snippet (replaces consecutive whitespace/newlines with a single space)
 */
export function createTextSnippet(text: string, maxLength: number = 220): string {
  const normalized = text
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length <= maxLength) return normalized;
  return normalized.substring(0, maxLength) + '...';
}

/**
 * Samples exactly N records per class from available split records deterministically
 */
export function sampleRecordsForAudit(
  records: SplitRecord[],
  sampleSizePerClass: number = 30,
  seed: number = 42
): SplitRecord[] {
  const prng = createPrng(seed);

  // Group records by class
  const byClass = new Map<ForensicLabel, SplitRecord[]>();
  for (const label of FORENSIC_LABELS) {
    byClass.set(label, []);
  }

  for (const record of records) {
    const list = byClass.get(record.label);
    if (list) {
      list.push(record);
    }
  }

  const sampledResult: SplitRecord[] = [];

  for (const label of FORENSIC_LABELS) {
    const pool = byClass.get(label) || [];
    if (pool.length === 0) {
      continue;
    }

    // Sort by id for deterministic baseline order before shuffle
    const sortedPool = [...pool].sort((a, b) => a.id.localeCompare(b.id));

    // Fisher-Yates shuffle using deterministic PRNG
    for (let i = sortedPool.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      const temp = sortedPool[i];
      sortedPool[i] = sortedPool[j];
      sortedPool[j] = temp;
    }

    // Take exactly sampleSizePerClass (or all if pool has fewer)
    const countToTake = Math.min(sampleSizePerClass, sortedPool.length);
    const selected = sortedPool.slice(0, countToTake);
    sampledResult.push(...selected);
  }

  // Sort final sample by class, then split, then id for predictable review layout
  sampledResult.sort((a, b) => {
    if (a.label !== b.label) return a.label.localeCompare(b.label);
    if (a.splitName !== b.splitName) return a.splitName.localeCompare(b.splitName);
    return a.id.localeCompare(b.id);
  });

  return sampledResult;
}

/**
 * Converts sampled SplitRecords to CSV rows
 */
export function formatAuditCsv(records: SplitRecord[]): string {
  const headers = [
    'id',
    'split',
    'current_label',
    'reviewed_label',
    'confidence_review',
    'reviewer_notes',
    'from_domain',
    'from_address',
    'subject',
    'text_snippet',
    'source'
  ];

  const lines: string[] = [headers.join(',')];

  for (const r of records) {
    const row: string[] = [
      escapeCsvField(r.id),
      escapeCsvField(r.splitName),
      escapeCsvField(r.label),
      escapeCsvField(''), // reviewed_label: blank for human entry
      escapeCsvField(''), // confidence_review: blank for human entry
      escapeCsvField(''), // reviewer_notes: blank for human entry
      escapeCsvField(r.fromDomain),
      escapeCsvField(r.from),
      escapeCsvField(r.subject),
      escapeCsvField(createTextSnippet(r.text)),
      escapeCsvField(r.source)
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n') + '\n';
}

/**
 * Executes the full Label Audit sampling and file generation
 */
export function generateLabelAudit(options: LabelAuditOptions = {}): {
  summary: LabelAuditSummary;
  sampledRecords: SplitRecord[];
  csvContent: string;
} {
  const workspaceRoot = process.cwd();
  const trainPath = options.trainPath || path.join(workspaceRoot, 'data/datasets/train_split.json');
  const valPath = options.valPath || path.join(workspaceRoot, 'data/datasets/val_split.json');
  const testPath = options.testPath || path.join(workspaceRoot, 'data/datasets/test_split.json');
  const outCsvPath = options.outCsvPath || path.join(workspaceRoot, 'reports/label_audit.csv');
  const outSummaryPath = options.outSummaryPath || path.join(workspaceRoot, 'reports/label_audit_summary.json');
  const sampleSize = options.sampleSizePerClass ?? 30;
  const seed = options.randomSeed ?? 42;

  // Load splits
  const trainData: CommonRecord[] = JSON.parse(fs.readFileSync(trainPath, 'utf-8'));
  const valData: CommonRecord[] = JSON.parse(fs.readFileSync(valPath, 'utf-8'));
  const testData: CommonRecord[] = JSON.parse(fs.readFileSync(testPath, 'utf-8'));

  const combinedWithSplit: SplitRecord[] = [
    ...trainData.map(r => ({ ...r, splitName: 'train' as const })),
    ...valData.map(r => ({ ...r, splitName: 'val' as const })),
    ...testData.map(r => ({ ...r, splitName: 'test' as const }))
  ];

  const sampled = sampleRecordsForAudit(combinedWithSplit, sampleSize, seed);

  // Compute breakdown stats
  const samplesPerClass: Record<ForensicLabel, number> = {
    Legitimate: 0,
    Suspicious: 0,
    Impersonated: 0,
    Phishing: 0,
    'Fraud-related': 0
  };

  const samplesPerSplit: Record<'train' | 'val' | 'test', number> = {
    train: 0,
    val: 0,
    test: 0
  };

  const classSplitMatrix: Record<ForensicLabel, Record<'train' | 'val' | 'test', number>> = {
    Legitimate: { train: 0, val: 0, test: 0 },
    Suspicious: { train: 0, val: 0, test: 0 },
    Impersonated: { train: 0, val: 0, test: 0 },
    Phishing: { train: 0, val: 0, test: 0 },
    'Fraud-related': { train: 0, val: 0, test: 0 }
  };

  for (const r of sampled) {
    samplesPerClass[r.label] = (samplesPerClass[r.label] || 0) + 1;
    samplesPerSplit[r.splitName] = (samplesPerSplit[r.splitName] || 0) + 1;
    classSplitMatrix[r.label][r.splitName] = (classSplitMatrix[r.label][r.splitName] || 0) + 1;
  }

  const csvContent = formatAuditCsv(sampled);

  // Ensure output directory exists
  const reportsDir = path.dirname(outCsvPath);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Write CSV
  fs.writeFileSync(outCsvPath, csvContent, 'utf-8');

  // Summary object
  const summary: LabelAuditSummary = {
    generated_at: new Date().toISOString(),
    target_sample_size_per_class: sampleSize,
    total_sampled: sampled.length,
    classes: [...FORENSIC_LABELS],
    samples_per_class: samplesPerClass,
    samples_per_split: samplesPerSplit,
    class_split_matrix: classSplitMatrix,
    csv_file: path.relative(workspaceRoot, outCsvPath),
    instructions:
      'Open reports/label_audit.csv in an editor or spreadsheet. To correct a label, enter one of [Legitimate, Suspicious, Impersonated, Phishing, Fraud-related] in the reviewed_label column, and optionally provide reviewer_notes. To keep the existing label, leave reviewed_label blank. When finished, run: npx tsx scripts/ml/apply_label_corrections.ts'
  };

  fs.writeFileSync(outSummaryPath, JSON.stringify(summary, null, 2), 'utf-8');

  return { summary, sampledRecords: sampled, csvContent };
}

// CLI runner
if (process.argv[1] && process.argv[1].endsWith('label_audit.ts')) {
  console.log('='.repeat(80));
  console.log('TRACE-X-MAIL DATASET LABEL AUDIT SAMPLER (Item 5)');
  console.log('='.repeat(80));

  try {
    const result = generateLabelAudit();
    console.log(`\nSampled ${result.summary.total_sampled} total records across ${result.summary.classes.length} classes:`);
    for (const [cls, count] of Object.entries(result.summary.samples_per_class)) {
      const splitInfo = result.summary.class_split_matrix[cls as ForensicLabel];
      console.log(`  - ${cls.padEnd(16)}: ${count} records (train: ${splitInfo.train}, val: ${splitInfo.val}, test: ${splitInfo.test})`);
    }

    console.log(`\nSplit Distribution:`);
    console.log(`  - Train: ${result.summary.samples_per_split.train}`);
    console.log(`  - Val:   ${result.summary.samples_per_split.val}`);
    console.log(`  - Test:  ${result.summary.samples_per_split.test}`);

    console.log(`\nAudit Files Generated:`);
    console.log(`  - CSV for review:    ${result.summary.csv_file}`);
    console.log(`  - Summary JSON:      reports/label_audit_summary.json`);
    console.log('\nAudit Instructions:');
    console.log(result.summary.instructions);
    console.log('='.repeat(80));
  } catch (err) {
    console.error('Failed to generate label audit:', err);
    process.exit(1);
  }
}
