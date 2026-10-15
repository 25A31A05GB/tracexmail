# TraceXMail Security Hardening, Schema Integrity & ML Remediation Plan

Comprehensive engineering plan to remediate critical security vulnerabilities, repair PostgreSQL schema definition mismatches, correct machine learning evaluation and feature polarity anomalies, and fix web routing and asset hygiene across the TraceXMail platform.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following remediation approaches have been confirmed based on user instructions and clarifying answers:

- **Confirmed Decision 1 (Credential Security)**: Generate unique, cryptographically strong bcrypt password hashes for every account in `data/org_users.json`, strip the `clearPassword` field entirely from all records and stores, remove hardcoded fallback credentials (`Password1234!`), and eliminate cleartext password persistence from `src/server/orgUserStore.ts`.
- **Confirmed Decision 2 (Schema Constraint)**: Expand the PostgreSQL `cases.status` `CHECK` constraint in `schema.sql` to include `'QUARANTINED'` and `'CLOSED'` so existing records in `data/cases.json` can be migrated cleanly without constraint violations.
- **Confirmed Decision 3 (ML Evaluation & Feature Polarities)**: Fix the un-stratified sampling bug in `scripts/build_dataset_and_train.ts` (where the first 1,000 records were all `Legitimate`, artificially yielding `meanMacroF1 = 0.2`), calculate and populate true Wilcoxon-Mann-Whitney AUC-ROC and $R^2$ in the meta-classifier model artifact, and correct feature polarities for `identityReplyToMismatch` and `infraTorOrAbuse` so risk indicators carry positive weights.

---

## 1. Overview & Core Concept

TraceXMail is a production-grade enterprise email forensics and threat analysis platform with real-time header tracing, ML-powered phishing and BEC detection, Gmail API quarantine sync, and multi-tenant SOC telemetry. 

This phase delivers essential security and infrastructure remediation:
1. **Zero Cleartext Credentials**: Elimination of plaintext credentials and shared passwords across system manifests.
2. **Strict File Hygiene**: Gitignoring sensitive live connection states and runtime manifests, and isolating test artifacts to temporary directories.
3. **Database Schema Parity**: Resolving index column mismatches and status enum discrepancies so PostgreSQL migrations execute flawlessly.
4. **Authentic ML Telemetry**: Ensuring multi-class cross-validation metrics, ROC-AUC, and feature coefficients reflect genuine model discrimination.
5. **SEO & Routing Integrity**: Preventing Vercel rewrites from swallowing static `/about` and `/knowledge/*` pages, and removing placeholder AdSense/GA tags.

---

## 2. System Architecture & Remediation Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                          TraceXMail Remediation                         │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│ Security & State │       │ Database Schemas │       │  ML & Analytics  │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│• Strip plaintext │       │• Fix intel_cache │       │• Stratify CV     │
│  clearPassword   │       │  index on type   │       │  k-fold sample   │
│• Unique bcrypt   │       │• Add QUARANTINED │       │• Compute true    │
│  password hashes │       │  & CLOSED status │       │  AUC-ROC & R²    │
│• Gitignore token │       │• Supabase auth   │       │• Positive threat │
│  & users files   │       │  isolation note  │       │  coefficients    │
│• os.tmpdir() for │       │                  │       │• Reconcile BEC   │
│  test fixtures   │       │                  │       │  model metrics   │
└──────────────────┘       └──────────────────┘       └──────────────────┘
         │                           │                           │
         └───────────────────────────┼───────────────────────────┘
                                     ▼
                   ┌──────────────────────────────────┐
                   │    Web, SEO & Asset Hygiene      │
                   ├──────────────────────────────────┤
                   │• vercel.json: exempt /knowledge  │
                   │  and /about from SPA rewrite     │
                   │• index.html: clean placeholder   │
                   │  GA ID & AdSense publisher tag   │
                   │• tor-exit-list.txt: repair line  │
                   │  terminators & truncated records │
                   └──────────────────────────────────┘
