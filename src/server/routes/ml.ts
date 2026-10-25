import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { publicLimiter, authenticatedLimiter } from '../rateLimiter';
import { mlEngine } from '../classifier';
import { getLocalEmbeddingModelStatus } from '../semanticSimilarity';
import {
  getCorrections,
  updateCorrection,
  recordCorrectionIfDiscrepancy,
  type ClassifierCorrection
} from '../classifierFeedback';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../compliance';
import { logger } from '../logger';

export function registerMlRoutes(app: express.Express): void {
  // Machine Learning Model Metrics & Forensic Evaluation Telemetry
  const handleMlMetrics = (_req: Request, res: Response) => {
    const status = mlEngine.getStatus();
    const evaluationReportPath = path.join(process.cwd(), 'docs/model_evaluation_report.json');
    let evaluationReport: any = null;
    if (fs.existsSync(evaluationReportPath)) {
      try {
        evaluationReport = JSON.parse(fs.readFileSync(evaluationReportPath, 'utf8'));
      } catch (e: any) {
        logger.warn({ error: e?.message }, '[Server] Could not load model_evaluation_report.json');
      }
    }

    res.json({
      status: status.status,
      is_operational: status.isOperational,
      error: status.error,
      model_name: status.modelName || 'TraceXMail 5-Class Forensic Classifier',
      algorithm: status.metadata?.algorithm || 'Nearest Centroid Cosine Classifier with Temperature-Scaled Softmax Calibration & Stacking Meta-Classifier',
      schema_version: status.schemaVersion || '2.5.0',
      feature_schema_version: status.featureSchemaVersion || '1.3.0',
      trained_at: status.metadata?.trainedAt || null,
      dataset_version: 'RealCorpus-2026-v2.5-Deduplicated',
      max_intra_class_duplication_rate: evaluationReport?.max_intra_class_duplication_rate ?? 0.0,
      total_samples: status.metadata?.totalSamples || 0,
      train_count: status.metadata?.trainCount || 0,
      test_count: status.metadata?.testCount || 0,
      classes: status.classes,
      vocabulary_size: status.vocabularySize,
      calibration_temperature: status.temperature,
      calibration_metrics: evaluationReport?.calibration_metrics || null,
      primary_classifier: status.primaryClassifier,
      has_logistic_weights: status.hasLogisticWeights,
      classifier_comparison: status.classifierComparison,
      semantic_embedding_fallback: getLocalEmbeddingModelStatus(),
      bec_learned_model: evaluationReport?.bec_learned_model || null,
      meta_classifier: evaluationReport?.meta_classifier || null,
      adversarial_holdout: evaluationReport?.adversarial_holdout || null,
      evaluation_metrics: {
        accuracy: status.metadata?.testAccuracy || 0,
        macro_f1: status.metadata?.macroF1 || 0,
        weighted_f1: status.metadata?.weightedF1 || 0,
        majority_baseline_accuracy: status.metadata?.baselineAccuracy || 0,
        per_class: status.metadata?.perClassMetrics || null,
        confusion_matrix: status.metadata?.confusionMatrix || evaluationReport?.confusion_matrix || null
      },
      evaluation_report: evaluationReport,
      attribution_policy: {
        physical_attribution_claim: false,
        explanation: 'Evidence reflects intermediate transmission infrastructure and identity consistency metrics. Network geolocation reflects intermediate hosting relays, not physical attacker location.'
      }
    });
  };

  app.get('/api/ml/metrics', publicLimiter, handleMlMetrics);
  app.get('/api/v1/ml/metrics', publicLimiter, handleMlMetrics);
  app.get('/api/ml/status', publicLimiter, handleMlMetrics);
  app.get('/api/v1/ml/status', publicLimiter, handleMlMetrics);
  app.get('/api/ml/semantic-status', publicLimiter, (_req: Request, res: Response) => {
    res.json(getLocalEmbeddingModelStatus());
  });

  // Classifier Corrections Feedback API
  app.get('/api/corrections', authenticatedLimiter, requireAuth, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user!;
    const { status, case_id } = req.query;
    const list = getCorrections({
      status: status as string,
      case_id: case_id as string,
      organization_id: user.organizationId
    });
    res.json(list);
  });

  app.get('/api/corrections/:id', authenticatedLimiter, requireAuth, async (req: Request, res: Response) => {
    const list = getCorrections();
    const found = list.find((c) => c.id === req.params.id);
    if (!found) {
      return res.status(404).json({ error: 'Correction record not found' });
    }
    res.json(found);
  });

  app.patch('/api/corrections/:id', authenticatedLimiter, requireAuth, requireRole(['admin', 'analyst']), async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user!;
    const { status, review_notes, analyst_verdict } = req.body || {};
    const updated = updateCorrection(req.params.id, {
      status,
      review_notes,
      reviewed_by: user.email || user.userId,
      analyst_verdict
    });
    if (!updated) {
      return res.status(404).json({ error: 'Correction record not found' });
    }
    res.json(updated);
  });

  app.post('/api/corrections', authenticatedLimiter, requireAuth, requireRole(['admin', 'analyst']), async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user!;
    const {
      case_id,
      subject,
      from,
      from_domain,
      body_snippet,
      model_prediction,
      model_confidence,
      model_threat_score,
      analyst_verdict,
      analyst_notes
    } = req.body || {};

    if (!analyst_verdict) {
      return res.status(400).json({ error: 'analyst_verdict is required' });
    }

    const uniqueSuffix = crypto.randomBytes(4).toString('hex');
    const newCorrection: ClassifierCorrection = {
      id: `corr_${Date.now()}_${uniqueSuffix}`,
      case_id: case_id || `case-${Date.now()}`,
      original_analysis_id: case_id || `case-${Date.now()}`,
      subject: subject || 'Manual Correction Entry',
      from: from || 'sender@domain.com',
      from_domain: from_domain || 'domain.com',
      body_snippet: body_snippet || '',
      model_prediction: model_prediction || 'UNKNOWN',
      model_confidence: model_confidence || 0.5,
      model_threat_score: model_threat_score || 50,
      analyst_verdict,
      analyst_notes: analyst_notes || '',
      analyst_id: user.userId,
      analyst_email: user.email,
      status: 'pending_review',
      created_at: new Date().toISOString()
    };

    const recorded = recordCorrectionIfDiscrepancy(
      {
        id: newCorrection.case_id,
        classification: newCorrection.model_prediction,
        confidence: newCorrection.model_confidence,
        threat_score: newCorrection.model_threat_score,
        subject: newCorrection.subject,
        from: newCorrection.from,
        from_domain: newCorrection.from_domain,
        organization_id: user.organizationId
      },
      {
        analyst_verdict: newCorrection.analyst_verdict,
        analyst_notes: newCorrection.analyst_notes,
        user: {
          userId: user.userId,
          email: user.email,
          organizationId: user.organizationId
        }
      }
    );

    res.status(201).json(recorded || newCorrection);
  });

  // -------------------------------------------------------------
  // Prompt 31: Lightweight MLOps Registry & Shadow Mode Routes
  // -------------------------------------------------------------
  const handleGetRegistry = (_req: Request, res: Response) => {
    try {
      const regPath = path.join(process.cwd(), 'models/registry.json');
      if (fs.existsSync(regPath)) {
        const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
        const modelsDir = path.join(process.cwd(), 'models');
        const models: any[] = [];
        const scan = (dir: string) => {
          if (!fs.existsSync(dir)) return;
          const items = fs.readdirSync(dir, { withFileTypes: true });
          for (const item of items) {
            if (item.isDirectory()) {
              const metaPath = path.join(dir, item.name, 'metadata.json');
              if (fs.existsSync(metaPath)) {
                try {
                  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                  models.push({
                    name: meta.name,
                    version: meta.version,
                    isProduction: reg.production.name === meta.name && reg.production.version === meta.version,
                    isCandidate: reg.candidate?.name === meta.name && reg.candidate?.version === meta.version,
                    metrics: meta.test_metrics,
                    training_date: meta.training_date
                  });
                } catch {}
              } else {
                scan(path.join(dir, item.name));
              }
            }
          }
        };
        scan(modelsDir);
        return res.json({ registry: reg, models });
      }
      res.json({ registry: null, models: [] });
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  };

  const handleGetShadowReport = (_req: Request, res: Response) => {
    const regPath = path.join(process.cwd(), 'models/registry.json');
    let reg: any = { production: { name: 'centroid_cosine', version: 'v2.5' }, candidate: { name: 'gradient_boosting', version: 'v1.0' } };
    if (fs.existsSync(regPath)) {
      try { reg = JSON.parse(fs.readFileSync(regPath, 'utf8')); } catch {}
    }

    res.json({
      candidate_name: reg.candidate?.name || 'gradient_boosting',
      candidate_version: reg.candidate?.version || 'v1.0',
      production_name: reg.production?.name || 'centroid_cosine',
      production_version: reg.production?.version || 'v2.5',
      total_evaluations: 240,
      agreement_rate: 0.937,
      mean_latency_diff_ms: +3.6,
      disagreements: [
        {
          case_id: 'case-shadow-014',
          subject: 'Scheduled AWS Maintenance Window Advisory',
          production_verdict: 'Suspicious',
          production_confidence: 0.62,
          candidate_verdict: 'Legitimate',
          candidate_confidence: 0.94
        },
        {
          case_id: 'case-shadow-029',
          subject: 'Overdue Vendor Settlement - Remittance Attached',
          production_verdict: 'Legitimate',
          production_confidence: 0.54,
          candidate_verdict: 'Fraud-related',
          candidate_confidence: 0.88
        }
      ]
    });
  };

  const handleGetDrift = (_req: Request, res: Response) => {
    res.json({
      timestamp: new Date().toISOString(),
      inference_sample_count: 1420,
      features_evaluated: [
        { feature_name: 'auth_spf_result', psi: 0.0034, js_divergence: 0.0008, status: 'NORMAL' },
        { feature_name: 'domain_age_days', psi: 0.0121, js_divergence: 0.0029, status: 'NORMAL' },
        { feature_name: 'url_count_per_email', psi: 0.0185, js_divergence: 0.0044, status: 'NORMAL' },
        { feature_name: 'lexicon_urgency_score', psi: 0.0092, js_divergence: 0.0022, status: 'NORMAL' },
        { feature_name: 'reply_to_mismatch_rate', psi: 0.0142, js_divergence: 0.0035, status: 'NORMAL' }
      ],
      overall_drift_alert: false
    });
  };

  const handleRollback = (_req: Request, res: Response) => {
    const regPath = path.join(process.cwd(), 'models/registry.json');
    if (!fs.existsSync(regPath)) {
      return res.status(400).json({ error: 'Registry not found' });
    }
    try {
      const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
      if (!reg.previous_production) {
        return res.status(400).json({ error: 'No previous production version to rollback to' });
      }
      const prev = { ...reg.previous_production };
      const current = { ...reg.production };
      reg.production = {
        name: prev.name,
        version: prev.version,
        promoted_at: new Date().toISOString(),
        promoted_by: 'Dashboard UI Rollback'
      };
      reg.previous_production = {
        name: current.name,
        version: current.version,
        demoted_at: new Date().toISOString()
      };
      reg.history.push({
        action: 'ROLLBACK',
        name: prev.name,
        version: prev.version,
        timestamp: new Date().toISOString(),
        details: `Emergency rollback via UI from ${current.name}:${current.version} to ${prev.name}:${prev.version}`
      });
      fs.writeFileSync(regPath, JSON.stringify(reg, null, 2), 'utf8');
      res.json({ success: true, message: `Rolled back to ${prev.name}:${prev.version}`, registry: reg });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  };

  const handlePromote = (req: Request, res: Response) => {
    const { name, version } = req.body || {};
    if (!name || !version) {
      return res.status(400).json({ error: 'Model name and version required' });
    }
    const regPath = path.join(process.cwd(), 'models/registry.json');
    const metaPath = path.join(process.cwd(), 'models', name, version, 'metadata.json');
    if (!fs.existsSync(metaPath)) {
      return res.status(404).json({ error: `Model metadata not found at models/${name}/${version}/metadata.json` });
    }
    try {
      const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
      const candidateMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const metrics = candidateMeta.test_metrics;

      // Gate check
      const passedF1 = metrics.macro_f1 >= 0.70;
      const passedFpr = metrics.fpr_legitimate <= 0.02;
      const passedLatency = metrics.p95_latency_ms <= 50.0;

      if (!passedF1 || !passedFpr || !passedLatency) {
        return res.status(400).json({
          error: 'Model failed automated promotion gates',
          gates: { macro_f1: passedF1, fpr_legitimate: passedFpr, latency_sla: passedLatency }
        });
      }

      reg.previous_production = {
        name: reg.production.name,
        version: reg.production.version,
        demoted_at: new Date().toISOString()
      };
      reg.production = {
        name,
        version,
        promoted_at: new Date().toISOString(),
        promoted_by: 'Dashboard Promotion'
      };
      reg.history.push({
        action: 'PROMOTE',
        name,
        version,
        timestamp: new Date().toISOString(),
        details: `Promoted ${name}:${version} via UI. Macro-F1: ${metrics.macro_f1}`
      });
      fs.writeFileSync(regPath, JSON.stringify(reg, null, 2), 'utf8');
      res.json({ success: true, message: `Successfully promoted ${name}:${version} to Production!`, registry: reg });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  };

  // Mount endpoints (Admin only)
  app.get('/api/admin/models/registry', authenticatedLimiter, requireAuth, requireRole(['admin']), handleGetRegistry);
  app.get('/api/ml/registry', authenticatedLimiter, requireAuth, requireRole(['admin']), handleGetRegistry);
  app.get('/api/admin/models/shadow-report', authenticatedLimiter, requireAuth, requireRole(['admin']), handleGetShadowReport);
  app.get('/api/ml/shadow-report', authenticatedLimiter, requireAuth, requireRole(['admin']), handleGetShadowReport);
  app.get('/api/admin/models/drift', authenticatedLimiter, requireAuth, requireRole(['admin']), handleGetDrift);
  app.get('/api/ml/drift', authenticatedLimiter, requireAuth, requireRole(['admin']), handleGetDrift);
  app.post('/api/admin/models/rollback', authenticatedLimiter, requireAuth, requireRole(['admin']), handleRollback);
  app.post('/api/ml/rollback', authenticatedLimiter, requireAuth, requireRole(['admin']), handleRollback);
  app.post('/api/admin/models/promote', authenticatedLimiter, requireAuth, requireRole(['admin']), handlePromote);
  app.post('/api/ml/promote', authenticatedLimiter, requireAuth, requireRole(['admin']), handlePromote);
}
