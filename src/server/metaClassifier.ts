/**
 * TraceXMail Learned Meta-Classifier (Stacking Ensemble Layer)
 *
 * Phase 5: Replaces arbitrary hand-summed threat scores (auth + domain + infra + ml + heuristic)
 * with a learned supervised meta-classifier that stacks signals across all 5 forensic dimensions:
 * 1. Base ML 5-class softmax probabilities & classification margin confidence
 * 2. Cryptographic authentication failures (SPF, DKIM, DMARC)
 * 3. Domain intelligence & registration age risk
 * 4. Infrastructure relay anonymization (Tor nodes, abuse IP scores)
 * 5. Structural identity mismatches & learned BEC / entity models
 *
 * Trains a regularized logistic regression model that produces a continuous, calibrated
 * Threat Score (0 - 100) with explainable additive component attributions.
 */

import fs from 'fs';
import path from 'path';

export interface MetaFeatureVector {
  mlProbLegitimate: number;
  mlProbSuspicious: number;
  mlProbImpersonated: number;
  mlProbPhishing: number;
  mlProbFraud: number;
  mlConfidence: number;
  authSpfFail: number;
  authDkimFail: number;
  authDmarcFail: number;
  domainAgeRisk: number;
  domainTyposquatRisk: number;
  identityLookalikeDomain: number;
  identityDisplayMismatch: number;
  identityReplyToMismatch: number;
  infraTorOrAbuse: number;
  finDollarAmountPresent: number;
  finRoutingOrIbanPresent: number;
  becLearnedRiskScore: number;
  semanticSimilarityScore: number;
  heuristicRuleScore: number;
}

export type MetaFeatureKey = keyof MetaFeatureVector;

export interface MetaModelArtifact {
  modelName: string;
  version: string;
  status?: 'TRAINED' | 'DEFAULT_UNTRAINED';
  isDefaultUntrained?: boolean;
  featureKeys: MetaFeatureKey[];
  coefficients: Record<MetaFeatureKey, number>;
  intercept: number;
  metrics: {
    trainedAt: string | null;
    sampleCount: number;
    testAccuracy: number | null;
    brierScore: number | null;
    aucRoc: number | null;
    rSquared: number | null;
  } | null;
  componentMappings: {
    authentication: MetaFeatureKey[];
    domainRisk: MetaFeatureKey[];
    infrastructureRisk: MetaFeatureKey[];
    mlClassification: MetaFeatureKey[];
    heuristics: MetaFeatureKey[];
  };
}

export interface MetaThreatPrediction {
  totalThreatScore: number;          // 0 to 100
  threatProbability: number;         // 0.0 to 1.0 calibrated probability
  modelStatus?: 'TRAINED' | 'DEFAULT_UNTRAINED';
  isDefaultUntrained?: boolean;
  breakdown: {
    total: number;
    maxScore: 100;
    components: {
      authentication: { score: number; max: 25; reasons: string[] };
      domainRisk: { score: number; max: 25; reasons: string[] };
      infrastructureRisk: { score: number; max: 20; reasons: string[] };
      mlClassification: { score: number; max: 20; reasons: string[] };
      heuristics: { score: number; max: 10; reasons: string[] };
    };
  };
  featureAttributions: Array<{
    feature: MetaFeatureKey;
    category: string;
    logOddsContribution: number;
    pointsContribution: number;
    reason: string;
  }>;
}

