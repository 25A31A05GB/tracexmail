# TraceXMail Machine Learning Dataset Counts & Reliability Audit

**Generated At:** 2026-10-28T19:54:41.340Z  
**Total Usable Clean Records:** **3,484**  
**Adversarial Holdout:** **60** samples (SHA-256: `b84eedb23b112c81092ada551ad33c8690a7a0a3780d82f8bee7408883e104ac`)  

---

## 1. Compliance Against Target Requirements

| Requirement | Target Threshold | Actual Result | Compliance Status |
| :--- | :--- | :--- | :--- |
| **Total Dataset Size** | $\ge 2,000$ records | **3,484 records** | ✅ **MET** |
| **Per-Class Total Support** | $\ge 200$ records / class | **588** min class support | ✅ **MET** |
| **Test Set Reliability** | $\ge 100$ test records / class | **115** min test class support | ✅ **ALL TRUSTED** |

> ✅ **ALL CLASSES TRUSTED:** Every forensic class strictly meets or exceeds the 100 test records threshold. Test metrics are statistically reliable.

---

## 2. Per-Class Counts Across Splits & Reliability Status

| Class | Train (70%) | Val (15%) | Test (15%) | Total Support | % of Total | Test Count | Reliability Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Legitimate** | 530 | 90 | 138 | **758** | 21.76% | 138 | ✅ `TRUSTED` |
| **Suspicious** | 495 | 90 | 135 | **720** | 20.67% | 135 | ✅ `TRUSTED` |
| **Impersonated** | 495 | 90 | 135 | **720** | 20.67% | 135 | ✅ `TRUSTED` |
| **Phishing** | 473 | 90 | 135 | **698** | 20.03% | 135 | ✅ `TRUSTED` |
| **Fraud-related** | 405 | 68 | 115 | **588** | 16.88% | 115 | ✅ `TRUSTED` |
| **TOTAL** | **2398** | **428** | **658** | **3484** | **100.0%** | **658** | **ALL AUDITED** |

---

## 3. Split Partitioning & Domain Disjointness

| Split | Record Count | Percent | Sender Domains | Domain Disjointness |
| :--- | :--- | :--- | :--- | :--- |
| **Train** | 2398 | 68.83% | 54 unique domains | Verified Disjoint |
| **Validation** | 428 | 12.28% | 10 unique domains | Verified Disjoint |
| **Test** | 658 | 18.89% | 18 unique domains | Verified Disjoint |
| **Adversarial Holdout** | 60 | Standalone | Zero-Leakage Isolated | Unchanged Baseline |

---

## 4. Per-Source Counts

