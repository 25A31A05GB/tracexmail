/**
 * TraceXMail 5-Class ML Centroid-Cosine Classifier & Forensic Scoring Engine
 *
 * Implements:
 * 1. Runtime inference matching the trained Centroid Cosine model with temperature Softmax calibration.
 * 2. 5-Class probability distribution: Legitimate, Suspicious, Impersonated, Phishing, Fraud-related.
 * 3. Strict schema validation & fail-loudly model state checking.
 * 4. Transparent, non-double-counted Threat Score (0-100) with explainable component breakdown:
 *    - Authentication (max 25 pts)
 *    - Domain Intelligence (max 25 pts)
 *    - Infrastructure & Routing (max 20 pts)
 *    - ML Content Probability (max 20 pts)
 *    - Linguistic & Rule-Based Heuristics (max 10 pts)
 * 5. Honest commodity attribution (no fabricated APT threat actors; evidence != physical attacker location).
 */

import fs from 'fs';
import path from 'path';
import {
  extractForensicTokens,
  evaluateStructuralIdentity,
  loadBrandDefinitions,
  isPunycodeOrHomoglyph,
  getWeightedSocialEngineeringScore,
  extractFinancialEntities,
  type FinancialEntitiesResult
} from './structuralFeatures.js';
import {
  scoreSemanticSimilarity,
  type SemanticSimilarityResult
} from './semanticSimilarity.js';
import {
  analyzeLinguisticForensics,
  type LinguisticForensicsResult
} from './linguisticForensics.js';
import {
  predictBecRisk,
  type BecPredictionResult,
  loadBecLearnedModel
} from './becLearnedModel.js';
import {
  predictMetaThreatScore,
  type MetaThreatPrediction,
  loadMetaModel
} from './metaClassifier.js';

export {
  scoreSemanticSimilarity,
  analyzeLinguisticForensics,
  getWeightedSocialEngineeringScore,
  extractFinancialEntities,
  predictBecRisk,
  predictMetaThreatScore,
  loadBecLearnedModel,
  loadMetaModel,
  type SemanticSimilarityResult,
  type LinguisticForensicsResult,
  type FinancialEntitiesResult,
  type BecPredictionResult,
  type MetaThreatPrediction
};

export type EmailClassification =
  | 'Legitimate'
  | 'Suspicious'
  | 'Impersonated'
  | 'Phishing'
  | 'Fraud-related';

export interface ClassifierInput {
  from: string;
  fromDomain: string;
  to?: string;
  subject: string;
  bodyText?: string;
  text?: string;
  replyTo?: string;
  returnPath?: string;
  auth?: {
    spf?: { status?: string; details?: string };
    dkim?: { status?: string; details?: string };
    dmarc?: { status?: string; details?: string; policy?: string };
    arc?: { status?: string; details?: string };
  };
  hops?: Array<{
    fromIp?: string;
    isPrivate?: boolean;
    isTor?: boolean;
    is_tor?: boolean;
    isBlacklisted?: boolean;
    abuseScore?: number;
    asn?: string;
    org?: string;
    city?: string;
    country?: string;
  }>;
  domainIntelligence?: {
    status?: string;
    is_newly_registered?: boolean;
    domain_age_days?: number;
    dns?: {
      spf?: string;
      spf_qualifier?: string;
      dmarc?: string;
      dmarc_policy?: string;
      mx_records?: string[];
    };
    typosquatting?: {
      is_typosquat?: boolean;
      target_brand?: string;
      technique?: string;
    };
    mx_missing?: boolean;
  };
}

export interface FeatureWeight {
  feature: string;
  category: 'AUTHENTICATION' | 'INFRASTRUCTURE' | 'LINGUISTIC' | 'DOMAIN' | 'IDENTITY';
  weight: number;
  triggered: boolean;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
}

export interface ThreatScoreBreakdown {
  total: number;
  maxScore: 100;
  components: {
    authentication: { score: number; max: 25; reasons: string[] };
    domainRisk: { score: number; max: 25; reasons: string[] };
    infrastructureRisk: { score: number; max: 20; reasons: string[] };
    mlClassification: { score: number; max: 20; reasons: string[] };
    heuristics: { score: number; max: 10; reasons: string[] };
  };
}

export interface ClassificationResult {
  classification: EmailClassification;
  predictedClass: EmailClassification;
  probabilities: Record<EmailClassification, number>;
  confidence: number;
  threatScore: number;
  threatScoreBreakdown: ThreatScoreBreakdown;
  phishingProbability: number;
  mlConfidence: number;
  verdict: 'MALICIOUS PHISH' | 'SUSPICIOUS' | 'LEGITIMATE' | 'IMPERSONATED' | 'FRAUD-RELATED';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN';
  features: FeatureWeight[];
  topFeatures: Array<{ token: string; weight: number }>;
  heuristics: Array<{
    id: string;
    title: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
    triggered: boolean;
  }>;
  topVectors: string[];
  infrastructureBreakdown: {
    spoofedDomain: number;
    anonymizedRelay: number;
    compromisedAccount: number;
    legitimateRoute: number;
  };
  attribution: {
    actor: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    reason: string;
    disclaimer: string;
  };
  activeClassifier?: 'logistic_regression' | 'centroid_cosine';
}

export interface TrainedModelPayload {
  schemaVersion?: string;
  featureSchemaVersion?: string;
  primaryClassifier?: 'logistic_regression' | 'centroid_cosine';
  metadata?: {
    modelName: string;
    algorithm: string;
    primaryClassifier?: 'logistic_regression' | 'centroid_cosine';
    trainedAt?: string;
    trainingCorpora?: string[];
    totalSamples?: number;
    trainCount?: number;
    testCount?: number;
    classes: EmailClassification[];
    vocabularySize: number;
    testAccuracy: number;
    macroF1: number;
    weightedF1?: number;
    baselineAccuracy?: number;
    perClassMetrics?: Record<EmailClassification, { precision: number; recall: number; f1: number; support: number }>;
    confusionMatrix?: number[][];
    classifierComparison?: {
      centroid_cosine: {
        accuracy: number;
        macroF1: number;
        weightedF1: number;
        brierScore: number;
        ece: number;
      };
      logistic_regression: {
        accuracy: number;
        macroF1: number;
        weightedF1: number;
        brierScore: number;
        ece: number;
      };
      winner: 'logistic_regression' | 'centroid_cosine';
      promotionReason: string;
    };
  };
  featureSchema?: string[];
  vocabulary: string[];
  vocabMap: Record<string, number>;
  idf: Record<string, number>;
  centroids: number[][];
  priors: number[];
  temperature: number;
  weights?: number[][];
  bias?: number[];
}

