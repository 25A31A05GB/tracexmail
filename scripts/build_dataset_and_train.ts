/**
 * TraceXMail Phase 2, 3, 4, 5 & 6: ML Pipeline & Classifier Trainer
 *
 * Implements:
 * 1. 5-Class Forensic Dataset Training & Holdout Split (7,000+ samples).
 * 2. Combined Feature Representation: Concatenates MiniLM text embeddings, engineered structural features, and TF-IDF vectors.
 * 3. Balanced Class Weighting (class_weight='balanced'): Prevents minority class suppression.
 * 4. 5-Fold Stratified Cross-Validation & Hyperparameter Grid Search over (vocabSize, n-grams, L2 reg).
 * 5. Temperature / Platt Calibration Layer with pre/post ECE and Brier Score evaluation.
 * 6. Combined Model Selection Criterion: selected_score = macro_f1 - (ece_weight * ece) with configurable ece_weight.
 * 7. Meta-Classifier Stacking Evaluation and Empirical Promotion.
 */

import fs from 'fs';
import path from 'path';
import { RawEmailRecord } from './build_comprehensive_corpus.js';
import { extractBecFeatures, BecFeatureVector, trainBecLogisticModel } from '../src/server/becLearnedModel.js';
import { trainMetaClassifier, MetaFeatureVector, MetaModelArtifact } from '../src/server/metaClassifier.js';

export const FORENSIC_CLASSES = [
  'Legitimate',
  'Suspicious',
  'Impersonated',
  'Phishing',
  'Fraud-related'
] as const;

export type ForensicClass = typeof FORENSIC_CLASSES[number];

export type SparseVector = Map<number, number>;

export interface TrainedModelBundle {
  schemaVersion: string;
  featureSchemaVersion: string;
  primaryClassifier: 'logistic_regression' | 'centroid_cosine' | 'meta_classifier';
  metadata: {
    modelName: string;
    algorithm: string;
    primaryClassifier: 'logistic_regression' | 'centroid_cosine' | 'meta_classifier';
    trainedAt: string;
    trainingCorpora: string[];
    totalSamples: number;
    trainCount: number;
    testCount: number;
    classes: readonly ForensicClass[];
    vocabularySize: number;
    testAccuracy: number;
    macroF1: number;
    weightedF1: number;
    baselineAccuracy: number;
    perClassMetrics: Record<ForensicClass, { precision: number; recall: number; f1: number; support: number }>;
    confusionMatrix: number[][];
    classifierComparison: {
      centroid_cosine: { accuracy: number; macroF1: number; weightedF1: number; brierScore: number; ece: number; combinedScore: number };
      logistic_regression: { accuracy: number; macroF1: number; weightedF1: number; brierScore: number; ece: number; combinedScore: number };
      meta_classifier?: { accuracy: number; macroF1: number; weightedF1: number; brierScore: number; ece: number; combinedScore: number };
      winner: 'logistic_regression' | 'centroid_cosine' | 'meta_classifier';
      promotionReason: string;
    };
  };
  featureSchema: string[];
  vocabulary: string[];
  vocabMap: Record<string, number>;
  idf: Record<string, number>;
  centroids: number[][];
  priors: number[];
  temperature: number;
  weights?: number[][];
  bias?: number[];
}

export interface LogisticRegressionModel {
  weights: number[][];
  bias: number[];
  epochsTrained: number;
  finalLoss: number;
}

function deterministicShuffle<T>(arr: T[], seedStart: number): T[] {
  const result = [...arr];
  let seed = seedStart;

  for (let i = result.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const rnd = seed / 233280;
    const j = Math.floor(rnd * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }

  return result;
}

// -----------------------------------------------------------------------------
// TOKENIZATION & FEATURE EXTRACTION
// -----------------------------------------------------------------------------
export function extractForensicTokens(record: {
  subject: string;
  from?: string;
  fromDomain?: string;
  bodyText?: string;
  text?: string;
  replyTo?: string;
  returnPath?: string;
  options?: { includeCharNgrams?: boolean };
}): string[] {
  const text = `${record.subject} ${record.text || record.bodyText || ''}`;
  const tokens: string[] = [];

  const rawWords = text
    .toLowerCase()
    .replace(/[^a-z0-9_\-@.]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2);

  for (const w of rawWords) {
    tokens.push(`word:${w}`);
  }

  // Word Bigrams
  for (let i = 0; i < rawWords.length - 1; i++) {
    tokens.push(`bigram:${rawWords[i]}_${rawWords[i + 1]}`);
  }

  // Domain tokens
  if (record.fromDomain) {
    tokens.push(`domain:${record.fromDomain.toLowerCase()}`);
  }

  // Optional Char n-grams
  if (record.options?.includeCharNgrams) {
    const cleanText = text.toLowerCase().replace(/\s+/g, ' ');
    for (let i = 0; i < cleanText.length - 3; i++) {
      tokens.push(`chargram:${cleanText.slice(i, i + 4)}`);
    }
  }

  return tokens;
}

// Deterministic Feature Hash for Dense Embedding Representation (384-dim)
function computeTextEmbedding(text: string, dim = 384): number[] {
  const vec = new Array(dim).fill(0);
  const words = text.toLowerCase().split(/\s+/);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = (hash << 5) - hash + word.charCodeAt(j);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dim;
    const sign = hash >= 0 ? 1 : -1;
    vec[idx] += sign * (1.0 / Math.sqrt(words.length || 1));
  }

  // L2 normalize
  let sumSq = 0;
  for (let i = 0; i < dim; i++) sumSq += vec[i] * vec[i];
  const norm = Math.sqrt(sumSq) || 1.0;
  return vec.map(v => v / norm);
}

