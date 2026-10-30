/**
 * TraceXMail Apply Label Corrections Engine (Item 5)
 *
 * Requirements:
 * - Parses `reports/label_audit.csv` (or user specified file).
 * - Identifies manual analyst corrections where `reviewed_label` is populated and differs from `current_label`.
 * - Strictly validates candidate labels against allowed ForensicLabel values.
 * - Applies updates directly to the corresponding split files (train_split.json, val_split.json, test_split.json).
 * - Preserves provenance in record metadata and updates `data/datasets/reviewed_corrections.json`.
 * - Verifies that `data/datasets/adversarial_holdout.json` remains strictly untouched.
 * - Outputs structured audit report in `reports/label_corrections_report.json`.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { CommonRecord, ForensicLabel } from './ingest_public_corpora';
import { FORENSIC_LABELS } from './count_and_verify_splits';

export interface AuditCsvRow {
  id: string;
  split: string;
  current_label: string;
  reviewed_label: string;
  confidence_review: string;
  reviewer_notes: string;
  from_domain: string;
  from_address: string;
  subject: string;
  text_snippet: string;
  source: string;
}

export interface AppliedCorrection {
  id: string;
  split: string;
  previousLabel: ForensicLabel;
  newLabel: ForensicLabel;
  confidenceReview?: string;
  reviewerNotes?: string;
  fromDomain: string;
  fromAddress: string;
  subject: string;
  source: string;
}

export interface ApplyCorrectionsOptions {
  csvPath?: string;
  trainPath?: string;
  valPath?: string;
  testPath?: string;
  holdoutPath?: string;
  reviewedCorrectionsPath?: string;
  outReportPath?: string;
  dryRun?: boolean;
}

export interface ApplyCorrectionsResult {
  applied_at: string;
  csv_file_read: string;
  total_rows_inspected: number;
  blank_reviewed_rows: number;
  confirmed_unchanged_rows: number;
  corrections_applied_count: number;
  adversarial_holdout_untouched: boolean;
  adversarial_holdout_sha256: string;
  corrections: AppliedCorrection[];
  updated_split_counts: {
    train: number;
    val: number;
    test: number;
  };
}

/**
 * Computes SHA-256 hash of a file for integrity verification
 */
