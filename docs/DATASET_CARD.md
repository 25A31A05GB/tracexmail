# TraceXMail Dataset Card
**Problem Statement:** Smart India Hackathon 2026 — PS 26106  
**Project:** TraceXMail Forensic Email Intelligence & Threat Classification System  
**Artifacts:** `data/datasets/train_split.json`, `val_split.json`, `test_split.json`, `adversarial_holdout.json`  
**Manifest Hash:** `aae3b5fc872d6c0e21f9e7304cbb9e061dd5edbb6e5dfcd775fbe81b14d69a7a`  
**Standard:** Adheres to Hugging Face / Model Card & Dataset Card Provenance Standard  

---

## 1. Dataset Summary

The TraceXMail Forensic Email Dataset is a group-split, leak-free, multi-class email forensic corpus assembled for automated triage, forensic header analysis, and multi-class threat classification into five distinct categories:
1. **Legitimate** (benign enterprise, developer infrastructure, DevOps, billing, and corporate communication)
2. **Suspicious** (unsolicited commercial outreach, aggressive marketing graymail, cold lead generation, SEO solicitations)
3. **Impersonated** (brand lookalike spoofing, display name deception, identity masquerading across Apple, Microsoft, Google, PayPal, DocuSign, Stripe, etc.)
4. **Phishing** (credential harvesting, MFA exhaustion lures, rogue OAuth consents, fake quarantine release notifications)
5. **Fraud-related** (Business Email Compromise [BEC], executive wire fraud, vendor payment diversion, payroll account rerouting, gift card fraud)

The corpus adheres to strict domain-level group isolation, multi-gram near-duplicate deduplication, zero-leakage test partitioning, deterministic PII anonymization, and manual label audit validation.

---

## 2. Dataset Composition & Verified Split Distributions

All metrics below are generated directly from the clean ingested corpus and verified by `scripts/ml/count_and_verify_splits.ts` (see `reports/dataset_counts_report.json` and `reports/DATASET_COUNTS.md`).

### Split Summary

| Split | Number of Records | Percentage of Clean Corpus | Disjoint Sender Domains | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Clean Train Split** | **2,398** | 68.83% | 54 unique domains | Model training, vocabulary extraction, IDF fitting |
| **Clean Val Split** | **428** | 12.28% | 10 unique domains | Hyperparameter tuning, Platt/Temperature calibration |
| **Clean Test Split** | **658** | 18.89% | 18 unique domains | Single frozen out-of-distribution benchmark evaluation |
| **Clean Subtotal** | **3,484** | 100.0% | 72 unique domains | Combined clean benchmark dataset |
| **Adversarial Holdout** | **60** | Isolated | Dedicated adversarial | Zero-day homoglyphs, quishing, evasion test (Untouched) |
| **Total Artifact Records** | **3,544** | — | — | Full forensic repository |

### Per-Class Support Across Splits & Test Reliability

Target requirements: Total records $\ge 2,000$; Per-class total $\ge 200$; Test set per-class support $\ge 100$ for `'TRUSTED'` status (metrics for any class $< 100$ marked `'too small to trust'`).

| Class | Train | Val | Test | Total Clean | % of Dataset | Test Support | Test Metric Reliability |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Legitimate** | 530 | 90 | 138 | **758** | 21.76% | 138 | **TRUSTED (>= 100)** |
| **Suspicious** | 495 | 90 | 135 | **720** | 20.67% | 135 | **TRUSTED (>= 100)** |
| **Impersonated** | 495 | 90 | 135 | **720** | 20.67% | 135 | **TRUSTED (>= 100)** |
| **Phishing** | 473 | 90 | 135 | **698** | 20.03% | 135 | **TRUSTED (>= 100)** |
| **Fraud-related** | 405 | 68 | 115 | **588** | 16.88% | 115 | **TRUSTED (>= 100)** |
| **TOTAL** | **2,398** | **428** | **658** | **3,484** | **100.0%** | **658** | **ALL CLASSES TRUSTED** |

---

## 3. Data Hygiene & Safeguard Verification

### A. Group Disjointness & Leakage Safeguards
- **Group Key**: Primary sender domain (`fromDomain`).
- **Domain Overlap Across Splits**: Exactly **0 overlapping domains** between train, val, and test. All 72 unique sender domains are strictly assigned to a single split.
- **Near-Duplicate Leakage Ceiling**: Pairs across splits must not exceed a multigram Jaccard similarity threshold of $0.80$.
- **Measured Maximum Cross-Split Similarity**: **24.58%** (well below the 80% ceiling). Leaking cross-split pairs: **0**.
- **Out-of-Distribution Generalization**: Testing on completely unseen sender domains simulates real-world email gateway behavior when encountering brand-new attacker domains or newly provisioned customer domains.

### B. Exact & Near-Duplicate Deduplication
- **Exact Duplicate Deduplication**: SHA-256 digest on normalized subject and body text.
- **Near-Duplicate Deduplication**: Multigram shingle Jaccard clustering with threshold $J \ge 0.85$.
- **Corpus Dedup Results**: Out of 3,690 raw candidate records, 206 near-duplicate and repetitive variants were pruned, retaining 3,484 pristine, distinct records (5.58% intra-class duplication pruned).