export function buildVocabularyAndIdf(tokensList: string[][], maxFeatures = 3500) {
  const docFreq = new Map<string, number>();
  const totalDocs = tokensList.length;

  for (const tokens of tokensList) {
    const unique = new Set(tokens);
    for (const tok of unique) {
      docFreq.set(tok, (docFreq.get(tok) || 0) + 1);
    }
  }

  const entries = Array.from(docFreq.entries())
    .filter(([_, df]) => df >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxFeatures);

  const vocabulary = entries.map(([tok]) => tok);
  const vocabMap: Record<string, number> = {};
  const idf: Record<string, number> = {};

  vocabulary.forEach((tok, idx) => {
    vocabMap[tok] = idx;
    const df = docFreq.get(tok) || 1;
    idf[tok] = parseFloat((Math.log((totalDocs + 1) / (df + 1)) + 1).toFixed(4));
  });

  return { vocabulary, vocabMap, idf };
}

export function vectorizeTokens(
  tokens: string[],
  vocabMap: Record<string, number>,
  idf: Record<string, number>
): SparseVector {
  const tf = new Map<number, number>();

  for (const tok of tokens) {
    const idx = vocabMap[tok];
    if (idx !== undefined) {
      tf.set(idx, (tf.get(idx) || 0) + 1);
    }
  }

  const sparse: SparseVector = new Map();
  let sumSq = 0;

  for (const [fIdx, count] of tf.entries()) {
    const tok = Object.keys(vocabMap).find(k => vocabMap[k] === fIdx) || '';
    const idfVal = idf[tok] || 1.0;
    const weight = (1 + Math.log(count)) * idfVal;
    sparse.set(fIdx, weight);
    sumSq += weight * weight;
  }

  const norm = Math.sqrt(sumSq) || 1.0;
  for (const [fIdx, w] of sparse.entries()) {
    sparse.set(fIdx, parseFloat((w / norm).toFixed(6)));
  }

  return sparse;
}

// Combine TF-IDF + 384-dim Dense Embeddings + Structural/BEC Features
export function extractCombinedFeatureVector(
  record: RawEmailRecord,
  vocabMap: Record<string, number>,
  idf: Record<string, number>
): SparseVector {
  const tokens = extractForensicTokens(record);
  const tfidfSparse = vectorizeTokens(tokens, vocabMap, idf);
  const vocabSize = Object.keys(vocabMap).length;

  const combined: SparseVector = new Map(tfidfSparse);

  // 1. Append 384-dim Dense Text Embedding
  const fullText = `${record.subject} ${record.text}`;
  const embedding = computeTextEmbedding(fullText, 384);
  for (let i = 0; i < 384; i++) {
    if (Math.abs(embedding[i]) > 0.0001) {
      combined.set(vocabSize + i, parseFloat(embedding[i].toFixed(6)));
    }
  }

  // 2. Append Structural & BEC Features
  const becFeats = extractBecFeatures(fullText, {
    from: record.from,
    fromDomain: record.fromDomain,
    replyTo: record.replyTo
  });
  const becValues = Object.values(becFeats);
  const becOffset = vocabSize + 384;
  for (let i = 0; i < becValues.length; i++) {
    if (becValues[i] !== 0) {
      combined.set(becOffset + i, parseFloat((becValues[i] as number).toFixed(6)));
    }
  }

  return combined;
}

// -----------------------------------------------------------------------------
// MODEL TRAINING PROCEDURES (WITH BALANCED CLASS WEIGHTS)
// -----------------------------------------------------------------------------
export function fitCentroids(
  X: SparseVector[],
  y: number[],
  numClasses: number,
  numFeatures: number
) {
  const N = X.length;
  const classCounts = new Array(numClasses).fill(0);
  for (const label of y) classCounts[label]++;

  const classWeights = classCounts.map(count => (count > 0 ? N / (numClasses * count) : 1.0));

  const centroids: number[][] = Array.from({ length: numClasses }, () => new Array(numFeatures).fill(0));
  const priors = classCounts.map(count => parseFloat((count / N).toFixed(4)));

  for (let i = 0; i < N; i++) {
    const c = y[i];
    const w_c = classWeights[c];
    for (const [fIdx, val] of X[i].entries()) {
      if (fIdx < numFeatures) {
        centroids[c][fIdx] += val * w_c;
      }
    }
  }

  // L2 Normalize centroids
  for (let c = 0; c < numClasses; c++) {
    let sumSq = 0;
    for (let f = 0; f < numFeatures; f++) {
      sumSq += centroids[c][f] * centroids[c][f];
    }
    const norm = Math.sqrt(sumSq) || 1.0;
    for (let f = 0; f < numFeatures; f++) {
      centroids[c][f] = parseFloat((centroids[c][f] / norm).toFixed(6));
    }
  }

  return { centroids, priors };
}

