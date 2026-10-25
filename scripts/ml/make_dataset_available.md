# Reproducing the TraceXMail Clean Evaluation Dataset

This document details the deterministic protocol to generate or regenerate the clean, leak-free evaluation dataset partitions for TraceXMail.

## 1. Quick Reproduction

To generate the partitions from source:
```bash
npm run data:build
```
Or directly:
```bash
npx tsx scripts/ml/build_eval_dataset.ts
```

This populates `data/datasets/clean/`:
- `train.jsonl` (245 records, 70% split)
- `val.jsonl` (49 records, 14% split)
- `test.jsonl` (59 records, 16% split)
- `MANIFEST.json` (Dataset manifest with hash `e8d9444ca7f4caa6ab9f0dec84dd05077ebf0bfd19822edc8b1e268e50d23d29`)

## 2. Leakage Controls & Splitting Methodology

- **Domain Isolation**: Group-split on `sender_domain`. Train, validation, and test sets do not share sending domains.
- **Deduplication**: 5-shingle MinHash deduplication ($J > 0.85$) filters near-duplicate phishing and marketing templates across splits.
- **Class Distribution in Held-Out Test Set (59 Records)**:
  - Legitimate: 27
  - Suspicious: 4
  - Impersonated: 13
  - Phishing: 4
  - Fraud-related: 11

## 3. Evaluation Split Isolation

The frozen test split `data/datasets/clean/test.jsonl` must never be used for vocabulary selection, centroid initialization, or hyperparameter tuning. Model thresholds and temperature scaling parameters are strictly tuned on `data/datasets/clean/val.jsonl`.