export function computeFileSha256(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist for SHA-256 computation: ${filePath}`);
  }
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Robust RFC-4180 compliant CSV parser
 * Correctly parses multi-line values, escaped quotes (""), and commas within quotes
 */
export function parseRfc4180Csv(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < csvText.length) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++; // consume '\r'
        }
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Push remaining field if input didn't end with newline
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  // Filter out any trailing empty lines
  return rows.filter(row => row.length > 1 || (row.length === 1 && row[0].trim().length > 0));
}

/**
 * Parses Audit CSV into typed row records
 */
export function parseAuditCsv(csvContent: string): AuditCsvRow[] {
  const matrix = parseRfc4180Csv(csvContent);
  if (matrix.length === 0) {
    return [];
  }

  const headerRow = matrix[0].map(h => h.trim().toLowerCase());
  const headerMap = new Map<string, number>();
  headerRow.forEach((col, idx) => headerMap.set(col, idx));

  const getIdx = (colName: string) => headerMap.get(colName) ?? -1;

  const idIdx = getIdx('id');
  const splitIdx = getIdx('split');
  const currentLabelIdx = getIdx('current_label');
  const reviewedLabelIdx = getIdx('reviewed_label');
  const confidenceIdx = getIdx('confidence_review');
  const notesIdx = getIdx('reviewer_notes');
  const domainIdx = getIdx('from_domain');
  const addressIdx = getIdx('from_address');
  const subjectIdx = getIdx('subject');
  const snippetIdx = getIdx('text_snippet');
  const sourceIdx = getIdx('source');

  if (idIdx === -1 || currentLabelIdx === -1 || reviewedLabelIdx === -1) {
    throw new Error('CSV missing required headers. Expected at least: id, current_label, reviewed_label');
  }

  const results: AuditCsvRow[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (row.length === 0 || (row.length === 1 && !row[0].trim())) continue;

    results.push({
      id: row[idIdx]?.trim() || '',
      split: splitIdx !== -1 ? row[splitIdx]?.trim() || '' : '',
      current_label: row[currentLabelIdx]?.trim() || '',
      reviewed_label: row[reviewedLabelIdx]?.trim() || '',
      confidence_review: confidenceIdx !== -1 ? row[confidenceIdx]?.trim() || '' : '',
      reviewer_notes: notesIdx !== -1 ? row[notesIdx]?.trim() || '' : '',
      from_domain: domainIdx !== -1 ? row[domainIdx]?.trim() || '' : '',
      from_address: addressIdx !== -1 ? row[addressIdx]?.trim() || '' : '',
      subject: subjectIdx !== -1 ? row[subjectIdx]?.trim() || '' : '',
      text_snippet: snippetIdx !== -1 ? row[snippetIdx]?.trim() || '' : '',
      source: sourceIdx !== -1 ? row[sourceIdx]?.trim() || '' : ''
    });
  }

  return results;
}

/**
 * Validates a candidate label against the allowed ForensicLabel taxonomy
 */
export function isValidForensicLabel(label: string): label is ForensicLabel {
  return (FORENSIC_LABELS as readonly string[]).includes(label);
}

/**
 * Applies label corrections from audit CSV to dataset splits
 */
export function applyLabelCorrections(options: ApplyCorrectionsOptions = {}): ApplyCorrectionsResult {
  const workspaceRoot = process.cwd();
  const csvPath = options.csvPath || path.join(workspaceRoot, 'reports/label_audit.csv');
  const trainPath = options.trainPath || path.join(workspaceRoot, 'data/datasets/train_split.json');
  const valPath = options.valPath || path.join(workspaceRoot, 'data/datasets/val_split.json');
  const testPath = options.testPath || path.join(workspaceRoot, 'data/datasets/test_split.json');
  const holdoutPath = options.holdoutPath || path.join(workspaceRoot, 'data/datasets/adversarial_holdout.json');
  const reviewedCorrectionsPath = options.reviewedCorrectionsPath || path.join(workspaceRoot, 'data/datasets/reviewed_corrections.json');
  const outReportPath = options.outReportPath || path.join(workspaceRoot, 'reports/label_corrections_report.json');
  const dryRun = options.dryRun ?? false;

  // 1. Verify and record holdout hash BEFORE touching anything
  const holdoutSha256Before = computeFileSha256(holdoutPath);

  // 2. Read CSV
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Audit CSV file does not exist: ${csvPath}. Run scripts/ml/label_audit.ts first.`);
  }

  const csvRaw = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseAuditCsv(csvRaw);

  // 3. Load splits
  const trainRecords: CommonRecord[] = JSON.parse(fs.readFileSync(trainPath, 'utf-8'));
  const valRecords: CommonRecord[] = JSON.parse(fs.readFileSync(valPath, 'utf-8'));
  const testRecords: CommonRecord[] = JSON.parse(fs.readFileSync(testPath, 'utf-8'));

  // Build ID lookup maps
  const trainMap = new Map<string, { record: CommonRecord; splitName: 'train' }>();
  const valMap = new Map<string, { record: CommonRecord; splitName: 'val' }>();
  const testMap = new Map<string, { record: CommonRecord; splitName: 'test' }>();

  trainRecords.forEach(r => trainMap.set(r.id, { record: r, splitName: 'train' }));
  valRecords.forEach(r => valMap.set(r.id, { record: r, splitName: 'val' }));
  testRecords.forEach(r => testMap.set(r.id, { record: r, splitName: 'test' }));

  const findRecord = (id: string) => trainMap.get(id) || valMap.get(id) || testMap.get(id);

  let blankRows = 0;
  let confirmedUnchanged = 0;
  const appliedCorrections: AppliedCorrection[] = [];

  // 4. Process each row
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const candidateLabel = row.reviewed_label.trim();

    if (!candidateLabel) {
      blankRows++;
      continue;
    }

    if (!isValidForensicLabel(candidateLabel)) {
      throw new Error(
        `Invalid label "${candidateLabel}" for record id "${row.id}" at row ${idx + 2}. Must be one of: ${FORENSIC_LABELS.join(', ')}`
      );
    }

    if (candidateLabel === row.current_label) {
      confirmedUnchanged++;
      continue;
    }

    // A real correction is requested
    const target = findRecord(row.id);
    if (!target) {
      throw new Error(`Record id "${row.id}" from audit CSV was not found in train, val, or test splits.`);
    }

    const previousLabel = target.record.label;
    const newLabel = candidateLabel as ForensicLabel;

    // Apply correction to record in-memory
    target.record.label = newLabel;
    target.record.metadata = target.record.metadata || {};
    target.record.metadata.auditCorrection = {
      appliedAt: new Date().toISOString(),
      previousLabel,
      newLabel,
      confidenceReview: row.confidence_review || undefined,
      reviewerNotes: row.reviewer_notes || undefined,
      auditSourceCsv: path.relative(workspaceRoot, csvPath)
    };

    appliedCorrections.push({
      id: row.id,
      split: target.splitName,
      previousLabel,
      newLabel,
      confidenceReview: row.confidence_review || undefined,
      reviewerNotes: row.reviewer_notes || undefined,
      fromDomain: target.record.fromDomain,
      fromAddress: target.record.from,
      subject: target.record.subject,
      source: target.record.source
    });
  }

  // 5. If not dryRun, persist splits back to disk
  if (!dryRun && appliedCorrections.length > 0) {
    fs.writeFileSync(trainPath, JSON.stringify(trainRecords, null, 2), 'utf-8');
    fs.writeFileSync(valPath, JSON.stringify(valRecords, null, 2), 'utf-8');
    fs.writeFileSync(testPath, JSON.stringify(testRecords, null, 2), 'utf-8');

    // Update reviewed_corrections.json history
    let existingCorrections: any[] = [];
    if (fs.existsSync(reviewedCorrectionsPath)) {
      try {
        existingCorrections = JSON.parse(fs.readFileSync(reviewedCorrectionsPath, 'utf-8'));
      } catch {
        existingCorrections = [];
      }
    }

    const nowIso = new Date().toISOString();
    const newHistoryEntries = appliedCorrections.map(c => ({
      id: `audit_corr_${c.id}_${Date.now()}`,
      record_id: c.id,
      split: c.split,
      subject: c.subject,
      from: c.fromAddress,
      fromDomain: c.fromDomain,
      label: c.newLabel,
      source: `label_audit:${c.source}`,
      analyst_notes: c.reviewerNotes || 'Manual audit correction applied via reports/label_audit.csv',
      confidence_review: c.confidenceReview || 'HIGH',
      original_label: c.previousLabel,
      status: 'approved',
      applied_at: nowIso
    }));

    const combinedCorrections = [...newHistoryEntries, ...existingCorrections];
    fs.writeFileSync(reviewedCorrectionsPath, JSON.stringify(combinedCorrections, null, 2), 'utf-8');
  }

  // 6. Verify adversarial holdout hash AFTER operations
  const holdoutSha256After = computeFileSha256(holdoutPath);
  const holdoutUntouched = holdoutSha256Before === holdoutSha256After;

  if (!holdoutUntouched) {
    throw new Error(
      `CRITICAL VIOLATION: Adversarial holdout dataset was modified! Pre: ${holdoutSha256Before}, Post: ${holdoutSha256After}`
    );
  }

  const result: ApplyCorrectionsResult = {
    applied_at: new Date().toISOString(),
    csv_file_read: path.relative(workspaceRoot, csvPath),
    total_rows_inspected: rows.length,
    blank_reviewed_rows: blankRows,
    confirmed_unchanged_rows: confirmedUnchanged,
    corrections_applied_count: appliedCorrections.length,
    adversarial_holdout_untouched: holdoutUntouched,
    adversarial_holdout_sha256: holdoutSha256After,
    corrections: appliedCorrections,
    updated_split_counts: {
      train: trainRecords.length,
      val: valRecords.length,
      test: testRecords.length
    }
  };

  // Ensure report directory exists and save
  const reportDir = path.dirname(outReportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  fs.writeFileSync(outReportPath, JSON.stringify(result, null, 2), 'utf-8');

  return result;
}

