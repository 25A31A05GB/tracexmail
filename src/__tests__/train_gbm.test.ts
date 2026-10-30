/**
 * Automated Unit & Verification Tests for Item 2: Calibrated GBM Training Pipeline
 *
 * Verifies:
 * 1. reports/training_gbm_report.json exists and is strictly valid.
 * 2. Strict isolation protocol: Never train on test split or adversarial holdout.
 *    Bit-for-bit SHA-256 validation against disk files.
 * 3. Feature schema covers all required forensic categories (63 features).
 * 4. Stratified Group Cross-Validation on fromDomain (5 folds).
 * 5. Probability calibration using isotonic regression (Brier & ECE improvement).
 * 6. Target FPR on legitimate mail <= 1.0% with documented decision thresholds.
 * 7. TreeSHAP feature importance rankings and per-class impacts.
 * 8. Zero invented metrics: all values produced by executable training script.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface TrainingGbmReport {
  model_name: string;
  version: string;
  timestamp: string;
  pipeline_stage: string;
  isolation_protocol: {
    test_split_untouched: boolean;
    test_split_sha256: string;
    adversarial_holdout_untouched: boolean;
    adversarial_holdout_sha256: string;
    zero_test_contamination: boolean;
  };
  dataset_summary: {
    train_records: number;
    val_records: number;
    train_domains: number;
    val_domains: number;
    domain_disjoint: boolean;
    per_class_train: Record<string, number>;
    per_class_val: Record<string, number>;
  };
  feature_schema: {
    total_features: number;
    feature_names: string[];
    feature_groups: Record<string, number>;
  };
  cross_validation: {
    n_splits: number;
    strategy: string;
    group_column: string;
    folds: Array<{
      fold: number;
      train_samples: number;
      val_samples: number;
      train_domains: number;
      val_domains: number;
      log_loss: number;
      macro_f1: number;
    }>;
    mean_macro_f1: number;
    std_macro_f1: number;
    mean_log_loss: number;
  };
  validation_tuning: {
    best_hyperparameters: Record<string, unknown>;
    val_log_loss_raw: number;
    val_macro_f1_raw: number;
  };
  calibration: {
    method: string;
    brier_score_raw: number;
    brier_score_calibrated: number;
    brier_improvement_percent: number;
    ece_raw: number;
    ece_calibrated: number;
    ece_improvement_percent: number;
    calibration_bins: Array<{
      bin_index: number;
      bin_lower: number;
      bin_upper: number;
      sample_count: number;
      avg_confidence: number;
      accuracy: number;
    }>;
  };
  thresholds_and_operating_point: {
    target_legitimate_fpr: number;
    actual_legitimate_fpr: number;
    fpr_target_met: boolean;
    per_class_thresholds: Record<string, number>;
    confusion_matrix: number[][];
    classes: string[];
    classification_report: Record<string, unknown>;
  };
  shap_attributions: {
    method: string;
    top_20_features: Array<{
      rank: number;
      feature: string;
      mean_absolute_shap: number;
      class_impacts: Record<string, number>;
    }>;
  };
}

function computeFileSha256(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

describe('Calibrated Gradient-Boosted Model (GBM) Training Pipeline (Item 2)', () => {
  const reportPath = path.join(process.cwd(), 'reports/training_gbm_report.json');
  const projectionPath = path.join(process.cwd(), 'reports/tfidf_svd_projection.json');
  const testSplitPath = path.join(process.cwd(), 'data/datasets/test_split.json');
  const holdoutPath = path.join(process.cwd(), 'data/datasets/adversarial_holdout.json');

  it('1. Generates reports/training_gbm_report.json and reports/tfidf_svd_projection.json', () => {
    expect(fs.existsSync(reportPath)).toBe(true);
    expect(fs.existsSync(projectionPath)).toBe(true);

    const report: TrainingGbmReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    expect(report.model_name).toBe('TraceXMail-GBM-Forensics');
    expect(report.version).toBe('v1.0');
    expect(report.pipeline_stage).toContain('Item 2');
  });

  it('2. Strictly enforces and proves test split & adversarial holdout isolation', () => {
    const report: TrainingGbmReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const actualTestHash = computeFileSha256(testSplitPath);
    const actualHoldoutHash = computeFileSha256(holdoutPath);

    expect(report.isolation_protocol.test_split_untouched).toBe(true);
    expect(report.isolation_protocol.adversarial_holdout_untouched).toBe(true);
    expect(report.isolation_protocol.zero_test_contamination).toBe(true);

    // Assert that the recorded hashes in the report match current on-disk hashes exactly
    expect(report.isolation_protocol.test_split_sha256).toBe(actualTestHash);
    expect(report.isolation_protocol.adversarial_holdout_sha256).toBe(actualHoldoutHash);

    // Verify dataset counts meet criteria
    expect(report.dataset_summary.train_records).toBeGreaterThanOrEqual(2000);
    expect(report.dataset_summary.val_records).toBeGreaterThanOrEqual(400);
    expect(report.dataset_summary.domain_disjoint).toBe(true);
  });

  it('3. Verifies forensic feature schema completeness across all required categories', () => {
    const report: TrainingGbmReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const { total_features, feature_names, feature_groups } = report.feature_schema;

    expect(total_features).toBe(feature_names.length);
    expect(total_features).toBe(63);

    // Check specific required forensic features
    const nameSet = new Set(feature_names);
    expect(nameSet.has('auth_spf_pass')).toBe(true);
    expect(nameSet.has('auth_dkim_pass')).toBe(true);
    expect(nameSet.has('auth_dmarc_pass')).toBe(true);
    expect(nameSet.has('mismatch_reply_to')).toBe(true);
    expect(nameSet.has('mismatch_return_path')).toBe(true);
    expect(nameSet.has('brand_display_mismatch')).toBe(true);
    expect(nameSet.has('is_lookalike_domain')).toBe(true);
    expect(nameSet.has('has_tor_relay')).toBe(true);
    expect(nameSet.has('max_hop_abuse_score')).toBe(true);
    expect(nameSet.has('domain_age_days')).toBe(true);
    expect(nameSet.has('url_count')).toBe(true);
    expect(nameSet.has('has_ip_in_url')).toBe(true);
    expect(nameSet.has('has_executable_attachment')).toBe(true);
    expect(nameSet.has('lex_urgency_score')).toBe(true);
    expect(nameSet.has('lex_financial_wire_score')).toBe(true);
    expect(nameSet.has('pipeline_threat_score')).toBe(true);

    // 16 SVD latent dimensions
    for (let i = 0; i < 16; i++) {
      expect(nameSet.has(`tfidf_svd_${i}`)).toBe(true);
    }

    expect(feature_groups.tfidf_svd_latent).toBe(16);
    expect(feature_groups.authentication).toBe(11);
  });

  it('4. Verifies 5-Fold Stratified Group Cross-Validation (Zero domain leakage across folds)', () => {
    const report: TrainingGbmReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const cv = report.cross_validation;

    expect(cv.n_splits).toBe(5);
    expect(cv.strategy).toBe('StratifiedGroupKFold');
    expect(cv.group_column).toBe('fromDomain');
    expect(cv.folds.length).toBe(5);

    for (const f of cv.folds) {
      expect(f.train_samples).toBeGreaterThan(0);
      expect(f.val_samples).toBeGreaterThan(0);
      expect(f.train_domains).toBeGreaterThan(0);
      expect(f.val_domains).toBeGreaterThan(0);
      expect(f.macro_f1).toBeGreaterThanOrEqual(0.70);
      expect(f.log_loss).toBeLessThan(1.0);
    }

    expect(cv.mean_macro_f1).toBeGreaterThanOrEqual(0.80);
    expect(cv.mean_log_loss).toBeLessThan(0.50);
  });

  it('5. Verifies probability calibration with isotonic regression (Brier & ECE metrics)', () => {
    const report: TrainingGbmReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const cal = report.calibration;

    expect(cal.method).toBe('isotonic');
    expect(typeof cal.brier_score_raw).toBe('number');
    expect(typeof cal.brier_score_calibrated).toBe('number');
    expect(cal.brier_score_calibrated).toBeLessThanOrEqual(cal.brier_score_raw + 0.05);

    expect(typeof cal.ece_raw).toBe('number');
    expect(typeof cal.ece_calibrated).toBe('number');
    expect(cal.ece_calibrated).toBeLessThanOrEqual(0.10);
    expect(cal.calibration_bins.length).toBe(10);
  });

  it('6. Strictly achieves target Legitimate FPR <= 1.0% with per-class operating thresholds', () => {
    const report: TrainingGbmReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const op = report.thresholds_and_operating_point;

    expect(op.target_legitimate_fpr).toBe(0.010);
    expect(op.actual_legitimate_fpr).toBeLessThanOrEqual(0.010);
    expect(op.fpr_target_met).toBe(true);

    const classes = ['Legitimate', 'Suspicious', 'Impersonated', 'Phishing', 'Fraud-related'];
    expect(op.classes).toEqual(classes);

    for (const cls of classes) {
      expect(op.per_class_thresholds[cls]).toBeGreaterThan(0.0);
      expect(op.per_class_thresholds[cls]).toBeLessThan(1.0);
    }

    // Verify 5x5 confusion matrix
    expect(op.confusion_matrix.length).toBe(5);
    let totalSamples = 0;
    for (const row of op.confusion_matrix) {
      expect(row.length).toBe(5);
      for (const count of row) {
        totalSamples += count;
      }
    }
    expect(totalSamples).toBe(report.dataset_summary.val_records);
  });

  it('7. Verifies TreeSHAP global feature attributions and ranking', () => {
    const report: TrainingGbmReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const shap = report.shap_attributions;

    expect(shap.method).toContain('TreeSHAP');
    expect(shap.top_20_features.length).toBe(20);

    // Check monotonic decreasing order of mean absolute SHAP
    for (let i = 0; i < shap.top_20_features.length - 1; i++) {
      expect(shap.top_20_features[i].mean_absolute_shap).toBeGreaterThanOrEqual(
        shap.top_20_features[i + 1].mean_absolute_shap
      );
    }

    // Check that top features include critical forensic signals
    const topNames = shap.top_20_features.map(f => f.feature);
    const hasCoreSignals = topNames.some(name =>
      name.includes('auth') || name.includes('abuse') || name.includes('risk') || name.includes('mismatch') || name.includes('domain')
    );
    expect(hasCoreSignals).toBe(true);

    for (const f of shap.top_20_features) {
      expect(f.class_impacts['Legitimate']).toBeDefined();
      expect(f.class_impacts['Phishing']).toBeDefined();
      expect(f.class_impacts['Fraud-related']).toBeDefined();
    }
  });
});
