# TraceXMail Production MLOps Architecture & Runbook (Prompt 31)

**Production Model**: `centroid_cosine:v2.5`  
**Active Schema Version**: `2.5.0`  
**Promoted At**: 2026-10-20T07:12:00Z  
**Last Updated**: 2026-10-21T19:43:16.038Z  

---

## 1. Model Registry Architecture

TraceXMail manages model artifacts in an immutable versioned directory hierarchy under `models/<name>/<version>/`:

```text
models/
├── registry.json                    # Canonical pointers (production, candidate, history)
├── centroid_cosine/
│   └── v2.5/
│       ├── metadata.json           # Hashes, commit, hyperparams, benchmark metrics
│       └── trained_model.json      # Serialized vocabulary and centroid vectors
├── gradient_boosting/
│   └── v1.0/
│       ├── metadata.json
│       └── gb_model.json
└── transformer/
    └── v1/
        ├── metadata.json
        ├── model_quantized.onnx    # INT8 dynamic quantized weights
        └── metrics.json
```

---

## 2. Automated Promotion Gates

Candidate models must pass **all four hard gates** prior to updating the production pointer in `models/registry.json`:

| Gate Name | Metric Target | Threshold Criterion |
| :--- | :--- | :--- |
| **Macro-F1 Preservation** | `macro_f1` | **Candidate $\ge$ Current Production** |
| **False-Positive Guardrail** | `fpr_legitimate` | **$\le$ 2.0% on Legitimate Test Split** |
| **Adversarial Holdout Retention** | `holdout_acc` | **Regression $\le$ 1.0 percentage point** |
| **P95 Latency SLA** | `p95_latency_ms` | **$\le$ 50.0 ms inference budget** |

### Promotion CLI Command
```bash
npm run model:promote -- --name gradient_boosting --version v1.0
```
If any gate fails, the CLI rejects promotion with an exit code of 1 and prints the exact breach delta.

---

## 3. Emergency Rollback Protocol

If anomalous inference behavior or upstream schema drift is detected in production:

```bash
npm run model:rollback
```
- Automatically swaps the `production` pointer to the `previous_production` release.
- Updates `models/registry.json` audit trail with timestamps and user provenance.
- Immediate zero-downtime hot reload via the in-memory `mlEngine`.

---

## 4. Shadow Mode Deployment

Candidate models run concurrently with production traffic without altering user-facing verdicts:
- Both predictions are computed and streamed to `models/shadow_traffic.json`.
- Real-time agreement telemetry available via `GET /api/admin/models/shadow-report`.
- **Current Shadow Stats**:
  - Evaluated Cases: **240**
  - Agreement Rate: **93.7%**
  - Mean Latency Overhead: **+3.6 ms**

---

## 5. Statistical Drift Monitoring (PSI & Jensen-Shannon)

TraceXMail continuously monitors feature distribution shifts between the training baseline and the last 7 days of inference traffic:

$$\text{PSI} = \sum_{i=1}^k \left( \text{Actual}_i - \text{Expected}_i \right) \times \ln\left( \frac{\text{Actual}_i}{\text{Expected}_i} \right)$$

- **Thresholds**:
  - $\text{PSI} < 0.10$: Stable / Normal
  - $0.10 \le \text{PSI} \le 0.20$: Moderate Shift (Warning)
  - $\text{PSI} > 0.20$: Significant Drift (Automatic Alert Triggered)

### Current Feature PSI Metrics:
- **auth_spf_result**: PSI = `0.0019`, JS = `0.0002` [Status: **NORMAL**]
- **domain_age_days**: PSI = `0.0055`, JS = `0.0007` [Status: **NORMAL**]
- **url_count_per_email**: PSI = `0.0067`, JS = `0.0008` [Status: **NORMAL**]
- **lexicon_urgency_score**: PSI = `0.003`, JS = `0.0004` [Status: **NORMAL**]
- **reply_to_mismatch_rate**: PSI = `0.0035`, JS = `0.0004` [Status: **NORMAL**]

---

## 6. Admin API Endpoints

- `GET /api/admin/models/registry`: List all registered models and active production pointer.
- `GET /api/admin/models/shadow-report`: Agreement rate and discrepancy cases between production and shadow candidate.
- `GET /api/admin/models/drift`: Latest 7-day PSI and Jensen-Shannon divergence scores.
- `POST /api/admin/models/promote`: Trigger automated gate validation and promote candidate.
- `POST /api/admin/models/rollback`: Instant hot rollback to prior production version.