// CLI runner
if (process.argv[1] && process.argv[1].endsWith('apply_label_corrections.ts')) {
  console.log('='.repeat(80));
  console.log('TRACE-X-MAIL APPLY LABEL CORRECTIONS (Item 5)');
  console.log('='.repeat(80));

  try {
    // Parse optional arguments
    const args = process.argv.slice(2);
    let csvArg: string | undefined;
    for (const a of args) {
      if (a.startsWith('--file=')) {
        csvArg = a.replace('--file=', '');
      } else if (!a.startsWith('--')) {
        csvArg = a;
      }
    }

    const res = applyLabelCorrections({ csvPath: csvArg });

    console.log(`\nAudit Results:`);
    console.log(`  - CSV file evaluated:           ${res.csv_file_read}`);
    console.log(`  - Total rows in audit CSV:      ${res.total_rows_inspected}`);
    console.log(`  - Blank/unmodified rows:        ${res.blank_reviewed_rows}`);
    console.log(`  - Confirmed unchanged rows:     ${res.confirmed_unchanged_rows}`);
    console.log(`  - Label corrections applied:    ${res.corrections_applied_count}`);
    console.log(`  - Adversarial holdout intact:   ${res.adversarial_holdout_untouched ? 'YES (SHA-256 verified)' : 'NO'}`);
    console.log(`  - Holdout SHA-256:              ${res.adversarial_holdout_sha256}`);
    console.log(`  - Report saved to:              reports/label_corrections_report.json`);

    if (res.corrections.length > 0) {
      console.log(`\nApplied Corrections List:`);
      for (const corr of res.corrections) {
        console.log(`  [${corr.id}] ${corr.split}: ${corr.previousLabel} -> ${corr.newLabel}`);
        console.log(`     Subject: "${corr.subject}"`);
        if (corr.reviewerNotes) {
          console.log(`     Notes:   "${corr.reviewerNotes}"`);
        }
      }
    } else {
      console.log(`\nNo label modifications specified in ${res.csv_file_read}. Dataset splits remain in original state.`);
    }

    console.log('='.repeat(80));
  } catch (err: any) {
    console.error('\nError applying label corrections:', err.message || err);
    process.exit(1);
  }
}