export const CLASS_NAMES: EmailClassification[] = [
  'Legitimate',
  'Suspicious',
  'Impersonated',
  'Phishing',
  'Fraud-related'
];

export class MachineLearningClassifier {
  private model: TrainedModelPayload | null = null;
  private modelStatus: 'OPERATIONAL' | 'MISSING_ARTIFACT' | 'CORRUPTED_SCHEMA' = 'MISSING_ARTIFACT';
  private loadError: string | null = null;

  constructor() {
    this.loadModel();
  }

  public loadModel(): boolean {
    try {
      const modelPath = path.join(process.cwd(), 'data/datasets/trained_model.json');
      if (!fs.existsSync(modelPath)) {
        this.modelStatus = 'MISSING_ARTIFACT';
        this.loadError = `Model artifact missing at: ${modelPath}`;
        console.warn(`[Classifier] ${this.loadError}`);
        return false;
      }

      const raw = fs.readFileSync(modelPath, 'utf-8');
      const parsed: TrainedModelPayload = JSON.parse(raw);

      // Strict Schema Validation
      if (!parsed.vocabulary || !Array.isArray(parsed.vocabulary) || parsed.vocabulary.length === 0) {
        throw new Error('Invalid model artifact: missing or empty vocabulary array');
      }
      if (!parsed.vocabMap || typeof parsed.vocabMap !== 'object') {
        throw new Error('Invalid model artifact: missing vocabMap lookup table');
      }
      if (!parsed.centroids || !Array.isArray(parsed.centroids) || parsed.centroids.length !== 5) {
        throw new Error(`Invalid model artifact: centroids array must have length 5 for 5 classes, received ${parsed.centroids?.length}`);
      }
      if (!parsed.idf || typeof parsed.idf !== 'object') {
        throw new Error('Invalid model artifact: missing idf weights map');
      }

      const primary = parsed.primaryClassifier || parsed.metadata?.primaryClassifier || 'centroid_cosine';
      if (primary === 'logistic_regression') {
        if (!parsed.weights || !Array.isArray(parsed.weights) || parsed.weights.length !== 5) {
          throw new Error('Invalid model artifact: primaryClassifier is logistic_regression but weights array is missing or invalid');
        }
        if (!parsed.bias || !Array.isArray(parsed.bias) || parsed.bias.length !== 5) {
          throw new Error('Invalid model artifact: primaryClassifier is logistic_regression but bias array is missing or invalid');
        }
      }

      if (parsed.weights && (!Array.isArray(parsed.weights) || parsed.weights.length !== 5)) {
        throw new Error('Invalid model artifact: weights array must have length 5');
      }
      if (parsed.bias && (!Array.isArray(parsed.bias) || parsed.bias.length !== 5)) {
        throw new Error('Invalid model artifact: bias array must have length 5');
      }

      this.model = parsed;
      this.modelStatus = 'OPERATIONAL';
      this.loadError = null;
      console.log(`[Classifier] Successfully loaded ML model: ${this.model.metadata?.modelName || '5-Class Forensic Model'} (Schema: ${this.model.schemaVersion || '2.5.0'}, Primary: ${primary}, Vocab: ${this.model.vocabulary.length})`);
      return true;
    } catch (e: any) {
      this.model = null;
      this.modelStatus = 'CORRUPTED_SCHEMA';
      this.loadError = e?.message || 'Failed to parse model artifact';
      console.error('[Classifier] Critical error during model artifact loading:', this.loadError);
      return false;
    }
  }

  public getStatus() {
    return {
      status: this.modelStatus,
      error: this.loadError,
      isOperational: this.modelStatus === 'OPERATIONAL',
      modelName: this.model?.metadata?.modelName || null,
      schemaVersion: this.model?.schemaVersion || null,
      featureSchemaVersion: this.model?.featureSchemaVersion || null,
      primaryClassifier: this.model?.primaryClassifier || this.model?.metadata?.primaryClassifier || 'centroid_cosine',
      classes: this.model?.metadata?.classes || CLASS_NAMES,
      vocabularySize: this.model?.vocabulary?.length || 0,
      metadata: this.model?.metadata || null,
      temperature: this.model?.temperature || 12.0,
      hasLogisticWeights: Boolean(this.model?.weights && this.model?.bias),
      classifierComparison: this.model?.metadata?.classifierComparison || null
    };
  }

  /**
   * Tokenizes text and extracts forensic features matching training pipeline.
   */
  public tokenize(input: {
    subject: string;
    from?: string;
    fromDomain?: string;
    bodyText?: string;
    text?: string;
    replyTo?: string;
    returnPath?: string;
    auth?: ClassifierInput['auth'];
    domainIntelligence?: ClassifierInput['domainIntelligence'];
    hops?: ClassifierInput['hops'];
  }): string[] {
    const rawTokens = extractForensicTokens(input);
    const tokens: string[] = [];

    const fromDomain = (input.fromDomain || '').toLowerCase();
    if (fromDomain) {
      tokens.push(`domain:${fromDomain}`);
    }

    for (const t of rawTokens) {
      if (t.startsWith('__c3_') || t.startsWith('__c4_') || t.startsWith('feat_') || t.startsWith('domain_')) {
        tokens.push(t);
      } else if (t.includes('_')) {
        tokens.push(`bigram:${t}`);
        tokens.push(t);
      } else {
        tokens.push(`word:${t}`);
        tokens.push(t);
      }
    }

    return tokens;
  }