| Data Source | Train | Val | Test | Total Records |
| :--- | :--- | :--- | :--- | :--- |
| `TraceXMail Curated Developer Baseline` | 45 | 45 | 69 | **159** |
| `TraceXMail Curated Cloud Baseline` | 135 | 0 | 0 | **135** |
| `TraceXMail Cloud Phishing Corpus` | 90 | 0 | 45 | **135** |
| `TraceXMail Curated Operations Baseline` | 90 | 0 | 0 | **90** |
| `TraceXMail Curated SRE Baseline` | 90 | 0 | 0 | **90** |
| `TraceXMail Suspicious SEO Marketing` | 0 | 45 | 45 | **90** |
| `TraceXMail Curated Network Baseline` | 45 | 0 | 0 | **45** |
| `TraceXMail Curated Enterprise Baseline` | 45 | 0 | 0 | **45** |
| `TraceXMail Curated Finance Baseline` | 45 | 0 | 0 | **45** |
| `TraceXMail Suspicious Trademark Graymail` | 45 | 0 | 0 | **45** |
| `TraceXMail Suspicious Lead Generation` | 45 | 0 | 0 | **45** |
| `TraceXMail Suspicious Real Estate Outreach` | 45 | 0 | 0 | **45** |
| `TraceXMail Suspicious FinOps Cold Outreach` | 45 | 0 | 0 | **45** |
| `TraceXMail Suspicious Webinar Outreach` | 45 | 0 | 0 | **45** |
| `TraceXMail Suspicious Collections Outreach` | 45 | 0 | 0 | **45** |
| `TraceXMail Suspicious Merch Marketing` | 45 | 0 | 0 | **45** |
| `TraceXMail Suspicious Crypto Graymail` | 45 | 0 | 0 | **45** |
| `TraceXMail Suspicious AI Marketing` | 45 | 0 | 0 | **45** |
| `TraceXMail Suspicious Executive Recruitment` | 45 | 0 | 0 | **45** |
| `TraceXMail Suspicious Cold Outreach` | 45 | 0 | 0 | **45** |
| `TraceXMail Brand Lookalike Impersonation (Apple)` | 45 | 0 | 0 | **45** |
| `TraceXMail Brand Lookalike Impersonation (Atlassian)` | 45 | 0 | 0 | **45** |
| `TraceXMail Brand Lookalike Impersonation (Bank of America)` | 45 | 0 | 0 | **45** |
| `TraceXMail Brand Lookalike Impersonation (Chase)` | 45 | 0 | 0 | **45** |
| `TraceXMail Brand Lookalike Impersonation (CrowdStrike)` | 45 | 0 | 0 | **45** |
| `TraceXMail Brand Lookalike Impersonation (DocuSign)` | 45 | 0 | 0 | **45** |
| `TraceXMail Brand Lookalike Impersonation (Dropbox)` | 45 | 0 | 0 | **45** |
| `TraceXMail Brand Lookalike Impersonation (GitHub)` | 45 | 0 | 0 | **45** |
| `TraceXMail Brand Lookalike Impersonation (Google)` | 45 | 0 | 0 | **45** |
| `TraceXMail Brand Lookalike Impersonation (Microsoft)` | 45 | 0 | 0 | **45** |
| `TraceXMail Brand Lookalike Impersonation (Okta)` | 45 | 0 | 0 | **45** |
| `TraceXMail Credential Harvest Phishing Corpus` | 45 | 0 | 0 | **45** |
| `TraceXMail Customs Phishing Corpus` | 45 | 0 | 0 | **45** |
| `TraceXMail Compliance Phishing Corpus` | 45 | 0 | 0 | **45** |
| `TraceXMail HR Survey Phishing Corpus` | 45 | 0 | 0 | **45** |
| `TraceXMail MFA Harvesting Phishing Corpus` | 45 | 0 | 0 | **45** |
| `TraceXMail Rogue OAuth Phishing Corpus` | 45 | 0 | 0 | **45** |
| `TraceXMail Postal Phishing Corpus` | 45 | 0 | 0 | **45** |
| `TraceXMail Quishing Phishing Corpus` | 45 | 0 | 0 | **45** |
| `TraceXMail Vendor Remittance Alteration Corpus` | 45 | 0 | 0 | **45** |
| `TraceXMail BEC Accounts Payable Corpus` | 45 | 0 | 0 | **45** |
| `TraceXMail Subcontractor Payroll Corpus` | 45 | 0 | 0 | **45** |
| `TraceXMail Settlement Escrow Corpus` | 45 | 0 | 0 | **45** |
| `TraceXMail Executive Wire Corpus` | 45 | 0 | 0 | **45** |
| `TraceXMail Treasury Wire Corpus` | 45 | 0 | 0 | **45** |
| `TraceXMail International Wire Fraud Corpus` | 45 | 0 | 0 | **45** |
| `TraceXMail Supplier Remittance Corpus` | 45 | 0 | 0 | **45** |
| `TraceXMail Treasury Clearing Corpus` | 45 | 0 | 0 | **45** |
| `TraceXMail Curated HR Baseline` | 0 | 45 | 0 | **45** |
| `TraceXMail Suspicious Financial Outreach` | 0 | 45 | 0 | **45** |
| `TraceXMail Brand Lookalike Impersonation (PayPal)` | 0 | 45 | 0 | **45** |
| `TraceXMail Brand Lookalike Impersonation (Slack)` | 0 | 45 | 0 | **45** |
| `TraceXMail Document Phishing Corpus` | 0 | 45 | 0 | **45** |
| `TraceXMail Security Trap Phishing Corpus` | 0 | 45 | 0 | **45** |
| `TraceXMail Vendor Routing Corpus` | 0 | 45 | 0 | **45** |
| `TraceXMail Curated Communications Baseline` | 0 | 0 | 45 | **45** |
| `TraceXMail Suspicious Recruiting Outreach` | 0 | 0 | 45 | **45** |
| `TraceXMail Suspicious Scraping Outreach` | 0 | 0 | 45 | **45** |
| `TraceXMail Brand Lookalike Impersonation (Stripe)` | 0 | 0 | 45 | **45** |
| `TraceXMail Brand Lookalike Impersonation (Wells Fargo)` | 0 | 0 | 45 | **45** |
| `TraceXMail Brand Lookalike Impersonation (Zoom)` | 0 | 0 | 45 | **45** |
| `TraceXMail SSO Phishing Corpus` | 0 | 0 | 45 | **45** |
| `TraceXMail Audio Phishing Corpus` | 0 | 0 | 45 | **45** |
| `TraceXMail Curated Product Baseline` | 35 | 0 | 0 | **35** |
| `TraceXMail Curated DevOps Baseline` | 0 | 0 | 24 | **24** |
| `TraceXMail Delivery Hold Phishing Corpus` | 23 | 0 | 0 | **23** |
| `TraceXMail Legal Escrow Wire Corpus` | 0 | 23 | 0 | **23** |
| `TraceXMail Commercial Wire Corpus` | 0 | 0 | 23 | **23** |
| `TraceXMail BEC Executive Wire Corpus` | 0 | 0 | 23 | **23** |
| `TraceXMail Executive Gift Card Corpus` | 0 | 0 | 23 | **23** |
| `TraceXMail Payroll Rerouting Corpus` | 0 | 0 | 23 | **23** |
| `TraceXMail Supplier Invoice Fraud Corpus` | 0 | 0 | 23 | **23** |

---

## 5. Per-Corpus Counts & Provenance

| Corpus Identifier | Train | Val | Test | Total | License Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `tracexmail_curated` | 2398 | 428 | 658 | **3484** | Approved (MIT License) |
