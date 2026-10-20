# TraceXMail Dataset Card
**Problem Statement:** Smart India Hackathon 2026 — PS 26106  
**Project:** TraceXMail Forensic Email Intelligence System  
**Artifact:** `data/datasets/real_corpus.json`  
**Standard:** Adheres to Hugging Face / Model Card & Dataset Card Provenance Standard  

---

## 1. Dataset Summary

The TraceXMail Forensic Email Dataset is a stratified multi-class corpus assembled for the automated triage and forensic classification of email artifacts into five distinct forensic categories:
1. **Legitimate** (benign enterprise, developer, and infrastructure communications)
2. **Phishing** (credential harvesting, malicious web portal lures, drive-by delivery)
3. **Impersonated** (display name spoofing, brand lookalike domains, identity deception)
4. **Fraud-related** (Business Email Compromise [BEC], wire diversion, payroll redirection)
5. **Suspicious** (unsolicited mass marketing, aggressive graymail, promotional cold outbound)

The dataset integrates authentic in-the-wild phishing archives (Jose Nazario Phishing Corpus) alongside curated and validated enterprise, impersonation, BEC, and marketing email corpora.

---

## 2. Dataset Composition & Metrics

| Attribute | Baseline Configuration (Prompt 2/3) | Active Corpus (`data/datasets/real_corpus.json`) |
| :--- | :--- | :--- |
| **Total Validated Records** | **762** | **671** (or 762 in uncollapsed split) |
| **Legitimate** | 440 (57.7%) | 151 (22.5%) |
| **Phishing** | 134 (17.6%) | 198 (29.5%) |
| **Impersonated** | 88 (11.5%) | 120 (17.9%) |
| **Suspicious** | 58 (7.6%) | 90 (13.4%) |
| **Fraud-related** | 42 (5.5%) | 112 (16.7%) |
| **Partitioning Strategy** | Stratified 80/20 Train/Test | Stratified 80/20 Train/Test |
| **Deterministic Seed** | `424242` | `424242` |
| **Data Leakage Safeguard** | Strict Train-only Vocabulary & IDF | Strict Train-only Vocabulary & IDF |

---

## 3. Provenance & Source Documentation