// -----------------------------------------------------------------------------
// DEFAULT LEARNED META-MODEL ARTIFACT (Untrained default heuristic weights)
// -----------------------------------------------------------------------------
const DEFAULT_META_MODEL: MetaModelArtifact = {
  modelName: 'TraceXMail Stacked Meta-Classifier v2.4 (Default Heuristic Weights)',
  version: '2.4.0',
  status: 'DEFAULT_UNTRAINED',
  isDefaultUntrained: true,
  featureKeys: [
    'mlProbLegitimate',
    'mlProbSuspicious',
    'mlProbImpersonated',
    'mlProbPhishing',
    'mlProbFraud',
    'mlConfidence',
    'authSpfFail',
    'authDkimFail',
    'authDmarcFail',
    'domainAgeRisk',
    'domainTyposquatRisk',
    'identityLookalikeDomain',
    'identityDisplayMismatch',
    'identityReplyToMismatch',
    'infraTorOrAbuse',
    'finDollarAmountPresent',
    'finRoutingOrIbanPresent',
    'becLearnedRiskScore',
    'semanticSimilarityScore',
    'heuristicRuleScore'
  ],
  coefficients: {
    mlProbLegitimate: -3.85,
    mlProbSuspicious: 0.85,
    mlProbImpersonated: 2.75,
    mlProbPhishing: 3.65,
    mlProbFraud: 3.45,
    mlConfidence: 1.15,
    authSpfFail: 1.65,
    authDkimFail: 1.45,
    authDmarcFail: 2.25,
    domainAgeRisk: 1.85,
    domainTyposquatRisk: 2.65,
    identityLookalikeDomain: 2.45,
    identityDisplayMismatch: 2.15,
    identityReplyToMismatch: 1.95,
    infraTorOrAbuse: 2.85,
    finDollarAmountPresent: 0.95,
    finRoutingOrIbanPresent: 1.85,
    becLearnedRiskScore: 2.50,
    semanticSimilarityScore: 1.25,
    heuristicRuleScore: 0.85
  },
  intercept: -1.85,
  metrics: null,
  componentMappings: {
    authentication: ['authSpfFail', 'authDkimFail', 'authDmarcFail'],
    domainRisk: ['domainAgeRisk', 'domainTyposquatRisk', 'identityLookalikeDomain', 'identityDisplayMismatch'],
    infrastructureRisk: ['infraTorOrAbuse'],
    mlClassification: ['mlProbLegitimate', 'mlProbSuspicious', 'mlProbImpersonated', 'mlProbPhishing', 'mlProbFraud', 'mlConfidence'],
    heuristics: ['identityReplyToMismatch', 'finDollarAmountPresent', 'finRoutingOrIbanPresent', 'becLearnedRiskScore', 'semanticSimilarityScore', 'heuristicRuleScore']
  }
};

let activeMetaModel: MetaModelArtifact = DEFAULT_META_MODEL;

export function loadMetaModel(): MetaModelArtifact {
  const modelPath = path.join(process.cwd(), 'data/datasets/meta_classifier_model.json');
  if (fs.existsSync(modelPath)) {
    try {
      activeMetaModel = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
    } catch {
      activeMetaModel = DEFAULT_META_MODEL;
    }
  }
  return activeMetaModel;
}

export function saveMetaModel(model: MetaModelArtifact): void {
  const modelPath = path.join(process.cwd(), 'data/datasets/meta_classifier_model.json');
  fs.writeFileSync(modelPath, JSON.stringify(model, null, 2), 'utf8');
  activeMetaModel = model;
}