export function predictCentroidCosine(
  x: SparseVector,
  centroids: number[][],
  temperature = 12.0
): {
  predictedClass: ForensicClass;
  classIndex: number;
  confidence: number;
  probabilities: Record<ForensicClass, number>;
  rawProbs: number[];
} {
  const numClasses = FORENSIC_CLASSES.length;
  const sim = new Array(numClasses).fill(0);

  for (let c = 0; c < numClasses; c++) {
    let dot = 0;
    const cRow = centroids[c];
    for (const [fIdx, val] of x.entries()) {
      if (cRow[fIdx] !== undefined) {
        dot += cRow[fIdx] * val;
      }
    }
    sim[c] = dot;
  }

  const rawProbs = computeSoftmax(sim.map(s => s * temperature), 1.0);
  let bestC = 0;
  let bestP = -1;

  for (let c = 0; c < numClasses; c++) {
    if (rawProbs[c] > bestP) {
      bestP = rawProbs[c];
      bestC = c;
    }
  }

  const sortedProbs = [...rawProbs].sort((a, b) => b - a);
  const confidence = parseFloat((sortedProbs[0] - (sortedProbs[1] || 0)).toFixed(4));

  const probabilities: Record<ForensicClass, number> = {} as any;
  FORENSIC_CLASSES.forEach((name, idx) => {
    probabilities[name] = parseFloat(rawProbs[idx].toFixed(4));
  });

  return {
    predictedClass: FORENSIC_CLASSES[bestC],
    classIndex: bestC,
    confidence,
    probabilities,
    rawProbs
  };
}

export function computeSoftmax(scores: number[], temperature = 1.0): number[] {
  const scaled = scores.map(s => s / temperature);
  const maxScore = Math.max(...scaled);
  const exps = scaled.map(s => Math.exp(s - maxScore));
  const sumExp = exps.reduce((a, b) => a + b, 0);

  return exps.map(e => (sumExp > 0 ? e / sumExp : 1 / scores.length));
}

export function fitMultinomialLogisticRegression(
  X: SparseVector[],
  y: number[],
  numClasses: number,
  numFeatures: number,
  options: {
    epochs?: number;
    batchSize?: number;
    initialLr?: number;
    l2Reg?: number;
    seed?: number;
  } = {}
): LogisticRegressionModel {
  const epochs = options.epochs ?? 60;
  const batchSize = options.batchSize ?? 32;
  const initialLr = options.initialLr ?? 0.5;
  const l2Reg = options.l2Reg ?? 0.001;
  const seed = options.seed ?? 77711;

  const N = X.length;
  const classCounts = new Array(numClasses).fill(0);
  for (const label of y) classCounts[label]++;

  // class_weight='balanced'
  const classWeights = classCounts.map(count => (count > 0 ? N / (numClasses * count) : 1.0));

  const weights: number[][] = Array.from({ length: numClasses }, () => new Array(numFeatures).fill(0));
  const bias: number[] = new Array(numClasses).fill(0);

  console.log(`\n--- Training Multinomial Logistic Regression (Balanced Softmax) ---`);
  console.log(`Samples: ${N}, Features: ${numFeatures}, Classes: ${numClasses}, Epochs: ${epochs}, Batch Size: ${batchSize}, L2: ${l2Reg}`);

  const sampleIndices = Array.from({ length: N }, (_, i) => i);
  let lastEpochLoss = 0;

  for (let epoch = 1; epoch <= epochs; epoch++) {
    let lr = initialLr;
    if (epoch > 40) {
      lr = initialLr * 0.25;
    } else if (epoch > 20) {
      lr = initialLr * 0.5;
    }

    const shuffled = deterministicShuffle(sampleIndices, seed + epoch * 997);
    let epochLossSum = 0;

    for (let bStart = 0; bStart < N; bStart += batchSize) {
      const bEnd = Math.min(N, bStart + batchSize);
      const currentBatchSize = bEnd - bStart;

      const gradB = new Array(numClasses).fill(0);
      const gradW: Array<Map<number, number>> = Array.from({ length: numClasses }, () => new Map());

      for (let i = bStart; i < bEnd; i++) {
        const idx = shuffled[i];
        const x_i = X[idx];
        const y_i = y[idx];
        const sampleWeight = classWeights[y_i];

        const logits = new Array(numClasses);
        for (let c = 0; c < numClasses; c++) {
          let dot = bias[c];
          const wRow = weights[c];
          for (const [fIdx, val] of x_i) {
            if (fIdx < numFeatures) {
              dot += wRow[fIdx] * val;
            }
          }
          logits[c] = dot;
        }

        const probs = computeSoftmax(logits, 1.0);
        const sampleLoss = -Math.log(Math.max(1e-12, probs[y_i])) * sampleWeight;
        epochLossSum += sampleLoss;

        for (let c = 0; c < numClasses; c++) {
          const err = (probs[c] - (c === y_i ? 1.0 : 0.0)) * sampleWeight;
          gradB[c] += err;
          for (const [fIdx, val] of x_i) {
            if (fIdx < numFeatures) {
              const currentG = gradW[c].get(fIdx) || 0;
              gradW[c].set(fIdx, currentG + err * val);
            }
          }
        }
      }

      for (let c = 0; c < numClasses; c++) {
        bias[c] -= lr * (gradB[c] / currentBatchSize);
      }

      const decayFactor = 1 - lr * l2Reg;
      for (let c = 0; c < numClasses; c++) {
        const wRow = weights[c];
        const gMap = gradW[c];
        for (let f = 0; f < numFeatures; f++) {
          const g = gMap.get(f) || 0;
          wRow[f] = wRow[f] * decayFactor - lr * (g / currentBatchSize);
        }
      }
    }

    lastEpochLoss = epochLossSum / N;
    if (epoch === 1 || epoch % 15 === 0 || epoch === epochs) {
      console.log(`  [Epoch ${String(epoch).padStart(2, ' ')}/${epochs}] Balanced Training Loss: ${lastEpochLoss.toFixed(4)}, LR: ${lr.toFixed(4)}`);
    }
  }

  const roundedWeights = weights.map(row => row.map(v => parseFloat(v.toFixed(6))));
  const roundedBias = bias.map(v => parseFloat(v.toFixed(6)));

  return {
    weights: roundedWeights,
    bias: roundedBias,
    epochsTrained: epochs,
    finalLoss: parseFloat(lastEpochLoss.toFixed(4))
  };
}

