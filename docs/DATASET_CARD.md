# Dataset Card: TraceXMail Clean Forensic Evaluation Corpus

**Manifest Version**: 2.0.0  
**Dataset SHA-256 Digest**: `e8d9444ca7f4caa6ab9f0dec84dd05077ebf0bfd19822edc8b1e268e50d23d29`  
**Generated At**: 2026-10-20T07:11:14.977Z  
**Random Seed**: 42  

## 1. Summary & Objective
This dataset serves as the standardized, leak-free benchmark corpus for the TraceXMail email threat classification engine. It provides stratified splits across five operational forensic classes: **Legitimate**, **Suspicious**, **Impersonated**, **Phishing**, and **Fraud-related (BEC)**.

## 2. Dataset Composition & Split Disjointness

| Split | Count | Ratio | Dominant Groups | Cross-Split Leakage |
| :--- | :--- | :--- | :--- | :--- |
| **Train** | 245 | 70% | 104 sender groups | 0 |
| **Validation** | 49 | 15% | 22 sender groups | 0 |
| **Test** | 59 | 15% | 21 sender groups | 0 |
| **Total Clean** | **353** | **100%** | **147 sender groups** | **Verified Disjoint** |

## 3. Class Balance Across Splits

| Class | Train | Val | Test | Total Clean | Real Share | Synthetic Share |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Legitimate** | 125 | 27 | 27 | 179 | 76.5% | 23.5% |
| **Suspicious** | 18 | 4 | 4 | 26 | 0.0% | 100.0% |
| **Impersonated** | 55 | 11 | 13 | 79 | 0.0% | 100.0% |
| **Phishing** | 16 | 3 | 4 | 23 | 56.5% | 43.5% |
| **Fraud-related** | 31 | 4 | 11 | 46 | 0.0% | 100.0% |

## 4. Provenance & Provenance Verification
- **Real Corpus**: 42.5% (150 records) derived from authentic enterprise mailflows, open developer repositories (GitHub, GitLab, Docker, Snyk), and the Nazario malware corpus.
- **Curated Synthetic**: 57.5% (203 records) constructed by certified SOC analysts to represent modern multi-vector adversary campaigns (QR-code quishing, executive gift card fraud, thread hijacking, OAuth consent abuse).
- **Template-Generated**: 0.0% (0 records).

## 5. Deduplication & Leakage Controls
- **Exact Deduplication**: 0 duplicates removed via normalized lowercase SHA-256 body digests.
- **Near-Duplicate Filtering**: 0 records removed using word 5-shingle MinHash / Jaccard similarity (> 0.85).
- **Stratified Group Splitting**: All records from any given sender domain or campaign cluster are strictly assigned to either Train, Val, or Test. No domain or campaign crosses splits.
- **Adversarial Holdout Exemption**: The `data/datasets/adversarial_holdout.json` set (60 records) is **strictly isolated** and has never been seen by training, hyperparameter tuning, or threshold selection algorithms.

## 6. Known Biases & Limitations
1. **Historical Era Bias**: Samples originating from legacy malware archives (e.g., Nazario) exhibit older header standards and obsolete phishing tropes compared to modern cloud SaaS lures.
2. **Language Distribution**: The primary corpus is heavily English-dominated (98%+), with limited representation of non-Latin multilingual email encodings.
3. **Synthetic Proportion in Fraud & BEC**: Due to the proprietary and legally sensitive nature of real corporate wire-fraud correspondence, BEC records are largely curated realistic simulations.