```

---

## 3. Key Product & Engineering Decisions

### Security Hardening
- **Password Rotation & Hash Generation**: Replace shared passwords with individual, high-entropy bcrypt hashes (10 rounds). The `clearPassword` property will be removed from `data/org_users.json`, the TypeScript `OrgUser` interface, `orgUserStore.ts`, and frontend API serializers. The legacy fallback `Password1234!` check in `authenticateOrgUser` will be removed.
- **Credential Storage & Gitignore**: Add `.gmail_connection.json` and `data/org_users.json` to `.gitignore`. Since `.git` is not currently initialized in this sandbox, we verify that these sensitive files cannot be tracked or committed.
- **Test Artifact Isolation**: `src/server/testimonialStore.ts` currently writes `data/user_testimonials.test.json` into the root `data/` folder during test runs. Update it to use `path.join(os.tmpdir(), 'user_testimonials.test.json')` and delete the stray test fixture file.

### Database Schema Corrections
- **`schema_extensions.sql` Index Fix**: Line 134 creates `idx_intel_cache_provider_key` on `intelligence_cache(provider, lookup_key)`, but the table defines columns `(cache_type, lookup_key)`. Change index definition to `intelligence_cache(cache_type, lookup_key)`.
- **`schema.sql` Cases Status CHECK Expansion**: Line 37 enforces `status IN ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'FALSE_POSITIVE')`. `data/cases.json` includes `QUARANTINED` and `CLOSED`. Expand the constraint to:
  ```sql
  CHECK (status IN ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'FALSE_POSITIVE', 'QUARANTINED', 'CLOSED'))
  ```
- **Supabase User Reference Portability**: Add SQL comments and portability guards around `auth.users(id)` foreign key references in `case_notes` and `team_invitations` to clarify execution requirements on standard PostgreSQL vs Supabase-managed environments.

### ML Reporting & Model Calibration
- **5-Class Stratified Cross-Validation**: `scripts/build_dataset_and_train.ts` selected `allRecords.slice(0, 1000)` for hyperparameter grid evaluation. Because `real_corpus.json` begins with 1,500 `Legitimate` records, that slice contained 100% `Legitimate` emails, causing zero precision/recall on classes 1–4 and an exact baseline macro-F1 of $0.2000$. Implement stratified sampling (equal representation across all 5 classes) to compute genuine multi-class macro-F1, calibration curves, and Expected Calibration Error (ECE) for `cv_report.json`.
- **Meta-Classifier AUC & R²**: Compute Wilcoxon-Mann-Whitney ROC-AUC and coefficient of determination ($R^2$) dynamically during evaluation, and write valid floating-point values into `data/datasets/meta_classifier_model.json`.
- **Feature Polarity Corrections**: In `scripts/build_dataset_and_train.ts` and `src/server/metaClassifier.ts`, ensure `infraTorOrAbuse` and `identityReplyToMismatch` properly correlate with malicious labels (`Suspicious`, `Phishing`, `Fraud-related`, `Impersonated`) and enforce non-negative weights on risk features so threat indicators never reduce the overall threat score.
- **BEC Metrics Alignment**: Reconcile `data/datasets/bec_learned_model.json` metrics and comparison notes to accurately reflect learned F1 vs heuristic baseline.

### Web Routing, SEO & Asset Hygiene
- **Vercel Rewrite Fix**: In `vercel.json`, update the rewrite exclusion pattern:
  ```json
  "source": "/((?!api|privacy|terms|cookies|domains|contact|security|auth|about|knowledge|assets|robots\\.txt|sitemap\\.xml|llms.*).*)",
  "destination": "/index.html"
  ```
  This ensures `/about`, `/knowledge`, `/knowledge/detecting-phishing-and-bec.html`, `/knowledge/email-header-forensics-guide.html`, and `/knowledge/understanding-spf-dkim-dmarc.html` are directly served as static HTML files instead of being rewritten to SPA `/index.html`.
- **AdSense & GA Cleanup**: Remove placeholder Google AdSense meta/script tags (`ca-pub-9357545069587539`) and placeholder GA script (`G-TRACEXMAIL1`) from `index.html`.
- **Tor Exit List Sanity**: Repair `data/threat-lists/tor-exit-list.txt` ensuring valid IPv4/IPv6 syntax per line, valid trailing newline, and no truncated fragments.

---

## 4. Verification Plan

1. **Automated Test Suite**: Run `npm test` to verify all 154 tests pass without regressions.
2. **Build & Type Checking**: Run `compile_applet` and `npm run build` to ensure clean TypeScript compilation and Vite bundling.
3. **Password & Auth Verification**: Verify `authenticateOrgUser` correctly authenticates users via bcrypt with zero cleartext password properties in disk or memory.
4. **Schema Verification**: Validate that `schema.sql` and `schema_extensions.sql` have valid PostgreSQL DDL syntax.
5. **Static Routing Verification**: Verify static files in `public/about/` and `public/knowledge/` match `vercel.json` rewrite exemption rules.
6. **ML Metrics Verification**: Verify `cv_report.json` and `meta_classifier_model.json` contain non-trivial macro-F1, valid positive coefficients for threat features, and non-null `aucRoc`.