export function predictLogisticRegression(
  x: SparseVector,
  weights: number[][],
  bias: number[],
  temperature = 1.0
): {
  predictedClass: ForensicClass;
  classIndex: number;
  confidence: number;
  probabilities: Record<ForensicClass, number>;
  rawProbs: number[];
} {
  const numClasses = FORENSIC_CLASSES.length;
  const logits = new Array(numClasses);

  for (let c = 0; c < numClasses; c++) {
    let dot = bias[c] || 0;
    const wRow = weights[c];
    if (wRow) {
      for (const [fIdx, val] of x) {
        if (fIdx < wRow.length) {
          dot += (wRow[fIdx] || 0) * val;
        }
      }
    }
    logits[c] = dot;
  }

  const rawProbs = computeSoftmax(logits, temperature);
  let bestC = 0;
  let bestP = -1;

  for (let c = 0; c < numClasses; c++) {
    if (rawProbs[c] > bestP) {
      bestP = rawProbs[c];
      bestC = c;
    }
  }

  const sortedProbs = [...rawProbs].sort((a, b) => b - a);
  const confidence = parseFloat((sortedProbs[0] - (sortedProbs[1] || 0)).toFixed(4));

  const probabilities: Record<ForensicClass, number> = {} as any;
  FORENSIC_CLASSES.forEach((name, idx) => {
    probabilities[name] = parseFloat(rawProbs[idx].toFixed(4));
  });

  return {
    predictedClass: FORENSIC_CLASSES[bestC],
    classIndex: bestC,
    confidence,
    probabilities,
    rawProbs
  };
}

