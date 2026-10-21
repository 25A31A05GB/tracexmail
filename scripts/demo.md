# TraceXMail 5-Minute Evaluator Click-Through Demo Script (Prompt 32)

Follow this structured 5-minute walkthrough to evaluate TraceXMail's complete forensic intelligence, machine learning pipeline, and MLOps capabilities.

---

## Pre-Requisites & Setup (0:00 - 0:30)

1. Ensure the development server is running on `http://localhost:3000`.
2. Open Chrome or Firefox to `http://localhost:3000`.
3. Default credentials (if prompted):
   - **Admin Portal**: User `superadmin@tracexmail.security`, Password `UltimateBoss2026!`
   - Or click **"Demo Mode"** directly from the landing page.

---

## Step 1: Ingestion & Live Multi-Layer Classification (0:30 - 1:30)

1. In the left navigation sidebar, click on **Ingest** (`/ingest`) or click **New Analysis** in the header.
2. Select the **"Sample Presets"** dropdown and pick **"Executive Wire Transfer BEC (CEO Impersonation)"**.
3. Notice the live extraction of:
   - Claimed Display Name: `"Satya Nadella <satya@microsoft.com>"`
   - Actual Transmission Domain: `"executive-urgent-update.net"`
   - SPF/DKIM Authentication: `FAIL / NONE`
   - Financial Remittance: Extracted wire amount `$482,500.00` and international SWIFT code.
4. Click **"Execute Forensic Analysis"**.
5. Observe the sub-10ms pipeline execution through all 8 forensic layers.

---

## Step 2: The Two-Panel Forensic Case Inspection (1:30 - 2:45)

1. You are automatically transitioned into the **Cases View** (`/cases`).
2. **Left Panel (Raw & Cryptographic Evidence)**:
   - Check the **Authentication Checks** pill grid: SPF, DKIM, and DMARC status.
   - Switch between **Headers**, **Decoded Body**, and **Raw MIME** tabs.
   - Click **"Authoritative DNS & Domain Intelligence"** to see live MX records, A records, and DNSSEC zone security.
3. **Right Panel (Forensics & Explainability)**:
   - Observe the interactive **3D Threat Core**: Threat Score **92/100 (Phishing / BEC Fraud)**.
   - Inspect the **Model Explainability & Feature Attribution Card (Prompt 30)**:
     - Top-1: `structural_identity_mismatch (+25 pts)`
     - Top-2: `auth_spf_fail (+25 pts)`
     - Top-3: `financial_entity_risk (+15 pts)`
   - Expand the **Counterfactual "Fix-to-Deliver" Remediation**:
     - See the exact minimal change needed: *"Align From header domain with authoritative DNS relay to eliminate identity mismatch penalty"*.

---

## Step 3: MLOps Model Health & Registry Dashboard (2:45 - 4:00)

1. In the sidebar, navigate to **Boss Admin** (`/boss_admin`).
2. In the top subtab bar, click **"Model Health & MLOps (Prompt 31)"**.
3. Inspect the live telemetry:
   - **Active Production Model**: `centroid_cosine:v2.5` (Macro-F1: `0.785`, Latency: `1.2ms`).
   - **Shadow Mode Traffic**: Real-time agreement rate (**93.7%**) with shadow candidate `gradient_boosting:v1.0`.
   - **Disagreement Inspector**: Review live production vs candidate disagreements on border-case emails.
   - **Feature Drift Telemetry**: Population Stability Index (PSI) and Jensen-Shannon divergence across the top-5 forensic features (all currently `< 0.02`, zero alerts).
4. **Test the One-Click Promotion & Rollback**:
   - In the Model Registry table, click **"Promote to Prod"** on `gradient_boosting:v1.0`.
   - Observe the automated promotion gate check (Macro-F1, FPR $\le$ 2%, Latency $\le$ 50ms).
   - Click **"Rollback"** to instantly revert to `centroid_cosine:v2.5` with full audit trail logging.

---

## Step 4: Empirical Reports & Error Analysis (4:00 - 5:00)

1. Open your terminal or file explorer and review the generated empirical reports:
   - `reports/BENCHMARK.md`: Baseline models comparison on identical clean test splits.
   - `reports/ABLATION.md`: Leave-one-out and cumulative layer contributions.
   - `reports/LLM_EVAL.md`: Multi-model prompt versions, Zod validation, and prompt injection defense.
   - `reports/ERROR_ANALYSIS.md`: Unsupervised error clustering, slice metrics, and deletion faithfulness curves.
   - `notebooks/01_results_walkthrough.ipynb`: Jupyter results walkthrough with interactive plots.
2. Run any reproducible target via `./scripts/make.sh <target>`:
   ```bash
   ./scripts/make.sh baselines
   ./scripts/make.sh ablation
   ```