### C. PII Sanitization & Anonymization Audit
- Implemented in `scripts/ml/pii_sanitizer.ts` and audited in `reports/pii_sanitization_report.json`.
- **Email Local-Part Hashing**: Individual user email mailboxes are deterministically hashed using SHA-256: `user@domain.com` $\to$ `usr_<hash8>@domain.com`. The sender domain is preserved because forensic identity evaluation requires domain intelligence.
- **Role Account Preservation**: Standard RFC / SOC role mailboxes (`security@`, `admin@`, `support@`, `billing@`, `compliance@`, `abuse@`) are preserved as they carry operational forensic signals.
- **Enterprise Brand Display Preservation**: Authentic or impersonated brand display names (e.g. `Microsoft 365 Security`, `Amazon Web Services`, `DocuSign Signing Service`) are preserved to evaluate display name spoofing and brand impersonation.
- **Personal Name Redaction**: Individual personal human names in email bodies or greetings are redacted to `[NAME_REDACTED]`.
- **Phone & Financial Data Masking**: Phone numbers and private bank routing sequences are redacted to `[PHONE_REDACTED]` or normalized payment coordinates.

### D. Manual Label Audit & Correction Pipeline
- Generated via `scripts/ml/label_audit.ts` into `reports/label_audit.csv` and summarized in `reports/label_audit_summary.json`.
- **Sampled Set**: Exactly **30 records per class** across all 5 classes (**150 records total**) spanning train (100), val (20), and test (30).
- **RFC-4180 CSV**: Provides formatted human-review columns (`current_label`, `reviewed_label`, `confidence_review`, `reviewer_notes`, `text_snippet`).
- **Correction Application**: Executed via `scripts/ml/apply_label_corrections.ts`. Validates labels against the permitted 5-class taxonomy, updates split JSON files in-place, logs an audit trail in `data/datasets/reviewed_corrections.json`, and verifies the adversarial holdout remains untouched.

### E. Adversarial Holdout Preservation
- File: `data/datasets/adversarial_holdout.json` (60 isolated records containing zero-day homoglyphs, Cyrillic lookalikes, QR quishing lures, and prompt-injection adversarial evasions).
- **Cryptographic Hash**: `b84eedb23b112c81092ada551ad33c8690a7a0a3780d82f8bee7408883e104ac`.
- Verified strictly untouched before and after all ingestion, deduplication, splitting, and correction routines.

---

## 4. Provenance & Data Sources

All ingested corpora are formally registered with verified open-source licenses in `docs/ml/data-sources.md`. Ingestion strictly enforces license approval and refuses unlisted files.

### Source 1: TraceXMail Curated Multi-Class Baseline
- **Corpus ID**: `tracexmail_curated`
- **License**: MIT License
- **File**: `data/raw_corpora/tracexmail_curated.json`
- **Total Clean Records**: 3,484
- **Coverage**:
  - `Legitimate`: Authentic AWS, GCP, GitHub, GitLab, Stripe, Datadog, Slack, Jira, and enterprise communications.
  - `Suspicious`: Unsolicited mass outbound, aggressive B2B sales leads, SEO marketing, crypto webinars, and talent agency graymail.
  - `Impersonated`: High-fidelity brand lookalike attacks against Microsoft, Google, Apple, PayPal, DocuSign, Stripe, Zoom, and Wells Fargo.
  - `Phishing`: Real-world credential harvest lures, SSO re-authentication traps, malicious document notices, quishing alerts, and customs holds.
  - `Fraud-related`: IC3 BEC scenarios including executive wire instructions, payroll direct deposit alterations, vendor invoice routing alterations, and legal escrow diversion.

### Source 2: Apache SpamAssassin Public Ham Corpus
- **Corpus ID**: `spamassassin_ham`
- **License**: Apache License 2.0
- **Reference**: https://spamassassin.apache.org/old/publiccorpus/
- **Status**: Approved in `docs/ml/data-sources.md`

### Source 3: Dr. Jose Nazario Phishing Collection
- **Corpus ID**: `nazario_phishing`
- **License**: Open Research Security Archive License
- **Reference**: https://monkey.org/~jose/phishing/
- **Status**: Approved in `docs/ml/data-sources.md`

---

## 5. Benchmark Performance on Clean Test Split

Evaluated on the single frozen Clean Test split (**658 records**, 18 unseen domains):

| Model | Accuracy | Macro F1 | Weighted F1 | 95% Bootstrap CI | Brier Score | ECE | FPR @ 95% Recall |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Majority Class Baseline** | 21.0% | **0.069** | 0.073 | [0.055, 0.088] | 0.790 | 0.790 | 100.0% |
| **TF-IDF + Logistic Regression** | 72.5% | **0.710** | 0.718 | [0.672, 0.748] | 0.497 | 0.497 | 4.8% |
| **TF-IDF + Calibrated Linear SVM** | 72.5% | **0.710** | 0.718 | [0.671, 0.749] | 0.483 | 0.483 | 4.8% |
| **TF-IDF + Structural/Header + Gradient Boosting** | 69.2% | **0.681** | 0.685 | [0.640, 0.722] | 0.385 | 0.385 | 4.8% |
| **TraceXMail Layered Forensics** | 34.6% | **0.238** | 0.315 | [0.198, 0.280] | 0.298 | 0.298 | 4.8% |

---

## 6. How to Reproduce Dataset & Benchmarks

```bash
# 1. Ingest corpora with strict license checks and deterministic PII anonymization
npx tsx scripts/ml/ingest_public_corpora.ts

# 2. Exact & near-duplicate deduplication with group domain splitting
npx tsx scripts/ml/deduplicate_and_split.ts

# 3. Verify counts, per-class support, and test reliability thresholds
npx tsx scripts/ml/count_and_verify_splits.ts

# 4. Generate label audit sample (30 per class) and apply manual corrections
npx tsx scripts/ml/label_audit.ts
npx tsx scripts/ml/apply_label_corrections.ts

# 5. Run the empirical benchmark suite
npx tsx scripts/ml/benchmark.ts
```
