import fs from 'fs';
import path from 'path';

export type CorrectionStatus = 'pending_review' | 'approved' | 'rejected';

export interface ClassifierCorrection {
  id: string;
  case_id: string;
  original_analysis_id?: string;
  subject: string;
  from: string;
  from_domain: string;
  body_snippet: string;
  model_prediction: string;
  model_confidence: number;
  model_threat_score: number;
  analyst_verdict: string;
  analyst_notes: string;
  analyst_id: string;
  analyst_email: string;
  organization_id?: string;
  status: CorrectionStatus;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  review_notes?: string;
}

const CORRECTIONS_FILE_PATH = path.join(process.cwd(), 'data/datasets/classifier_corrections.json');

// In-memory cache synced with disk
let cachedCorrections: ClassifierCorrection[] | null = null;

export function normalizeVerdictLabel(rawLabel: string | undefined | null): string {
  if (!rawLabel) return 'Suspicious';
  const clean = String(rawLabel).trim().toLowerCase();
  if (clean.includes('phish') || clean.includes('credential')) return 'Phishing';
  if (clean.includes('fraud') || clean.includes('bec') || clean.includes('wire') || clean.includes('invoice')) return 'Fraud-related';
  if (clean.includes('impersonat') || clean.includes('spoof') || clean.includes('brand')) return 'Impersonated';
  if (clean.includes('legit') || clean.includes('benign') || clean.includes('clean') || clean.includes('safe')) return 'Legitimate';
  if (clean.includes('suspicious') || clean.includes('warn') || clean.includes('uncertain')) return 'Suspicious';
  return rawLabel;
}

export function loadCorrections(): ClassifierCorrection[] {
  if (cachedCorrections !== null) {
    return cachedCorrections;
  }
  try {
    if (fs.existsSync(CORRECTIONS_FILE_PATH)) {
      const data = fs.readFileSync(CORRECTIONS_FILE_PATH, 'utf8');
      cachedCorrections = JSON.parse(data);
      return cachedCorrections || [];
    }
  } catch (err) {
    console.warn('[Classifier Feedback] Failed to load corrections from disk:', err);
  }
  cachedCorrections = [];
  return cachedCorrections;
}

import crypto from 'crypto';
import { getSupabaseAdminClient, DEFAULT_ORG_ID } from './supabase';

