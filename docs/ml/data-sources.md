# Machine Learning Email Corpora Provenance & License Manifest

This document records the provenance, attribution, and license terms for all public and curated email corpora ingested into the TraceXMail forensic dataset. In accordance with strict pipeline requirements, any corpus lacking an explicit license entry in this file is rejected by `scripts/ml/ingest_public_corpora.ts`.

---

## 1. Registered Corpora & Licenses

### 1. Nazario Phishing Corpus (`nazario_phishing`)
- **Source**: Jose Nazario / Monkey.org Phishing Archive (collected 2005–present)
- **Domain**: Phishing, Credential Harvesting, Social Engineering
- **License**: Public Domain / Apache License 2.0
- **Allowed Usages**: Research, academic evaluation, defensive model training
- **PII Treatment**: Stripped sender names, HMAC-SHA256 pseudonymized recipient and source addresses, sanitized contact numbers

### 2. Enron Email Corpus (`enron_ham`)
- **Source**: Federal Energy Regulatory Commission (FERC) / CALO Project (William Cohen, CMU)
- **Domain**: Legitimate corporate communications (Ham)
- **License**: Public Domain (FERC Open Government Records)
- **Allowed Usages**: Linguistic research, benchmarking, legitimate baseline modeling
- **PII Treatment**: RFC 5322 headers pseudonymized, phone numbers regex-stripped, corporate employee identities hashed

### 3. Apache SpamAssassin Public Corpus (`spamassassin_ham`)
- **Source**: Apache Software Foundation (Apache SpamAssassin Project)
- **Domain**: Legitimate non-spam mailing list communications (Easy Ham / Hard Ham)
- **License**: Apache License 2.0
- **Allowed Usages**: Non-commercial & commercial ML training, spam filtering benchmarks
- **PII Treatment**: Subscriber emails pseudonymized, personal headers sanitized

### 4. TraceXMail Curated Cloud & Enterprise Baseline (`tracexmail_curated`)
- **Source**: TraceXMail Threat Intel Research Team (curated synthetic & sanitized enterprise alerts)
- **Domain**: Multi-class forensics (Legitimate, Phishing, Credential Harvesting, Suspicious)
- **License**: MIT License
- **Allowed Usages**: Model training, testing, continuous eval
- **PII Treatment**: Synthetic zero-PII data with RFC 5322 standard synthetic identifiers

### 5. BEC & Executive Wire Fraud Tactical Set (`bec_wire_fraud`)
- **Source**: TraceXMail Incident Response & Tactical Threat Intel Repository
- **Domain**: Business Email Compromise (BEC), CEO Fraud, Vendor Wire Redirection, Gift Card Scams
- **License**: MIT License
- **Allowed Usages**: Defensive model training, forensic classification
- **PII Treatment**: Company names pseudonymized with synthetic counterparts, financial account numbers masked with HMAC checksums

---

## 2. Ingestion Policy & Rules

1. Any dataset placed in `data/raw_corpora/` MUST have a matching `name` or `corpus` entry in this document with a declared `license`.
2. Any record lacking verifiable license terms is rejected at ingestion.
3. Automated downloads are disabled: all corpora must be placed in `data/raw_corpora/` by the researcher.
4. Before ingestion into `data/datasets/ingested_corpora.json`, all PII (names, personal emails, phone numbers) must pass through `src/ml/pii_removal.ts`.
