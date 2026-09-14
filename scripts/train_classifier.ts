/**
 * TraceXMail Model Training Entrypoint
 * Re-exports and runs the canonical training pipeline from build_dataset_and_train.ts
 */

import { trainAndEvaluatePipeline } from './build_dataset_and_train';

export function trainHighAccuracyModel() {
  return trainAndEvaluatePipeline();
}

if (process.argv[1]?.includes('train_classifier')) {
  trainHighAccuracyModel();
}