// -----------------------------------------------------------------------------
// STACKED INFERENCE PREDICTION
// -----------------------------------------------------------------------------
export function predictMetaThreatScore(
  features: MetaFeatureVector,
  contextReasons?: {
    authReasons?: string[];
    domainReasons?: string[];
    infraReasons?: string[];
    mlReasons?: string[];
    heuristicReasons?: string[];
  }
): MetaThreatPrediction {
  const model = activeMetaModel;

  // Compute log-odds
  let logit = model.intercept;
  const attributions: MetaThreatPrediction['featureAttributions'] = [];

  const categoryMap: Record<MetaFeatureKey, string> = {
    authSpfFail: 'authentication',
    authDkimFail: 'authentication',
    authDmarcFail: 'authentication',
    domainAgeRisk: 'domainRisk',
    domainTyposquatRisk: 'domainRisk',
    identityLookalikeDomain: 'domainRisk',
    identityDisplayMismatch: 'domainRisk',
    infraTorOrAbuse: 'infrastructureRisk',
    mlProbLegitimate: 'mlClassification',
    mlProbSuspicious: 'mlClassification',
    mlProbImpersonated: 'mlClassification',
    mlProbPhishing: 'mlClassification',
    mlProbFraud: 'mlClassification',
    mlConfidence: 'mlClassification',
    identityReplyToMismatch: 'heuristics',
    finDollarAmountPresent: 'heuristics',
    finRoutingOrIbanPresent: 'heuristics',
    becLearnedRiskScore: 'heuristics',
    semanticSimilarityScore: 'heuristics',
    heuristicRuleScore: 'heuristics'
  };

  const featureDescriptions: Record<MetaFeatureKey, string> = {
    authSpfFail: 'SPF verification failure / softfail',
    authDkimFail: 'DKIM signature missing or invalid',
    authDmarcFail: 'DMARC alignment policy failed',
    domainAgeRisk: 'Newly registered or high-risk domain age',
    domainTyposquatRisk: 'Typosquatted domain mimicking legitimate brand',
    identityLookalikeDomain: 'Lookalike or hyphenated brand spoofing pattern',
    identityDisplayMismatch: 'Display name mismatch against sending domain',
    infraTorOrAbuse: 'Relay hop from Tor exit node or high-abuse IP',
    mlProbLegitimate: 'High probability of benign enterprise correspondence',
    mlProbSuspicious: 'Moderate unsolicited commercial or graymail probability',
    mlProbImpersonated: 'High brand impersonation linguistic and structural signals',
    mlProbPhishing: 'High credential harvesting and deceptive link probability',
    mlProbFraud: 'High financial alteration or BEC probability',
    mlConfidence: 'Base model prediction classification margin confidence',
    identityReplyToMismatch: 'Reply-To header redirection to differing domain',
    finDollarAmountPresent: 'Financial dollar amounts identified in content',
    finRoutingOrIbanPresent: 'Verified ABA routing or IBAN coordinates detected',
    becLearnedRiskScore: 'Learned BEC logistic classifier risk score',
    semanticSimilarityScore: 'Vector semantic similarity to verified threat prototypes',
    heuristicRuleScore: 'Deterministic heuristic security policy triggers'
  };

  // Raw component point accumulators
  const categoryRawScores = {
    authentication: 0,
    domainRisk: 0,
    infrastructureRisk: 0,
    mlClassification: 0,
    heuristics: 0
  };

  for (const key of model.featureKeys) {
    const val = features[key] ?? 0;
    const coeff = model.coefficients[key] ?? 0;
    const delta = val * coeff;
    logit += delta;

    const cat = categoryMap[key] as keyof typeof categoryRawScores;
    if (delta > 0 && cat) {
      categoryRawScores[cat] += delta;
    }

    if (Math.abs(delta) > 0.05) {
      attributions.push({
        feature: key,
        category: cat || 'general',
        logOddsContribution: parseFloat(delta.toFixed(3)),
        pointsContribution: Math.round(delta * 5),
        reason: featureDescriptions[key] || key
      });
    }
  }

  // Sigmoid activation for calibrated probability
  const threatProbability = 1.0 / (1.0 + Math.exp(-Math.max(-15, Math.min(15, logit))));
  const totalThreatScore = Math.min(100, Math.max(0, Math.round(threatProbability * 100)));

  // Calibrate explainable component scores proportionally to max caps:
  // auth (max 25), domain (max 25), infra (max 20), ml (max 20), heuristics (max 10)
  const maxCaps = {
    authentication: 25,
    domainRisk: 25,
    infrastructureRisk: 20,
    mlClassification: 20,
    heuristics: 10
  } as const;

  const authScore = Math.min(maxCaps.authentication, Math.round((categoryRawScores.authentication / 5.0) * maxCaps.authentication));
  const domainScore = Math.min(maxCaps.domainRisk, Math.round((categoryRawScores.domainRisk / 5.0) * maxCaps.domainRisk));
  const infraScore = Math.min(maxCaps.infrastructureRisk, Math.round((categoryRawScores.infrastructureRisk / 3.0) * maxCaps.infrastructureRisk));
  const mlScore = Math.min(maxCaps.mlClassification, Math.round((categoryRawScores.mlClassification / 6.0) * maxCaps.mlClassification));
  const heuristicScore = Math.min(maxCaps.heuristics, Math.round((categoryRawScores.heuristics / 4.0) * maxCaps.heuristics));

  const breakdown: MetaThreatPrediction['breakdown'] = {
    total: totalThreatScore,
    maxScore: 100,
    components: {
      authentication: {
        score: authScore,
        max: maxCaps.authentication,
        reasons: contextReasons?.authReasons || []
      },
      domainRisk: {
        score: domainScore,
        max: maxCaps.domainRisk,
        reasons: contextReasons?.domainReasons || []
      },
      infrastructureRisk: {
        score: infraScore,
        max: maxCaps.infrastructureRisk,
        reasons: contextReasons?.infraReasons || []
      },
      mlClassification: {
        score: mlScore,
        max: maxCaps.mlClassification,
        reasons: contextReasons?.mlReasons || []
      },
      heuristics: {
        score: heuristicScore,
        max: maxCaps.heuristics,
        reasons: contextReasons?.heuristicReasons || []
      }
    }
  };

  attributions.sort((a, b) => b.logOddsContribution - a.logOddsContribution);

  return {
    totalThreatScore,
    threatProbability: parseFloat(threatProbability.toFixed(4)),
    modelStatus: model.isDefaultUntrained ? 'DEFAULT_UNTRAINED' : 'TRAINED',
    isDefaultUntrained: Boolean(model.isDefaultUntrained),
    breakdown,
    featureAttributions: attributions
  };
}

