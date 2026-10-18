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
}