export function saveCorrections(corrections: ClassifierCorrection[]): void {
  cachedCorrections = corrections;
  try {
    const dir = path.dirname(CORRECTIONS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CORRECTIONS_FILE_PATH, JSON.stringify(corrections, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Classifier Feedback] Local file cache notice:', err);
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase || corrections.length === 0) return;

  const rows = corrections.map((c) => ({
    id: c.id,
    case_id: c.case_id,
    original_analysis_id: c.original_analysis_id || c.case_id,
    organization_id: c.organization_id || DEFAULT_ORG_ID,
    subject: c.subject,
    from_address: c.from,
    from_domain: c.from_domain,
    body_snippet: c.body_snippet,
    model_prediction: c.model_prediction,
    model_confidence: c.model_confidence,
    model_threat_score: c.model_threat_score,
    analyst_verdict: c.analyst_verdict,
    analyst_notes: c.analyst_notes,
    analyst_id: c.analyst_id,
    analyst_email: c.analyst_email,
    status: c.status,
    created_at: c.created_at,
    reviewed_at: c.reviewed_at || null,
    reviewed_by: c.reviewed_by || null,
    review_notes: c.review_notes || null
  }));

  Promise.resolve(
    supabase
      .from('classifier_corrections')
      .upsert(rows, { onConflict: 'id' })
  )
    .then(({ error }: any) => {
      if (error) console.warn('[Classifier Feedback] Supabase upsert notice:', error.message);
    })
    .catch((err: any) => console.warn('[Classifier Feedback] Supabase exception:', err?.message));
}

export function recordCorrectionIfDiscrepancy(
  caseItem: any,
  payload: {
    analyst_verdict?: string;
    analyst_notes?: string;
    user: {
      userId: string;
      email: string;
      organizationId?: string;
    };
  }
): ClassifierCorrection | null {
  if (!payload.analyst_verdict && !caseItem.analyst_verdict) {
    return null;
  }

  const rawAnalyst = payload.analyst_verdict || caseItem.analyst_verdict;
  const analystNorm = normalizeVerdictLabel(rawAnalyst);

  const rawModel = caseItem.model_prediction || caseItem.threat_verdict || caseItem.category || (caseItem.threat_score >= 80 ? 'Phishing' : caseItem.threat_score <= 30 ? 'Legitimate' : 'Suspicious');
  const modelNorm = normalizeVerdictLabel(rawModel);

  // Check if there is a true discrepancy between model and human analyst
  const isDiscrepancy = analystNorm.toLowerCase() !== modelNorm.toLowerCase();

  // Always log discrepancy; if identical, return null unless explicitly requested
  if (!isDiscrepancy) {
    return null;
  }

  const existingCorrections = loadCorrections();
  const duplicate = existingCorrections.find(c => c.case_id === caseItem.id && c.analyst_verdict === analystNorm);
  if (duplicate) {
    return duplicate;
  }

  const correction: ClassifierCorrection = {
    id: `corr_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}`,
    case_id: caseItem.id,
    original_analysis_id: caseItem.id,
    subject: caseItem.title || caseItem.subject || 'Investigated Case',
    from: caseItem.from || caseItem.sender || (caseItem.from_domain ? `sender@${caseItem.from_domain}` : 'sender@unknown.net'),
    from_domain: caseItem.from_domain || 'unknown.net',
    body_snippet: (caseItem.description || caseItem.analyst_notes || caseItem.notes || '').substring(0, 500),
    model_prediction: modelNorm,
    model_confidence: caseItem.ml_confidence || (caseItem.threat_score ? caseItem.threat_score / 100 : 0.85),
    model_threat_score: caseItem.threat_score || 75,
    analyst_verdict: analystNorm,
    analyst_notes: payload.analyst_notes || caseItem.analyst_notes || caseItem.description || 'Discrepancy identified during forensic triage closure',
    analyst_id: payload.user.userId,
    analyst_email: payload.user.email,
    organization_id: payload.user.organizationId || caseItem.organization_id || 'org_acme_soc_01',
    status: 'pending_review',
    created_at: new Date().toISOString()
  };

  existingCorrections.unshift(correction);
  saveCorrections(existingCorrections);

  console.log(`[Classifier Feedback] Logged discrepancy correction: ${correction.id} (Model: ${modelNorm} -> Analyst: ${analystNorm})`);
  return correction;
}

export function getCorrections(filter?: { status?: string; case_id?: string; organization_id?: string }): ClassifierCorrection[] {
  let list = loadCorrections();
  if (filter?.status && filter.status !== 'ALL') {
    list = list.filter(c => c.status === filter.status);
  }
  if (filter?.case_id) {
    list = list.filter(c => c.case_id === filter.case_id);
  }
  if (filter?.organization_id) {
    list = list.filter(c => c.organization_id === filter.organization_id);
  }
  return list;
}

export function updateCorrection(
  id: string,
  updates: {
    status?: CorrectionStatus;
    review_notes?: string;
    reviewed_by?: string;
    analyst_verdict?: string;
  }
): ClassifierCorrection | null {
  const list = loadCorrections();
  const idx = list.findIndex(c => c.id === id);
  if (idx === -1) return null;

  const current = list[idx];
  const updated: ClassifierCorrection = {
    ...current,
    ...updates,
    ...(updates.status && updates.status !== current.status ? { reviewed_at: new Date().toISOString() } : {})
  };
  list[idx] = updated;
  saveCorrections(list);
  return updated;
}
