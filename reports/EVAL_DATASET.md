# TraceXMail Evaluation Dataset Build Report (Item 1)
**Generated:** 2026-10-30T21:07:48.911Z  
**Status:** PASSED (VERIFIED)  
**Adversarial Holdout Integrity:** UNTOUCHED (Verified SHA-256)  
**SHA-256 Checksum:** `9752514ef29a99aeb5dba67dda84027c10584f241474476fb6b6451b2526843c`

---

## 1. Split Distribution Summary

| Split | Records | Distinct Domains | Role | Training Allowed |
|---|---|---|---|---|
| **Train** | **3077** | 14 | Model training & cross-validation | **YES** |
| **Validation** | **560** | 5 | Hyperparameter tuning & calibration | **NO** |
| **Test** | **763** | 7 | Final unbiased holdout benchmark | **STRICTLY FORBIDDEN** |
| **Total Clean** | **4400** | 26 | Complete verified corpus | - |

---

## 2. Per-Class Stratification

| Forensic Class | Total Records | Train Split | Validation Split | Test Split | Meets Targets? |
|---|---|---|---|---|---|
| **Legitimate** | 1500 | 1050 | 190 | 260 | ✓ (>= 200 total, >= 100 test) |
| **Phishing** | 800 | 560 | 100 | 140 | ✓ (>= 200 total, >= 100 test) |
| **Impersonated** | 700 | 489 | 90 | 121 | ✓ (>= 200 total, >= 100 test) |
| **Fraud-related** | 700 | 489 | 90 | 121 | ✓ (>= 200 total, >= 100 test) |
| **Suspicious** | 700 | 489 | 90 | 121 | ✓ (>= 200 total, >= 100 test) |

---

## 3. Invariant Verification

- **Domain Group Disjointness:** PASSED (0 overlapping sender domains)
- **Test Set Isolation:** PASSED (Zero test records in training sets)
- **Minimum Total Records (>= 2,000):** PASSED (4400 records)
- **Minimum Per-Class Records (>= 200):** PASSED
- **Adversarial Holdout:** PASSED (File preserved bit-for-bit)
