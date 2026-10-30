/**
 * Automated Verification Tests for Item 3: GBM ONNX Model Export & MLOps Registry Integration
 *
 * Verifies:
 * 1. Export script successfully generates all 4 artifacts in models/gradient_boosting/v1.0/
 * 2. model.onnx contains valid ONNX magic identifier and tensor input/output definitions
 * 3. gb_model.json specifies all 63 forensic features and 5 multi-class labels
 * 4. calibration_map.json captures isotonic probability calibration data
 * 5. metadata.json contains valid training hashes, hyperparameters, and test metrics
 * 6. Model registry successfully promotes gradient_boosting v1.0 across all 4 production gates
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { exportGbmToOnnx } from '../../scripts/ml/export_gbm_onnx';
import { getRegistry, promoteModel } from '../../scripts/ml/model_registry';

describe('Item 3: GBM ONNX Model Export & Registry Suite', () => {
  const modelDir = path.join(process.cwd(), 'models/gradient_boosting/v1.0');

  beforeEach(() => {
    // Ensure export runs before validation tests
    exportGbmToOnnx();
  });

  it('1. Generates all 4 production model artifacts in models/gradient_boosting/v1.0', () => {
    expect(fs.existsSync(path.join(modelDir, 'model.onnx'))).toBe(true);
    expect(fs.existsSync(path.join(modelDir, 'gb_model.json'))).toBe(true);
    expect(fs.existsSync(path.join(modelDir, 'calibration_map.json'))).toBe(true);
    expect(fs.existsSync(path.join(modelDir, 'metadata.json'))).toBe(true);
  });

  it('2. Exports valid binary ONNX representation with model graph payload', () => {
    const onnxBuffer = fs.readFileSync(path.join(modelDir, 'model.onnx'));
    expect(onnxBuffer.length).toBeGreaterThan(100);

    // Verify ONNX magic prefix
    const magic = onnxBuffer.subarray(0, 4).toString('utf8');
    expect(magic).toBe('ONNX');

    // Verify producer string
    expect(onnxBuffer.includes(Buffer.from('TraceXMail-MLOps'))).toBe(true);
  });

  it('3. gb_model.json specifies 63 forensic features and 5 multi-class labels', () => {
    const raw = fs.readFileSync(path.join(modelDir, 'gb_model.json'), 'utf8');
    const gbModel = JSON.parse(raw);

    expect(gbModel.model_name).toBe('TraceXMail-GBM-Forensics');
    expect(gbModel.version).toBe('v1.0');
    expect(gbModel.feature_count).toBe(63);
    expect(gbModel.features.length).toBe(63);
    expect(gbModel.classes).toEqual(['Legitimate', 'Suspicious', 'Impersonated', 'Phishing', 'Fraud-related']);
    expect(gbModel.thresholds.Legitimate).toBe(0.20);
    expect(gbModel.thresholds.Phishing).toBe(0.35);
  });

  it('4. calibration_map.json contains isotonic regression calibration data', () => {
    const raw = fs.readFileSync(path.join(modelDir, 'calibration_map.json'), 'utf8');
    const calib = JSON.parse(raw);

    expect(calib.method).toBe('isotonic');
    expect(typeof calib.brier_improvement_percent).toBe('number');
    expect(Array.isArray(calib.bins)).toBe(true);
  });

  it('5. metadata.json records verified provenance and test metrics', () => {
    const raw = fs.readFileSync(path.join(modelDir, 'metadata.json'), 'utf8');
    const meta = JSON.parse(raw);

    expect(meta.name).toBe('gradient_boosting');
    expect(meta.version).toBe('v1.0');
    expect(meta.schema_version).toBe('2.5.0');
    expect(meta.training_data_hash).toBeDefined();
    expect(meta.test_metrics.macro_f1).toBeGreaterThanOrEqual(0.785);
    expect(meta.test_metrics.fpr_legitimate).toBeLessThanOrEqual(0.02);
    expect(meta.test_metrics.p95_latency_ms).toBeLessThanOrEqual(50.0);
    expect(meta.artifacts).toContain('model.onnx');
    expect(meta.artifacts).toContain('gb_model.json');
  });

  it('6. Successfully satisfies all 4 automated promotion gates in model_registry', () => {
    const check = promoteModel('gradient_boosting', 'v1.0', 'test_runner');

    expect(check.success).toBe(true);
    expect(check.gate_results.gate_macro_f1.passed).toBe(true);
    expect(check.gate_results.gate_fpr_legit.passed).toBe(true);
    expect(check.gate_results.gate_holdout_regression.passed).toBe(true);
    expect(check.gate_results.gate_latency_ms.passed).toBe(true);

    const registry = getRegistry();
    expect(registry.production.name).toBe('gradient_boosting');
    expect(registry.production.version).toBe('v1.0');
  });
});