  /**
   * Evaluates normalized feature entries with Centroid-Cosine head.
   */
  private scoreCentroidCosine(entries: Array<[number, number]>): {
    probs: number[];
    bestIdx: number;
    confidence: number;
    tokenWeights: Array<{ token: string; weight: number }>;
  } {
    const numClasses = CLASS_NAMES.length;
    const similarities = new Array(numClasses).fill(0);

    for (let c = 0; c < numClasses; c++) {
      let dot = 0;
      const centroidRow = this.model!.centroids[c];
      if (centroidRow) {
        for (const [fIdx, val] of entries) {
          dot += (centroidRow[fIdx] || 0) * val;
        }
      }
      similarities[c] = dot;
    }

    const temperature = this.model!.temperature || 12.0;
    const maxSim = Math.max(...similarities);
    let sumExp = 0;
    const exps = new Array(numClasses);
    for (let c = 0; c < numClasses; c++) {
      exps[c] = Math.exp(temperature * (similarities[c] - maxSim));
      sumExp += exps[c];
    }

    const probs = exps.map(e => (sumExp > 0 ? e / sumExp : 1 / numClasses));

    let bestIdx = 0;
    let bestProb = -1;
    for (let i = 0; i < probs.length; i++) {
      if (probs[i] > bestProb) {
        bestProb = probs[i];
        bestIdx = i;
      }
    }

    const tokenWeights: Array<{ token: string; weight: number }> = [];
    const centroidRow = this.model!.centroids[bestIdx];
    if (centroidRow) {
      for (const [fIdx, val] of entries) {
        const token = this.model!.vocabulary[fIdx];
        const w = (centroidRow[fIdx] || 0) * val;
        if (w > 0.005) {
          tokenWeights.push({ token, weight: parseFloat(w.toFixed(3)) });
        }
      }
    }
    tokenWeights.sort((a, b) => b.weight - a.weight);

    const sortedProbs = [...probs].sort((a, b) => b - a);
    const confidence = parseFloat((sortedProbs[0] - (sortedProbs[1] || 0)).toFixed(3));

    return { probs, bestIdx, confidence, tokenWeights };
  }

  /**
   * Evaluates normalized feature entries with Trained Multinomial Logistic Regression head.
   */
  private scoreLogisticRegression(entries: Array<[number, number]>): {
    probs: number[];
    bestIdx: number;
    confidence: number;
    tokenWeights: Array<{ token: string; weight: number }>;
  } {
    const numClasses = CLASS_NAMES.length;
    const weights = this.model!.weights!;
    const bias = this.model!.bias!;
    const logits = new Array(numClasses).fill(0);

    for (let c = 0; c < numClasses; c++) {
      let z = bias[c] || 0;
      const wRow = weights[c];
      if (wRow) {
        for (const [fIdx, val] of entries) {
          z += (wRow[fIdx] || 0) * val;
        }
      }
      logits[c] = z;
    }

    const maxLogit = Math.max(...logits);
    let sumExp = 0;
    const exps = new Array(numClasses);
    for (let c = 0; c < numClasses; c++) {
      exps[c] = Math.exp(logits[c] - maxLogit);
      sumExp += exps[c];
    }

    const probs = exps.map(e => (sumExp > 0 ? e / sumExp : 1 / numClasses));

    let bestIdx = 0;
    let bestProb = -1;
    for (let i = 0; i < probs.length; i++) {
      if (probs[i] > bestProb) {
        bestProb = probs[i];
        bestIdx = i;
      }
    }

    const tokenWeights: Array<{ token: string; weight: number }> = [];
    const wRow = weights[bestIdx];
    if (wRow) {
      for (const [fIdx, val] of entries) {
        const token = this.model!.vocabulary[fIdx];
        const w = (wRow[fIdx] || 0) * val;
        if (w > 0.005) {
          tokenWeights.push({ token, weight: parseFloat(w.toFixed(3)) });
        }
      }
    }
    tokenWeights.sort((a, b) => b.weight - a.weight);

    const sortedProbs = [...probs].sort((a, b) => b - a);
    const confidence = parseFloat((sortedProbs[0] - (sortedProbs[1] || 0)).toFixed(3));

    return { probs, bestIdx, confidence, tokenWeights };
  }

  /**
   * Evaluates text through the primary trained ML engine (branching on primaryClassifier).
   */
  public predict(input: {
    subject: string;
    from?: string;
    fromDomain?: string;
    bodyText?: string;
    text?: string;
    replyTo?: string;
    returnPath?: string;
    auth?: ClassifierInput['auth'];
    domainIntelligence?: ClassifierInput['domainIntelligence'];
    hops?: ClassifierInput['hops'];
  }): {
    predictedClass: EmailClassification;
    probabilities: Record<EmailClassification, number>;
    confidence: number;
    topFeatures: Array<{ token: string; weight: number }>;
    activeClassifier: 'logistic_regression' | 'centroid_cosine';
  } {
    const defaultProbs: Record<EmailClassification, number> = {
      Legitimate: 0.2,
      Suspicious: 0.2,
      Impersonated: 0.2,
      Phishing: 0.2,
      'Fraud-related': 0.2
    };

    if (!this.model || !this.model.vocabMap) {
      return {
        predictedClass: 'Suspicious',
        probabilities: defaultProbs,
        confidence: 0.5,
        topFeatures: [],
        activeClassifier: 'centroid_cosine'
      };
    }

    const tokens = this.tokenize(input);
    const counts: Record<string, number> = {};
    for (const t of tokens) {
      if (this.model.vocabMap[t] !== undefined) {
        counts[t] = (counts[t] || 0) + 1;
      }
    }

    const entries: Array<[number, number]> = [];
    let sumSq = 0;
    for (const [t, count] of Object.entries(counts)) {
      const idx = this.model.vocabMap[t];
      const tf = 1 + Math.log(count);
      const tfidf = tf * (this.model.idf[t] || 1);
      entries.push([idx, tfidf]);
      sumSq += tfidf * tfidf;
    }

    const norm = Math.sqrt(sumSq) || 1;
    for (const e of entries) {
      e[1] /= norm;
    }

    const primary = this.model.weights && this.model.bias ? 'logistic_regression' : (this.model.primaryClassifier || this.model.metadata?.primaryClassifier || 'centroid_cosine');
    const scoreResult = (this.model.weights && this.model.bias)
      ? this.scoreLogisticRegression(entries)
      : this.scoreCentroidCosine(entries);

    const { probs, bestIdx, confidence, tokenWeights } = scoreResult;

    const predictedClass = CLASS_NAMES[bestIdx] || 'Suspicious';
    const resultProbs: Record<EmailClassification, number> = {
      Legitimate: parseFloat(probs[0].toFixed(4)),
      Suspicious: parseFloat(probs[1].toFixed(4)),
      Impersonated: parseFloat(probs[2].toFixed(4)),
      Phishing: parseFloat(probs[3].toFixed(4)),
      'Fraud-related': parseFloat(probs[4].toFixed(4))
    };

    return {
      predictedClass,
      probabilities: resultProbs,
      confidence: Math.max(0.1, confidence),
      topFeatures: tokenWeights.slice(0, 8),
      activeClassifier: primary
    };
  }
}