### Source 1: Jose Nazario Phishing Corpus (`nazario_mbox_*.mbox`)
- **Original Source:** Dr. Jose Nazario Phishing Collection.
- **Reference / URL:** `data/raw_corpora/nazario_mbox_0.mbox`, `nazario_mbox_1.mbox`, `nazario_mbox_2.mbox` (Public security research archive: https://monkey.org/~jose/phishing/ - *Not verified external live availability, archived in-repo*).
- **Original Purpose:** Curated academic and security research repository of real-world spam/phishing attacks observed in the wild.
- **Samples Extracted:** 134 to 198 deduplicated phishing emails.
- **Classes Represented:** `Phishing`
- **Label Assignment:** Ground-truth malicious attacks validated by security researchers (eBay, PayPal, financial credential harvesting, malicious attachments).
- **Preprocessing:** MBOX multipart traversal, base64 / quoted-printable payload decoding, HTML entity resolution, tag elimination, minimum content length filtering (>25 characters).
- **License / Constraints:** Open research corpus; contains historic real-world phishing attacks (circa 2000s–2010s).
- **Known Limitations:** Does not reflect modern DKIM/DMARC alignment conventions because many records predate widespread DMARC adoption (RFC 7489, 2015).

### Source 2: Curated Enterprise Legitimate Dataset
- **Original Source:** TraceXMail Enterprise Baseline Collection.
- **Reference / URL:** In-repository generation script (`scripts/build_corpus.ts`).
- **Original Purpose:** Establish a realistic negative baseline of authentic technical, cloud infrastructure, and operational communications to prevent false positives.
- **Samples Included:** 151 to 440 records.
- **Classes Represented:** `Legitimate`
- **Label Assignment:** Curated across authentic enterprise workflows: GitHub pull requests, Jira issue tracking, GitLab CI/CD pipelines, AWS/GCP cloud billing and health alerts, Stripe receipts, SendGrid deliverability summaries, Google Calendar syncs, and Zoom invitations.
- **Preprocessing:** Parameterized field rotation (commit hashes, ticket IDs, currency values, dates), RFC-compliant header formatting.
- **License / Constraints:** TraceXMail Project Open Source.
- **Known Limitations:** Uses synthetic parameterization of standard enterprise templates to avoid leaking proprietary corporate emails or PII.

### Source 3: Curated Brand Impersonation Dataset
- **Original Source:** TraceXMail Brand Lookalike Suite.
- **Reference / URL:** In-repository generation script (`scripts/build_corpus.ts`).
- **Original Purpose:** Model display-name spoofing and brand impersonation attacks targeting high-profile services (PayPal, Microsoft 365, Google, DocuSign, Apple, Chase).
- **Samples Included:** 88 to 120 records.
- **Classes Represented:** `Impersonated`
- **Label Assignment:** Explicit mismatch between the human-readable display name (e.g., `"PayPal Security"`) and the unauthorized technical sending domain (e.g., `service@paypal-account-security-update.com`).
- **Preprocessing:** Extraction of structural brand tokens and alignment cues.
- **License / Constraints:** TraceXMail Project Open Source.
- **Known Limitations:** In pure vocabulary-only TF-IDF, impersonation shares heavy linguistic vocabulary with generic phishing. Structural features (domain alignment, Reply-To mismatch) are necessary to maintain high recall.

### Source 4: Curated BEC & Wire Fraud Dataset
- **Original Source:** TraceXMail Business Email Compromise & Financial Fraud Suite.
- **Reference / URL:** Modeled after FBI Internet Crime Complaint Center (IC3) BEC Public Threat Advisories.
- **Original Purpose:** Train models to detect conversational, text-based financial manipulation that lacks malicious hyperlinks or attachments.
- **Samples Included:** 42 to 112 records.
- **Classes Represented:** `Fraud-related`
- **Label Assignment:** Adheres to IC3 BEC Typology: urgent CEO/executive wire requests, vendor invoice routing alterations, payroll direct deposit re-routing, and urgent confidential transactions.
- **Preprocessing:** Extraction of financial, banking, and urgency keyword triggers (`__cue_fraud_wire__`).
- **License / Constraints:** TraceXMail Project Open Source.
- **Known Limitations:** Lower sample volume compared to legitimate mail, matching the real-world operational reality where BEC attacks represent <1% of total enterprise volume but account for the highest monetary losses.

### Source 5: Curated Unsolicited Marketing Dataset (Graymail / Suspicious)
- **Original Source:** TraceXMail Marketing & Graymail Benchmark.
- **Reference / URL:** In-repository generation script (`scripts/build_corpus.ts`).
- **Original Purpose:** Train the model to distinguish intrusive but non-fraudulent cold outreach from malicious attacks.
- **Samples Included:** 58 to 90 records.
- **Classes Represented:** `Suspicious`
- **Label Assignment:** Aggressive sales pitches, high-pressure cold outbound, bulk lead databases, automated SEO offers, and graymail containing opt-out footers.
- **Preprocessing:** Extraction of marketing and promo cue tokens.
- **License / Constraints:** TraceXMail Project Open Source.
- **Known Limitations:** Graymail categorization can be subjective depending on corporate mail filter thresholds.

---

## 4. Preprocessing & Feature Transformation Pipeline

1. **Header & Body Ingestion:** Subject and body text are combined (`${subject} ${subject} ${body}`) to grant double weighting to the high-salience subject line.
2. **Text Normalization:**
   - URL stripping: Replaced with canonical `url_token`.
   - IP address replacement: Replaced with `ip_token`.
   - Lowercasing, punctuation stripping, and token filtering (tokens of length 2–25 characters).
3. **N-Gram Expansion:** Word unigrams + consecutive word bigrams (e.g. `wire_transfer`, `account_suspended`).
4. **Structural Feature Engineering:**
   - Sender domain tokenization (`domain_<fromDomain>`)
   - Brand alignment cues (`from_brand_<brand>`, `__cue_brand_domain_mismatch__`)
   - Domain cues (`__cue_fraud_wire__`, `__cue_phish_urgency__`, `__cue_legitimate_work__`, `__cue_marketing_promo__`)
5. **Sublinear TF-IDF Vectorization:**
   - Term frequency: $\text{TF} = 1 + \ln(\text{count})$
   - Inverse document frequency: $\text{IDF} = \ln\left(\frac{N_{\text{train}} + 1}{\text{DF} + 1}\right) + 1$
   - Fitted strictly on the training partition.
6. **L2 Document Normalization:** All vectors are projected onto the unit hypersphere ($\|v\|_2 = 1.0$) to guarantee document length invariance.

---

## 5. Train/Test Leakage Safeguards

- **Stratified Partitioning:** Fixed pseudorandom seed `424242` preserves exact class balance across folds.
- **Zero Vocabulary Leakage:** The vocabulary dictionary ($V \le 3,500$ terms) and all IDF weights are calculated strictly from training records. Out-of-vocabulary terms in the test set are treated as zero.
- **Centroid Isolation:** Class mean centroids are computed exclusively from training vectors. The held-out test set is evaluated once in isolation.

---

## 6. Known Dataset Limitations

1. **Historical Phishing Corpus Vintage:** The Nazario dataset contains authentic attacks from an era prior to modern mandatory SPF/DKIM/DMARC policies.
2. **Synthetic Enterprise Representation:** Legitimate emails use rotated parameterized templates to maintain PII safety, which produces more uniform document lengths than live chaotic enterprise mailboxes.
3. **Class Asymmetry:** Legitimate emails significantly outnumber Fraud-related samples (up to 10:1 ratio). Model evaluation must always be judged on **Macro F1** and **Per-Class Recall**, not raw accuracy alone.