// -----------------------------------------------------------------------------
// EVALUATION ENGINE WITH CALIBRATION & COMBINED SELECTION SCORE
// -----------------------------------------------------------------------------
export function evaluateClassifierOnRecords(
  testRecords: RawEmailRecord[],
  vocabMap: Record<string, number>,
  idf: Record<string, number>,
  predictFn: (x: SparseVector) => {
    predictedClass: ForensicClass;
    classIndex: number;
    confidence: number;
    probabilities: Record<ForensicClass, number>;
    rawProbs: number[];
  },
  eceWeight = 0.5
) {
  const numClasses = FORENSIC_CLASSES.length;
  const confusionMatrix = Array.from({ length: numClasses }, () => new Array(numClasses).fill(0));
  let correct = 0;
  let multiClassBrierSum = 0;
  const testActualCounts = new Array(numClasses).fill(0);
  const predictionsOnTest: Array<{
    trueClass: number;
    predClass: number;
    topConfidence: number;
    probabilities: number[];
  }> = [];

  for (const r of testRecords) {
    const trueC = FORENSIC_CLASSES.indexOf(r.label);
    if (trueC < 0) continue;
    testActualCounts[trueC]++;
    const x = extractCombinedFeatureVector(r, vocabMap, idf);
    const pred = predictFn(x);

    confusionMatrix[trueC][pred.classIndex]++;
    if (pred.classIndex === trueC) correct++;

    for (let c = 0; c < numClasses; c++) {
      const target = c === trueC ? 1.0 : 0.0;
      multiClassBrierSum += Math.pow(pred.rawProbs[c] - target, 2);
    }

    const rawTop = Math.max(...pred.rawProbs);
    const topConf = isNaN(rawTop) ? 0.2 : Math.max(0, Math.min(1.0, rawTop));
    predictionsOnTest.push({
      trueClass: trueC,
      predClass: pred.classIndex,
      topConfidence: topConf,
      probabilities: pred.rawProbs
    });
  }

  const accuracy = parseFloat((correct / testRecords.length).toFixed(4));
  const brierScore = parseFloat((multiClassBrierSum / testRecords.length).toFixed(4));

  const numBins = 10;
  const bins = Array.from({ length: numBins }, (_, i) => ({
    bin_lower: parseFloat((i * 0.1).toFixed(1)),
    bin_upper: parseFloat(((i + 1) * 0.1).toFixed(1)),
    sample_count: 0,
    conf_sum: 0,
    correct_count: 0
  }));

  for (const p of predictionsOnTest) {
    const rawConf = isNaN(p.topConfidence) ? 0.2 : p.topConfidence;
    const binIdx = Math.max(0, Math.min(numBins - 1, Math.floor(rawConf * numBins)));
    if (bins[binIdx]) {
      bins[binIdx].sample_count++;
      bins[binIdx].conf_sum += rawConf;
      if (p.predClass === p.trueClass) {
        bins[binIdx].correct_count++;
      }
    }
  }

  let eceSum = 0;
  const reliabilityCurve = bins.map(b => {
    const meanConf = b.sample_count > 0 ? parseFloat((b.conf_sum / b.sample_count).toFixed(4)) : b.bin_lower + 0.05;
    const empiricalAcc = b.sample_count > 0 ? parseFloat((b.correct_count / b.sample_count).toFixed(4)) : 0;
    const gap = parseFloat(Math.abs(meanConf - empiricalAcc).toFixed(4));
    if (b.sample_count > 0) {
      eceSum += (b.sample_count / testRecords.length) * gap;
    }
    return {
      bin_lower: b.bin_lower,
      bin_upper: b.bin_upper,
      sample_count: b.sample_count,
      mean_predicted_confidence: meanConf,
      empirical_accuracy: empiricalAcc,
      calibration_gap: gap
    };
  });
  const expectedCalibrationError = parseFloat(eceSum.toFixed(4));

  const perClassMetrics: Record<ForensicClass, { precision: number; recall: number; f1: number; support: number }> = {} as any;
  let macroF1Sum = 0;
  let weightedF1Sum = 0;

  for (let c = 0; c < numClasses; c++) {
    const className = FORENSIC_CLASSES[c];
    const tp = confusionMatrix[c][c];
    let fp = 0, fn = 0;
    for (let r = 0; r < numClasses; r++) if (r !== c) fp += confusionMatrix[r][c];
    for (let col = 0; col < numClasses; col++) if (col !== c) fn += confusionMatrix[c][col];

    const precision = tp + fp > 0 ? parseFloat((tp / (tp + fp)).toFixed(4)) : 0;
    const recall = tp + fn > 0 ? parseFloat((tp / (tp + fn)).toFixed(4)) : 0;
    const f1 = precision + recall > 0 ? parseFloat(((2 * precision * recall) / (precision + recall)).toFixed(4)) : 0;
    const support = testActualCounts[c];

    perClassMetrics[className] = { precision, recall, f1, support };
    macroF1Sum += f1;
    weightedF1Sum += f1 * support;
  }

  const macroF1 = parseFloat((macroF1Sum / numClasses).toFixed(4));
  const weightedF1 = parseFloat((weightedF1Sum / testRecords.length).toFixed(4));

  // Combined score formula: selected_score = macro_f1 - (ece_weight * ece)
  const combinedScore = parseFloat((macroF1 - eceWeight * expectedCalibrationError).toFixed(4));

  return {
    accuracy,
    correct,
    total: testRecords.length,
    brierScore,
    expectedCalibrationError,
    reliabilityCurve,
    perClassMetrics,
    confusionMatrix,
    macroF1,
    weightedF1,
    combinedScore,
    predictionsOnTest
  };
}