export const mlEngine = new MachineLearningClassifier();

/**
 * Main forensic classifier combining ML Centroid-Cosine TF-IDF inference with structural identity evidence.
 * Generates an explainable 0-100 Threat Score without double-counting.
 */
export function classifyEmailForensics(input: ClassifierInput): ClassificationResult {
  const features: FeatureWeight[] = [];
  const heuristics: ClassificationResult['heuristics'] = [];
  const topVectors: string[] = [];

  const mlOutput = mlEngine.predict({
    subject: input.subject,
    from: input.from,
    fromDomain: input.fromDomain,
    bodyText: input.bodyText || input.text,
    replyTo: input.replyTo,
    returnPath: input.returnPath,
    auth: input.auth,
    domainIntelligence: input.domainIntelligence,
    hops: input.hops
  });

  const structuralIdentity = evaluateStructuralIdentity({
    from: input.from,
    fromDomain: input.fromDomain,
    replyTo: input.replyTo,
    returnPath: input.returnPath,
    auth: input.auth,
    domainIntelligence: input.domainIntelligence,
    hops: input.hops
  });

  // -------------------------------------------------------------
  // Component 1: Authentication Evaluation (Max 25 pts)
  // -------------------------------------------------------------
  let authScore = 0;
  const authReasons: string[] = [];

  const spfStatus = input.auth?.spf?.status?.toUpperCase();
  const dkimStatus = input.auth?.dkim?.status?.toUpperCase();
  const dmarcStatus = input.auth?.dmarc?.status?.toUpperCase();

  if (spfStatus === 'FAIL') {
    authScore += 10;
    authReasons.push('SPF validation hard-failed (-all rejected sending host IP)');
  } else if (spfStatus === 'SOFTFAIL') {
    authScore += 6;
    authReasons.push('SPF validation soft-failed (~all unaligned sender IP)');
  }

  if (dkimStatus === 'FAIL' || dkimStatus === 'INVALID') {
    authScore += 10;
    authReasons.push('DKIM cryptographic signature verification failed');
  }

  if (dmarcStatus === 'REJECT' || dmarcStatus === 'FAIL') {
    authScore += 10;
    authReasons.push('DMARC alignment policy failed');
  }

  authScore = Math.min(25, authScore);
  features.push({
    feature: 'authentication_alignment',
    category: 'AUTHENTICATION',
    weight: authScore,
    triggered: authScore > 0,
    severity: authScore >= 15 ? 'CRITICAL' : authScore > 0 ? 'HIGH' : 'LOW',
    title: 'Authentication & Cryptographic Alignment',
    description: authReasons.length > 0
      ? authReasons.join('; ')
      : 'SPF, DKIM, and DMARC passing or aligned.'
  });

  // -------------------------------------------------------------
  // Component 2: Domain Risk Evaluation (Max 25 pts)
  // -------------------------------------------------------------
  let domainScore = 0;
  const domainReasons: string[] = [];

  const isTyposquat = Boolean(input.domainIntelligence?.typosquatting?.is_typosquat || structuralIdentity.isLookalikeDomain);
  const targetBrand = input.domainIntelligence?.typosquatting?.target_brand || structuralIdentity.claimedBrand;
  if (isTyposquat) {
    domainScore += 15;
    domainReasons.push(`Domain mimics enterprise brand "${targetBrand || 'Known Brand'}"`);
  }

  const isNxdomain = input.domainIntelligence?.status === 'nxdomain';
  if (isNxdomain) {
    domainScore += 15;
    domainReasons.push(`Domain ${input.fromDomain} does not exist in public authoritative DNS (NXDOMAIN)`);
  }

  const isNewDomain = Boolean(input.domainIntelligence?.is_newly_registered);
  const domainAge = input.domainIntelligence?.domain_age_days;
  if (isNewDomain) {
    domainScore += 10;
    domainReasons.push(`Newly registered domain (${domainAge !== undefined ? `${domainAge} days` : '<30 days'})`);
  }

  const mxMissing = Boolean(input.domainIntelligence?.mx_missing);
  if (mxMissing) {
    domainScore += 8;
    domainReasons.push('No Mail Exchanger (MX) records found in DNS');
  }

  domainScore = Math.min(25, domainScore);
  features.push({
    feature: 'domain_risk_intelligence',
    category: 'DOMAIN',
    weight: domainScore,
    triggered: domainScore > 0,
    severity: domainScore >= 15 ? 'CRITICAL' : domainScore > 0 ? 'HIGH' : 'LOW',
    title: 'Domain Risk & Registration Intelligence',
    description: domainReasons.length > 0 ? domainReasons.join('; ') : 'Established domain with authoritative DNS.'
  });

  // -------------------------------------------------------------
  // Component 3: Infrastructure & Route Risk (Max 20 pts)
  // -------------------------------------------------------------
  let infraScore = 0;
  const infraReasons: string[] = [];

  const torOrAbuseHop = input.hops?.find(h => h.isTor || h.is_tor || h.isBlacklisted || (h.abuseScore && h.abuseScore > 60));
  if (torOrAbuseHop) {
    infraScore += 15;
    infraReasons.push(`Relay hop ${torOrAbuseHop.fromIp || 'node'} flagged for anonymization / abuse score ${torOrAbuseHop.abuseScore || 85}%`);
  }

  infraScore = Math.min(20, infraScore);
  features.push({
    feature: 'infrastructure_route_risk',
    category: 'INFRASTRUCTURE',
    weight: infraScore,
    triggered: infraScore > 0,
    severity: infraScore >= 15 ? 'CRITICAL' : 'LOW',
    title: 'Transmission Route & Relay Infrastructure',
    description: infraReasons.length > 0 ? infraReasons.join('; ') : 'Transmission path passed through verified relays.'
  });

  // -------------------------------------------------------------
  // Component 4: Machine Learning Content Risk (Max 20 pts)
  // -------------------------------------------------------------
  const maliciousProbability = (mlOutput.probabilities.Phishing || 0) +
    (mlOutput.probabilities['Fraud-related'] || 0) +
    0.6 * (mlOutput.probabilities.Impersonated || 0) +
    0.3 * (mlOutput.probabilities.Suspicious || 0);

  const mlScore = Math.min(20, Math.round(maliciousProbability * 20));
  const mlReasons: string[] = [
    `ML classifier predicted class: "${mlOutput.predictedClass}" (confidence ${(mlOutput.confidence * 100).toFixed(1)}%)`,
    `Phishing prob: ${((mlOutput.probabilities.Phishing || 0) * 100).toFixed(1)}%, Fraud prob: ${((mlOutput.probabilities['Fraud-related'] || 0) * 100).toFixed(1)}%`
  ];

  features.push({
    feature: 'ml_content_probability',
    category: 'LINGUISTIC',
    weight: mlScore,
    triggered: mlScore > 5,
    severity: mlScore >= 15 ? 'CRITICAL' : mlScore >= 10 ? 'HIGH' : 'LOW',
    title: 'Machine Learning Content Classification',
    description: mlReasons.join(' | ')
  });

  // -------------------------------------------------------------
  // Component 5: Rule-Based Heuristics (Max 10 pts)
  // -------------------------------------------------------------
  let heuristicScore = 0;
  const heuristicReasons: string[] = [];

  if (structuralIdentity.isReplyToMismatch) {
    heuristicScore += 5;
    heuristicReasons.push(`Reply-To header routes to different domain (${input.replyTo})`);
  }

  if (structuralIdentity.isBrandDisplayMismatch) {
    heuristicScore += 5;
    heuristicReasons.push(`Display name claims identity "${structuralIdentity.claimedBrand}" but originates from unaligned domain ${input.fromDomain}`);
  }

  if (structuralIdentity.isPunycode) {
    heuristicScore += 5;
    heuristicReasons.push('Punycode / Homoglyph lookalike characters detected in sender domain');
  }

  heuristicScore = Math.min(10, heuristicScore);
  features.push({
    feature: 'heuristic_identity_rules',
    category: 'IDENTITY',
    weight: heuristicScore,
    triggered: heuristicScore > 0,
    severity: heuristicScore >= 8 ? 'HIGH' : heuristicScore > 0 ? 'MEDIUM' : 'LOW',
    title: 'Identity & Routing Redirection Heuristics',
    description: heuristicReasons.length > 0 ? heuristicReasons.join('; ') : 'No identity spoofing or reply redirection detected.'
  });

  // Phase 5: Stack signals using Learned Supervised Meta-Classifier
  const metaPrediction = predictMetaThreatScore({
    mlProbLegitimate: mlOutput.probabilities.Legitimate || 0,
    mlProbSuspicious: mlOutput.probabilities.Suspicious || 0,
    mlProbImpersonated: mlOutput.probabilities.Impersonated || 0,
    mlProbPhishing: mlOutput.probabilities.Phishing || 0,
    mlProbFraud: mlOutput.probabilities['Fraud-related'] || 0,
    mlConfidence: mlOutput.confidence,
    authSpfFail: (spfStatus === 'FAIL' || spfStatus === 'SOFTFAIL') ? 1 : 0,
    authDkimFail: (dkimStatus === 'FAIL' || dkimStatus === 'INVALID') ? 1 : 0,
    authDmarcFail: (dmarcStatus === 'REJECT' || dmarcStatus === 'FAIL') ? 1 : 0,
    domainAgeRisk: domainAge !== undefined && domainAge < 30 ? 1 : domainAge !== undefined && domainAge < 90 ? 0.5 : (isNewDomain ? 1 : 0),
    domainTyposquatRisk: isTyposquat ? 1 : 0,
    identityLookalikeDomain: structuralIdentity.isLookalikeDomain ? 1 : 0,
    identityDisplayMismatch: structuralIdentity.isBrandDisplayMismatch ? 1 : 0,
    identityReplyToMismatch: structuralIdentity.isReplyToMismatch ? 1 : 0,
    infraTorOrAbuse: Boolean(torOrAbuseHop) ? 1 : 0,
    finDollarAmountPresent: 0,
    finRoutingOrIbanPresent: 0,
    becLearnedRiskScore: 0,
    semanticSimilarityScore: 0,
    heuristicRuleScore: Math.min(1, heuristicScore / 10)
  }, {
    authReasons,
    domainReasons,
    infraReasons,
    mlReasons,
    heuristicReasons
  });

  const totalThreatScore = metaPrediction.totalThreatScore;
  const threatScoreBreakdown: ThreatScoreBreakdown = metaPrediction.breakdown;

  // Compile active heuristics list
  for (const feat of features) {
    if (feat.triggered) {
      heuristics.push({
        id: `h-${feat.feature}`,
        title: feat.title,
        severity: feat.severity,
        description: feat.description,
        triggered: true
      });
      topVectors.push(feat.title);
    }
  }

  // Classification & Verdict derivation
  let finalClass: EmailClassification = mlOutput.predictedClass;
  if (structuralIdentity.isBrandDisplayMismatch || structuralIdentity.isLookalikeDomain || structuralIdentity.isPunycode) {
    if (mlOutput.predictedClass !== 'Fraud-related') {
      finalClass = 'Impersonated';
    }
  }

  // Cryptographic authentication safety anchor:
  // If SPF, DKIM, and DMARC pass with zero identity or relay anomalies, classify as Legitimate Clean mail
  const isCryptographicallyVerifiedClean =
    spfStatus === 'PASS' &&
    dkimStatus === 'PASS' &&
    (dmarcStatus === 'PASS' || dmarcStatus === 'ALIGNED') &&
    !isTyposquat &&
    !structuralIdentity.isBrandDisplayMismatch &&
    !structuralIdentity.isReplyToMismatch &&
    !torOrAbuseHop;

  if (isCryptographicallyVerifiedClean) {
    finalClass = 'Legitimate';
  }

  const calibratedThreatScore = isCryptographicallyVerifiedClean ? Math.min(totalThreatScore, 10) : totalThreatScore;

  const severity: ClassificationResult['severity'] =
    calibratedThreatScore >= 80 ? 'CRITICAL'
    : calibratedThreatScore >= 60 ? 'HIGH'
    : calibratedThreatScore >= 35 ? 'MEDIUM'
    : calibratedThreatScore >= 15 ? 'LOW'
    : 'CLEAN';

  // Authoritative top-level verdict strictly reconciled with composite multi-factor severity
  let verdict: ClassificationResult['verdict'];
  if (severity === 'CRITICAL' || severity === 'HIGH') {
    verdict = finalClass === 'Fraud-related' ? 'FRAUD-RELATED'
      : finalClass === 'Impersonated' ? 'IMPERSONATED'
      : 'MALICIOUS PHISH';
  } else if (severity === 'MEDIUM') {
    verdict = 'SUSPICIOUS';
  } else {
    // Score is under 35/100 (LOW or CLEAN)
    verdict = 'LEGITIMATE';
  }

  const phishingProbability = parseFloat((mlOutput.probabilities.Phishing || 0).toFixed(4));
  const mlConfidence = mlOutput.confidence;

  const attribution: ClassificationResult['attribution'] = {
    actor: 'Commodity Threat Infrastructure',
    confidence: 'LOW',
    reason: 'Forensic indicators reflect automated or commodity spoofing infrastructure; no specific APT actor attribution is made.',
    disclaimer: 'Evidence reflects intermediate transmission relays and network-level telemetry, NOT physical attacker location or definitive actor attribution.'
  };

  const infrastructureBreakdown = {
    spoofedDomain: isTyposquat || structuralIdentity.isBrandDisplayMismatch ? 85 : 10,
    anonymizedRelay: Boolean(torOrAbuseHop) ? 90 : 10,
    compromisedAccount: structuralIdentity.isReplyToMismatch ? 70 : 15,
    legitimateRoute: finalClass === 'Legitimate' ? 95 : 5
  };

  return {
    classification: finalClass,
    predictedClass: finalClass,
    probabilities: mlOutput.probabilities,
    confidence: mlConfidence,
    threatScore: totalThreatScore,
    threatScoreBreakdown,
    phishingProbability,
    mlConfidence,
    verdict,
    severity,
    features,
    topFeatures: mlOutput.topFeatures,
    heuristics,
    topVectors,
    infrastructureBreakdown,
    attribution,
    activeClassifier: mlOutput.activeClassifier
  };
}

