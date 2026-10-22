# TraceXMail Clean Evaluation Dataset & Reproducibility Guide

This document describes how to reproduce, regenerate, and verify the clean, leak-free evaluation benchmark dataset for TraceXMail.

---

## 1. Dataset Architecture & Split Summary

| Partition | Split Ratio | Sample Count | Sender Domain Isolation | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`train.jsonl`** | 70% | **245** | Group-isolated | Feature extraction, vocabulary fitting, classifier training |
| **`val.jsonl`** | 14% | **49** | Group-isolated | Hyperparameter tuning, Temperature Scaling calibration ($T$) |
| **`test.jsonl`** | 16% | **59** | Strict Out-of-Distribution | Frozen empirical benchmark (evaluated exactly once) |
| **Total Clean Corpus** | 100% | **353** | Full domain partition | Manifest Hash: `e8d9444ca7f4caa6ab9f0dec84dd05077ebf0bfd19822edc8b1e268e50d23d29` |
| **`adversarial_holdout.json`** | Held-Out | **20** | Out-of-Distribution | Stress testing (homoglyphs, zero-width chars, base64 obfuscation) |

---

## 2. Multi-Class Label Taxonomy (5 Forensic Classes)

1. **`Legitimate`**: Legitimate enterprise correspondence, transactional receipts, calendar invites, SaaS operational digests.
2. **`Suspicious`**: Unsolicited high-pressure marketing, graymail, generic security warnings without authentic sender binding.
3. **`Impersonated`**: Display-name deception, brand lookalikes (Microsoft, Wells Fargo, Geek Squad, ADP), typosquatting domains.
4. **`Phishing`**: Credential harvesting lures, fake authentication gates, password expiration traps, malicious token grabbers.
5. **`Fraud-related`**: Business Email Compromise (BEC), CEO wire transfer redirection, fake vendor invoice remittance, ACH rerouting.

---

## 3. De-Duplication & Anti-Leakage Protocol

To ensure rigorous scientific validity without inflated cross-split memorization:
1. **5-Shingle MinHash Deduplication**: Exact duplicate bodies and near-duplicate templates ($Jaccard > 0.85$) are collapsed prior to partitioning.
2. **Domain-Group Stratification**: Splitting is performed by grouping on `sender_domain`. A sender domain observed in `test.jsonl` never appears in `train.jsonl` or `val.jsonl`.
3. **Fixed Deterministic PRNG Seed**: All pseudo-random sampling uses fixed seed `42` (`evaluation_seed: 42`).

---

## 4. How to Generate or Regenerate `data/datasets/clean`

To rebuild the dataset files locally:

```bash
# 1. Build and deduplicate the raw corpora into data/datasets/clean
bun scripts/build_dataset_and_train.ts

# 2. Run the empirical benchmark suite against clean/test.jsonl
bun scripts/ml/benchmark.ts

# 3. Synchronize verified benchmark numbers across all project documentation
bun scripts/fill_resume_numbers.ts
```

---

## 5. File Formats & Schema

Each line in `train.jsonl`, `val.jsonl`, and `test.jsonl` is formatted as a single JSON object:

```json
{
  "id": "clean_test_042",
  "source": "curated_bec",
  "label": "Fraud-related",
  "sender_domain": "accounts-payable-corp.net",
  "subject": "Urgent: Revised Wire Instructions for Vendor Invoice #8819",
  "body": "Please find attached updated banking coordinates for today's remittance...",
  "headers": {
    "spf": "softfail",
    "dkim": "none",
    "dmarc": "fail"
  },
  "reply_to": "cfo-direct@financial-wire.cc"
}
```