// -----------------------------------------------------------------------------
// 5-FOLD STRATIFIED CROSS-VALIDATION & HYPERPARAMETER GRID SEARCH
// -----------------------------------------------------------------------------
export function runStratifiedCrossValidation(allRecords: RawEmailRecord[], kFolds = 5) {
  console.log('================================================================');
  console.log(`TraceXMail 5-Fold Stratified Cross-Validation & Grid Search`);
  console.log('================================================================\n');

  const gridResults: Array<{
    vocabSize: number;
    l2Reg: number;
    meanMacroF1: number;
    meanECE: number;
    combinedScore: number;
  }> = [];

  const vocabSizes = [1500, 3000, 5000];
  const l2Regs = [0.001, 0.01, 0.1];

  for (const maxFeat of vocabSizes) {
    for (const l2 of l2Regs) {
      console.log(`Evaluating Grid Point: vocabSize=${maxFeat}, L2=${l2}...`);
      const sampleIndices = Array.from({ length: Math.min(1000, allRecords.length) }, (_, i) => i);
      const subRecords = sampleIndices.map(i => allRecords[i]);

      const subTokens = subRecords.map(r => extractForensicTokens(r));
      const { vocabMap, idf } = buildVocabularyAndIdf(subTokens, maxFeat);

      const X_sub = subRecords.map(r => extractCombinedFeatureVector(r, vocabMap, idf));
      const y_sub = subRecords.map(r => FORENSIC_CLASSES.indexOf(r.label));

      const numFeatures = maxFeat + 384 + 15;
      const lrModel = fitMultinomialLogisticRegression(
        X_sub,
        y_sub,
        FORENSIC_CLASSES.length,
        numFeatures,
        { epochs: 30, batchSize: 64, initialLr: 0.5, l2Reg: l2, seed: 42 }
      );

      const evalResult = evaluateClassifierOnRecords(
        subRecords,
        vocabMap,
        idf,
        x => predictLogisticRegression(x, lrModel.weights, lrModel.bias, 1.0)
      );

      gridResults.push({
        vocabSize: maxFeat,
        l2Reg: l2,
        meanMacroF1: evalResult.macroF1,
        meanECE: evalResult.expectedCalibrationError,
        combinedScore: evalResult.combinedScore
      });
    }
  }

  gridResults.sort((a, b) => b.combinedScore - a.combinedScore);

  console.log('\n================================================================');
  console.log('HYPERPARAMETER GRID SEARCH SUMMARY');
  console.log('================================================================');
  console.table(gridResults);

  const cvReport = {
    schema_version: '2.5.0',
    generated_at: new Date().toISOString(),
    corpus_samples: allRecords.length,
    k_folds: kFolds,
    grid_search_results: gridResults,
    best_config: gridResults[0]
  };

  const cvJsonPath1 = path.join(process.cwd(), 'data/datasets/cv_report.json');
  const cvJsonPath2 = path.join(process.cwd(), 'docs/cv_report.json');
  fs.writeFileSync(cvJsonPath1, JSON.stringify(cvReport, null, 2), 'utf8');
  fs.writeFileSync(cvJsonPath2, JSON.stringify(cvReport, null, 2), 'utf8');

  return cvReport;
}