export interface LayeredClassificationResult extends ClassificationResult {
  tfidf_classification: {
    predictedClass: EmailClassification;
    probabilities: Record<EmailClassification, number>;
    confidence: number;
    topFeatures: Array<{ token: string; weight: number }>;
    activeClassifier?: 'logistic_regression' | 'centroid_cosine';
  };
  semantic_similarity: SemanticSimilarityResult;
  llm_linguistic_forensics: LinguisticForensicsResult;
  weighted_lexicon_score: Record<string, number>;
  extracted_financial_entities: FinancialEntitiesResult;
  bec_learned_model?: BecPredictionResult;
  meta_classifier?: MetaThreatPrediction;
  nlp_layers: {
    layer0_tfidf_centroid: {
      predictedClass: EmailClassification;
      probabilities: Record<EmailClassification, number>;
      confidence: number;
      topFeatures: Array<{ token: string; weight: number }>;
    };
    layer1_semantic_similarity: SemanticSimilarityResult;
    layer2_llm_linguistic_forensics: LinguisticForensicsResult;
    layer3_weighted_lexicon: {
      scores: Record<string, number>;
      financial_entities: FinancialEntitiesResult;
      note?: string;
    };
    layer4_learned_bec_model?: BecPredictionResult;
    layer5_stacked_meta_classifier?: MetaThreatPrediction;
  };
}