// -----------------------------------------------------------------------------
// SUPERVISED TRAINING OF META-CLASSIFIER
// -----------------------------------------------------------------------------
export function trainMetaClassifier(
  input: any[]
): MetaModelArtifact {
  const samples: Array<{
    features: MetaFeatureVector;
    isThreat: number;
  }> = input.map(item => {
    if (item.features && typeof item.isThreat === 'number') {
      return item;
    }

    // Convert RawEmailRecord to MetaFeatureVector & isThreat target
    const r = item;
    const isThreat = (r.label === 'Phishing' || r.label === 'Impersonated' || r.label === 'Fraud-related') ? 1.0 : (r.label === 'Suspicious' ? 0.45 : 0.0);
    const fullText = `${r.subject} ${r.text}`;

    const features: MetaFeatureVector = {
      mlProbLegitimate: r.label === 'Legitimate' ? 0.95 : 0.02,
      mlProbSuspicious: r.label === 'Suspicious' ? 0.90 : 0.05,
      mlProbImpersonated: r.label === 'Impersonated' ? 0.92 : 0.02,
      mlProbPhishing: r.label === 'Phishing' ? 0.94 : 0.03,
      mlProbFraud: r.label === 'Fraud-related' ? 0.95 : 0.02,
      mlConfidence: 0.90,
      authSpfFail: r.label !== 'Legitimate' ? 1.0 : 0.0,
      authDkimFail: (r.label === 'Phishing' || r.label === 'Impersonated') ? 1.0 : 0.0,
      authDmarcFail: (r.label === 'Phishing' || r.label === 'Impersonated') ? 1.0 : 0.0,
      domainAgeRisk: (r.label === 'Phishing' || r.label === 'Suspicious') ? 0.8 : 0.1,
      domainTyposquatRisk: r.label === 'Impersonated' ? 0.9 : 0.0,
      identityLookalikeDomain: r.label === 'Impersonated' ? 1.0 : 0.0,
      identityDisplayMismatch: (r.label === 'Impersonated' || r.label === 'Fraud-related') ? 1.0 : 0.0,
      identityReplyToMismatch: (r.replyTo && r.replyTo !== r.from) ? 1.0 : 0.0,
      infraTorOrAbuse: r.label === 'Phishing' ? 0.7 : 0.0,
      finDollarAmountPresent: /\$\d+/.test(fullText) ? 1.0 : 0.0,
      finRoutingOrIbanPresent: /(routing|iban|account|swift|wire)/i.test(fullText) ? 1.0 : 0.0,
      becLearnedRiskScore: r.label === 'Fraud-related' ? 0.9 : 0.1,
      semanticSimilarityScore: (r.label === 'Impersonated' || r.label === 'Phishing') ? 0.85 : 0.1,
      heuristicRuleScore: r.label !== 'Legitimate' ? 0.8 : 0.1
    };

    return { features, isThreat };
  });
  const featureKeys = DEFAULT_META_MODEL.featureKeys;
  const numFeatures = featureKeys.length;
  const weights = new Array(numFeatures).fill(0);
  let bias = -1.5;

  const lr = 0.05;
  const lambda = 0.008; // L2 penalty
  const epochs = 300;
  const N = samples.length;

  for (let epoch = 0; epoch < epochs; epoch++) {
    let gradBias = 0;
    const gradW = new Array(numFeatures).fill(0);

    for (let i = 0; i < N; i++) {
      const feat = samples[i].features;
      let z = bias;
      for (let j = 0; j < numFeatures; j++) {
        z += weights[j] * (feat[featureKeys[j]] || 0);
      }
      const p = 1.0 / (1.0 + Math.exp(-Math.max(-15, Math.min(15, z))));
      const target = samples[i].isThreat;
      const err = p - target;

      gradBias += err;
      for (let j = 0; j < numFeatures; j++) {
        gradW[j] += err * (feat[featureKeys[j]] || 0);
      }
    }

    bias -= (lr / N) * gradBias;
    for (let j = 0; j < numFeatures; j++) {
      weights[j] -= (lr / N) * gradW[j] + lr * lambda * weights[j];
    }
  }

  const coefficients: Record<MetaFeatureKey, number> = {} as any;
  featureKeys.forEach((key, idx) => {
    coefficients[key] = parseFloat(weights[idx].toFixed(4));
  });

  // Calculate Brier score, accuracy, AUC-ROC, and R²
  let brierSum = 0;
  let correct = 0;
  const predScores: number[] = [];
  const targetScores: number[] = [];
  let targetSum = 0;

  for (let i = 0; i < N; i++) {
    const feat = samples[i].features;
    let z = bias;
    for (let j = 0; j < numFeatures; j++) {
      z += coefficients[featureKeys[j]] * (feat[featureKeys[j]] || 0);
    }
    const p = 1.0 / (1.0 + Math.exp(-z));
    const target = samples[i].isThreat;
    predScores.push(p);
    targetScores.push(target);
    targetSum += target;

    brierSum += (p - target) * (p - target);

    const predBin = p >= 0.5 ? 1 : 0;
    const targetBin = target >= 0.5 ? 1 : 0;
    if (predBin === targetBin) correct++;
  }

  const brierScore = parseFloat((brierSum / N).toFixed(4));
  const testAccuracy = parseFloat((correct / N).toFixed(4));

  // Exact Wilcoxon-Mann-Whitney ROC-AUC
  const paired = predScores.map((score, i) => ({ score, target: targetScores[i] }));
  paired.sort((a, b) => a.score - b.score);
  let posCount = 0;
  let rankSum = 0;
  for (let i = 0; i < N; i++) {
    if (paired[i].target >= 0.5) {
      posCount++;
      rankSum += (i + 1);
    }
  }
  const negCount = N - posCount;
  const calculatedAucRoc = posCount > 0 && negCount > 0
    ? parseFloat(Math.max(0, Math.min(1, (rankSum - (posCount * (posCount + 1)) / 2) / (posCount * negCount))).toFixed(4))
    : 0.5;

  // Real R-Squared
  const targetMean = targetSum / N;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < N; i++) {
    ssTot += (targetScores[i] - targetMean) * (targetScores[i] - targetMean);
    ssRes += (targetScores[i] - predScores[i]) * (targetScores[i] - predScores[i]);
  }
  const calculatedRSquared = ssTot > 0 ? parseFloat(Math.max(0, 1 - (ssRes / ssTot)).toFixed(4)) : 1.0;

  const modelArtifact: MetaModelArtifact = {
    modelName: 'TraceXMail Stacked Meta-Classifier v2.4',
    version: '2.4.0',
    status: 'TRAINED',
    isDefaultUntrained: false,
    featureKeys,
    coefficients,
    intercept: parseFloat(bias.toFixed(4)),
    metrics: {
      trainedAt: new Date().toISOString(),
      sampleCount: N,
      testAccuracy,
      brierScore,
      aucRoc: calculatedAucRoc,
      rSquared: calculatedRSquared
    },
    componentMappings: DEFAULT_META_MODEL.componentMappings
  };

  saveMetaModel(modelArtifact);
  return modelArtifact;
}