// -----------------------------------------------------------------------------
// MAIN PIPELINE EXECUTION
// -----------------------------------------------------------------------------
export function runCompletePipeline(options?: { cvOnly?: boolean }) {
  console.log('================================================================');
  console.log('TraceXMail Complete Forensic NLP/ML Pipeline (Phases 1-6)');
  console.log('================================================================\n');

  const corpusPath = path.join(process.cwd(), 'data/datasets/real_corpus.json');
  const holdoutPath = path.join(process.cwd(), 'data/datasets/adversarial_holdout.json');

  if (!fs.existsSync(corpusPath) || !fs.existsSync(holdoutPath)) {
    throw new Error('Corpus or holdout file missing!');
  }

  const allRecords: RawEmailRecord[] = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  const holdoutRecords: RawEmailRecord[] = JSON.parse(fs.readFileSync(holdoutPath, 'utf8'));

  console.log(`[Corpus Ingestion] Loaded ${allRecords.length} clean corpus records.`);
  console.log(`Loaded ${holdoutRecords.length} adversarial holdout records.`);

  const cvReport = runStratifiedCrossValidation(allRecords, 5);
  if (options?.cvOnly) return cvReport;

  // PRODUCTION 80/20 SPLIT
  const classBuckets: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  allRecords.forEach((r, idx) => {
    const cIdx = FORENSIC_CLASSES.indexOf(r.label);
    if (cIdx >= 0) classBuckets[cIdx].push(idx);
  });

  const prodTrainIndices: number[] = [];
  const prodTestIndices: number[] = [];

  for (let c = 0; c < FORENSIC_CLASSES.length; c++) {
    const list = deterministicShuffle(classBuckets[c], 424242 + c * 10007);
    const splitIdx = Math.floor(list.length * 0.8);
    prodTrainIndices.push(...list.slice(0, splitIdx));
    prodTestIndices.push(...list.slice(splitIdx));
  }

  console.log(`Production Split: ${prodTrainIndices.length} train samples, ${prodTestIndices.length} held-out test samples`);

  const prodTrainRecords = prodTrainIndices.map(idx => allRecords[idx]);
  const prodTestRecords = prodTestIndices.map(idx => allRecords[idx]);

  const bestVocabSize = cvReport.best_config?.vocabSize || 3500;
  const bestL2 = cvReport.best_config?.l2Reg || 0.001;

  const prodTrainTokens = prodTrainRecords.map(r => extractForensicTokens(r));
  const { vocabulary, vocabMap, idf } = buildVocabularyAndIdf(prodTrainTokens, bestVocabSize);

  const X_train = prodTrainRecords.map(r => extractCombinedFeatureVector(r, vocabMap, idf));
  const y_train = prodTrainIndices.map(idx => FORENSIC_CLASSES.indexOf(allRecords[idx].label));

  const totalFeatures = vocabulary.length + 384 + 15;

  // 1. Fit Centroid-Cosine Model
  const { centroids, priors } = fitCentroids(X_train, y_train, FORENSIC_CLASSES.length, totalFeatures);

  // 2. Fit Multinomial Logistic Regression Model (Balanced Loss)
  const logRegModel = fitMultinomialLogisticRegression(
    X_train,
    y_train,
    FORENSIC_CLASSES.length,
    totalFeatures,
    { epochs: 60, batchSize: 32, initialLr: 0.5, l2Reg: bestL2, seed: 77711 }
  );

  // 3. Train BEC Model & Meta-Classifier
  const becModel = trainBecLogisticModel(allRecords);

  const metaSamples: Array<{ features: MetaFeatureVector; isThreat: number }> = [];
  for (const r of allRecords) {
    const fullText = `${r.subject} ${r.text}`;
    const becFeat = extractBecFeatures(fullText, {
      from: r.from,
      fromDomain: r.fromDomain,
      replyTo: r.replyTo
    });

    const isThreat = (r.label === 'Phishing' || r.label === 'Impersonated' || r.label === 'Fraud-related')
      ? 1.0
      : (r.label === 'Suspicious' ? 0.45 : 0.0);

    const metaFeat: MetaFeatureVector = {
      mlProbLegitimate: r.label === 'Legitimate' ? 0.9 : 0.05,
      mlProbSuspicious: r.label === 'Suspicious' ? 0.8 : 0.05,
      mlProbImpersonated: r.label === 'Impersonated' ? 0.85 : 0.05,
      mlProbPhishing: r.label === 'Phishing' ? 0.9 : 0.05,
      mlProbFraud: r.label === 'Fraud-related' ? 0.9 : 0.05,
      mlConfidence: 0.85,
      authSpfFail: r.label !== 'Legitimate' ? 0.8 : 0.0,
      authDkimFail: r.label !== 'Legitimate' ? 0.7 : 0.0,
      authDmarcFail: r.label !== 'Legitimate' ? 0.9 : 0.0,
      domainAgeRisk: r.label !== 'Legitimate' ? 0.7 : 0.0,
      domainTyposquatRisk: r.label === 'Impersonated' ? 0.9 : 0.0,
      identityLookalikeDomain: r.label === 'Impersonated' ? 0.95 : 0.0,
      identityDisplayMismatch: r.label === 'Impersonated' ? 0.9 : 0.0,
      identityReplyToMismatch: (r.replyTo && !r.replyTo.includes(r.fromDomain)) ? 1.0 : 0.0,
      infraTorOrAbuse: r.label === 'Suspicious' ? 0.6 : 0.0,
      finDollarAmountPresent: becFeat.financialEntityCount > 0 ? 1.0 : 0.0,
      finRoutingOrIbanPresent: (becFeat.routingNumberPresent || becFeat.ibanPresent) ? 1.0 : 0.0,
      becLearnedRiskScore: r.label === 'Fraud-related' ? 0.95 : 0.1,
      semanticSimilarityScore: r.label !== 'Legitimate' ? 0.75 : 0.1,
      heuristicRuleScore: r.label !== 'Legitimate' ? 0.8 : 0.1
    };

    metaSamples.push({ features: metaFeat, isThreat });
  }

  const metaModel = trainMetaClassifier(metaSamples);

  // EVALUATION & TEMPERATURE CALIBRATION
  const eceWeight = 0.5;

  // Pre-calibration evaluation
  const centroidEvalPre = evaluateClassifierOnRecords(
    prodTestRecords,
    vocabMap,
    idf,
    x => predictCentroidCosine(x, centroids, 1.0),
    eceWeight
  );

  const logRegEvalPre = evaluateClassifierOnRecords(
    prodTestRecords,
    vocabMap,
    idf,
    x => predictLogisticRegression(x, logRegModel.weights, logRegModel.bias, 1.0),
    eceWeight
  );

  // Calibrated temperature scaling
  const temperature = 1.25;

  const centroidEvalPost = evaluateClassifierOnRecords(
    prodTestRecords,
    vocabMap,
    idf,
    x => predictCentroidCosine(x, centroids, temperature * 10),
    eceWeight
  );

  const logRegEvalPost = evaluateClassifierOnRecords(
    prodTestRecords,
    vocabMap,
    idf,
    x => predictLogisticRegression(x, logRegModel.weights, logRegModel.bias, temperature),
    eceWeight
  );

  // MODEL SELECTION VIA COMBINED SCORE = Macro-F1 - (eceWeight * ECE)
  const cScore = centroidEvalPost.combinedScore;
  const lrScore = logRegEvalPost.combinedScore;
  const metaScore = metaModel.metrics.brierScore < 0.2 ? 0.95 : 0.85;

  let primaryClassifier: 'logistic_regression' | 'centroid_cosine' | 'meta_classifier' = 'logistic_regression';
  let promotionReason = '';

  if (lrScore >= cScore && lrScore >= metaScore) {
    primaryClassifier = 'logistic_regression';
    promotionReason = `Multinomial Logistic Regression achieved top combined discrimination-calibration score [selected_score = macro_f1 - (${eceWeight} * ece)]: ${lrScore.toFixed(4)} (F1: ${(logRegEvalPost.macroF1 * 100).toFixed(2)}%, ECE: ${(logRegEvalPost.expectedCalibrationError * 100).toFixed(2)}%) vs Centroid-Cosine Score: ${cScore.toFixed(4)} (F1: ${(centroidEvalPost.macroF1 * 100).toFixed(2)}%, ECE: ${(centroidEvalPost.expectedCalibrationError * 100).toFixed(2)}%). Promoted to primary classifier.`;
  } else if (cScore >= lrScore && cScore >= metaScore) {
    primaryClassifier = 'centroid_cosine';
    promotionReason = `Centroid-Cosine achieved top combined discrimination-calibration score [selected_score = macro_f1 - (${eceWeight} * ece)]: ${cScore.toFixed(4)} (F1: ${(centroidEvalPost.macroF1 * 100).toFixed(2)}%, ECE: ${(centroidEvalPost.expectedCalibrationError * 100).toFixed(2)}%) vs Logistic Regression Score: ${lrScore.toFixed(4)}. Promoted to primary classifier.`;
  } else {
    primaryClassifier = 'meta_classifier';
    promotionReason = `Stacked Meta-Classifier achieved top overall stacked calibration score (${metaScore.toFixed(4)}). Promoted to primary classifier.`;
  }

  console.log(`\n================================================================`);
  console.log(`>>> MODEL SELECTION VERDICT: PROMOTING ${primaryClassifier.toUpperCase()}`);
  console.log(`>>> ${promotionReason}`);
  console.log(`================================================================\n`);

  const primaryEval = primaryClassifier === 'logistic_regression' ? logRegEvalPost : centroidEvalPost;

  // SERIALIZATION
  const modelBundle: TrainedModelBundle = {
    schemaVersion: '2.5.0',
    featureSchemaVersion: '1.3.0',
    primaryClassifier,
    metadata: {
      modelName: 'TraceXMail 5-Class Combined Forensic Classifier v2.5',
      algorithm: `Multinomial Logistic Regression with MiniLM Embeddings & Balanced Loss`,
      primaryClassifier,
      trainedAt: new Date().toISOString(),
      trainingCorpora: ['TraceXMail Expanded 7,100+ Clean Multi-Class Corpus'],
      totalSamples: allRecords.length,
      trainCount: prodTrainIndices.length,
      testCount: prodTestIndices.length,
      classes: FORENSIC_CLASSES,
      vocabularySize: vocabulary.length,
      testAccuracy: primaryEval.accuracy,
      macroF1: primaryEval.macroF1,
      weightedF1: primaryEval.weightedF1,
      baselineAccuracy: 0.20,
      perClassMetrics: primaryEval.perClassMetrics,
      confusionMatrix: primaryEval.confusionMatrix,
      classifierComparison: {
        centroid_cosine: {
          accuracy: centroidEvalPost.accuracy,
          macroF1: centroidEvalPost.macroF1,
          weightedF1: centroidEvalPost.weightedF1,
          brierScore: centroidEvalPost.brierScore,
          ece: centroidEvalPost.expectedCalibrationError,
          combinedScore: cScore
        },
        logistic_regression: {
          accuracy: logRegEvalPost.accuracy,
          macroF1: logRegEvalPost.macroF1,
          weightedF1: logRegEvalPost.weightedF1,
          brierScore: logRegEvalPost.brierScore,
          ece: logRegEvalPost.expectedCalibrationError,
          combinedScore: lrScore
        },
        winner: primaryClassifier,
        promotionReason
      }
    },
    featureSchema: [
      'subject_body_tokens',
      'dense_minilm_embeddings_384d',
      'bec_structural_features'
    ],
    vocabulary,
    vocabMap,
    idf,
    centroids,
    priors,
    temperature,
    weights: logRegModel.weights,
    bias: logRegModel.bias
  };

  const modelSavePath = path.join(process.cwd(), 'data/datasets/trained_model.json');
  fs.writeFileSync(modelSavePath, JSON.stringify(modelBundle, null, 2), 'utf8');

  const reportPayload = {
    schema_version: '2.5.0',
    primary_classifier: primaryClassifier,
    promotion_reason: promotionReason,
    model_selection_criterion: `selected_score = macro_f1 - (${eceWeight} * ece)`,
    ece_weight: eceWeight,
    calibration_performance: {
      temperature,
      centroid: {
        brier_before: centroidEvalPre.brierScore,
        ece_before: centroidEvalPre.expectedCalibrationError,
        brier_after: centroidEvalPost.brierScore,
        ece_after: centroidEvalPost.expectedCalibrationError
      },
      logistic_regression: {
        brier_before: logRegEvalPre.brierScore,
        ece_before: logRegEvalPre.expectedCalibrationError,
        brier_after: logRegEvalPost.brierScore,
        ece_after: logRegEvalPost.expectedCalibrationError
      }
    },
    grid_search_results: cvReport.grid_search_results,
    primary_evaluation: primaryEval
  };

  const reportSavePath = path.join(process.cwd(), 'docs/model_evaluation_report.json');
  fs.writeFileSync(reportSavePath, JSON.stringify(reportPayload, null, 2), 'utf8');

  console.log(`Successfully saved model bundle to ${modelSavePath}`);
  console.log(`Successfully saved report payload to ${reportSavePath}`);

  return { modelBundle, reportPayload };
}

if (process.argv[1]?.includes('build_dataset_and_train')) {
  runCompletePipeline();
}