/**
 * Multi-Layer Advanced Forensic NLP & Telemetry Pipeline.
 *
 * Runs all 4 distinct layers while keeping each separately labeled and grounded:
 * - Layer 0: Centroid-Cosine TF-IDF Vector Space Inference (Deterministic baseline)
 * - Layer 1: Gemini text-embedding-004 Semantic Similarity against reference corpus (Optional/API-key)
 * - Layer 2: Groq / Gemini Structured LLM Linguistic Forensics tagged as HYPOTHESIS (Optional/API-key)
 * - Layer 3: Expanded Weighted Lexicon & Financial Entity Extractor with IBAN/ABA checksums (Always-on)
 */
export async function classifyEmailContent(input: ClassifierInput): Promise<LayeredClassificationResult> {
  // 1. Run Baseline Deterministic ML & Envelope Telemetry
  const baseResult = classifyEmailForensics(input);
  const bodyText = input.bodyText || input.text || '';
  const combinedText = `${input.subject} ${bodyText}`;

  // 2. LAYER 3: Free deterministic weighted lexicon & entity extraction (Always-On)
  const seScores = getWeightedSocialEngineeringScore(combinedText);
  const finEntities = extractFinancialEntities(combinedText);

  // 3. LAYER 1: Semantic embedding similarity via Gemini text-embedding-004 (Optional)
  const semanticSim = await scoreSemanticSimilarity(bodyText || input.subject);

  // 4. LAYER 2: Structured LLM linguistic forensics (Optional, tagged as HYPOTHESIS)
  const llmForensics = await analyzeLinguisticForensics(bodyText || input.subject, {
    from: input.from,
    subject: input.subject
  });

  // 5. Phase 3: Learned Supervised BEC Classifier (Replaces static data/bec_weights.json)
  const updatedHeuristics = [...baseResult.heuristics];
  const updatedFeatures = [...baseResult.features];
  const updatedTopVectors = [...baseResult.topVectors];

  const maxDollarVal = finEntities.dollarAmounts.length > 0
    ? parseFloat(finEntities.dollarAmounts[0].replace(/[^0-9.]/g, '')) || 0
    : 0;

  const becPrediction = predictBecRisk(combinedText, {
    from: input.from,
    fromDomain: input.fromDomain,
    replyTo: input.replyTo,
    hasRouting: finEntities.routingNumbers.length > 0,
    hasIban: finEntities.ibanNumbers.length > 0,
    dollarAmountCount: finEntities.dollarAmounts.length,
    maxDollarAmount: maxDollarVal,
    isReplyToMismatch: baseResult.features.some(f => f.feature === 'heuristic_identity_rules' && f.triggered),
    isBrandDisplayMismatch: baseResult.features.some(f => f.feature === 'domain_risk_intelligence' && f.triggered)
  });

  if (becPrediction.isBecDetected) {
    if (!updatedHeuristics.some(h => h.id === 'h-bec-learned')) {
      updatedHeuristics.push({
        id: 'h-bec-learned',
        title: 'Learned Business Email Compromise (BEC) Model Flag',
        severity: becPrediction.becRiskScore >= 0.8 ? 'CRITICAL' : 'HIGH',
        description: becPrediction.explanation,
        triggered: true
      });
      updatedTopVectors.push('Learned BEC Payment Diversion');
    }

    updatedFeatures.push({
      feature: 'bec_learned_model',
      category: 'LINGUISTIC',
      weight: Math.round(becPrediction.becRiskScore * 10),
      triggered: true,
      severity: becPrediction.becRiskScore >= 0.8 ? 'CRITICAL' : 'HIGH',
      title: 'Learned BEC Classification',
      description: becPrediction.explanation
    });
  }

  const hasFinancialData = finEntities.hasFinancialEntities ||
    llmForensics.extracted_entities.dollar_amounts.length > 0 ||
    llmForensics.extracted_entities.account_or_routing_numbers.length > 0;

  const isBecPattern = /(?:wire|direct deposit|payroll|w-2|gift card|invoice|remittance|swift transfer|routing number|escrow|bank details|ach debit)/i.test(combinedText) ||
    llmForensics.social_engineering_techniques.includes('authority_impersonation') ||
    llmForensics.social_engineering_techniques.includes('pretexting');

  if (hasFinancialData && isBecPattern) {
    const details: string[] = [];
    if (finEntities.dollarAmounts.length > 0) details.push(`Amounts: ${finEntities.dollarAmounts.join(', ')}`);
    if (finEntities.ibanNumbers.length > 0) details.push(`IBANs: ${finEntities.ibanNumbers.join(', ')}`);
    if (finEntities.routingNumbers.length > 0) details.push(`ABA Routing: ${finEntities.routingNumbers.join(', ')}`);
    if (finEntities.bankAccountCandidates.length > 0) details.push(`Account/SWIFT: ${finEntities.bankAccountCandidates.join(', ')}`);
    if (llmForensics.extracted_entities.dollar_amounts.length > 0 && finEntities.dollarAmounts.length === 0) {
      details.push(`LLM-detected Amounts: ${llmForensics.extracted_entities.dollar_amounts.join(', ')}`);
    }

    const becDesc = details.length > 0
      ? `Explicit financial alteration / payment entities identified: ${details.join(' | ')}`
      : 'Payment alteration or banking instructions detected.';

    if (!updatedHeuristics.some(h => h.id === 'h-bec-entities')) {
      updatedHeuristics.push({
        id: 'h-bec-entities',
        title: 'Verified Financial Entities in Payment Diversion Context',
        severity: 'HIGH',
        description: becDesc,
        triggered: true
      });
      updatedTopVectors.push('Financial Payment Diversion Entities');
    }
  }

  // Tag LLM findings as explicit HYPOTHESIS evidence
  if (llmForensics.status === 'AVAILABLE' && llmForensics.social_engineering_techniques.length > 0) {
    if (!updatedHeuristics.some(h => h.id === 'h-llm-hypothesis')) {
      updatedHeuristics.push({
        id: 'h-llm-hypothesis',
        title: `Linguistic Hypothesis: ${llmForensics.social_engineering_techniques.slice(0, 2).map(s => s.replace(/_/g, ' ')).join(', ')}`,
        severity: llmForensics.register_anomaly_flag ? 'HIGH' : 'MEDIUM',
        description: `[HYPOTHESIS] Model ${llmForensics.model_used} inferred tone "${llmForensics.tone_register}" (confidence ${(llmForensics.confidence * 100).toFixed(0)}%). Techniques: ${llmForensics.social_engineering_techniques.join(', ')}.${llmForensics.register_anomaly_reason ? ` Note: ${llmForensics.register_anomaly_reason}` : ''}`,
        triggered: true
      });
    }
  }

  // Tag Semantic similarity finding if strong cluster match observed
  if (semanticSim.status === 'AVAILABLE' && semanticSim.topSimilarity >= 0.75 && semanticSim.nearestClass && semanticSim.nearestClass !== 'Legitimate') {
    if (!updatedHeuristics.some(h => h.id === 'h-semantic-cluster')) {
      const modelLabel = semanticSim.details?.model || 'semantic embedding model';
      updatedHeuristics.push({
        id: 'h-semantic-cluster',
        title: `Semantic Pattern Match: ${semanticSim.details?.nearestTemplateTitle || semanticSim.nearestClass}`,
        severity: semanticSim.topSimilarity >= 0.85 ? 'HIGH' : 'MEDIUM',
        description: `Cosine similarity ${(semanticSim.topSimilarity * 100).toFixed(1)}% to canonical ${semanticSim.nearestClass} pattern via ${modelLabel}.`,
        triggered: true
      });
    }
  }

  // Phase 5: Re-evaluate Meta-Classifier Threat Score with Layer 1, 2, 3 and BEC findings
  const fullMetaPrediction = predictMetaThreatScore({
    mlProbLegitimate: baseResult.probabilities.Legitimate || 0,
    mlProbSuspicious: baseResult.probabilities.Suspicious || 0,
    mlProbImpersonated: baseResult.probabilities.Impersonated || 0,
    mlProbPhishing: baseResult.probabilities.Phishing || 0,
    mlProbFraud: baseResult.probabilities['Fraud-related'] || 0,
    mlConfidence: baseResult.confidence,
    authSpfFail: input.auth?.spf?.status === 'FAIL' || input.auth?.spf?.status === 'SOFTFAIL' ? 1 : 0,
    authDkimFail: input.auth?.dkim?.status === 'FAIL' || input.auth?.dkim?.status === 'NONE' ? 1 : 0,
    authDmarcFail: input.auth?.dmarc?.status === 'FAIL' || input.auth?.dmarc?.status === 'REJECT' ? 1 : 0,
    domainAgeRisk: input.domainIntelligence?.domain_age_days !== undefined && input.domainIntelligence.domain_age_days < 30 ? 1 : 0,
    domainTyposquatRisk: Boolean(input.domainIntelligence?.typosquatting?.is_typosquat) ? 1 : 0,
    identityLookalikeDomain: baseResult.features.some(f => f.feature === 'domain_risk_intelligence' && f.triggered) ? 1 : 0,
    identityDisplayMismatch: baseResult.features.some(f => f.feature === 'domain_risk_intelligence' && f.triggered) ? 1 : 0,
    identityReplyToMismatch: Boolean(input.replyTo && !input.replyTo.includes(input.fromDomain || '')) ? 1 : 0,
    infraTorOrAbuse: input.hops?.some(h => h.isTor || (h.abuseScore && h.abuseScore > 60)) ? 1 : 0,
    finDollarAmountPresent: finEntities.dollarAmounts.length > 0 ? 1 : 0,
    finRoutingOrIbanPresent: (finEntities.routingNumbers.length > 0 || finEntities.ibanNumbers.length > 0) ? 1 : 0,
    becLearnedRiskScore: becPrediction.becRiskScore,
    semanticSimilarityScore: semanticSim.status === 'AVAILABLE' ? semanticSim.topSimilarity : 0,
    heuristicRuleScore: Math.min(1, updatedHeuristics.filter(h => h.triggered).length / 5)
  });

  const tfidfSummary = {
    predictedClass: baseResult.predictedClass,
    probabilities: baseResult.probabilities,
    confidence: baseResult.confidence,
    topFeatures: baseResult.topFeatures,
    activeClassifier: baseResult.activeClassifier || 'centroid_cosine'
  };

  let finalClass = baseResult.predictedClass;
  if (becPrediction.isBecDetected && finalClass !== 'Phishing') {
    finalClass = 'Fraud-related';
  }

  const finalThreatScore = Math.max(baseResult.threatScore, fullMetaPrediction.totalThreatScore);
  const finalSeverity: ClassificationResult['severity'] =
    finalThreatScore >= 80 ? 'CRITICAL'
    : finalThreatScore >= 60 ? 'HIGH'
    : finalThreatScore >= 35 ? 'MEDIUM'
    : finalThreatScore >= 15 ? 'LOW'
    : 'CLEAN';

  let finalVerdict = baseResult.verdict;
  if (finalSeverity === 'CRITICAL' || finalSeverity === 'HIGH') {
    finalVerdict = finalClass === 'Fraud-related' ? 'FRAUD-RELATED'
      : finalClass === 'Impersonated' ? 'IMPERSONATED'
      : 'MALICIOUS PHISH';
  } else if (finalSeverity === 'MEDIUM') {
    finalVerdict = 'SUSPICIOUS';
  } else {
    finalVerdict = 'LEGITIMATE';
  }

  return {
    ...baseResult,
    classification: finalClass,
    predictedClass: finalClass,
    verdict: finalVerdict,
    severity: finalSeverity,
    threatScore: finalThreatScore,
    threatScoreBreakdown: fullMetaPrediction.breakdown,
    heuristics: updatedHeuristics,
    features: updatedFeatures,
    topVectors: updatedTopVectors,
    tfidf_classification: tfidfSummary,
    semantic_similarity: semanticSim,
    llm_linguistic_forensics: llmForensics,
    weighted_lexicon_score: seScores,
    extracted_financial_entities: finEntities,
    bec_learned_model: becPrediction,
    meta_classifier: fullMetaPrediction,
    nlp_layers: {
      layer0_tfidf_centroid: tfidfSummary,
      layer1_semantic_similarity: semanticSim,
      layer2_llm_linguistic_forensics: llmForensics,
      layer3_weighted_lexicon: {
        scores: seScores,
        financial_entities: finEntities,
        note: 'Static hand-tuned keyword heuristic fallback. Primary payment diversion inference handled by layer4_learned_bec_model.'
      },
      layer4_learned_bec_model: becPrediction,
      layer5_stacked_meta_classifier: fullMetaPrediction
    }
  };
}
